# LIGHTWEIGHT_BACKEND_SPEC: Architettura Backend & Database Ultra-Leggero per VPS S

Documento di specifica tecnica per il deployment di un'infrastruttura backend monolitica, iper-leggera e resiliente su **VPS S IONOS / Hetzner / Contabo**:
- **Risorse Hardware**: 1 vCore CPU, 2 GB RAM, 60 GB NVMe SSD.
- **Sistema Operativo**: Linux AlmaLinux 9 (x86_64, SELinux enforcing).
- **Target Memory Footprint**: < 600 MB RAM totali a regime.
- **Obiettivo Funzionale**: Sincronizzazione in tempo reale tra Personal Trainer e Allieva, con salvaguardia assoluta dei log di allenamento storici (Zero Data Loss su modifiche o cancellazioni delle schede).

---

## 1. ARCHITETTURA DI SISTEMA & BUDGET DI MEMORIA

### 1.1 Ripartizione Rigorosa della Memoria (Target < 600 MB)

Sulla VPS con 2 GB di RAM fisica, la memoria di lavoro è allocata in modo deterministico:

| Componente | Target RSS Tipico | Limite Docker (`memory:`) | Riserva Minima (`reservations:`) |
|---|---|---|---|
| **PostgreSQL 16 Alpine** | 75 MB - 110 MB | 180 MB | 80 MB |
| **Node.js (Fastify API)** | 110 MB - 150 MB | 250 MB | 100 MB |
| **Nginx Reverse Proxy** | 15 MB - 25 MB | 50 MB | 15 MB |
| **OS AlmaLinux 9 / Docker Daemon** | 180 MB - 240 MB | N/A (Host) | N/A |
| **Buffer / Cache / Headroom Libero** | ~1.4 GB (protetto da 2GB Swap) | **Totale Container: 480 MB** | **Totale Riserva: 195 MB** |

```
[ Host: AlmaLinux 9 (2 GB RAM + 2 GB Swap NVMe) ]
  ├── OS Kernel, Systemd, SSH, Docker Daemon: ~220 MB
  └── Docker Compose Sandbox:
        ├── [Nginx Proxy]       (max 50 MB)  --> Porta 80/443 SSL Let's Encrypt
        ├── [Fastify API]       (max 250 MB) --> Porta 8000 (Node.js runtime con Drizzle)
        └── [PostgreSQL 16]     (max 180 MB) --> Porta 5432 (shared_buffers=64MB)
```

### 1.2 Scelta Tecnologica: Fastify + Drizzle ORM

1. **Fastify v4/v5**:
   - Consumo base di memoria: **35-45 MB RSS** (contro i >100 MB di framework NestJS/Spring o 70 MB di Express sotto carico).
   - Validazione e serializzazione I/O tramite Ajv e `fast-json-stringify`: fino a 2x-4x il throughput di Express a parità di CPU.
   - Modello di routing e plugin incapsulati con lifecycle standard (`onRequest`, `preHandler`, `onResponse`).
2. **Drizzle ORM + `postgres.js` (`porsager/postgres`)**:
   - **Zero Engine Overhead**: A differenza di Prisma (il cui query engine C++ consuma 80-120 MB RAM da solo e soffre di cold-start elevati), Drizzle è un compiler TypeScript puro che genera SQL nativo senza runtime pesante.
   - Type Safety condivisa a tempo di compilazione direttamente compatibile con i modelli definiti nel client mobile (`src/types/`).
   - Query builder leggero: footprint in memoria < 10 MB.

---

## 2. DATABASE DECOUPLED: PROTEZIONE ASSOLUTA DEI LOG STORICI

### 2.1 Il Problema del Design Tradizionale "Accoppiato"
In molte applicazioni fitness, la tabella `workout_sessions` (i log di ciò che l'atleta esegue in palestra) punta con vincolo di foreign key diretta (`ON DELETE CASCADE` o `ON DELETE RESTRICT`) alle tabelle della scheda `workout_routines` o ai suoi esercizi `routine_exercises`.
Se il Trainer:
1. Elimina la vecchia scheda "Mese 1" quando assegna la scheda "Mese 2", la cascata elimina **tutti i log storici, i carichi sollevati e le date di allenamento dell'allieva**.
2. Modifica un esercizio nella scheda (es. sostituisce "Panca Inclinata Manubri" con "Croci ai Cavi"), una query basata su `JOIN` mostrerà erroneamente che l'atleta mesi prima eseguiva "Croci ai Cavi", corrompendo la fedeltà del logbook.

### 2.2 Il Pattern Decoupled (Snapshot Immutabile di Sessione)
Lo schema di produzione separa nettamente:
1. **Layer Master/Template (`workout_routines`)**: schede ideate dal trainer, soggette a modifiche, riordinamenti, aggiunta/rimozione serie ed eliminazioni.
2. **Layer Esecuzione/Storico (`workout_sessions`)**: entità **immutabili** che registrano ciò che è realmente avvenuto in palestra.

#### Regole Chiave del Decoupling:
- La relazione `workout_sessions.routine_id` è **opzionale e impostata su `ON DELETE SET NULL`**.
- La sessione memorizza una copia testuale congelata `routine_name_snapshot`.
- Ogni esercizio registrato (`workout_session_exercises`) salva `exercise_name_snapshot` e `muscle_group_snapshot`, oltre al riferimento facoltativo `exercise_id ON DELETE SET NULL`.
- L'eliminazione o modifica di una scheda o di un esercizio nel catalogo master ha **zero impatto** sulla cronologia storica dell'atleta.

### 2.3 Definizione DDL SQL PostgreSQL

```sql
-- Abilitazione UUID (opzionale se si usano BIGSERIAL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- TABELLA UTENTI & AUTH
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    role VARCHAR(20) NOT NULL CHECK (role IN ('TRAINER', 'CLIENT')),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date VARCHAR(20),
    height_cm NUMERIC(5, 2),
    avatar_url TEXT,
    email VARCHAR(255),
    is_profile_completed BOOLEAN DEFAULT FALSE,
    trainer_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otps (
    code VARCHAR(16) PRIMARY KEY,
    trainer_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- CATALOGO ESERCIZI BASE
-- =========================================================
CREATE TABLE IF NOT EXISTS exercises (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    muscle_group VARCHAR(50) NOT NULL,
    exercise_type VARCHAR(20) NOT NULL CHECK (exercise_type IN ('reps', 'time', 'bodyweight')),
    description TEXT,
    video_url TEXT,
    is_archived SMALLINT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- TEMPLATE SCHEDE (MASTER ROUTINES - GESTITE DAL TRAINER)
-- =========================================================
CREATE TABLE IF NOT EXISTS routine_folders (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    owner_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workout_routines (
    id SERIAL PRIMARY KEY,
    folder_id VARCHAR(64) REFERENCES routine_folders(id) ON DELETE SET NULL,
    folder_name VARCHAR(100),
    border_color VARCHAR(30) DEFAULT '#3B82F6',
    name VARCHAR(150) NOT NULL,
    description TEXT,
    workout_type VARCHAR(50),
    duration_weeks INT DEFAULT 4,
    owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS routine_exercises (
    id SERIAL PRIMARY KEY,
    routine_id INT NOT NULL REFERENCES workout_routines(id) ON DELETE CASCADE,
    exercise_id INT REFERENCES exercises(id) ON DELETE SET NULL,
    exercise_order INT NOT NULL DEFAULT 1,
    superset_group VARCHAR(20),
    custom_description TEXT,
    custom_video_url TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS routine_exercise_sets (
    id SERIAL PRIMARY KEY,
    routine_exercise_id INT NOT NULL REFERENCES routine_exercises(id) ON DELETE CASCADE,
    set_number INT NOT NULL,
    set_type VARCHAR(30) NOT NULL DEFAULT 'normal',
    target_weight_kg NUMERIC(6, 2) DEFAULT 0,
    target_reps INT DEFAULT 0,
    target_time_seconds INT,
    band_assistance VARCHAR(30) DEFAULT 'none',
    dropset_weight_kg NUMERIC(6, 2),
    drops JSONB DEFAULT '[]'::jsonb,
    rest_seconds INT NOT NULL DEFAULT 90,
    notes TEXT
);

-- =========================================================
-- LOG STORICI DI ALLENAMENTO (DECOUPLED - IMMUTABILI)
-- =========================================================
CREATE TABLE IF NOT EXISTS workout_sessions (
    id BIGSERIAL PRIMARY KEY,
    owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- RELAZIONE DEBOLE: Se la scheda viene eliminata, il log NON viene cancellato!
    routine_id INT REFERENCES workout_routines(id) ON DELETE SET NULL,
    -- SNAPSHOT CONGELATO DEL NOME DELLA SCHEDA
    routine_name_snapshot VARCHAR(150) NOT NULL,
    date DATE NOT NULL,
    duration_minutes INT,
    workout_type VARCHAR(50),
    week_number INT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workout_sessions_owner_date ON workout_sessions(owner_id, date DESC);

CREATE TABLE IF NOT EXISTS workout_session_exercises (
    id BIGSERIAL PRIMARY KEY,
    workout_session_id BIGINT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    -- RELAZIONE DEBOLE: Se l'esercizio nel catalogo viene rimosso, non intacca lo storico
    exercise_id INT REFERENCES exercises(id) ON DELETE SET NULL,
    -- SNAPSHOT CONGELATO: Garantisce la lettura corretta anche ad anni di distanza
    exercise_name_snapshot VARCHAR(150) NOT NULL,
    muscle_group_snapshot VARCHAR(50) NOT NULL,
    exercise_order INT NOT NULL DEFAULT 1,
    superset_group VARCHAR(20),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS workout_session_sets (
    id BIGSERIAL PRIMARY KEY,
    session_exercise_id BIGINT NOT NULL REFERENCES workout_session_exercises(id) ON DELETE CASCADE,
    set_number INT NOT NULL,
    set_type VARCHAR(30) NOT NULL DEFAULT 'normal',
    weight_kg NUMERIC(6, 2) NOT NULL DEFAULT 0,
    reps INT NOT NULL DEFAULT 0,
    time_seconds INT,
    band_assistance VARCHAR(30) DEFAULT 'none',
    dropset_weight_kg NUMERIC(6, 2),
    drops JSONB DEFAULT '[]'::jsonb,
    rest_seconds INT,
    rpe NUMERIC(3, 1),
    completed BOOLEAN DEFAULT TRUE,
    notes TEXT
);

-- =========================================================
-- MISURAZIONI CORPOREE & PIANI ALIMENTARI (PDF)
-- =========================================================
CREATE TABLE IF NOT EXISTS body_measurements (
    id BIGSERIAL PRIMARY KEY,
    owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    weight_kg NUMERIC(5, 2) NOT NULL,
    weight_delta_kg NUMERIC(5, 2),
    bmi NUMERIC(4, 1),
    body_fat_pct NUMERIC(4, 1),
    muscle_mass_kg NUMERIC(5, 2),
    lean_mass_kg NUMERIC(5, 2),
    water_pct NUMERIC(4, 1),
    bone_mass_kg NUMERIC(4, 2),
    visceral_fat NUMERIC(4, 1),
    bmr_kcal INT,
    amr_kcal INT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS diet_pdfs (
    id SERIAL PRIMARY KEY,
    owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active SMALLINT DEFAULT 1,
    notes TEXT,
    source_file_name VARCHAR(255),
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 2.4 Drizzle ORM Schema (TypeScript)

La definizione TypeScript con Drizzle si interfaccia perfettamente con i contratti del client React Native:

```typescript
// backend/src/db/schema.ts
import { pgTable, serial, bigserial, varchar, text, timestamp, date, numeric, integer, boolean, smallint, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { SetDropStep } from '../types/workout';

export const users = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: varchar('role', { length: 20 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  birthDate: varchar('birth_date', { length: 20 }),
  heightCm: numeric('height_cm', { precision: 5, scale: 2 }),
  avatarUrl: text('avatar_url'),
  email: varchar('email', { length: 255 }),
  isProfileCompleted: boolean('is_profile_completed').default(false),
  trainerId: varchar('trainer_id', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const workoutRoutines = pgTable('workout_routines', {
  id: serial('id').primaryKey(),
  folderId: varchar('folder_id', { length: 64 }),
  folderName: varchar('folder_name', { length: 100 }),
  borderColor: varchar('border_color', { length: 30 }).default('#3B82F6'),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
  workoutType: varchar('workout_type', { length: 50 }),
  durationWeeks: integer('duration_weeks').default(4).notNull(),
  ownerId: varchar('owner_id', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const workoutSessions = pgTable('workout_sessions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  ownerId: varchar('owner_id', { length: 64 }).notNull(),
  routineId: integer('routine_id'), // ON DELETE SET NULL
  routineNameSnapshot: varchar('routine_name_snapshot', { length: 150 }).notNull(),
  date: date('date').notNull(),
  durationMinutes: integer('duration_minutes'),
  workoutType: varchar('workout_type', { length: 50 }),
  weekNumber: integer('week_number'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const workoutSessionExercises = pgTable('workout_session_exercises', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  workoutSessionId: bigserial('workout_session_id', { mode: 'number' }).notNull(),
  exerciseId: integer('exercise_id'), // ON DELETE SET NULL
  exerciseNameSnapshot: varchar('exercise_name_snapshot', { length: 150 }).notNull(),
  muscleGroupSnapshot: varchar('muscle_group_snapshot', { length: 50 }).notNull(),
  exerciseOrder: integer('exercise_order').default(1).notNull(),
  supersetGroup: varchar('superset_group', { length: 20 }),
  notes: text('notes'),
});

export const workoutSessionSets = pgTable('workout_session_sets', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sessionExerciseId: bigserial('session_exercise_id', { mode: 'number' }).notNull(),
  setNumber: integer('set_number').notNull(),
  setType: varchar('set_type', { length: 30 }).default('normal').notNull(),
  weightKg: numeric('weight_kg', { precision: 6, scale: 2 }).default('0').notNull(),
  reps: integer('reps').default(0).notNull(),
  timeSeconds: integer('time_seconds'),
  bandAssistance: varchar('band_assistance', { length: 30 }).default('none'),
  dropsetWeightKg: numeric('dropset_weight_kg', { precision: 6, scale: 2 }),
  drops: jsonb('drops').$type<SetDropStep[]>().default([]),
  restSeconds: integer('rest_seconds'),
  rpe: numeric('rpe', { precision: 3, scale: 1 }),
  completed: boolean('completed').default(true),
  notes: text('notes'),
});
```

---

## 3. TUNING POSTGRESQL PER FOOTPRINT RAM < 150 MB

I valori predefiniti di PostgreSQL allocano buffer dimensionati per server enterprise con 16-64 GB di RAM. Per garantire che l'istanza PostgreSQL 16 rimanga sotto i **120-150 MB effettivi**, applichiamo una configurazione mirata.

### 3.1 Formula di Calcolo della Memoria PostgreSQL
$$\text{RAM Teorica Massima} \approx \text{shared\_buffers} + (\text{work\_mem} \times \text{max\_connections}) + \text{maintenance\_work\_mem}$$
$$\text{RAM} \approx 64\text{ MB} + (4\text{ MB} \times 25) + 16\text{ MB} = 180\text{ MB (caso peggiore teorico)}$$
In condizioni reali (dove le connessioni contemporanee tipiche sono 2-5 con pool Fastify):
$$\text{RAM Reale In-Use} \approx 64\text{ MB} + (4\text{ MB} \times 3) + 15\text{ MB overhead} \approx \mathbf{91\text{ MB RSS}}$$

### 3.2 File di Configurazione `postgres.conf`

Salvare questo file sul server in `/opt/fitness-logbook/postgres.conf`:

```ini
# =====================================================================
# TUNING POSTGRESQL 16 PER VPS 2GB RAM (Target RAM < 150 MB)
# =====================================================================

# Connessioni
max_connections = 25                   # Sufficiente per Fastify pool (max 15 conn) + admin
superuser_reserved_connections = 3

# Buffer e Memoria Principale
shared_buffers = 64MB                  # 3-4% della RAM di sistema, sufficiente per indici e cache
effective_cache_size = 192MB           # Stima della memoria per il query planner
work_mem = 4MB                         # Memoria per sort concorrenti in memoria
maintenance_work_mem = 16MB            # Memoria per vacuum, indici e migrazioni

# WAL (Write-Ahead Logging) & Checkpoint
wal_buffers = 2MB
min_wal_size = 32MB
max_wal_size = 256MB
checkpoint_completion_target = 0.9     # Spalma le scritture su disco NVMe riducendo gli spike I/O

# Ottimizzazione Query Planner per SSD NVMe
random_page_cost = 1.1                 # Disco NVMe ultra-veloce (default HDD 4.0 causerebbe seq scan inutili)
effective_io_concurrency = 100
default_statistics_target = 50

# Logging essenziale (evita riempimento disco)
log_min_messages = warning
log_min_error_statement = error
log_min_duration_statement = 500       # Logga solo query lente (> 500ms)
```

---

## 4. ENDPOINT REST ESSENZIALI (CONTRATTI API)

Gli endpoint implementano rigorosamente i tipi TypeScript già configurati in `src/types/` e utilizzati dal client mobile.

Tutti gli endpoint applicano il formato di risposta unificato `ApiResponse<T>`:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: {
    code: string;
    message: string;
  } | null;
}
```

### 4.1 Autenticazione & Associazione Clienti (RBAC / OTP)

| Metodo | Endpoint | Header / Auth | Request Body DTO | Response Data |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Nessuno | `{ username, passwordOrOtp }` | `{ user: AuthUser, token: string }` |
| `POST` | `/api/v1/auth/provision` | `Bearer <JWT_TRAINER>` | `{ username, first_name, last_name, email?, notes? }` | `ProvisionedClient` (con codice OTP generato) |
| `GET` | `/api/v1/auth/provisioned-clients` | `Bearer <JWT_TRAINER>` | Nessuno | `ProvisionedClient[]` |
| `POST` | `/api/v1/auth/otp/generate` | `Bearer <JWT_TRAINER>` | `{ trainer_id, trainer_name }` | `{ code: string, expires_at: string }` |
| `POST` | `/api/v1/auth/otp/verify-link` | `Bearer <JWT_CLIENT>` | `{ otp_code, client_id, client_name }` | `{ success: boolean, trainer: { id, name }, client: { id, name } }` |

### 4.2 Profilo & Anagrafica Atleta

| Metodo | Endpoint | Header / Auth | Request Body DTO | Response Data |
|---|---|---|---|---|
| `GET` | `/api/v1/profile` | `Bearer <JWT>` | Nessuno | `UserProfile` |
| `PUT` | `/api/v1/profile` | `Bearer <JWT>` | `UpdateProfileRequestDto` | `UserProfile` |

### 4.3 Schede di Allenamento Master (Routines)

| Metodo | Endpoint | Header / Auth | Query / Body | Response Data |
|---|---|---|---|---|
| `GET` | `/api/v1/routines` | `Bearer <JWT>` | `?owner_id=<user_id>` | `WorkoutRoutine[]` (con nested exercises e sets) |
| `POST` | `/api/v1/routines` | `Bearer <JWT_TRAINER>` | `Omit<WorkoutRoutine, 'id'>` | `WorkoutRoutine` creata |
| `GET` | `/api/v1/routines/:id` | `Bearer <JWT>` | ID percorso | `WorkoutRoutine` |
| `PUT` | `/api/v1/routines/:id` | `Bearer <JWT_TRAINER>` | `Partial<WorkoutRoutine>` | `WorkoutRoutine` aggiornata |
| `DELETE` | `/api/v1/routines/:id`| `Bearer <JWT_TRAINER>` | ID percorso | `{ success: boolean }` |

### 4.4 Log Sessioni di Allenamento (Decoupled Workouts)

| Metodo | Endpoint | Header / Auth | Query / Body | Response Data |
|---|---|---|---|---|
| `GET` | `/api/v1/workouts` | `Bearer <JWT>` | `?owner_id=<id>&from=YYYY-MM-DD` | `Workout[]` (con nested exercises e sets) |
| `POST` | `/api/v1/workouts` | `Bearer <JWT>` | `Omit<Workout, 'id'>` | `Workout` salvato con snapshot immutabile |
| `GET` | `/api/v1/workouts/:id` | `Bearer <JWT>` | ID percorso | `Workout` |
| `DELETE` | `/api/v1/workouts/:id`| `Bearer <JWT>` | ID percorso | `{ success: boolean }` |

### 4.5 Cartelle, Misurazioni & Piani Alimentari

| Metodo | Endpoint | Header / Auth | Body / Descrizione | Response Data |
|---|---|---|---|---|
| `GET` / `POST` | `/api/v1/folders` | `Bearer <JWT>` | Gestione cartelle schede | `RoutineFolder[]` / `RoutineFolder` |
| `GET` / `POST` | `/api/v1/measurements`| `Bearer <JWT>` | Lettura e salvataggio pesate impedenziometriche | `BodyMeasurement[]` / `BodyMeasurement` |
| `POST` | `/api/v1/diets/upload` | `Bearer <JWT_TRAINER>` | `multipart/form-data` (file PDF + metadata) | `DietPdf` salvato su volume |
| `GET` | `/api/v1/diets/:id/pdf` | `Bearer <JWT>` | Streaming file binario PDF con `Content-Type: application/pdf` | File stream |
| `GET` | `/health` | Nessuno | Liveness & DB check per Docker e CI/CD | `{ status: "ok", uptime: number, db: "connected" }` |

---

## 5. DOCKER & STORAGE: ISOLAMENTO E PROTEZIONE DATI

### 5.1 Protezione Dati tramite Docker Named Volumes
Per impedire la distruzione involontaria dei dati del database in occasione di `docker compose down` o aggiornamenti delle immagini, la directory di PostgreSQL viene mappata su un **Named Volume gestito dal motore Docker** (`fitness_postgres_data`), memorizzato sul file system host in `/var/lib/docker/volumes/fitness_postgres_data/_data`.

I volumi configurati esplicitamente:
1. `fitness_postgres_data`: Protegge i cluster di database PostgreSQL (`/var/lib/postgresql/data`).
2. `fitness_uploads_data`: Archivia i file PDF dei piani alimentari caricati dal Trainer (`/app/uploads`).
3. `fitness_certbot_data`: Conserva i certificati SSL Let's Encrypt per Nginx.

---

## 6. LINUX SWAP & OTTIMIZZAZIONE KERNEL (ALMALINUX 9)

Sulla VPS S con 2 GB di RAM, un picco transitorio di compilazione o unpacking durante il comando `docker pull` rischierebbe di invocare l'OOM Killer del kernel Linux. La creazione di uno **Swapfile da 2 GB su disco NVMe** fornisce un cuscinetto elastico essenziale.

### 6.1 Procedura di Configurazione Swapfile (Passo-Passo su AlmaLinux 9)

Accedere alla VPS via SSH con utente `root` (o con privilegi `sudo`):

```bash
# 1. Creare il file di swap da 2 GB (2048 MB) usando dd
# Nota: su AlmaLinux 9 (filesystem XFS), 'dd' garantisce la preallocazione continua sicura dei blocchi.
dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress

# 2. Assegnare i permessi di sicurezza restrittivi (lettura/scrittura solo per root)
chmod 600 /swapfile

# 3. Formattare il file come swap space
mkswap /swapfile

# 4. Attivare immediatamente il file di swap
swapon /swapfile

# 5. Rendere lo swap persistente al riavvio del server aggiungendolo a /etc/fstab
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 6. Verificare l'attivazione
swapon --show
free -h
```

### 6.2 Ottimizzazione Parametri Kernel per RAM Ridotta

Di default, Linux sposta pagine in swap anche con RAM libera (`vm.swappiness = 60`). Per preservare le prestazioni NVMe mantenendo la RAM fisica prioritaria:

```bash
# Configurare swappiness a 10 (usa lo swap SOLO in caso di effettiva saturazione della RAM)
cat << 'EOF' > /etc/sysctl.d/99-fitness-swap.conf
vm.swappiness = 10
vm.vfs_cache_pressure = 50
EOF

# Applicare immediatamente senza riavviare
sysctl --system
```

---

## 7. STRATEGIA DI MIGRAZIONE ZERO-DOWNTIME

### 7.1 Lifecycle di Avvio del Container API

Per garantire che le migrazioni del database vengano applicate senza interrompere il servizio né causare conflitti:
1. Il container Docker backend include uno script di `entrypoint.sh`.
2. All'avvio del container, prima di fare il binding sulla porta HTTP `8000`, viene eseguito:
   ```bash
   node dist/db/migrate.js
   ```
   Tale script sfrutta `drizzle-orm/postgres-js/migrator`:
   - Crea e consulta la tabella `__drizzle_migrations`.
   - Applica solo le nuove migrazioni SQL generate in modo transazionale (`BEGIN ... COMMIT`).
3. Solo se la migrazione ha successo (`exit code 0`), viene avviato il server Fastify:
   ```bash
   exec node dist/index.js
   ```

### 7.2 Regole di Retrocompatibilità
- Le modifiche allo schema devono essere rigorosamente **additive** (es. `ADD COLUMN ... DEFAULT`, mai `DROP COLUMN` o rinomina immediata in un unico step).
- L'utilizzo dello schema Decoupled garantisce che le query del client non falliscano mai se viene aggiunto un nuovo campo facoltativo.

---

## 8. STRUTTURA CARTELLE VPS SUGGERITA

```
/opt/fitness-logbook/
├── docker-compose.yml          # Configurazione orchestrazione
├── postgres.conf              # Tuning memoria PostgreSQL
├── nginx/
│   └── default.conf           # Configurazione virtual host Nginx reverse proxy & SSL
└── .env                       # Variabili d'ambiente di produzione (JWT_SECRET, POSTGRES_PASSWORD)
```

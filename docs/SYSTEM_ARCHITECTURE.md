# ARCHITETTURA DI SISTEMA & SPECIFICHE TECNICHE
## Progetto: MyTrainUp (Personal Fitness Logbook Mobile)

> **Documento Consolidato:** Fusione organica di Architettura Frontend, Analisi Strutturale del Sistema e Specifiche Backend Decoupled su VPS.  
> **Versione:** 1.0.0 (Settembre 2026)  
> **Target:** Ingegneria Software, DevOps & Full-Stack Developers  

---

## 📌 Indice dei Contenuti
1. [Architettura del Client Mobile (Frontend)](#1-architettura-del-client-mobile-frontend)
   - [1.1 Stack Tecnologico & Bootstrap](#11-stack-tecnologico--bootstrap)
   - [1.2 Paradigma Offline-First & Resilienza](#12-paradigma-offline-first--resilienza)
   - [1.3 Le 4 State Machine Reattive](#13-le-4-state-machine-reattive)
   - [1.4 Motore di Esecuzione Allenamento (Live Logger)](#14-motore-di-esecuzione-allenamento-live-logger)
2. [Persistenza Locale e Partizionamento Dati](#2-persistenza-locale-e-partizionamento-dati)
   - [2.1 Mappatura delle Chiavi AsyncStorage](#21-mappatura-delle-chiavi-asyncstorage)
   - [2.2 Isolamento Locale per Utente Attivo](#22-isolamento-locale-per-utente-attivo)
   - [2.3 Backup e Ripristino JSON Schema v3](#23-backup-e-ripristino-json-schema-v3)
3. [Architettura Backend e Budget di Memoria (VPS S)](#3-architettura-backend-e-budget-di-memoria-vps-s)
   - [3.1 Requisiti Hardware e Ripartizione RAM (< 600 MB)](#31-requisiti-hardware-e-ripartizione-ram--600-mb)
   - [3.2 Scelta Tecnologica: Fastify + Drizzle ORM](#32-scelta-tecnologica-fastify--drizzle-orm)
   - [3.3 Pattern Architetturale a Tre Livelli (Routes - Controllers - Services)](#33-pattern-architetturale-a-tre-livelli-routes---controllers---services)
4. [Database Relazionale e Pattern Decoupled](#4-database-relazionale-e-pattern-decoupled)
   - [4.1 Il Problema del Design Accoppiato](#41-il-problema-del-design-accoppiato)
   - [4.2 La Soluzione Decoupled (Snapshot Immutabile)](#42-la-soluzione-decoupled-snapshot-immutabile)
   - [4.3 Schema PostgreSQL 16 e Indici](#43-schema-postgresql-16-e-indici)
   - [4.4 Schema Schede Block-Based e Migrazione Idempotente](#44-schema-schede-block-based-e-migrazione-idempotente)
5. [Sicurezza, RBAC e Isolamento dei Dati](#5-sicurezza-rbac-e-isolamento-dei-dati)
   - [5.1 Modello di Accesso TRAINER vs CLIENT](#51-modello-di-accesso-trainer-vs-client)
   - [5.2 Autenticazione JWT e Hook PreHandler](#52-autenticazione-jwt-e-hook-prehandler)
   - [5.3 Modalità Sola Lettura per il Trainer su Dati Biometrici Atleta](#53-modalità-sola-lettura-per-il-trainer-su-dati-biometrici-atleta)

---

## 1. Architettura del Client Mobile (Frontend)

### 1.1 Stack Tecnologico & Bootstrap
L'applicazione mobile è sviluppata con **React Native** su framework **Expo SDK 57** e tipizzata in **TypeScript** strict mode.
Il punto di ingresso (`frontend/App.tsx`) incapsula l'applicazione nella gerarchia ordinata di provider:

```
[SafeAreaProvider]
  └── [AuthProvider]
        └── [GymProvider]
              └── [MeasurementProvider]
                    └── [DietProvider]
                          └── [NavigationContainer]
                                ├── [Header]
                                └── [RootStackNavigator]
```

### 1.2 Paradigma Offline-First & Resilienza
Tutte le funzionalità vitali dell'applicazione sono operative anche in assenza totale di connettività internet:
- Esecuzione schede, cronometro di recupero, calcolo carichi e tonnellaggio.
- Inserimento e consultazione dello storico biometrico.
- Lettura e rendering dei piani nutrizionali PDF già memorizzati in locale.
Quando la connessione è attiva, i dati vengono sincronizzati via API REST con il backend Fastify centralizzato, supportando il **Pull-to-Refresh** manuale.

### 1.3 Le 4 State Machine Reattive
1. **`AuthContext`**: Gestione token JWT, login con password o OTP temporaneo, transizione verso l'onboarding atleta al primo accesso e logout.
2. **`GymContext`**: Gestione del catalogo di 46 esercizi predefiniti, schede di allenamento, cartelle e **Modalità Delegata**: quando un trainer seleziona un'allieva (`selectedClient`), le schede visualizzate e create si associano all'`owner_id` dell'allieva.
3. **`MeasurementContext`**: Gestione del monitoraggio bioimpedenziometrico e peso corporeo. Calcola in-place i delta rispetto alla pesata precedente. Se il trainer visualizza un'allieva, il context imposta `isReadOnly = true`, inibendo cancellazioni o modifiche.
4. **`DietContext`**: Gestione dei piani nutrizionali in formato PDF, archiviati tramite `expo-file-system` e visualizzati nativamente.

### 1.4 Motore di Esecuzione Allenamento (Live Logger)
Il componente `WorkoutModal.tsx` fornisce l'interfaccia interattiva per l'atleta durante la sessione in palestra, gestendo nativamente l'architettura **Block-Based**:
- **Blocchi Standard & Superset**: esecuzione serie per serie (con piramidali, Warm-up, Stripping/Dropset e Rest-Pause) o sequenza in superserie con timer di fine combinazione.
- **Blocchi Circuito a Round**: loop reattivo ad anello guidato dall'indicatore `🔄 CIRCUITO - GIRO X DI Y`. Gestione automatica del timer di riposo intra-esercizio (`intra_rest_seconds`) dopo ogni stazione e del recupero a fine giro (`rest_between_rounds`) al termine dell'ultimo esercizio del round, prima di avanzare al giro successivo.
- **Persistenza Decoupled dei Round**: ogni round del circuito viene convertito internamente in serie loggate immutabili (`set_number: roundNumber`), registrando carichi effettivi, reps ed RPE senza forzare modifiche allo schema di storico.
- **Sveglia Acustica Continua**: alla scadenza di qualsiasi timer di recupero entra in funzione un loop audio continuo via `expo-audio` (`alarm.wav`) che suona ad alto volume fino al tocco dell'atleta.
- **Calcolo Dinamico del Volume**: tonnellaggio totale istantaneo calcolato in tempo reale ($Volume = \sum kg \times reps$).

---

## 2. Persistenza Locale e Partizionamento Dati

### 2.1 Mappatura delle Chiavi AsyncStorage
- `@user_profile_v3`: Anagrafica e preferenze utente.
- `@fitness_auth_session_v2`: Token e sessione attiva.
- `@fitness_provisioned_clients_v2`: Clienti provisionati dal trainer.
- `@gym_routines_v3`: Schede mesociclo template.
- `@gym_workouts_v3`: Storico sessioni completate.
- `@gym_folders_v3`: Cartelle mesociclo.
- `@gym_exercises_v2`: Catalogo dei 46 esercizi muscolari standard.
- `@diets_v3`: Piani alimentari associati.

### 2.2 Isolamento Locale per Utente Attivo
Per scongiurare il problema critico di sovrascrittura o cancellazione incrociata tra account diversi sul medesimo terminale, le misurazioni corporee e le immagini profilo sono salvate su chiavi partizionate:
- `@measurements_v3_${userId || 'default'}`
- `@avatar_${userId}`
Ogni operazione di lettura, scrittura o svuotamento targetizza esclusivamente la chiave dell'utente attivo.

### 2.3 Backup e Ripristino JSON Schema v3
In `SettingsScreen.tsx`, `backupService.ts` raccoglie l'intero stato locale in un payload JSON standardizzato v3:
- Permette all'utente di condividere via sistema operativo (email, cloud, WhatsApp) o copiare negli appunti il backup completo.
- Il ripristino valida lo schema, inserisce i record nelle rispettive tabelle locali e ricarica reattivamente tutti i contesti in memoria.

---

## 3. Architettura Backend e Budget di Memoria (VPS S)

### 3.1 Requisiti Hardware e Ripartizione RAM (< 600 MB)
Target hardware: **VPS S Linux (1 vCore, 2 GB RAM, 60 GB NVMe)** su AlmaLinux 9 / Debian 12.
La memoria è allocata con limiti deterministici tramite Docker Compose:

| Componente | Target RSS | Docker Limit (`memory:`) | Riserva Minima (`reservations:`) |
|---|---|---|---|
| **PostgreSQL 16 Alpine** | 75 MB - 110 MB | 180 MB | 80 MB |
| **Node.js (Fastify API)** | 110 MB - 150 MB | 250 MB | 100 MB |
| **Nginx Reverse Proxy** | 15 MB - 25 MB | 50 MB | 15 MB |
| **OS Host & Daemon** | 180 MB - 240 MB | N/A (Host) | N/A |
| **RAM Libera / Headroom** | ~1.4 GB (con 2GB Swap) | **Totale Container: 480 MB** | **Totale Riserva: 195 MB** |

### 3.2 Scelta Tecnologica: Fastify + Drizzle ORM
- **Fastify v5**: Footprint di memoria minimo (~35 MB a riposo), compilazione rapida delle rotte tramite Ajv, overhead nettamente inferiore a Express o NestJS.
- **Drizzle ORM + `postgres.js`**: Nessun query engine C++ binario esterno (a differenza di Prisma, che assorbe oltre 100 MB RAM). Generazione SQL nativa a zero overhead runtime e condivisione dei contratti TypeScript con il client mobile.

### 3.3 Pattern Architetturale a Tre Livelli (Routes - Controllers - Services)
- **Routes Layer**: Registra gli endpoint, associa i decorator Fastify (`authenticate`, `requireTrainer`).
- **Controllers Layer**: Riceve la request, effettua il parse e la validazione degli schemi DTO, richiama il service e formatta la risposta `ApiResponse<T>`.
- **Services Layer**: Contiene la logica di business, le regole di autorizzazione granulari e tutte le query Drizzle ORM.

---

## 4. Database Relazionale e Pattern Decoupled

### 4.1 Il Problema del Design Accoppiato
Se la tabella `workout_sessions` dipendesse da una foreign key `ON DELETE CASCADE` verso `workout_routines`, l'eliminazione di una scheda da parte del trainer cancellerebbe tutti gli allenamenti svolti in passato dall'allieva.

### 4.2 La Soluzione Decoupled (Snapshot Immutabile)
Lo schema di produzione separa:
1. **Schede Template (`workout_routines`)**: entità modificabili o eliminabili dal creatore.
2. **Sessioni Completate (`workout_sessions`)**: snapshot immutabili registrati al termine del workout. La foreign key verso `workout_routines` ha vincolo `ON DELETE SET NULL`. Se la scheda viene eliminata, i log storici, le serie, i pesi e le date rimangono perfettamente intatti.

### 4.3 Schema PostgreSQL 16 e Indici
Tabella principale `body_measurements`:
```sql
CREATE TABLE IF NOT EXISTS body_measurements (
  id SERIAL PRIMARY KEY,
  owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at VARCHAR(64) NOT NULL,
  weight_kg NUMERIC(6, 2) NOT NULL,
  weight_delta_kg NUMERIC(6, 2),
  bmi NUMERIC(5, 2),
  body_fat_pct NUMERIC(5, 2),
  muscle_mass_kg NUMERIC(6, 2),
  lean_mass_kg NUMERIC(6, 2),
  water_pct NUMERIC(5, 2),
  bone_mass_kg NUMERIC(5, 2),
  visceral_fat NUMERIC(5, 2),
  bmr_kcal NUMERIC(7, 2),
  amr_kcal NUMERIC(7, 2),
  notes TEXT,
  created_at VARCHAR(64) NOT NULL,
  updated_at VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_body_measurements_owner ON body_measurements(owner_id);
```

### 4.4 Schema Schede Block-Based e Migrazione Idempotente
Per superare la limitazione delle schede con lista di esercizi "piatta" e consentire combinazioni avanzate (schede ibride con esercizi standard, superserie e circuiti a round), il database adotta un'architettura **Block-Based**:

```sql
-- Tabella Blocchi Scheda
CREATE TABLE IF NOT EXISTS routine_blocks (
  id SERIAL PRIMARY KEY,
  routine_id INTEGER NOT NULL REFERENCES workout_routines(id) ON DELETE CASCADE,
  block_type VARCHAR(32) NOT NULL DEFAULT 'STANDARD', -- 'STANDARD' | 'SUPERSET' | 'CIRCUIT'
  order_index INTEGER NOT NULL DEFAULT 0,
  rounds INTEGER NOT NULL DEFAULT 1,
  rest_between_rounds INTEGER NOT NULL DEFAULT 0,
  created_at VARCHAR(64) NOT NULL
);

-- Esercizi associati al Blocco
CREATE TABLE IF NOT EXISTS routine_exercises (
  id SERIAL PRIMARY KEY,
  block_id INTEGER REFERENCES routine_blocks(id) ON DELETE CASCADE,
  routine_id INTEGER REFERENCES workout_routines(id) ON DELETE CASCADE,
  exercise_id VARCHAR(64) NOT NULL REFERENCES exercises(id),
  order_index INTEGER NOT NULL DEFAULT 0,
  intra_rest_seconds INTEGER NOT NULL DEFAULT 0,
  sets_config JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_routine_blocks_routine ON routine_blocks(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_block ON routine_exercises(block_id);
```

#### Migrazione Idempotente a Zero Perdita Dati
All'avvio del server (`backend/src/db/migrate.ts`), un blocco procedurale PL/pgSQL esegue la migrazione idempotente:
1. Crea la tabella `routine_blocks` e altera `routine_exercises` aggiungendo `block_id` e `intra_rest_seconds`.
2. Identifica tutti gli esercizi preesistenti aventi `block_id IS NULL`.
3. Per ciascuna scheda con esercizi orfani, crea automaticamente un blocco sintetico di tipo `'STANDARD'` con `order_index = 0` e associa tutti gli esercizi preesistenti ad esso.
4. Mantiene la retrocompatibilità con i client precedenti generando dinamicamente la lista piatta `exercises` per le chiamate API che non leggono i blocchi.

---

## 5. Sicurezza, RBAC e Isolamento dei Dati

### 5.1 Modello di Accesso TRAINER vs CLIENT
- Il **Trainer** può gestire i propri clienti, creare loro schede in modalità delegata e consultare i loro progressi.
- Il **Cliente** accede solo ed esclusivamente ai propri dati isolati (`owner_id = client.id`).

### 5.2 Autenticazione JWT e Hook PreHandler
Il middleware `backend/src/middleware/auth.ts`:
```typescript
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Token di autenticazione mancante o non valido.' },
    });
  }
}
```

### 5.3 Modalità Sola Lettura per il Trainer su Dati Biometrici Atleta
- Se il trainer richiede le misurazioni di un atleta tramite `GET /api/v1/measurements?client_id=:id`, il service verifica prima l'effettiva associazione nella tabella `trainer_athletes`.
- In `MeasurementContext.tsx` e `MeasurementsScreen.tsx`, quando viene visualizzato un atleta, l'interfaccia passa in **modalità sola lettura**:
  - Compare un banner blu informativo.
  - Il form di inserimento pesate viene disattivato e nascosto.
  - I pulsanti di modifica e cancellazione sulle card vengono rimossi.
  - Qualsiasi chiamata HTTP `DELETE` o `PUT` effettuata dal trainer sui dati dell'atleta viene bloccata sia lato client sia lato backend con `403 FORBIDDEN`.

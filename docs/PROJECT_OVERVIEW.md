# MYTRAINUP (PERSONAL FITNESS LOGBOOK MOBILE)
## Documento Master di Allineamento Tecnico del Progetto
> **Scopo:** Documento esaustivo, autoconsistente e strutturato per allineare sviluppatori e modelli di intelligenza artificiale (Gemini/Claude) sull'intero ecosistema applicativo.  
> **Versione:** 1.0.0 (Produzione & Cloud-Sync)  
> **Stack:** React Native (Expo SDK 57) + Node.js (Fastify 5 + Drizzle ORM) + PostgreSQL 16 (Decoupled Schema)

---

## 📌 1. Panoramica del Progetto & Scopo Funzionale

**MyTrainUp** è una piattaforma professionale full-stack pensata per il fitness e l'allenamento con sovraccarichi (bodybuilding, powerlifting, functional training) progettata per gestire la cooperazione in tempo reale tra **Personal Trainer** e **Atleti/Allievi**, mantenendo al contempo un'architettura **Offline-First** resiliente.

### I Due Ruoli del Sistema (RBAC)
1. **Personal Trainer (`TRAINER`)**:
   - **Gestione Allievi**: censimento atleti, generazione di credenziali/codici OTP monouso per il primo onboarding.
   - **Workout Designer**: creazione, clonazione, modifica e raggruppamento in cartelle mesociclo di schede di allenamento avanzate (serie standard, Warm-up, Stripping/Dropset, Rest-Pause, tempo isometrico).
   - **Modalità Delegata**: possibilità di redigere schede direttamente per un atleta specifico (`selectedClient`).
   - **Consultazione Dati (Sola Lettura)**: visualizzazione delle misurazioni corporee e dei log storici dell'atleta. **Regola fondamentale di privacy/isolamento**: il trainer NON può sovrascrivere o cancellare i dati personali o biometrici degli atleti.
2. **Atleta (`CLIENT`)**:
   - **Accesso Semplificato**: primo login con codice OTP/Password temporanea fornita dal trainer e onboarding obbligatorio per completare il profilo (data di nascita, altezza, credenziali permanenti).
   - **Esecuzione Live Workout**: esecuzione della scheda assegnata senza rischio di corromperne la struttura template originale; compilazione in tempo reale di carichi, ripetizioni effettive, RPE, elastici di assistenza.
   - **Timer e Sveglia Acustica Continua**: cronometro di recupero automatico con riproduzione continua in loop di un allarme audio (`alarm.wav`) fino al tocco dell'atleta.
   - **Biometria & Impedenziometria Personale**: inserimento e monitoraggio di peso corporeo, BMI, massa grassa, massa magra, muscolo scheletrico e calcolo automatico dei delta temporali.
   - **Piani Nutrizionali**: visualizzazione integrata dei PDF di dieta associati dal trainer.

---

## 🏗️ 2. Architettura di Sistema End-to-End

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CLIENT MOBILE (Expo SDK 57 / React Native)           │
│                                                                        │
│   [ UI Layer ] React Native Paper / Gym Dark Theme Ad Alto Contrasto   │
│   [ Navigation ] React Navigation v7 (Auth Flow, Tabs & Modals)        │
│   [ State Engine ] Context Providers: Auth, Gym, Measurement, Diet    │
│   [ Local Cache ] AsyncStorage Partizionato per Utente (@key_${userId})│
│   [ API Service ] Fetch REST con Bearer JWT & Timeout Control          │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ HTTPS (TLS 1.3) / JSON REST API
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       REVERSE PROXY & HOST (VPS IONOS)                 │
│                                                                        │
│   [ Nginx ] SSL Let's Encrypt (api.mytrainup.it)                       │
│             Rate Limiting, Reverse Proxy verso Porta 8000              │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ TCP Interno Docker
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│               BACKEND SERVER (Fastify + Drizzle ORM)                  │
│                                                                        │
│   [ Middleware ] fastify.authenticate (JWT Verify) + requireTrainer    │
│   [ Controller ] HTTP I/O, Parsing, Status Code, ApiResponse<T>        │
│   [ Service ] Logica di Business, RBAC & Isolamento WHERE owner_id     │
│   [ Drizzle ORM ] postgres.js driver nativo senza overhead C++         │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ Unix Socket / TCP Porta 5432
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 DATABASE RELAZIONALE (PostgreSQL 16 Alpine)             │
│                                                                        │
│   [ Pattern Decoupled ] Routines Template vs Workout Sessions Snapshot │
│   [ Tuning VPS S ] shared_buffers=64MB, max_connections=25 (<180MB RAM)│
│   [ Isolamento Dati ] owner_id VARCHAR(64) NOT NULL REFERENCES users   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ 3. PARTE 1: DATABASE LAYER (PostgreSQL 16 Decoupled)

### 3.1 Il Pattern "Decoupled" (Zero Data Loss)
Nelle applicazioni fitness convenzionali, collegare le sessioni svolte (`workout_sessions`) alle schede template (`workout_routines`) con foreign key diretta causa gravi problemi:
- Se il trainer cancella o aggiorna la scheda "Mese 1", la cascata distrugge o altera i record dei carichi storici dell'atleta.
- In **MyTrainUp**, le sessioni di allenamento sono **snapshot immutabili**: quando l'allievo completa un workout, i dati degli esercizi e delle serie vengono congelati in tabelle di sessione dedicate (`workout_sessions` e `workout_session_exercises`) con `routine_id` opzionale (`ON DELETE SET NULL`). La cancellazione di una scheda non tocca mai lo storico dei carichi.

### 3.2 Schema Relazionale Dettagliato
Tutti i modelli sono definiti in TypeScript tramite Drizzle ORM in `backend/src/db/schema.ts`:

1. **`users`**:
   - `id`: `varchar(64)` (PK, es. `trainer-1`, UUID).
   - `username`, `password_hash`, `raw_otp` (memorizzato per pairing iniziale).
   - `role`: `'TRAINER' | 'CLIENT'`.
   - `first_name`, `last_name`, `email`, `birth_date`, `height_cm`, `avatar_url`.
   - `is_profile_completed`: booleano per il gate di onboarding.
   - `is_archived`: booleano per soft-delete.
2. **`trainer_athletes`**:
   - Tabella di giunzione che associa un `trainer_id` a un `athlete_id` con timestamp `linked_at`.
3. **`routine_folders`**:
   - Cartelle mesociclo per organizzare le schede (`owner_id` vincolato).
4. **`workout_routines`**:
   - Template di scheda (`name`, `description`, `folder_id`, `owner_id`, `created_by_trainer_id`).
5. **`routine_exercises`**:
   - Esercizi compresi nella scheda template, ordine, configurazione serie JSONB (`sets_config`: reps, kg target, rest seconds, dropset, rest-pause).
6. **`workout_sessions`** (Decoupled History):
   - `id`: `serial` PK.
   - `owner_id`: utente che ha completato il workout.
   - `routine_id`: FK verso `workout_routines` con `ON DELETE SET NULL`.
   - `name`, `started_at`, `completed_at`, `duration_seconds`, `volume_kg`, `total_sets`, `notes`.
7. **`workout_session_exercises`**:
   - Dettaglio per esercizio completato, log serie JSONB (`sets`: set_number, reps, weight_kg, rpe, band_color, completed).
8. **`body_measurements`**:
   - Rilevazioni impedenziometriche e peso: `id`, `owner_id` (FK `users.id` con `ON DELETE CASCADE`), `recorded_at`, `weight_kg`, `bmi`, `body_fat_pct`, `muscle_mass_kg`, `lean_mass_kg`, `water_pct`, `bone_mass_kg`, `visceral_fat`, `bmr_kcal`, `amr_kcal`, `notes`.
9. **`exercises`**:
   - Catalogo dei 46 esercizi muscolari standard di sala pesi con `muscle_group`, `exercise_type`, note e link video tutorial YouTube.

### 3.3 Tuning Risorse per VPS S (Memory Limit < 180 MB)
Il file `postgres.conf` è configurato per operare stabilmente su VPS con 1-2 GB di RAM:
- `shared_buffers = 64MB`
- `effective_cache_size = 128MB`
- `maintenance_work_mem = 16MB`
- `work_mem = 4MB`
- `max_connections = 25`
- `wal_buffers = 4MB`

---

## ⚙️ 4. PARTE 2: BACKEND LAYER (Node.js + Fastify + Drizzle ORM)

### 4.1 Architettura a Tre Livelli (Clean Layered)
Il codice del backend (nella cartella `/backend`) adotta la separazione rigorosa delle responsabilità:
```
backend/src/
├── routes/          # Dichiarazione endpoint, prefissi e guardie preHandler
├── middleware/      # Hook JWT (authenticate) e RBAC (requireTrainer)
├── controllers/     # Validazione boundary parametri HTTP e codici di stato
├── services/        # Logica di business, isolamento owner_id e query Drizzle ORM
├── db/              # Connessione Postgres, Schema Drizzle, Migrazioni automatiche e Seed
└── types/           # Tipi condivisi (Auth, Workout, Measurement, Api)
```

### 4.2 Gestione della Sicurezza e Isolamento Dati
- **Autenticazione JWT**: implementata tramite `@fastify/jwt`. Il payload contiene `{ id, username, role }`.
- **Isolamento Perimetrale**:
  - In `measurementService.ts`: ogni operazione di scrittura (`createMeasurement`, `updateMeasurement`, `deleteMeasurement`) impone `WHERE owner_id = :authUserId`.
  - Se un Trainer richiede le misurazioni di un atleta (`GET /api/v1/measurements?client_id=...`), il service interroga prima `trainer_athletes` per verificare la reale associazione; se autorizzato, restituisce i dati in **sola lettura**. Qualsiasi tentativo del trainer di cancellare o alterare i dati dell'atleta viene intercettato e respinto con errore `403 FORBIDDEN`.
  - Lo stesso principio isola rigorosamente i log storici di `workoutService.ts` e gli aggiornamenti anagrafici di `profileService.ts`.

### 4.3 Tabella delle Rotte REST (`/api/v1`)

| Metodo | Endpoint | Ruolo Richiesto | Descrizione |
|---|---|---|---|
| `GET` | `/health` | Pubblico | Health check database e uptime del server |
| `POST` | `/api/v1/auth/login` | Pubblico | Autenticazione con username e password/OTP |
| `POST` | `/api/v1/auth/provision-client` | `TRAINER` | Creazione account cliente e generazione codice OTP iniziale |
| `POST` | `/api/v1/auth/complete-onboarding` | `CLIENT` | Finalizzazione profilo al primo accesso |
| `GET` | `/api/v1/auth/clients` | `TRAINER` | Elenco clienti gestiti dal trainer |
| `PATCH` | `/api/v1/auth/clients/:id/archive` | `TRAINER` | Archiviazione cliente |
| `PATCH` | `/api/v1/auth/clients/:id/unarchive` | `TRAINER` | Ripristino cliente archiviato |
| `DELETE` | `/api/v1/auth/clients/:id` | `TRAINER` | Cancellazione definitiva a cascata cliente |
| `GET` | `/api/v1/routines` | Qualsiasi (JWT) | Recupero schede (proprie o di atleta delegato) |
| `POST` | `/api/v1/routines` | Qualsiasi (JWT) | Creazione nuova scheda di allenamento |
| `DELETE` | `/api/v1/routines/:id` | Qualsiasi (JWT) | Eliminazione scheda (solo proprietario/trainer creatore) |
| `GET` | `/api/v1/workouts` | Qualsiasi (JWT) | Recupero sessioni completate dell'utente |
| `POST` | `/api/v1/workouts` | Qualsiasi (JWT) | Salvataggio snapshot sessione completata |
| `DELETE` | `/api/v1/workouts/:id` | Qualsiasi (JWT) | Cancellazione sessione (solo proprio owner) |
| `GET` | `/api/v1/folders` | Qualsiasi (JWT) | Recupero cartelle mesociclo |
| `POST` | `/api/v1/folders` | Qualsiasi (JWT) | Creazione cartella mesociclo |
| `DELETE` | `/api/v1/folders/:id` | Qualsiasi (JWT) | Cancellazione cartella mesociclo |
| `GET` | `/api/v1/exercises` | Qualsiasi (JWT) | Catalogo dei 46 esercizi muscolari base |
| `GET` | `/api/v1/profile` | Qualsiasi (JWT) | Dati profilo utente connesso |
| `PUT` | `/api/v1/profile` | Qualsiasi (JWT) | Aggiornamento dati anagrafici utente |
| `GET` | `/api/v1/measurements` | Qualsiasi (JWT) | Misure corporee proprie o dell'atleta (`?client_id=`) |
| `POST` | `/api/v1/measurements` | Qualsiasi (JWT) | Registrazione nuova pesata/impedenziometria |
| `PUT` | `/api/v1/measurements/:id` | Qualsiasi (JWT) | Modifica rilevazione (solo proprio proprietario) |
| `DELETE` | `/api/v1/measurements/:id` | Qualsiasi (JWT) | Cancellazione rilevazione (solo proprio proprietario) |

---

## 📱 5. PARTE 3: FRONTEND LAYER (React Native + Expo SDK 57)

### 5.1 Struttura e Moduli Client
L'applicazione mobile risiede nella root `/src`:
```
src/
├── components/          # Componenti UI (Card, Header, RestTimerWidget, WeightTrendChart, ecc.)
├── context/             # Le 4 State Machine reattive (Auth, Gym, Measurement, Diet)
├── navigation/          # React Navigation v7: RootStackNavigator e BottomTabNavigator
├── screens/             # Schermate di primo livello (Home, Gym, Clients, Measurements, Diet, Profile, Settings)
│   ├── auth/            # LoginScreen e ClientOnboardingScreen
│   └── modals/          # WorkoutModal (Live Logger), NewRoutineModal, ExerciseModal, ecc.
├── services/            # Client HTTP (api.ts) e storage locale partizionato (AsyncStorage)
├── theme/               # Design token Gym Dark (colori ad alto contrasto, spacing, tipografia)
└── types/               # Interfacce TypeScript condivise
```

### 5.2 Le 4 State Machine (React Context)
1. **`AuthContext`**: gestisce lo stato di sessione, login, logout, sincronizzazione immediata del token Bearer su `apiService.setAuthToken(token)`, e provisioning allievi per il trainer.
2. **`GymContext`**: motore di allenamento. Gestisce il catalogo esercizi, le schede, le cartelle e la **Modalità Delegata** (`selectedClient`), permettendo al trainer di operare sulla scheda dell'atleta.
3. **`MeasurementContext`**: gestione pesate e bioimpedenziometria.
   - Partizionamento locale: archiviazione su `@measurements_v3_${userId}`.
   - Quando il trainer consulta un atleta, attiva lo stato `isReadOnly = true`, inibendo qualsiasi cancellazione o modifica locale/remota.
4. **`DietContext`**: gestione dei piani nutrizionali PDF memorizzati localmente con associazione a singolo atleta.

### 5.3 Il Live Workout Logger & Motore Tecnico
Nel modale [`WorkoutModal.tsx`](file:///home/its/I_Miei_Progetti/Personal-Fitness-Logbook-Mobile/src/screens/modals/WorkoutModal.tsx):
- Supporto a serie piramidali, Warm-up, Stripping/Dropset (con micro-recupero) e Rest-Pause.
- Timer di recupero integrato: alla scadenza del countdown, entra in funzione un loop acustico continuo via `expo-audio` (`alarm.wav`) che suona senza interruzioni finché l'atleta non tocca lo schermo per confermare la serie successiva.
- Calcolo automatico in tempo reale del tonnellaggio sollevato ($Volume = \sum kg \times reps$).

### 5.4 Partizionamento Locale e Risoluzione Conflitti
Tutti i service di storage locale (`measurementStorage.ts`, `gymStorage.ts`, `profileService.ts`) utilizzano chiavi partizionate per `userId`:
- `@measurements_v3_${userId}`
- `@avatar_${userId}`
In questo modo, anche se un trainer e un cliente condividono lo stesso smartphone o terminale di test, non si verifica alcuna collisione o cancellazione incrociata.

### 5.5 Backup e Portabilità Unificata (Schema JSON v3)
In [`SettingsScreen.tsx`](file:///home/its/I_Miei_Progetti/Personal-Fitness-Logbook-Mobile/src/screens/SettingsScreen.tsx), l'utente può esportare e ripristinare un backup completo in formato JSON standard (schede, storico allenamenti, misure e profilo) garantendo zero lock-in e massima sovranità dei propri dati.

---

## 🔒 6. SICUREZZA PER REPOSITORY PUBBLICO & BEST PRACTICES

Poiché il repository GitHub è pubblico, sono state adottate le seguenti contromisure tassative:
1. **Protezione Credenziali**: nessun file `.env` o credenziale in chiaro è tracciato da Git. Sono presenti solo i file template di esempio:
   - `.env.example`
   - `.env.production.example`
   - `backend/.env.example`
2. **File Esclusi (`.gitignore`)**:
   - Variabili d'ambiente: `**/.env`, `**/.env.*` (eccetto `.example`).
   - File personali di allenamento o diete utente: `*.pdf`.
   - File temporanei e backup: `*.bak`, `*.tmp`, `*.log`.
   - Certificati e Keystore nativi Android/iOS: `*.jks`, `*.keystore`, `*.pem`, `*.key`, `*.p12`.
   - Build e dipendenze: `node_modules/`, `.expo/`, `dist/`, `web-build/`, `backend/dist/`.

---

## 🚀 7. GUIDA RAPIDA DI AVVIO

### 7.1 Avvio Backend (Sviluppo Locale)
```bash
# 1. Avvio container PostgreSQL
docker compose up -d db

# 2. Avvio Fastify API con hot-reload
cd backend
npm install
npm run dev
# Server in ascolto su http://0.0.0.0:8000 (Health check: http://localhost:8000/health)
```

### 7.2 Avvio Client Mobile (Expo)
```bash
# Nella root del progetto
npm install
npx expo start -c
# Scansiona il QR Code con l'app Expo Go (Android o iPhone)
```

### 7.3 Avvio Stack Completo di Produzione (Docker Compose)
```bash
docker compose up -d --build
```
Lo stack avvia:
- **`db`**: PostgreSQL 16 Alpine con configurazione low-memory (`postgres.conf`).
- **`api`**: Fastify API con compilazione TypeScript e migrazioni Drizzle automatiche all'avvio (`entrypoint.sh`).
- **`proxy`**: Nginx per gestione SSL e reverse proxying.

---

## 🎯 8. Conclusione & Stato dell'Arte
Il progetto **MyTrainUp** è attualmente stabile, completamente tipizzato in TypeScript (0 errori di compilazione nel frontend e nel backend), conforme alle normative di sicurezza per repository open source / pubblici, e strutturato per garantire scalabilità ed economicità estrema su infrastrutture cloud VPS S.

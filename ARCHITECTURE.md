# ARCHITETTURA DI SISTEMA & REQUISITI INFRASTRUTTURA CLOUD
## Progetto: My Train Up (Personal Fitness Logbook Mobile)

> **Versione Documento:** 1.0.0  
> **Data di Redazione:** Settembre 2026  
> **Target:** Ingegneria Software, DevOps & System Administration  
> **Scopo:** Analisi dello stato dell'arte del client mobile, definizione del modello dati e specifiche dei requisiti per il deployment su Virtual Private Server (VPS Linux).

---

## 📌 Indice dei Contenuti
1. [Stato dell'Arte (Client Mobile)](#1-stato-dellarte-client-mobile)
   - [1.1 Architettura e Stack Tecnologico](#11-architettura-e-stack-tecnologico)
   - [1.2 Paradigma Offline-First](#12-paradigma-offline-first)
   - [1.3 Gestione dei Ruoli e Sicurezza Locale](#13-gestione-dei-ruoli-e-sicurezza-locale)
2. [Modello Dati e Persistenza](#2-modello-dati-e-persistenza)
   - [2.1 Mappatura Storage Locale (AsyncStorage)](#21-mappatura-storage-locale-asyncstorage)
   - [2.2 Schema delle Entità Principali](#22-schema-delle-entità-principali)
   - [2.3 Diagramma Entità-Relazione (ER)](#23-diagramma-entità-relazione-er)
   - [2.4 Backup e Portabilità Unificata (JSON Schema v3)](#24-backup-e-portabilità-unificata-json-schema-v3)
3. [Requisiti per Migrazione Cloud](#3-requisiti-per-migrazione-cloud)
   - [3.1 Evoluzione Architetturale: Da Local-Only a Cloud-Synchronized](#31-evoluzione-architetturale-da-local-only-a-cloud-synchronized)
   - [3.2 Servizi Backend e Specifiche API RESTful](#32-servizi-backend-e-specifiche-api-restful)
   - [3.3 Autenticazione Remota e Gestione Sessioni](#33-autenticazione-remota-e-gestione-sessioni)
   - [3.4 Motore di Sincronizzazione e Risoluzione Conflitti](#34-motore-di-sincronizzazione-e-risoluzione-conflitti)
   - [3.5 Sicurezza, Privacy e Conformità GDPR](#35-sicurezza-privacy-e-conformità-gdpr)
4. [Infrastruttura e Deployment Target (VPS Linux)](#4-infrastruttura-e-deployment-target-vps-linux)
   - [4.1 Stack Container-Ready (Docker & Docker Compose)](#41-stack-container-ready-docker--docker-compose)
   - [4.2 Configurazione Docker Compose di Produzione](#42-configurazione-docker-compose-di-produzione)
   - [4.3 Nginx Reverse Proxy & Terminazione SSL](#43-nginx-reverse-proxy--terminazione-ssl)
   - [4.4 Requisiti di Sistema Minimi e Raccomandati (Hardware VPS)](#44-requisiti-di-sistema-minimi-e-raccomandati-hardware-vps)
   - [4.5 Hardening Server, Backup Automatizzati e Monitoring](#45-hardening-server-backup-automatizzati-e-monitoring)

---

## 1. Stato dell'Arte (Client Mobile)

### 1.1 Architettura e Stack Tecnologico
L'applicazione mobile **My Train Up** è sviluppata come Single Page Application ibrida basata su **React Native** con il framework **Expo (SDK 57)** e tipizzata in **TypeScript** in modalità strict.

```
                  ┌──────────────────────────────────────────────┐
                  │            MY TRAIN UP (Client)              │
                  ├──────────────────────────────────────────────┤
                  │  UI Layer (React Native + Safe Area Context)  │
                  ├──────────────────────────────────────────────┤
                  │  Navigation (Native Stack & Bottom Tabs v7)  │
                  ├──────────────────────────────────────────────┤
                  │   State Machines (React Context Providers)   │
                  │   ├── AuthContext      ├── GymContext        │
                  │   ├── MeasurementCtx   └── DietContext       │
                  ├──────────────────────────────────────────────┤
                  │   Storage & Service Layer (AsyncStorage)     │
                  │   ├── profileService   ├── gymStorage        │
                  │   ├── backupService    ├── dietStorage       │
                  │   └── measurementStorage                     │
                  ├──────────────────────────────────────────────┤
                  │   Device APIs (expo-audio, sharing, fs)      │
                  └──────────────────────────────────────────────┘
```

#### Dettaglio Tecnologie e Versioni Correnti
| Componente | Tecnologia | Versione / Note |
|---|---|---|
| **Runtime Mobile** | React Native | `0.86.3` |
| **Framework Engine** | Expo SDK | `~57.0.22` |
| **Linguaggio** | TypeScript | `~6.0.3` (Strict Mode attivato) |
| **UI Framework** | React | `19.2.3` |
| **Navigazione** | React Navigation | `@react-navigation/native 7.x`, `@react-navigation/bottom-tabs 7.x`, `native-stack 7.x` |
| **Persistenza Locale** | AsyncStorage | `@react-native-async-storage/async-storage 2.2.0` |
| **Audio Engine** | Expo Audio | `expo-audio ~57.0.5` (Sveglia ciclica recuperi `alarm.wav`) |
| **File Management** | Expo FileSystem | `expo-file-system ~57.0.7` |
| **Sharing & Intent** | Expo Sharing & IntentLauncher | `expo-sharing ~57.0.19`, `expo-intent-launcher ~57.0.0` |

### 1.2 Paradigma Offline-First
L'applicazione è interamente ingegnerizzata per operare in assenza di rete (**100% Offline-First**):
1. **Latenza Zero:** Nessuna interazione dell'utente (avvio serie, logging pesata, aggiunta note) dipende da round-trip di rete.
2. **Resilienza in Sala Pesi:** Funzionamento ininterrotto anche in ambienti schermati (es. palestre sotterranee o prive di copertura Wi-Fi/4G/5G).
3. **Persistenza Immediata:** Ogni mutazione di stato invoca in modo sincrono o micro-task la serializzazione JSON su `AsyncStorage`.

### 1.3 Gestione dei Ruoli e Sicurezza Locale
Il sistema implementa un modello **RBAC (Role-Based Access Control)** a due livelli:
- **`TRAINER` (Master):** Possiede visibilità totale sulle proprie schede, sul catalogo dei 46 esercizi, sullo storico delle pesate, nonché accesso alla sezione *Gestione Clienti* (provisioning allievi, associazione schede, generazione codici OTP di accoppiamento).
- **`CLIENT` (Allievo):** Ha accesso ristretto alle schede a lui assegnate e al Live Workout Logger. Non può modificare la struttura delle schede né visualizzare altri allievi.
- **Doppia Autenticazione:** Accesso tramite coppia `Username` + `Password` personale, oppure tramite `Codice OTP Master` perpetuo rilasciato dal Trainer.
- **Isolamento Dati Multi-Account:** Le chiavi storage e gli avatar sono indicizzati in base all'identificativo utente (`@avatar_${userId}`) per impedire sovrascritture tra profili diversi sullo stesso terminale.

---

## 2. Modello Dati e Persistenza

### 2.1 Mappatura Storage Locale (AsyncStorage)
Tutte le informazioni attuali risiedono in coppie chiave-valore JSON all'interno della sandbox locale del dispositivo:

| Chiave Storage | Entità Mappata | Descrizione |
|---|---|---|
| `@user_profile_v3` | `UserProfile` | Profilo utente attivo, credenziali, ruolo RBAC, associazioni clienti o trainer. |
| `@fitness_provisioned_clients_v2` | `ProvisionedClient[]` | Anagrafica atleti gestiti dal Trainer, codici OTP e stato completamento onboarding. |
| `@gym_routines_v3` | `WorkoutRoutine[]` | Schede di allenamento, split settimanali, esercizi e serie target. |
| `@gym_workouts_v3` | `Workout[]` | Storico sessioni completate, carichi effettivi sollevati, RPE e note. |
| `@gym_folders_v3` | `RoutineFolder[]` | Cartelle di raggruppamento per mesocicli (es. *Forza*, *Ipertrofia*). |
| `@gym_exercises_v2` | `Exercise[]` | Catalogo 46 esercizi muscolari standardizzati con video URL e gruppi muscolari. |
| `@measurements_v3` | `BodyMeasurement[]` | Rilevazioni bioimpedenziometriche (peso, BMI, massa grassa, massa magra, viscerale). |
| `@diets_v3` | `DietPdf[]` | Metadati dei documenti alimentari PDF archiviati localmente. |
| `@fitness_active_otps_v1` | `ActiveOtpRecord[]` | Registro codici OTP temporanei per l'accoppiamento tra dispositivi. |
| `@avatar_${userId}` | `string` (URI) | Percorso URI locale dell'immagine profilo dell'utente. |

### 2.2 Schema delle Entità Principali

#### Utente & Profilo (`UserProfile`)
```typescript
interface UserProfile {
  id?: string | number;
  username?: string;
  first_name: string;
  last_name: string;
  birth_date: string;          // Formato DD-MM-YYYY
  height_cm: number;
  avatar_url?: string | null;
  role: 'TRAINER' | 'CLIENT';
  email?: string;
  password?: string;
  is_profile_completed?: boolean;
  raw_otp?: string;
  clients?: ClientAssociation[]; // Popolato se TRAINER
  trainer_id?: string;           // Popolato se CLIENT
  trainer_name?: string;         // Popolato se CLIENT
  created_at?: string;
  updated_at?: string;
}
```

#### Schede di Allenamento (`WorkoutRoutine`) & Tecniche Speciali
```typescript
interface WorkoutRoutine {
  id: number;
  name: string;
  description?: string | null;
  folder_id?: string | null;
  owner_id?: string;             // ID del Trainer proprietario o del Cliente assegnatario
  exercises: RoutineExercise[];
  created_at: string;
  updated_at: string;
}

interface RoutineExerciseSet {
  id?: number;
  set_number: number;
  set_type: 'normal' | 'warmup' | 'dropset' | 'rest_pause';
  target_weight_kg: number;
  target_reps: number;
  target_time_seconds?: number | null; // Per esercizi isometrici
  drops?: SetDropStep[];               // Per Stripping / Dropset
  rest_seconds: number;
}
```

#### Misurazioni Biometriche (`BodyMeasurement`)
```typescript
interface BodyMeasurement {
  id: number;
  recorded_at: string;           // ISO-8601 YYYY-MM-DDTHH:mm
  weight_kg: number;
  weight_delta_kg?: number | null;
  bmi?: number | null;
  body_fat_pct?: number | null;
  muscle_mass_kg?: number | null;
  lean_mass_kg?: number | null;
  water_pct?: number | null;
  bone_mass_kg?: number | null;
  visceral_fat?: number | null;
  bmr_kcal?: number | null;
  amr_kcal?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}
```

### 2.3 Diagramma Entità-Relazione (ER)

```mermaid
erDiagram
    USERS ||--o{ CLIENT_ASSOCIATIONS : "gestisce (se Trainer)"
    USERS ||--o{ ROUTINE_FOLDERS : "crea"
    USERS ||--o{ WORKOUT_ROUTINES : "possiede / assegnate"
    USERS ||--o{ WORKOUT_SESSIONS : "esegue"
    USERS ||--o{ BODY_MEASUREMENTS : "registra"
    USERS ||--o{ DIET_PDFS : "riceve / carica"

    ROUTINE_FOLDERS ||--o{ WORKOUT_ROUTINES : "organizza"
    WORKOUT_ROUTINES ||--|{ ROUTINE_EXERCISES : "comprende"
    ROUTINE_EXERCISES }|--|| EXERCISES_CATALOG : "riferisce"
    ROUTINE_EXERCISES ||--|{ ROUTINE_SETS : "configura"

    WORKOUT_SESSIONS ||--|{ WORKOUT_LOGGED_EXERCISES : "registra"
    WORKOUT_LOGGED_EXERCISES }|--|| EXERCISES_CATALOG : "esegue"
    WORKOUT_LOGGED_EXERCISES ||--|{ WORKOUT_LOGGED_SETS : "traccia"
```

### 2.4 Backup e Portabilità Unificata (JSON Schema v3)
L'applicazione dispone già di un `backupService` in grado di aggregare tutte le entità in un payload conforme a `FullBackupPayload` (schemaVersion: 3):
- Permette esportazione e importazione a caldo.
- Include metadati di integrità, timestamp di esportazione e statistiche sul volume record.
- **Questo payload costituirà il seed primario di migrazione per popolare il database PostgreSQL remoto.**

---

## 3. Requisiti per Migrazione Cloud

### 3.1 Evoluzione Architetturale: Da Local-Only a Cloud-Synchronized
Il passaggio alla VPS comporterà l'adozione di un'architettura **Local-First con Sincronizzazione Bidirezionale Asincrona**:
- Il client mobile continua a leggere e scrivere istantaneamente su storage locale (IndexedDB / SQLite / AsyncStorage).
- Un background worker sincronizza le modifiche con il backend cloud quando la connettività è disponibile.
- Il Trainer può compilare una scheda da interfaccia mobile o futura dashboard web e recapitarla in tempo reale all'allievo.

```
┌───────────────────────────────────────────────────────────┐
│                    ARCHITETTURA TARGET                    │
└───────────────────────────────────────────────────────────┘
   [ Client Mobile (iOS / Android) ]
                 ▲
                 │ HTTPS (TLS 1.3) / WSS (WebSocket Sync)
                 ▼
┌───────────────────────────────────────────────────────────┐
│              LINUX VPS (Docker Infrastructure)            │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │      Nginx Reverse Proxy & SSL (Certbot ACME)       │  │
│  └──────────────────────────┬──────────────────────────┘  │
│                             │ Reverse Proxy (:3000)       │
│  ┌──────────────────────────▼──────────────────────────┐  │
│  │      REST API Backend (Node.js LTS / Express)       │  │
│  │   ├── JWT Auth & Role Guards (TRAINER / CLIENT)     │  │
│  │   ├── Sync Engine & Conflict Resolver               │  │
│  │   ├── File / Media Controller                       │  │
│  │   └── Backup / Restore Engine                       │  │
│  └───────────┬─────────────────────────────┬───────────┘  │
│              │                             │              │
│  ┌───────────▼────────────┐   ┌────────────▼───────────┐  │
│  │   PostgreSQL 16 (DB)   │   │     Redis 7 (Cache)    │  │
│  │  - Relational Schema   │   │  - Session Blacklist   │  │
│  │  - JSONB for sets      │   │  - Rate Limiting       │  │
│  │  - ACID Transactions   │   │  - Temporary OTPs      │  │
│  └────────────────────────┘   └────────────────────────┘  │
│              │                             │              │
│  ┌───────────▼─────────────────────────────▼───────────┐  │
│  │  Docker Volumes (Persistent Storage for DB & Media) │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### 3.2 Servizi Backend e Specifiche API RESTful
Il backend esporrà endpoint versionati (`/api/v1/`) conformi allo standard JSON API:

| Modulo API | Metodo & Rotta | Descrizione |
|---|---|---|
| **Auth** | `POST /api/v1/auth/register` | Creazione account (Trainer o Allievo). |
| **Auth** | `POST /api/v1/auth/login` | Login con credenziali (restituisce JWT access + refresh). |
| **Auth** | `POST /api/v1/auth/refresh` | Rinnovo access token tramite refresh token. |
| **Auth** | `POST /api/v1/auth/otp/generate` | Generazione codice OTP a 6 caratteri (TTL 30 minuti). |
| **Auth** | `POST /api/v1/auth/otp/verify-link` | Accoppiamento account allievo a personal trainer tramite OTP. |
| **Profile** | `GET /api/v1/profile` | Lettura profilo utente autenticato. |
| **Profile** | `PUT /api/v1/profile` | Aggiornamento anagrafica e preferenze. |
| **Profile** | `POST /api/v1/profile/avatar` | Upload avatar (multipart/form-data). |
| **Clients** | `GET /api/v1/clients` | Lista allievi associati al Trainer. |
| **Clients** | `POST /api/v1/clients` | Provisioning nuovo allievo da parte del Trainer. |
| **Clients** | `PATCH /api/v1/clients/:id/archive` | Archiviazione (soft delete) allievo. |
| **Routines** | `GET /api/v1/routines` | Elenco schede (filtrabili per `owner_id` o `client_id`). |
| **Routines** | `POST /api/v1/routines` | Creazione scheda di allenamento con split ed esercizi. |
| **Routines** | `PUT /api/v1/routines/:id` | Modifica struttura scheda. |
| **Routines** | `DELETE /api/v1/routines/:id` | Cancellazione scheda. |
| **Workouts** | `GET /api/v1/workouts` | Storico sessioni completate. |
| **Workouts** | `POST /api/v1/workouts` | Sincronizzazione log sessione live completata dall'atleta. |
| **Biometrics** | `GET /api/v1/measurements` | Storico misurazioni impedenziometriche. |
| **Biometrics** | `POST /api/v1/measurements` | Inserimento nuova rilevazione (peso, pliche, circonferenze). |
| **Diets** | `GET /api/v1/diets` | Elenco PDF nutrizionali. |
| **Diets** | `POST /api/v1/diets/upload` | Caricamento file PDF nutrizionale e metadata. |
| **Sync** | `POST /api/v1/sync/pull` | Scaricamento delta modifiche dall'ultimo timestamp sync. |
| **Sync** | `POST /api/v1/sync/push` | Invio coda modifiche offline al database centrale. |

### 3.3 Autenticazione Remota e Gestione Sessioni
- **Autenticazione Stateless JWT:**
  - `Access Token`: Durata breve (15 minuti), firmato con algoritmo `Ed25519` o `RS256`.
  - `Refresh Token`: Durata prolungata (30 giorni), memorizzato in Secure Storage su mobile e con hash a database per consentire revoche mirate.
- **Password Hashing:** Standard `Argon2id` o `Bcrypt` con cost factor minimo pari a 12.
- **Accoppiamento OTP Remoto:** Codici monouso alfanumerici a 6 caratteri memorizzati su Redis con TTL rigoroso a 1800 secondi (30 minuti) e invalidazione immediata dopo l'uso con successo.

### 3.4 Motore di Sincronizzazione e Risoluzione Conflitti
- **Change Tracking:** Ogni record a database disporrà dei campi `created_at`, `updated_at` (con trigger automatico `now()`) e `deleted_at` (soft-delete).
- **Strategia di Risoluzione:** *Last-Write-Wins (LWW)* basata su timestamp UTC affidabile generato dal server per evitare desincronizzazioni di orologio tra dispositivi client.
- **Offline Sync Queue:** Il client accumulerà le mutazioni avvenute offline in una tabella locale `sync_queue` che verrà svuotata a blocchi transazionali al ripristino della connettività.

### 3.5 Sicurezza, Privacy e Conformità GDPR
I dati trattati dall'app (in particolare peso, composizione corporea, note mediche e piani alimentari) rientrano nelle categorie particolari di dati sanitari:
1. **Crittografia in Transito:** Obbligo assoluto di TLS 1.3 su tutte le connessioni con Nginx, ciphersuites moderne e direttiva `HSTS` (`Strict-Transport-Security`).
2. **Crittografia a Riposo:** Cifratura a livello di volume dati (LUKS su VPS) e partizioni database PostgreSQL protette.
3. **Isolamento Multitenant Logico:** Ogni query deve forzare la condizione `WHERE owner_id = :userId` o verificare il legame `trainer_client_link` per impedire falle IDOR (Insecure Direct Object Reference).
4. **Diritto all'Oblio e Portabilità:** Supporto nativo all'eliminazione totale dell'account e all'esportazione completa in JSON (già integrata nel client).

---

## 4. Infrastruttura e Deployment Target (VPS Linux)

### 4.1 Stack Container-Ready (Docker & Docker Compose)
L'intera architettura server viene progettata per essere completamente isolata, riproducibile e gestibile mediante **Docker Engine** e **Docker Compose**:

```
                       ┌───────────────────────────────┐
                       │  Internet (Client Mobile)     │
                       └──────────────┬────────────────┘
                                      │ Porta 80/443
                                      ▼
                       ┌───────────────────────────────┐
                       │    NGINX (Reverse Proxy)      │
                       │   Terminazione SSL Let's Enc. │
                       └──────────────┬────────────────┘
                                      │ docker network (internal)
                                      ▼
                       ┌───────────────────────────────┐
                       │   BACKEND REST API (Node.js)  │
                       └───────┬──────────────┬────────┘
                               │              │
                    ┌──────────▼─────┐   ┌────▼───────────┐
                    │  PostgreSQL 16 │   │    Redis 7     │
                    │  (Relational)  │   │  (Cache/OTP)   │
                    └────────────────┘   └────────────────┘
```

### 4.2 Configurazione Docker Compose di Produzione
Di seguito la configurazione `docker-compose.yml` di riferimento per il server:

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: mytrainup_nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
      - static_uploads:/var/www/uploads:ro
    depends_on:
      - backend
    networks:
      - frontend_net

  certbot:
    image: certbot/certbot
    container_name: mytrainup_certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt:rw
      - ./certbot/www:/var/www/certbot:rw
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: mytrainup_backend
    restart: always
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?schema=public
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      STORAGE_DRIVER: local
      UPLOAD_DIR: /app/uploads
    volumes:
      - static_uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - frontend_net
      - backend_net

  postgres:
    image: postgres:16-alpine
    container_name: mytrainup_postgres
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/initdb:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - backend_net

  redis:
    image: redis:7-alpine
    container_name: mytrainup_redis
    restart: always
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD}"]
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - backend_net

volumes:
  pgdata:
    driver: local
  redisdata:
    driver: local
  static_uploads:
    driver: local

networks:
  frontend_net:
    driver: bridge
  backend_net:
    driver: bridge
    internal: true
```

### 4.3 Nginx Reverse Proxy & Terminazione SSL
File di configurazione proxy (`nginx/conf.d/mytrainup.conf`):
- Forzatura reindirizzamento HTTP verso HTTPS (`301 Moved Permanently`).
- Cifratura moderna con `TLSv1.2` e `TLSv1.3`.
- Dimensione massima di upload consentita per PDF e foto (`client_max_body_size 25M`).
- Compressione automatica Gzip per payload JSON ad alta efficienza.
- Rate limiting su endpoint di login/OTP per prevenire attacchi di forza bruta.

### 4.4 Requisiti di Sistema Minimi e Raccomandati (Hardware VPS)

| Risorsa Hardware | Requisito Minimo (Fino a 500 Utenti) | Requisito Raccomandato (Fino a 5.000 Utenti) |
|---|---|---|
| **Sistema Operativo** | Ubuntu Server 22.04 / 24.04 LTS x86_64 | Ubuntu Server 24.04 LTS o Debian 12 x86_64 |
| **CPU Virtuale (vCPU)** | 2 Core vCPU (min. 2.0 GHz) | 4 Core vCPU (min. 2.5 GHz) |
| **Memoria RAM** | **4 GB RAM** (con swapfile 2 GB) | **8 GB RAM** |
| **Storage Disco** | 40 GB SSD NVMe | 80 - 120 GB SSD NVMe |
| **Banda di Rete / Traffico** | 100 Mbps (1 TB traffico/mese) | 1 Gbps (illimitato o > 5 TB/mese) |
| **Indirizzi IP** | 1 Indirizzo IPv4 Pubblico Statico | 1 Indirizzo IPv4 Dedicato + Subnet IPv6 |

#### Budget e Provider Cloud Consigliati
- **Tier Entry-Level (Budget Friendly):** Hetzner Cloud (CX22 / CPX21), OVHcloud (VPS Starter/Value), Netcup VPS. *Costo stimato: ~5€ - 10€ / mese*.
- **Tier Standard (Affidabilità Globale):** DigitalOcean (Droplet Basic 4GB), Linode/Akamai, AWS Lightsail (Piano 4GB). *Costo stimato: ~15€ - 24€ / mese*.

### 4.5 Hardening Server, Backup Automatizzati e Monitoring

1. **Hardening del Sistema Operativo Linux:**
   - Disabilitazione login SSH con password (solo autenticazione via chiave pubblica RSA 4096 o Ed25519).
   - Cambio della porta SSH predefinita (es. 2222) e disattivazione root login (`PermitRootLogin no`).
   - Configurazione firewall di sistema `ufw`: porte aperte solo per SSH (personalizzata), HTTP (80) e HTTPS (443).
   - Installazione `fail2ban` per la prevenzione automatica di attacchi brute-force su SSH e Nginx.

2. **Politica di Backup Automatizzata:**
   - **Database (PostgreSQL):** Esecuzione giornaliera automatica (cron job alle 03:00) tramite container script `pg_dump` con compressione gzip.
   - **Rotazione Backup:** Conservazione di 7 backup giornalieri, 4 settimanali e 3 mensili (politica GFS - Grandfather-Father-Son).
   - **Offsite Backup:** Spedizione automatica cifrata dei dump verso storage esterno (es. bucket S3-compatibile / Hetzner Storage Box).

3. **Monitoraggio e Salute del Servizio:**
   - Health check endpoint nativo `/api/v1/health` che interroga lo stato di connettività verso PostgreSQL e Redis.
   - Monitoraggio risorse VPS tramite agenti leggeri (es. Prometheus node_exporter + Grafana o Netdata).
   - Notifiche immediate di indisponibilità via webhook Telegram/Discord o servizio UptimeRobot.

---

*Documentazione redatta per Lorenzo Anzivino - My Train Up Mobile Platform.*  
*Tutti i diritti riservati © 2026.*

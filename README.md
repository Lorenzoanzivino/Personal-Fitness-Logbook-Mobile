# MY TRAIN UP 🏋️‍♂️
> **Personal Fitness, Gym Hub & Workout Logbook Full-Stack Suite**

[![Expo SDK 57](https://img.shields.io/badge/Expo-SDK_57-000020?style=for-the-badge&logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.86.3-61DAFB?style=for-the-badge&logo=react)](https://reactnative.dev)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-000000?style=for-the-badge&logo=fastify)](https://fastify.dev)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=for-the-badge&logo=drizzle)](https://orm.drizzle.team)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_Alpine-4169E1?style=for-the-badge&logo=postgresql)](https://www.postgresql.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

---

## 📖 Panoramica del Progetto

**MyTrainUp** è una suite mobile e cloud completa pensata per la cooperazione in tempo reale tra **Personal Trainer** e **Atleti/Allievi** in sala pesi:

- **Architettura Offline-First con Cloud-Sync**: funzionamento al 100% senza internet grazie a una cache locale partizionata (`AsyncStorage`), arricchita dalla sincronizzazione automatica su server centralizzato (VPS IONOS) con supporto al **Pull-to-Refresh**.
- **Isolamento Rigido dei Dati (Data Isolation per Ruoli)**: ogni utente accede unicamente ai propri dati. Il Trainer può redigere schede in modalità delegata e consultare i progressi dei propri atleti in **sola lettura**, con garanzia assoluta di non sovrascrittura o cancellazione delle misurazioni personali dell'allieva.
- **Pattern Database Decoupled (Zero Data Loss)**: lo storico dei workout svolti è uno snapshot immutabile; modifiche o cancellazioni delle schede template non corrompono mai i carichi storici dell'atleta.
- **Gym Engine per Tecniche Speciali**: supporto nativo a Stripping/Dropset, Rest-Pause, piramidali ed esercizi isometrici a tempo.
- **Sveglia Acustica Continua**: allarme sonoro in loop al termine dei tempi di recupero (`alarm.wav`) per massimizzare il focus durante l'allenamento.
- **Composizione Corporea & Piani Nutrizionali PDF**: calcolo in-place dei delta bioimpedenziometrici e visualizzatore nativo per schede dietetiche.

---

## 📚 Documentazione Completa del Progetto

Tutta la documentazione approfondita è centralizzata nella cartella [`docs/`](file:///home/its/I_Miei_Progetti/Personal-Fitness-Logbook-Mobile/docs/):

1. 📄 [**`docs/PROJECT_OVERVIEW.md`**](file:///home/its/I_Miei_Progetti/Personal-Fitness-Logbook-Mobile/docs/PROJECT_OVERVIEW.md)  
   *Guida Master di allineamento tecnico per Gemini, sviluppatori e AI assistant.* Dettaglio completo e separato delle 3 parti: **DATABASE**, **BACKEND** e **FRONTEND**, matrice di autorizzazione, tabelle e catalogo endpoint REST.
2. 🏛️ [**`docs/SYSTEM_ARCHITECTURE.md`**](file:///home/its/I_Miei_Progetti/Personal-Fitness-Logbook-Mobile/docs/SYSTEM_ARCHITECTURE.md)  
   *Analisi strutturale del sistema.* Paradigma offline-first, state machine reattive, tuning di memoria VPS S (< 600 MB RAM), pattern decoupled e schema relazionale Drizzle.
3. 🚀 [**`docs/DEVOPS_AND_DEPLOYMENT.md`**](file:///home/its/I_Miei_Progetti/Personal-Fitness-Logbook-Mobile/docs/DEVOPS_AND_DEPLOYMENT.md)  
   *Deployment e collaudo operativo.* Configurazione Docker Compose, Nginx SSL (Let's Encrypt), compilazione APK standalone Android e test in rete locale LAN con Expo Go.

---

## 🏗️ Architettura del Repository

```
Personal-Fitness-Logbook-Mobile/
├── assets/                  # Icone, splash screen, audio allarme (alarm.wav) e sfondi
├── backend/                 # Backend monolitico leggero (Node.js + Fastify + Drizzle)
│   ├── src/
│   │   ├── controllers/     # Controller REST (HTTP parsing, validazione DTO)
│   │   ├── services/        # Service Layer (Business logic, isolamento owner_id, Drizzle)
│   │   ├── middleware/      # JWT verify hook (authenticate) e RBAC (requireTrainer)
│   │   ├── routes/          # Dichiarazione endpoint /api/v1
│   │   ├── db/              # Schema Drizzle, migrazioni e seed
│   │   └── types/           # Contratti TypeScript condivisi
│   ├── Dockerfile           # Immagine Docker ottimizzata multistage
│   └── package.json
├── docs/                    # Documentazione tecnica consolidata
│   ├── PROJECT_OVERVIEW.md  # Master alignment per Gemini/AI & Devs
│   ├── SYSTEM_ARCHITECTURE.md
│   └── DEVOPS_AND_DEPLOYMENT.md
├── src/                     # Client Mobile (React Native + Expo)
│   ├── components/          # Componenti UI (Card, Avatar, Toast, Timer, Grafici)
│   ├── context/             # State Machines: AuthContext, GymContext, MeasurementContext, DietContext
│   ├── navigation/          # React Navigation v7: Auth Stack, RootStack, BottomTabNavigator
│   ├── screens/             # Schermate principali (Home, Gym, Clients, Measurements, Diet, Profile, Settings)
│   │   ├── auth/            # Login e Onboarding primo accesso
│   │   └── modals/          # Live Workout Logger, Routine Builder, Pesate
│   ├── services/            # Client API REST e AsyncStorage partizionato
│   ├── theme/               # Design token Gym Dark ad alto contrasto
│   └── types/               # Tipi TypeScript
├── docker-compose.yml       # Stack di produzione: db (PostgreSQL) + api (Fastify) + proxy (Nginx)
├── nginx/                   # Reverse proxy Nginx e configurazione TLS
├── postgres.conf            # Tuning low-memory PostgreSQL (< 180MB RAM)
└── App.tsx                  # Bootstrap e gerarchia provider client mobile
```

---

## ⚡ Avvio Rapido (Quick Start)

### 1. Prerequisiti
- Node.js $\ge$ 20 LTS
- Docker e Docker Compose
- App **Expo Go** installata su smartphone Android o iPhone

### 2. Avvio Backend Locale
```bash
# Avvia solo il database PostgreSQL
docker compose up -d db

# Avvia il server Fastify in modalità watch
cd backend
npm install
npm run dev
# Server attivo su: http://localhost:8000 (Healthcheck: http://localhost:8000/health)
```

### 3. Avvio Client Mobile
```bash
# Nella root del progetto
npm install
npx expo start -c
```
Inquadra il QR Code con l'app Expo Go per eseguire l'applicazione sul tuo dispositivo.

---

## 🔐 Sicurezza & Repository Pubblico

Questo repository è configurato per garantire la massima sicurezza su piattaforme aperte (GitHub):
- **Zero Secrets**: nessun file `.env` contenente credenziali o token è tracciato da Git.
- **Templates Inclusi**: fare riferimento ai template `.env.example`, `.env.production.example` e `backend/.env.example`.
- **Airtight `.gitignore`**: protegge automaticamente certificati (`.pem`, `.key`), keystore Android (`.jks`), backup temporanei e documenti personali (`.pdf`).

---

## 📜 Licenza
Rilasciato sotto licenza [MIT](LICENSE).

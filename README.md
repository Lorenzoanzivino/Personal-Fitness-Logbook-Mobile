# MY TRAIN UP 🏋️‍♂️

> **Personal Fitness & Workout Logbook Mobile**  
> Applicazione mobile avanzata per Personal Trainer e Atleti, sviluppata in **React Native** con **Expo SDK 57** e **TypeScript**, con architettura locale **Offline-First**, gestione dei ruoli (RBAC), timer immersivi per tecniche speciali e tracciamento biometrico e nutrizionale completo.

---

## 📌 Indice
1. [Cos'è MY TRAIN UP](#-cosè-my-train-up)
2. [Caratteristiche Principali](#-caratteristiche-principali)
   - [Area Allenamento & Live Workout Engine](#1-area-allenamento--live-workout-engine)
   - [Timer Speciali & Sveglia Acustica](#2-timer-speciali--sveglia-acustica)
   - [Architettura RBAC: Trainer vs Cliente](#3-architettura-rbac-trainer-vs-cliente)
   - [Misurazioni & Composizione Corporea](#4-misurazioni--composizione-corporea)
   - [Piani Alimentari & Gestione PDF](#5-piani-alimentari--gestione-pdf)
   - [Backup & Portabilità Dati JSON](#6-backup--portabilità-dati-json)
3. [Guida all'Uso](#-guida-alluso)
   - [Autenticazione & Primo Accesso](#autenticazione--primo-accesso)
   - [Gestione Schede e Sessioni Live](#gestione-schede-e-sessioni-live)
   - [Generazione Codici OTP per Allievi](#generazione-codici-otp-per-allievi)
   - [Esportazione e Ripristino Backup](#esportazione-e-ripristino-backup)
4. [Struttura del Progetto](#-struttura-del-progetto)
5. [Stack Tecnologico](#-stack-tecnologico)
6. [Installazione ed Esecuzione](#-installazione-ed-esecuzione)
7. [Compilazione Standalone (APK Android)](#-compilazione-standalone-apk-android)

---

## 📖 Cos'è MY TRAIN UP

**MY TRAIN UP** è un diario di bordo digitale per sala pesi e preparazione atletica. Risolve le limitazioni delle comuni applicazioni di fitness integrando:
- **Gestione completa dei mesocicli** con cartelle e suddivisione per split.
- **Supporto nativo alle tecniche ad alta intensità** (Stripping / Dropset e Rest-Pause) con gestione separata dei recuperi intermedi e del recupero finale tra serie.
- **Timer per lavoro isometrico** (es. Plank o tenute a tempo) affiancato al timer di recupero classico.
- **Sveglia acustica insistente** che suona in loop al termine del recupero per impedire distrazioni durante la sessione.
- **Riconoscimento dei carichi assistiti e zavorrati** per esercizi a corpo libero (trazioni con zavorra `+kg` o alleggerimento con elastico `-kg`).
- **Doppia interfaccia Personal Trainer / Atleta**: il trainer programma le schede e gestisce il proprio catalogo allievi; l'atleta esegue il workout sincronizzato in sola lettura.
- **Architettura Offline-First**: tutti i dati risiedono sul dispositivo in `AsyncStorage`, con esportazione e ripristino istantaneo in formato JSON.

---

## ⚡ Caratteristiche Principali

### 1. Area Allenamento & Live Workout Engine
- **Catalogo Esercizi (46 Esercizi Predefiniti)**:
  - Copre tutti i distretti muscolari principali: Petto, Dorso, Spalle, Bicipiti, Tricipiti, Quadricipiti, Femorali, Polpacci, Addome.
  - Ogni esercizio include gruppo muscolare, tipo (`reps` o `time`), descrizione tecnica e supporto ai video/reel tutorial di YouTube.
  - Possibilità di aggiungere esercizi personalizzati o archiviare quelli non utilizzati.
- **Builder di Schede & Organizzazione in Cartelle**:
  - Creazione rapida di schede con note descrittive, durata in settimane e categorizzazione per cartella (es. *Ipertrofia*, *Forza*, *Definizione*).
  - Multi-selezione per eliminazione o spostamento massivo.
- **Live Workout Logger**:
  - Interfaccia ottimizzata per l'uso durante l'allenamento in sala pesi con tasti touch ampi e ad alto contrasto.
  - Calcolo del volume totale (tonnellaggio sollevato in kg) in tempo reale.
  - Rilevamento automatico dell'**Overload Progressivo**: mostra i carichi e le ripetizioni dell'ultima sessione per monitorare i miglioramenti.

### 2. Timer Speciali & Sveglia Acustica
- **Timer di Lavoro Isometrico (Tension-Time)**:
  - Per gli esercizi isometrici (`time`), compare il pulsante dedicato **`▶ Avvia Lavoro ([N]s)`**.
  - Si apre un overlay ambra con badge **`🔥 LAVORO ATTIVO (ISOMETRIA)`** che conta alla rovescia i secondi di tenuta.
  - Al termine emette un segnale acustico, segna automaticamente la serie come completata e avvia il timer di recupero classico.
- **Timer di Recupero con Allarme in Loop**:
  - Overlay a schermo intero ad alta visibilità con indicazione di serie ed esercizio.
  - Scaduto il tempo, l'applicazione emette una sveglia sonora continua (`alarm.wav`) accompagnata dal pulsante **"SPEGNI SVEGLIA"** che l'atleta deve toccare per confermare la ripresa dell'allenamento.
- **Doppio Recupero per Tecniche Speciali**:
  - **Stripping / Dropset**: conteggio automatico del recupero breve tra un carico scalato e l'altro (es. 10s) e del recupero completo a fine serie (es. 90s).
  - **Rest-Pause**: recupero intra-serie tra i micro-set e recupero completo tra le serie effettive.

### 3. Architettura RBAC: Trainer vs Cliente
- **Profilo Trainer**:
  - Visualizzazione sdoppiata in cima alla tab Gym:
    - **`🏋️ I Miei Allenamenti`**: schede personali, storico allenamenti e progressioni del Trainer.
    - **`👥 Gestione Schede Clienti`**: lista allievi collegati, creazione e assegnazione di schede personalizzate per singolo allievo.
  - Generatore di codici OTP a scadenza per abilitare nuovi atleti.
- **Profilo Cliente / Atleta**:
  - Visualizza in automatico le schede assegnate dal proprio preparatore.
  - Modalità esecuzione protetta (impedisce alterazioni accidentali della struttura del programma).

### 4. Misurazioni & Composizione Corporea
- Registrazione rapida di peso corporeo e parametri bioimpedenziometrici:
  - BMI, % Massa Grassa, Massa Magra (kg), Massa Muscolare (kg), Acqua Corporea (%), Massa Ossea (kg), Grasso Viscerale, BMR e AMR (kcal).
- Calcolo automatico del differenziale (`Δ kg`) rispetto alla misurazione precedente.
- Grafico temporale interattivo dell'andamento ponderale con schede di riepilogo statistico.

### 5. Piani Alimentari & Gestione PDF
- Caricamento di documenti PDF dalla memoria del telefono (rilasciati da nutrizionista o preparatore).
- Visualizzatore PDF nativo integrato a schermo intero.
- Gestione piano nutrizionale attivo vs archivio storico dei piani precedenti.

### 6. Backup & Portabilità Dati JSON
- **Esportazione Istantanea**:
  - Estrae con un tocco l'intero database locale (schede, sessioni, cartelle, pesate, diete e profilo) in formato JSON pulito e formattato, copiandolo negli appunti.
- **Importazione & Ripristino**:
  - Modale interattivo con supporto sia a **"Incolla dagli Appunti"** sia a **"Sfoglia File .json"**.
  - **Validatore a caldo**: controlla la sintassi e genera un'anteprima delle entità riconosciute (`✓ BACKUP VALIDO RICONOSCIUTO`).
  - **Ripristino a caldo**: aggiorna tutti gli archivi persistenti e ricarica immediatamente i contesti React senza necessità di riavviare l'app.
- **Zona di Pericolo**:
  - Funzione di reset totale del database locale, mantenendo **rigorosamente intatto il catalogo dei 46 esercizi predefiniti**.

---

## 📱 Guida all'Uso

### Autenticazione & Primo Accesso
- **Accesso Trainer**:
  - Username: `Lorenzo` oppure `LorenzoAnzivino`
  - Password: `admin123`
- **Accesso Cliente / Allievo**:
  - Username assegnato dall'istruttore.
  - Codice OTP univoco a 6 cifre generato dal Trainer nella sezione Profilo.

### Gestione Schede e Sessioni Live
1. Apri la tab **Gym**.
2. Seleziona una scheda esistente o tocca **`+ Nuova Scheda`** per crearne una.
3. Tocca **`Avvia Allenamento`**: si aprirà il **Live Logger**.
4. Per ogni serie:
   - Se l'esercizio è a ripetizioni: inserisci peso e reps, tocca la spunta verde `✓` per registrare e far partire il timer di recupero.
   - Se l'esercizio è isometrico (Plank): tocca **`▶ Avvia Lavoro`**, mantieni la posizione fino al segnale acustico e premi **`✓ COMPLETA & AVVIA RECUPERO`**.
5. Al termine dell'allenamento, tocca **`✓ Salva & Concludi`** a fondo pagina per archiviare la sessione nel registro storico.

### Generazione Codici OTP per Allievi
1. Accedi come Trainer e recati nella tab **Profilo**.
2. Nella sezione **Gestione Allievi**, tocca **`+ Genera Codice OTP`**.
3. Inserisci il nome dell'allievo e l'indirizzo email: il sistema genererà un codice univoco con validità temporale.
4. L'allievo utilizzerà questo codice dalla schermata di login per collegarsi automaticamente alla scheda predisposta dal trainer.

### Esportazione e Ripristino Backup
1. Accedi alla tab **Setup (Impostazioni)**.
2. Per esportare: tocca **`⬇ Copia Backup JSON negli Appunti`** e incolla il testo in una nota o chat per custodirlo.
3. Per ripristinare: tocca **`⬆ Importa / Ripristina Backup JSON`**, incolla il testo o seleziona il file, verifica l'anteprima verde e tocca **`✅ Ripristina Questo Backup`**.

---

## 📂 Struttura del Progetto

```text
Personal-Fitness-Logbook-Mobile/
├── assets/                          # Immagini, icone e audio
│   ├── alarm.wav                    # Allarme acustico in loop per timer
│   ├── icon.png                     # Icona nativa rotonda launcher Android
│   ├── logo1.png                    # Logo ufficiale MY TRAIN UP
│   └── sfondo_app.jpg               # Sfondo ad alto contrasto per dark mode
├── src/
│   ├── components/                  # Componenti UI riutilizzabili
│   │   ├── Avatar.tsx               # Gestione foto profilo atleta/trainer
│   │   ├── Card.tsx                 # Contenitore card a tema scuro
│   │   ├── CustomConfirmModal.tsx   # Modale di conferma personalizzato
│   │   ├── Header.tsx               # Header globale con logo rotondo e guida ℹ
│   │   ├── ImmersiveTimerOverlay.tsx# Timer a schermo intero (Recupero & Lavoro)
│   │   ├── RestTimerWidget.tsx      # Widget compatto timer
│   │   ├── ScreenBackgroundWrapper.tsx # Wrapper con sfondo sfocato e Safe Area
│   │   ├── ToastFeedback.tsx        # Toast di notifica a comparsa
│   │   └── WeightTrendChart.tsx     # Grafico andamento misurazioni
│   ├── context/                     # Gestione stato globale React Context
│   │   ├── AuthContext.tsx          # Gestione sessione, login e ruoli RBAC
│   │   ├── DietContext.tsx          # Gestione stato piani alimentari PDF
│   │   ├── GymContext.tsx           # Workout engine, calcolo volumi, schede e storico
│   │   └── MeasurementContext.tsx   # Gestione misure corporee e trend
│   ├── data/                        # Dataset predefiniti
│   │   ├── defaultExercises.ts      # 46 esercizi base precaricati e immutabili
│   │   └── defaultRoutines.ts       # Template iniziali
│   ├── navigation/                  # Architettura di navigazione
│   │   ├── BottomTabNavigator.tsx   # Tab bar inferiore con gestione insets Android
│   │   ├── navigationRef.ts         # Riferimento di navigazione sicuro e decouple
│   │   └── RootStackNavigator.tsx   # Stack principale e modali a schermo intero
│   ├── screens/                     # Schermate dell'applicazione
│   │   ├── auth/
│   │   │   └── LoginScreen.tsx      # Login con logo rotondo e selezione ruolo
│   │   ├── HomeScreen.tsx           # Dashboard panoramica e riepilogo settimanale
│   │   ├── GymScreen.tsx            # Selettore Trainer/Clienti, schede e catalogo
│   │   ├── MeasurementsScreen.tsx   # Gestione pesate, composizione corporea e grafici
│   │   ├── DietScreen.tsx           # Consultazione e gestione piani alimentari PDF
│   │   ├── ProfileScreen.tsx        # Profilo atleta, avatar e generatore codici OTP
│   │   ├── SettingsScreen.tsx       # Backup JSON (Export/Import), info e Reset
│   │   └── modals/                  # Modali operativi (Workout, Routine, Dieta, ecc.)
│   │       ├── ExerciseModal.tsx    # Dettaglio esercizio con video YouTube
│   │       ├── MeasurementModal.tsx # Inserimento nuova pesata
│   │       ├── NewRoutineModal.tsx  # Builder creazione/modifica scheda
│   │       ├── PdfViewerModal.tsx   # Visualizzatore PDF nativo
│   │       ├── UploadDietModal.tsx  # Upload file PDF dieta
│   │       └── WorkoutModal.tsx     # Live Logger con timer di lavoro e recupero
│   ├── services/                    # Layer di persistenza e API
│   │   ├── api.ts                   # Client API e simulazione endpoint cloud
│   │   ├── authService.ts           # Logica di autenticazione e validazione OTP
│   │   ├── config.ts                # Configurazione endpoint e timeout di rete
│   │   ├── dietStorage.ts           # Persistenza diete in AsyncStorage
│   │   ├── gymStorage.ts            # Persistenza schede, workout, cartelle ed esercizi
│   │   ├── measurementStorage.ts    # Persistenza misurazioni biometriche
│   │   └── profileService.ts        # Persistenza profilo e gestione associazioni
│   ├── theme/                       # Design System
│   │   ├── colors.ts                # Palette scura, accenti sky-blue ed emerald
│   │   ├── spacing.ts               # Layout, margini e target touch ergonomici
│   │   └── typography.ts            # Gerarchia tipografica ad alta leggibilità
│   └── types/                       # Definizioni TypeScript
│       ├── api.ts, auth.ts, diet.ts, measurement.ts, navigation.ts, profile.ts, workout.ts
├── App.tsx                          # Root Component con SafeAreaProvider
├── app.json                         # Configurazione Expo & identificativi Android
├── package.json                     # Dipendenze e script npm
└── tsconfig.json                    # Configurazione compilatore TypeScript
```

---

## 🛠️ Stack Tecnologico

| Componente | Tecnologia / Libreria | Versione |
| :--- | :--- | :--- |
| **Framework Base** | React Native | `0.86.3` |
| **Piattaforma & Runtime** | Expo SDK | `~57.0.22` |
| **Linguaggio** | TypeScript | `~6.0.3` |
| **Navigazione** | React Navigation (Bottom Tabs & Native Stack) | `v7` |
| **Persistenza Dati** | `@react-native-async-storage/async-storage` | `2.2.0` |
| **Riproduzione Audio** | `expo-audio` | `~57.0.5` |
| **File & Documenti** | `expo-document-picker` | `~57.0.2` |
| **Immagini & Fotocamera** | `expo-image-picker` | `~57.0.17` |
| **Appunti di Sistema** | `expo-clipboard` | `~57.0.2` |
| **Safe Area Insets** | `react-native-safe-area-context` | `^5.9.1` |

---

## 🚀 Installazione ed Esecuzione

### 1. Prerequisiti
- **Node.js** (versione 18 o superiore consigliata)
- **npm** o **yarn**
- Dispositivo Android/iOS con l'applicazione **Expo Go** installata, oppure un emulatore configurato.

### 2. Installazione delle Dipendenze
Dalla directory principale del progetto:
```bash
npm install
```

### 3. Avvio dell'Ambiente di Sviluppo
```bash
npx expo start
```
- Premi `a` per avviare su emulatore Android.
- Inquadra il **QR Code** dal tuo smartphone tramite l'app **Expo Go** per eseguire l'applicazione live sul tuo telefono.

### 4. Verifica del Codice e Typecheck
Per assicurarsi che non siano presenti errori di tipo TypeScript:
```bash
npx tsc --noEmit
```

---

## 📦 Compilazione Standalone (APK Android)

Il progetto è preconfigurato con package nativo `com.lorenzoanzivino.gymlogbook` e profilo di build `preview` per compilare un file **.apk** installabile direttamente su qualsiasi smartphone Android senza passare dal Google Play Store.

### 1. Installazione di EAS CLI
```bash
npm install -g eas-cli
```

### 2. Login con il tuo account Expo
```bash
eas login
```

### 3. Configurazione del Progetto
```bash
eas project:init
```

### 4. Lancio della Compilazione Cloud Gratuita
```bash
eas build --platform android --profile preview
```
Al termine della compilazione nel cloud di Expo, riceverai un link diretto per scaricare ed installare il file **.apk** sul tuo smartphone Android.

---

## 🔒 Sicurezza & Privacy
- Tutti i dati degli allenamenti, le note dei clienti, le pesate e i piani nutrizionali risiedono esclusivamente sul dispositivo mobile locale dell'utente in modalità cifrata/isolata da `AsyncStorage`.
- La portabilità è garantita al 100% tramite il sistema di Backup JSON, permettendo di esportare e ripristinare il proprio storico in qualsiasi momento.

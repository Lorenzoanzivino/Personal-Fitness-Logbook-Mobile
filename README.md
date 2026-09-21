# MY TRAIN UP 🏋️‍♂️

> **Personal Fitness, Gym Hub & Workout Logbook Mobile**  
> Applicazione mobile avanzata per Personal Trainer e Atleti, sviluppata in **React Native** con **Expo SDK 57** e **TypeScript**, dotata di architettura locale **Offline-First**, gestione dei ruoli (RBAC), motore di allenamento per tecniche speciali e tracciamento biometrico e nutrizionale completo.

---

## 📌 Indice
1. [Cos'è MY TRAIN UP](#-cosè-my-train-up)
2. [Architettura del Sistema](#-architettura-del-sistema)
3. [Ruoli RBAC & Controllo Accessi](#-ruoli-rbac--controllo-accessi)
4. [Autenticazione Doppia & Onboarding](#-autenticazione-doppia--onboarding)
5. [Gym Engine & Gestione Schede](#-gym-engine--gestione-schede)
6. [Misurazioni & Composizione Corporea](#-misurazioni--composizione-corporea)
7. [Piani Nutrizionali & Visualizzatore PDF](#-piani-nutrizionali--visualizzatore-pdf)
8. [Backup & Portabilità Dati JSON](#-backup--portabilità-dati-json)
9. [Stack Tecnologico](#-stack-tecnologico)
10. [Installazione ed Esecuzione](#-installazione-ed-esecuzione)
11. [Compilazione Standalone (APK Android)](#-compilazione-standalone-apk-android)
12. [Asset Grafici & Branding Android](#-asset-grafici--branding-android)

---

## 📖 Cos'è MY TRAIN UP

**MY TRAIN UP** è una suite mobile completa progettata sia per il preparatore atletico sia per l'atleta in sala pesi. Permette di gestire il percorso di allenamento a 360 gradi senza dipendere da connessioni internet costanti, eliminando la dispersione su fogli Excel o note cartacee:

- **Architettura 100% Offline-First**: tutti i dati risiedono localmente sul dispositivo in `AsyncStorage`.
- **Doppio Ruolo Specializzato**: interfaccia Master per il Personal Trainer e interfaccia di esecuzione sincronizzata per l'Allievo.
- **Supporto Nativo a Tecniche Intensive**: Stripping/Dropset e Rest-Pause con doppio recupero automatizzato, oltre a esercizi isometrici a tempo.
- **Sveglia Acustica Continua**: allarme sonoro in loop al termine dei recuperi per prevenire cali di concentrazione e ritardi tra le serie.
- **Tracciamento Corporeo & Piani Alimentari**: storico impedenziometrico con modifica in-place e visualizzatore nativo di PDF nutrizionali.

---

## 🏗️ Architettura del Sistema

L'applicazione adotta un'architettura decentralizzata e modulare basata su **React Context** e repository di storage isolati:

```
src/
├── components/          # Componenti UI riutilizzabili ad alto contrasto (Card, Avatar, Toast)
├── context/             # State machine reattive (Auth, Gym, Measurement, Diet)
├── navigation/          # RootStackNavigator con guardie di accesso e BottomTabNavigator
├── screens/             # Schermate applicative (Home, Gym, Clients, Measurements, Diet, Profile, Settings)
│   ├── auth/            # Schermata di Login e Onboarding primo accesso
│   └── modals/          # Modali dedicati a Live Workout, Routine Builder, Pesate e PDF
├── services/            # Storage service (AsyncStorage, FileSystem, Sharing, Backup)
├── theme/               # Design token solidi Gym Dark (colors, spacing, typography)
└── types/               # Contratti e DTO TypeScript rigorosamente tipizzati
```

### Isolamento Dati in Storage Locale (`AsyncStorage`)
- `@user_profile_v3`: Anagrafica e preferenze del profilo attivo.
- `@fitness_provisioned_clients_v2`: Catalogo allievi gestiti dal Trainer.
- `@gym_routines_v3` / `@gym_workouts_v3` / `@gym_folders_v3`: Schede, sessioni completate e cartelle mesociclo.
- `@gym_exercises_v2`: Catalogo dei 46 esercizi muscolari con descrizioni e video.
- `@measurements_v3`: Rilevazioni bioimpedenziometriche e pesate storiche.
- `@diets_v3`: Registrazioni piani alimentari PDF.
- `@avatar_${userId}`: Foto profilo isolate per singolo account per evitare collisioni visive al cambio utente.

---

## 👥 Ruoli RBAC & Controllo Accessi

Il sistema implementa un modello a controllo degli accessi basato sui ruoli (**Role-Based Access Control**):

### 1. Ruolo TRAINER (Master)
- Accesso completo e sbloccato a tutte le sezioni dell'app.
- **Sezione I Miei Allenamenti**: programmazione e log delle sessioni personali.
- **Sezione Gestione Clienti**:
  * Creazione account allievo con Nome, Cognome e Obiettivi.
  * Generazione trasparente dell'username iniziale e del codice OTP di primo accesso.
  * Compilazione e assegnazione in delega delle schede di allenamento per ciascun allievo.
  * Archiviazione (soft-delete) e ripristino o eliminazione definitiva degli atleti.
  * Lista atleti attivi collassabile per una consultazione rapida e pulita.

### 2. Ruolo CLIENT (Atleta Subordinato)
- Accesso focalizzato all'esecuzione e al monitoraggio dei propri progressi.
- Visualizzazione automatica delle schede assegnate dal proprio preparatore.
- Live Workout Logger protetto (struttura scheda non modificabile accidentalmente durante l'allenamento).
- Tab e comandi di gestione clienti non visibili.
- Banner di autenticazione dedicato nel Profilo con stato **"✓ Accesso Verificato"** e indicazione esplicita del Trainer associato.

---

## 🔐 Autenticazione Doppia & Onboarding

Per conciliare la massima sicurezza con la semplicità di recupero credenziali:

1. **Doppia Modalità di Login**:
   - L'atleta può accedere inserendo il proprio **Username** accompagnato dalla **Password Personale** (impostata dall'utente) **OPPURE** tramite il **Codice OTP** originario rilasciato dal Trainer.
   - L'OTP funge da chiave master perpetua di emergenza, garantendo all'atleta di non rimanere mai bloccato fuori dall'app anche in caso di password smarrita.
2. **Onboarding Obbligatorio al Primo Accesso (`ClientOnboardingScreen`)**:
   - Se un atleta accede per la prima volta con OTP (`is_profile_completed === false`), la navigazione normale viene bloccata a livello di router (`RootStackNavigator`).
   - Schermata a schermo intero dedicata:
     * Dati anagrafici di sola lettura (Nome, Cognome e Trainer assegnato).
     * Scelta di un **Username personalizzato** facoltativo (utilizzato nel saluto `Ciao, [USERNAME] 👋` della Home).
     * Impostazione della **Nuova Password** personale obbligatoria con visibilità attivabile/disattivabile.
     * Inserimento opzionale di data di nascita e altezza corporea (cm).
   - Al tocco su **"Salva e Accedi ➔"**, il profilo viene marcato come completato e l'atleta viene indirizzato alla Home.
3. **Logout Globale nell'Header**:
   - Icona di disconnessione sempre accessibile nell'header superiore dell'applicazione con finestra di dialogo modale di conferma per prevenire tocchi accidentali.

---

## 🏋️ Gym Engine & Gestione Schede

### Catalogo Esercizi (46 Predefiniti)
- Classificazione anatomica: Petto, Dorso, Spalle, Bicipiti, Tricipiti, Quadricipiti, Femorali, Polpacci, Addome.
- Tipologia flessibile: a ripetizioni (`reps`) o a tempo di tenuta (`time`).
- Link integrati a video ed esercitazioni YouTube consultabili direttamente dall'app.

### Builder di Schede & Cartelle Mesociclo
- Creazione rapida di routine con suddivisione settimanale e split giornalieri.
- Organizzazione in cartelle categorizzate (es. *Forza*, *Ipertrofia*, *Mantenimento*).
- **Clonazione avanzata**: duplicazione istantanea di singole schede o operazioni batch su più routine selezionate contemporaneamente.

### Tecniche Speciali & Sveglia Acustica
- **Stripping (Dropset)**: gestione differenziata del recupero breve tra i carichi scalati (es. 10 secondi) e del recupero lungo tra le serie complete (es. 90 secondi).
- **Rest-Pause**: recupero intra-serie tra i micro-set e recupero inter-serie completo.
- **Isometria Attiva**: timer ambra a schermo intero che calcola il tempo di contrazione isometrica (es. Plank) prima di avviare automaticamente il timer di riposo.
- **Sveglia Sonora in Loop (`alarm.wav`)**: al termine di ogni conto alla rovescia, l'app suona in maniera insistente fino a quando l'atleta non tocca il pulsante **"SPEGNI SVEGLIA"**.
- **Sovraccarico Progressivo**: visualizzazione a confronto dei carichi e delle ripetizioni eseguite nella sessione precedente per facilitare l'incremento prestazionale.

---

## ⚖️ Misurazioni & Composizione Corporea

La sezione **Misurazioni** permette di tenere traccia della composizione corporea nel tempo:

- **Modulo In-Place di Registrazione & Modifica**:
  * Posizionato in cima alla schermata per un inserimento immediato.
  * In modalità standard: permette di inserire rapidamente data, peso e parametri impedenziometrici.
  * In modalità modifica: al tocco sul pulsante **"✏️ Modifica"** presente su ciascuna card dello storico, i campi vengono popolati automaticamente con i valori selezionati e il pulsante si trasforma in **"Aggiorna Misurazione"**.
- **Parametri Impedenziometrici Supportati**:
  * Peso corporeo (kg) con calcolo automatico del differenziale (`Δ kg`) rispetto all'ultima pesata.
  * Calcolo automatico o manuale del **BMI** basato sull'altezza salvata nel profilo.
  * Percentuale di Massa Grassa (`%`), Massa Magra (`kg`), Massa Muscolare (`kg`), Acqua Corporea (`%`), Massa Ossea (`kg`), Grasso Viscerale, BMR e AMR (`kcal`).
  * Note cliniche e tracciamento delle circonferenze corporee (girovita, braccio, petto, cosce).

---

## 🥗 Piani Nutrizionali & Visualizzatore PDF

- Caricamento di documenti PDF alimentari rilasciati dal nutrizionista o preparatore.
- Distinzione tra **Piano Attivo** (in evidenza con data di inizio validità) e **Archivio Piani Passati**.
- **Visualizzazione Nativa tramite `expo-sharing`**:
  * Il tocco sul file PDF attiva il visualizzatore di sistema predefinito di Android e iOS (`Sharing.shareAsync`).
  * Supporto a zoom, visualizzazione a pagine affiancate e strumenti di stampa/condivisione nativi del dispositivo.

---

## 💾 Backup & Portabilità Dati JSON

L'architettura garantisce la totale proprietà dei dati da parte dell'utente:

- **Esportazione Unificata**:
  * Generazione di un unico file JSON contenente tutte le collezioni del database locale (profilo, clienti provisionati, routine, sessioni di allenamento, cartelle mesociclo, catalogo esercizi, pesate corporee e diete).
  * Condivisione rapida tramite `expo-sharing` (`mytrainup_backup_[timestamp].json`) e copia negli appunti.
- **Importazione & Ripristino a Caldo**:
  * Modale con supporto a inserimento manuale di testo JSON o selezione da file system.
  * Validazione a caldo della struttura del backup prima dell'applicazione.
  * Ricaricamento immediato di tutti i Context React per riflettere i dati senza dover riavviare l'app.
- **Reset di Emergenza**:
  * Possibilità di cancellare lo storage locale preservando rigorosamente il catalogo base dei 46 esercizi muscolari.

---

## 💻 Stack Tecnologico

- **Core**: [React Native](https://reactnative.dev/) + [Expo SDK 57](https://expo.dev/)
- **Linguaggio**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Routing & Navigazione**: [React Navigation v6](https://reactnavigation.org/) (Native Stack & Bottom Tabs)
- **Persistenza**: [@react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage)
- **Audio & Media**: [expo-av](https://docs.expo.dev/versions/latest/sdk/av/)
- **File & Condivisione**: [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem/) & [expo-sharing](https://docs.expo.dev/versions/latest/sdk/sharing/)
- **Interfaccia & Gesture**: [react-native-safe-area-context](https://github.com/th3rdwave/react-native-safe-area-context), [react-native-screens](https://github.com/software-mansion/react-native-screens)

---

## 🚀 Installazione ed Esecuzione

### Prerequisiti
- [Node.js](https://nodejs.org/) (v18 o superiore raccomandato)
- Gestore di pacchetti `npm` o `yarn`
- Applicazione **Expo Go** su smartphone Android/iOS oppure un emulatore configurato

### Setup Locale
```bash
# 1. Clona il repository
git clone https://github.com/Lorenzoanzivino/Personal-Fitness-Logbook-Mobile.git
cd Personal-Fitness-Logbook-Mobile

# 2. Installa le dipendenze
npm install

# 3. Avvia il server di sviluppo Expo
npx expo start
```

### Configurazione Variabili d'Ambiente (Opzionale)
Crea un file `.env` nella root del progetto per personalizzare le credenziali master del Trainer:
```env
EXPO_PUBLIC_TRAINER_USERNAME = username
EXPO_PUBLIC_TRAINER_PASSWORD = password
EXPO_PUBLIC_TRAINER_FIRST_NAME = name
EXPO_PUBLIC_TRAINER_LAST_NAME = lastname
EXPO_PUBLIC_TRAINER_EMAIL = name@example.com
```

---

## 📱 Compilazione Standalone (APK Android)

Per generare il pacchetto installabile `.apk` per dispositivi Android tramite **EAS Build**:

```bash
# 1. Installa EAS CLI globalmente
npm install -g eas-cli

# 2. Effettua il login al tuo account Expo
eas login

# 3. Configura il progetto per la build
eas build:configure

# 4. Avvia la build dell'APK Android (profilo preview)
eas build --platform android --profile preview
```

---

## 🎨 Asset Grafici & Branding Android

Per garantire una resa visiva ottimale sui dispositivi mobili ed evitare artefatti grafici:

- **Icona Adattiva Android (`adaptiveIcon`)**:
  * Utilizzo dell'asset `assets/adaptive-icon-padded.png` con una **Safe Zone al 60%** (circa 614x614 px) centrata su canvas 1024x1024 px.
  * Previene l'effetto di ritaglio e zoom automatico applicato dai launcher Android (maschere circolari e squircle).
  * Colore di sfondo coordinato arancione (`#FF6B00`).
- **Splash Screen Nativo Trasparente**:
  * Utilizzo dell'asset `assets/transparent.png` (pixel 1x1 trasparente) con sfondo `#0F172A` e `resizeMode: "contain"`.
  * Elimina definitivamente il fallback visivo della griglia grigia di Expo durante il caricamento iniziale dell'app.

----

*My Train Up © 2026 - Lorenzo Anzivino. Tutti i diritti riservati.*

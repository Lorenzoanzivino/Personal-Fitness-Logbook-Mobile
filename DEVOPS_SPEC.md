# DEVOPS_SPEC: Architettura di Produzione, Build Mobile & Deployment

Questo documento tecnico operativo definisce lo stato architetturale attuale dell'applicazione **Personal Fitness Logbook Mobile**, le istruzioni dettagliate per la compilazione del pacchetto nativo `.apk` (Android) e la specifica infrastrutturale per il deployment del backend centralizzato su VPS IONOS (Docker + Reverse Proxy Nginx).

---

## 1. STATO ATTUALE DELLO STORAGE E DEI SERVIZI MOCK

### 1.1 Meccanismo di Persistenza Locale (AsyncStorage)
L'applicazione corrente adotta `@react-native-async-storage/async-storage` come unico motore di persistenza dei dati.

* **Natura del driver**: Si tratta di un database chiave-valore non crittografato vincolato alla sandbox del sistema operativo del singolo dispositivo:
  * **Android**: memorizzato in un database SQLite/RocksDB locale allocato in `/data/data/<package_name>/databases/RKStorage`.
  * **iOS**: memorizzato come file serializzato dizionario in `Documents/RCTAsyncLocalStorage_V1`.
  * **Web**: memorizzato all'interno del `window.localStorage` del browser.
* **Mappatura delle chiavi di storage dell'app**:
  * `@fitness_auth_session_v2`: memorizza il token e il profilo dell'utente autenticato (`AuthUser`).
  * `@fitness_provisioned_clients_v2`: memorizza la lista degli account cliente creati dal trainer con i relativi codici OTP generati.
  * `@fitness_active_otps_v1`: archivio dei codici OTP per il pairing in memoria/locale.
  * `@user_profile_v2`: anagrafica atleta, ruolo (`TRAINER` / `CLIENT`) e collegamenti.
  * `@fitness_exercises_v3`: catalogo degli esercizi con tipologia (`reps` / `time` / `weight_type`), gruppo muscolare, note e URL video YouTube.
  * `@fitness_routines_v3`: catalogo delle schede mesociclo, comprensive di configurazione serie (Normal, Warm-up, Stripping, Rest-Pause).
  * `@fitness_workouts_v3`: storico dei log di allenamento completati con Live Logger.
  * `@fitness_folders_v3`: cartelle di raggruppamento per le schede.
  * `@fitness_measurements_v3`: storico impedenziometrico e calcoli composizione corporea.
  * `@fitness_diets_v2`: archivio PDF e piani alimentari memorizzati in locale.

### 1.2 Servizi Mock e Limite di Sincronizzazione Multi-Dispositivo
In `src/services/api.ts` e nei context (`AuthContext`, `GymContext`, `MeasurementContext`, `DietContext`), l'app simula una chiamata REST con fallback locale:
```typescript
// Esempio da src/services/api.ts
const url = getApiEndpoint(path);
// Fallback su persistenza locale in memoria / AsyncStorage
this.inMemoryOtps.set(code, record);
await this.persistOtps();
```

> [!WARNING]
> **Perché due dispositivi fisici diversi non si sincronizzano**:
> Attualmente, se il **Personal Trainer** usa l'applicazione sul proprio smartphone (Dispositivo A) e registra un nuovo cliente generando un codice OTP (es. `A9K3F2`), tale codice e il record cliente vengono scritti **esclusivamente** nella memoria flash locale del Dispositivo A.
> Quando il **Cliente** apre l'applicazione sul proprio smartphone (Dispositivo B) e prova a fare login o pairing con lo stesso codice, il Dispositivo B interroga il proprio `AsyncStorage` vuoto e non ha alcun canale di rete condiviso per consultare i dati del Dispositivo A.
> **Per rendere operativa l'interazione tra Trainer e Cliente è indispensabile un server centralizzato condiviso.**

---

## 2. BUILD APK LOCALE (STANDALONE ANDROID SENZA GOOGLE PLAY)

Per distribuire l'applicazione direttamente sugli smartphone Android (ad esempio tramite invio del file `.apk` su WhatsApp, Telegram o download diretto da web), è possibile compilare un pacchetto APK non firmato o firmato con keystore di debug/release.

### 2.1 Prerequisiti di Configurazione (`app.json`)
Nel file `app.json`, la sezione `android` deve contenere il parametro `package` univoco (formato reverse domain):
```json
{
  "expo": {
    "name": "Personal-Fitness-Logbook-Mobile",
    "slug": "Personal-Fitness-Logbook-Mobile",
    "version": "1.0.0",
    "android": {
      "package": "com.personalfitness.logbook",
      "adaptiveIcon": {
        "backgroundColor": "#0F172A",
        "foregroundImage": "./assets/android-icon-foreground.png"
      }
    }
  }
}
```

---

### 2.2 Metodo A: Compilazione con EAS CLI (Consigliato per Semplicità)

EAS (Expo Application Services) permette di compilare direttamente un file `.apk` installabile senza dover configurare manualmente l'intero Android Studio NDK sul proprio computer.

#### 1. File di Configurazione `eas.json`
Crea o verifica il file `eas.json` nella root del progetto con il profilo `buildType: "apk"`:
```json
{
  "cli": {
    "version": ">= 15.0.0"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

#### 2. Comandi di Compilazione EAS

* **Opzione 1: Build in Cloud (Free Tier Expo)**
  Non richiede Android Studio o Java installati localmente:
  ```bash
  # 1. Installazione globale del client EAS
  npm install -g eas-cli

  # 2. Login con account Expo gratuito
  eas login

  # 3. Configurazione del progetto
  eas build:configure

  # 4. Lancio della compilazione APK
  eas build --platform android --profile preview
  ```
  Al termine della compilazione, il terminale restituisce il link diretto per scaricare il file `.apk` pronto all'installazione su qualsiasi telefono Android.

* **Opzione 2: Build Locale via EAS (con Docker o SDK Android locale)**
  ```bash
  eas build --platform android --profile preview --local
  ```

---

### 2.3 Metodo B: Compilazione Bare Nativizzata (Gradle Locale)

Se si preferisce compilare interamente offline sul proprio ambiente Linux/Mac/Windows con Android SDK installato:

```bash
# 1. Generazione del codice nativo Android
npx expo prebuild --platform android

# 2. Accesso alla cartella nativa generata
cd android

# 3. Compilazione APK Debug (immediata, senza configurazione keystore)
./gradlew assembleDebug
# Output generato: android/app/build/outputs/apk/debug/app-debug.apk

# 4. In alternativa: Compilazione APK Release (ottimizzato e compresso con Proguard)
./gradlew assembleRelease
# Output generato: android/app/build/outputs/apk/release/app-release.apk
```

#### Installazione diretta su dispositivo via USB / ADB:
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 3. ARCHITETTURA DI PRODUZIONE (SERVER VPS IONOS)

Per permettere a Trainer e Clienti di sincronizzarsi in tempo reale, l'infrastruttura backend su VPS Linux (Debian 12 o Ubuntu 24.04 LTS) sarà orchestrata tramite container Docker.

```
[ Smartphone Trainer (APK) ]         [ Smartphone Cliente (APK) ]
             \                                    /
              \--- HTTPS (Port 443 / TLS) -------/
                                 |
                                 v
               +-----------------------------------+
               |      VPS IONOS (Debian/Ubuntu)    |
               |                                   |
               |  +-----------------------------+  |
               |  | Reverse Proxy: NGINX        |  |
               |  | (SSL Let's Encrypt / Gzip)  |  |
               |  +--------------+--------------+  |
               |                 |                 |
               |        http://backend:8000        |
               |                 v                 |
               |  +-----------------------------+  |
               |  | Backend: Python FastAPI     |  |
               |  | (Uvicorn ASGI Server)       |  |
               |  +--------------+--------------+  |
               |                 |                 |
               |       Persistenza su Volume       |
               |                 v                 |
               |  +-----------------------------+  |
               |  | SQLite (/data/fitness.db)   |  |
               |  | WAL Mode + Uploads PDF      |  |
               |  +-----------------------------+  |
               +-----------------------------------+
```

---

### 3.1 Mappatura Endpoints REST Backend (FastAPI)

Il backend esporrà i contratti REST già tipizzati in `src/types/`:

| Metodo | Endpoint | Descrizione |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Login Trainer (`admin123`) o Cliente (`OTP`) |
| `POST` | `/api/v1/auth/provision` | Creazione cliente da parte del Trainer con generazione OTP |
| `GET` | `/api/v1/auth/provisioned-clients` | Elenco clienti provisionati per il Trainer |
| `POST` | `/api/v1/auth/otp/generate` | Generazione codice OTP d'invito (valido 30 min) |
| `POST` | `/api/v1/auth/otp/verify-link` | Accoppiamento account Atleta al Trainer |
| `GET / PUT` | `/api/v1/profile` | Lettura e aggiornamento dati anagrafici e biometrici |
| `GET / POST` | `/api/v1/routines` | Elenco e salvataggio schede di allenamento (filtrate per `owner_id`) |
| `PUT / DELETE`| `/api/v1/routines/{id}` | Modifica ed eliminazione scheda |
| `GET / POST` | `/api/v1/workouts` | Storico sessioni di allenamento completate |
| `GET / POST` | `/api/v1/folders` | Gestione cartelle schede |
| `GET / POST` | `/api/v1/measurements`| Storico pesate e parametri impedenziometrici |
| `POST` | `/api/v1/diets/upload` | Upload PDF piano nutrizionale (memorizzato su volume disco) |
| `GET` | `/api/v1/diets/{id}/pdf` | Download o streaming del PDF dieta |

*Nota su SQLite in produzione*: L'utilizzo di SQLite con FastAPI è ideale per un logbook personale o studio di personal training. È sufficiente abilitare la modalità **WAL (Write-Ahead Logging)** per consentire letture concorrenti senza lock:
```python
# Nel database engine SQLAlchemy / SQLite
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;
```

---

### 3.2 Docker Compose di Produzione (`docker-compose.yml`)

Salva questo file nella directory `/opt/fitness-backend` del server Ionos:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: fitness-api
    restart: always
    environment:
      - ENV=production
      - DATABASE_URL=sqlite:////data/fitness.db
      - JWT_SECRET=cambia-questa-chiave-segreta-con-stringa-lunga-64-caratteri
      - UPLOAD_DIR=/data/uploads
    volumes:
      - fitness_data:/data
    networks:
      - internal_net
    expose:
      - "8000"

  reverse-proxy:
    image: nginx:alpine
    container_name: fitness-proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - fitness_data:/data/uploads:ro
    depends_on:
      - backend
    networks:
      - internal_net

volumes:
  fitness_data:
    name: fitness_persistent_data

networks:
  internal_net:
    driver: bridge
```

---

### 3.3 Configurazione Nginx Reverse Proxy (`nginx/conf.d/default.conf`)

```nginx
server {
    listen 80;
    server_name api.iltuodominio.it; # oppure l'IP della VPS se non hai dominio

    # Redirect su HTTPS (consigliato se presente certificato Let's Encrypt)
    # return 301 https://$host$request_uri;

    client_max_body_size 25M; # Supporto per l'upload di PDF nutrizionali fino a 25MB

    location /api/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location /uploads/ {
        alias /data/uploads/;
        autoindex off;
    }
}
```

---

### 3.4 Configurazione del file `.env` nell'App Mobile

Nel frontend mobile basato su React Native / Expo, le variabili d'ambiente con prefisso `EXPO_PUBLIC_` vengono **incorporate direttamente all'interno del bundle JavaScript durante il processo di compilazione (build-time)**.

> [!IMPORTANT]
> Non è possibile modificare l'URL dell'API dopo aver compilato l'APK modificando un file sul telefono. La configurazione `.env` **deve essere impostata prima** di lanciare il comando `eas build` o `gradlew assembleRelease`.

#### Passaggi operativi prima della compilazione dell'APK:

1. Modifica il file `.env` nella root dell'app mobile:
   ```env
   # Se possiedi un dominio con certificato SSL (CONSIGLIATO):
   EXPO_PUBLIC_API_URL=https://api.iltuodominio.it

   # Oppure se utilizzi l'IP pubblico del VPS Ionos:
   EXPO_PUBLIC_API_URL=http://<IP_PUBBLICO_VPS_IONOS>

   EXPO_PUBLIC_ENV=production
   ```

2. **Attenzione a Cleartext HTTP su Android (se usi l'IP senza HTTPS)**:  
   A partire da Android 9 (API level 28), il sistema operativo blocca di default il traffico HTTP non cifrato (errore: `CLEARTEXT_COMMUNICATION_NOT_PERMITTED`).  
   Se punti a un IP su porta 80 non protetto da HTTPS, in `app.json` devi consentire il traffico non cifrato per il dominio o l'IP di sviluppo:
   ```json
   {
     "expo": {
       "android": {
         "usesCleartextTraffic": true
       }
     }
   }
   ```
   *Raccomandazione di produzione*: Collegare un dominio o sottodominio gratuito (o a 1€ su Ionos) e attivare un certificato SSL gratuito tramite `certbot` (`HTTPS` porta 443), in modo da garantire comunicazioni protette e conformi a tutti gli standard Android moderni.

---

## 4. CHECKLIST OPERATIVA RAPIDA PER IL DEPLOYMENT

1. **Server VPS IONOS**:
   * Installa Docker e Docker Compose (`curl -fsSL https://get.docker.com | sh`).
   * Clona il backend Python/FastAPI in `/opt/fitness-backend`.
   * Avvia i container: `docker compose up -d`.
   * Verifica lo stato dell'API: `curl http://localhost/api/v1/profile` (deve rispondere HTTP 200 o 401).
2. **App Mobile**:
   * Imposta `EXPO_PUBLIC_API_URL=https://api.iltuodominio.it` nel file `.env`.
   * Verifica il codice con `npx tsc --noEmit`.
   * Lancia la build APK con `eas build --platform android --profile preview`.
   * Installa il file `.apk` generato sia sullo smartphone del Trainer sia su quello del Cliente.
   * Il sistema è ora completamente sincronizzato in cloud su VPS Ionos.

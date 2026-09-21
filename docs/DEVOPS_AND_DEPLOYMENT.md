# GUIDA DEVOPS, DEPLOYMENT & COLLAUDO LOCALE
## Progetto: MyTrainUp (Personal Fitness Logbook Mobile)

> **Documento Consolidato:** Specifiche operative per il deployment su VPS IONOS, configurazione Docker Compose, Nginx SSL, compilazione del pacchetto Android nativo (.apk) e collaudo locale in rete LAN.  
> **Versione:** 1.0.0 (Settembre 2026)  

---

## 📌 Indice dei Contenuti
1. [Infrastruttura di Produzione (VPS IONOS)](#1-infrastruttura-di-produzione-vps-ionos)
   - [1.1 Configurazione Docker Compose](#11-configurazione-docker-compose)
   - [1.2 Nginx Reverse Proxy e Certificati Let's Encrypt](#12-nginx-reverse-proxy-e-certificati-lets-encrypt)
   - [1.3 Procedura di Aggiornamento e Deploy su VPS](#13-procedura-di-aggiornamento-e-deploy-su-vps)
2. [Compilazione Pacchetto Nativo Android (APK Standalone)](#2-compilazione-pacchetto-nativo-android-apk-standalone)
   - [2.1 Configurazione `app.json` ed `eas.json`](#21-configurazione-appjson-ed-easjson)
   - [2.2 Generazione APK Locale (EAS Local Build)](#22-generazione-apk-locale-eas-local-build)
   - [2.3 Generazione APK Cloud tramite EAS Build](#23-generazione-apk-cloud-tramite-eas-build)
3. [Guida al Collaudo Locale in Rete LAN](#3-guida-al-collaudo-locale-in-rete-lan)
   - [3.1 Avvio Database e Backend su LAN](#31-avvio-database-e-backend-su-lan)
   - [3.2 Configurazione Client `.env.development`](#32-configurazione-client-envdevelopment)
   - [3.3 Test Sincronizzazione e Pull-to-Refresh](#33-test-sincronizzazione-e-pull-to-refresh)

---

## 1. Infrastruttura di Produzione (VPS IONOS)

### 1.1 Configurazione Docker Compose
Il file `docker-compose.yml` orchestra i 3 container mantenendo i consumi RAM rigidamente inferiori a 600 MB:

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    container_name: fitness_db
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-fitness_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-fitness_secure_password}
      POSTGRES_DB: ${POSTGRES_DB:-fitness_logbook}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    deploy:
      resources:
        limits:
          memory: 180M
        reservations:
          memory: 80M
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fitness_user -d fitness_logbook"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: fitness_api
    restart: always
    environment:
      NODE_ENV: production
      PORT: 8000
      JWT_SECRET: ${JWT_SECRET}
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
    depends_on:
      db:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 250M
        reservations:
          memory: 100M

  proxy:
    image: nginx:alpine
    container_name: fitness_proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - api
    deploy:
      resources:
        limits:
          memory: 50M
        reservations:
          memory: 15M

volumes:
  postgres_data:
```

### 1.2 Nginx Reverse Proxy e Certificati Let's Encrypt
Il server Nginx instrada il traffico HTTPS dal dominio di produzione `api.mytrainup.it` verso la porta interna 8000 di Fastify:
```nginx
server {
    listen 80;
    server_name api.mytrainup.it;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.mytrainup.it;

    ssl_certificate /etc/letsencrypt/live/api.mytrainup.it/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.mytrainup.it/privkey.pem;

    location / {
        proxy_pass http://api:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 1.3 Procedura di Aggiornamento e Deploy su VPS
```bash
# 1. Accesso SSH
ssh root@api.mytrainup.it

# 2. Aggiornamento codice da Git
cd /opt/Personal-Fitness-Logbook-Mobile
git pull origin master

# 3. Ricompilazione e riavvio container API
docker compose up -d --build api

# 4. Verifica stato e log
docker compose ps
docker compose logs -f api
```

---

## 2. Compilazione Pacchetto Nativo Android (APK Standalone)

Per distribuire l'applicazione direttamente sugli smartphone degli atleti senza passare da Google Play Store (sideloading via WhatsApp, Telegram o link diretto), si genera il file `.apk` standalone.

### 2.1 Configurazione `app.json` ed `eas.json`
Nel file `eas.json`:
```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.mytrainup.it",
        "EXPO_PUBLIC_ENV": "production"
      }
    }
  }
}
```

### 2.2 Generazione APK Locale (EAS Local Build)
Prerequisiti: Docker o Android SDK installato localmente.
```bash
npx eas-cli build --platform android --profile preview --local
```
Il file generato `.apk` risiederà nella directory corrente pronto per essere installato su qualsiasi terminale Android.

### 2.3 Generazione APK Cloud tramite EAS Build
Se non si desidera configurare l'Android SDK sulla propria macchina:
```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```
Al termine della compilazione sui server Expo, verrà restituito il link diretto per scaricare il file `.apk`.

---

## 3. Guida al Collaudo Locale in Rete LAN

Questa procedura consente di testare la sincronizzazione client-server in tempo reale con smartphone fisico connesso alla stessa rete Wi-Fi dello sviluppatore.

### 3.1 Avvio Database e Backend su LAN
1. Identifica l'indirizzo IP locale del tuo computer di sviluppo:
   ```bash
   ip route get 1.1.1.1 | awk '{print $7}'
   # Esempio restituito: 192.168.1.150
   ```
2. Avvia il database PostgreSQL:
   ```bash
   docker compose up -d db
   ```
3. Avvia il server Fastify:
   ```bash
   cd backend
   npm run dev
   # Fastify ascolta su 0.0.0.0:8000
   ```
4. Verifica la risposta da un browser o terminale:
   ```bash
   curl http://192.168.1.150:8000/health
   # Risposta: {"status":"ok","db":"connected",...}
   ```

### 3.2 Configurazione Client `.env.development`
Nella root del progetto, crea il file `.env` locale:
```env
EXPO_PUBLIC_API_URL=http://192.168.1.150:8000
EXPO_PUBLIC_ENV=development
EXPO_PUBLIC_TRAINER_USERNAME=Lorenzo
EXPO_PUBLIC_TRAINER_PASSWORD=admin123
```

### 3.3 Test Sincronizzazione e Pull-to-Refresh
1. Avvia Expo:
   ```bash
   npx expo start -c
   ```
2. Scansiona il QR Code con **Expo Go** sullo smartphone.
3. Effettua il login come Trainer (`Lorenzo` / `admin123`).
4. Apri la schermata **Atleti**:
   - Crea un nuovo allieva (es. "Chiara Bianchi").
   - Trascina verso il basso per eseguire il **Pull-to-Refresh**: comparirà il toast *"Lista atleti aggiornata!"*.
5. Apri la schermata **Misurazioni**:
   - Trascina verso il basso per sincronizzare le misurazioni con il server remoto.

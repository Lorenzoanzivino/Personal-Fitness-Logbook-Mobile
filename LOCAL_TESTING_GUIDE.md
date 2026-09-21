# GUIDA OPERATIVA AL COLLAUDO LOCALE (LAN) & PULL-TO-REFRESH

Questa guida descrive la procedura dettagliata per avviare il backend locale (Fastify + PostgreSQL), configurare il client React Native su rete locale (Wi-Fi) e testare la sincronizzazione dei dati e il Pull-to-Refresh tramite **Expo Go** su un singolo dispositivo (Android o iPhone).

---

## 1. AVVIO DEL BACKEND LOCALE

È possibile avviare l'infrastruttura backend tramite **Docker Compose** (consigliato per parità con la produzione) oppure eseguendo **PostgreSQL in container** e Fastify direttamente con Node.js.

### Metodo A: Docker Compose (Stack Completo)

1. Apri un terminale nella root del progetto:
   ```bash
   cd /home/its/I_Miei_Progetti/Personal-Fitness-Logbook-Mobile
   ```

2. Avvia i servizi database (`db`) e backend API (`api`) in background:
   ```bash
   docker compose up -d --build db api
   ```

3. Verifica che i container siano attivi e healthy:
   ```bash
   docker compose ps
   ```

4. Controlla i log di avvio e le migrazioni automatiche Drizzle:
   ```bash
   docker compose logs -f api
   ```
   Dovresti visualizzare:
   ```
   🔄 [MIGRATE] Verifica e applicazione schema PostgreSQL Decoupled...
   ✅ [MIGRATE] Schema tabelle e indici verificati con successo.
   🌱 [SEED] Creazione Trainer predefinito: Lorenzo...
   🌱 [SEED] Inserimento dei 46 esercizi base del catalogo...
   🚀 Server Fastify in ascolto su http://0.0.0.0:8000
   ```

5. Verifica l'endpoint di stato nel browser o con curl:
   ```bash
   curl http://localhost:8000/health
   # Risposta attesa: {"status":"ok","uptime":...,"db":"connected",...}
   ```

---

### Metodo B: Sviluppo Diretto Node.js (Hot-Reload con `tsx`)

Se preferisci lavorare con ricaricamento del codice in tempo reale durante lo sviluppo backend:

1. Avvia solo il database PostgreSQL con Docker:
   ```bash
   docker compose up -d db
   ```

2. Entra nella cartella `backend` e avvia il server in modalità watch:
   ```bash
   cd backend
   npm run dev
   ```
   Il server si avvierà su `http://localhost:8000` con hot-reload attivo ad ogni salvataggio dei file in `backend/src/`.

---

## 2. INDIVIDUAZIONE DELL'INDIRIZZO IP LAN DEL COMPUTER

Affinché lo smartphone fisico (Android o iPhone collegato alla stessa rete Wi-Fi) possa raggiungere il server locale, occorre specificare l'indirizzo IP locale (LAN) del PC invece di `localhost`.

### Su Linux:
Esegui nel terminale:
```bash
hostname -I | awk '{print $1}'
# Esempio output: 192.168.1.150
```
oppure:
```bash
ip addr show | grep -w "inet" | grep -v "127.0.0.1"
```

### Su macOS:
```bash
ipconfig getifaddr en0
```

### Su Windows (PowerShell):
```powershell
ipconfig
# Cerca "Indirizzo IPv4" della scheda Wi-Fi o Ethernet
```

> [!IMPORTANT]
> **Stessa Rete Wi-Fi**: Assicurati che il tuo PC di sviluppo e il tuo smartphone siano collegati alla **stessa rete Wi-Fi locale**. Se hai una rete "Guest" (ospiti) o firewall restrittivi sul router, i dispositivi potrebbero non vedersi.

---

## 3. CONFIGURAZIONE DEL CLIENT REACT NATIVE (.env)

1. Nella root del progetto mobile, modifica il file `.env` (o `.env.development`) impostando la variabile `EXPO_PUBLIC_API_URL` con l'IP trovato al punto precedente:
   ```env
   # Sostituisci 192.168.1.150 con il TUO indirizzo IP LAN reale
   EXPO_PUBLIC_API_URL=http://192.168.1.150:8000

   EXPO_PUBLIC_ENV=development
   EXPO_PUBLIC_TRAINER_USERNAME=Lorenzo
   EXPO_PUBLIC_TRAINER_PASSWORD=admin123
   ```

2. Avvia il server di sviluppo Metro / Expo:
   ```bash
   npx expo start -c
   ```
   *(Il flag `-c` pulisce la cache di Metro garantendo che il nuovo valore di `.env` venga letto immediatamente).*

3. Inquadra il QR Code sul terminale con:
   - **iPhone**: App Fotocamera nativa -> Tocca il banner per aprire **Expo Go**.
   - **Android**: Apri l'app **Expo Go** e tocca "Scan QR Code".

---

## 4. COLLAUDO GUIDATO PASSO-PASSO (TEST END-TO-END)

Puoi collaudare l'intero flusso di sincronizzazione su un **singolo dispositivo** eseguendo il passaggio di ruolo tramite Logout/Login.

```
+-----------------------------------------------------------------------------------+
| RUOLO 1: TRAINER                                                                  |
| 1. Login Trainer (Lorenzo / admin123)                                             |
| 2. Tab "Clienti" -> Crea nuovo account atleta (es. "Giulia Bianchi")              |
| 3. Copia l'username e l'OTP generato (es. OTP: "K7X9B2")                          |
| 4. Tab "Gym" -> "Schede" -> Crea scheda "Mese 1 Ipertrofia" e assegnala all'atleta|
| 5. Vai su Profilo -> Esegui LOGOUT                                                |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| RUOLO 2: ALLIEVA (CLIENT)                                                         |
| 1. Schermata Login -> Inserisci Username ("giulia.bianchi...") e l'OTP             |
| 2. Accesso effettuato!                                                            |
| 3. Vai nella Tab "Gym":                                                           |
|    👉 ESEGUI IL GESTO "PULL-TO-REFRESH" (trascina la lista verso il basso)        |
|    👉 Compare lo spinner nativo e il toast verde "Dati sincronizzati con successo!"|
|    👉 La scheda "Mese 1 Ipertrofia" creata dal Trainer compare sul dispositivo!    |
| 4. Tocca la scheda ed esegui l'allenamento con il Live Logger (salva i kg e reps)  |
| 5. Vai su Profilo -> Esegui LOGOUT                                                |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| VERIFICA ARCHITETTURA DECOUPLED (ZERO DATA LOSS)                                  |
| 1. Rientra come Trainer (Lorenzo / admin123)                                      |
| 2. Seleziona la cliente "Giulia Bianchi" (o verifica lo Storico allenamenti)      |
| 3. Visualizza la sessione appena completata con i carichi sollevati               |
| 4. ELIMINA la scheda "Mese 1 Ipertrofia" dal pannello Schede                      |
| 5. Controlla la Tab "Storico":                                                    |
|    👉 I dati storici (kg, serie, ripetizioni, data, note) RIMANGONO AL 100%       |
|       INTATTI grazie allo schema Decoupled con snapshot immutabile!               |
+-----------------------------------------------------------------------------------+
```

---

## 5. DIAGNOSTICA & RISOLUZIONE PROBLEMI (TROUBLESHOOTING)

### 1. L'app mostra "Errore sconosciuto di rete" o timeout:
- **Causa**: Il firewall del computer blocca le connessioni in entrata sulla porta 8000 o lo smartphone non è sulla stessa rete Wi-Fi.
- **Soluzione su Linux**:
  ```bash
  # Verifica che la porta 8000 sia in ascolto
  sudo ss -tulpn | grep 8000
  # Se usi ufw:
  sudo ufw allow 8000/tcp
  # Se usi firewalld (es. AlmaLinux / Fedora):
  sudo firewall-cmd --add-port=8000/tcp --permanent
  sudo firewall-cmd --reload
  ```
- **Test da browser smartphone**: Apri Chrome o Safari sullo smartphone e visita `http://<IP_LAN>:8000/health`. Se la pagina risponde `{"status":"ok", ...}`, il collegamento di rete è perfetto!

### 2. Voglio resettare il database locale per ripartire da zero:
```bash
docker compose down -v
docker compose up -d db api
```
Il flag `-v` rimuove il volume persistente e al nuovo avvio lo script `migrate.ts` ricreerà lo schema pulito con i dati di seed predefiniti.

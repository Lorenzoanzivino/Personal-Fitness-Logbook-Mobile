import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';
import { getActiveRouteName, navigateSafely } from '../navigation/navigationRef';
import { useAuth } from '../context/AuthContext';

const APP_LOGO = require('../../assets/logo1.png');

interface HelpGuideInfo {
  title: string;
  badge: string;
  icon: string;
  description: string;
  tips: string[];
}

const SCREEN_HELP_DATA: Record<string, HelpGuideInfo> = {
  Home: {
    icon: '🏠',
    title: 'Dashboard Principale',
    badge: 'Panoramica',
    description: 'La tua panoramica giornaliera su allenamenti, stato di forma e progressioni.',
    tips: [
      'Visualizza il riepilogo settimanale e gli allenamenti completati.',
      'Avvia rapidamente l\'ultimo workout programmato.',
      'Controlla l\'andamento delle tue ultime misurazioni registrate.',
      'Tocca il logo col fulmine ⚡ in alto a sinistra in ogni momento per ritornare qui.',
    ],
  },
  Gym: {
    icon: '🏋️‍♂️',
    title: 'Area Workout & Schede',
    badge: 'Allenamento',
    description: 'Gestisci le tue schede, organizza le routine e avvia la registrazione in sala pesi.',
    tips: [
      'Seleziona una scheda e premi "Avvia Sessione" per registrare carichi e ripetizioni.',
      'Supporta tecniche speciali (Stripping, Rest-Pause) con doppio timer di recupero (intra-serie e tra serie).',
      'Per gli esercizi a corpo libero puoi impostare zavorre (+kg) o elastici di supporto (-kg).',
      'I Trainer possono alternare la vista personale con quella dei propri allievi.',
    ],
  },
  Measurements: {
    icon: '📏',
    title: 'Misure & Composizione Corporea',
    badge: 'Tracking Fisico',
    description: 'Monitora la tua trasformazione fisica attraverso misurazioni periodiche e grafici.',
    tips: [
      'Premi "+ Nuova Misura" per salvare peso corporeo, % massa grassa e circonferenze.',
      'Analizza i grafici temporali per valutare la crescita o la perdita di grasso.',
      'Consulta lo storico cronologico completo con i progressi registrati.',
    ],
  },
  Diet: {
    icon: '🥗',
    title: 'Piani Alimentari & Nutrizione',
    badge: 'Nutrizione PDF',
    description: 'Consulta i piani alimentari salvati e mantieni aggiornata la tua nutrizione.',
    tips: [
      'Premi "APRI DOCUMENTO PDF" per visualizzare la dieta con il lettore nativo di sistema.',
      'Tocca il titolo del piano per aprire il menu e Sostituire o Eliminare il file.',
      'Premi "+ Carica PDF" per aggiungere nuovi protocolli alimentari.',
      'Attiva vecchi piani passati direttamente dalla sezione Archivio.',
    ],
  },
  Profile: {
    icon: '👤',
    title: 'Profilo & Sincronizzazione',
    badge: 'Account Atleta',
    description: 'Gestione del profilo, credenziali e connessione tra Atleta e Trainer.',
    tips: [
      'Tocca l\'avatar per scegliere una foto: il salvataggio è immediato e automatico.',
      'Gli Atleti possono visualizzare e copiare il proprio Codice Cliente.',
      'I Trainer possono consultare il Codice OTP degli allievi toccando l\'icona info (i) per inviarlo nuovamente.',
      'Modifica altezza, data di nascita e livello di esperienza.',
    ],
  },
  Settings: {
    icon: '⚙️',
    title: 'Impostazioni Applicazione',
    badge: 'Configurazione',
    description: 'Preferenze globali di sistema, timer sonori e diagnostica.',
    tips: [
      'Configura volume e tipo di allarme al termine del countdown di recupero.',
      'Verifica la connettività di rete e lo stato della memoria locale AsyncStorage.',
      'Gestisci le notifiche e la cancellazione cache.',
    ],
  },
  WorkoutModal: {
    icon: '⏱️',
    title: 'Workout Live in Corso',
    badge: 'Sessione Attiva',
    description: 'Registrazione serie per serie del tuo allenamento in tempo reale.',
    tips: [
      'Inserisci carichi e reps; tocca la spunta verde per validare la serie e avviare il recupero.',
      'Allo scadere del timer, l\'allarme sonoro continua a suonare finché non premi "SPEGNI SVEGLIA".',
      'Le serie stripping e rest-pause gestiscono automaticamente recuperi intermedi e finali.',
      'Premi "✓ Salva & Concludi" a fondo pagina per registrare definitivamente la sessione.',
    ],
  },
  NewRoutineModal: {
    icon: '📝',
    title: 'Crea / Modifica Scheda',
    badge: 'Builder Schede',
    description: 'Costruisci un programma di allenamento definendo esercizi e parametri.',
    tips: [
      'Assegna un titolo identificativo e il target settimanale.',
      'Aggiungi esercizi impostando serie, ripetizioni e tempo di recupero consigliato.',
      'Salva la scheda per renderla disponibile nella sezione Gym.',
    ],
  },
  MeasurementModal: {
    icon: '⚖️',
    title: 'Nuovo Rilevamento Misure',
    badge: 'Check Fisico',
    description: 'Inserisci i parametri corporei per aggiornare la cronologia.',
    tips: [
      'Pesa te stesso preferibilmente al mattino a digiuno.',
      'Misura le circonferenze rilassate o in contrazione con metro da sarto.',
      'Salva per aggiornare immediatamente grafici e trend.',
    ],
  },
  UploadDietModal: {
    icon: '📤',
    title: 'Caricamento Nuovo PDF Dieta',
    badge: 'Documenti',
    description: 'Importa un file PDF dalla memoria del dispositivo.',
    tips: [
      'Seleziona il PDF rilasciato dal nutrizionista o preparatore.',
      'Assegna un nome al piano (es. "Dieta Massa 2026").',
      'Scegli se renderlo immediatamente il piano attivo dell\'applicazione.',
    ],
  },
  ExerciseModal: {
    icon: '🎬',
    title: 'Dettaglio & Tecnica Esercizio',
    badge: 'Guida Tecnica',
    description: 'Scheda biomeccanica dell\'esercizio con video e indicazioni posturali.',
    tips: [
      'Guarda il video tutorial o reel YouTube integrato.',
      'Leggi le note sul posizionamento e gli accorgimenti di sicurezza.',
      'Controlla i gruppi muscolari primari e secondari stimolati.',
    ],
  },
};

const DEFAULT_HELP: HelpGuideInfo = {
  icon: '💡',
  title: 'Guida di MY TRAIN UP',
  badge: 'Info',
  description: 'Applicazione completa per il tracciamento degli allenamenti in palestra, delle misurazioni corporee e dei piani alimentari.',
  tips: [
    'Usa la barra inferiore per navigare tra le sezioni principali (Home, Gym, Misure, Dieta, Profilo).',
    'Tutti i dati sono salvati localmente sul tuo dispositivo in modo sicuro.',
    'Premi l\'icona ℹ in qualsiasi schermata per consultare la guida contestualizzata.',
  ],
};

interface HeaderProps {
  title?: string;
  subtitle?: string;
  connected?: boolean;
  activeRouteName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'MY TRAIN UP',
  subtitle = 'Personal Gym Hub',
  connected = true,
  activeRouteName: routeProp,
}) => {
  const { logout } = useAuth();
  const [helpVisible, setHelpVisible] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<string>(routeProp || 'Home');

  const handleOpenHelp = () => {
    try {
      const detected = routeProp || getActiveRouteName();
      setCurrentRoute(detected);
    } catch {
      setCurrentRoute('Home');
    }
    setHelpVisible(true);
  };

  const handleLogout = () => {
    Alert.alert(
      'Disconnessione',
      'Sei sicuro di voler effettuare il logout dall\'applicazione?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Disconnetti',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (err) {
              console.warn('Errore durante il logout:', err);
            }
          },
        },
      ]
    );
  };

  const guide = SCREEN_HELP_DATA[currentRoute] || DEFAULT_HELP;

  const handlePressLogo = () => {
    try {
      navigateSafely('MainTabs', { screen: 'Home' });
    } catch {
      // Safe fallback
    }
  };

  return (
    <View style={styles.header}>
      <Pressable
        onPress={handlePressLogo}
        style={({ pressed }) => [
          styles.brandRow,
          { opacity: pressed ? 0.75 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Torna alla Home"
      >
        <View style={styles.logoBadge}>
          <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </Pressable>

      <View style={styles.rightContainer}>
        <View style={styles.statusBadge}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: connected ? colors.emerald : colors.danger },
            ]}
          />
          <Text style={styles.statusText}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </Text>
        </View>

        <Pressable
          onPress={handleOpenHelp}
          style={({ pressed }) => [
            styles.helpIconBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Guida e informazioni sulla schermata"
        >
          <Text style={styles.helpIconText}>ℹ</Text>
        </Pressable>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutIconBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Disconnetti account"
        >
          <Ionicons name="log-out-outline" size={17} color={colors.danger} />
        </Pressable>
      </View>

      {/* Help Modal */}
      <Modal
        transparent
        visible={helpVisible}
        animationType="fade"
        onRequestClose={() => setHelpVisible(false)}
      >
        <View style={styles.helpOverlay}>
          <View style={styles.helpCard}>
            {/* Modal Header */}
            <View style={styles.helpHeaderRow}>
              <View style={styles.helpHeaderLeft}>
                <Text style={styles.helpGuideIcon}>{guide.icon}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.helpBadge}>
                    <Text style={styles.helpBadgeText}>{guide.badge}</Text>
                  </View>
                  <Text style={styles.helpTitle} numberOfLines={1}>
                    {guide.title}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setHelpVisible(false)}
                style={({ pressed }) => [
                  styles.helpCloseBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Chiudi guida"
              >
                <Text style={styles.helpCloseBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Description */}
            <Text style={styles.helpDescription}>{guide.description}</Text>

            {/* Tips Section */}
            <ScrollView
              style={styles.helpScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              <Text style={styles.helpSectionHeading}>COSA PUOI FARE QUI:</Text>
              {guide.tips.map((tip, idx) => (
                <View key={idx} style={styles.helpTipRow}>
                  <Text style={styles.helpTipBullet}>✓</Text>
                  <Text style={styles.helpTipText}>{tip}</Text>
                </View>
              ))}
            </ScrollView>

            {/* Dismiss Button */}
            <Pressable
              onPress={() => setHelpVisible(false)}
              style={({ pressed }) => [
                styles.helpDismissBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Ho capito"
            >
              <Text style={styles.helpDismissBtnText}>HO CAPITO</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EA580F',
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  logoImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  titleContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  helpIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpIconText: {
    fontSize: 15,
    color: colors.accent,
    fontWeight: '800',
  },
  logoutIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  helpCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: colors.backgroundSolid,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  helpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  helpHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  helpGuideIcon: {
    fontSize: 28,
  },
  helpBadge: {
    backgroundColor: colors.accentMuted,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: 4,
  },
  helpBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  helpCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpCloseBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  helpDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  helpScroll: {
    maxHeight: 260,
    marginBottom: 16,
  },
  helpSectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  helpTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  helpTipBullet: {
    fontSize: 13,
    color: colors.emerald,
    fontWeight: '800',
    marginTop: 1,
  },
  helpTipText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    flex: 1,
  },
  helpDismissBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpDismissBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

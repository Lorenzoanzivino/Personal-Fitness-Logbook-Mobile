import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { CustomConfirmModal } from '../components/CustomConfirmModal';
import { profileService } from '../services/profileService';
import { apiService } from '../services/api';
import { UserProfile, UserRole, ClientAssociation } from '../types/profile';
import { GenerateOtpResponseDto } from '../types/api';
import { useAuth } from '../context/AuthContext';
import { useGym } from '../context/GymContext';
import { useMeasurements } from '../context/MeasurementContext';
import { useDiet } from '../context/DietContext';
import * as Clipboard from 'expo-clipboard';

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, role: authRole, logout, createClientAccount, provisionedClients } = useAuth();
  const { resetEntireApp, setSelectedClient } = useGym();
  const { clearAllMeasurements } = useMeasurements();
  const { clearAllDiets } = useDiet();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(profileService.getCurrentProfile());

  // Form State (Personal & Biometric)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // OTP & RBAC State
  const [otpLoading, setOtpLoading] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<GenerateOtpResponseDto | null>(null);
  const [clientOtpInput, setClientOtpInput] = useState('');
  const [linkingClient, setLinkingClient] = useState(false);

  // Client Provisioning Form State (Trainer only)
  const [newClientUsername, setNewClientUsername] = useState('');
  const [newClientFullName, setNewClientFullName] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [provisionSuccess, setProvisionSuccess] = useState<{
    username: string;
    otp: string;
  } | null>(null);

  // Selected Client Details Modal & OTP Retrieval (Trainer view)
  const [selectedClientInfo, setSelectedClientInfo] = useState<{
    client: ClientAssociation;
    username: string;
    otp: string;
  } | null>(null);

  // Overlay Feedback State (Opacifies the screen & displays centered banner)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const currentRole: UserRole = authRole || profile.role || 'CLIENT';

  useEffect(() => {
    loadProfile();
    const unsub = profileService.subscribe((p) => {
      setProfile(p);
    });
    return () => unsub();
  }, []);

  // Auto-dismiss overlay feedback banner after 2.8s
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => {
      setFeedback(null);
    }, 2800);
    return () => clearTimeout(timer);
  }, [feedback]);

  const loadProfile = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await profileService.getProfile();
      if (res.success && res.data) {
        setProfile(res.data);
        populateForm(res.data);
      } else {
        setFeedback({
          type: 'error',
          text: res.error?.message || 'Errore nel caricamento del profilo.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        text: 'Errore di connessione durante il caricamento del profilo.',
      });
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (data: UserProfile) => {
    setFirstName(data.first_name || user?.first_name || '');
    setLastName(data.last_name || user?.last_name || '');
    setBirthDate(data.birth_date || user?.birth_date || '');
    setHeightCm(data.height_cm ? String(data.height_cm) : user?.height_cm ? String(user.height_cm) : '');
    setAvatarUri(data.avatar_url || user?.avatar_url || null);
  };

  const validateForm = (): boolean => {
    if (!firstName.trim()) {
      setFeedback({ type: 'error', text: 'Il campo Nome è obbligatorio.' });
      return false;
    }

    if (!lastName.trim()) {
      setFeedback({ type: 'error', text: 'Il campo Cognome è obbligatorio.' });
      return false;
    }

    if (!birthDate.trim()) {
      setFeedback({ type: 'error', text: 'Il campo Data di Nascita è obbligatorio.' });
      return false;
    }

    // Validazione formato DD-MM-YYYY
    const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = birthDate.trim().match(dateRegex);
    if (!match) {
      setFeedback({
        type: 'error',
        text: 'La Data di Nascita deve essere nel formato DD-MM-YYYY (es. 15-05-1994).',
      });
      return false;
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1920 || year > 2026) {
      setFeedback({
        type: 'error',
        text: 'Data di Nascita non valida. Verifica giorno, mese e anno inseriti.',
      });
      return false;
    }

    const numHeight = parseFloat(heightCm);
    if (isNaN(numHeight) || numHeight < 50 || numHeight > 260) {
      setFeedback({
        type: 'error',
        text: "L'Altezza deve essere un numero valido in cm compreso tra 50 e 260.",
      });
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    setFeedback(null);

    const numHeight = parseFloat(heightCm);

    try {
      const res = await profileService.updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDate.trim(),
        height_cm: numHeight,
        avatar_url: avatarUri,
        role: currentRole,
      });

      if (res.success && res.data) {
        setProfile(res.data);
        populateForm(res.data);
        setFeedback({
          type: 'success',
          text: 'Profilo salvato con successo!',
        });
      } else {
        setFeedback({
          type: 'error',
          text: res.error?.message || 'Impossibile aggiornare il profilo.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        text: 'Errore durante il salvataggio del profilo.',
      });
    } finally {
      setSaving(false);
    }
  };

  // --- TRAINER LOGIC: PROVISIONING CLIENT ACCOUNT ---
  const handleCreateClientAccount = async () => {
    const cleanUsername = newClientUsername.trim();
    if (!cleanUsername) {
      setFeedback({ type: 'error', text: 'Inserisci uno Username per il nuovo cliente.' });
      return;
    }
    if (cleanUsername.length < 3) {
      setFeedback({ type: 'error', text: 'Lo Username deve contenere almeno 3 caratteri.' });
      return;
    }

    setIsCreatingClient(true);
    setFeedback(null);
    setProvisionSuccess(null);

    try {
      const res = await createClientAccount(
        cleanUsername,
        newClientFullName.trim() || undefined,
        newClientNotes.trim() || undefined
      );

      if (res.success && res.otp) {
        setProvisionSuccess({
          username: cleanUsername,
          otp: res.otp,
        });
        setFeedback({
          type: 'success',
          text: `Account per "${cleanUsername}" creato con successo! OTP d'accesso: ${res.otp}`,
        });
        setNewClientUsername('');
        setNewClientFullName('');
        setNewClientNotes('');
        await loadProfile();
      } else {
        setFeedback({
          type: 'error',
          text: res.error || 'Impossibile creare l\'account cliente.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Errore durante la creazione dell\'account.',
      });
    } finally {
      setIsCreatingClient(false);
    }
  };

  // --- TRAINER LOGIC: COPY OTP & OPEN CLIENT INFO ---
  const handleCopyOtp = async (otp: string, clientName: string) => {
    try {
      await Clipboard.setStringAsync(otp);
      setFeedback({
        type: 'success',
        text: `Codice OTP (${otp}) di ${clientName} copiato negli appunti!`,
      });
    } catch {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(otp);
        setFeedback({
          type: 'success',
          text: `Codice OTP (${otp}) di ${clientName} copiato negli appunti!`,
        });
      } else {
        setFeedback({
          type: 'error',
          text: 'Impossibile copiare il codice negli appunti.',
        });
      }
    }
  };

  const handleOpenClientInfo = (
    client: ClientAssociation,
    username: string,
    otp: string
  ) => {
    setSelectedClientInfo({ client, username, otp });
  };

  // --- LOGOUT LOGIC ---
  const handleLogoutConfirm = () => {
    setConfirmModal({
      visible: true,
      title: 'Disconnessione',
      message: 'Sei sicuro di voler effettuare il logout dall\'applicazione?',
      confirmText: 'Disconnetti',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, visible: false }));
        await logout();
      },
    });
  };

  // --- TRAINER LOGIC: OTP GENERATION ---
  const handleGenerateOtp = async () => {
    setOtpLoading(true);
    setFeedback(null);
    try {
      const trainerId = String(profile.id || 'trainer-marco-1');
      const trainerName = `${firstName.trim() || 'Marco'} ${lastName.trim() || 'Rossi'}`;
      const res = await apiService.generateTrainerOtp(trainerId, trainerName);
      if (res.success && res.data) {
        setGeneratedOtp(res.data);
        setFeedback({
          type: 'success',
          text: `Codice OTP Generato: ${res.data.code}. Condividilo con il tuo cliente per il pairing.`,
        });
      } else {
        setFeedback({
          type: 'error',
          text: res.error?.message || 'Errore durante la generazione dell\'OTP.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        text: 'Errore di connessione durante la generazione dell\'OTP.',
      });
    } finally {
      setOtpLoading(false);
    }
  };

  // --- TRAINER LOGIC: MANAGE CLIENT ROUTINES ---
  const handleManageClientRoutines = (client: ClientAssociation) => {
    setSelectedClient(client);
    navigation.navigate('Gym');
  };

  const handleRemoveClientConfirm = (client: ClientAssociation) => {
    setConfirmModal({
      visible: true,
      title: 'Rimuovi Cliente',
      message: `Sei sicuro di voler rimuovere ${client.name} dal tuo archivio clienti? Le sue schede rimarranno salvate.`,
      confirmText: 'Rimuovi',
      isDestructive: true,
      onConfirm: async () => {
        const updated = await profileService.removeClientFromTrainer(client.id);
        setProfile(updated);
        setConfirmModal((prev) => ({ ...prev, visible: false }));
        setFeedback({
          type: 'success',
          text: `Cliente ${client.name} rimosso dall'archivio.`,
        });
      },
    });
  };

  // --- CLIENT LOGIC: LINK WITH OTP ---
  const handleLinkClientWithOtp = async () => {
    const cleanCode = clientOtpInput.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setFeedback({
        type: 'error',
        text: 'Il codice OTP deve essere composto da esattamente 6 caratteri alfanumerici.',
      });
      return;
    }

    setLinkingClient(true);
    setFeedback(null);
    try {
      const clientId = String(profile.id || 'client-simona-1');
      const clientName = `${firstName.trim() || 'Atleta'} ${lastName.trim() || 'Fitness'}`;
      const res = await apiService.linkClientWithOtp({
        client_id: clientId,
        client_name: clientName,
        otp_code: cleanCode,
      });

      if (res.success && res.data) {
        const updated = await profileService.linkToTrainer(
          res.data.trainer.id,
          res.data.trainer.name
        );
        // Aggiunge anche alla lista del trainer
        await profileService.addClientToTrainer({
          id: clientId,
          name: clientName,
          email: profile.email || 'atleta@example.com',
          linked_at: new Date().toISOString(),
          notes: 'Cliente collegato tramite codice invito OTP',
        });

        setProfile(updated);
        setClientOtpInput('');
        setFeedback({
          type: 'success',
          text: `Account collegato con successo al Trainer: ${res.data.trainer.name}!`,
        });
      } else {
        setFeedback({
          type: 'error',
          text: res.error?.message || 'Codice OTP non valido o scaduto.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        text: 'Errore di connessione durante la verifica del codice OTP.',
      });
    } finally {
      setLinkingClient(false);
    }
  };

  const handleUnlinkTrainerConfirm = () => {
    setConfirmModal({
      visible: true,
      title: 'Scollega Personal Trainer',
      message: 'Vuoi scollegare il tuo account dal tuo Trainer? Non riceverai più le nuove schede sincronizzate.',
      confirmText: 'Scollega',
      isDestructive: true,
      onConfirm: async () => {
        const updated = await profileService.unlinkTrainer();
        setProfile(updated);
        setConfirmModal((prev) => ({ ...prev, visible: false }));
        setFeedback({
          type: 'success',
          text: 'Personal Trainer scollegato. Ora puoi inserire un nuovo codice OTP.',
        });
      },
    });
  };

  // --- DANGER RESET LOGIC ---
  const handleResetAppConfirm = () => {
    setConfirmModal({
      visible: true,
      title: 'Reset Totale Applicazione',
      message:
        'ATTENZIONE: Questa azione eliminerà DEFINITIVAMENTE tutti i dati: profilo utente, catalogo schede, storico workout, pesate e diete.\n\nQuesta operazione non è reversibile. Vuoi procedere?',
      confirmText: 'Svuota Tutto',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await resetEntireApp();
          await clearAllMeasurements();
          await clearAllDiets();
          await profileService.resetProfile();
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          setFeedback({
            type: 'success',
            text: 'Applicazione ripristinata con successo ai valori iniziali.',
          });
          loadProfile();
        } catch {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          setFeedback({
            type: 'error',
            text: 'Errore durante il reset dell\'applicazione.',
          });
        }
      },
    });
  };

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || 'Atleta';
  const clientsList = profile.clients || [];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={[typography.caption, { marginTop: 12 }]}>
          Caricamento dati profilo...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={typography.caption}>IMPOSTAZIONI PERSONALI & RUOLO</Text>
          <Text style={typography.h1}>Profilo Utente</Text>
        </View>

        {/* Avatar Component */}
        <Avatar
          imageUri={avatarUri}
          name={fullName}
          size={104}
          editable={true}
          onImageSelected={(uri) => {
            setAvatarUri(uri);
            setFeedback({
              type: 'success',
              text: 'Nuova immagine avatar selezionata. Clicca su Salva per confermare.',
            });
          }}
        />

        {/* ========================================================= */}
        {/* SEZIONE 1: RUOLO BLOCCATO (AUTHENTICATED RBAC)           */}
        {/* ========================================================= */}
        <Card style={styles.roleCard}>
          <View style={styles.roleHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.caption}>AUTENTICAZIONE & RUOLO ATTIVO</Text>
              <Text style={typography.h3}>Accesso Verificato</Text>
            </View>
            <View
              style={[
                styles.roleBadge,
                currentRole === 'TRAINER' ? styles.roleBadgeTrainer : styles.roleBadgeClient,
              ]}
            >
              <Text style={styles.roleBadgeText}>
                {currentRole === 'TRAINER' ? '🏋️ PERSONAL TRAINER (Admin)' : '🏃 ATLETA / CLIENTE'}
              </Text>
            </View>
          </View>

          <Text style={styles.roleExplanation}>
            {currentRole === 'TRAINER'
              ? `Accesso Master confermato per @${user?.username || 'LorenzoAnzivino'}. Creazione schede autonome e in delega per gli atleti, registrazione clienti e gestione catalogo.`
              : `Accesso Atleta confermato per @${user?.username || 'Cliente'}. Schede sincronizzate e Live Logger protetto. I permessi di configurazione sono gestiti dal tuo Personal Trainer.`}
          </Text>

          <View style={styles.accountMetaRow}>
            <Text style={styles.accountMetaText}>
              Account attivo: <Text style={{ fontWeight: '700', color: colors.text }}>@{user?.username || (currentRole === 'TRAINER' ? 'LorenzoAnzivino' : 'Cliente')}</Text>
            </Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>● Sessione Autenticata</Text>
            </View>
          </View>
        </Card>

        {/* ========================================================= */}
        {/* SEZIONE 2A: VISTA TRAINER (ARCHIVIO & PROVISIONING OTP)   */}
        {/* ========================================================= */}
        {currentRole === 'TRAINER' && (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.caption}>PROVISIONING ATLETI</Text>
                <Text style={typography.h3}>Nuovo Account Cliente (OTP)</Text>
              </View>
            </View>

            <Text style={styles.provisionDesc}>
              Crea un account per un nuovo atleta specificando lo Username. Il sistema assegnerà un codice
              OTP d'accesso (password) che l'atleta userà per effettuare il login.
            </Text>

            <View style={styles.provisionForm}>
              <View style={styles.provisionInputGroup}>
                <Text style={styles.inputLabel}>USERNAME CLIENTE *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newClientUsername}
                  onChangeText={setNewClientUsername}
                  placeholder="es. Simona"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.provisionInputGroup}>
                <Text style={styles.inputLabel}>NOME E COGNOME (Opzionale)</Text>
                <TextInput
                  style={styles.textInput}
                  value={newClientFullName}
                  onChangeText={setNewClientFullName}
                  placeholder="es. Simona Bianchi"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.provisionInputGroup}>
                <Text style={styles.inputLabel}>OBIETTIVO / NOTE (Opzionale)</Text>
                <TextInput
                  style={styles.textInput}
                  value={newClientNotes}
                  onChangeText={setNewClientNotes}
                  placeholder="es. Tonificazione & Ricomposizione 3x/settimana"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <Pressable
                onPress={handleCreateClientAccount}
                disabled={isCreatingClient}
                style={({ pressed }) => [
                  styles.createClientBtn,
                  { opacity: pressed || isCreatingClient ? 0.8 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Crea account cliente e genera OTP"
              >
                {isCreatingClient ? (
                  <ActivityIndicator color="#0F172A" size="small" />
                ) : (
                  <Text style={styles.createClientBtnText}>✨ Crea Account e Genera OTP</Text>
                )}
              </Pressable>
            </View>

            {/* Risultato Provisioning con OTP Evidente */}
            {provisionSuccess && (
              <View style={styles.otpSuccessBox}>
                <View style={styles.otpSuccessHeader}>
                  <Text style={styles.otpSuccessTitle}>🎉 ACCOUNT PRONTO AL LOGIN</Text>
                  <Text style={styles.otpSuccessPill}>CREDENZIALI GENERATE</Text>
                </View>
                <Text style={styles.otpSuccessDesc}>
                  Comunica queste credenziali al tuo cliente per consentirgli di accedere:
                </Text>
                <View style={styles.credentialsRow}>
                  <View style={styles.credentialField}>
                    <Text style={styles.credentialLabel}>USERNAME:</Text>
                    <Text style={styles.credentialValue}>@{provisionSuccess.username}</Text>
                  </View>
                  <View style={styles.credentialField}>
                    <Text style={styles.credentialLabel}>PASSWORD / OTP:</Text>
                    <Text style={styles.credentialValueOtp}>{provisionSuccess.otp}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Sezione Archivio Clienti Esistenti */}
            <View style={styles.clientsArchiveHeader}>
              <Text style={styles.subSectionTitle}>
                Archivio Clienti ({clientsList.length})
              </Text>
              <Pressable
                onPress={handleGenerateOtp}
                disabled={otpLoading}
                style={({ pressed }) => [
                  styles.quickOtpBtn,
                  { opacity: pressed || otpLoading ? 0.8 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Genera codice invito OTP rapido"
              >
                {otpLoading ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <Text style={styles.quickOtpBtnText}>🔑 Genera OTP Invito</Text>
                )}
              </Pressable>
            </View>

            {/* Banner Codice OTP Generato */}
            {generatedOtp && (
              <View style={styles.otpResultBox}>
                <View style={styles.otpResultTop}>
                  <Text style={styles.otpResultLabel}>CODICE DI INVITO RAPIDO:</Text>
                  <Text style={styles.otpResultExpires}>Valido 30 min</Text>
                </View>
                <Text style={styles.otpResultCode}>{generatedOtp.code}</Text>
                <Text style={styles.otpResultDesc}>
                  Fornisci questo codice al tuo cliente per abbinare un account esistente.
                </Text>
              </View>
            )}

            {clientsList.length === 0 ? (
              <View style={styles.emptyClientsBox}>
                <Text style={styles.emptyClientsText}>
                  Nessun cliente associato al momento. Usa il form sopra per registrare il tuo primo allievo.
                </Text>
              </View>
            ) : (
              clientsList.map((client) => {
                const provInfo = provisionedClients.find(
                  (p) =>
                    p.id === client.id ||
                    p.username.toLowerCase() === client.name.toLowerCase() ||
                    client.name.toLowerCase().includes(p.username.toLowerCase())
                );
                const clientOtp =
                  provInfo?.otp ||
                  (client.id === 'client-simona-1'
                    ? 'OTP123'
                    : client.id === 'client-luca-2'
                    ? 'OTP456'
                    : 'OTP123');
                const clientUsername =
                  provInfo?.username || client.name.split(' ')[0] || 'Cliente';

                return (
                  <View key={client.id} style={styles.clientCard}>
                    <View style={styles.clientAvatarMini}>
                      <Text style={styles.clientAvatarText}>
                        {client.name.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.clientInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.clientName}>{client.name}</Text>
                        <View style={styles.provPill}>
                          <Text style={styles.provPillText}>@{clientUsername}</Text>
                        </View>
                      </View>

                      {/* OTP Row with Direct Copy Button */}
                      <View style={styles.clientOtpRow}>
                        <Text style={styles.clientOtpCred}>
                          OTP: <Text style={styles.clientOtpValue}>{clientOtp}</Text>
                        </Text>
                        <Pressable
                          onPress={() => handleCopyOtp(clientOtp, client.name)}
                          style={({ pressed }) => [
                            styles.quickCopyOtpBtn,
                            { opacity: pressed ? 0.75 : 1 },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Copia codice OTP di ${client.name}`}
                        >
                          <Text style={styles.quickCopyOtpText}>📋 Copia</Text>
                        </Pressable>
                      </View>

                      {client.email && <Text style={styles.clientEmail}>{client.email}</Text>}
                      {client.notes && <Text style={styles.clientNotes}>{client.notes}</Text>}
                      <Text style={styles.clientDate}>
                        Registrato: {new Date(client.linked_at).toLocaleDateString('it-IT')}
                      </Text>
                    </View>

                    <View style={styles.clientActions}>
                      <Pressable
                        onPress={() => handleOpenClientInfo(client, clientUsername, clientOtp)}
                        style={styles.clientInfoBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Dettagli e credenziali di ${client.name}`}
                      >
                        <Text style={styles.clientInfoBtnText}>ℹ️ Info</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleManageClientRoutines(client)}
                        style={styles.manageRoutinesBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Gestisci schede di ${client.name}`}
                      >
                        <Text style={styles.manageRoutinesBtnText}>🏋️ Schede</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleRemoveClientConfirm(client)}
                        style={styles.removeClientBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Rimuovi ${client.name}`}
                      >
                        <Text style={styles.removeClientBtnText}>🗑</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        )}

        {/* ========================================================= */}
        {/* SEZIONE 2B: VISTA CLIENTE (CONNESSIONE OTP CON IL TRAINER) */}
        {/* ========================================================= */}
        {currentRole === 'CLIENT' && (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.caption}>SINCRONIZZAZIONE PALESTRA</Text>
                <Text style={typography.h3}>Personal Trainer Collegato</Text>
              </View>
            </View>

            {profile.trainer_name ? (
              <View style={styles.linkedTrainerBox}>
                <View style={styles.trainerHeaderRow}>
                  <View style={styles.trainerIconCircle}>
                    <Text style={{ fontSize: 20 }}>🏋️</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trainerNameText}>{profile.trainer_name}</Text>
                    <Text style={styles.trainerSubtext}>Personal Trainer Ufficiale</Text>
                  </View>
                  <View style={styles.syncedBadge}>
                    <Text style={styles.syncedBadgeText}>● Sincronizzato</Text>
                  </View>
                </View>
                <Text style={styles.trainerDesc}>
                  Le tue schede di allenamento vengono configurate e aggiornate dal tuo Trainer.
                  Nella sezione Gym trovi i mesocicli pronti da avviare con il Live Logger.
                </Text>
                <Pressable
                  onPress={handleUnlinkTrainerConfirm}
                  style={styles.unlinkBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Scollega Personal Trainer"
                >
                  <Text style={styles.unlinkBtnText}>Scollega Trainer</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.otpInputBox}>
                <Text style={styles.otpInputLabel}>INSERISCI CODICE TRAINER (OTP)</Text>
                <Text style={styles.otpInputDesc}>
                  Inserisci il codice di 6 caratteri generato dal tuo Personal Trainer per collegare
                  l'account e scaricare le tue schede personalizzate.
                </Text>
                <View style={styles.otpInputRow}>
                  <TextInput
                    style={styles.otpTextInput}
                    value={clientOtpInput}
                    onChangeText={(val) => setClientOtpInput(val.toUpperCase())}
                    placeholder="es. TRN892"
                    placeholderTextColor={colors.textMuted}
                    maxLength={6}
                    autoCapitalize="characters"
                  />
                  <Pressable
                    onPress={handleLinkClientWithOtp}
                    disabled={linkingClient || clientOtpInput.trim().length !== 6}
                    style={({ pressed }) => [
                      styles.linkOtpBtn,
                      (linkingClient || clientOtpInput.trim().length !== 6) && styles.disabledBtn,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Collega codice OTP"
                  >
                    {linkingClient ? (
                      <ActivityIndicator color="#0F172A" size="small" />
                    ) : (
                      <Text style={styles.linkOtpBtnText}>Collega Account</Text>
                    )}
                  </Pressable>
                </View>
                <Text style={styles.otpHelperText}>
                  💡 Suggerimento demo: puoi testare subito il pairing inserendo il codice{' '}
                  <Text style={{ fontWeight: '700', color: colors.accent }}>TRN892</Text> o generando un OTP come Trainer.
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* ========================================================= */}
        {/* SEZIONE 3: DATI ANAGRAFICI & BIOMETRICI                   */}
        {/* ========================================================= */}
        <Card style={styles.formCard}>
          <Text style={[typography.h3, { marginBottom: 16 }]}>
            Dati Anagrafici & Biometrici
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NOME *</Text>
            <TextInput
              style={styles.textInput}
              value={firstName}
              onChangeText={(val) => {
                setFirstName(val);
                if (feedback) setFeedback(null);
              }}
              placeholder="es. Marco"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>COGNOME *</Text>
            <TextInput
              style={styles.textInput}
              value={lastName}
              onChangeText={(val) => {
                setLastName(val);
                if (feedback) setFeedback(null);
              }}
              placeholder="es. Rossi"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DATA DI NASCITA (DD-MM-YYYY) *</Text>
            <TextInput
              style={styles.textInput}
              value={birthDate}
              onChangeText={(val) => {
                setBirthDate(val);
                if (feedback) setFeedback(null);
              }}
              placeholder="es. 15-05-1994"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            <Text style={styles.fieldHint}>Formato richiesto: giorno-mese-anno (10 caratteri)</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>ALTEZZA (CM) *</Text>
            <TextInput
              style={styles.textInput}
              value={heightCm}
              onChangeText={(val) => {
                setHeightCm(val);
                if (feedback) setFeedback(null);
              }}
              placeholder="es. 180"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            <Text style={styles.fieldHint}>Utilizzata per il calcolo automatico del BMI</Text>
          </View>
        </Card>

        {/* Salva Pulsante Ergonomico */}
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            { opacity: pressed || saving ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Salva modifiche profilo"
        >
          {saving ? (
            <ActivityIndicator color="#0F172A" />
          ) : (
            <Text style={styles.saveButtonText}>SALVA MODIFICHE PROFILO</Text>
          )}
        </Pressable>

        {/* ========================================================= */}
        {/* SEZIONE 4: DISCONNETTI ACCOUNT (LOGOUT)                   */}
        {/* ========================================================= */}
        <Card style={styles.logoutCard}>
          <Text style={styles.logoutTitle}>Disconnessione Account</Text>
          <Text style={styles.logoutDesc}>
            Vuoi cambiare utente o accedere con altre credenziali? Puoi effettuare la disconnessione
            in qualsiasi momento.
          </Text>
          <Pressable
            onPress={handleLogoutConfirm}
            style={styles.logoutButton}
            accessibilityRole="button"
            accessibilityLabel="Disconnetti dall'applicazione"
          >
            <Text style={styles.logoutButtonText}>🚪 DISCONNETTI (LOGOUT)</Text>
          </Pressable>
        </Card>

        {/* Danger Zone: Reset Totale Applicazione */}
        <Card style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>⚠️ Zona di Pericolo: Reset Completo</Text>
          <Text style={styles.dangerDesc}>
            Se desideri ripartire da zero o cancellare ogni dato memorizzato sul dispositivo, puoi
            eseguire un reset totale. Verranno eliminati: il profilo atleta, tutte le schede di
            allenamento create, lo storico completo delle sessioni e tutte le cartelle salvate.
          </Text>
          <Pressable
            onPress={handleResetAppConfirm}
            style={styles.dangerButton}
            accessibilityRole="button"
            accessibilityLabel="Cancella tutti i dati dell'applicazione"
          >
            <Text style={styles.dangerButtonText}>SVUOTA TUTTO & RESET COMPLETO</Text>
          </Pressable>
        </Card>
      </ScrollView>

      {/* Confirmation Modal */}
      <CustomConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
      />

      {/* Opacity Overlay Modal for Profile Changes / Feedback */}
      <Modal
        visible={Boolean(feedback)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFeedback(null)}
      >
        <Pressable
          style={styles.feedbackOverlay}
          onPress={() => setFeedback(null)}
          accessibilityRole="button"
          accessibilityLabel="Chiudi notifica"
        >
          <Pressable
            style={[
              styles.feedbackCard,
              feedback?.type === 'success'
                ? styles.feedbackCardSuccess
                : styles.feedbackCardError,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Status Icon */}
            <View
              style={[
                styles.feedbackIconCircle,
                feedback?.type === 'success'
                  ? styles.feedbackIconCircleSuccess
                  : styles.feedbackIconCircleError,
              ]}
            >
              <Text
                style={[
                  styles.feedbackIconText,
                  {
                    color:
                      feedback?.type === 'success'
                        ? colors.emerald
                        : colors.danger,
                  },
                ]}
              >
                {feedback?.type === 'success' ? '✓' : '⚠'}
              </Text>
            </View>

            {/* Content Text */}
            <View style={styles.feedbackContent}>
              <Text
                style={[
                  styles.feedbackTag,
                  {
                    color:
                      feedback?.type === 'success'
                        ? colors.emerald
                        : colors.danger,
                  },
                ]}
              >
                {feedback?.type === 'success' ? 'MODIFICA COMPLETATA' : 'ATTENZIONE'}
              </Text>
              <Text style={styles.feedbackMessage}>{feedback?.text}</Text>
              <Text style={styles.feedbackAutoDismissHint}>
                Tocca per chiudere
              </Text>
            </View>

            {/* Dismiss Button */}
            <Pressable
              onPress={() => setFeedback(null)}
              style={styles.feedbackCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Chiudi banner notifica"
            >
              <Text style={styles.feedbackCloseBtnText}>✕</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Client Info & Credentials Modal (Trainer view) */}
      {selectedClientInfo && (
        <Modal
          visible={Boolean(selectedClientInfo)}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedClientInfo(null)}
        >
          <Pressable
            style={styles.infoModalOverlay}
            onPress={() => setSelectedClientInfo(null)}
            accessibilityRole="button"
            accessibilityLabel="Chiudi modale informazioni"
          >
            <Pressable
              style={styles.infoModalCard}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <View style={styles.infoModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoModalTag}>SCHEDA ATLETA & CREDENZIALI</Text>
                  <Text style={styles.infoModalTitle}>
                    {selectedClientInfo.client.name}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSelectedClientInfo(null)}
                  style={styles.infoModalCloseBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Chiudi"
                >
                  <Text style={styles.infoModalCloseText}>✕</Text>
                </Pressable>
              </View>

              {/* Body */}
              <View style={styles.infoModalBody}>
                {/* Account Details */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>USERNAME D'ACCESSO:</Text>
                  <Text style={styles.infoValueHighlight}>
                    @{selectedClientInfo.username}
                  </Text>
                </View>

                {selectedClientInfo.client.email ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>EMAIL:</Text>
                    <Text style={styles.infoValue}>
                      {selectedClientInfo.client.email}
                    </Text>
                  </View>
                ) : null}

                {selectedClientInfo.client.notes ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>NOTE & OBIETTIVO:</Text>
                    <Text style={styles.infoValue}>
                      {selectedClientInfo.client.notes}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>COLLEGATO DAL:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(selectedClientInfo.client.linked_at).toLocaleDateString('it-IT')}
                  </Text>
                </View>

                {/* OTP Credential Box */}
                <View style={styles.infoOtpBox}>
                  <View style={styles.infoOtpTop}>
                    <Text style={styles.infoOtpLabel}>CODICE OTP D'ACCESSO (PASSWORD):</Text>
                    <View style={styles.infoOtpStatusPill}>
                      <Text style={styles.infoOtpStatusText}>● Attivo</Text>
                    </View>
                  </View>
                  <Text style={styles.infoOtpCode}>{selectedClientInfo.otp}</Text>
                  <Text style={styles.infoOtpDesc}>
                    Se il cliente si è disconnesso o non ricorda la password, ricopia questo
                    codice e inviaglielo per consentirgli di accedere come Atleta.
                  </Text>
                </View>

                {/* Big Copy Button */}
                <Pressable
                  onPress={() => {
                    handleCopyOtp(selectedClientInfo.otp, selectedClientInfo.client.name);
                    setSelectedClientInfo(null);
                  }}
                  style={({ pressed }) => [
                    styles.copyOtpBigBtn,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Copia codice OTP negli appunti"
                >
                  <Text style={styles.copyOtpBigBtnText}>📋 COPIA CODICE OTP</Text>
                </Pressable>

                {/* Manage Routines Button */}
                <Pressable
                  onPress={() => {
                    const client = selectedClientInfo.client;
                    setSelectedClientInfo(null);
                    handleManageClientRoutines(client);
                  }}
                  style={styles.manageFromModalBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Vai alle schede dell'atleta"
                >
                  <Text style={styles.manageFromModalBtnText}>
                    🏋️ Vai alle Schede di {selectedClientInfo.client.name}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 96,
  },
  header: {
    marginBottom: 8,
  },
  // Feedback Opacity Overlay
  feedbackOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  feedbackCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  feedbackCardSuccess: {
    borderColor: colors.emerald,
    backgroundColor: '#10221E',
  },
  feedbackCardError: {
    borderColor: colors.danger,
    backgroundColor: '#26171E',
  },
  feedbackIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  feedbackIconCircleSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: colors.emerald,
  },
  feedbackIconCircleError: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  feedbackIconText: {
    fontSize: 20,
    fontWeight: '900',
  },
  feedbackContent: {
    flex: 1,
  },
  feedbackTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  feedbackMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  feedbackAutoDismissHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  feedbackCloseBtn: {
    padding: 6,
    marginLeft: 8,
  },
  feedbackCloseBtnText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '700',
  },

  // Role Switcher Card
  roleCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeTrainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  roleBadgeClient: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: colors.emerald,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  roleExplanation: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  accountMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accountMetaText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.emerald,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.emerald,
  },

  // Trainer Provisioning Form
  provisionDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  provisionForm: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  provisionInputGroup: {
    marginBottom: 10,
  },
  createClientBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    minHeight: layout.minTouchTarget,
  },
  createClientBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Provisioning Result Box
  otpSuccessBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.emerald,
    padding: 14,
    marginBottom: 16,
  },
  otpSuccessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  otpSuccessTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.emerald,
    letterSpacing: 0.5,
  },
  otpSuccessPill: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.emerald,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  otpSuccessDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  credentialsRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  credentialField: {
    flex: 1,
  },
  credentialLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  credentialValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  credentialValueOtp: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.accent,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },

  // Clients Archive Section
  clientsArchiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickOtpBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickOtpBtnText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  provPill: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  provPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  clientOtpCred: {
    fontSize: 11,
    color: colors.textMuted,
  },
  clientOtpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  clientOtpValue: {
    fontFamily: 'monospace',
    fontWeight: '800',
    color: colors.accent,
    fontSize: 13,
    letterSpacing: 1,
  },
  quickCopyOtpBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickCopyOtpText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },

  // Section Cards (Trainer & Client)
  sectionCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },

  // Trainer OTP Box
  otpGenerateBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpGenerateBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
  },
  otpResultBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  otpResultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  otpResultLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  otpResultExpires: {
    fontSize: 11,
    color: colors.textMuted,
  },
  otpResultCode: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 4,
    marginVertical: 4,
    fontFamily: 'monospace',
  },
  otpResultDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Client Cards
  emptyClientsBox: {
    padding: 16,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyClientsText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clientAvatarMini: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  clientAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  clientEmail: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  clientNotes: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  clientDate: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  clientActions: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 8,
  },
  clientInfoBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  clientInfoBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  manageRoutinesBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  manageRoutinesBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  removeClientBtn: {
    padding: 4,
  },
  removeClientBtnText: {
    fontSize: 16,
    color: colors.danger,
  },

  // Client OTP Link Box
  linkedTrainerBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.emerald,
    padding: 14,
  },
  trainerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trainerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  trainerNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  trainerSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  syncedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  syncedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.emerald,
  },
  trainerDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: 12,
  },
  unlinkBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  unlinkBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },

  otpInputBox: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  otpInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  otpInputDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 12,
  },
  otpInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  otpTextInput: {
    flex: 1,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  linkOtpBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: layout.minTouchTarget,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  linkOtpBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  otpHelperText: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },

  // Form Card
  formCard: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    minHeight: layout.minTouchTarget,
  },
  fieldHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    minHeight: layout.minTouchTarget,
  },
  saveButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Logout Card
  logoutCard: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  logoutDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.minTouchTarget,
  },
  logoutButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Danger Card
  dangerCard: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
    marginBottom: 16,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.danger,
    marginBottom: 8,
  },
  dangerDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  dangerButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.minTouchTarget,
  },
  dangerButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Client Info & Credentials Modal
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  infoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundSubtle,
  },
  infoModalTag: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  infoModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  infoModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoModalCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  infoModalBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  infoValueHighlight: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  infoOtpBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 14,
    marginTop: 14,
    marginBottom: 14,
    alignItems: 'center',
  },
  infoOtpTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 6,
  },
  infoOtpLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  infoOtpStatusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  infoOtpStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.emerald,
  },
  infoOtpCode: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.accent,
    fontFamily: 'monospace',
    letterSpacing: 4,
    marginVertical: 4,
  },
  infoOtpDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
  copyOtpBigBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    minHeight: layout.minTouchTarget,
  },
  copyOtpBigBtnText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  manageFromModalBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageFromModalBtnText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});

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
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { CustomConfirmModal } from '../components/CustomConfirmModal';
import { ScreenBackgroundWrapper } from '../components/ScreenBackgroundWrapper';
import { profileService } from '../services/profileService';
import { TRAINER_CONFIG } from '../services/config';
import { UserProfile, UserRole } from '../types/profile';
import { useAuth } from '../context/AuthContext';

export const ProfileScreen: React.FC = () => {
  const { user, role: authRole, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(profileService.getCurrentProfile());

  // Form State (Personal & Biometric)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

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
  }, [user?.id]);

  // Auto-dismiss overlay feedback banner after 2.5s
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => {
      setFeedback(null);
    }, 2500);
    return () => clearTimeout(timer);
  }, [feedback]);

  const loadProfile = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const activeUserId = String(user?.id || profile.id || 'trainer-1');
      const userAvatar = await profileService.getUserAvatar(activeUserId);
      const res = await profileService.getProfile();
      if (res.success && res.data) {
        const combined: UserProfile = {
          ...res.data,
          avatar_url: userAvatar !== null ? userAvatar : res.data.avatar_url,
        };
        setProfile(combined);
        populateForm(combined);
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
    const activeUserId = String(user?.id || profile?.id || 'trainer-1');

    try {
      if (avatarUri !== undefined) {
        await profileService.setUserAvatar(activeUserId, avatarUri);
      }
      const res = await profileService.updateProfile({
        id: activeUserId,
        username: user?.username || profile?.username,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDate.trim(),
        height_cm: numHeight,
        avatar_url: avatarUri,
        role: currentRole,
        trainer_id: user?.trainer_id || profile?.trainer_id,
        trainer_name: user?.trainer_name || profile?.trainer_name,
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

  const handleAvatarSelected = async (newUri: string) => {
    setAvatarUri(newUri);
    setSaving(true);
    setFeedback(null);
    const activeUserId = String(user?.id || profile?.id || 'trainer-1');
    try {
      await profileService.setUserAvatar(activeUserId, newUri);
      const numHeight = parseFloat(heightCm) || profile?.height_cm || 175;
      const res = await profileService.updateProfile({
        id: activeUserId,
        first_name: firstName.trim() || profile?.first_name || 'Utente',
        last_name: lastName.trim() || profile?.last_name || '',
        birth_date: birthDate.trim() || profile?.birth_date || '01-01-2000',
        height_cm: numHeight,
        avatar_url: newUri,
        role: currentRole,
      });
      if (res.success && res.data) {
        setProfile(res.data);
        setFeedback({
          type: 'success',
          text: 'Nuovo avatar salvato con successo!',
        });
      } else {
        setFeedback({
          type: 'error',
          text: res.error?.message || 'Impossibile salvare il nuovo avatar.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        text: 'Errore durante il salvataggio automatico dell\'avatar.',
      });
    } finally {
      setSaving(false);
    }
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

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || 'Atleta';

  const assignedTrainerName =
    user?.trainer_name ||
    profile.trainer_name ||
    `${TRAINER_CONFIG.firstName} ${TRAINER_CONFIG.lastName}`;

  const realFullName =
    `${(user?.first_name || profile.first_name || firstName || '').trim()} ${(user?.last_name || profile.last_name || lastName || '').trim()}`.trim() || 'Atleta';

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
    <ScreenBackgroundWrapper style={styles.container}>
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
          onImageSelected={handleAvatarSelected}
        />

        {/* ========================================================= */}
        {/* SEZIONE 1: RUOLO BLOCCATO (AUTHENTICATED RBAC)           */}
        {/* ========================================================= */}
        {currentRole === 'CLIENT' ? (
          <Card style={styles.clientBannerCard}>
            <View style={styles.roleHeaderRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={typography.caption}>AUTENTICAZIONE E RUOLO</Text>
                <Text style={styles.clientRealName}>{realFullName}</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>✓ Accesso Verificato</Text>
              </View>
            </View>

            <View style={styles.trainerAssignedBox}>
              <Text style={styles.trainerLabel}>
                Trainer: <Text style={styles.trainerNameHighlight}>{assignedTrainerName}</Text>
              </Text>
            </View>

            <Text style={styles.roleExplanation}>
              Accesso Atleta confermato per @{user?.username || profile.username || 'Cliente'}. Schede di allenamento e dati biometrici sincronizzati.
            </Text>

            <View style={styles.accountMetaRow}>
              <Text style={styles.accountMetaText}>
                Username: <Text style={{ fontWeight: '700', color: colors.text }}>@{user?.username || profile.username || 'Cliente'}</Text>
              </Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>● Sessione Attiva</Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card style={styles.roleCard}>
            <View style={styles.roleHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.caption}>AUTENTICAZIONE & RUOLO ATTIVO</Text>
                <Text style={typography.h3}>Accesso Verificato</Text>
              </View>
              <View
                style={[
                  styles.roleBadge,
                  styles.roleBadgeTrainer,
                ]}
              >
                <Text style={styles.roleBadgeText}>
                  🏋️ PERSONAL TRAINER (Admin)
                </Text>
              </View>
            </View>

            <Text style={styles.roleExplanation}>
              Accesso Master confermato per @{user?.username || 'trainer'}. Creazione schede autonome e in delega per gli atleti, registrazione clienti e gestione catalogo.
            </Text>

            <View style={styles.accountMetaRow}>
              <Text style={styles.accountMetaText}>
                Account attivo: <Text style={{ fontWeight: '700', color: colors.text }}>@{user?.username || 'trainer'}</Text>
              </Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>● Sessione Autenticata</Text>
              </View>
            </View>
          </Card>
        )}

        {/* ========================================================= */}
        {/* SEZIONE 2: DATI ANAGRAFICI & BIOMETRICI                   */}
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
        {/* SEZIONE 3: DISCONNETTI ACCOUNT (LOGOUT)                   */}
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
    </ScreenBackgroundWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
    padding: 14,
    paddingBottom: 140,
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

  // Client Verified Banner
  clientBannerCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: colors.surface,
  },
  clientRealName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: colors.emerald,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  verifiedBadgeText: {
    color: colors.emerald,
    fontSize: 11,
    fontWeight: '800',
  },
  trainerAssignedBox: {
    backgroundColor: colors.backgroundElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  trainerLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  trainerNameHighlight: {
    color: colors.accent,
    fontWeight: '800',
  },

  // Role Card
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
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
  },
  roleExplanation: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  accountMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accountMetaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.emerald,
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
});

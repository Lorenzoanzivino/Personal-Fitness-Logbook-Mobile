import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { CustomConfirmModal } from '../components/CustomConfirmModal';
import { profileService } from '../services/profileService';
import { UserProfile, UpdateProfileRequestDto } from '../types/profile';
import { useGym } from '../context/GymContext';
import { useMeasurements } from '../context/MeasurementContext';
import { useDiet } from '../context/DietContext';

export const ProfileScreen: React.FC = () => {
  const { resetEntireApp } = useGym();
  const { clearAllMeasurements } = useMeasurements();
  const { clearAllDiets } = useDiet();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Inline Feedback Banner State
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

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await profileService.getProfile();
      if (res.success && res.data) {
        populateForm(res.data);
      } else {
        setFeedback({
          type: 'error',
          text: res.error?.message || 'Errore nel caricamento del profilo.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: 'Errore di connessione durante il caricamento del profilo.',
      });
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (data: UserProfile) => {
    setFirstName(data.first_name || '');
    setLastName(data.last_name || '');
    setBirthDate(data.birth_date || '');
    setHeightCm(data.height_cm ? String(data.height_cm) : '');
    setAvatarUri(data.avatar_url || null);
  };

  const validateForm = (): boolean => {
    if (!firstName.trim()) {
      const msg = 'Il campo Nome è obbligatorio.';
      setFeedback({ type: 'error', text: msg });
      return false;
    }

    if (!lastName.trim()) {
      const msg = 'Il campo Cognome è obbligatorio.';
      setFeedback({ type: 'error', text: msg });
      return false;
    }

    // Validazione esatta formato data DD-MM-YYYY
    const dateRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-\d{4}$/;
    if (!dateRegex.test(birthDate.trim())) {
      const msg = 'Data di nascita non valida. Usa il formato DD-MM-YYYY (es. 15-05-1994).';
      setFeedback({ type: 'error', text: msg });
      return false;
    }

    const heightNum = parseFloat(heightCm.replace(',', '.'));
    if (isNaN(heightNum) || heightNum <= 50 || heightNum > 260) {
      const msg = 'Altezza non valida. Inserisci un valore compreso tra 50 e 260 cm.';
      setFeedback({ type: 'error', text: msg });
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    setFeedback(null);

    const dto: UpdateProfileRequestDto = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      birth_date: birthDate.trim(),
      height_cm: parseFloat(heightCm.replace(',', '.')),
      avatar_url: avatarUri,
    };

    try {
      const res = await profileService.updateProfile(dto);
      if (res.success && res.data) {
        populateForm(res.data);
        setFeedback({
          type: 'success',
          text: 'Profilo atleta salvato con successo! ✅',
        });
      } else {
        setFeedback({
          type: 'error',
          text: res.error?.message || 'Errore durante il salvataggio.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: 'Impossibile completare la richiesta verso il backend.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetAppConfirm = () => {
    setConfirmModal({
      visible: true,
      title: '⚠️ Reset Totale Dati App',
      message:
        'Sei assolutamente sicuro di voler cancellare TUTTI i dati dell\'applicazione? Verranno azzerati profilo, tutte le schede di allenamento, lo storico delle sessioni e le cartelle personalizzate. Questa operazione non può essere annullata.',
      confirmText: 'Sì, Cancella Tutto',
      isDestructive: true,
      onConfirm: async () => {
        try {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          setLoading(true);
          await resetEntireApp();
          await clearAllMeasurements();
          await clearAllDiets();
          await loadProfile();
          setFeedback({
            type: 'success',
            text: 'Applicazione resettata con successo. Tutti i dati sono stati rimossi.',
          });
        } catch {
          setFeedback({
            type: 'error',
            text: 'Errore durante il reset totale dei dati.',
          });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const fullName = `${firstName} ${lastName}`.trim() || 'Atleta';

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.accent} />
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
          <Text style={typography.caption}>IMPOSTAZIONI PERSONALI</Text>
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

        {/* Inline Feedback Banner */}
        {feedback && (
          <View
            style={[
              styles.banner,
              feedback.type === 'success' ? styles.bannerSuccess : styles.bannerError,
            ]}
          >
            <Text
              style={[
                styles.bannerText,
                {
                  color: feedback.type === 'success' ? colors.emerald : colors.danger,
                },
              ]}
            >
              {feedback.text}
            </Text>
          </View>
        )}

        {/* Form Card */}
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

        {/* Danger Zone: Reset Totale Applicazione */}
        <Card style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>⚠️ Zona di Pericolo: Reset Completo</Text>
          <Text style={styles.dangerDesc}>
            Se desideri ripartire da zero o cancellare ogni dato memorizzato sul dispositivo, puoi eseguire un reset totale.
            Verranno eliminati: il profilo atleta, tutte le schede di allenamento create, lo storico completo delle sessioni e tutte le cartelle salvate.
          </Text>
          <Pressable
            onPress={handleResetAppConfirm}
            style={({ pressed }) => [
              styles.dangerButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Azzera tutti i dati dell'applicazione"
          >
            <Text style={styles.dangerButtonText}>⚠️ RESET TOTALE DATI APP</Text>
          </Pressable>
        </Card>
      </ScrollView>

      {/* Custom Confirm Modal for Reset */}
      <CustomConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 4,
  },
  banner: {
    padding: 12,
    borderRadius: layout.borderRadiusSm,
    marginVertical: 10,
  },
  bannerSuccess: {
    backgroundColor: colors.emeraldMuted,
    borderWidth: 1,
    borderColor: colors.emerald,
  },
  bannerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  formCard: {
    marginVertical: 10,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  textInput: {
    height: layout.minTouchTarget,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusMd,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  saveButton: {
    backgroundColor: colors.accent,
    height: layout.minTouchTarget,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  dangerCard: {
    marginTop: 24,
    marginBottom: 16,
    padding: 16,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  dangerTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  dangerDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  dangerButton: {
    backgroundColor: colors.danger,
    height: layout.minTouchTarget,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});

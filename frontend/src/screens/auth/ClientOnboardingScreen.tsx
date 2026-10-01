import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Card } from '../../components/Card';
import { Avatar } from '../../components/Avatar';
import { CustomConfirmModal } from '../../components/CustomConfirmModal';
import { ScreenBackgroundWrapper } from '../../components/ScreenBackgroundWrapper';
import { DatePickerInput } from '../../components/DatePickerInput';
import { useAuth } from '../../context/AuthContext';

export const ClientOnboardingScreen: React.FC = () => {
  const { user, completeClientOnboarding, logout } = useAuth();

  // Esattamente gli 8 campi richiesti per il Setup Profilo Obbligatorio
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_url || null);
  const [username, setUsername] = useState(
    user?.username ? user.username.replace(/^@/, '') : ''
  );
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [heightCm, setHeightCm] = useState(user?.height_cm ? String(user.height_cm) : '');
  const [birthDate, setBirthDate] = useState(user?.birth_date || '');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleSaveAndEnter = async () => {
    setErrorMsg(null);

    // 1. Validazione Username (@nome)
    const cleanUsername = username.trim().replace(/^@/, '');
    if (!cleanUsername) {
      setErrorMsg('Lo Username è obbligatorio.');
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setErrorMsg(
        'Lo Username può contenere solo lettere, numeri, trattini, punti e underscore.'
      );
      return;
    }

    // 2. Validazione Nome
    const cleanFirst = firstName.trim();
    if (!cleanFirst) {
      setErrorMsg('Il campo Nome è obbligatorio.');
      return;
    }

    // 3. Validazione Cognome
    const cleanLast = lastName.trim();
    if (!cleanLast) {
      setErrorMsg('Il campo Cognome è obbligatorio.');
      return;
    }

    // 4. Validazione Password
    const cleanPass = password.trim();
    if (!cleanPass) {
      setErrorMsg('La password è obbligatoria per proteggere il tuo account.');
      return;
    }
    if (cleanPass.length < 4) {
      setErrorMsg('La password deve contenere almeno 4 caratteri.');
      return;
    }

    // 5. Validazione Ripeti Password (combaciante)
    if (confirmPassword.trim() !== cleanPass) {
      setErrorMsg('Le due password inserite non coincidono. Verifica la digitazione.');
      return;
    }

    // 6. Validazione Altezza (cm)
    const parsedHeight = parseFloat(heightCm.trim());
    if (isNaN(parsedHeight) || parsedHeight < 50 || parsedHeight > 260) {
      setErrorMsg('Inserisci un\'altezza valida in cm compresa tra 50 e 260.');
      return;
    }

    // 7. Validazione Data di Nascita (DD-MM-YYYY)
    const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
    const match = birthDate.trim().match(dateRegex);
    if (!match) {
      setErrorMsg('La Data di Nascita deve essere nel formato DD-MM-YYYY (es. 15-05-1996).');
      return;
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1920 || year > 2026) {
      setErrorMsg('Data di Nascita non valida. Verifica giorno, mese e anno.');
      return;
    }

    setLoading(true);
    try {
      const res = await completeClientOnboarding({
        username: cleanUsername,
        firstName: cleanFirst,
        lastName: cleanLast,
        password: cleanPass,
        height: parsedHeight,
        dateOfBirth: birthDate.trim(),
        avatar_url: avatarUri,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Errore durante il salvataggio del profilo.');
      }
    } catch {
      setErrorMsg('Si è verificato un errore di connessione. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || 'Atleta';

  return (
    <ScreenBackgroundWrapper>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Badge */}
          <View style={styles.headerBadge}>
            <View style={styles.welcomePill}>
              <Text style={styles.welcomePillText}>🔒 PRIMO ACCESSO PROTETTO</Text>
            </View>
            <Text style={styles.title}>Setup Profilo Obbligatorio</Text>
            <Text style={styles.subtitle}>
              Completa i tuoi dati personali e imposta la tua password personale per attivare il profilo e sbloccare la Dashboard.
            </Text>
          </View>

          {/* Caricamento Foto Profilo (Avatar) */}
          <View style={styles.avatarSection}>
            <Avatar
              imageUri={avatarUri}
              name={fullName}
              size={100}
              editable={true}
              onImageSelected={(uri) => setAvatarUri(uri)}
            />
            <Text style={styles.avatarHint}>Tocca la fotocamera per caricare la tua foto profilo</Text>
          </View>

          {/* Error Banner */}
          {errorMsg && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Form Card */}
          <Card style={styles.formCard}>
            {/* Campo 1: Username (@nome) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>USERNAME (@) *</Text>
              <View style={styles.usernameInputContainer}>
                <Text style={styles.usernamePrefix}>@</Text>
                <TextInput
                  style={styles.usernameTextInput}
                  value={username}
                  onChangeText={(val) => {
                    setUsername(val.replace(/^@/, ''));
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="mario_rossi"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Text style={styles.fieldHint}>Il tuo identificativo unico su My Train Up</Text>
            </View>

            {/* Campo 2: Nome */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOME *</Text>
              <TextInput
                style={styles.textInput}
                value={firstName}
                onChangeText={(val) => {
                  setFirstName(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="es. Mario"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Campo 3: Cognome */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>COGNOME *</Text>
              <TextInput
                style={styles.textInput}
                value={lastName}
                onChangeText={(val) => {
                  setLastName(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="es. Rossi"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Campo 4: Password */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>PASSWORD *</Text>
                <Pressable onPress={() => setShowPassword((prev) => !prev)}>
                  <Text style={styles.toggleVisibilityText}>
                    {showPassword ? 'Nascondi' : 'Mostra'}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                style={styles.textInput}
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Crea una password sicura (min. 4 caratteri)"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Campo 5: Ripeti Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>RIPETI PASSWORD *</Text>
              <TextInput
                style={styles.textInput}
                value={confirmPassword}
                onChangeText={(val) => {
                  setConfirmPassword(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Digita nuovamente la password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Campo 6: Altezza (cm) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ALTEZZA (CM) *</Text>
              <TextInput
                style={styles.textInput}
                value={heightCm}
                onChangeText={(val) => {
                  setHeightCm(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="es. 175"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
              <Text style={styles.fieldHint}>Necessaria per il calcolo del BMI e dei parametri corporei</Text>
            </View>

            {/* Campo 7: Data di Nascita */}
            <DatePickerInput
              label="DATA DI NASCITA *"
              value={birthDate}
              onChange={(_date, formatted) => {
                setBirthDate(formatted);
                if (errorMsg) setErrorMsg(null);
              }}
              hint="Seleziona la tua data di nascita"
              maximumDate={new Date()}
              format="DD-MM-YYYY"
            />

            {/* Submit Button */}
            <Pressable
              onPress={handleSaveAndEnter}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitButton,
                { opacity: pressed || loading ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Salva profilo e accedi"
            >
              {loading ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.submitButtonText}>SALVA PROFILO & ACCEDI ➔</Text>
              )}
            </Pressable>
          </Card>

          {/* Logout Escape Button */}
          <Pressable
            onPress={() => setShowLogoutModal(true)}
            style={styles.cancelBtn}
            accessibilityRole="button"
            accessibilityLabel="Esci dall'account"
          >
            <Text style={styles.cancelBtnText}>Esci e completa in seguito</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomConfirmModal
        visible={showLogoutModal}
        title="Disconnetti Account"
        message="Sei sicuro di voler uscire? Potrai completare il setup del tuo profilo al prossimo accesso."
        confirmText="Esci"
        isDestructive={true}
        onConfirm={async () => {
          setShowLogoutModal(false);
          await logout();
        }}
        onCancel={() => setShowLogoutModal(false)}
      />
    </ScreenBackgroundWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 20 : 28,
    paddingBottom: 48,
  },
  headerBadge: {
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomePill: {
    backgroundColor: 'rgba(234, 88, 15, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: 8,
  },
  welcomePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
    lineHeight: 18,
  },
  formCard: {
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  toggleVisibilityText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 6,
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
  usernameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: layout.minTouchTarget,
  },
  usernamePrefix: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
    marginRight: 4,
  },
  usernameTextInput: {
    flex: 1,
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
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    minHeight: layout.minTouchTarget,
  },
  submitButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelBtnText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
});

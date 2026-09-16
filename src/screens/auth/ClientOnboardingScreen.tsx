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
  Alert,
} from 'react-native';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/spacing';
import { Card } from '../../components/Card';
import { ScreenBackgroundWrapper } from '../../components/ScreenBackgroundWrapper';
import { useAuth } from '../../context/AuthContext';

export const ClientOnboardingScreen: React.FC = () => {
  const { user, completeClientOnboarding, logout } = useAuth();

  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthDate, setBirthDate] = useState(user?.birth_date || '');
  const [heightCm, setHeightCm] = useState(user?.height_cm ? String(user.height_cm) : '');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSaveAndEnter = async () => {
    setErrorMsg(null);

    const cleanPass = password.trim();
    if (!cleanPass) {
      setErrorMsg('La nuova password è obbligatoria per completare la registrazione.');
      return;
    }

    if (cleanPass.length < 4) {
      setErrorMsg('La password deve contenere almeno 4 caratteri.');
      return;
    }

    if (confirmPassword.trim() && confirmPassword.trim() !== cleanPass) {
      setErrorMsg('Le password inserite non coincidono.');
      return;
    }

    const parsedHeight = heightCm.trim() ? parseInt(heightCm.trim(), 10) : undefined;
    if (parsedHeight !== undefined && (isNaN(parsedHeight) || parsedHeight < 50 || parsedHeight > 260)) {
      setErrorMsg('Inserisci un\'altezza valida in centimetri (es. 175).');
      return;
    }

    setLoading(true);
    try {
      const res = await completeClientOnboarding({
        username: username.trim() || undefined,
        password: cleanPass,
        birthDate: birthDate.trim() || undefined,
        heightCm: parsedHeight,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Errore durante il salvataggio dei dati.');
      }
    } catch {
      setErrorMsg('Si è verificato un errore imprevisto. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutPress = () => {
    Alert.alert(
      'Esci dall\'account',
      'Sei sicuro di voler uscire? Potrai completare l\'onboarding al prossimo accesso.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Esci',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

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
            <View style={styles.iconCircle}>
              <Text style={styles.iconCircleText}>🏋️‍♂️</Text>
            </View>
            <View style={styles.welcomePill}>
              <Text style={styles.welcomePillText}>BENVENUTO ATLETA</Text>
            </View>
            <Text style={styles.title}>Completa il tuo Profilo</Text>
            <Text style={styles.subtitle}>
              È il tuo primo accesso con codice OTP. Imposta la tua password personale per proteggere
              il tuo account e accedere rapidamente.
            </Text>
          </View>

          {/* Read-only Client Card */}
          <Card style={styles.readOnlyCard}>
            <View style={styles.readOnlyRow}>
              <View style={styles.readOnlyCol}>
                <Text style={styles.readOnlyLabel}>NOME</Text>
                <Text style={styles.readOnlyValue}>{user?.first_name || 'N/D'}</Text>
              </View>
              <View style={styles.readOnlyCol}>
                <Text style={styles.readOnlyLabel}>COGNOME</Text>
                <Text style={styles.readOnlyValue}>{user?.last_name || 'N/D'}</Text>
              </View>
            </View>
            {user?.trainer_name && (
              <View style={styles.trainerAssignedRow}>
                <Text style={styles.trainerAssignedLabel}>TRAINER ASSEGNATO:</Text>
                <Text style={styles.trainerAssignedValue}>{user.trainer_name}</Text>
              </View>
            )}
          </Card>

          {/* Error Banner */}
          {errorMsg && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Form Card */}
          <Card style={styles.formCard}>
            {/* Username Input */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>SCEGLI UN USERNAME</Text>
                <Text style={styles.optionalBadge}>Opzionale</Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={(val) => {
                  setUsername(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="es. AlexPower (sostituirà il nome nel saluto)"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>NUOVA PASSWORD *</Text>
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
                placeholder="Crea una password sicura"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CONFERMA PASSWORD</Text>
              <TextInput
                style={styles.textInput}
                value={confirmPassword}
                onChangeText={(val) => {
                  setConfirmPassword(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Ripeti la password scelta"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Optional Bio Fields */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>DATA DI NASCITA</Text>
                <Text style={styles.optionalBadge}>Opzionale</Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={birthDate}
                onChangeText={(val) => {
                  setBirthDate(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="es. 15-05-1996"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>ALTEZZA (CM)</Text>
                <Text style={styles.optionalBadge}>Opzionale</Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={heightCm}
                onChangeText={(val) => {
                  setHeightCm(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="es. 178"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            {/* Submit Button */}
            <Pressable
              onPress={handleSaveAndEnter}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitButton,
                { opacity: pressed || loading ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Salva e accedi"
            >
              {loading ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.submitButtonText}>SALVA E ACCEDI ➔</Text>
              )}
            </Pressable>
          </Card>

          {/* Logout Escape Option */}
          <View style={styles.logoutContainer}>
            <Pressable onPress={handleLogoutPress} style={styles.logoutButton}>
              <Text style={styles.logoutButtonText}>← Esci ed effettua l'accesso con un altro account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackgroundWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 40,
  },
  headerBadge: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 2,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircleText: {
    fontSize: 32,
  },
  welcomePill: {
    backgroundColor: 'rgba(234, 88, 15, 0.15)',
    borderColor: colors.accent,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  welcomePillText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  readOnlyCard: {
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: colors.backgroundElevated,
  },
  readOnlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  readOnlyCol: {
    flex: 1,
  },
  readOnlyLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  readOnlyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  trainerAssignedRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trainerAssignedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  trainerAssignedValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: layout.borderRadiusMd,
    padding: 12,
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  formCard: {
    padding: 18,
  },
  inputGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  optionalBadge: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  toggleVisibilityText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.borderRadiusMd,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: layout.borderRadiusMd,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  submitButtonText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  logoutContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logoutButtonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});

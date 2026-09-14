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
import { useAuth } from '../../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [passwordOrOtp, setPasswordOrOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setErrorMsg(null);

    const cleanUser = username.trim();
    const cleanPass = passwordOrOtp.trim();

    if (!cleanUser) {
      setErrorMsg('Inserisci il tuo Username per accedere.');
      return;
    }

    if (!cleanPass) {
      setErrorMsg('Inserisci la Password o il Codice OTP fornito dal Trainer.');
      return;
    }

    setLoading(true);
    try {
      const res = await login({ username: cleanUser, passwordOrOtp: cleanPass });
      if (!res.success) {
        setErrorMsg(res.error || 'Credenziali non corrette.');
      }
    } catch {
      setErrorMsg('Errore di connessione durante l\'accesso.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (user: string, pass: string) => {
    setUsername(user);
    setPasswordOrOtp(pass);
    setErrorMsg(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>⚡</Text>
          </View>
          <Text style={styles.appTitle}>FITNESS LOGBOOK</Text>
          <Text style={styles.appSubtitle}>Personal Gym Hub & Provisioned Sync</Text>
          <View style={styles.roleGuardPill}>
            <Text style={styles.roleGuardText}>SISTEMA AD ACCESSO PROTETTO (RBAC)</Text>
          </View>
        </View>

        {/* Error Banner */}
        {errorMsg && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Login Form Card */}
        <Card style={styles.formCard}>
          <Text style={[typography.h3, { marginBottom: 6 }]}>Accedi all'Applicazione</Text>
          <Text style={styles.formSubtitle}>
            Inserisci le credenziali Trainer o lo Username e l'OTP fornito dal tuo istruttore.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>USERNAME *</Text>
            <TextInput
              style={styles.textInput}
              value={username}
              onChangeText={(val) => {
                setUsername(val);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="es. LorenzoAnzivino oppure Simona"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>PASSWORD O CODICE OTP *</Text>
              <Pressable onPress={() => setShowPassword((prev) => !prev)}>
                <Text style={styles.toggleVisibilityText}>
                  {showPassword ? 'Nascondi' : 'Mostra'}
                </Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.textInput}
              value={passwordOrOtp}
              onChangeText={(val) => {
                setPasswordOrOtp(val);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Password Trainer o Codice OTP Cliente"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [
              styles.loginButton,
              { opacity: pressed || loading ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Accedi al tuo account"
          >
            {loading ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.loginButtonText}>ACCEDI AL LOGBOOK ➔</Text>
            )}
          </Pressable>
        </Card>

        {/* Quick Demo Access Box */}
        <Card style={styles.demoCard}>
          <Text style={styles.demoTitle}>💡 CREDENZIALI DI ACCESSO VERIFICATE</Text>
          <Text style={styles.demoDesc}>
            Tocca una delle credenziali per pre-compilare il modulo ed effettuare il login di test:
          </Text>

          <View style={styles.demoButtonRow}>
            <Pressable
              onPress={() => handleFillDemo('LorenzoAnzivino', 'admin123')}
              style={styles.demoPillTrainer}
            >
              <Text style={styles.demoPillLabel}>🏋️ Trainer (Admin)</Text>
              <Text style={styles.demoPillCreds}>LorenzoAnzivino / admin123</Text>
            </Pressable>

            <Pressable
              onPress={() => handleFillDemo('Simona', 'OTP123')}
              style={styles.demoPillClient}
            >
              <Text style={styles.demoPillLabel}>🏃 Cliente (Sola Lettura)</Text>
              <Text style={styles.demoPillCreds}>Simona / OTP123</Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderWidth: 2,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoIcon: {
    fontSize: 28,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 1.5,
  },
  appSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  roleGuardPill: {
    marginTop: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  roleGuardText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: layout.minTouchTarget,
  },
  loginButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    minHeight: layout.minTouchTarget,
  },
  loginButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  // Demo Box
  demoCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderColor: colors.border,
    borderWidth: 1,
  },
  demoTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  demoDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
    lineHeight: 16,
  },
  demoButtonRow: {
    gap: 8,
  },
  demoPillTrainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    padding: 10,
  },
  demoPillClient: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 8,
    padding: 10,
  },
  demoPillLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  demoPillCreds: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
});

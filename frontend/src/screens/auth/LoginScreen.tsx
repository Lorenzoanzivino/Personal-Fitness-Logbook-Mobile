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
  Image,
} from 'react-native';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Card } from '../../components/Card';
import { ScreenBackgroundWrapper } from '../../components/ScreenBackgroundWrapper';
import { useAuth } from '../../context/AuthContext';

const APP_LOGO = require('../../../assets/logo1.png');

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();

  // Smart Login Form State (Single Form)
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const handleLogin = async () => {
    setErrorMsg(null);

    const cleanIdentifier = identifier.trim();
    const cleanSecret = secret.trim();

    if (!cleanIdentifier) {
      setErrorMsg('Inserisci il tuo Username o Nome registrato per accedere.');
      return;
    }

    if (!cleanSecret) {
      setErrorMsg('Inserisci la Password o il Codice OTP fornito dal Trainer.');
      return;
    }

    setLoading(true);
    try {
      const res = await login({
        identifier: cleanIdentifier,
        secret: cleanSecret,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Credenziali non valide o non riconosciute.');
      }
    } catch {
      setErrorMsg('Errore di connessione durante l\'accesso al server.');
    } finally {
      setLoading(false);
    }
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
          {/* Brand Header */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Image source={APP_LOGO} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text style={styles.appTitle}>MY TRAIN UP</Text>
            <Text style={styles.appSubtitle}>Personal Gym Hub & Workout Tracking</Text>
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

          {/* Smart Unified Login Card */}
          <Card style={styles.formCard}>
            <Text style={[typography.h3, { marginBottom: 6 }]}>Accedi all'Applicazione</Text>
            <Text style={styles.formSubtitle}>
              Inserisci il tuo Username o Nome e la tua Password o il Codice OTP temporaneo per entrare nel sistema.
            </Text>

            {/* Campo 1: Username o Nome */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>USERNAME O NOME *</Text>
              <TextInput
                style={styles.textInput}
                value={identifier}
                onChangeText={(val) => {
                  setIdentifier(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="es. lorenzo oppure Mario"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.inputHint}>
                Inserisci il tuo username o il nome comunicato al tuo Trainer.
              </Text>
            </View>

            {/* Campo 2: Password o Codice OTP */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>PASSWORD O CODICE OTP *</Text>
                <Pressable onPress={() => setShowSecret((prev) => !prev)}>
                  <Text style={styles.toggleVisibilityText}>
                    {showSecret ? 'Nascondi' : 'Mostra'}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                style={styles.textInput}
                value={secret}
                onChangeText={(val) => {
                  setSecret(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Inserisci password o codice OTP"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showSecret}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.inputHint}>
                Usa la tua password se hai già completato il profilo, oppure il codice OTP al primo accesso.
              </Text>
            </View>

            {/* Pulsante Accedi */}
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.loginButton,
                { opacity: pressed || loading ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Accedi"
            >
              {loading ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.loginButtonText}>ACCEDI ➔</Text>
              )}
            </Pressable>
          </Card>
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
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EA580F',
    borderWidth: 3,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 14,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  inputHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 5,
  },
  loginButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: layout.minTouchTarget,
  },
  loginButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});

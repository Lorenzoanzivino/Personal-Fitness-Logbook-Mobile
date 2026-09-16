import React, { useState } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Card } from '../../components/Card';
import { ToastFeedback, ToastType } from '../../components/ToastFeedback';
import { useAuth } from '../../context/AuthContext';

export interface NewClientModalProps {
  visible?: boolean;
  onClose?: () => void;
  onClientCreated?: (username: string, otp: string) => void;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({
  visible = true,
  onClose,
  onClientCreated,
}) => {
  const { createClientAccount } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [goals, setGoals] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ username: string; otp: string } | null>(null);

  const [toast, setToast] = useState<{
    visible: boolean;
    type: ToastType;
    message: string;
  }>({
    visible: false,
    type: 'info',
    message: '',
  });

  const showToast = (type: ToastType, message: string) => {
    setToast({ visible: true, type, message });
  };

  const handleCopyOtp = async (otp: string, athleteName: string) => {
    await Clipboard.setStringAsync(otp);
    showToast('success', `Codice OTP di ${athleteName} copiato negli appunti!`);
  };

  const handleSave = async () => {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();

    if (!cleanFirstName) {
      showToast('error', 'Il campo Nome è obbligatorio.');
      return;
    }

    if (!cleanLastName) {
      showToast('error', 'Il campo Cognome è obbligatorio.');
      return;
    }

    setLoading(true);
    setCreatedResult(null);

    try {
      // L'app genera l'username dietro le quinte usando il Nome
      const res = await createClientAccount(
        cleanFirstName,
        cleanLastName,
        goals.trim() || undefined
      );

      if (res.success && res.otp) {
        const username = cleanFirstName;
        setCreatedResult({ username, otp: res.otp });
        setFirstName('');
        setLastName('');
        setGoals('');
        showToast('success', `Account per ${cleanFirstName} ${cleanLastName} creato con successo!`);
        onClientCreated?.(username, res.otp);
      } else {
        showToast('error', res.error || 'Impossibile creare account atleta.');
      }
    } catch {
      showToast('error', 'Errore di connessione durante la creazione dell\'account.');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <View style={styles.modalBackdrop}>
      <Card style={styles.modalCard}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.caption}>REGISTRAZIONE ALLIEVO</Text>
            <Text style={typography.h2}>Aggiungi Nuovo Atleta</Text>
          </View>
          {onClose && (
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.7 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Chiudi"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.description}>
          Inserisci Nome e Cognome dell'atleta. L'app genererà le credenziali con un codice OTP di accesso perpetuo.
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {/* Form */}
          <View style={styles.formContainer}>
            {/* Campo 1: Nome (Obbligatorio) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOME *</Text>
              <TextInput
                style={styles.textInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="es. Mario"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Campo 2: Cognome (Obbligatorio) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>COGNOME *</Text>
              <TextInput
                style={styles.textInput}
                value={lastName}
                onChangeText={setLastName}
                placeholder="es. Rossi"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Campo 3: Obiettivi (Opzionale) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>OBIETTIVI (Opzionale)</Text>
              <TextInput
                style={styles.textInput}
                value={goals}
                onChangeText={setGoals}
                placeholder="es. Ipertrofia 4x/settimana • Definizione"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <Pressable
              onPress={handleSave}
              disabled={loading}
              style={({ pressed }) => [
                styles.saveBtn,
                { opacity: pressed || loading ? 0.8 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Crea account atleta"
            >
              {loading ? (
                <ActivityIndicator color="#0F172A" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>✨ Salva Atleta e Genera OTP</Text>
              )}
            </Pressable>
          </View>

          {/* Risultato Credenziali */}
          {createdResult && (
            <View style={styles.credentialsResultBox}>
              <View style={styles.credentialsResultTop}>
                <Text style={styles.credentialsResultTitle}>🎉 CREDENZIALI CREATE</Text>
                <Text style={styles.credentialsResultPill}>PRONTO AL LOGIN</Text>
              </View>
              <Text style={styles.credentialsResultDesc}>
                Condividi queste credenziali con il tuo allievo:
              </Text>
              <View style={styles.credRow}>
                <View style={styles.credItem}>
                  <Text style={styles.credLabel}>IDENTIFICATIVO / NOME:</Text>
                  <Text style={styles.credValue}>{createdResult.username}</Text>
                </View>
                <View style={styles.credItem}>
                  <Text style={styles.credLabel}>PASSWORD / OTP:</Text>
                  <Text style={styles.credValueOtp}>{createdResult.otp}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => handleCopyOtp(createdResult.otp, createdResult.username)}
                style={styles.copyOtpDirectBtn}
              >
                <Text style={styles.copyOtpDirectBtnText}>📋 Copia Codice OTP</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </Card>

      <ToastFeedback
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );

  if (onClose) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        {content}
      </Modal>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    padding: layout.cardPadding,
    borderRadius: layout.borderRadiusLg,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 14,
  },
  scroll: {
    maxHeight: 520,
  },
  formContainer: {
    marginBottom: 10,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.borderRadiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    minHeight: layout.minTouchTarget,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: layout.borderRadiusSm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  credentialsResultBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1.5,
    borderColor: colors.emerald,
    borderRadius: layout.borderRadiusMd,
    padding: 14,
    marginTop: 14,
  },
  credentialsResultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  credentialsResultTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.emerald,
    letterSpacing: 0.5,
  },
  credentialsResultPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: '800',
    color: colors.emerald,
  },
  credentialsResultDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  credRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  credItem: {
    flex: 1,
    backgroundColor: colors.backgroundSubtle,
    padding: 8,
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  credLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 2,
  },
  credValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  credValueOtp: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 1.5,
  },
  copyOtpDirectBtn: {
    backgroundColor: colors.emeraldMuted,
    paddingVertical: 8,
    borderRadius: layout.borderRadiusSm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.emerald,
  },
  copyOtpDirectBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.emerald,
  },
});

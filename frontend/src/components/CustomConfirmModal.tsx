import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';
import { typography } from '../theme/typography';

interface CustomConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CustomConfirmModal: React.FC<CustomConfirmModalProps> = ({
  visible,
  title,
  message,
  confirmText = 'Conferma',
  cancelText = 'Annulla',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={typography.h3}>{title}</Text>
          <Text style={styles.messageText}>{message}</Text>

          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed && { opacity: 0.8 },
              ]}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                isDestructive ? styles.destructiveButton : styles.confirmButton,
                pressed && { opacity: 0.85 },
              ]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.backgroundElevated,
    borderRadius: layout.borderRadiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  messageText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: layout.borderRadiusMd,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.backgroundSubtle,
  },
  cancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  confirmButton: {
    backgroundColor: colors.accent,
  },
  destructiveButton: {
    backgroundColor: colors.danger,
  },
  confirmText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});

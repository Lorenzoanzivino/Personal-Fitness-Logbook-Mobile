import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';

export type ToastType = 'success' | 'error' | 'info';

interface ToastFeedbackProps {
  visible: boolean;
  type: ToastType;
  message: string;
  onDismiss: () => void;
  duration?: number;
}

export const ToastFeedback: React.FC<ToastFeedbackProps> = ({
  visible,
  type,
  message,
  onDismiss,
  duration = 3500,
}) => {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  const getStyle = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'rgba(16, 185, 129, 0.95)',
          border: colors.emerald,
          icon: '✓',
        };
      case 'error':
        return {
          bg: 'rgba(239, 68, 68, 0.95)',
          border: colors.danger,
          icon: '⚠',
        };
      default:
        return {
          bg: 'rgba(14, 165, 233, 0.95)',
          border: colors.accent,
          icon: 'ℹ',
        };
    }
  };

  const styleConfig = getStyle();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.toastCard,
          { backgroundColor: styleConfig.bg, borderColor: styleConfig.border },
        ]}
      >
        <Text style={styles.icon}>{styleConfig.icon}</Text>
        <Text style={styles.messageText}>{message}</Text>
        <Pressable onPress={onDismiss} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: layout.borderRadiusMd,
    borderWidth: 1,
    maxWidth: 500,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    fontSize: 18,
    color: colors.white,
    fontWeight: '800',
    marginRight: 10,
  },
  messageText: {
    flex: 1,
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 8,
  },
  closeBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
  StyleProp,
  ViewStyle,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { layout, spacing } from '../theme/spacing';

export const parseAnyDate = (val?: Date | string | null): Date => {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  if (typeof val === 'string') {
    // DD-MM-YYYY (es. 15-05-1996)
    if (/^\d{2}-\d{2}-\d{4}$/.test(val)) {
      const [d, m, y] = val.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    // DD/MM/YYYY (es. 15/05/1996)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      const [d, m, y] = val.split('/').map(Number);
      return new Date(y, m - 1, d);
    }
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
};

export const formatToDDMMYYYY = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export const formatToYYYYMMDD = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
};

export const formatToReadableDate = (d: Date): string => {
  try {
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return formatToDDMMYYYY(d);
  }
};

export interface DatePickerInputProps {
  value?: Date | string | null;
  onChange: (date: Date, formattedString: string) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  format?: 'readable' | 'DD-MM-YYYY' | 'YYYY-MM-DD';
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value,
  onChange,
  label,
  hint,
  placeholder = 'Seleziona data',
  maximumDate,
  minimumDate,
  disabled = false,
  style,
  format = 'DD-MM-YYYY',
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const selectedDate = parseAnyDate(value);
  const [tempIosDate, setTempIosDate] = useState<Date>(selectedDate);

  const formatValue = (d: Date): string => {
    if (format === 'YYYY-MM-DD') return formatToYYYYMMDD(d);
    return formatToDDMMYYYY(d);
  };

  const displayString = value
    ? format === 'readable'
      ? formatToReadableDate(selectedDate)
      : formatValue(selectedDate)
    : '';

  const handleOpen = () => {
    if (disabled) return;
    setTempIosDate(selectedDate);
    setShowPicker(true);
  };

  const handleNativeChange = (event: DateTimePickerEvent, newDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && newDate) {
        onChange(newDate, formatValue(newDate));
      }
    } else if (Platform.OS === 'ios' && newDate) {
      setTempIosDate(newDate);
    }
  };

  const handleConfirmIos = () => {
    setShowPicker(false);
    onChange(tempIosDate, formatValue(tempIosDate));
  };

  const handleWebChange = (e: any) => {
    const rawVal = e?.target?.value;
    if (rawVal) {
      // rawVal is YYYY-MM-DD from HTML date input
      const [y, m, d] = rawVal.split('-').map(Number);
      const newD = new Date(y, m - 1, d);
      onChange(newD, formatValue(newD));
    }
  };

  const webIsoDate = selectedDate ? formatToYYYYMMDD(selectedDate) : '';

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}

      {Platform.OS === 'web' ? (
        // Web Environment (HTML5 Native Calendar Picker)
        <View style={styles.inputWrapper}>
          <Text style={styles.icon}>📅</Text>
          <input
            type="date"
            value={webIsoDate}
            onChange={handleWebChange}
            disabled={disabled}
            max={maximumDate ? formatToYYYYMMDD(maximumDate) : undefined}
            min={minimumDate ? formatToYYYYMMDD(minimumDate) : undefined}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              color: colors.text,
              border: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              fontSize: '15px',
              fontWeight: '600',
              cursor: disabled ? 'not-allowed' : 'pointer',
              padding: '12px 4px',
              width: '100%',
            }}
          />
        </View>
      ) : (
        // Native Environment (Android / iOS Modal)
        <>
          <Pressable
            onPress={handleOpen}
            disabled={disabled}
            style={({ pressed }) => [
              styles.inputWrapper,
              pressed && styles.inputWrapperPressed,
              disabled && styles.inputWrapperDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={label || 'Seleziona data'}
          >
            <Text style={styles.icon}>📅</Text>
            <Text
              style={[
                styles.dateText,
                !displayString && styles.placeholderText,
              ]}
            >
              {displayString || placeholder}
            </Text>
            <Text style={styles.chevron}>▾</Text>
          </Pressable>

          {/* Android Picker */}
          {showPicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={handleNativeChange}
              maximumDate={maximumDate}
              minimumDate={minimumDate}
            />
          )}

          {/* iOS Modal with Wheel / Calendar */}
          {showPicker && Platform.OS === 'ios' && (
            <Modal
              transparent
              animationType="slide"
              visible={showPicker}
              onRequestClose={() => setShowPicker(false)}
            >
              <View style={styles.iosModalBackdrop}>
                <View style={styles.iosModalContent}>
                  <View style={styles.iosModalHeader}>
                    <Pressable
                      onPress={() => setShowPicker(false)}
                      style={styles.iosHeaderBtn}
                    >
                      <Text style={styles.iosCancelText}>Annulla</Text>
                    </Pressable>
                    <Text style={styles.iosModalTitle}>Seleziona Data</Text>
                    <Pressable
                      onPress={handleConfirmIos}
                      style={styles.iosHeaderBtn}
                    >
                      <Text style={styles.iosConfirmText}>Conferma</Text>
                    </Pressable>
                  </View>

                  <DateTimePicker
                    value={tempIosDate}
                    mode="date"
                    display="spinner"
                    onChange={handleNativeChange}
                    maximumDate={maximumDate}
                    minimumDate={minimumDate}
                    textColor={colors.text}
                    themeVariant="dark"
                  />
                </View>
              </View>
            </Modal>
          )}
        </>
      )}

      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.8)',
    borderRadius: layout.borderRadiusMd,
    paddingHorizontal: spacing.md,
    minHeight: 50,
  },
  inputWrapperPressed: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(51, 65, 85, 0.9)',
  },
  inputWrapperDisabled: {
    opacity: 0.5,
  },
  icon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  dateText: {
    flex: 1,
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  placeholderText: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  chevron: {
    fontSize: 16,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  hint: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  iosModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  iosModalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: layout.borderRadiusLg,
    borderTopRightRadius: layout.borderRadiusLg,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  iosModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iosModalTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  iosHeaderBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  iosCancelText: {
    ...typography.body,
    color: colors.textMuted,
  },
  iosConfirmText: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '700',
  },
});

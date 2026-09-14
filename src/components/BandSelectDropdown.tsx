import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { BandAssistance } from '../types/workout';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';
import { typography } from '../theme/typography';

export const BAND_OPTIONS: Array<{
  key: BandAssistance;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
}> = [
  {
    key: 'heavy',
    label: 'Elastico tensione alta',
    shortLabel: 'Tensione alta',
    icon: '🔴',
    color: '#EF4444',
  },
  {
    key: 'medium',
    label: 'Elastico tensione media',
    shortLabel: 'Tensione media',
    icon: '🟠',
    color: '#F59E0B',
  },
  {
    key: 'light',
    label: 'Elastico tensione bassa',
    shortLabel: 'Tensione bassa',
    icon: '🟡',
    color: '#EAB308',
  },
  {
    key: 'none',
    label: 'Corpo libero',
    shortLabel: 'Corpo libero',
    icon: '⚪',
    color: '#94A3B8',
  },
  {
    key: 'weighted',
    label: 'Zavorra',
    shortLabel: 'Zavorra',
    icon: '⚖️',
    color: colors.accent,
  },
];

interface BandSelectDropdownProps {
  value: BandAssistance;
  onChange: (value: BandAssistance) => void;
  compact?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const BandSelectDropdown: React.FC<BandSelectDropdownProps> = ({
  value,
  onChange,
  compact = false,
  disabled = false,
  style,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const currentOption =
    BAND_OPTIONS.find((b) => b.key === value) || BAND_OPTIONS[3]; // 'none' as fallback

  return (
    <>
      <Pressable
        onPress={() => !disabled && setModalVisible(true)}
        style={({ pressed }) => [
          styles.trigger,
          compact && styles.triggerCompact,
          disabled && styles.disabledTrigger,
          { opacity: pressed ? 0.8 : 1 },
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Seleziona modalità: ${currentOption.label}`}
      >
        <View style={styles.triggerContent}>
          <Text style={styles.triggerIcon}>{currentOption.icon}</Text>
          <Text
            style={[
              styles.triggerLabel,
              compact && styles.triggerLabelCompact,
            ]}
            numberOfLines={1}
          >
            {compact ? currentOption.shortLabel : currentOption.label}
          </Text>
        </View>
        <Text style={styles.chevron}>▼</Text>
      </Pressable>

      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={typography.caption}>CORPOLIBERO / CALISTHENICS</Text>
                <Text style={typography.h3}>Seleziona Modalità</Text>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Chiudi tendina"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.optionsList}>
              {BAND_OPTIONS.map((opt) => {
                const isSelected = value === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      onChange(opt.key);
                      setModalVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.optionRow,
                      isSelected && styles.optionRowActive,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View style={styles.optionLeft}>
                      <Text style={styles.optionIcon}>{opt.icon}</Text>
                      <View>
                        <Text
                          style={[
                            styles.optionLabel,
                            isSelected && styles.optionLabelActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        <Text style={styles.optionSubText}>
                          {opt.key === 'none'
                            ? 'Esecuzione solo a peso corporeo'
                            : opt.key === 'weighted'
                            ? 'Sovraccarico con cintura zavorre (+Kg)'
                            : `Assistenza con loop band (${opt.shortLabel.toLowerCase()})`}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Text style={styles.checkBadgeText}>✓</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    height: layout.minTouchTarget,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusMd,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerCompact: {
    height: 40,
    paddingHorizontal: 8,
  },
  disabledTrigger: {
    opacity: 0.5,
  },
  triggerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  triggerIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  triggerLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  triggerLabelCompact: {
    fontSize: 11,
    fontWeight: '700',
  },
  chevron: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.80)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.backgroundElevated,
    borderRadius: layout.borderRadiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: layout.borderRadiusMd,
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionRowActive: {
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderColor: colors.accent,
  },
  optionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  optionIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  optionLabelActive: {
    color: colors.accent,
    fontWeight: '800',
  },
  optionSubText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadgeText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
  },
});

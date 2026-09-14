import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  connected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'FITNESS LOGBOOK',
  subtitle = 'Personal Gym Hub',
  connected = true,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoIcon}>⚡</Text>
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.statusBadge}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: connected ? colors.emerald : colors.danger },
          ]}
        />
        <Text style={styles.statusText}>
          {connected ? 'LIVE' : 'OFFLINE'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoIcon: {
    fontSize: 20,
  },
  titleContainer: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
});

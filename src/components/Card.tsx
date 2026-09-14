import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  highlighted?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, highlighted = false }) => {
  return (
    <View
      style={[
        styles.card,
        highlighted && styles.cardHighlighted,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: layout.borderRadiusMd,
    padding: layout.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 6,
  },
  cardHighlighted: {
    borderColor: colors.accent,
    backgroundColor: '#162235',
  },
});

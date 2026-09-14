import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Card } from './Card';
import { BodyMeasurement } from '../types/measurement';

interface WeightTrendChartProps {
  measurements: BodyMeasurement[];
  onAddPress?: () => void;
}

export const WeightTrendChart: React.FC<WeightTrendChartProps> = ({
  measurements,
  onAddPress,
}) => {
  // Ordina in ordine cronologico crescente (da meno recente a più recente)
  const chronological = [...measurements]
    .sort((a, b) => (a.recorded_at > b.recorded_at ? 1 : -1))
    .slice(-8); // Mostra fino agli ultimi 8 rilevamenti

  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    chronological.length > 0 ? chronological.length - 1 : null
  );

  if (chronological.length < 2) {
    return (
      <Card style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📈</Text>
        <Text style={typography.h3}>Curva Andamento Peso</Text>
        <Text style={styles.emptyText}>
          Registra almeno due pesate nella sezione Misure per visualizzare la curva di andamento del tuo peso corporeo.
        </Text>
        {onAddPress && (
          <Pressable onPress={onAddPress} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Registra Pesata</Text>
          </Pressable>
        )}
      </Card>
    );
  }

  const weights = chronological.map((m) => m.weight_kg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const range = maxWeight - minWeight === 0 ? 1 : maxWeight - minWeight;

  // Calcolo delta totale periodo
  const firstWeight = chronological[0].weight_kg;
  const lastWeight = chronological[chronological.length - 1].weight_kg;
  const totalDelta = Math.round((lastWeight - firstWeight) * 10) / 10;

  const selectedMeasurement =
    selectedIndex !== null && selectedIndex < chronological.length
      ? chronological[selectedIndex]
      : chronological[chronological.length - 1];

  const formatDateShort = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const formatDateFull = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card style={styles.container}>
      {/* Chart Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={typography.label}>ANDAMENTO PESO CORPOREO</Text>
          <Text style={typography.h2}>Curva Bioimpedenza</Text>
        </View>

        <View
          style={[
            styles.deltaTag,
            {
              backgroundColor:
                totalDelta < 0
                  ? 'rgba(16, 185, 129, 0.15)'
                  : totalDelta > 0
                  ? 'rgba(245, 158, 11, 0.15)'
                  : colors.backgroundSubtle,
            },
          ]}
        >
          <Text
            style={[
              styles.deltaTagText,
              {
                color:
                  totalDelta < 0
                    ? colors.emerald
                    : totalDelta > 0
                    ? colors.warning
                    : colors.textSecondary,
              },
            ]}
          >
            {totalDelta > 0 ? '+' : ''}
            {totalDelta.toFixed(1)} kg nel periodo {totalDelta < 0 ? '📉' : totalDelta > 0 ? '📈' : '➖'}
          </Text>
        </View>
      </View>

      {/* Interactive Tooltip Box */}
      {selectedMeasurement && (
        <View style={styles.tooltipBox}>
          <View style={styles.tooltipHeader}>
            <Text style={styles.tooltipDate}>
              📅 {formatDateFull(selectedMeasurement.recorded_at)}
            </Text>
            <Text style={styles.tooltipWeight}>
              {selectedMeasurement.weight_kg.toFixed(1)} kg
            </Text>
          </View>

          <View style={styles.tooltipSubRow}>
            {selectedMeasurement.body_fat_pct && (
              <Text style={styles.tooltipPill}>
                Massa Grassa: {selectedMeasurement.body_fat_pct.toFixed(1)}%
              </Text>
            )}
            {selectedMeasurement.muscle_mass_kg && (
              <Text style={styles.tooltipPill}>
                Muscolo: {selectedMeasurement.muscle_mass_kg.toFixed(1)} kg
              </Text>
            )}
            {selectedMeasurement.bmi && (
              <Text style={styles.tooltipPill}>
                BMI: {selectedMeasurement.bmi.toFixed(1)}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Chart Canvas Area */}
      <View style={styles.canvasContainer}>
        {/* Y-Axis Reference Lines */}
        <View style={styles.yAxisOverlay}>
          <View style={styles.yAxisLineRow}>
            <Text style={styles.yAxisLabel}>{(maxWeight + 0.5).toFixed(1)} kg</Text>
            <View style={styles.gridLine} />
          </View>
          <View style={styles.yAxisLineRow}>
            <Text style={styles.yAxisLabel}>{((maxWeight + minWeight) / 2).toFixed(1)} kg</Text>
            <View style={[styles.gridLine, styles.gridLineMid]} />
          </View>
          <View style={styles.yAxisLineRow}>
            <Text style={styles.yAxisLabel}>{(minWeight - 0.5).toFixed(1)} kg</Text>
            <View style={styles.gridLine} />
          </View>
        </View>

        {/* Data Columns & Curve Points */}
        <View style={styles.plotArea}>
          {chronological.map((m, idx) => {
            const normalizedHeight = (m.weight_kg - minWeight) / range;
            // Calcolo percentuale tra il 15% e l'85% dell'altezza del grafico per non toccare i bordi
            const bottomPct = Math.round(15 + normalizedHeight * 65);
            const isSelected = selectedIndex === idx;

            return (
              <Pressable
                key={m.id}
                onPress={() => setSelectedIndex(idx)}
                style={styles.dataColumn}
                accessibilityRole="button"
                accessibilityLabel={`Pesata del ${formatDateShort(m.recorded_at)}: ${m.weight_kg} kg`}
              >
                {/* Vertical Indicator Guide */}
                <View
                  style={[
                    styles.verticalGuide,
                    isSelected && styles.verticalGuideActive,
                  ]}
                />

                {/* Point / Dot on the Curve */}
                <View
                  style={[
                    styles.dataPointContainer,
                    { bottom: `${bottomPct}%` },
                  ]}
                >
                  <View
                    style={[
                      styles.dataPoint,
                      isSelected && styles.dataPointActive,
                    ]}
                  >
                    {isSelected && <View style={styles.dataPointInnerDot} />}
                  </View>
                  <Text
                    style={[
                      styles.pointWeightText,
                      isSelected && styles.pointWeightTextActive,
                    ]}
                  >
                    {m.weight_kg.toFixed(1)}
                  </Text>
                </View>

                {/* X-Axis Label */}
                <Text
                  style={[
                    styles.xAxisLabel,
                    isSelected && styles.xAxisLabelActive,
                  ]}
                >
                  {formatDateShort(m.recorded_at)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.tapHint}>
        💡 Tocca i punti della curva per consultare i parametri impedenziometrici del giorno
      </Text>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deltaTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.borderRadiusLg,
  },
  deltaTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tooltipBox: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusSm,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tooltipDate: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tooltipWeight: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.accent,
  },
  tooltipSubRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tooltipPill: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  canvasContainer: {
    height: 190,
    position: 'relative',
    marginTop: 6,
    marginBottom: 8,
  },
  yAxisOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  yAxisLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yAxisLabel: {
    fontSize: 9,
    color: colors.textMuted,
    width: 44,
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  gridLineMid: {
    borderStyle: 'dashed',
  },
  plotArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 44,
    paddingBottom: 22,
    position: 'relative',
  },
  dataColumn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  verticalGuide: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'transparent',
  },
  verticalGuideActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  dataPointContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  dataPoint: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataPointActive: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.emerald,
    borderColor: colors.white,
    shadowColor: colors.emerald,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  dataPointInnerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.white,
  },
  pointWeightText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 2,
  },
  pointWeightTextActive: {
    color: colors.emerald,
    fontWeight: '900',
    fontSize: 10,
  },
  xAxisLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    position: 'absolute',
    bottom: 0,
  },
  xAxisLabelActive: {
    color: colors.accent,
    fontWeight: '800',
  },
  tapHint: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 16,
  },
  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: layout.borderRadiusSm,
  },
  addBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Card } from './Card';
import { BodyMeasurement } from '../types/measurement';

export type TrendMetricKey =
  | 'weight_kg'
  | 'bmi'
  | 'body_fat_pct'
  | 'muscle_mass_kg'
  | 'bmr_kcal'
  | 'water_pct'
  | 'fat_mass_kg'
  | 'lean_mass_kg'
  | 'bone_mass_kg'
  | 'visceral_fat'
  | 'protein_percentage'
  | 'skeletal_muscle_mass_kg'
  | 'subcutaneous_fat_percentage';

export interface TrendMetricConfig {
  key: TrendMetricKey;
  label: string;
  unit: string;
  decimals: number;
  getter: (m: BodyMeasurement) => number | null | undefined;
  isDesirableIncrease: boolean; // true if increase is good (e.g. muscle, lean mass, protein, water, bone)
}

export const TREND_METRICS: TrendMetricConfig[] = [
  {
    key: 'weight_kg',
    label: 'Peso',
    unit: 'kg',
    decimals: 1,
    getter: (m) => m.weight ?? m.weight_kg,
    isDesirableIncrease: false,
  },
  {
    key: 'bmi',
    label: 'BMI',
    unit: '',
    decimals: 1,
    getter: (m) => m.bmi,
    isDesirableIncrease: false,
  },
  {
    key: 'body_fat_pct',
    label: 'Grasso %',
    unit: '%',
    decimals: 1,
    getter: (m) => m.body_fat_percentage ?? m.body_fat_pct,
    isDesirableIncrease: false,
  },
  {
    key: 'muscle_mass_kg',
    label: 'Massa Muscolare',
    unit: 'kg',
    decimals: 1,
    getter: (m) => m.muscle_mass_kg,
    isDesirableIncrease: true,
  },
  {
    key: 'bmr_kcal',
    label: 'BMR',
    unit: 'Kcal',
    decimals: 0,
    getter: (m) => m.bmr ?? m.bmr_kcal,
    isDesirableIncrease: true,
  },
  {
    key: 'water_pct',
    label: 'Acqua %',
    unit: '%',
    decimals: 1,
    getter: (m) => m.water_percentage ?? m.water_pct,
    isDesirableIncrease: true,
  },
  {
    key: 'fat_mass_kg',
    label: 'Massa Grassa (kg)',
    unit: 'kg',
    decimals: 1,
    getter: (m) => m.fat_mass_kg,
    isDesirableIncrease: false,
  },
  {
    key: 'lean_mass_kg',
    label: 'Massa Magra',
    unit: 'kg',
    decimals: 1,
    getter: (m) => m.lean_mass_kg,
    isDesirableIncrease: true,
  },
  {
    key: 'bone_mass_kg',
    label: 'Massa Ossea',
    unit: 'kg',
    decimals: 1,
    getter: (m) => m.bone_mass_kg,
    isDesirableIncrease: true,
  },
  {
    key: 'visceral_fat',
    label: 'Grasso Viscerale',
    unit: 'lvl',
    decimals: 0,
    getter: (m) => m.visceral_fat,
    isDesirableIncrease: false,
  },
  {
    key: 'protein_percentage',
    label: 'Proteine %',
    unit: '%',
    decimals: 1,
    getter: (m) => m.protein_percentage,
    isDesirableIncrease: true,
  },
  {
    key: 'skeletal_muscle_mass_kg',
    label: 'Muscolo Scheletrico',
    unit: 'kg',
    decimals: 1,
    getter: (m) => m.skeletal_muscle_mass_kg,
    isDesirableIncrease: true,
  },
  {
    key: 'subcutaneous_fat_percentage',
    label: 'Grasso Sottocutaneo',
    unit: '%',
    decimals: 1,
    getter: (m) => m.subcutaneous_fat_percentage,
    isDesirableIncrease: false,
  },
];

interface MeasurementTrendChartProps {
  measurements: BodyMeasurement[];
  onAddPress?: () => void;
}

export const MeasurementTrendChart: React.FC<MeasurementTrendChartProps> = ({
  measurements,
  onAddPress,
}) => {
  // Metric selector state (default: 'weight_kg')
  const [selectedMetricKey, setSelectedMetricKey] = useState<TrendMetricKey>('weight_kg');

  const activeMetric =
    TREND_METRICS.find((m) => m.key === selectedMetricKey) || TREND_METRICS[0];

  // Ordina in ordine cronologico crescente (da meno recente a più recente)
  const allChronological = [...measurements].sort((a, b) => {
    const da = a.date || a.recorded_at || '';
    const db = b.date || b.recorded_at || '';
    return da > db ? 1 : -1;
  });

  // Gestione Null: filtra le rilevazioni con valore valido per la metrica selezionata
  const validDataPoints = allChronological
    .map((m) => {
      const rawVal = activeMetric.getter(m);
      const numVal =
        rawVal !== null && rawVal !== undefined && !isNaN(Number(rawVal))
          ? Number(rawVal)
          : null;
      return { measurement: m, value: numVal };
    })
    .filter((item): item is { measurement: BodyMeasurement; value: number } => item.value !== null)
    .slice(-8); // Mostra fino agli ultimi 8 rilevamenti validi

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedPoint =
    selectedIndex !== null && selectedIndex < validDataPoints.length
      ? validDataPoints[selectedIndex]
      : validDataPoints[validDataPoints.length - 1];

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

  const values = validDataPoints.map((p) => p.value);
  const hasEnoughData = validDataPoints.length >= 2;

  let minValue = 0;
  let maxValue = 0;
  let range = 1;
  let totalDelta = 0;
  let isImproved: boolean | null = null;

  if (hasEnoughData) {
    minValue = Math.min(...values);
    maxValue = Math.max(...values);
    range = maxValue - minValue === 0 ? 1 : maxValue - minValue;
    const firstVal = values[0];
    const lastVal = values[values.length - 1];
    totalDelta = Math.round((lastVal - firstVal) * 10) / 10;

    if (totalDelta !== 0) {
      if (activeMetric.isDesirableIncrease) {
        isImproved = totalDelta > 0;
      } else {
        isImproved = totalDelta < 0;
      }
    }
  }

  return (
    <Card style={styles.container}>
      {/* Chart Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={typography.label}>ANALISI GRAFICA PARAMETRI</Text>
          <Text style={typography.h2} numberOfLines={1}>
            {activeMetric.label} Trend
          </Text>
        </View>

        {hasEnoughData && (
          <View
            style={[
              styles.deltaTag,
              {
                backgroundColor:
                  isImproved === true
                    ? 'rgba(16, 185, 129, 0.15)'
                    : isImproved === false
                    ? 'rgba(239, 68, 68, 0.15)'
                    : colors.backgroundSubtle,
              },
            ]}
          >
            <Text
              style={[
                styles.deltaTagText,
                {
                  color:
                    isImproved === true
                      ? colors.emerald
                      : isImproved === false
                      ? colors.danger
                      : colors.textSecondary,
                },
              ]}
            >
              {totalDelta > 0 ? '+' : ''}
              {totalDelta.toFixed(activeMetric.decimals)} {activeMetric.unit}{' '}
              {isImproved === true ? '📈' : isImproved === false ? '📉' : '➖'}
            </Text>
          </View>
        )}
      </View>

      {/* Metric Selector: Horizontal ScrollView with Chips */}
      <View style={styles.selectorWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScrollContainer}
        >
          {TREND_METRICS.map((metric) => {
            const isSelected = metric.key === selectedMetricKey;
            return (
              <Pressable
                key={metric.key}
                onPress={() => {
                  setSelectedMetricKey(metric.key);
                  setSelectedIndex(null);
                }}
                style={[
                  styles.metricChip,
                  isSelected && styles.metricChipSelected,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Seleziona metrica ${metric.label}`}
              >
                <Text
                  style={[
                    styles.metricChipText,
                    isSelected && styles.metricChipTextSelected,
                  ]}
                >
                  {metric.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Case 1: Insufficient Data Points (< 2) for this metric */}
      {!hasEnoughData ? (
        <View style={styles.emptyMetricContainer}>
          <Text style={styles.emptyMetricIcon}>📉</Text>
          <Text style={typography.bodyBold}>
            Dati insufficienti per {activeMetric.label}
          </Text>
          <Text style={styles.emptyMetricText}>
            Registra almeno 2 misurazioni con questo parametro per visualizzare la curva di andamento.
          </Text>
          {onAddPress && (
            <Pressable onPress={onAddPress} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Nuova Pesata</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          {/* Interactive Tooltip Box on Selected Point */}
          {selectedPoint && (
            <View style={styles.tooltipBox}>
              <View style={styles.tooltipHeader}>
                <Text style={styles.tooltipDate}>
                  📅 {formatDateFull(selectedPoint.measurement.date || selectedPoint.measurement.recorded_at)}
                </Text>
                <Text style={styles.tooltipValue}>
                  {selectedPoint.value.toFixed(activeMetric.decimals)} {activeMetric.unit}
                </Text>
              </View>

              {/* Sub-Badges for other available biometrics on the same day */}
              <View style={styles.tooltipSubRow}>
                {activeMetric.key !== 'weight_kg' && (
                  <Text style={styles.tooltipPill}>
                    Peso: {(selectedPoint.measurement.weight ?? selectedPoint.measurement.weight_kg).toFixed(1)} kg
                  </Text>
                )}
                {activeMetric.key !== 'body_fat_pct' &&
                  (selectedPoint.measurement.body_fat_percentage ?? selectedPoint.measurement.body_fat_pct) !== undefined &&
                  (selectedPoint.measurement.body_fat_percentage ?? selectedPoint.measurement.body_fat_pct) !== null && (
                    <Text style={styles.tooltipPill}>
                      Grasso:{' '}
                      {(selectedPoint.measurement.body_fat_percentage ?? selectedPoint.measurement.body_fat_pct)!.toFixed(1)}%
                    </Text>
                  )}
                {activeMetric.key !== 'muscle_mass_kg' &&
                  selectedPoint.measurement.muscle_mass_kg !== undefined &&
                  selectedPoint.measurement.muscle_mass_kg !== null && (
                    <Text style={styles.tooltipPill}>
                      Muscolo: {selectedPoint.measurement.muscle_mass_kg.toFixed(1)} kg
                    </Text>
                  )}
                {activeMetric.key !== 'bmi' &&
                  selectedPoint.measurement.bmi !== undefined &&
                  selectedPoint.measurement.bmi !== null && (
                    <Text style={styles.tooltipPill}>
                      BMI: {selectedPoint.measurement.bmi.toFixed(1)}
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
                <Text style={styles.yAxisLabel}>
                  {maxValue.toFixed(activeMetric.decimals)} {activeMetric.unit}
                </Text>
                <View style={styles.gridLine} />
              </View>
              <View style={styles.yAxisLineRow}>
                <Text style={styles.yAxisLabel}>
                  {((maxValue + minValue) / 2).toFixed(activeMetric.decimals)} {activeMetric.unit}
                </Text>
                <View style={[styles.gridLine, styles.gridLineMid]} />
              </View>
              <View style={styles.yAxisLineRow}>
                <Text style={styles.yAxisLabel}>
                  {minValue.toFixed(activeMetric.decimals)} {activeMetric.unit}
                </Text>
                <View style={styles.gridLine} />
              </View>
            </View>

            {/* Data Columns & Curve Points */}
            <View style={styles.plotArea}>
              {validDataPoints.map((item, idx) => {
                const normalizedHeight = (item.value - minValue) / range;
                const bottomPct = Math.round(15 + normalizedHeight * 65);
                const isSelected =
                  selectedIndex === idx || (selectedIndex === null && idx === validDataPoints.length - 1);

                return (
                  <Pressable
                    key={`point-${item.measurement.id}-${idx}`}
                    onPress={() => setSelectedIndex(idx)}
                    style={styles.dataColumn}
                    accessibilityRole="button"
                    accessibilityLabel={`${activeMetric.label} il ${formatDateShort(
                      item.measurement.date || item.measurement.recorded_at
                    )}: ${item.value.toFixed(activeMetric.decimals)} ${activeMetric.unit}`}
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
                        numberOfLines={1}
                      >
                        {item.value.toFixed(activeMetric.decimals)}
                      </Text>
                    </View>

                    {/* X-Axis Date Label */}
                    <Text
                      style={[
                        styles.xAxisLabel,
                        isSelected && styles.xAxisLabelActive,
                      ]}
                    >
                      {formatDateShort(item.measurement.date || item.measurement.recorded_at)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Text style={styles.tapHint}>
            💡 Seleziona le pillole in alto per cambiare metrica • Tocca i punti della curva per i dettagli
          </Text>
        </>
      )}
    </Card>
  );
};

// Backward-compatible alias
export const WeightTrendChart = MeasurementTrendChart;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  deltaTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  deltaTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  selectorWrapper: {
    marginBottom: 12,
  },
  chipsScrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  metricChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  metricChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  metricChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  metricChipTextSelected: {
    color: colors.white,
    fontWeight: '900',
  },
  emptyMetricContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyMetricIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyMetricText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  addBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.accent,
    borderRadius: layout.borderRadiusSm,
  },
  addBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  tooltipBox: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 14,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tooltipDate: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tooltipValue: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.accent,
  },
  tooltipSubRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tooltipPill: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  canvasContainer: {
    height: 180,
    position: 'relative',
    marginTop: 4,
    marginBottom: 4,
  },
  yAxisOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  yAxisLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  yAxisLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    width: 60,
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  gridLineMid: {
    borderStyle: 'dashed',
  },
  plotArea: {
    position: 'absolute',
    top: 0,
    left: 64,
    right: 8,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    zIndex: 2,
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
    top: 0,
    bottom: 24,
    width: 1,
    backgroundColor: 'transparent',
  },
  verticalGuideActive: {
    backgroundColor: 'rgba(14, 165, 233, 0.3)',
  },
  dataPointContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataPoint: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataPointActive: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderColor: '#38BDF8',
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  dataPointInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  pointWeightText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 2,
  },
  pointWeightTextActive: {
    color: colors.accent,
    fontWeight: '900',
    fontSize: 10,
  },
  xAxisLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 4,
    height: 18,
  },
  xAxisLabelActive: {
    color: colors.text,
    fontWeight: '800',
  },
  tapHint: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});

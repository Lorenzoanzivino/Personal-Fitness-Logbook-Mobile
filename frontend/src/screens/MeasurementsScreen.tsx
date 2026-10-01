import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TabNavigationProp } from '../types/navigation';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Card } from '../components/Card';
import { useMeasurements } from '../context/MeasurementContext';
import { BodyMeasurement } from '../types/measurement';
import { CustomConfirmModal } from '../components/CustomConfirmModal';
import { ToastFeedback, ToastType } from '../components/ToastFeedback';
import { ScreenBackgroundWrapper } from '../components/ScreenBackgroundWrapper';
import { MeasurementTrendChart } from '../components/MeasurementTrendChart';
import { calculateDelta, MetricType } from '../utils/measurementDelta';

export const MeasurementsScreen: React.FC = () => {
  const navigation = useNavigation<TabNavigationProp<'Measurements'>>();
  const {
    measurements,
    latestMeasurement,
    isReadOnly,
    activeOwnerName,
    deleteMeasurement,
    reloadMeasurements,
  } = useMeasurements();

  const [refreshing, setRefreshing] = useState(false);

  // Expanded card tracking (allow single expanded at a time, default to first)
  const [expandedId, setExpandedId] = useState<number | null>(
    measurements.length > 0 ? measurements[0].id : null
  );

  // Custom Confirm Modal & Toast state
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [toast, setToast] = useState<{ visible: boolean; type: ToastType; message: string }>({
    visible: false,
    type: 'info',
    message: '',
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await reloadMeasurements();
      setToast({
        visible: true,
        type: 'success',
        message: 'Misurazioni aggiornate con successo!',
      });
    } catch {
      setToast({
        visible: true,
        type: 'error',
        message: "Errore durante l'aggiornamento delle misurazioni.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const handleDeleteConfirm = (m: BodyMeasurement) => {
    if (isReadOnly) {
      setToast({
        visible: true,
        type: 'error',
        message: "Azione non consentita: le misurazioni dell'atleta sono consultabili esclusivamente in sola lettura.",
      });
      return;
    }

    const weightVal = (m.weight ?? m.weight_kg ?? 0).toFixed(1);
    const dateFormatted = formatDate(m.date || m.recorded_at);

    setConfirmModal({
      visible: true,
      title: 'Elimina Rilevazione',
      message: `Vuoi davvero eliminare la pesata di ${weightVal} kg registrata il ${dateFormatted}?`,
      onConfirm: async () => {
        try {
          await deleteMeasurement(m.id);
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          setToast({
            visible: true,
            type: 'success',
            message: 'Rilevazione eliminata con successo.',
          });
        } catch {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          setToast({
            visible: true,
            type: 'error',
            message: "Errore durante l'eliminazione della pesata.",
          });
        }
      },
    });
  };

  const renderDetailItem = (
    label: string,
    currentVal: number | null | undefined,
    prevVal: number | null | undefined,
    metricType: MetricType,
    unit: string = '',
    decimals: number = 1
  ) => {
    const deltaRes = calculateDelta(currentVal, prevVal, metricType, unit, decimals);

    return (
      <View style={styles.detailItem} key={label}>
        <Text style={styles.detailLabel}>{label}</Text>
        {deltaRes ? (
          <Text style={styles.detailValue}>
            {deltaRes.absoluteText}
            {deltaRes.hasDelta && (
              <Text style={{ color: deltaRes.color, fontWeight: '700', fontSize: 11 }}>
                {' '}{deltaRes.deltaText}
              </Text>
            )}
          </Text>
        ) : (
          <Text style={[styles.detailValue, { color: colors.textMuted }]}>
            Non rilevato
          </Text>
        )}
      </View>
    );
  };

  // Chronological previous for latest measurement (index 1 if measurements is sorted desc)
  const secondMeasurement = measurements.length > 1 ? measurements[1] : undefined;
  const latestWeightDelta = calculateDelta(
    latestMeasurement?.weight ?? latestMeasurement?.weight_kg,
    secondMeasurement?.weight ?? secondMeasurement?.weight_kg,
    'weight',
    'kg',
    1
  );

  return (
    <ScreenBackgroundWrapper style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={typography.caption}>
              {isReadOnly && activeOwnerName
                ? `COMPOSIZIONE CORPOREA • ${activeOwnerName.toUpperCase()}`
                : 'COMPOSIZIONE CORPOREA & BIOIMPEDENZA'}
            </Text>
            <Text style={typography.h1}>Misurazioni</Text>
          </View>
          {!isReadOnly ? (
            <Pressable
              onPress={() => navigation.navigate('MeasurementModal')}
              style={({ pressed }) => [
                styles.actionButton,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Registra nuova pesata corporea"
            >
              <Text style={styles.actionButtonText}>+ Nuova Pesata</Text>
            </Pressable>
          ) : (
            <View style={styles.readOnlyTag}>
              <Text style={styles.readOnlyTagText}>👁️ Sola Lettura</Text>
            </View>
          )}
        </View>

        {/* Read-Only Callout Banner */}
        {isReadOnly && (
          <View style={styles.readOnlyBanner}>
            <Text style={styles.readOnlyBannerTitle}>👁️ VISUALIZZAZIONE DATI ATLETA</Text>
            <Text style={styles.readOnlyBannerText}>
              Stai consultando le rilevazioni corporee di {activeOwnerName || "l'atleta"}. Per garantire la massima privacy e l'isolamento dei dati personali, le misurazioni possono essere aggiunte o modificate solo dal profilo personale dell'atleta.
            </Text>
          </View>
        )}

        {/* Main Metric Card */}
        {latestMeasurement ? (
          <Card highlighted style={styles.mainCard}>
            <View style={styles.mainCardTop}>
              <Text style={typography.label}>ULTIMA RILEVAZIONE BILANCIA</Text>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>SMART SCALE</Text>
              </View>
            </View>

            <View style={styles.weightRow}>
              <Text style={typography.metric}>
                {(latestMeasurement.weight ?? latestMeasurement.weight_kg).toFixed(1)}
              </Text>
              <Text style={styles.weightUnit}>kg</Text>
              {latestWeightDelta?.hasDelta && (
                <View
                  style={[
                    styles.deltaPill,
                    {
                      backgroundColor:
                        latestWeightDelta.isImprovement === true
                          ? 'rgba(16, 185, 129, 0.15)'
                          : latestWeightDelta.isImprovement === false
                          ? 'rgba(239, 68, 68, 0.15)'
                          : colors.backgroundSubtle,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.deltaPillText,
                      { color: latestWeightDelta.color },
                    ]}
                  >
                    {latestWeightDelta.deltaText} vs prec.
                  </Text>
                </View>
              )}
            </View>

            <Text style={typography.caption}>
              Rilevato il {formatDate(latestMeasurement.date || latestMeasurement.recorded_at)}
              {formatTime(latestMeasurement.date || latestMeasurement.recorded_at)
                ? ` alle ${formatTime(latestMeasurement.date || latestMeasurement.recorded_at)}`
                : ''}
            </Text>

            <View style={styles.statsDivider} />

            {/* Quick Metrics Grid */}
            <View style={styles.subMetricsRow}>
              <View style={styles.subMetricCol}>
                <Text style={typography.caption}>Massa Grassa</Text>
                <Text style={typography.bodyBold}>
                  {latestMeasurement.body_fat_percentage ?? latestMeasurement.body_fat_pct
                    ? `${(latestMeasurement.body_fat_percentage ?? latestMeasurement.body_fat_pct)!.toFixed(1)}%`
                    : '--'}
                </Text>
              </View>
              <View style={styles.subMetricCol}>
                <Text style={typography.caption}>Massa Magra</Text>
                <Text style={typography.bodyBold}>
                  {latestMeasurement.lean_mass_kg
                    ? `${latestMeasurement.lean_mass_kg.toFixed(1)} kg`
                    : '--'}
                </Text>
              </View>
              <View style={styles.subMetricCol}>
                <Text style={typography.caption}>Massa Muscol.</Text>
                <Text style={typography.bodyBold}>
                  {latestMeasurement.muscle_mass_kg
                    ? `${latestMeasurement.muscle_mass_kg.toFixed(1)} kg`
                    : '--'}
                </Text>
              </View>
              <View style={styles.subMetricCol}>
                <Text style={typography.caption}>BMI</Text>
                <Text style={typography.bodyBold}>
                  {latestMeasurement.bmi ? latestMeasurement.bmi.toFixed(1) : '--'}
                </Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyCardIcon}>⚖️</Text>
            <Text style={typography.h3}>Nessuna pesata registrata</Text>
            <Text style={[typography.caption, { textAlign: 'center', marginTop: 4 }]}>
              Registra la tua prima pesata con tutti i parametri della bilancia smart.
            </Text>
          </Card>
        )}

        {/* Dynamic Metric Trend Chart */}
        <MeasurementTrendChart
          measurements={measurements}
          onAddPress={isReadOnly ? undefined : () => navigation.navigate('MeasurementModal')}
        />

        {/* Storico Rilevazioni */}
        <View style={styles.sectionHeaderRow}>
          <Text style={typography.h3}>Storico Rilevazioni Bilancia</Text>
          <Text style={typography.caption}>
            {measurements.length} pesat{measurements.length === 1 ? 'a' : 'e'}
          </Text>
        </View>

        <Text style={styles.expandHintText}>
          💡 Tocca una card per espandere e consultare tutti i dettagli impedenziometrici
        </Text>

        {measurements.map((m, idx) => {
          const isExpanded = expandedId === m.id;
          const prev = measurements[idx + 1];
          const dateStr = m.date || m.recorded_at;
          const weightDelta = calculateDelta(
            m.weight ?? m.weight_kg,
            prev?.weight ?? prev?.weight_kg,
            'weight',
            'kg',
            1
          );

          return (
            <Card key={m.id} style={styles.historyCard}>
              <Pressable
                onPress={() => toggleExpand(m.id)}
                style={styles.historyHeaderPressable}
              >
                <View style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.weightLine}>
                      <Text style={styles.historyWeightText}>
                        {(m.weight ?? m.weight_kg).toFixed(1)} kg
                      </Text>
                      {weightDelta && weightDelta.hasDelta && (
                        <View
                          style={[
                            styles.deltaMiniBadge,
                            {
                              backgroundColor:
                                weightDelta.isImprovement === true
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : weightDelta.isImprovement === false
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : colors.backgroundSubtle,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.deltaMiniBadgeText,
                              { color: weightDelta.color },
                            ]}
                          >
                            {weightDelta.deltaText}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={typography.caption}>
                      {formatDate(dateStr)}
                      {formatTime(dateStr) ? ` • ${formatTime(dateStr)}` : ''}
                    </Text>
                  </View>

                  <View style={styles.expandRight}>
                    <Text style={styles.expandToggleText}>
                      {isExpanded ? '▲ Riduci' : '▼ Dettagli'}
                    </Text>
                  </View>
                </View>
              </Pressable>

              {/* Expanded Full Smart Scale Parameters */}
              {isExpanded && (
                <View style={styles.expandedDetailsContainer}>
                  <View style={styles.expandedDivider} />

                  <Text style={styles.expandedSectionTitle}>
                    PARAMETRI IMPEDENZIOMETRICI COMPLETI
                  </Text>

                  <View style={styles.detailsGrid}>
                    {renderDetailItem(
                      'Peso',
                      m.weight ?? m.weight_kg,
                      prev?.weight ?? prev?.weight_kg,
                      'weight',
                      'kg',
                      1
                    )}
                    {renderDetailItem('BMI', m.bmi, prev?.bmi, 'bmi', '', 1)}
                    {renderDetailItem(
                      'Grasso Corporeo',
                      m.body_fat_percentage ?? m.body_fat_pct,
                      prev?.body_fat_percentage ?? prev?.body_fat_pct,
                      'body_fat',
                      '%',
                      1
                    )}
                    {renderDetailItem(
                      'Massa Muscolare',
                      m.muscle_mass_kg,
                      prev?.muscle_mass_kg,
                      'muscle_mass',
                      'kg',
                      1
                    )}
                    {renderDetailItem(
                      'Metabolismo Basale (BMR)',
                      m.bmr ?? m.bmr_kcal,
                      prev?.bmr ?? prev?.bmr_kcal,
                      'bmr',
                      'Kcal',
                      0
                    )}
                    {renderDetailItem(
                      'Acqua Corporea',
                      m.water_percentage ?? m.water_pct,
                      prev?.water_percentage ?? prev?.water_pct,
                      'water',
                      '%',
                      1
                    )}
                    {renderDetailItem(
                      'Massa Grassa',
                      m.fat_mass_kg,
                      prev?.fat_mass_kg,
                      'fat_mass',
                      'kg',
                      1
                    )}
                    {renderDetailItem(
                      'Massa Magra',
                      m.lean_mass_kg,
                      prev?.lean_mass_kg,
                      'lean_mass',
                      'kg',
                      1
                    )}
                    {renderDetailItem(
                      'Massa Ossea',
                      m.bone_mass_kg,
                      prev?.bone_mass_kg,
                      'bone_mass',
                      'kg',
                      1
                    )}
                    {renderDetailItem(
                      'Grasso Viscerale',
                      m.visceral_fat,
                      prev?.visceral_fat,
                      'visceral_fat',
                      'liv.',
                      0
                    )}
                    {renderDetailItem(
                      'Proteine',
                      m.protein_percentage,
                      prev?.protein_percentage,
                      'protein',
                      '%',
                      1
                    )}
                    {renderDetailItem(
                      'Muscolo Scheletrico',
                      m.skeletal_muscle_mass_kg,
                      prev?.skeletal_muscle_mass_kg,
                      'skeletal_muscle',
                      'kg',
                      1
                    )}
                    {renderDetailItem(
                      'Grasso Sottocutaneo',
                      m.subcutaneous_fat_percentage,
                      prev?.subcutaneous_fat_percentage,
                      'subcutaneous_fat',
                      '%',
                      1
                    )}
                    {m.amr_kcal !== null && m.amr_kcal !== undefined && (
                      renderDetailItem(
                        'Fabbisogno Attivo (AMR)',
                        m.amr_kcal,
                        prev?.amr_kcal,
                        'bmr',
                        'Kcal',
                        0
                      )
                    )}
                  </View>

                  {m.notes && (
                    <View style={styles.notesBox}>
                      <Text style={styles.notesLabel}>Note rilevazione:</Text>
                      <Text style={styles.notesContent}>{m.notes}</Text>
                    </View>
                  )}

                  {!isReadOnly && (
                    <View style={styles.expandedFooter}>
                      <Pressable
                        onPress={() => navigation.navigate('MeasurementModal', { measurementId: m.id })}
                        style={styles.editButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Modifica pesata del ${formatDate(dateStr)}`}
                      >
                        <Text style={styles.editButtonText}>✏️ Modifica</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleDeleteConfirm(m)}
                        style={styles.deleteButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Elimina pesata del ${formatDate(dateStr)}`}
                      >
                        <Text style={styles.deleteButtonText}>🗑 Elimina</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>

      {/* Confirm Dialog */}
      <CustomConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Elimina"
        isDestructive
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
      />

      {/* Toast Feedback */}
      <ToastFeedback
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </ScreenBackgroundWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    padding: 14,
    paddingBottom: 140,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: layout.borderRadiusLg,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  mainCard: {
    marginBottom: 16,
    padding: 16,
  },
  mainCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 4,
  },
  weightUnit: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 4,
    marginRight: 12,
  },
  deltaPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: layout.borderRadiusLg,
  },
  deltaPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  subMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subMetricCol: {
    alignItems: 'flex-start',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyCardIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 16,
    marginBottom: 4,
  },
  expandHintText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  historyCard: {
    marginBottom: 10,
    padding: 14,
  },
  historyHeaderPressable: {
    width: '100%',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weightLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  historyWeightText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  deltaMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deltaMiniBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  expandRight: {
    paddingLeft: 8,
  },
  expandToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  expandedDetailsContainer: {
    marginTop: 10,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  expandedSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailItem: {
    width: '48%',
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusSm,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  detailLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  notesBox: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusSm,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  notesContent: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 16,
  },
  expandedFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
  },
  editButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
    marginRight: 8,
  },
  editButtonText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  deleteButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  readOnlyBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: '#3B82F6',
    borderWidth: 1,
    borderRadius: layout.borderRadiusSm,
    padding: 12,
    marginBottom: 16,
  },
  readOnlyBannerTitle: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  readOnlyBannerText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  readOnlyTag: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3B82F6',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: layout.borderRadiusSm,
  },
  readOnlyTagText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '700',
  },
});

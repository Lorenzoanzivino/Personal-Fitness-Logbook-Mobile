import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
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

export const MeasurementsScreen: React.FC = () => {
  const navigation = useNavigation<TabNavigationProp<'Measurements'>>();
  const { measurements, latestMeasurement, deleteMeasurement } = useMeasurements();

  // Expanded card tracking (allow multiple or single expanded)
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

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleDeleteConfirm = (m: BodyMeasurement) => {
    setConfirmModal({
      visible: true,
      title: 'Elimina Rilevazione',
      message: `Vuoi davvero eliminare la pesata di ${m.weight_kg.toFixed(1)} kg registrata il ${formatDate(m.recorded_at)}?`,
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
            message: 'Errore durante l\'eliminazione della pesata.',
          });
        }
      },
    });
  };

  const formatDate = (dateStr: string): string => {
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

  const formatTime = (dateStr: string): string => {
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

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={typography.caption}>COMPOSIZIONE CORPOREA & BIOIMPEDENZA</Text>
            <Text style={typography.h1}>Misurazioni</Text>
          </View>
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
        </View>

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
              <Text style={typography.metric}>{latestMeasurement.weight_kg.toFixed(1)}</Text>
              <Text style={styles.weightUnit}>kg</Text>
              {latestMeasurement.weight_delta_kg !== null &&
                latestMeasurement.weight_delta_kg !== undefined && (
                  <View
                    style={[
                      styles.deltaPill,
                      {
                        backgroundColor:
                          latestMeasurement.weight_delta_kg < 0
                            ? 'rgba(16, 185, 129, 0.15)'
                            : latestMeasurement.weight_delta_kg > 0
                            ? 'rgba(245, 158, 11, 0.15)'
                            : colors.backgroundSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.deltaPillText,
                        {
                          color:
                            latestMeasurement.weight_delta_kg < 0
                              ? colors.emerald
                              : latestMeasurement.weight_delta_kg > 0
                              ? colors.warning
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {latestMeasurement.weight_delta_kg > 0 ? '+' : ''}
                      {latestMeasurement.weight_delta_kg.toFixed(1)} kg vs prec.
                    </Text>
                  </View>
                )}
            </View>

            <Text style={typography.caption}>
              Rilevato il {formatDate(latestMeasurement.recorded_at)} alle{' '}
              {formatTime(latestMeasurement.recorded_at)}
            </Text>

            <View style={styles.statsDivider} />

            {/* Quick Metrics Grid */}
            <View style={styles.subMetricsRow}>
              <View style={styles.subMetricCol}>
                <Text style={typography.caption}>Massa Grassa</Text>
                <Text style={typography.bodyBold}>
                  {latestMeasurement.body_fat_pct
                    ? `${latestMeasurement.body_fat_pct.toFixed(1)}%`
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

        {measurements.map((m) => {
          const isExpanded = expandedId === m.id;

          return (
            <Card key={m.id} style={styles.historyCard}>
              <Pressable
                onPress={() => toggleExpand(m.id)}
                style={styles.historyHeaderPressable}
              >
                <View style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.weightLine}>
                      <Text style={styles.historyWeightText}>{m.weight_kg.toFixed(1)} kg</Text>
                      {m.weight_delta_kg !== null && m.weight_delta_kg !== undefined && (
                        <View
                          style={[
                            styles.deltaMiniBadge,
                            {
                              backgroundColor:
                                m.weight_delta_kg < 0
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : m.weight_delta_kg > 0
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : colors.backgroundSubtle,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.deltaMiniBadgeText,
                              {
                                color:
                                  m.weight_delta_kg < 0
                                    ? colors.emerald
                                    : m.weight_delta_kg > 0
                                    ? colors.warning
                                    : colors.textSecondary,
                              },
                            ]}
                          >
                            {m.weight_delta_kg > 0 ? '+' : ''}
                            {m.weight_delta_kg.toFixed(1)} kg
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={typography.caption}>
                      {formatDate(m.recorded_at)} • {formatTime(m.recorded_at)}
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
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Massa Grassa</Text>
                      <Text style={styles.detailValue}>
                        {m.body_fat_pct !== null && m.body_fat_pct !== undefined
                          ? `${m.body_fat_pct.toFixed(1)}%`
                          : 'Non rilevata'}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Massa Magra</Text>
                      <Text style={styles.detailValue}>
                        {m.lean_mass_kg !== null && m.lean_mass_kg !== undefined
                          ? `${m.lean_mass_kg.toFixed(1)} kg`
                          : 'Non rilevata'}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Massa Muscolare</Text>
                      <Text style={styles.detailValue}>
                        {m.muscle_mass_kg !== null && m.muscle_mass_kg !== undefined
                          ? `${m.muscle_mass_kg.toFixed(1)} kg`
                          : 'Non rilevata'}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Acqua Corporea</Text>
                      <Text style={styles.detailValue}>
                        {m.water_pct !== null && m.water_pct !== undefined
                          ? `${m.water_pct.toFixed(1)}%`
                          : 'Non rilevata'}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Massa Ossea</Text>
                      <Text style={styles.detailValue}>
                        {m.bone_mass_kg !== null && m.bone_mass_kg !== undefined
                          ? `${m.bone_mass_kg.toFixed(1)} kg`
                          : 'Non rilevata'}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Grasso Viscerale</Text>
                      <Text style={styles.detailValue}>
                        {m.visceral_fat !== null && m.visceral_fat !== undefined
                          ? `Livello ${m.visceral_fat}`
                          : 'Non rilevato'}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>BMI (Indice Corporeo)</Text>
                      <Text style={styles.detailValue}>
                        {m.bmi !== null && m.bmi !== undefined
                          ? `${m.bmi.toFixed(1)}`
                          : 'Non calcolato'}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Metabolismo Basale (BMR)</Text>
                      <Text style={styles.detailValue}>
                        {m.bmr_kcal !== null && m.bmr_kcal !== undefined
                          ? `${m.bmr_kcal} kcal`
                          : 'Non rilevato'}
                      </Text>
                    </View>

                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Fabbisogno Attivo (AMR)</Text>
                      <Text style={styles.detailValue}>
                        {m.amr_kcal !== null && m.amr_kcal !== undefined
                          ? `${m.amr_kcal} kcal`
                          : 'Non rilevato'}
                      </Text>
                    </View>
                  </View>

                  {m.notes && (
                    <View style={styles.notesBox}>
                      <Text style={styles.notesLabel}>Note rilevazione:</Text>
                      <Text style={styles.notesContent}>{m.notes}</Text>
                    </View>
                  )}

                  <View style={styles.expandedFooter}>
                    <Pressable
                      onPress={() => handleDeleteConfirm(m)}
                      style={styles.deleteButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Elimina pesata del ${formatDate(m.recorded_at)}`}
                    >
                      <Text style={styles.deleteButtonText}>🗑 Elimina Rilevazione</Text>
                    </Pressable>
                  </View>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 96,
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
    marginBottom: 20,
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
    marginBottom: 20,
  },
  emptyCardIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 8,
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
    marginTop: 10,
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
});

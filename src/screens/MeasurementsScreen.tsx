import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
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

export const MeasurementsScreen: React.FC = () => {
  const navigation = useNavigation<TabNavigationProp<'Measurements'>>();
  const scrollViewRef = useRef<ScrollView>(null);
  const {
    measurements,
    latestMeasurement,
    isReadOnly,
    activeOwnerName,
    addMeasurement,
    updateMeasurement,
    deleteMeasurement,
    reloadMeasurements,
  } = useMeasurements();

  const [refreshing, setRefreshing] = useState(false);

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

  // Expanded card tracking (allow multiple or single expanded)
  const [expandedId, setExpandedId] = useState<number | null>(
    measurements.length > 0 ? measurements[0].id : null
  );

  // Edit Mode & Form States
  const [editingMeasurementId, setEditingMeasurementId] = useState<number | null>(null);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formWeight, setFormWeight] = useState('');
  const [formBmi, setFormBmi] = useState('');
  const [formBodyFat, setFormBodyFat] = useState('');
  const [formLeanMass, setFormLeanMass] = useState('');
  const [formMuscleMass, setFormMuscleMass] = useState('');
  const [formNotes, setFormNotes] = useState('');

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
    if (isReadOnly) {
      setToast({
        visible: true,
        type: 'error',
        message: "Azione non consentita: le misurazioni dell'atleta sono consultabili esclusivamente in sola lettura.",
      });
      return;
    }

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

  const handleStartEdit = (m: BodyMeasurement) => {
    if (isReadOnly) {
      setToast({
        visible: true,
        type: 'error',
        message: "Azione non consentita: le misurazioni dell'atleta sono consultabili esclusivamente in sola lettura.",
      });
      return;
    }

    setEditingMeasurementId(m.id);
    setFormDate(m.recorded_at ? m.recorded_at.split('T')[0] : new Date().toISOString().split('T')[0]);
    setFormWeight(m.weight_kg !== undefined && m.weight_kg !== null ? String(m.weight_kg) : '');
    setFormBmi(m.bmi !== undefined && m.bmi !== null ? String(m.bmi) : '');
    setFormBodyFat(m.body_fat_pct !== undefined && m.body_fat_pct !== null ? String(m.body_fat_pct) : '');
    setFormLeanMass(m.lean_mass_kg !== undefined && m.lean_mass_kg !== null ? String(m.lean_mass_kg) : '');
    setFormMuscleMass(m.muscle_mass_kg !== undefined && m.muscle_mass_kg !== null ? String(m.muscle_mass_kg) : '');
    setFormNotes(m.notes || '');

    // Scroll to top
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    setToast({
      visible: true,
      type: 'info',
      message: 'Misurazione caricata nel modulo. Modifica i dati e premi "Aggiorna Misurazione".',
    });
  };

  const handleCancelEdit = () => {
    setEditingMeasurementId(null);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormWeight('');
    setFormBmi('');
    setFormBodyFat('');
    setFormLeanMass('');
    setFormMuscleMass('');
    setFormNotes('');
  };

  const handleSaveOrUpdate = async () => {
    if (isReadOnly) {
      setToast({
        visible: true,
        type: 'error',
        message: "Azione non consentita: le misurazioni dell'atleta sono consultabili esclusivamente in sola lettura.",
      });
      return;
    }

    const cleanWeight = parseFloat(formWeight.replace(',', '.'));
    if (isNaN(cleanWeight) || cleanWeight <= 0 || cleanWeight > 350) {
      setToast({
        visible: true,
        type: 'error',
        message: 'Inserisci un valore valido per il peso in kg (es. 78.5).',
      });
      return;
    }

    const parsedBmi = formBmi.trim() ? parseFloat(formBmi.replace(',', '.')) : undefined;
    const parsedBf = formBodyFat.trim() ? parseFloat(formBodyFat.replace(',', '.')) : undefined;
    const parsedLean = formLeanMass.trim() ? parseFloat(formLeanMass.replace(',', '.')) : undefined;
    const parsedMuscle = formMuscleMass.trim() ? parseFloat(formMuscleMass.replace(',', '.')) : undefined;

    try {
      if (editingMeasurementId !== null) {
        await updateMeasurement(editingMeasurementId, {
          recorded_at: formDate.trim() ? `${formDate.trim()}T12:00:00.000Z` : new Date().toISOString(),
          weight_kg: cleanWeight,
          bmi: parsedBmi !== undefined && !isNaN(parsedBmi) ? parsedBmi : undefined,
          body_fat_pct: parsedBf !== undefined && !isNaN(parsedBf) ? parsedBf : undefined,
          lean_mass_kg: parsedLean !== undefined && !isNaN(parsedLean) ? parsedLean : undefined,
          muscle_mass_kg: parsedMuscle !== undefined && !isNaN(parsedMuscle) ? parsedMuscle : undefined,
          notes: formNotes.trim() || undefined,
        });

        setToast({
          visible: true,
          type: 'success',
          message: 'Misurazione aggiornata con successo! ⚖️',
        });
      } else {
        await addMeasurement({
          recorded_at: formDate.trim() ? `${formDate.trim()}T12:00:00.000Z` : new Date().toISOString(),
          weight_kg: cleanWeight,
          bmi: parsedBmi !== undefined && !isNaN(parsedBmi) ? parsedBmi : undefined,
          body_fat_pct: parsedBf !== undefined && !isNaN(parsedBf) ? parsedBf : undefined,
          lean_mass_kg: parsedLean !== undefined && !isNaN(parsedLean) ? parsedLean : undefined,
          muscle_mass_kg: parsedMuscle !== undefined && !isNaN(parsedMuscle) ? parsedMuscle : undefined,
          notes: formNotes.trim() || undefined,
        });

        setToast({
          visible: true,
          type: 'success',
          message: 'Nuova misurazione registrata con successo! ⚖️',
        });
      }

      handleCancelEdit();
    } catch {
      setToast({
        visible: true,
        type: 'error',
        message: 'Errore durante il salvataggio della misurazione.',
      });
    }
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
    <ScreenBackgroundWrapper style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
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
              onPress={() => {
                handleCancelEdit();
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              }}
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

        {/* Input & Edit Form Card */}
        {!isReadOnly && (
          <Card style={styles.formCard}>
          <View style={styles.formCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={typography.label}>
                {editingMeasurementId ? 'MODALITÀ MODIFICA' : 'REGISTRAZIONE MISURAZIONE'}
              </Text>
              <Text style={typography.h3}>
                {editingMeasurementId ? 'Modifica Rilevazione' : 'Inserisci Nuova Rilevazione'}
              </Text>
            </View>
            {editingMeasurementId && (
              <View style={styles.editModeBadge}>
                <Text style={styles.editModeBadgeText}>✏️ Modifica Attiva</Text>
              </View>
            )}
          </View>

          {/* Form Fields Grid */}
          <View style={styles.formRow}>
            <View style={[styles.formField, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>DATA (AAAA-MM-GG) *</Text>
              <TextInput
                style={styles.textInput}
                value={formDate}
                onChangeText={setFormDate}
                placeholder="2026-09-16"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={[styles.formField, { flex: 1 }]}>
              <Text style={styles.inputLabel}>PESO (KG) *</Text>
              <TextInput
                style={styles.textInput}
                value={formWeight}
                onChangeText={setFormWeight}
                placeholder="es. 78.5"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formField, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>MASSA GRASSA (%)</Text>
              <TextInput
                style={styles.textInput}
                value={formBodyFat}
                onChangeText={setFormBodyFat}
                placeholder="es. 14.5"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.formField, { flex: 1 }]}>
              <Text style={styles.inputLabel}>MASSA MAGRA (KG)</Text>
              <TextInput
                style={styles.textInput}
                value={formLeanMass}
                onChangeText={setFormLeanMass}
                placeholder="es. 64.0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formField, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>MASSA MUSCOLARE (KG)</Text>
              <TextInput
                style={styles.textInput}
                value={formMuscleMass}
                onChangeText={setFormMuscleMass}
                placeholder="es. 35.2"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.formField, { flex: 1 }]}>
              <Text style={styles.inputLabel}>BMI</Text>
              <TextInput
                style={styles.textInput}
                value={formBmi}
                onChangeText={setFormBmi}
                placeholder="es. 23.4"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.formField}>
            <Text style={styles.inputLabel}>CIRCONFERENZE / NOTE</Text>
            <TextInput
              style={styles.textInput}
              value={formNotes}
              onChangeText={setFormNotes}
              placeholder="es. Girovita: 82cm, Braccio: 38cm, Petto: 104cm"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Form Action Buttons */}
          <View style={styles.formActionsRow}>
            {editingMeasurementId && (
              <Pressable
                onPress={handleCancelEdit}
                style={styles.cancelEditBtn}
                accessibilityRole="button"
                accessibilityLabel="Annulla modifica"
              >
                <Text style={styles.cancelEditBtnText}>✕ Annulla</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleSaveOrUpdate}
              style={[
                styles.saveButton,
                editingMeasurementId ? styles.updateButtonActive : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={editingMeasurementId ? 'Aggiorna Misurazione' : 'Salva Misurazione'}
            >
              <Text style={styles.saveButtonText}>
                {editingMeasurementId ? '💾 Aggiorna Misurazione' : '+ Salva Misurazione'}
              </Text>
            </Pressable>
          </View>
        </Card>
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

                  {!isReadOnly && (
                    <View style={styles.expandedFooter}>
                      <Pressable
                        onPress={() => handleStartEdit(m)}
                        style={styles.editButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Modifica pesata del ${formatDate(m.recorded_at)}`}
                      >
                        <Text style={styles.editButtonText}>✏️ Modifica</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleDeleteConfirm(m)}
                        style={styles.deleteButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Elimina pesata del ${formatDate(m.recorded_at)}`}
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

  // Input & Edit Form Styles
  formCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  formCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editModeBadge: {
    backgroundColor: 'rgba(234, 88, 15, 0.15)',
    borderColor: colors.accent,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  editModeBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  formField: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.borderRadiusSm,
    color: colors.text,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  formActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: layout.borderRadiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonActive: {
    backgroundColor: colors.emerald,
  },
  saveButtonText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 12,
  },
  cancelEditBtn: {
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: layout.borderRadiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelEditBtnText: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 12,
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

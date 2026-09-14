import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { RootStackNavigationProp } from '../../types/navigation';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Card } from '../../components/Card';
import { useMeasurements } from '../../context/MeasurementContext';
import { profileService } from '../../services/profileService';
import { ToastFeedback, ToastType } from '../../components/ToastFeedback';

export const MeasurementModal: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { addMeasurement } = useMeasurements();

  // Profile data for auto-BMI
  const [profileHeightCm, setProfileHeightCm] = useState<number | null>(null);

  // Form states (strings to allow fluent typing with comma or dot)
  const [weightKg, setWeightKg] = useState('');
  const [bmi, setBmi] = useState('');
  const [isBmiManual, setIsBmiManual] = useState(false);

  const [bodyFatPct, setBodyFatPct] = useState('');
  const [leanMassKg, setLeanMassKg] = useState('');
  const [muscleMassKg, setMuscleMassKg] = useState('');
  const [waterPct, setWaterPct] = useState('');
  const [boneMassKg, setBoneMassKg] = useState('');
  const [visceralFat, setVisceralFat] = useState('');
  const [bmrKcal, setBmrKcal] = useState('');
  const [amrKcal, setAmrKcal] = useState('');
  const [notes, setNotes] = useState('');

  // UI feedback states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; type: ToastType; message: string }>({
    visible: false,
    type: 'info',
    message: '',
  });

  const now = new Date();
  const dateFormatted = `${now.toLocaleDateString('it-IT')} ${now.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  useEffect(() => {
    const profile = profileService.getCurrentProfile();
    if (profile.height_cm && profile.height_cm > 50) {
      setProfileHeightCm(profile.height_cm);
    }
  }, []);

  // Helper to parse decimal numbers supporting both comma and dot
  const parseDecimal = (val: string): number | null => {
    if (!val || !val.trim()) return null;
    const clean = val.replace(',', '.').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
  };

  // Handle Weight change and auto-calculate BMI
  const handleWeightChange = (text: string) => {
    setWeightKg(text);
    setErrorMessage(null);

    if (!isBmiManual && profileHeightCm) {
      const parsedWeight = parseDecimal(text);
      if (parsedWeight && parsedWeight > 20 && parsedWeight < 350) {
        const heightM = profileHeightCm / 100;
        const calculatedBmi = (parsedWeight / (heightM * heightM)).toFixed(1);
        setBmi(calculatedBmi);
      } else {
        setBmi('');
      }
    }
  };

  const handleBmiChange = (text: string) => {
    setIsBmiManual(true);
    setBmi(text);
  };

  const handleSave = async () => {
    const parsedWeight = parseDecimal(weightKg);
    if (!parsedWeight || parsedWeight < 20 || parsedWeight > 350) {
      setErrorMessage('Inserisci un valore di peso valido in kg (es. 78.4 o 78,4).');
      return;
    }

    const parsedBmi = parseDecimal(bmi);
    const parsedBf = parseDecimal(bodyFatPct);
    const parsedLean = parseDecimal(leanMassKg);
    const parsedMuscle = parseDecimal(muscleMassKg);
    const parsedWater = parseDecimal(waterPct);
    const parsedBone = parseDecimal(boneMassKg);
    const parsedVisceral = parseDecimal(visceralFat);
    const parsedBmr = parseDecimal(bmrKcal);
    const parsedAmr = parseDecimal(amrKcal);

    try {
      await addMeasurement({
        recorded_at: new Date().toISOString(),
        weight_kg: parsedWeight,
        bmi: parsedBmi ?? undefined,
        body_fat_pct: parsedBf ?? undefined,
        lean_mass_kg: parsedLean ?? undefined,
        muscle_mass_kg: parsedMuscle ?? undefined,
        water_pct: parsedWater ?? undefined,
        bone_mass_kg: parsedBone ?? undefined,
        visceral_fat: parsedVisceral ?? undefined,
        bmr_kcal: parsedBmr ? Math.round(parsedBmr) : undefined,
        amr_kcal: parsedAmr ? Math.round(parsedAmr) : undefined,
        notes: notes.trim() || undefined,
      });

      setToast({
        visible: true,
        type: 'success',
        message: `Pesata di ${parsedWeight.toFixed(1)} kg registrata con successo! ⚖️`,
      });

      setTimeout(() => {
        navigation.goBack();
      }, 700);
    } catch (err) {
      console.warn('Errore salvataggio pesata:', err);
      setErrorMessage('Si è verificato un errore durante il salvataggio.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.modalHeader}>
        <View>
          <Text style={typography.label}>BILANCIA SMART & BIOIMPEDENZA</Text>
          <Text style={typography.h2}>Registra Pesata</Text>
        </View>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Chiudi modale misurazione"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoBadge}>
          <Text style={styles.infoBadgeText}>Data & Ora: {dateFormatted}</Text>
        </View>

        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
          </View>
        )}

        {/* SEZIONE 1: Peso & BMI */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>⚖️ PESO & INDICE CORPOREO</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PESO CORPOREO (KG) *</Text>
            <TextInput
              style={[styles.textInput, styles.weightInput]}
              value={weightKg}
              onChangeText={handleWeightChange}
              keyboardType="decimal-pad"
              placeholder="es. 78.4 o 78,4"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>BMI (INDICE MASSA CORPOREA)</Text>
              {profileHeightCm && !isBmiManual && (
                <Text style={styles.autoBadge}>Auto da {profileHeightCm} cm</Text>
              )}
            </View>
            <TextInput
              style={styles.textInput}
              value={bmi}
              onChangeText={handleBmiChange}
              keyboardType="decimal-pad"
              placeholder={
                profileHeightCm
                  ? 'Calcolato in automatico dal peso...'
                  : 'es. 24.2 (Imposta altezza nel Profilo per il calcolo)'
              }
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </Card>

        {/* SEZIONE 2: Composizione Corporea (Massa & Acqua) */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🧬 COMPOSIZIONE CORPOREA</Text>

          <View style={styles.twoColRow}>
            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>MASSA GRASSA (%)</Text>
              <TextInput
                style={styles.textInput}
                value={bodyFatPct}
                onChangeText={setBodyFatPct}
                keyboardType="decimal-pad"
                placeholder="es. 14.2"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>MASSA MAGRA (KG)</Text>
              <TextInput
                style={styles.textInput}
                value={leanMassKg}
                onChangeText={setLeanMassKg}
                keyboardType="decimal-pad"
                placeholder="es. 67.3"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.twoColRow}>
            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>MASSA MUSCOLARE (KG)</Text>
              <TextInput
                style={styles.textInput}
                value={muscleMassKg}
                onChangeText={setMuscleMassKg}
                keyboardType="decimal-pad"
                placeholder="es. 64.5"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>ACQUA (%)</Text>
              <TextInput
                style={styles.textInput}
                value={waterPct}
                onChangeText={setWaterPct}
                keyboardType="decimal-pad"
                placeholder="es. 61.5"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.twoColRow}>
            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>MASSA OSSEA (KG)</Text>
              <TextInput
                style={styles.textInput}
                value={boneMassKg}
                onChangeText={setBoneMassKg}
                keyboardType="decimal-pad"
                placeholder="es. 3.4"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>GRASSO VISCERALE</Text>
              <TextInput
                style={styles.textInput}
                value={visceralFat}
                onChangeText={setVisceralFat}
                keyboardType="decimal-pad"
                placeholder="es. 4 (1-12)"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </Card>

        {/* SEZIONE 3: Metabolismo (BMR / AMR) */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🔥 DISPENDIO ENERGETICO</Text>

          <View style={styles.twoColRow}>
            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>BMR - BASALE (KCAL)</Text>
              <TextInput
                style={styles.textInput}
                value={bmrKcal}
                onChangeText={setBmrKcal}
                keyboardType="number-pad"
                placeholder="es. 1750"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>AMR - ATTIVO (KCAL)</Text>
              <TextInput
                style={styles.textInput}
                value={amrKcal}
                onChangeText={setAmrKcal}
                keyboardType="number-pad"
                placeholder="es. 2600"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </Card>

        {/* SEZIONE 4: Note & Condizioni */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📝 NOTE & CONDIZIONI</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="es. Rilevazione a digiuno al risveglio, pre-colazione..."
            placeholderTextColor={colors.textMuted}
            textAlignVertical="top"
          />
        </Card>

        {/* Submit Button */}
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.submitButton,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Salva nuova misurazione corporea"
        >
          <Text style={styles.submitButtonText}>💾 SALVA MISURAZIONE BILANCIA</Text>
        </Pressable>
      </ScrollView>

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
    backgroundColor: colors.backgroundSolid,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.primary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  infoBadge: {
    backgroundColor: colors.backgroundSubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: layout.borderRadiusSm,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignSelf: 'flex-start',
  },
  infoBadgeText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: layout.borderRadiusSm,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionCard: {
    marginBottom: 12,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  inputGroup: {
    marginBottom: 10,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  autoBadge: {
    fontSize: 10,
    color: colors.emerald,
    fontWeight: '700',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  textInput: {
    backgroundColor: colors.backgroundSolid,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.borderRadiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  weightInput: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.accent,
    borderColor: colors.accent,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colHalf: {
    flex: 1,
  },
  notesInput: {
    minHeight: 70,
    paddingTop: 8,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: layout.borderRadiusMd,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

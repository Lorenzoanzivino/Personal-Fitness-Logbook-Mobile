import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList, RootStackNavigationProp } from '../../types/navigation';
import { colors } from '../../theme/colors';
import { layout, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Card } from '../../components/Card';
import { DatePickerInput } from '../../components/DatePickerInput';
import { useMeasurements } from '../../context/MeasurementContext';
import { profileService } from '../../services/profileService';
import { ToastFeedback, ToastType } from '../../components/ToastFeedback';

type MeasurementModalRouteProp = RouteProp<RootStackParamList, 'MeasurementModal'>;

export const MeasurementModal: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<MeasurementModalRouteProp>();
  const { measurements, addMeasurement, updateMeasurement } = useMeasurements();

  const editingId = route.params?.measurementId;
  const isEditing = editingId !== undefined && editingId !== null;

  // Profile data for auto-BMI
  const [profileHeightCm, setProfileHeightCm] = useState<number | null>(null);

  // 1. Data (default: oggi)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // 2. Peso (kg, NOT NULL)
  const [weightKg, setWeightKg] = useState('');

  // 3. BMI
  const [bmi, setBmi] = useState('');
  const [isBmiManual, setIsBmiManual] = useState(false);

  // 4. Grasso corporeo (%)
  const [bodyFatPct, setBodyFatPct] = useState('');

  // 5. Massa muscolare (kg)
  const [muscleMassKg, setMuscleMassKg] = useState('');

  // 6. BMR (Kcal)
  const [bmrKcal, setBmrKcal] = useState('');

  // 7. Acqua (%)
  const [waterPct, setWaterPct] = useState('');

  // 8. Massa grassa (kg)
  const [fatMassKg, setFatMassKg] = useState('');

  // 9. Massa magra (kg)
  const [leanMassKg, setLeanMassKg] = useState('');

  // 10. Massa Ossea (kg)
  const [boneMassKg, setBoneMassKg] = useState('');

  // 11. Grasso viscerale
  const [visceralFat, setVisceralFat] = useState('');

  // 12. Proteine (%)
  const [proteinPct, setProteinPct] = useState('');

  // 13. Massa muscolo scheletrica (kg)
  const [skeletalMuscleKg, setSkeletalMuscleKg] = useState('');

  // 14. Grasso sotto cutaneo (%)
  const [subcutaneousFatPct, setSubcutaneousFatPct] = useState('');

  // 15. Note
  const [notes, setNotes] = useState('');

  // UI feedback states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; type: ToastType; message: string }>({
    visible: false,
    type: 'info',
    message: '',
  });

  // Load height from profile for automatic BMI computation
  useEffect(() => {
    const profile = profileService.getCurrentProfile();
    if (profile.height_cm && profile.height_cm > 50) {
      setProfileHeightCm(profile.height_cm);
    }
  }, []);

  // Pre-fill state if in edit mode
  useEffect(() => {
    if (isEditing) {
      const existing = measurements.find((m) => m.id === editingId);
      if (existing) {
        const rawDate = existing.date || existing.recorded_at;
        if (rawDate) {
          try {
            setSelectedDate(new Date(rawDate));
          } catch {
            setSelectedDate(new Date());
          }
        }

        const w = existing.weight ?? existing.weight_kg;
        if (w !== undefined && w !== null) setWeightKg(String(w));

        if (existing.bmi !== undefined && existing.bmi !== null) {
          setBmi(String(existing.bmi));
          setIsBmiManual(true);
        }

        const bf = existing.body_fat_percentage ?? existing.body_fat_pct;
        if (bf !== undefined && bf !== null) setBodyFatPct(String(bf));

        if (existing.muscle_mass_kg !== undefined && existing.muscle_mass_kg !== null) {
          setMuscleMassKg(String(existing.muscle_mass_kg));
        }

        const bmrVal = existing.bmr ?? existing.bmr_kcal;
        if (bmrVal !== undefined && bmrVal !== null) setBmrKcal(String(bmrVal));

        const water = existing.water_percentage ?? existing.water_pct;
        if (water !== undefined && water !== null) setWaterPct(String(water));

        if (existing.fat_mass_kg !== undefined && existing.fat_mass_kg !== null) {
          setFatMassKg(String(existing.fat_mass_kg));
        }

        if (existing.lean_mass_kg !== undefined && existing.lean_mass_kg !== null) {
          setLeanMassKg(String(existing.lean_mass_kg));
        }

        if (existing.bone_mass_kg !== undefined && existing.bone_mass_kg !== null) {
          setBoneMassKg(String(existing.bone_mass_kg));
        }

        if (existing.visceral_fat !== undefined && existing.visceral_fat !== null) {
          setVisceralFat(String(existing.visceral_fat));
        }

        if (existing.protein_percentage !== undefined && existing.protein_percentage !== null) {
          setProteinPct(String(existing.protein_percentage));
        }

        if (existing.skeletal_muscle_mass_kg !== undefined && existing.skeletal_muscle_mass_kg !== null) {
          setSkeletalMuscleKg(String(existing.skeletal_muscle_mass_kg));
        }

        if (existing.subcutaneous_fat_percentage !== undefined && existing.subcutaneous_fat_percentage !== null) {
          setSubcutaneousFatPct(String(existing.subcutaneous_fat_percentage));
        }

        if (existing.notes) {
          setNotes(existing.notes);
        }
      }
    }
  }, [isEditing, editingId, measurements]);

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
    const parsedBodyFat = parseDecimal(bodyFatPct);
    const parsedMuscle = parseDecimal(muscleMassKg);
    const parsedBmr = parseDecimal(bmrKcal);
    const parsedWater = parseDecimal(waterPct);
    const parsedFatMass = parseDecimal(fatMassKg);
    const parsedLean = parseDecimal(leanMassKg);
    const parsedBone = parseDecimal(boneMassKg);
    const parsedVisceral = parseDecimal(visceralFat);
    const parsedProtein = parseDecimal(proteinPct);
    const parsedSkeletalMuscle = parseDecimal(skeletalMuscleKg);
    const parsedSubcutaneousFat = parseDecimal(subcutaneousFatPct);

    const isoDate = selectedDate.toISOString();

    const payload = {
      date: isoDate,
      recorded_at: isoDate,
      weight: parsedWeight,
      weight_kg: parsedWeight,
      bmi: parsedBmi ?? undefined,
      body_fat_percentage: parsedBodyFat ?? undefined,
      body_fat_pct: parsedBodyFat ?? undefined,
      muscle_mass_kg: parsedMuscle ?? undefined,
      bmr: parsedBmr ? Math.round(parsedBmr) : undefined,
      bmr_kcal: parsedBmr ? Math.round(parsedBmr) : undefined,
      water_percentage: parsedWater ?? undefined,
      water_pct: parsedWater ?? undefined,
      fat_mass_kg: parsedFatMass ?? undefined,
      lean_mass_kg: parsedLean ?? undefined,
      bone_mass_kg: parsedBone ?? undefined,
      visceral_fat: parsedVisceral ?? undefined,
      protein_percentage: parsedProtein ?? undefined,
      skeletal_muscle_mass_kg: parsedSkeletalMuscle ?? undefined,
      subcutaneous_fat_percentage: parsedSubcutaneousFat ?? undefined,
      notes: notes.trim() || undefined,
    };

    try {
      if (isEditing && editingId !== undefined) {
        await updateMeasurement(editingId, payload);
        setToast({
          visible: true,
          type: 'success',
          message: `Rilevazione aggiornata con successo! (${parsedWeight.toFixed(1)} kg) ⚖️`,
        });
      } else {
        await addMeasurement(payload);
        setToast({
          visible: true,
          type: 'success',
          message: `Pesata di ${parsedWeight.toFixed(1)} kg registrata con successo! ⚖️`,
        });
      }

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
        <View style={{ flex: 1 }}>
          <Text style={typography.label}>
            {isEditing ? 'MODIFICA RILEVAZIONE' : 'BILANCIA SMART & BIOIMPEDENZA'}
          </Text>
          <Text style={typography.h2} numberOfLines={1}>
            {isEditing ? 'Modifica Pesata' : 'Registra Pesata'}
          </Text>
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
        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
          </View>
        )}

        {/* 1. DATA (DatePicker) */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📅 1. DATA RILEVAZIONE *</Text>
          <DatePickerInput
            value={selectedDate}
            onChange={(d) => setSelectedDate(d)}
            format="readable"
            hint="Data della rilevazione corporea"
            maximumDate={new Date()}
          />
        </Card>

        {/* 2 & 3. PESO & BMI */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>⚖️ 2. PESO & 3. BMI</Text>

          {/* 2. Peso (kg, NOT NULL) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>2. PESO (KG) *</Text>
            <TextInput
              style={[styles.textInput, styles.weightInput]}
              value={weightKg}
              onChangeText={handleWeightChange}
              keyboardType="numeric"
              placeholder="es. 78.4 o 78,4"
              placeholderTextColor={colors.textMuted}
              autoFocus={!isEditing}
            />
          </View>

          {/* 3. BMI */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>3. BMI (INDICE MASSA CORPOREA)</Text>
              {profileHeightCm && !isBmiManual && (
                <Text style={styles.autoBadge}>Auto da {profileHeightCm} cm</Text>
              )}
            </View>
            <TextInput
              style={styles.textInput}
              value={bmi}
              onChangeText={handleBmiChange}
              keyboardType="numeric"
              placeholder={
                profileHeightCm
                  ? 'Calcolato in automatico dal peso...'
                  : 'es. 24.2'
              }
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </Card>

        {/* 4 & 5. GRASSO CORPOREO (%) & MASSA MUSCOLARE (KG) */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🧬 4. GRASSO CORPOREO & 5. MASSA MUSCOLARE</Text>

          <View style={styles.twoColRow}>
            {/* 4. Grasso corporeo (%) */}
            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>4. GRASSO CORPOREO (%)</Text>
              <TextInput
                style={styles.textInput}
                value={bodyFatPct}
                onChangeText={setBodyFatPct}
                keyboardType="numeric"
                placeholder="es. 14.5"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* 5. Massa muscolare (kg) */}
            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>5. MASSA MUSCOLARE (KG)</Text>
              <TextInput
                style={styles.textInput}
                value={muscleMassKg}
                onChangeText={setMuscleMassKg}
                keyboardType="numeric"
                placeholder="es. 64.5"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </Card>

        {/* 6 & 7. BMR (KCAL) & ACQUA (%) */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🔥 6. BMR METABOLISMO & 7. ACQUA</Text>

          <View style={styles.twoColRow}>
            {/* 6. BMR (Kcal) */}
            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>6. BMR (KCAL)</Text>
              <TextInput
                style={styles.textInput}
                value={bmrKcal}
                onChangeText={setBmrKcal}
                keyboardType="numeric"
                placeholder="es. 1750"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* 7. Acqua (%) */}
            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>7. ACQUA (%)</Text>
              <TextInput
                style={styles.textInput}
                value={waterPct}
                onChangeText={setWaterPct}
                keyboardType="numeric"
                placeholder="es. 61.5"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </Card>

        {/* 8 & 9. MASSA GRASSA (KG) & MASSA MAGRA (KG) */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>⚖️ 8. MASSA GRASSA & 9. MASSA MAGRA</Text>

          <View style={styles.twoColRow}>
            {/* 8. Massa grassa (kg) */}
            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>8. MASSA GRASSA (KG)</Text>
              <TextInput
                style={styles.textInput}
                value={fatMassKg}
                onChangeText={setFatMassKg}
                keyboardType="numeric"
                placeholder="es. 11.2"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* 9. Massa magra (kg) */}
            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>9. MASSA MAGRA (KG)</Text>
              <TextInput
                style={styles.textInput}
                value={leanMassKg}
                onChangeText={setLeanMassKg}
                keyboardType="numeric"
                placeholder="es. 67.2"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </Card>

        {/* 10 & 11. MASSA OSSEA (KG) & GRASSO VISCERALE */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🦴 10. MASSA OSSEA & 11. GRASSO VISCERALE</Text>

          <View style={styles.twoColRow}>
            {/* 10. Massa Ossea (kg) */}
            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>10. MASSA OSSEA (KG)</Text>
              <TextInput
                style={styles.textInput}
                value={boneMassKg}
                onChangeText={setBoneMassKg}
                keyboardType="numeric"
                placeholder="es. 3.4"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* 11. Grasso viscerale */}
            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>11. GRASSO VISCERALE</Text>
              <TextInput
                style={styles.textInput}
                value={visceralFat}
                onChangeText={setVisceralFat}
                keyboardType="numeric"
                placeholder="es. 4 (scala 1-12)"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </Card>

        {/* 12, 13 & 14. PROTEINE (%), MASSA MUSCOLO SCHELETRICA (KG), GRASSO SOTTO CUTANEO (%) */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🧪 12. PROTEINE, 13. SCHELETRICA & 14. SOTTOCUTANEO</Text>

          {/* 12. Proteine (%) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>12. PROTEINE (%)</Text>
            <TextInput
              style={styles.textInput}
              value={proteinPct}
              onChangeText={setProteinPct}
              keyboardType="numeric"
              placeholder="es. 18.5"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.twoColRow}>
            {/* 13. Massa muscolo scheletrica (kg) */}
            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>13. MUSCOLO SCHELETRICO (KG)</Text>
              <TextInput
                style={styles.textInput}
                value={skeletalMuscleKg}
                onChangeText={setSkeletalMuscleKg}
                keyboardType="numeric"
                placeholder="es. 34.2"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* 14. Grasso sotto cutaneo (%) */}
            <View style={[styles.inputGroup, styles.colHalf]}>
              <Text style={styles.inputLabel}>14. GRASSO SOTTOCUTANEO (%)</Text>
              <TextInput
                style={styles.textInput}
                value={subcutaneousFatPct}
                onChangeText={setSubcutaneousFatPct}
                keyboardType="numeric"
                placeholder="es. 12.8"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </Card>

        {/* 15. NOTE */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📝 15. NOTE & CIRCONFERENZE</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="es. A digiuno al mattino, girovita: 82cm, braccio: 38cm..."
            placeholderTextColor={colors.textMuted}
            textAlignVertical="top"
          />
        </Card>

        {/* Submit Button */}
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.submitButton,
            isEditing && styles.submitButtonEdit,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isEditing ? 'Salva modifiche misurazione' : 'Salva nuova misurazione corporea'}
        >
          <Text style={styles.submitButtonText}>
            {isEditing ? '💾 SALVA MODIFICHE RILEVAZIONE' : '💾 SALVA MISURAZIONE BILANCIA'}
          </Text>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
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
    marginLeft: 12,
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
    padding: spacing.lg,
    paddingBottom: 40,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: layout.borderRadiusSm,
    padding: 10,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionCard: {
    marginBottom: spacing.md,
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
  submitButtonEdit: {
    backgroundColor: '#3B82F6',
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

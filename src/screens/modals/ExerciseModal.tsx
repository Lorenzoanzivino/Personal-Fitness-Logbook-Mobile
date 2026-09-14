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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList, RootStackNavigationProp } from '../../types/navigation';
import { useGym } from '../../context/GymContext';
import { MuscleGroup, ExerciseType } from '../../types/workout';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Card } from '../../components/Card';
import { ToastFeedback, ToastType } from '../../components/ToastFeedback';
import { YouTubeModalOverlay } from '../../components/YouTubeModalOverlay';

type ExerciseModalRouteProp = RouteProp<RootStackParamList, 'ExerciseModal'>;

const MUSCLE_GROUPS: MuscleGroup[] = [
  'Petto',
  'Dorso',
  'Spalle',
  'Bicipiti',
  'Tricipiti',
  'Quadricipiti',
  'Femorali',
  'Polpacci',
  'Addome',
];

const EXERCISE_TYPES: Array<{ key: ExerciseType; label: string; desc: string }> = [
  { key: 'reps', label: 'Carico + Reps', desc: 'Carico in kg e ripetizioni (es. Panca, Squat, Macchine)' },
  { key: 'time', label: 'Tempo (Isometria)', desc: 'Tenuta isometrica in secondi (es. Plank, Hollow Body)' },
  { key: 'bodyweight', label: 'Corpo Libero / Zavorra', desc: 'Ripetizioni a peso corporeo, zavorra o assistenza elastici' },
];

export const ExerciseModal: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<ExerciseModalRouteProp>();
  const insets = useSafeAreaInsets();
  const { addExercise, updateExercise, exercises } = useGym();

  const exerciseId = route.params?.exerciseId;
  const isEditing = Boolean(exerciseId);
  const existingExercise = isEditing ? exercises.find((e) => e.id === exerciseId) : null;

  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('Petto');
  const [exerciseType, setExerciseType] = useState<ExerciseType>('reps');
  const [notes, setNotes] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // Toast State
  const [toast, setToast] = useState<{
    visible: boolean;
    type: ToastType;
    message: string;
  }>({
    visible: false,
    type: 'info',
    message: '',
  });

  // YouTube Preview State
  const [previewVideo, setPreviewVideo] = useState<{
    visible: boolean;
    url: string;
    title: string;
  }>({
    visible: false,
    url: '',
    title: '',
  });

  useEffect(() => {
    if (existingExercise) {
      setName(existingExercise.name);
      setMuscleGroup(existingExercise.muscle_group);
      setExerciseType(existingExercise.exercise_type);
      setNotes(existingExercise.notes || '');
      setDescription(existingExercise.description || '');
      setVideoUrl(existingExercise.video_url || '');
    }
  }, [existingExercise]);

  const showToast = (type: ToastType, message: string) => {
    setToast({ visible: true, type, message });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('error', 'Inserisci il nome dell\'esercizio.');
      return;
    }

    // Check unique name if new or if changed
    const exists = exercises.some(
      (e) =>
        e.id !== exerciseId &&
        e.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (exists) {
      showToast('error', 'Un esercizio con questo nome esiste già nel catalogo.');
      return;
    }

    try {
      if (isEditing && exerciseId) {
        await updateExercise(exerciseId, {
          name: name.trim(),
          muscle_group: muscleGroup,
          exercise_type: exerciseType,
          notes: notes.trim() || null,
          description: description.trim() || null,
          video_url: videoUrl.trim() || null,
        });

        showToast('success', `"${name.trim()}" aggiornato con successo! ✏️`);
        setTimeout(() => {
          navigation.goBack();
        }, 600);
      } else {
        await addExercise({
          name: name.trim(),
          muscle_group: muscleGroup,
          exercise_type: exerciseType,
          notes: notes.trim() || undefined,
          description: description.trim() || undefined,
          video_url: videoUrl.trim() || undefined,
        });

        showToast('success', `"${name.trim()}" aggiunto al catalogo! 💪`);
        setTimeout(() => {
          navigation.goBack();
        }, 600);
      }
    } catch (err) {
      showToast('error', 'Impossibile salvare l\'esercizio.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.modalHeader}>
        <View>
          <Text style={typography.label}>CATALOGO ESERCIZI</Text>
          <Text style={typography.h2}>
            {isEditing ? 'Modifica Esercizio' : 'Nuovo Esercizio'}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Chiudi modale esercizio"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NOME ESERCIZIO *</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="es. Spinte con Manubri su Panca Piana"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>GRUPPO MUSCOLARE PRIMARIO</Text>
            <View style={styles.wrapGrid}>
              {MUSCLE_GROUPS.map((mg) => (
                <Pressable
                  key={mg}
                  onPress={() => setMuscleGroup(mg)}
                  style={[
                    styles.chip,
                    muscleGroup === mg && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      muscleGroup === mg && styles.chipTextActive,
                    ]}
                  >
                    {mg}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>TIPOLOGIA ESECUZIONE (POLIMORFISMO)</Text>
            {EXERCISE_TYPES.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setExerciseType(t.key)}
                style={[
                  styles.typeCard,
                  exerciseType === t.key && styles.typeCardActive,
                ]}
              >
                <View style={styles.typeRadio}>
                  {exerciseType === t.key && <View style={styles.typeRadioDot} />}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text
                    style={[
                      typography.bodyBold,
                      exerciseType === t.key && { color: colors.accent },
                    ]}
                  >
                    {t.label}
                  </Text>
                  <Text style={typography.caption}>{t.desc}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DESCRIZIONE ESERCIZIO</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Descrizione tecnica dell'esecuzione (es. gomiti a 45°, fermo al petto 1s)..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>LINK VIDEO YOUTUBE (URL)</Text>
            <View style={styles.videoInputRow}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={videoUrl}
                onChangeText={setVideoUrl}
                placeholder="https://youtu.be/... oppure https://www.youtube.com/watch?v=..."
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {Boolean(videoUrl.trim()) && (
                <Pressable
                  style={styles.previewBtn}
                  onPress={() =>
                    setPreviewVideo({
                      visible: true,
                      url: videoUrl.trim(),
                      title: name.trim() || 'Video Esercizio',
                    })
                  }
                >
                  <Text style={styles.previewBtnText}>🎬 Prova</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NOTE DI SET-UP O BIOMECCANICA</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Istruzioni su presa, traiettoria, panca..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={2}
            />
          </View>
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <Pressable
          onPress={handleSave}
          style={({ pressed }) => [
            styles.submitButton,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.submitButtonText}>
            {isEditing ? '✓ SALVA MODIFICHE ESERCIZIO' : '+ AGGIUNGI AL CATALOGO'}
          </Text>
        </Pressable>
      </View>

      <YouTubeModalOverlay
        visible={previewVideo.visible}
        videoUrl={previewVideo.url}
        exerciseName={previewVideo.title}
        onClose={() => setPreviewVideo((prev) => ({ ...prev, visible: false }))}
      />

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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
  },
  formCard: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    height: layout.minTouchTarget,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusMd,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  wrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusPill,
    marginRight: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSubtle,
    padding: 12,
    borderRadius: layout.borderRadiusMd,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  typeCardActive: {
    borderColor: colors.accent,
    backgroundColor: '#162235',
  },
  typeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  footer: {
    padding: 16,
    backgroundColor: colors.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.accent,
    height: layout.minTouchTarget,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  videoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewBtn: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 12,
    height: layout.minTouchTarget,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
});


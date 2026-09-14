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
import { useGym } from '../../context/GymContext';
import { RoutineExercise, SetType, BandAssistance, ExerciseType, SetDropStep } from '../../types/workout';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Card } from '../../components/Card';
import { CustomConfirmModal } from '../../components/CustomConfirmModal';
import { ToastFeedback, ToastType } from '../../components/ToastFeedback';
import { YouTubeModalOverlay } from '../../components/YouTubeModalOverlay';
import { BandSelectDropdown } from '../../components/BandSelectDropdown';

type NewRoutineModalRouteProp = RouteProp<RootStackParamList, 'NewRoutineModal'>;

const BORDER_PALETTE = [
  '#3B82F6', // Blu
  '#10B981', // Verde Smeraldo
  '#F59E0B', // Ambra / Oro
  '#EF4444', // Rosso
  '#8B5CF6', // Viola
  '#EC4899', // Rosa
  '#06B6D4', // Ciano
  '#F97316', // Arancione
];

const SET_TYPES: Array<{ key: SetType; label: string }> = [
  { key: 'normal', label: 'Normale' },
  { key: 'warmup', label: 'Warm-Up' },
  { key: 'dropset', label: 'Stripping' },
  { key: 'rest_pause', label: 'Rest-Pause' },
];

const BAND_ASSISTANCES: Array<{ key: BandAssistance; label: string }> = [
  { key: 'none', label: 'Peso Corporeo' },
  { key: 'weighted', label: 'Zavorra (+Kg)' },
  { key: 'light', label: 'Elastico Light' },
  { key: 'medium', label: 'Elastico Medium' },
  { key: 'heavy', label: 'Elastico Heavy' },
];

interface BuilderDropState {
  id: string;
  kg: number;
  reps: number;
  restSeconds?: number;
}

interface BuilderSetState {
  setNumber: number;
  setType: SetType;
  targetWeightKg: number;
  targetReps: number;
  targetTimeSeconds?: number | null;
  bandAssistance: BandAssistance;
  dropsetWeightKg?: number | null;
  drops?: BuilderDropState[];
  restSeconds: number;
  notes?: string;
}

interface BuilderExerciseState {
  tempId: string;
  exerciseId: number;
  exerciseOrder: number;
  supersetGroup: string | null;
  customDescription?: string;
  customVideoUrl?: string;
  sets: BuilderSetState[];
}

export const NewRoutineModal: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<NewRoutineModalRouteProp>();
  const {
    exercises,
    routines,
    folders,
    isDelegatedMode,
    selectedClient,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    addFolder,
  } = useGym();

  const routineId = route.params?.routineId;
  const isEditing = Boolean(routineId);
  const existingRoutine = isEditing ? routines.find((r) => r.id === routineId) : null;

  const [name, setName] = useState('');
  const [durationWeeks, setDurationWeeks] = useState('8');
  const [workoutType, setWorkoutType] = useState('Ipertrofia');
  const [description, setDescription] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    folders.length > 0 ? folders[0].id : null
  );
  const [selectedBorderColor, setSelectedBorderColor] = useState<string>(BORDER_PALETTE[0]);

  // Inline folder creation state
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [routineExercises, setRoutineExercises] = useState<BuilderExerciseState[]>([]);

  // Accordion collapsed exercise IDs
  const [collapsedExIds, setCollapsedExIds] = useState<Set<string>>(new Set());

  const toggleCollapse = (tempId: string) => {
    setCollapsedExIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  };

  // Video modal preview state
  const [activeVideoModal, setActiveVideoModal] = useState<{
    visible: boolean;
    url: string;
    name: string;
  }>({
    visible: false,
    url: '',
    name: '',
  });

  // Dialog Add Exercise: Choice (Single vs Super Serie)
  const [showAddChoiceModal, setShowAddChoiceModal] = useState(false);
  const [pickerMode, setPickerMode] = useState<'single' | 'superset'>('single');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [selectedSupersetExerciseIds, setSelectedSupersetExerciseIds] = useState<number[]>([]);
  const [filterMuscle, setFilterMuscle] = useState<string>('Tutti');

  // Set Type Selection Modal for an exercise
  const [setTypeModalExerciseIdx, setSetTypeModalExerciseIdx] = useState<number | null>(null);

  // Custom Delete Confirm Modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Toast Feedback State
  const [toast, setToast] = useState<{
    visible: boolean;
    type: ToastType;
    message: string;
  }>({
    visible: false,
    type: 'info',
    message: '',
  });

  const showToast = (type: ToastType, message: string) => {
    setToast({ visible: true, type, message });
  };

  useEffect(() => {
    if (existingRoutine) {
      setName(existingRoutine.name);
      setDurationWeeks(String(existingRoutine.duration_weeks));
      setWorkoutType(existingRoutine.workout_type || 'Ipertrofia');
      setDescription(existingRoutine.description || '');
      if (existingRoutine.folder_id) {
        setSelectedFolderId(existingRoutine.folder_id);
      }
      if (existingRoutine.border_color) {
        setSelectedBorderColor(existingRoutine.border_color);
      }

      if (existingRoutine.exercises) {
        const loaded: BuilderExerciseState[] = existingRoutine.exercises.map((re, idx) => ({
          tempId: `re-${re.exercise_id}-${idx}-${Date.now()}`,
          exerciseId: re.exercise_id,
          exerciseOrder: re.exercise_order || idx + 1,
          supersetGroup: re.superset_group || null,
          customDescription: re.custom_description || undefined,
          customVideoUrl: re.custom_video_url || undefined,
          sets: (re.sets || []).map((s, sIdx) => {
            let loadedDrops: BuilderDropState[] | undefined = undefined;
            if (s.drops && s.drops.length > 0) {
              loadedDrops = s.drops.map((d, dIdx) => ({
                id: d.id || `d-${dIdx}-${Date.now()}`,
                kg: d.kg || 0,
                reps: d.reps || 8,
                restSeconds: d.rest_seconds || 20,
              }));
            } else if (s.set_type === 'dropset') {
              loadedDrops = [
                { id: `d-1-${sIdx}`, kg: s.target_weight_kg || 0, reps: s.target_reps || 8 },
                { id: `d-2-${sIdx}`, kg: s.dropset_weight_kg || 0, reps: s.target_reps || 8 },
              ];
            } else if (s.set_type === 'rest_pause') {
              loadedDrops = [
                { id: `rp-1-${sIdx}`, kg: s.target_weight_kg || 0, reps: s.target_reps || 10, restSeconds: 20 },
                { id: `rp-2-${sIdx}`, kg: s.target_weight_kg || 0, reps: 4, restSeconds: 20 },
              ];
            }

            return {
              setNumber: s.set_number,
              setType: s.set_type || 'normal',
              targetWeightKg: s.target_weight_kg || 0,
              targetReps: s.target_reps || 10,
              targetTimeSeconds: s.target_time_seconds || 60,
              bandAssistance: s.band_assistance || 'none',
              dropsetWeightKg: s.dropset_weight_kg || 0,
              drops: loadedDrops,
              restSeconds: s.rest_seconds || 90,
              notes: s.notes || undefined,
            };
          }),
        }));
        setRoutineExercises(loaded);
      }
    }
  }, [existingRoutine]);

  // Handle Inline Folder Creation
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      showToast('error', 'Inserisci un nome valido per la cartella.');
      return;
    }
    try {
      const created = await addFolder(newFolderName.trim());
      setSelectedFolderId(created.id);
      setNewFolderName('');
      setShowNewFolderInput(false);
      showToast('success', `Cartella "${created.name}" creata!`);
    } catch (e: any) {
      showToast('error', e?.message || 'Impossibile creare la cartella.');
    }
  };

  // Reordering Exercises (▲ Up / ▼ Down)
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...routineExercises];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    updated.forEach((ex, idx) => {
      ex.exerciseOrder = idx + 1;
    });
    setRoutineExercises(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= routineExercises.length - 1) return;
    const updated = [...routineExercises];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    updated.forEach((ex, idx) => {
      ex.exerciseOrder = idx + 1;
    });
    setRoutineExercises(updated);
  };

  // Handle Choice Modal
  const handleOpenAddChoice = () => {
    setShowAddChoiceModal(true);
  };

  const handleSelectAddType = (mode: 'single' | 'superset') => {
    setShowAddChoiceModal(false);
    setPickerMode(mode);
    setSelectedSupersetExerciseIds([]);
    setShowExercisePicker(true);
  };

  // Compute Next Superset Group Letter ('A', 'B', 'C'...)
  const getNextSupersetGroupLetter = (): string => {
    const existingGroups = new Set<string>();
    routineExercises.forEach((re) => {
      if (re.supersetGroup) existingGroups.add(re.supersetGroup);
    });
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      if (!existingGroups.has(letter)) return letter;
    }
    return 'Z';
  };

  // Handle Exercise Selection
  const handleSelectSingleExercise = (exerciseId: number) => {
    setShowExercisePicker(false);
    // Nasce con 0 serie!
    setRoutineExercises([
      ...routineExercises,
      {
        tempId: `re-${exerciseId}-${Date.now()}`,
        exerciseId,
        exerciseOrder: routineExercises.length + 1,
        supersetGroup: null,
        sets: [], // 0 serie iniziali
      },
    ]);
  };

  const handleToggleSupersetSelection = (exerciseId: number) => {
    if (selectedSupersetExerciseIds.includes(exerciseId)) {
      setSelectedSupersetExerciseIds(selectedSupersetExerciseIds.filter((id) => id !== exerciseId));
    } else {
      setSelectedSupersetExerciseIds([...selectedSupersetExerciseIds, exerciseId]);
    }
  };

  const handleConfirmSupersetSelection = () => {
    if (selectedSupersetExerciseIds.length < 2) {
      showToast('error', 'Seleziona almeno 2 esercizi per creare una Super Serie.');
      return;
    }

    const groupLetter = getNextSupersetGroupLetter();
    const newItems: BuilderExerciseState[] = selectedSupersetExerciseIds.map((exId, idx) => ({
      tempId: `re-${exId}-${Date.now()}-${idx}`,
      exerciseId: exId,
      exerciseOrder: routineExercises.length + idx + 1,
      supersetGroup: groupLetter,
      sets: [], // Nascono con 0 serie
    }));

    setRoutineExercises([...routineExercises, ...newItems]);
    setShowExercisePicker(false);
    setSelectedSupersetExerciseIds([]);
    showToast('success', `Super Serie ${groupLetter} aggiunta (${newItems.length} esercizi)!`);
  };

  const handleRemoveExercise = (index: number) => {
    const updated = [...routineExercises];
    updated.splice(index, 1);
    updated.forEach((e, idx) => {
      e.exerciseOrder = idx + 1;
    });
    setRoutineExercises(updated);
  };

  // Add Set with SetType choice
  const handleOpenAddSet = (exIndex: number) => {
    setSetTypeModalExerciseIdx(exIndex);
  };

  const handleConfirmAddSetType = (type: SetType) => {
    if (setTypeModalExerciseIdx === null) return;
    const exIdx = setTypeModalExerciseIdx;
    setSetTypeModalExerciseIdx(null);

    const updated = [...routineExercises];
    const exInfo = exercises.find((e) => e.id === updated[exIdx].exerciseId);
    const exType: ExerciseType = exInfo?.exercise_type || 'reps';
    const setNum = updated[exIdx].sets.length + 1;

    let initialDrops: BuilderDropState[] | undefined = undefined;
    if (type === 'dropset') {
      // 2 slot di drop di default
      initialDrops = [
        { id: `drop-${Date.now()}-1`, kg: 0, reps: 8 },
        { id: `drop-${Date.now()}-2`, kg: 0, reps: 8 },
      ];
    } else if (type === 'rest_pause') {
      // 2 slot di rest-pause di default
      initialDrops = [
        { id: `drop-${Date.now()}-1`, kg: 0, reps: 10, restSeconds: 20 },
        { id: `drop-${Date.now()}-2`, kg: 0, reps: 4, restSeconds: 20 },
      ];
    }

    const newSet: BuilderSetState = {
      setNumber: setNum,
      setType: type,
      targetWeightKg: 0,
      targetReps: exType === 'time' ? 0 : 10,
      targetTimeSeconds: exType === 'time' ? 60 : null,
      bandAssistance: 'none',
      dropsetWeightKg: null,
      drops: initialDrops,
      restSeconds: 90,
    };

    updated[exIdx].sets.push(newSet);
    setRoutineExercises(updated);
  };

  const handleRemoveSet = (exIndex: number, setIndex: number) => {
    const updated = [...routineExercises];
    updated[exIndex].sets.splice(setIndex, 1);
    updated[exIndex].sets.forEach((s, idx) => {
      s.setNumber = idx + 1;
    });
    setRoutineExercises(updated);
  };

  // Dynamic Drops Management (+ Aggiungi Drop / Slot e Rimozione)
  const handleAddDropSlot = (exIndex: number, setIndex: number) => {
    const updated = [...routineExercises];
    const set = updated[exIndex].sets[setIndex];
    if (!set.drops) {
      set.drops = [];
    }
    const lastDrop = set.drops[set.drops.length - 1];
    const dropNumber = set.drops.length + 1;

    set.drops.push({
      id: `drop-${Date.now()}-${dropNumber}`,
      kg: lastDrop ? Math.max(0, Math.round(lastDrop.kg * 0.8)) : 0,
      reps: lastDrop ? lastDrop.reps : 8,
      restSeconds: set.setType === 'rest_pause' ? 20 : undefined,
    });

    setRoutineExercises(updated);
  };

  const handleRemoveDropSlot = (exIndex: number, setIndex: number, dropIndex: number) => {
    const updated = [...routineExercises];
    const set = updated[exIndex].sets[setIndex];
    if (set.drops && set.drops.length > 2) {
      set.drops.splice(dropIndex, 1);
      setRoutineExercises(updated);
    } else {
      showToast('info', 'Una serie stripping/rest-pause richiede almeno 2 slot.');
    }
  };

  // Save Routine
  const handleSaveRoutine = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('error', 'Inserisci un nome per la scheda.');
      return;
    }

    // Check duplicate name
    const isDuplicate = routines.some(
      (r) =>
        (!isEditing || r.id !== routineId) &&
        r.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      showToast('error', `Esiste già una scheda denominata "${trimmedName}". Scegli un nome univoco.`);
      return;
    }

    const weeks = parseInt(durationWeeks, 10);
    if (isNaN(weeks) || weeks < 1 || weeks > 52) {
      showToast('error', 'La durata del mesociclo deve essere compresa tra 1 e 52 settimane.');
      return;
    }

    if (routineExercises.length === 0) {
      showToast('error', 'Aggiungi almeno un esercizio alla scheda.');
      return;
    }

    // Find folder name
    const folderObj = folders.find((f) => f.id === selectedFolderId);
    const folderName = folderObj ? folderObj.name : null;

    const mappedExercises: RoutineExercise[] = routineExercises.map((re) => {
      const foundEx = exercises.find((e) => e.id === re.exerciseId);
      return {
        routine_id: routineId || 0,
        exercise_id: re.exerciseId,
        exercise_order: re.exerciseOrder,
        superset_group: re.supersetGroup,
        custom_description: re.customDescription?.trim() || null,
        custom_video_url: re.customVideoUrl?.trim() || null,
        exercise: foundEx,
        sets: re.sets.map((s) => {
          let mappedDrops: SetDropStep[] | undefined = undefined;
          if (s.drops && s.drops.length > 0) {
            mappedDrops = s.drops.map((d) => ({
              id: d.id,
              kg: d.kg,
              reps: d.reps,
              rest_seconds: d.restSeconds,
            }));
          }

          return {
            routine_exercise_id: 0,
            set_number: s.setNumber,
            set_type: s.setType,
            target_weight_kg: s.targetWeightKg,
            target_reps: s.targetReps,
            target_time_seconds: s.targetTimeSeconds || null,
            band_assistance: s.bandAssistance,
            dropset_weight_kg: s.dropsetWeightKg || null,
            drops: mappedDrops,
            rest_seconds: s.restSeconds,
          };
        }),
      };
    });

    try {
      if (isEditing && routineId) {
        await updateRoutine(routineId, {
          name: trimmedName,
          folder_id: selectedFolderId,
          folder_name: folderName,
          border_color: selectedBorderColor,
          description: description.trim() || null,
          workout_type: workoutType,
          duration_weeks: weeks,
          exercises: mappedExercises,
        });

        showToast('success', `Scheda "${trimmedName}" aggiornata con successo!`);
        setTimeout(() => navigation.goBack(), 700);
      } else {
        await addRoutine({
          name: trimmedName,
          folder_id: selectedFolderId,
          folder_name: folderName,
          border_color: selectedBorderColor,
          description: description.trim() || null,
          workout_type: workoutType,
          duration_weeks: weeks,
          exercises: mappedExercises,
        });

        showToast('success', `Scheda "${trimmedName}" creata con successo!`);
        setTimeout(() => navigation.goBack(), 700);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Impossibile salvare la scheda.');
    }
  };

  // Delete Routine
  const handleConfirmDeleteRoutine = async () => {
    if (!routineId) return;
    try {
      await deleteRoutine(routineId);
      setShowDeleteConfirm(false);
      showToast('success', 'Scheda eliminata definitivamente.');
      setTimeout(() => navigation.goBack(), 600);
    } catch (e: any) {
      setShowDeleteConfirm(false);
      showToast('error', 'Errore durante l\'eliminazione della scheda.');
    }
  };

  const filteredExercises =
    filterMuscle === 'Tutti'
      ? exercises
      : exercises.filter((e) => e.muscle_group === filterMuscle);

  const getBadgeStyle = (type: SetType) => {
    switch (type) {
      case 'warmup':
        return { bg: 'rgba(245, 158, 11, 0.2)', text: colors.warning, label: 'WARM-UP' };
      case 'dropset':
        return { bg: 'rgba(239, 68, 68, 0.2)', text: colors.danger, label: 'STRIPPING' };
      case 'rest_pause':
        return { bg: 'rgba(168, 85, 247, 0.2)', text: colors.volume, label: 'REST-PAUSE' };
      default:
        return { bg: colors.backgroundSubtle, text: colors.textSecondary, label: 'NORMAL' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Toast Feedback Notification */}
      <ToastFeedback
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      {/* Top Header */}
      <View style={styles.modalHeader}>
        <View style={{ flex: 1 }}>
          <Text style={typography.label}>ROUTINE BUILDER</Text>
          <Text style={typography.h2}>
            {isEditing ? 'Modifica Scheda' : 'Costruttore Scheda'}
          </Text>
        </View>

        {isEditing && (
          <Pressable
            onPress={() => setShowDeleteConfirm(true)}
            style={styles.headerDeleteBtn}
            accessibilityRole="button"
            accessibilityLabel="Elimina scheda"
          >
            <Text style={styles.headerDeleteText}>🗑 Elimina</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Chiudi costruttore scheda"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Delega Cliente */}
        {isDelegatedMode && selectedClient && (
          <View style={styles.delegationModalBanner}>
            <Text style={styles.delegationModalBannerTitle}>
              🔄 Creazione Scheda in Delega per: {selectedClient.name}
            </Text>
            <Text style={styles.delegationModalBannerSub}>
              Questa scheda verrà salvata per il cliente (owner_id: {selectedClient.id})
            </Text>
          </View>
        )}

        {/* Scheda Info & Configuration Card */}
        <Card style={[styles.formCard, { borderLeftColor: selectedBorderColor, borderLeftWidth: 4 }]}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NOME SCHEDA * (DEVE ESSERE UNIVOCO)</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="es. Spinta & Petto Focus"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Cartella di Appartenenza */}
          <View style={styles.inputGroup}>
            <View style={styles.rowSpaceBetween}>
              <Text style={styles.inputLabel}>CARTELLA MESOCICLO</Text>
              <Pressable onPress={() => setShowNewFolderInput(!showNewFolderInput)}>
                <Text style={styles.newFolderLink}>
                  {showNewFolderInput ? 'Annulla' : '+ Nuova Cartella'}
                </Text>
              </Pressable>
            </View>

            {showNewFolderInput ? (
              <View style={styles.newFolderRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1, marginRight: 8 }]}
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                  placeholder="Nome nuova cartella (es. Ottobre)"
                  placeholderTextColor={colors.textMuted}
                />
                <Pressable onPress={handleCreateFolder} style={styles.saveFolderBtn}>
                  <Text style={styles.saveFolderBtnText}>Crea</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.folderScroll}>
                <Pressable
                  onPress={() => setSelectedFolderId(null)}
                  style={[
                    styles.folderChip,
                    selectedFolderId === null && styles.folderChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.folderChipText,
                      selectedFolderId === null && styles.folderChipTextActive,
                    ]}
                  >
                    📁 Nessuna Cartella
                  </Text>
                </Pressable>
                {folders.map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => setSelectedFolderId(f.id)}
                    style={[
                      styles.folderChip,
                      selectedFolderId === f.id && styles.folderChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.folderChipText,
                        selectedFolderId === f.id && styles.folderChipTextActive,
                      ]}
                    >
                      📁 {f.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Colore Bordo Distintivo */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>COLORE BORDO DISTINTIVO</Text>
            <View style={styles.paletteRow}>
              {BORDER_PALETTE.map((col) => (
                <Pressable
                  key={col}
                  onPress={() => setSelectedBorderColor(col)}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: col },
                    selectedBorderColor === col && styles.colorCircleSelected,
                  ]}
                >
                  {selectedBorderColor === col && <Text style={styles.colorCheck}>✓</Text>}
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.rowTwoCols}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>DURATA (SETTIMANE)</Text>
              <TextInput
                style={styles.textInput}
                value={durationWeeks}
                onChangeText={setDurationWeeks}
                keyboardType="numeric"
                placeholder="8"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>TIPOLOGIA MESOCICLO</Text>
              <TextInput
                style={styles.textInput}
                value={workoutType}
                onChangeText={setWorkoutType}
                placeholder="es. Ipertrofia"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NOTE E OBIETTIVI</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Progressioni, note su sovraccarico progressivo..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={2}
            />
          </View>
        </Card>

        {/* Section Header: Esercizi Pianificati */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={typography.h3}>Esercizi ({routineExercises.length})</Text>
            <Text style={typography.caption}>Organizza esercizi singoli o Super Serie</Text>
          </View>
          <Pressable
            onPress={handleOpenAddChoice}
            style={styles.addExBtn}
            accessibilityRole="button"
            accessibilityLabel="Aggiungi esercizio o super serie"
          >
            <Text style={styles.addExBtnText}>+ AGGIUNGI EX</Text>
          </Pressable>
        </View>

        {routineExercises.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Nessun esercizio nella scheda. Tocca "+ AGGIUNGI EX" per inserire un Esercizio Singolo o una Super Serie.
            </Text>
          </Card>
        ) : (
          routineExercises.map((re, exIdx) => {
            const exInfo = exercises.find((e) => e.id === re.exerciseId);
            const exName = exInfo ? exInfo.name : `Esercizio ${re.exerciseId}`;
            const exType: ExerciseType = exInfo?.exercise_type || 'reps';
            const muscle = exInfo ? exInfo.muscle_group : '';

            return (
              <Card
                key={re.tempId}
                style={[
                  styles.exCard,
                  re.supersetGroup ? styles.supersetCardBorder : null,
                ]}
              >
                <View style={styles.exHeader}>
                  {/* Reordering Controls (▲ / ▼) */}
                  <View style={styles.reorderCol}>
                    <Pressable
                      onPress={() => handleMoveUp(exIdx)}
                      disabled={exIdx === 0}
                      style={[styles.arrowBtn, exIdx === 0 && styles.arrowBtnDisabled]}
                    >
                      <Text style={[styles.arrowText, exIdx === 0 && styles.arrowTextDisabled]}>▲</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleMoveDown(exIdx)}
                      disabled={exIdx === routineExercises.length - 1}
                      style={[
                        styles.arrowBtn,
                        exIdx === routineExercises.length - 1 && styles.arrowBtnDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.arrowText,
                          exIdx === routineExercises.length - 1 && styles.arrowTextDisabled,
                        ]}
                      >
                        ▼
                      </Text>
                    </Pressable>
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    {re.supersetGroup && (
                      <View style={styles.supersetTag}>
                        <Text style={styles.supersetTagText}>
                          ⚡ SUPER SERIE {re.supersetGroup}
                        </Text>
                      </View>
                    )}
                    <Text style={typography.bodyBold}>
                      {re.exerciseOrder}. {exName}
                    </Text>
                    <Text style={typography.caption}>
                      {muscle} • Tipo:{' '}
                      <Text style={{ color: colors.accent, fontWeight: '700' }}>
                        {exType === 'reps'
                          ? 'CARICO + REPS'
                          : exType === 'time'
                          ? 'ISOMETRIA (TEMPO)'
                          : 'CORPO LIBERO'}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.headerRightActions}>
                    <Pressable
                      onPress={() => toggleCollapse(re.tempId)}
                      style={styles.collapseExBtn}
                      accessibilityRole="button"
                      accessibilityLabel={collapsedExIds.has(re.tempId) ? "Espandi esercizio" : "Riduci esercizio"}
                    >
                      <Text style={styles.collapseExBtnText}>
                        {collapsedExIds.has(re.tempId) ? '▼ Espandi' : '▲ Riduci'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleRemoveExercise(exIdx)}
                      style={styles.removeExBtn}
                    >
                      <Text style={styles.removeExBtnText}>✕</Text>
                    </Pressable>
                  </View>
                </View>

                {/* If collapsed: show compact summary banner */}
                {collapsedExIds.has(re.tempId) ? (
                  <Pressable
                    onPress={() => toggleCollapse(re.tempId)}
                    style={styles.collapsedBadgeRow}
                  >
                    <Text style={styles.collapsedBadgeText}>
                      📦 {re.sets.length} {re.sets.length === 1 ? 'serie configurata' : 'serie configurate'} • Tocca per espandere
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    {/* Descrizione Tecnica & Video Guida */}
                    <View style={styles.exInfoBlock}>
                      <View style={styles.exDescRow}>
                        <Text style={styles.miniLabel}>DESCRIZIONE GENERICA ESERCIZIO</Text>
                        <TextInput
                          style={[styles.textInput, styles.exDescInp]}
                          value={re.customDescription ?? (exInfo?.description || '')}
                          onChangeText={(val) => {
                            const up = [...routineExercises];
                            up[exIdx].customDescription = val;
                            setRoutineExercises(up);
                          }}
                          placeholder={exInfo?.description || "Aggiungi note esecutive, setup, ROM..."}
                          placeholderTextColor={colors.textMuted}
                          multiline
                          numberOfLines={2}
                        />
                      </View>

                      <View style={styles.exVideoRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.miniLabel}>LINK VIDEO YOUTUBE (URL)</Text>
                          <TextInput
                            style={styles.setInpVideo}
                            value={re.customVideoUrl ?? (exInfo?.video_url || '')}
                            onChangeText={(val) => {
                              const up = [...routineExercises];
                              up[exIdx].customVideoUrl = val;
                              setRoutineExercises(up);
                            }}
                            placeholder={exInfo?.video_url || "https://youtu.be/..."}
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </View>
                        {Boolean((re.customVideoUrl ?? exInfo?.video_url)?.trim()) && (
                          <Pressable
                            style={styles.videoWatchBtn}
                            onPress={() =>
                              setActiveVideoModal({
                                visible: true,
                                url: (re.customVideoUrl ?? exInfo?.video_url)!.trim(),
                                name: exName,
                              })
                            }
                          >
                            <Text style={styles.videoWatchBtnText}>🎬 Video</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>

                    {/* Sets List (Starts at 0) */}
                    {re.sets.length === 0 ? (
                      <View style={styles.noSetsBox}>
                        <Text style={styles.noSetsText}>
                          0 serie configurate. Clicca "+ Aggiungi Serie" per impostare tipo e target.
                        </Text>
                      </View>
                    ) : (
                      re.sets.map((s, sIdx) => {
                        const bStyle = getBadgeStyle(s.setType);

                        return (
                          <View key={`s-${sIdx}`} style={styles.setRowBlock}>
                            <View style={styles.setRowTop}>
                              <Text style={styles.setNumCol}>S{s.setNumber}</Text>

                              {/* Set Type Badge */}
                              <View style={[styles.setTypePill, { backgroundColor: bStyle.bg }]}>
                                <Text style={[styles.setTypePillText, { color: bStyle.text }]}>
                                  {bStyle.label}
                                </Text>
                              </View>

                              {/* Inputs based on Exercise Type & Set Type */}
                              {s.setType !== 'dropset' && s.setType !== 'rest_pause' && (
                                <>
                                  {exType === 'reps' && (
                                    <View style={styles.inputsRow}>
                                      <View style={styles.inputMiniCol}>
                                        <Text style={styles.miniLabel}>TARGET KG</Text>
                                        <TextInput
                                          style={styles.setInp}
                                          keyboardType="decimal-pad"
                                          value={s.targetWeightKg === 0 ? '' : String(s.targetWeightKg)}
                                          onChangeText={(val) => {
                                            const num = parseFloat(val.replace(',', '.'));
                                            const up = [...routineExercises];
                                            up[exIdx].sets[sIdx].targetWeightKg = isNaN(num) ? 0 : num;
                                            setRoutineExercises(up);
                                          }}
                                          placeholder="0"
                                          placeholderTextColor={colors.textMuted}
                                        />
                                      </View>

                                      <View style={styles.inputMiniCol}>
                                        <Text style={styles.miniLabel}>REPS</Text>
                                        <TextInput
                                          style={styles.setInp}
                                          keyboardType="numeric"
                                          value={s.targetReps === 0 ? '' : String(s.targetReps)}
                                          onChangeText={(val) => {
                                            const num = parseInt(val, 10);
                                            const up = [...routineExercises];
                                            up[exIdx].sets[sIdx].targetReps = isNaN(num) ? 0 : num;
                                            setRoutineExercises(up);
                                          }}
                                          placeholder="10"
                                          placeholderTextColor={colors.textMuted}
                                        />
                                      </View>
                                    </View>
                                  )}

                                  {exType === 'time' && (
                                    <View style={styles.inputsRow}>
                                      <View style={[styles.inputMiniCol, { flex: 2 }]}>
                                        <Text style={styles.miniLabel}>DURATA TARGET (SECONDI)</Text>
                                        <TextInput
                                          style={[styles.setInp, { color: colors.emerald }]}
                                          keyboardType="numeric"
                                          value={String(s.targetTimeSeconds || 60)}
                                          onChangeText={(val) => {
                                            const num = parseInt(val, 10);
                                            const up = [...routineExercises];
                                            up[exIdx].sets[sIdx].targetTimeSeconds = isNaN(num) ? 60 : num;
                                            setRoutineExercises(up);
                                          }}
                                          placeholder="60s"
                                          placeholderTextColor={colors.textMuted}
                                        />
                                      </View>
                                    </View>
                                  )}

                                  {exType === 'bodyweight' && (
                                    <View style={styles.inputsRow}>
                                      <View style={[styles.inputMiniCol, { flex: 1, minWidth: 150, marginRight: 6 }]}>
                                        <Text style={styles.miniLabel}>TIPO / ELASTICO</Text>
                                        <BandSelectDropdown
                                          compact
                                          value={s.bandAssistance || 'none'}
                                          onChange={(val) => {
                                            const up = [...routineExercises];
                                            up[exIdx].sets[sIdx].bandAssistance = val;
                                            setRoutineExercises(up);
                                          }}
                                        />
                                      </View>

                                      {s.bandAssistance === 'weighted' && (
                                        <View style={[styles.inputMiniCol, { width: 72, marginRight: 6 }]}>
                                          <Text style={styles.miniLabel}>ZAVORRA (+KG)</Text>
                                          <TextInput
                                            style={styles.setInp}
                                            keyboardType="decimal-pad"
                                            value={s.targetWeightKg === 0 ? '' : String(s.targetWeightKg)}
                                            onChangeText={(val) => {
                                              const num = parseFloat(val.replace(',', '.'));
                                              const up = [...routineExercises];
                                              up[exIdx].sets[sIdx].targetWeightKg = isNaN(num) ? 0 : num;
                                              setRoutineExercises(up);
                                            }}
                                            placeholder="+0"
                                            placeholderTextColor={colors.textMuted}
                                          />
                                        </View>
                                      )}

                                      <View style={[styles.inputMiniCol, { width: 60 }]}>
                                        <Text style={styles.miniLabel}>REPS</Text>
                                        <TextInput
                                          style={styles.setInp}
                                          keyboardType="numeric"
                                          value={s.targetReps === 0 ? '' : String(s.targetReps)}
                                          onChangeText={(val) => {
                                            const num = parseInt(val, 10);
                                            const up = [...routineExercises];
                                            up[exIdx].sets[sIdx].targetReps = isNaN(num) ? 0 : num;
                                            setRoutineExercises(up);
                                          }}
                                          placeholder="8"
                                          placeholderTextColor={colors.textMuted}
                                        />
                                      </View>
                                    </View>
                                  )}
                                </>
                              )}

                          <View style={[styles.inputMiniCol, { width: 54 }]}>
                            <Text style={styles.miniLabel}>RECUPERO</Text>
                            <TextInput
                              style={styles.setInp}
                              keyboardType="numeric"
                              value={String(s.restSeconds)}
                              onChangeText={(val) => {
                                const num = parseInt(val, 10);
                                const up = [...routineExercises];
                                up[exIdx].sets[sIdx].restSeconds = isNaN(num) ? 90 : num;
                                setRoutineExercises(up);
                              }}
                              placeholder="90s"
                              placeholderTextColor={colors.textMuted}
                            />
                          </View>

                          <Pressable
                            onPress={() => handleRemoveSet(exIdx, sIdx)}
                            style={styles.setDelBtn}
                          >
                            <Text style={styles.setDelText}>×</Text>
                          </Pressable>
                        </View>

                        {/* Dynamic Drops Rows for Stripping & Rest-Pause */}
                        {(s.setType === 'dropset' || s.setType === 'rest_pause') && (
                          <View style={styles.dropsContainer}>
                            <Text style={styles.dropsContainerTitle}>
                              {s.setType === 'dropset'
                                ? '⚡ SCALATE STRIPPING (MINIMO 2 STEP)'
                                : '⏱ SLOT REST-PAUSE (MINIMO 2 STEP)'}
                            </Text>

                            {(s.drops || []).map((drop, dropIdx) => (
                              <View key={drop.id} style={styles.dropStepRow}>
                                <Text style={styles.dropStepBadge}>
                                  Step {dropIdx + 1}
                                </Text>

                                <View style={styles.dropInpCol}>
                                  <Text style={styles.miniLabel}>KG</Text>
                                  <TextInput
                                    style={styles.dropInp}
                                    keyboardType="decimal-pad"
                                    value={drop.kg === 0 ? '' : String(drop.kg)}
                                    onChangeText={(val) => {
                                      const num = parseFloat(val.replace(',', '.'));
                                      const up = [...routineExercises];
                                      if (up[exIdx].sets[sIdx].drops) {
                                        up[exIdx].sets[sIdx].drops![dropIdx].kg = isNaN(num) ? 0 : num;
                                      }
                                      setRoutineExercises(up);
                                    }}
                                    placeholder="0"
                                    placeholderTextColor={colors.textMuted}
                                  />
                                </View>

                                <View style={styles.dropInpCol}>
                                  <Text style={styles.miniLabel}>REPS</Text>
                                  <TextInput
                                    style={styles.dropInp}
                                    keyboardType="numeric"
                                    value={drop.reps === 0 ? '' : String(drop.reps)}
                                    onChangeText={(val) => {
                                      const num = parseInt(val, 10);
                                      const up = [...routineExercises];
                                      if (up[exIdx].sets[sIdx].drops) {
                                        up[exIdx].sets[sIdx].drops![dropIdx].reps = isNaN(num) ? 0 : num;
                                      }
                                      setRoutineExercises(up);
                                    }}
                                    placeholder="8"
                                    placeholderTextColor={colors.textMuted}
                                  />
                                </View>

                                {s.setType === 'rest_pause' && (
                                  <View style={styles.dropInpCol}>
                                    <Text style={styles.miniLabel}>PAUSA (S)</Text>
                                    <TextInput
                                      style={styles.dropInp}
                                      keyboardType="numeric"
                                      value={String(drop.restSeconds || 20)}
                                      onChangeText={(val) => {
                                        const num = parseInt(val, 10);
                                        const up = [...routineExercises];
                                        if (up[exIdx].sets[sIdx].drops) {
                                          up[exIdx].sets[sIdx].drops![dropIdx].restSeconds = isNaN(num)
                                            ? 20
                                            : num;
                                        }
                                        setRoutineExercises(up);
                                      }}
                                      placeholder="20s"
                                      placeholderTextColor={colors.textMuted}
                                    />
                                  </View>
                                )}

                                {(s.drops || []).length > 2 && (
                                  <Pressable
                                    onPress={() => handleRemoveDropSlot(exIdx, sIdx, dropIdx)}
                                    style={styles.delDropBtn}
                                  >
                                    <Text style={styles.delDropText}>✕</Text>
                                  </Pressable>
                                )}
                              </View>
                            ))}

                            {/* Add Drop / Slot button */}
                            <Pressable
                              onPress={() => handleAddDropSlot(exIdx, sIdx)}
                              style={styles.addDropSlotBtn}
                            >
                              <Text style={styles.addDropSlotText}>
                                + Aggiungi Drop / Slot
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}

                {/* Add Set Button */}
                <Pressable
                  onPress={() => handleOpenAddSet(exIdx)}
                  style={styles.addSetRowBtn}
                >
                  <Text style={styles.addSetRowText}>+ Aggiungi Serie</Text>
                </Pressable>
              </>
            )}
          </Card>
            );
          })
        )}
      </ScrollView>

      {/* Choice Modal: Single vs Super Serie */}
      {showAddChoiceModal && (
        <View style={styles.overlayCenter}>
          <View style={styles.choiceCard}>
            <Text style={typography.h3}>Aggiungi Esercizi</Text>
            <Text style={styles.choiceDesc}>
              Scegli se aggiungere un singolo esercizio oppure creare una Super Serie coordinata.
            </Text>

            <Pressable
              onPress={() => handleSelectAddType('single')}
              style={styles.choiceOptionBtn}
            >
              <Text style={styles.choiceOptionIcon}>🏋️</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={typography.bodyBold}>Esercizio Singolo</Text>
                <Text style={typography.caption}>Esecuzione classica serie dopo serie</Text>
              </View>
              <Text style={styles.choiceArrow}>→</Text>
            </Pressable>

            <Pressable
              onPress={() => handleSelectAddType('superset')}
              style={[styles.choiceOptionBtn, { borderColor: colors.accent }]}
            >
              <Text style={styles.choiceOptionIcon}>⚡</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[typography.bodyBold, { color: colors.accent }]}>Super Serie</Text>
                <Text style={typography.caption}>Seleziona 2 o più esercizi da alternare a round</Text>
              </View>
              <Text style={styles.choiceArrow}>→</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowAddChoiceModal(false)}
              style={styles.choiceCancelBtn}
            >
              <Text style={styles.choiceCancelText}>Annulla</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Set Type Picker Modal */}
      {setTypeModalExerciseIdx !== null && (
        <View style={styles.overlayCenter}>
          <View style={styles.choiceCard}>
            <Text style={typography.h3}>Seleziona Tipo Serie</Text>
            <Text style={styles.choiceDesc}>Scegli la tecnica di intensità per questa serie:</Text>

            {SET_TYPES.map((st) => (
              <Pressable
                key={st.key}
                onPress={() => handleConfirmAddSetType(st.key)}
                style={styles.choiceOptionBtn}
              >
                <Text style={typography.bodyBold}>{st.label}</Text>
                <Text style={styles.choiceArrow}>+</Text>
              </Pressable>
            ))}

            <Pressable
              onPress={() => setSetTypeModalExerciseIdx(null)}
              style={styles.choiceCancelBtn}
            >
              <Text style={styles.choiceCancelText}>Annulla</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Exercise Picker Overlay Modal (Supports Single & Multi/Superset) */}
      {showExercisePicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={typography.h3}>
                  {pickerMode === 'superset' ? 'Seleziona Esercizi Super Serie' : 'Seleziona dal Catalogo'}
                </Text>
                {pickerMode === 'superset' && (
                  <Text style={typography.caption}>
                    Selezionati: {selectedSupersetExerciseIds.length} (minimo 2)
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => setShowExercisePicker(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {['Tutti', 'Petto', 'Dorso', 'Spalle', 'Bicipiti', 'Tricipiti', 'Quadricipiti', 'Femorali', 'Polpacci', 'Addome'].map(
                (grp) => (
                  <Pressable
                    key={grp}
                    onPress={() => setFilterMuscle(grp)}
                    style={[
                      styles.filterChip,
                      filterMuscle === grp && styles.filterChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        filterMuscle === grp && styles.filterChipTextActive,
                      ]}
                    >
                      {grp}
                    </Text>
                  </Pressable>
                )
              )}
            </ScrollView>

            <ScrollView style={styles.pickerList}>
              {filteredExercises.map((ex) => {
                const isSelected = selectedSupersetExerciseIds.includes(ex.id);

                return (
                  <Pressable
                    key={ex.id}
                    onPress={() => {
                      if (pickerMode === 'superset') {
                        handleToggleSupersetSelection(ex.id);
                      } else {
                        handleSelectSingleExercise(ex.id);
                      }
                    }}
                    style={[
                      styles.pickerItem,
                      isSelected && styles.pickerItemSelected,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={typography.bodyBold}>{ex.name}</Text>
                      <Text style={typography.caption}>
                        {ex.muscle_group} • {ex.exercise_type}
                      </Text>
                    </View>

                    {pickerMode === 'superset' ? (
                      <View style={[styles.checkboxCircle, isSelected && styles.checkboxCircleActive]}>
                        {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
                      </View>
                    ) : (
                      <Text style={styles.pickerAddText}>+ Scegli</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {pickerMode === 'superset' && (
              <View style={styles.pickerFooter}>
                <Pressable
                  onPress={handleConfirmSupersetSelection}
                  style={[
                    styles.confirmSupersetBtn,
                    selectedSupersetExerciseIds.length < 2 && styles.confirmSupersetBtnDisabled,
                  ]}
                >
                  <Text style={styles.confirmSupersetBtnText}>
                    CREA SUPER SERIE ({selectedSupersetExerciseIds.length})
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Custom Delete Confirmation Modal */}
      <CustomConfirmModal
        visible={showDeleteConfirm}
        title="Elimina Scheda"
        message={`Sei sicuro di voler eliminare definitivamente la scheda "${name}"? L'azione non può essere annullata.`}
        confirmText="Elimina Scheda"
        isDestructive
        onConfirm={handleConfirmDeleteRoutine}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Footer Submit */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleSaveRoutine}
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: selectedBorderColor, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.submitButtonText}>
            {isEditing ? '✓ SALVA MODIFICHE SCHEDA' : '✓ CREA SCHEDA ALLENAMENTO'}
          </Text>
        </Pressable>
      </View>

      <YouTubeModalOverlay
        visible={activeVideoModal.visible}
        videoUrl={activeVideoModal.url}
        exerciseName={activeVideoModal.name}
        onClose={() => setActiveVideoModal((prev) => ({ ...prev, visible: false }))}
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
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerDeleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    marginRight: 8,
  },
  headerDeleteText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
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
    paddingBottom: 24,
  },
  formCard: {
    padding: 16,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  newFolderLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  newFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveFolderBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: layout.borderRadiusMd,
  },
  saveFolderBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  folderScroll: {
    flexDirection: 'row',
  },
  folderChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: layout.borderRadiusLg,
    backgroundColor: colors.backgroundSubtle,
    marginRight: 8,
  },
  folderChipActive: {
    backgroundColor: colors.accent,
  },
  folderChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  folderChipTextActive: {
    color: colors.white,
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: colors.white,
    transform: [{ scale: 1.1 }],
  },
  colorCheck: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 14,
  },
  textInput: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusMd,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  rowTwoCols: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addExBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: layout.borderRadiusMd,
  },
  addExBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 12,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  exCard: {
    padding: 14,
    marginBottom: 14,
  },
  supersetCardBorder: {
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  exHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reorderCol: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  arrowBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  arrowBtnDisabled: {
    opacity: 0.3,
  },
  arrowText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
  },
  arrowTextDisabled: {
    color: colors.textMuted,
  },
  supersetTag: {
    backgroundColor: colors.accentMuted,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  supersetTagText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  removeExBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeExBtnText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  noSetsBox: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 6,
    marginVertical: 6,
  },
  noSetsText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  setRowBlock: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.4)',
  },
  setRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setNumCol: {
    width: 28,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  setTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.borderRadiusSm,
    marginRight: 8,
  },
  setTypePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  inputsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  inputMiniCol: {
    flex: 1,
  },
  miniLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  setInp: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  setDelBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  setDelText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  dropsContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: colors.danger,
  },
  dropsContainerTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.danger,
    marginBottom: 6,
  },
  dropStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  dropStepBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    width: 50,
  },
  dropInpCol: {
    flex: 1,
  },
  dropInp: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  delDropBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delDropText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  addDropSlotBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    marginTop: 4,
  },
  addDropSlotText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '800',
  },
  addSetRowBtn: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addSetRowText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  overlayCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1000,
  },
  choiceCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.backgroundElevated,
    borderRadius: layout.borderRadiusLg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    marginVertical: 12,
    lineHeight: 18,
  },
  choiceOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusMd,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  choiceOptionIcon: {
    fontSize: 22,
  },
  choiceArrow: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
  },
  choiceCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  choiceCancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  pickerModal: {
    backgroundColor: colors.backgroundElevated,
    borderTopLeftRadius: layout.borderRadiusLg,
    borderTopRightRadius: layout.borderRadiusLg,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: layout.borderRadiusLg,
    backgroundColor: colors.backgroundSubtle,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: colors.accent,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  pickerList: {
    paddingHorizontal: 16,
    maxHeight: 380,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.5)',
  },
  pickerItemSelected: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
  },
  pickerAddText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  checkboxCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCircleActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  checkboxCheck: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  pickerFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  confirmSupersetBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
  },
  confirmSupersetBtnDisabled: {
    opacity: 0.4,
  },
  confirmSupersetBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  footer: {
    padding: 16,
    backgroundColor: colors.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapseExBtn: {
    backgroundColor: colors.backgroundSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  collapseExBtnText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  collapsedBadgeRow: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: layout.borderRadiusSm,
    marginTop: 8,
    alignItems: 'center',
  },
  collapsedBadgeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  exInfoBlock: {
    backgroundColor: '#162235',
    padding: 10,
    borderRadius: layout.borderRadiusSm,
    marginTop: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  exDescRow: {
    marginBottom: 8,
  },
  exDescInp: {
    height: 52,
    fontSize: 12,
    paddingTop: 8,
  },
  exVideoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  setInpVideo: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusSm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: colors.text,
    fontSize: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  videoWatchBtn: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: layout.borderRadiusSm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoWatchBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  bandScrollMini: {
    marginTop: 4,
    marginBottom: 2,
  },
  bandMiniChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: colors.backgroundSubtle,
    marginRight: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  bandMiniChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  bandMiniChipText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  bandMiniChipTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  delegationModalBanner: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EC4899',
  },
  delegationModalBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EC4899',
    marginBottom: 2,
  },
  delegationModalBannerSub: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
});


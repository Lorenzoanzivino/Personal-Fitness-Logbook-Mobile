import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList, RootStackNavigationProp } from '../../types/navigation';
import { useGym } from '../../context/GymContext';
import { RoutineExercise, RoutineBlock, RoutineBlockType, SetType, BandAssistance, ExerciseType, SetDropStep } from '../../types/workout';
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
  dropPercentage?: number | null;
  restSeconds: number;
  notes?: string;
}

interface BuilderExerciseState {
  tempId: string;
  exerciseId: number;
  exerciseOrder: number;
  blockType?: RoutineBlockType;
  blockId?: string;
  circuitRounds?: number;
  circuitRestBetweenRounds?: number;
  intraRestSeconds?: number;
  supersetGroup: string | null;
  customDescription?: string;
  customVideoUrl?: string;
  sets: BuilderSetState[];
}

export const NewRoutineModal: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<NewRoutineModalRouteProp>();
  const insets = useSafeAreaInsets();
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

  // Accordion collapsed block IDs (Circuit or Superset)
  const [collapsedBlockIds, setCollapsedBlockIds] = useState<Set<string>>(new Set());

  const toggleBlockCollapse = (blockKey: string) => {
    setCollapsedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockKey)) {
        next.delete(blockKey);
      } else {
        next.add(blockKey);
      }
      return next;
    });
  };

  // Hidden Note / Video section exercise IDs (opt-out)
  const [hiddenNotesExIds, setHiddenNotesExIds] = useState<Set<string>>(new Set());

  // Target Circuit Block ID when adding an exercise directly to a specific circuit
  const [targetCircuitBlockId, setTargetCircuitBlockId] = useState<string | null>(null);

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
  const [pickerMode, setPickerMode] = useState<'single' | 'superset' | 'circuit'>('single');
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

      const mapSetsToBuilder = (sets: any[]) => {
        return (sets || []).map((s, sIdx) => {
          let loadedDrops: BuilderDropState[] | undefined = undefined;
          if (s.drops && s.drops.length > 0) {
            loadedDrops = s.drops.map((d: any, dIdx: number) => ({
              id: d.id || `d-${dIdx}-${Date.now()}`,
              kg: d.kg || 0,
              reps: d.reps || 10,
              restSeconds: d.rest_seconds ?? (s.set_type === 'rest_pause' ? 10 : 0),
            }));
          } else if (s.set_type === 'dropset') {
            loadedDrops = [
              { id: `d-1-${sIdx}`, kg: s.target_weight_kg || 0, reps: s.target_reps || 10, restSeconds: 0 },
              { id: `d-2-${sIdx}`, kg: s.dropset_weight_kg || 0, reps: s.target_reps || 10, restSeconds: 0 },
            ];
          } else if (s.set_type === 'rest_pause') {
            loadedDrops = [
              { id: `rp-1-${sIdx}`, kg: s.target_weight_kg || 0, reps: s.target_reps || 10, restSeconds: 10 },
              { id: `rp-2-${sIdx}`, kg: s.target_weight_kg || 0, reps: 10, restSeconds: 10 },
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
            dropPercentage: s.drop_percentage ?? (s.set_type === 'dropset' ? 20 : null),
            restSeconds: s.rest_seconds || 90,
            notes: s.notes || undefined,
          };
        });
      };

      if (existingRoutine.blocks && existingRoutine.blocks.length > 0) {
        const loaded: BuilderExerciseState[] = [];
        let orderCounter = 1;

        existingRoutine.blocks.forEach((blk, bIdx) => {
          const blkId = `blk-${blk.id || bIdx}-${Date.now()}`;
          const bType: RoutineBlockType = blk.block_type || 'STANDARD';
          const rounds = bType === 'CIRCUIT' ? (blk.rounds || 3) : 1;
          const restBetweenRounds = bType === 'CIRCUIT' ? (blk.rest_between_rounds ?? 60) : 0;

          (blk.exercises || []).forEach((re, reIdx) => {
            const intraRest = re.intra_rest_seconds ?? (bType === 'CIRCUIT' ? 15 : 0);
            loaded.push({
              tempId: `re-${re.exercise_id}-${bIdx}-${reIdx}-${Date.now()}`,
              exerciseId: re.exercise_id,
              exerciseOrder: orderCounter++,
              blockType: bType,
              blockId: blkId,
              circuitRounds: rounds,
              circuitRestBetweenRounds: restBetweenRounds,
              intraRestSeconds: intraRest,
              supersetGroup: re.superset_group || (bType === 'SUPERSET' ? 'A' : null),
              customDescription: re.custom_description || undefined,
              customVideoUrl: re.custom_video_url || undefined,
              sets: (() => {
                const mapped = mapSetsToBuilder(re.sets);
                if (bType === 'CIRCUIT') {
                  if (mapped.length === 0) {
                    return [
                      {
                        setNumber: 1,
                        setType: 'normal',
                        targetWeightKg: 0,
                        targetReps: 10,
                        targetTimeSeconds: 60,
                        bandAssistance: 'none',
                        dropsetWeightKg: null,
                        restSeconds: 0,
                      },
                    ];
                  }
                  return mapped.slice(0, 1);
                }
                return mapped;
              })(),
            });
          });
        });
        setRoutineExercises(loaded);
      } else if (existingRoutine.exercises) {
        const loaded: BuilderExerciseState[] = existingRoutine.exercises.map((re, idx) => ({
          tempId: `re-${re.exercise_id}-${idx}-${Date.now()}`,
          exerciseId: re.exercise_id,
          exerciseOrder: re.exercise_order || idx + 1,
          blockType: re.superset_group ? 'SUPERSET' : 'STANDARD',
          blockId: re.superset_group ? `blk-ss-${re.superset_group}` : `blk-std-${idx}`,
          circuitRounds: 1,
          circuitRestBetweenRounds: 0,
          intraRestSeconds: re.intra_rest_seconds ?? 0,
          supersetGroup: re.superset_group || null,
          customDescription: re.custom_description || undefined,
          customVideoUrl: re.custom_video_url || undefined,
          sets: mapSetsToBuilder(re.sets),
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
    setTargetCircuitBlockId(null);
    setShowAddChoiceModal(true);
  };

  const handleOpenAddCircuitExercise = (blockId: string) => {
    setTargetCircuitBlockId(blockId);
    setPickerMode('single');
    setShowExercisePicker(true);
  };

  const handleSelectAddType = (mode: 'single' | 'superset' | 'circuit') => {
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

  // Handle Exercise Selection (Appends strictly to end of routine or to targeted circuit block)
  const handleSelectSingleExercise = (exerciseId: number) => {
    setShowExercisePicker(false);

    if (targetCircuitBlockId) {
      const circuitExercises = routineExercises.filter((re) => re.blockId === targetCircuitBlockId);
      const circuitRounds = circuitExercises[0]?.circuitRounds || 3;
      const circuitRestBetweenRounds = circuitExercises[0]?.circuitRestBetweenRounds ?? 60;
      const exInfo = exercises.find((e) => e.id === exerciseId);
      const isTime = exInfo?.exercise_type === 'time';

      const newCircuitEx: BuilderExerciseState = {
        tempId: `re-${exerciseId}-${Date.now()}`,
        exerciseId,
        exerciseOrder: routineExercises.length + 1,
        blockType: 'CIRCUIT',
        blockId: targetCircuitBlockId,
        circuitRounds,
        circuitRestBetweenRounds,
        intraRestSeconds: 15,
        supersetGroup: null,
        sets: [
          {
            setNumber: 1,
            setType: 'normal',
            targetWeightKg: 0,
            targetReps: isTime ? 0 : 10,
            targetTimeSeconds: isTime ? 60 : null,
            bandAssistance: 'none',
            dropsetWeightKg: null,
            restSeconds: 15,
          },
        ],
      };

      // Insert directly after the last exercise of this circuit block
      let lastCircuitIdx = -1;
      for (let i = routineExercises.length - 1; i >= 0; i--) {
        if (routineExercises[i].blockId === targetCircuitBlockId) {
          lastCircuitIdx = i;
          break;
        }
      }

      const updated = [...routineExercises];
      if (lastCircuitIdx !== -1) {
        updated.splice(lastCircuitIdx + 1, 0, newCircuitEx);
      } else {
        updated.push(newCircuitEx);
      }

      updated.forEach((e, idx) => {
        e.exerciseOrder = idx + 1;
      });

      setRoutineExercises(updated);
      setTargetCircuitBlockId(null);
      showToast('success', 'Esercizio aggiunto al circuito!');
      return;
    }

    const stdBlockId = `blk-std-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const newEx: BuilderExerciseState = {
      tempId: `re-${exerciseId}-${Date.now()}`,
      exerciseId,
      exerciseOrder: routineExercises.length + 1,
      blockType: 'STANDARD',
      blockId: stdBlockId,
      circuitRounds: 1,
      circuitRestBetweenRounds: 0,
      intraRestSeconds: 0,
      supersetGroup: null,
      sets: [], // 0 serie iniziali
    };

    const updated = [...routineExercises, newEx];
    updated.forEach((e, idx) => {
      e.exerciseOrder = idx + 1;
    });

    setRoutineExercises(updated);
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
    const supersetBlockId = `blk-ss-${groupLetter}-${Date.now()}`;
    const newItems: BuilderExerciseState[] = selectedSupersetExerciseIds.map((exId, idx) => ({
      tempId: `re-${exId}-${Date.now()}-${idx}`,
      exerciseId: exId,
      exerciseOrder: routineExercises.length + idx + 1,
      blockType: 'SUPERSET',
      blockId: supersetBlockId,
      circuitRounds: 1,
      circuitRestBetweenRounds: 0,
      intraRestSeconds: 0,
      supersetGroup: groupLetter,
      sets: [], // Nascono con 0 serie
    }));

    setRoutineExercises([...routineExercises, ...newItems]);
    setShowExercisePicker(false);
    setSelectedSupersetExerciseIds([]);
    showToast('success', `Super Serie ${groupLetter} aggiunta (${newItems.length} esercizi)!`);
  };

  const handleConfirmCircuitSelection = () => {
    if (selectedSupersetExerciseIds.length < 2) {
      showToast('error', 'Seleziona almeno 2 esercizi per creare un Circuito.');
      return;
    }

    const circuitBlockId = `blk-circuit-${Date.now()}`;
    const newItems: BuilderExerciseState[] = selectedSupersetExerciseIds.map((exId, idx) => {
      const exInfo = exercises.find((e) => e.id === exId);
      const isTime = exInfo?.exercise_type === 'time';
      return {
        tempId: `re-${exId}-${Date.now()}-${idx}`,
        exerciseId: exId,
        exerciseOrder: routineExercises.length + idx + 1,
        blockType: 'CIRCUIT',
        blockId: circuitBlockId,
        circuitRounds: 3,
        circuitRestBetweenRounds: 60,
        intraRestSeconds: 15,
        supersetGroup: null,
        sets: [
          {
            setNumber: 1,
            setType: 'normal',
            targetWeightKg: 0,
            targetReps: isTime ? 0 : 10,
            targetTimeSeconds: isTime ? 60 : null,
            bandAssistance: 'none',
            dropsetWeightKg: null,
            restSeconds: 15,
          },
        ],
      };
    });

    setRoutineExercises([...routineExercises, ...newItems]);
    setShowExercisePicker(false);
    setSelectedSupersetExerciseIds([]);
    showToast('success', `Circuito creato (${newItems.length} esercizi • 3 Giri)!`);
  };

  const updateCircuitRounds = (blockId: string, rounds: number) => {
    const updated = routineExercises.map((re) =>
      re.blockId === blockId ? { ...re, circuitRounds: Math.max(1, rounds) } : re
    );
    setRoutineExercises(updated);
  };

  const updateCircuitRest = (blockId: string, restSecs: number) => {
    const updated = routineExercises.map((re) =>
      re.blockId === blockId ? { ...re, circuitRestBetweenRounds: Math.max(0, restSecs) } : re
    );
    setRoutineExercises(updated);
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
    if (routineExercises[exIndex]?.blockType === 'CIRCUIT') {
      showToast('info', 'Nei circuiti il numero di serie coincide con i giri configurati.');
      return;
    }
    setSetTypeModalExerciseIdx(exIndex);
  };

  const handleConfirmAddSetType = (type: SetType) => {
    if (setTypeModalExerciseIdx === null) return;
    const exIdx = setTypeModalExerciseIdx;
    setSetTypeModalExerciseIdx(null);

    if (routineExercises[exIdx]?.blockType === 'CIRCUIT') {
      showToast('info', 'Nei circuiti il numero di serie coincide con i giri configurati.');
      return;
    }

    const updated = [...routineExercises];
    const exInfo = exercises.find((e) => e.id === updated[exIdx].exerciseId);
    const exType: ExerciseType = exInfo?.exercise_type || 'reps';
    const setNum = updated[exIdx].sets.length + 1;

    let initialDrops: BuilderDropState[] | undefined = undefined;
    if (type === 'dropset') {
      // 2 slot di drop di default (Stripping) con pausa intra es. 0s
      initialDrops = [
        { id: `drop-${Date.now()}-1`, kg: 0, reps: 10, restSeconds: 0 },
        { id: `drop-${Date.now()}-2`, kg: 0, reps: 10, restSeconds: 0 },
      ];
    } else if (type === 'rest_pause') {
      // 2 slot di rest-pause di default con pausa intra es. 10s
      initialDrops = [
        { id: `drop-${Date.now()}-1`, kg: 0, reps: 10, restSeconds: 10 },
        { id: `drop-${Date.now()}-2`, kg: 0, reps: 10, restSeconds: 10 },
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
      dropPercentage: type === 'dropset' ? 20 : null,
      restSeconds: 90,
    };

    updated[exIdx].sets.push(newSet);
    setRoutineExercises(updated);
  };

  const handleRemoveSet = (exIndex: number, setIndex: number) => {
    if (routineExercises[exIndex]?.blockType === 'CIRCUIT') {
      showToast('info', 'La serie base di un esercizio a circuito non può essere eliminata.');
      return;
    }
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
    const dropPct = set.dropPercentage != null && set.dropPercentage > 0 ? set.dropPercentage : 20;
    const calculatedKg = lastDrop && set.setType === 'dropset'
      ? Math.max(0, Math.round(lastDrop.kg * (1 - dropPct / 100) * 10) / 10)
      : (lastDrop ? Math.max(0, Math.round(lastDrop.kg * 0.8)) : 0);

    set.drops.push({
      id: `drop-${Date.now()}-${dropNumber}`,
      kg: calculatedKg,
      reps: lastDrop ? lastDrop.reps : 10,
      restSeconds: set.setType === 'rest_pause' ? 10 : 0,
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

    // Check duplicate name (escludi la scheda in lavorazione in caso di modifica)
    const currentId = existingRoutine ? existingRoutine.id : routineId;
    const targetOwnerId = isEditing
      ? existingRoutine?.owner_id
      : (isDelegatedMode && selectedClient ? selectedClient.id : undefined);

    const isDuplicate = routines.some((r) => {
      if (isEditing && (r.id === existingRoutine?.id || (currentId != null && String(r.id) === String(currentId)))) {
        return false;
      }
      if (targetOwnerId && r.owner_id && r.owner_id !== targetOwnerId) {
        return false;
      }
      return r.name.trim().toLowerCase() === trimmedName.toLowerCase();
    });
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
            drop_percentage: s.dropPercentage ?? (s.setType === 'dropset' ? 20 : null),
            rest_seconds: s.restSeconds,
          };
        }),
      };
    });

    // Group exercises into blocks
    const blocksMap = new Map<string, BuilderExerciseState[]>();
    const blockIds: string[] = [];

    routineExercises.forEach((re) => {
      const bId = re.blockId || (re.supersetGroup ? `blk-ss-${re.supersetGroup}` : `blk-std-${re.tempId}`);
      if (!blocksMap.has(bId)) {
        blocksMap.set(bId, []);
        blockIds.push(bId);
      }
      blocksMap.get(bId)!.push(re);
    });

    const mappedBlocks: RoutineBlock[] = blockIds.map((bId, bIdx) => {
      const exList = blocksMap.get(bId)!;
      const first = exList[0];
      const bType: RoutineBlockType = first.blockType || (first.supersetGroup ? 'SUPERSET' : 'STANDARD');
      const rounds = bType === 'CIRCUIT' ? (first.circuitRounds || 3) : 1;
      const restBetweenRounds = bType === 'CIRCUIT' ? (first.circuitRestBetweenRounds ?? 60) : 0;

      const blockExs: RoutineExercise[] = exList.map((re, exIdxInBlock) => {
        const foundEx = exercises.find((e) => e.id === re.exerciseId);
        return {
          routine_id: routineId || 0,
          exercise_id: re.exerciseId,
          exercise_order: exIdxInBlock + 1,
          intra_rest_seconds: bType === 'CIRCUIT' ? (re.intraRestSeconds ?? 15) : 0,
          superset_group: re.supersetGroup || (bType === 'SUPERSET' ? 'A' : null),
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
              drop_percentage: s.dropPercentage ?? (s.setType === 'dropset' ? 20 : null),
              rest_seconds: s.restSeconds,
            };
          }),
        };
      });

      return {
        routine_id: routineId || 0,
        block_type: bType,
        order_index: bIdx + 1,
        rounds,
        rest_between_rounds: restBetweenRounds,
        exercises: blockExs,
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
          blocks: mappedBlocks,
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
          blocks: mappedBlocks,
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
            const isCircuit = re.blockType === 'CIRCUIT';
            const circuitBlockKey = re.blockId || `blk-circuit-${re.exerciseOrder}`;
            const isCircuitCollapsed = isCircuit && collapsedBlockIds.has(circuitBlockKey);

            const isSuperset = (re.blockType === 'SUPERSET' || Boolean(re.supersetGroup)) && !isCircuit;
            const supersetBlockKey = re.blockId || `blk-ss-${re.supersetGroup || 'default'}`;
            const isSupersetCollapsed = isSuperset && collapsedBlockIds.has(supersetBlockKey);

            const isFirstInCircuit =
              isCircuit &&
              (exIdx === 0 || routineExercises[exIdx - 1].blockId !== re.blockId);

            const isLastInCircuit =
              isCircuit &&
              (exIdx === routineExercises.length - 1 || routineExercises[exIdx + 1].blockId !== re.blockId);

            const isFirstInSuperset =
              isSuperset &&
              (exIdx === 0 ||
                routineExercises[exIdx - 1].blockId !== re.blockId ||
                routineExercises[exIdx - 1].supersetGroup !== re.supersetGroup);

            const circuitExercises = isCircuit
              ? routineExercises.filter((e) => e.blockId === re.blockId)
              : [];
            const supersetExercises = isSuperset
              ? routineExercises.filter((e) => (re.blockId ? e.blockId === re.blockId : e.supersetGroup === re.supersetGroup))
              : [];

            // If circuit block is collapsed, only render block banner once, then hide individual exercises
            if (isCircuit && isCircuitCollapsed) {
              if (!isFirstInCircuit) return null;
              return (
                <React.Fragment key={re.tempId}>
                  <View style={styles.circuitBlockBanner}>
                    <View style={styles.circuitBlockHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.circuitBlockTitle}>🔄 BLOCCO CIRCUITO</Text>
                      </View>
                      <View style={styles.circuitSettingsRow}>
                        <View style={styles.circuitSettingItem}>
                          <Text style={styles.circuitSettingLabel}>Giri:</Text>
                          <Pressable
                            onPress={() =>
                              updateCircuitRounds(
                                re.blockId!,
                                Math.max(1, (re.circuitRounds || 3) - 1)
                              )
                            }
                            style={styles.circuitStepperBtn}
                          >
                            <Text style={styles.circuitStepperText}>-</Text>
                          </Pressable>
                          <Text style={styles.circuitSettingValue}>
                            {re.circuitRounds || 3}
                          </Text>
                          <Pressable
                            onPress={() =>
                              updateCircuitRounds(
                                re.blockId!,
                                (re.circuitRounds || 3) + 1
                              )
                            }
                            style={styles.circuitStepperBtn}
                          >
                            <Text style={styles.circuitStepperText}>+</Text>
                          </Pressable>
                        </View>

                        <View style={styles.circuitSettingItem}>
                          <Text style={styles.circuitSettingLabel}>Rec. Fine:</Text>
                          <Pressable
                            onPress={() =>
                              updateCircuitRest(
                                re.blockId!,
                                Math.max(0, (re.circuitRestBetweenRounds ?? 60) - 15)
                              )
                            }
                            style={styles.circuitStepperBtn}
                          >
                            <Text style={styles.circuitStepperText}>-15</Text>
                          </Pressable>
                          <Text style={styles.circuitSettingValue}>
                            {re.circuitRestBetweenRounds ?? 60}s
                          </Text>
                          <Pressable
                            onPress={() =>
                              updateCircuitRest(
                                re.blockId!,
                                (re.circuitRestBetweenRounds ?? 60) + 15
                              )
                            }
                            style={styles.circuitStepperBtn}
                          >
                            <Text style={styles.circuitStepperText}>+15</Text>
                          </Pressable>
                        </View>

                        <Pressable
                          onPress={() => toggleBlockCollapse(circuitBlockKey)}
                          style={styles.blockCollapseBtn}
                          accessibilityRole="button"
                          accessibilityLabel="Espandi blocco circuito"
                        >
                          <Text style={styles.blockCollapseBtnText}>▼ Espandi</Text>
                        </Pressable>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => toggleBlockCollapse(circuitBlockKey)}
                      style={styles.collapsedBlockSummary}
                    >
                      <Text style={styles.collapsedBlockSummaryText}>
                        📦 Blocco Circuito ({circuitExercises.length} esercizi • {re.circuitRounds || 3} Giri • Rec. {re.circuitRestBetweenRounds ?? 60}s) • Tocca per espandere
                      </Text>
                    </Pressable>
                  </View>
                </React.Fragment>
              );
            }

            // If superset block is collapsed, only render block banner once, then hide individual exercises
            if (isSuperset && isSupersetCollapsed) {
              if (!isFirstInSuperset) return null;
              return (
                <React.Fragment key={re.tempId}>
                  <View style={styles.supersetBlockBanner}>
                    <View style={styles.circuitBlockHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.circuitBlockTitle, { color: '#3B82F6' }]}>
                          ⚡ BLOCCO SUPER SERIE {re.supersetGroup || ''}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => toggleBlockCollapse(supersetBlockKey)}
                        style={styles.blockCollapseBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Espandi blocco super serie"
                      >
                        <Text style={styles.blockCollapseBtnText}>▼ Espandi</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={() => toggleBlockCollapse(supersetBlockKey)}
                      style={styles.collapsedBlockSummary}
                    >
                      <Text style={styles.collapsedBlockSummaryText}>
                        📦 Blocco Super Serie {re.supersetGroup || ''} ({supersetExercises.length} esercizi) • Tocca per espandere
                      </Text>
                    </Pressable>
                  </View>
                </React.Fragment>
              );
            }

            return (
              <React.Fragment key={re.tempId}>
                {isFirstInCircuit && (
                  <View style={styles.circuitBlockBanner}>
                    <View style={styles.circuitBlockHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.circuitBlockTitle}>🔄 BLOCCO CIRCUITO</Text>
                      </View>
                      <View style={styles.circuitSettingsRow}>
                        <View style={styles.circuitSettingItem}>
                          <Text style={styles.circuitSettingLabel}>Giri:</Text>
                          <Pressable
                            onPress={() =>
                              updateCircuitRounds(
                                re.blockId!,
                                Math.max(1, (re.circuitRounds || 3) - 1)
                              )
                            }
                            style={styles.circuitStepperBtn}
                          >
                            <Text style={styles.circuitStepperText}>-</Text>
                          </Pressable>
                          <Text style={styles.circuitSettingValue}>
                            {re.circuitRounds || 3}
                          </Text>
                          <Pressable
                            onPress={() =>
                              updateCircuitRounds(
                                re.blockId!,
                                (re.circuitRounds || 3) + 1
                              )
                            }
                            style={styles.circuitStepperBtn}
                          >
                            <Text style={styles.circuitStepperText}>+</Text>
                          </Pressable>
                        </View>

                        <View style={styles.circuitSettingItem}>
                          <Text style={styles.circuitSettingLabel}>Rec. Fine:</Text>
                          <Pressable
                            onPress={() =>
                              updateCircuitRest(
                                re.blockId!,
                                Math.max(0, (re.circuitRestBetweenRounds ?? 60) - 15)
                              )
                            }
                            style={styles.circuitStepperBtn}
                          >
                            <Text style={styles.circuitStepperText}>-15</Text>
                          </Pressable>
                          <Text style={styles.circuitSettingValue}>
                            {re.circuitRestBetweenRounds ?? 60}s
                          </Text>
                          <Pressable
                            onPress={() =>
                              updateCircuitRest(
                                re.blockId!,
                                (re.circuitRestBetweenRounds ?? 60) + 15
                              )
                            }
                            style={styles.circuitStepperBtn}
                          >
                            <Text style={styles.circuitStepperText}>+15</Text>
                          </Pressable>
                        </View>

                        <Pressable
                          onPress={() => toggleBlockCollapse(circuitBlockKey)}
                          style={styles.blockCollapseBtn}
                          accessibilityRole="button"
                          accessibilityLabel="Riduci blocco circuito"
                        >
                          <Text style={styles.blockCollapseBtnText}>▲ Riduci</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )}

                {isFirstInSuperset && (
                  <View style={styles.supersetBlockBanner}>
                    <View style={styles.circuitBlockHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.circuitBlockTitle, { color: '#3B82F6' }]}>
                          ⚡ BLOCCO SUPER SERIE {re.supersetGroup || ''}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => toggleBlockCollapse(supersetBlockKey)}
                        style={styles.blockCollapseBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Riduci blocco super serie"
                      >
                        <Text style={styles.blockCollapseBtnText}>▲ Riduci</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                <Card
                  style={[
                    styles.exCard,
                    re.blockType === 'CIRCUIT'
                      ? styles.circuitCardBorder
                      : re.supersetGroup
                      ? styles.supersetCardBorder
                      : null,
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
                      {re.blockType === 'CIRCUIT' ? (
                        <View style={[styles.supersetTag, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
                          <Text style={[styles.supersetTagText, { color: '#eab308' }]}>
                            🔄 CIRCUITO ({re.circuitRounds || 3} Giri)
                          </Text>
                        </View>
                      ) : re.supersetGroup ? (
                        <View style={styles.supersetTag}>
                          <Text style={styles.supersetTagText}>
                            ⚡ SUPER SERIE {re.supersetGroup}
                          </Text>
                        </View>
                      ) : null}
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
                    {/* Descrizione Tecnica & Video Guida (Toggleable Opt-In / Opt-Out) */}
                    {!hiddenNotesExIds.has(re.tempId) ? (
                      <View style={styles.exInfoBlock}>
                        <View style={styles.exInfoBlockHeader}>
                          <Text style={styles.miniLabel}>DESCRIZIONE E LINK VIDEO</Text>
                          <Pressable
                            onPress={() => {
                              setHiddenNotesExIds((prev) => {
                                const next = new Set(prev);
                                next.add(re.tempId);
                                return next;
                              });
                            }}
                            style={styles.removeNotesBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Rimuovi sezione note e video"
                          >
                            <Text style={styles.removeNotesBtnText}>🗑 Rimuovi Note</Text>
                          </Pressable>
                        </View>

                        <View style={styles.exDescRow}>
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
                    ) : (
                      <Pressable
                        onPress={() => {
                          setHiddenNotesExIds((prev) => {
                            const next = new Set(prev);
                            next.delete(re.tempId);
                            return next;
                          });
                        }}
                        style={styles.addNotesBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Aggiungi sezione note e video"
                      >
                        <Text style={styles.addNotesBtnText}>+ Aggiungi Note / Video</Text>
                      </Pressable>
                    )}

                    {/* Intra-Recupero for Circuit Exercises */}
                    {re.blockType === 'CIRCUIT' && (
                      <View style={styles.intraRestConfigRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.miniLabel}>INTRA-RECUPERO (DOPO QUESTO ESERCIZIO)</Text>
                          <Text style={typography.caption}>Pausa prima del prossimo esercizio del giro</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Pressable
                            onPress={() => {
                              const up = [...routineExercises];
                              up[exIdx].intraRestSeconds = Math.max(
                                0,
                                (up[exIdx].intraRestSeconds ?? 15) - 5
                              );
                              setRoutineExercises(up);
                            }}
                            style={styles.circuitStepperBtn}
                          >
                            <Text style={styles.circuitStepperText}>-5s</Text>
                          </Pressable>
                          <Text style={styles.intraRestValueText}>
                            {re.intraRestSeconds ?? 15}s
                          </Text>
                          <Pressable
                            onPress={() => {
                              const up = [...routineExercises];
                              up[exIdx].intraRestSeconds =
                                (up[exIdx].intraRestSeconds ?? 15) + 5;
                              setRoutineExercises(up);
                            }}
                            style={styles.circuitStepperBtn}
                          >
                            <Text style={styles.circuitStepperText}>+5s</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}

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
                              <View style={styles.inputsRow}>
                                {s.setType !== 'dropset' && s.setType !== 'rest_pause' ? (
                                  <>
                                    {exType === 'reps' && (
                                      <View style={{ flexDirection: 'row', flex: 1, gap: 6 }}>
                                        <View style={[styles.inputMiniCol, { flex: 1 }]}>
                                          <Text style={styles.miniLabel} numberOfLines={1}>KG</Text>
                                          <TextInput
                                            style={styles.setInp}
                                            keyboardType="decimal-pad"
                                            value={s.targetWeightKg === 0 ? '' : String(s.targetWeightKg)}
                                            onChangeText={(val) => {
                                              const num = parseFloat(val.replace(',', '.'));
                                              const up = [...routineExercises];
                                              up[exIdx].sets[sIdx].targetWeightKg = val.trim() === '' || isNaN(num) ? 0 : Math.max(0, num);
                                              setRoutineExercises(up);
                                            }}
                                            placeholder="0"
                                            placeholderTextColor={colors.textMuted}
                                          />
                                        </View>

                                        <View style={[styles.inputMiniCol, { flex: 1 }]}>
                                          <Text style={styles.miniLabel} numberOfLines={1}>REPS</Text>
                                          <TextInput
                                            style={styles.setInp}
                                            keyboardType="numeric"
                                            value={s.targetReps === 0 ? '' : String(s.targetReps)}
                                            onChangeText={(val) => {
                                              const num = parseInt(val, 10);
                                              const up = [...routineExercises];
                                              up[exIdx].sets[sIdx].targetReps = val.trim() === '' || isNaN(num) ? 0 : Math.max(0, num);
                                              setRoutineExercises(up);
                                            }}
                                            placeholder="0"
                                            placeholderTextColor={colors.textMuted}
                                          />
                                        </View>
                                      </View>
                                    )}

                                    {exType === 'time' && (
                                      <View style={[styles.inputMiniCol, { flex: 2 }]}>
                                        <Text style={styles.miniLabel} numberOfLines={1}>⏱️ SEC</Text>
                                        <TextInput
                                          style={[styles.setInp, { color: colors.emerald }]}
                                          keyboardType="numeric"
                                          value={s.targetTimeSeconds === 0 ? '' : String(s.targetTimeSeconds ?? '')}
                                          onChangeText={(val) => {
                                            const num = parseInt(val, 10);
                                            const up = [...routineExercises];
                                            up[exIdx].sets[sIdx].targetTimeSeconds = val.trim() === '' || isNaN(num) ? 0 : Math.max(0, num);
                                            setRoutineExercises(up);
                                          }}
                                          placeholder="0"
                                          placeholderTextColor={colors.textMuted}
                                        />
                                      </View>
                                    )}

                                    {exType === 'bodyweight' && (
                                      <>
                                        <View style={[styles.inputMiniCol, { flex: 2 }]}>
                                          <Text style={styles.miniLabel} numberOfLines={1}>ELASTICO</Text>
                                          <BandSelectDropdown
                                            compact
                                            style={styles.bandDropdown}
                                            value={s.bandAssistance || 'none'}
                                            onChange={(val) => {
                                              const up = [...routineExercises];
                                              up[exIdx].sets[sIdx].bandAssistance = val;
                                              setRoutineExercises(up);
                                            }}
                                          />
                                        </View>

                                        {s.bandAssistance === 'weighted' && (
                                          <View style={[styles.inputMiniCol, { flex: 1.2 }]}>
                                            <Text style={styles.miniLabel} numberOfLines={1}>+KG</Text>
                                            <TextInput
                                              style={styles.setInp}
                                              keyboardType="decimal-pad"
                                              value={s.targetWeightKg === 0 ? '' : String(s.targetWeightKg)}
                                              onChangeText={(val) => {
                                                const num = parseFloat(val.replace(',', '.'));
                                                const up = [...routineExercises];
                                                up[exIdx].sets[sIdx].targetWeightKg = val.trim() === '' || isNaN(num) ? 0 : Math.max(0, num);
                                                setRoutineExercises(up);
                                              }}
                                              placeholder="+0"
                                              placeholderTextColor={colors.textMuted}
                                            />
                                          </View>
                                        )}

                                        <View style={[styles.inputMiniCol, { flex: 1 }]}>
                                          <Text style={styles.miniLabel} numberOfLines={1}>REPS</Text>
                                          <TextInput
                                            style={styles.setInp}
                                            keyboardType="numeric"
                                            value={s.targetReps === 0 ? '' : String(s.targetReps)}
                                            onChangeText={(val) => {
                                              const num = parseInt(val, 10);
                                              const up = [...routineExercises];
                                              up[exIdx].sets[sIdx].targetReps = val.trim() === '' || isNaN(num) ? 0 : Math.max(0, num);
                                              setRoutineExercises(up);
                                            }}
                                            placeholder="0"
                                            placeholderTextColor={colors.textMuted}
                                          />
                                        </View>
                                      </>
                                    )}

                                    {!isCircuit && (
                                      <View style={[styles.inputMiniCol, { flex: 1.2 }]}>
                                        <Text style={styles.miniLabel} numberOfLines={1}>⏱️ REC.</Text>
                                        <TextInput
                                          style={styles.setInp}
                                          keyboardType="numeric"
                                          value={s.restSeconds === 0 ? '' : String(s.restSeconds)}
                                          onChangeText={(val) => {
                                            const num = parseInt(val, 10);
                                            const up = [...routineExercises];
                                            up[exIdx].sets[sIdx].restSeconds = val.trim() === '' || isNaN(num) ? 0 : Math.max(0, num);
                                            setRoutineExercises(up);
                                          }}
                                          placeholder="0"
                                          placeholderTextColor={colors.textMuted}
                                        />
                                      </View>
                                    )}
                                  </>
                                ) : (
                                  !isCircuit && (
                                    <View style={[styles.inputMiniCol, { flex: 1, maxWidth: 90 }]}>
                                      <Text style={styles.miniLabel} numberOfLines={1}>⏱️ FINALE</Text>
                                      <TextInput
                                        style={styles.setInp}
                                        keyboardType="numeric"
                                        value={s.restSeconds === 0 ? '' : String(s.restSeconds)}
                                        onChangeText={(val) => {
                                          const num = parseInt(val, 10);
                                          const up = [...routineExercises];
                                          up[exIdx].sets[sIdx].restSeconds = val.trim() === '' || isNaN(num) ? 0 : Math.max(0, num);
                                          setRoutineExercises(up);
                                        }}
                                        placeholder="0"
                                        placeholderTextColor={colors.textMuted}
                                      />
                                    </View>
                                  )
                                )}
                              </View>

                              {!isCircuit && (
                                <Pressable
                                  onPress={() => handleRemoveSet(exIdx, sIdx)}
                                  style={styles.setDelBtn}
                                >
                                  <Text style={styles.setDelText}>×</Text>
                                </Pressable>
                              )}
                        </View>

                        {/* Dynamic Drops Rows for Stripping & Rest-Pause */}
                        {(s.setType === 'dropset' || s.setType === 'rest_pause') && (
                          <View style={styles.dropsContainer}>
                            <View style={styles.dropsHeaderRow}>
                              <Text style={styles.dropsContainerTitle}>
                                {s.setType === 'dropset'
                                  ? '⚡ SCALATE STRIPPING (MINIMO 2 STEP)'
                                  : '⏱ SLOT REST-PAUSE (MINIMO 2 STEP)'}
                              </Text>
                              <View style={styles.finalRestBadge}>
                                <Text style={styles.finalRestBadgeText}>
                                  ⏱️ {s.restSeconds}s
                                </Text>
                              </View>
                            </View>

                            {s.setType === 'dropset' && (
                              <View style={styles.dropPercentageBar}>
                                <Text style={styles.dropPercentageLabel}>📉 SCARICO (%):</Text>
                                <View style={styles.dropPercentageInputWrapper}>
                                  <TextInput
                                    style={styles.dropPercentageInput}
                                    keyboardType="numeric"
                                    value={s.dropPercentage === null || s.dropPercentage === undefined || s.dropPercentage === 0 ? '' : String(s.dropPercentage)}
                                    onChangeText={(val) => {
                                      const num = parseFloat(val.replace(',', '.'));
                                      const pct = val.trim() === '' || isNaN(num) ? 0 : Math.max(0, Math.min(100, num));
                                      const up = [...routineExercises];
                                      const curSet = up[exIdx].sets[sIdx];
                                      curSet.dropPercentage = pct;
                                      if (pct > 0 && curSet.drops && curSet.drops.length > 1) {
                                        for (let d = 1; d < curSet.drops.length; d++) {
                                          const prevKg = Number(curSet.drops[d - 1].kg || 0);
                                          curSet.drops[d].kg = Math.max(0, Math.round(prevKg * (1 - pct / 100) * 10) / 10);
                                        }
                                      }
                                      setRoutineExercises(up);
                                    }}
                                    placeholder="20"
                                    placeholderTextColor={colors.textMuted}
                                  />
                                  <Text style={styles.dropPercentageUnit}>%</Text>
                                </View>
                              </View>
                            )}

                            {(s.drops || []).map((drop, dropIdx) => {
                              const isLastDrop = dropIdx === (s.drops?.length || 0) - 1;
                              return (
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
                                        const newKg = val.trim() === '' || isNaN(num) ? 0 : Math.max(0, num);
                                        const up = [...routineExercises];
                                        const curSet = up[exIdx].sets[sIdx];
                                        if (curSet.drops) {
                                          curSet.drops[dropIdx].kg = newKg;
                                          if (dropIdx === 0) {
                                            curSet.targetWeightKg = newKg;
                                            if (curSet.setType === 'dropset' && curSet.dropPercentage && curSet.dropPercentage > 0) {
                                              for (let d = 1; d < curSet.drops.length; d++) {
                                                const prevKg = Number(curSet.drops[d - 1].kg || 0);
                                                curSet.drops[d].kg = Math.max(0, Math.round(prevKg * (1 - curSet.dropPercentage / 100) * 10) / 10);
                                              }
                                            }
                                          }
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
                                          up[exIdx].sets[sIdx].drops![dropIdx].reps = val.trim() === '' || isNaN(num) ? 0 : Math.max(0, num);
                                        }
                                        setRoutineExercises(up);
                                      }}
                                      placeholder="0"
                                      placeholderTextColor={colors.textMuted}
                                    />
                                  </View>

                                  {!isLastDrop ? (
                                    <View style={styles.dropInpCol}>
                                      <Text style={styles.miniLabel}>PAUSA (S)</Text>
                                      <TextInput
                                        style={styles.dropInp}
                                        keyboardType="numeric"
                                        value={drop.restSeconds === 0 ? '' : String(drop.restSeconds ?? (s.setType === 'rest_pause' ? 10 : ''))}
                                        onChangeText={(val) => {
                                          const num = parseInt(val, 10);
                                          const up = [...routineExercises];
                                          if (up[exIdx].sets[sIdx].drops) {
                                            up[exIdx].sets[sIdx].drops![dropIdx].restSeconds = val.trim() === '' || isNaN(num)
                                              ? 0
                                              : Math.max(0, num);
                                          }
                                          setRoutineExercises(up);
                                        }}
                                        placeholder="0"
                                        placeholderTextColor={colors.textMuted}
                                      />
                                    </View>
                                  ) : (
                                    <View style={styles.lastDropFinalBox}>
                                      <Text style={styles.lastDropFinalLabel}>FINE STEP</Text>
                                      <Text style={styles.lastDropFinalSub}>Poi rec. {s.restSeconds}s</Text>
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
                              );
                            })}

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

                {/* Add Set Button or Circuit Note */}
                {!isCircuit ? (
                  <Pressable
                    onPress={() => handleOpenAddSet(exIdx)}
                    style={styles.addSetRowBtn}
                  >
                    <Text style={styles.addSetRowText}>+ Aggiungi Serie</Text>
                  </Pressable>
                ) : (
                  <View style={styles.circuitSingleSetNote}>
                    <Text style={styles.circuitSingleSetNoteText}>
                      🔄 Serie base target per ciascuno dei {re.circuitRounds || 3} giri del circuito
                    </Text>
                  </View>
                )}
              </>
            )}
          </Card>

          {isLastInCircuit && !isCircuitCollapsed && (
            <Pressable
              onPress={() => handleOpenAddCircuitExercise(re.blockId!)}
              style={styles.addCircuitExerciseBtn}
              accessibilityRole="button"
              accessibilityLabel="Aggiungi esercizio a questo circuito"
            >
              <Text style={styles.addCircuitExerciseBtnText}>+ Aggiungi Esercizio al Circuito</Text>
            </Pressable>
          )}
        </React.Fragment>
      );
    })
        )}

        {routineExercises.length > 0 && (
          <Pressable
            onPress={handleOpenAddChoice}
            style={styles.bottomAddExerciseBtn}
            accessibilityRole="button"
            accessibilityLabel="Aggiungi esercizio alla scheda"
          >
            <Text style={styles.bottomAddExerciseBtnText}>+ AGGIUNGI ESERCIZIO ALLA SCHEDA</Text>
          </Pressable>
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
              onPress={() => handleSelectAddType('circuit')}
              style={[styles.choiceOptionBtn, { borderColor: '#eab308' }]}
            >
              <Text style={styles.choiceOptionIcon}>🔄</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[typography.bodyBold, { color: '#eab308' }]}>Circuito a Round</Text>
                <Text style={typography.caption}>2+ esercizi in sequenza a giri con recupero fine giro e intra</Text>
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

      {/* Exercise Picker Overlay Modal (Supports Single, Superset & Circuit) */}
      {showExercisePicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={typography.h3}>
                  {pickerMode === 'circuit'
                    ? 'Seleziona Esercizi Circuito'
                    : pickerMode === 'superset'
                    ? 'Seleziona Esercizi Super Serie'
                    : 'Seleziona dal Catalogo'}
                </Text>
                {(pickerMode === 'superset' || pickerMode === 'circuit') && (
                  <Text style={typography.caption}>
                    Selezionati: {selectedSupersetExerciseIds.length} (minimo 2)
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => {
                  setTargetCircuitBlockId(null);
                  setShowExercisePicker(false);
                }}
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
                const isMulti = pickerMode === 'superset' || pickerMode === 'circuit';

                return (
                  <Pressable
                    key={ex.id}
                    onPress={() => {
                      if (isMulti) {
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

                    {isMulti ? (
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

            {pickerMode === 'circuit' && (
              <View style={styles.pickerFooter}>
                <Pressable
                  onPress={handleConfirmCircuitSelection}
                  style={[
                    styles.confirmSupersetBtn,
                    { backgroundColor: '#eab308' },
                    selectedSupersetExerciseIds.length < 2 && styles.confirmSupersetBtnDisabled,
                  ]}
                >
                  <Text style={[styles.confirmSupersetBtnText, { color: '#0F172A' }]}>
                    CREA CIRCUITO ({selectedSupersetExerciseIds.length} ESERCIZI)
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
      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
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
    backgroundColor: colors.backgroundSolid,
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
  circuitCardBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#eab308',
  },
  circuitBlockBanner: {
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
    borderRadius: layout.borderRadiusMd,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  circuitBlockHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  circuitBlockTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#eab308',
  },
  circuitSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circuitSettingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  circuitSettingLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  circuitSettingValue: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    minWidth: 22,
    textAlign: 'center',
  },
  circuitStepperBtn: {
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuitStepperText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  intraRestConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(234, 179, 8, 0.06)',
    borderLeftWidth: 3,
    borderLeftColor: '#eab308',
    padding: 8,
    borderRadius: 6,
    marginVertical: 6,
  },
  intraRestValueText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#eab308',
    minWidth: 26,
    textAlign: 'center',
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
    gap: 8,
  },
  setNumCol: {
    width: 24,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  setTypePill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: layout.borderRadiusSm,
  },
  setTypePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  inputsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputMiniCol: {
    flex: 1,
    justifyContent: 'center',
  },
  miniLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: 3,
    letterSpacing: 0.5,
    height: 12,
    lineHeight: 12,
    textAlign: 'center',
  },
  setInp: {
    height: 36,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 0,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.4)',
  },
  bandDropdown: {
    height: 36,
    borderRadius: 4,
    paddingHorizontal: 6,
  },
  setDelBtn: {
    width: 24,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
  dropsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dropsContainerTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.danger,
  },
  finalRestBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  finalRestBadgeText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '800',
  },
  dropPercentageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  dropPercentageLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  dropPercentageInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 6,
    height: 28,
  },
  dropPercentageInput: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
    paddingVertical: 0,
    paddingHorizontal: 2,
    minWidth: 26,
    textAlign: 'center',
  },
  dropPercentageUnit: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.danger,
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
    width: 48,
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
  lastDropFinalBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  lastDropFinalLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  lastDropFinalSub: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.accent,
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
  dropExplainerBox: {
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.15)',
  },
  dropExplainerText: {
    fontSize: 10,
    color: colors.textSecondary,
    lineHeight: 14,
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
  blockCollapseBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockCollapseBtnText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  collapsedBlockSummary: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  collapsedBlockSummaryText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  supersetBlockBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: layout.borderRadiusMd,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  circuitSingleSetNote: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.25)',
    alignItems: 'center',
  },
  circuitSingleSetNoteText: {
    color: '#eab308',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  exInfoBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  removeNotesBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  removeNotesBtnText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '700',
  },
  addNotesBtn: {
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  addNotesBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  addCircuitExerciseBtn: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCircuitExerciseBtnText: {
    color: '#eab308',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bottomAddExerciseBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: layout.borderRadiusMd,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomAddExerciseBtnText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});


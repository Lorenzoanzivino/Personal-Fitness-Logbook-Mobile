import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
  Keyboard,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList, RootStackNavigationProp } from '../../types/navigation';
import { useGym } from '../../context/GymContext';
import { useAuth } from '../../context/AuthContext';
import {
  RoutineBlock,
  RoutineBlockType,
  CircuitType,
  SetType,
  BandAssistance,
  ExerciseType,
} from '../../types/workout';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Card } from '../../components/Card';
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

const SET_TYPES: Array<{ key: SetType; label: string; badgeBg: string; badgeColor: string }> = [
  { key: 'NORMAL', label: 'Normale', badgeBg: colors.backgroundSubtle, badgeColor: colors.textSecondary },
  { key: 'WARMUP', label: 'Warm-Up', badgeBg: 'rgba(245, 158, 11, 0.15)', badgeColor: colors.warning },
  { key: 'STRIPPING', label: 'Stripping', badgeBg: 'rgba(239, 68, 68, 0.15)', badgeColor: colors.danger },
  { key: 'REST_PAUSE', label: 'Rest-Pause', badgeBg: 'rgba(168, 85, 247, 0.15)', badgeColor: colors.volume },
];

const WORKOUT_TYPES = [
  'Ipertrofia',
  'Forza',
  'Dimagrimento',
  'Ricomposizione',
  'HIIT',
  'Funzionale',
  'Mobilità',
];

const DURATION_WEEKS_OPTIONS = [4, 6, 8, 12];

const MUSCLE_GROUPS = [
  'Tutti',
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

export type TargetType = 'reps' | 'time';
export type EquipmentType = 'kg' | 'bodyweight' | 'band';
export type BandIntensity = 'light' | 'medium' | 'heavy';

interface CompactDropdownOption<T> {
  key: T;
  label: string;
  icon?: string;
  color?: string;
}

const TARGET_OPTIONS: CompactDropdownOption<TargetType>[] = [
  { key: 'reps', label: 'Reps', icon: '🔁' },
  { key: 'time', label: 'Tempo', icon: '⏱️' },
];

const EQUIPMENT_OPTIONS: CompactDropdownOption<EquipmentType>[] = [
  { key: 'kg', label: 'Kg', icon: '🏋️' },
  { key: 'bodyweight', label: 'Corpo Libero', icon: '🤸' },
  { key: 'band', label: 'Elastico', icon: '🔴' },
];

const BAND_INTENSITY_OPTIONS: CompactDropdownOption<BandIntensity>[] = [
  { key: 'light', label: 'Bassa', icon: '🟡', color: '#EAB308' },
  { key: 'medium', label: 'Media', icon: '🟠', color: '#F59E0B' },
  { key: 'heavy', label: 'Alta', icon: '🔴', color: '#EF4444' },
];

interface CompactDropdownProps<T> {
  title: string;
  value: T;
  options: CompactDropdownOption<T>[];
  onChange: (val: T) => void;
  minWidth?: number;
}

function CompactDropdown<T extends string>({
  title,
  value,
  options,
  onChange,
  minWidth = 72,
}: CompactDropdownProps<T>) {
  const [modalVisible, setModalVisible] = useState(false);
  const current = options.find((o) => o.key === value) || options[0];

  return (
    <>
      <Pressable
        onPress={() => setModalVisible(true)}
        style={[styles.dropdownTrigger, { minWidth }]}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${current.label}`}
      >
        <Text style={styles.dropdownTriggerText} numberOfLines={1}>
          {current.icon ? `${current.icon} ` : ''}{current.label}
        </Text>
        <Text style={styles.dropdownChevron}>▾</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => setModalVisible(false)}
        >
          <Pressable style={styles.dropdownModalBox} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dropdownModalHeader}>
              <Text style={styles.dropdownModalTitle}>{title}</Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.dropdownCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Chiudi selettore"
              >
                <Text style={styles.dropdownCloseBtnText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.dropdownOptionsContainer}>
              {options.map((opt) => {
                const isSelected = opt.key === value;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      onChange(opt.key);
                      setModalVisible(false);
                    }}
                    style={[
                      styles.dropdownOptionRow,
                      isSelected && styles.dropdownOptionRowSelected,
                    ]}
                  >
                    <View style={styles.dropdownOptionLeft}>
                      {opt.icon && <Text style={styles.dropdownOptionIcon}>{opt.icon}</Text>}
                      <Text
                        style={[
                          styles.dropdownOptionLabel,
                          isSelected && styles.dropdownOptionLabelSelected,
                          opt.color ? { color: opt.color } : null,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </View>
                    {isSelected && <Text style={styles.dropdownCheckmark}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

interface BuilderSet {
  setNumber: number;
  setType: SetType;
  targetType: TargetType;
  targetValue: number;
  targetWeightKg: number;
  targetReps: number;
  targetTimeSeconds?: number | null;
  equipment: EquipmentType;
  bandAssistance: BandAssistance;
  bandIntensity: BandIntensity;
  dropCount?: number;
  dropPercentage?: number | null;
  restPauseSeconds?: number | null;
  restSeconds: number;
  notes?: string;
}

interface BuilderExercise {
  tempId: string;
  exerciseId: number;
  customDescription?: string;
  customVideoUrl?: string;
  showNotesBlock?: boolean;
  notes?: string;
  intraRestSeconds?: number;
  sets: BuilderSet[];
}

interface BuilderBlock {
  tempId: string;
  blockType: RoutineBlockType; // 'SINGLE' | 'SUPERSERIE' | 'CIRCUIT_STANDARD' | 'CIRCUIT_INTERVAL'
  rounds: number;
  restBetweenRounds: number;
  intervalWorkSeconds?: number;
  intervalRestSeconds?: number;
  exercises: BuilderExercise[];
}

export const NewRoutineModal: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<NewRoutineModalRouteProp>();
  const insets = useSafeAreaInsets();
  const { provisionedClients, user: authUser } = useAuth();
  const {
    exercises,
    routines,
    folders,
    userRole,
    userProfile,
    selectedClient,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    addFolder,
  } = useGym();

  const routineId = route.params?.routineId;
  const isEditing = Boolean(routineId);
  const existingRoutine = isEditing ? routines.find((r) => r.id === routineId) : null;

  const isTrainer = userRole === 'TRAINER' || userProfile?.role === 'TRAINER' || authUser?.role === 'TRAINER';
  const trainerId = String(authUser?.id || userProfile?.id || 'trainer-1');
  const trainerFullName = [
    authUser?.first_name || userProfile?.first_name,
    authUser?.last_name || userProfile?.last_name,
  ]
    .filter(Boolean)
    .join(' ')
    .trim() || authUser?.username || userProfile?.username || 'Trainer';

  // Header State
  const [name, setName] = useState('');
  const [durationWeeks, setDurationWeeks] = useState('8');
  const [workoutType, setWorkoutType] = useState('Ipertrofia');
  const [description, setDescription] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    folders.length > 0 ? folders[0].id : null
  );
  const [selectedBorderColor, setSelectedBorderColor] = useState<string>(BORDER_PALETTE[0]);

  // Available Clients: Prepend Trainer, then non-archived clients
  const availableClients = useMemo(() => {
    const list: { id: string | number; name: string; isTrainer?: boolean }[] = [];
    const addedIds = new Set<string>();

    if (isTrainer) {
      list.push({
        id: trainerId,
        name: `🏋️ ${trainerFullName} (Trainer)`,
        isTrainer: true,
      });
      addedIds.add(trainerId);
      addedIds.add('trainer-1');
      addedIds.add('trainer-marco-1');
    }

    if (Array.isArray(provisionedClients)) {
      provisionedClients.forEach((c: any) => {
        const isArchived = Boolean(c.isArchived ?? c.is_archived);
        const strId = String(c.id);
        if (!isArchived && c.id && !addedIds.has(strId)) {
          addedIds.add(strId);
          const fullName = [c.first_name || c.firstName, c.last_name || c.lastName]
            .filter(Boolean)
            .join(' ')
            .trim();
          const displayName = fullName || c.name || c.username || c.email || `Atleta #${c.id}`;
          list.push({ id: c.id, name: displayName, isTrainer: false });
        }
      });
    }

    if (Array.isArray(userProfile?.clients)) {
      userProfile.clients.forEach((c: any) => {
        const isArchived = Boolean(c.isArchived ?? c.is_archived);
        const strId = String(c.id);
        if (!isArchived && c.id && !addedIds.has(strId)) {
          addedIds.add(strId);
          const fullName = [c.first_name || c.firstName, c.last_name || c.lastName]
            .filter(Boolean)
            .join(' ')
            .trim();
          const displayName = fullName || c.name || c.username || c.email || `Atleta #${c.id}`;
          list.push({ id: c.id, name: displayName, isTrainer: false });
        }
      });
    }

    return list;
  }, [isTrainer, trainerId, trainerFullName, provisionedClients, userProfile?.clients]);

  // Multi-Client Assignment (Trainer Mode)
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(() => {
    if (isEditing && existingRoutine?.owner_id) {
      const oid = String(existingRoutine.owner_id);
      return [oid === 'trainer-1' || oid === 'trainer-marco-1' ? trainerId : oid];
    }
    const targetId =
      route.params?.clientId ||
      (selectedClient?.id && selectedClient.id !== userProfile?.id && selectedClient.id !== authUser?.id
        ? selectedClient.id
        : undefined);
    if (targetId) {
      return [String(targetId)];
    }
    return [];
  });

  // Inline folder creation
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Blocks State
  const [blocks, setBlocks] = useState<BuilderBlock[]>([]);

  // Exercise Picker Modal State
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<
    | { mode: 'new_block'; blockType: RoutineBlockType }
    | { mode: 'add_to_block'; blockTempId: string }
    | null
  >(null);
  const [selectedPickerExerciseIds, setSelectedPickerExerciseIds] = useState<number[]>([]);
  const [filterMuscle, setFilterMuscle] = useState<string>('Tutti');
  const [searchQuery, setSearchQuery] = useState('');

  // Video preview overlay
  const [activeVideoModal, setActiveVideoModal] = useState<{
    visible: boolean;
    url: string;
    name: string;
  }>({
    visible: false,
    url: '',
    name: '',
  });

  // Collapsed block state
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());

  // Deletion state
  const [isDeleting, setIsDeleting] = useState(false);

  // Saving state & feedback
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [toast, setToast] = useState<{ visible: boolean; type: ToastType; message: string }>({
    visible: false,
    type: 'info',
    message: '',
  });

  const showToast = (type: ToastType, message: string) => {
    setToast({ visible: true, type, message });
  };

  // -------------------------------------------------------------
  // Load Existing Routine on Mount (Editing Mode)
  // -------------------------------------------------------------
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
      if (existingRoutine.owner_id) {
        const oid = String(existingRoutine.owner_id);
        setSelectedClientIds([oid === 'trainer-1' || oid === 'trainer-marco-1' ? trainerId : oid]);
      }

      const mapLoadedSet = (s: any, idx: number): BuilderSet => {
        const raw = s.set_type ? String(s.set_type).toUpperCase() : 'NORMAL';
        let setType: SetType = 'NORMAL';
        if (raw === 'WARMUP') setType = 'WARMUP';
        else if (raw === 'STRIPPING' || raw === 'DROPSET') setType = 'STRIPPING';
        else if (raw === 'REST_PAUSE') setType = 'REST_PAUSE';

        const isTime = Boolean(
          s.target_time_seconds &&
          s.target_time_seconds > 0 &&
          (!s.target_reps || s.target_reps === 0)
        );
        const targetType: TargetType = isTime ? 'time' : 'reps';
        const targetValue = isTime ? (s.target_time_seconds || 30) : (s.target_reps || 10);

        let equipment: EquipmentType = 'kg';
        let bandIntensity: BandIntensity = 'medium';
        const rawBand = s.band_assistance || 'none';

        if (rawBand === 'light' || rawBand === 'medium' || rawBand === 'heavy') {
          equipment = 'band';
          bandIntensity = rawBand;
        } else if (rawBand === 'none' && (!s.target_weight_kg || Number(s.target_weight_kg) === 0)) {
          equipment = 'bodyweight';
        } else {
          equipment = 'kg';
        }

        return {
          setNumber: s.set_number || idx + 1,
          setType,
          targetType,
          targetValue,
          targetWeightKg: Number(s.target_weight_kg || 0),
          targetReps: targetType === 'reps' ? targetValue : Number(s.target_reps || 0),
          targetTimeSeconds: targetType === 'time' ? targetValue : (s.target_time_seconds || null),
          equipment,
          bandAssistance: equipment === 'band' ? bandIntensity : 'none',
          bandIntensity,
          dropCount: s.drop_count ?? (s.drops && s.drops.length > 0 ? s.drops.length - 1 : (setType === 'STRIPPING' || setType === 'REST_PAUSE' ? 2 : 0)),
          dropPercentage: s.drop_percentage != null ? Number(s.drop_percentage) : (setType === 'STRIPPING' ? 20 : null),
          restPauseSeconds: s.rest_pause_seconds ?? (setType === 'REST_PAUSE' ? 20 : null),
          restSeconds: s.rest_seconds || 90,
          notes: s.notes || undefined,
        };
      };

      if (existingRoutine.blocks && existingRoutine.blocks.length > 0) {
        const loaded: BuilderBlock[] = existingRoutine.blocks.map((blk, bIdx) => {
          let bType: RoutineBlockType = blk.block_type || 'SINGLE';
          if ((bType as string) === 'STANDARD') {
            bType = blk.exercises && blk.exercises.length > 1 ? 'CIRCUIT_STANDARD' : 'SINGLE';
          } else if ((bType as string) === 'SUPERSET') {
            bType = 'SUPERSERIE';
          } else if ((bType as string) === 'CIRCUIT') {
            bType = blk.circuit_type === 'INTERVAL' ? 'CIRCUIT_INTERVAL' : 'CIRCUIT_STANDARD';
          }

          return {
            tempId: `blk-${blk.id || bIdx}-${Date.now()}-${bIdx}`,
            blockType: bType,
            rounds: blk.rounds || (bType === 'SINGLE' ? 1 : 3),
            restBetweenRounds: blk.rest_between_rounds ?? (bType === 'CIRCUIT_INTERVAL' ? 0 : 60),
            intervalWorkSeconds: blk.interval_work_seconds ?? 40,
            intervalRestSeconds: blk.interval_rest_seconds ?? 20,
            exercises: (blk.exercises || []).map((re, exIdx) => ({
              tempId: `ex-${re.exercise_id}-${bIdx}-${exIdx}-${Date.now()}`,
              exerciseId: re.exercise_id,
              customDescription: re.custom_description || undefined,
              customVideoUrl: re.custom_video_url || undefined,
              showNotesBlock: Boolean(re.custom_description || re.custom_video_url),
              notes: re.notes || undefined,
              intraRestSeconds: re.intra_rest_seconds ?? (bType === 'CIRCUIT_INTERVAL' ? (blk.interval_rest_seconds ?? 20) : 0),
              sets: (re.sets && re.sets.length > 0) ? re.sets.map(mapLoadedSet) : [],
            })),
          };
        });
        setBlocks(loaded);
      } else if (existingRoutine.exercises && existingRoutine.exercises.length > 0) {
        // Fallback da lista esercizi piatta
        const loaded: BuilderBlock[] = existingRoutine.exercises.map((re, idx) => ({
          tempId: `blk-legacy-${idx}-${Date.now()}`,
          blockType: 'SINGLE',
          rounds: 1,
          restBetweenRounds: 0,
          exercises: [
            {
              tempId: `ex-${re.exercise_id}-${idx}-${Date.now()}`,
              exerciseId: re.exercise_id,
              customDescription: re.custom_description || undefined,
              customVideoUrl: re.custom_video_url || undefined,
              showNotesBlock: Boolean(re.custom_description || re.custom_video_url),
              notes: re.notes || undefined,
              intraRestSeconds: re.intra_rest_seconds ?? 0,
              sets: (re.sets && re.sets.length > 0) ? re.sets.map(mapLoadedSet) : [],
            },
          ],
        }));
        setBlocks(loaded);
      }
    }
  }, [existingRoutine]);

  // -------------------------------------------------------------
  // Helpers & Catalogs
  // -------------------------------------------------------------
  const exerciseCatalogMap = useMemo(() => {
    const map = new Map<number, (typeof exercises)[0]>();
    exercises.forEach((ex) => map.set(ex.id, ex));
    return map;
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      if (ex.is_archived === 1) return false;
      const matchesMuscle = filterMuscle === 'Tutti' || ex.muscle_group === filterMuscle;
      const matchesQuery =
        !searchQuery.trim() ||
        ex.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return matchesMuscle && matchesQuery;
    });
  }, [exercises, filterMuscle, searchQuery]);

  const toggleBlockCollapse = (tempId: string) => {
    setCollapsedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
  };

  const handleToggleClientSelection = (clientId: string) => {
    setSelectedClientIds((prev) => {
      if (prev.includes(clientId)) {
        return prev.filter((id) => id !== clientId);
      } else {
        return [...prev, clientId];
      }
    });
  };

  const handleToggleAllClients = () => {
    const allIds = availableClients.map((c) => String(c.id));
    if (selectedClientIds.length === allIds.length) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(allIds);
    }
  };

  // -------------------------------------------------------------
  // Folder Creation
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // Block Operations (Add, Reorder, Remove)
  // -------------------------------------------------------------
  const openNewBlockPicker = (blockType: RoutineBlockType) => {
    setPickerTarget({ mode: 'new_block', blockType });
    setSelectedPickerExerciseIds([]);
    setSearchQuery('');
    setShowExercisePicker(true);
  };

  const openAddExerciseToBlockPicker = (blockTempId: string) => {
    setPickerTarget({ mode: 'add_to_block', blockTempId });
    setSelectedPickerExerciseIds([]);
    setSearchQuery('');
    setShowExercisePicker(true);
  };

  const handleTogglePickerExercise = (exId: number) => {
    if (!pickerTarget) return;

    if (pickerTarget.mode === 'new_block' && pickerTarget.blockType === 'SINGLE') {
      // Single exercise selection: confirm immediately
      handleConfirmExerciseSelection([exId]);
      return;
    }

    // Multi-selection (SUPERSERIE, CIRCUITS or ADD TO BLOCK)
    setSelectedPickerExerciseIds((prev) => {
      if (prev.includes(exId)) return prev.filter((id) => id !== exId);
      return [...prev, exId];
    });
  };

  const handleConfirmExerciseSelection = (selectedIds?: number[]) => {
    const ids = selectedIds || selectedPickerExerciseIds;
    if (ids.length === 0) {
      showToast('info', 'Seleziona almeno un esercizio.');
      return;
    }

    if (!pickerTarget) return;

    if (pickerTarget.mode === 'new_block') {
      const { blockType } = pickerTarget;

      if (blockType === 'SINGLE') {
        const exId = ids[0];
        const newBlock: BuilderBlock = {
          tempId: `blk-single-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          blockType: 'SINGLE',
          rounds: 1,
          restBetweenRounds: 0,
          exercises: [
            {
              tempId: `ex-${exId}-${Date.now()}`,
              exerciseId: exId,
              sets: [], // Nasce completamente vuoto!
              showNotesBlock: false,
            },
          ],
        };
        setBlocks((prev) => [...prev, newBlock]);
      } else if (blockType === 'SUPERSERIE') {
        const newBlock: BuilderBlock = {
          tempId: `blk-super-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          blockType: 'SUPERSERIE',
          rounds: 3,
          restBetweenRounds: 90,
          exercises: ids.map((id, idx) => ({
            tempId: `ex-${id}-${Date.now()}-${idx}`,
            exerciseId: id,
            intraRestSeconds: 0,
            sets: [], // Nasce completamente vuoto!
            showNotesBlock: false,
          })),
        };
        setBlocks((prev) => [...prev, newBlock]);
      } else if (blockType === 'CIRCUIT_STANDARD') {
        const newBlock: BuilderBlock = {
          tempId: `blk-cstd-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          blockType: 'CIRCUIT_STANDARD',
          rounds: 3,
          restBetweenRounds: 60,
          exercises: ids.map((id, idx) => ({
            tempId: `ex-${id}-${Date.now()}-${idx}`,
            exerciseId: id,
            sets: [], // Nasce completamente vuoto!
            showNotesBlock: false,
          })),
        };
        setBlocks((prev) => [...prev, newBlock]);
      } else if (blockType === 'CIRCUIT_INTERVAL') {
        const newBlock: BuilderBlock = {
          tempId: `blk-hiit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          blockType: 'CIRCUIT_INTERVAL',
          rounds: 4,
          restBetweenRounds: 0,
          intervalWorkSeconds: 40,
          intervalRestSeconds: 20,
          exercises: ids.map((id, idx) => ({
            tempId: `ex-${id}-${Date.now()}-${idx}`,
            exerciseId: id,
            sets: [
              {
                setNumber: 1,
                setType: 'NORMAL',
                targetType: 'time',
                targetValue: 40,
                targetWeightKg: 0,
                targetReps: 0,
                targetTimeSeconds: 40,
                equipment: 'bodyweight',
                bandAssistance: 'none',
                bandIntensity: 'medium',
                restSeconds: 0,
              },
            ],
            showNotesBlock: false,
          })),
        };
        setBlocks((prev) => [...prev, newBlock]);
      }
    } else if (pickerTarget.mode === 'add_to_block') {
      const { blockTempId } = pickerTarget;
      setBlocks((prev) =>
        prev.map((blk) => {
          if (blk.tempId !== blockTempId) return blk;
          const newExs: BuilderExercise[] = ids.map((id, idx) => ({
            tempId: `ex-${id}-${Date.now()}-${idx}`,
            exerciseId: id,
            intraRestSeconds: blk.blockType === 'CIRCUIT_INTERVAL' ? (blk.intervalRestSeconds || 20) : 0,
            sets: blk.blockType === 'CIRCUIT_INTERVAL'
              ? [
                  {
                    setNumber: 1,
                    setType: 'NORMAL',
                    targetType: 'time',
                    targetValue: blk.intervalWorkSeconds || 40,
                    targetWeightKg: 0,
                    targetReps: 0,
                    targetTimeSeconds: blk.intervalWorkSeconds || 40,
                    equipment: 'bodyweight',
                    bandAssistance: 'none',
                    bandIntensity: 'medium',
                    restSeconds: 0,
                  },
                ]
              : [], // Nasce completamente vuoto!
            showNotesBlock: false,
          }));
          return { ...blk, exercises: [...blk.exercises, ...newExs] };
        })
      );
    }

    setShowExercisePicker(false);
    setPickerTarget(null);
    setSelectedPickerExerciseIds([]);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    const updated = [...blocks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setBlocks(updated);
  };

  const handleRemoveBlock = (blockTempId: string) => {
    setBlocks((prev) => prev.filter((b) => b.tempId !== blockTempId));
  };

  const handleRemoveExerciseFromBlock = (blockTempId: string, exTempId: string) => {
    setBlocks((prev) =>
      prev
        .map((b) => {
          if (b.tempId !== blockTempId) return b;
          return {
            ...b,
            exercises: b.exercises.filter((ex) => ex.tempId !== exTempId),
          };
        })
        .filter((b) => b.exercises.length > 0)
    );
  };

  // -------------------------------------------------------------
  // Exercise Notes & Video Operations (Single block per exercise)
  // -------------------------------------------------------------
  const handleAddExerciseNotes = (blockTempId: string, exTempId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.tempId !== blockTempId) return b;
        return {
          ...b,
          exercises: b.exercises.map((ex) => {
            if (ex.tempId !== exTempId) return ex;
            return { ...ex, showNotesBlock: true };
          }),
        };
      })
    );
  };

  const handleRemoveExerciseNotes = (blockTempId: string, exTempId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.tempId !== blockTempId) return b;
        return {
          ...b,
          exercises: b.exercises.map((ex) => {
            if (ex.tempId !== exTempId) return ex;
            return {
              ...ex,
              customDescription: '',
              customVideoUrl: '',
              showNotesBlock: false,
            };
          }),
        };
      })
    );
  };

  const handleUpdateExerciseField = (
    blockTempId: string,
    exTempId: string,
    field: 'customDescription' | 'customVideoUrl',
    value: string
  ) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.tempId !== blockTempId) return b;
        return {
          ...b,
          exercises: b.exercises.map((ex) => {
            if (ex.tempId !== exTempId) return ex;
            return { ...ex, [field]: value };
          }),
        };
      })
    );
  };

  // -------------------------------------------------------------
  // Set Operations inside a Block / Exercise
  // -------------------------------------------------------------
  const handleAddSet = (blockTempId: string, exTempId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.tempId !== blockTempId) return b;
        return {
          ...b,
          exercises: b.exercises.map((ex) => {
            if (ex.tempId !== exTempId) return ex;
            const nextSetNum = ex.sets.length + 1;
            const lastSet = ex.sets[ex.sets.length - 1];
            const isRP = lastSet?.setType === 'REST_PAUSE';
            const isStrip = lastSet?.setType === 'STRIPPING';
            const newSet: BuilderSet = {
              setNumber: nextSetNum,
              setType: lastSet?.setType || 'NORMAL',
              targetType: lastSet?.targetType || 'reps',
              targetValue: lastSet?.targetValue ?? (lastSet?.targetType === 'time' ? 30 : 10),
              targetWeightKg: lastSet?.targetWeightKg || 0,
              targetReps: lastSet?.targetReps ?? (lastSet?.targetType === 'time' ? 0 : 10),
              targetTimeSeconds: lastSet?.targetTimeSeconds ?? (lastSet?.targetType === 'time' ? 30 : null),
              equipment: lastSet?.equipment || 'kg',
              bandAssistance: lastSet?.bandAssistance || 'none',
              bandIntensity: lastSet?.bandIntensity || 'medium',
              dropCount: lastSet?.dropCount ?? (isStrip || isRP ? 2 : 0),
              dropPercentage: lastSet?.dropPercentage ?? (isStrip ? 20 : null),
              restPauseSeconds: lastSet?.restPauseSeconds ?? (isRP ? 20 : null),
              restSeconds: lastSet?.restSeconds ?? (b.blockType === 'CIRCUIT_STANDARD' ? 0 : 90),
            };
            return { ...ex, sets: [...ex.sets, newSet] };
          }),
        };
      })
    );
  };

  const handleRemoveSet = (blockTempId: string, exTempId: string, setIndex: number) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.tempId !== blockTempId) return b;
        return {
          ...b,
          exercises: b.exercises.map((ex) => {
            if (ex.tempId !== exTempId) return ex;
            const updatedSets = ex.sets
              .filter((_, idx) => idx !== setIndex)
              .map((s, idx) => ({ ...s, setNumber: idx + 1 }));
            return { ...ex, sets: updatedSets };
          }),
        };
      })
    );
  };

  const handleUpdateSet = (
    blockTempId: string,
    exTempId: string,
    setIndex: number,
    field: keyof BuilderSet,
    value: any
  ) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.tempId !== blockTempId) return b;
        return {
          ...b,
          exercises: b.exercises.map((ex) => {
            if (ex.tempId !== exTempId) return ex;
            const currentSets = ex.sets.length > 0 ? ex.sets : [{
              setNumber: 1,
              setType: 'NORMAL' as SetType,
              targetType: 'time' as TargetType,
              targetValue: b.intervalWorkSeconds || 40,
              targetWeightKg: 0,
              targetReps: 0,
              targetTimeSeconds: b.intervalWorkSeconds || 40,
              equipment: 'bodyweight' as EquipmentType,
              bandAssistance: 'none' as BandAssistance,
              bandIntensity: 'medium' as BandIntensity,
              restSeconds: b.intervalRestSeconds || 20,
            }];
            const updatedSets = currentSets.map((s, idx) => {
              if (idx !== setIndex) return s;
              return { ...s, [field]: value };
            });
            return { ...ex, sets: updatedSets };
          }),
        };
      })
    );
  };

  const handleUpdateSetFields = (
    blockTempId: string,
    exTempId: string,
    setIndex: number,
    fields: Partial<BuilderSet>
  ) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.tempId !== blockTempId) return b;
        return {
          ...b,
          exercises: b.exercises.map((ex) => {
            if (ex.tempId !== exTempId) return ex;
            const currentSets = ex.sets.length > 0 ? ex.sets : [{
              setNumber: 1,
              setType: 'NORMAL' as SetType,
              targetType: 'time' as TargetType,
              targetValue: b.intervalWorkSeconds || 40,
              targetWeightKg: 0,
              targetReps: 0,
              targetTimeSeconds: b.intervalWorkSeconds || 40,
              equipment: 'bodyweight' as EquipmentType,
              bandAssistance: 'none' as BandAssistance,
              bandIntensity: 'medium' as BandIntensity,
              restSeconds: b.intervalRestSeconds || 20,
            }];
            const updatedSets = currentSets.map((s, idx) => {
              if (idx !== setIndex) return s;
              return { ...s, ...fields };
            });
            return { ...ex, sets: updatedSets };
          }),
        };
      })
    );
  };

  const handleUpdateBlockField = (
    blockTempId: string,
    field: keyof BuilderBlock,
    value: any
  ) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.tempId !== blockTempId) return b;
        return { ...b, [field]: value };
      })
    );
  };

  // -------------------------------------------------------------
  // Save Routine
  // -------------------------------------------------------------
  const handleSave = async (mode: 'UPDATE' | 'CREATE_NEW' = isEditing ? 'UPDATE' : 'CREATE_NEW') => {
    // 1. Validazione Sincrona
    if (!name.trim()) {
      Alert.alert('Attenzione', 'Inserisci il nome della scheda prima di procedere.');
      showToast('error', 'Inserisci il nome della scheda.');
      return;
    }
    if (isTrainer && selectedClientIds.length === 0) {
      Alert.alert('Attenzione', 'Seleziona almeno un destinatario (te stesso o un cliente) per la scheda.');
      showToast('error', 'Seleziona almeno un destinatario (te stesso o un cliente) per la scheda.');
      return;
    }
    if (blocks.length === 0) {
      Alert.alert('Attenzione', 'Aggiungi almeno un blocco di esercizi alla scheda prima di salvare.');
      showToast('error', 'Aggiungi almeno un blocco di esercizi alla scheda.');
      return;
    }

    const emptyBlock = blocks.find((b) => b.exercises.length === 0);
    if (emptyBlock) {
      Alert.alert('Attenzione', 'Ogni blocco deve contenere almeno un esercizio.');
      showToast('error', 'Ogni blocco deve contenere almeno un esercizio.');
      return;
    }

    const emptySetExercise = blocks
      .filter((b) => b.blockType !== 'CIRCUIT_INTERVAL')
      .flatMap((b) => b.exercises)
      .find((ex) => ex.sets.length === 0);

    if (emptySetExercise) {
      const catalogEx = exerciseCatalogMap.get(emptySetExercise.exerciseId);
      const exName = catalogEx?.name || 'un esercizio';
      Alert.alert('Attenzione', `L'esercizio "${exName}" non ha serie. Aggiungi almeno una serie o rimuovilo.`);
      showToast(
        'error',
        `L'esercizio "${exName}" non ha serie. Aggiungi almeno una serie o rimuovilo.`
      );
      return;
    }

    // Dismiss della tastiera per confermare lo stato dei campi di testo
    Keyboard.dismiss();

    // Concurrency Guard sincrono
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    // 2. Attivazione stato di caricamento
    setIsSaving(true);

    try {
      const blocksPayload: RoutineBlock[] = blocks.map((b, bIdx) => ({
        block_type: b.blockType,
        order_index: bIdx + 1,
        rounds: b.rounds || 1,
        rest_between_rounds: b.restBetweenRounds || 0,
        circuit_type: b.blockType === 'CIRCUIT_INTERVAL' ? 'INTERVAL' : 'STANDARD',
        interval_work_seconds: b.blockType === 'CIRCUIT_INTERVAL' ? (b.intervalWorkSeconds || 40) : null,
        interval_rest_seconds: b.blockType === 'CIRCUIT_INTERVAL' ? (b.intervalRestSeconds || 20) : null,
        exercises: b.exercises.map((ex, exIdx) => ({
          exercise_id: ex.exerciseId,
          exercise_order: exIdx + 1,
          intra_rest_seconds: ex.intraRestSeconds || 0,
          superset_group: b.blockType === 'SUPERSERIE' ? String.fromCharCode(65 + bIdx) : null,
          custom_description: ex.customDescription?.trim() || null,
          custom_video_url: ex.customVideoUrl?.trim() || null,
          notes: ex.notes || null,
          sets:
            b.blockType === 'CIRCUIT_INTERVAL'
              ? [
                  {
                    set_number: 1,
                    set_type: 'NORMAL',
                    target_weight_kg:
                      ex.sets[0]?.equipment === 'kg'
                        ? Number(ex.sets[0]?.targetWeightKg || 0)
                        : 0,
                    target_reps: Number(ex.sets[0]?.targetReps || 0),
                    target_time_seconds: b.intervalWorkSeconds || 40,
                    band_assistance:
                      ex.sets[0]?.equipment === 'band'
                        ? (ex.sets[0]?.bandIntensity || ex.sets[0]?.bandAssistance || 'medium')
                        : (ex.sets[0]?.bandAssistance && ex.sets[0]?.bandAssistance !== 'none'
                          ? ex.sets[0]?.bandAssistance
                          : 'none'),
                    drop_count: 0,
                    drop_percentage: null,
                    rest_seconds: b.intervalRestSeconds || 20,
                    notes: null,
                  },
                ]
              : ex.sets.map((s, sIdx) => {
                  let targetReps = 0;
                  let targetTimeSeconds: number | null = null;
                  const isTimeTarget = s.targetType === 'time' || (s.targetTimeSeconds != null && Number(s.targetTimeSeconds) > 0);
                  if (isTimeTarget) {
                    targetTimeSeconds = Number(s.targetValue ?? s.targetTimeSeconds ?? 30);
                    targetReps = 0;
                  } else {
                    targetReps = Number(s.targetValue ?? s.targetReps ?? 10);
                    targetTimeSeconds = null;
                  }

                  let targetWeightKg = 0;
                  let bandAssistance: BandAssistance = 'none';
                  if (s.equipment === 'kg') {
                    targetWeightKg = Number(s.targetWeightKg || 0);
                    bandAssistance = 'none';
                  } else if (s.equipment === 'band') {
                    targetWeightKg = 0;
                    bandAssistance = s.bandIntensity || s.bandAssistance || 'medium';
                  } else {
                    targetWeightKg = 0;
                    bandAssistance = 'none';
                  }

                  return {
                    set_number: sIdx + 1,
                    set_type: s.setType,
                    target_weight_kg: targetWeightKg,
                    target_reps: targetReps,
                    target_time_seconds: targetTimeSeconds,
                    band_assistance: bandAssistance,
                    drop_count: (s.setType === 'STRIPPING' || s.setType === 'REST_PAUSE') ? (s.dropCount ?? 2) : 0,
                    drop_percentage: s.setType === 'STRIPPING' ? (s.dropPercentage ?? 20) : null,
                    rest_pause_seconds: s.setType === 'REST_PAUSE' ? (s.restPauseSeconds ?? 20) : null,
                    rest_seconds: s.restSeconds ?? (b.blockType === 'CIRCUIT_STANDARD' ? 0 : 90),
                    notes: s.notes || null,
                  };
                }),
        })),
      }));

      const selectedFolder = folders.find((f) => f.id === selectedFolderId);

      const routineData = {
        name: name.trim(),
        duration_weeks: parseInt(durationWeeks, 10) || 4,
        workout_type: workoutType,
        description: description.trim() || undefined,
        folderId: selectedFolderId || undefined,
        folder_id: selectedFolderId || undefined,
        folderName: selectedFolder?.name || undefined,
        folder_name: selectedFolder?.name || undefined,
        border_color: selectedBorderColor,
        blocks: blocksPayload,
        clientIds: selectedClientIds.length > 0 ? selectedClientIds : undefined,
        client_ids: selectedClientIds.length > 0 ? selectedClientIds : undefined,
        owner_id: selectedClientIds.length > 0 ? selectedClientIds[0] : undefined,
      };

      // 3. Esecuzione Chiamata API Sequenziale
      if (mode === 'UPDATE' && isEditing && routineId) {
        await updateRoutine(routineId, routineData);
      } else {
        await addRoutine(routineData);
      }

      // 4. Disattivazione stato di caricamento e lock
      isSavingRef.current = false;
      setIsSaving(false);

      // 5. Success feedback & Chiusura ordinata
      const successMsg =
        mode === 'UPDATE'
          ? 'Scheda aggiornata con successo!'
          : mode === 'CREATE_NEW' && isEditing
          ? 'Scheda duplicata come nuova con successo!'
          : 'Scheda creata e assegnata con successo!';
      showToast('success', successMsg);

      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (err: any) {
      isSavingRef.current = false;
      setIsSaving(false);

      const errorMsg =
        err?.message ||
        'Si è verificato un errore durante il salvataggio della scheda sul server. Riprova.';
      Alert.alert('Errore Salvataggio', errorMsg, [{ text: 'OK' }]);
      showToast('error', errorMsg);
    }
  };

  const confirmDeleteRoutine = () => {
    if (!routineId) return;
    Alert.alert(
      'Elimina Scheda',
      "Vuoi davvero eliminare questa scheda? L'azione è irreversibile.",
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteRoutine(routineId);
              showToast('success', 'Scheda eliminata con successo!');
              setTimeout(() => {
                navigation.goBack();
              }, 500);
            } catch (e: any) {
              setIsDeleting(false);
              const err = e?.message || 'Impossibile eliminare la scheda.';
              Alert.alert('Errore Eliminazione', err, [{ text: 'OK' }]);
              showToast('error', err);
            }
          },
        },
      ]
    );
  };

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* HEADER BAR */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {isEditing ? 'Modifica Scheda' : 'Costruttore Scheda'}
        </Text>

        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.cancelHeaderBtn}
          accessibilityRole="button"
          accessibilityLabel="Annulla e chiudi modale"
        >
          <Text style={styles.cancelHeaderBtnText}>Annulla</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollArea}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ======================================================== */}
        {/* SEZIONE 1: ANAGRAFICA & ASSEGNAZIONE CLIENTI             */}
        {/* ======================================================== */}
        <Card style={styles.metaCard}>
          {/* ASSEGNAZIONE MULTI-CLIENTE (TRAINER) */}
          {isTrainer && (
            <View style={styles.clientsSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>
                  {`DESTINATARI SCHEDA (${selectedClientIds.length} ${
                    selectedClientIds.length === 1 ? 'selezionato' : 'selezionati'
                  })`}
                </Text>
                <Pressable onPress={handleToggleAllClients}>
                  <Text style={styles.toggleAllText}>
                    {selectedClientIds.length === availableClients.length
                      ? 'Deseleziona tutti'
                      : 'Seleziona tutti'}
                  </Text>
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clientChipsScroll}>
                {availableClients.map((client) => {
                  const isChecked = selectedClientIds.includes(String(client.id));
                  return (
                    <Pressable
                      key={String(client.id)}
                      onPress={() => handleToggleClientSelection(String(client.id))}
                      style={[styles.clientChip, isChecked && styles.clientChipSelected]}
                    >
                      <View style={[styles.clientCheckbox, isChecked && styles.clientCheckboxActive]}>
                        {isChecked && <Text style={styles.clientCheckmark}>✓</Text>}
                      </View>
                      <Text
                        style={[styles.clientChipText, isChecked && styles.clientChipTextSelected]}
                        numberOfLines={1}
                      >
                        {client.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {selectedClientIds.length > 1 && (
                <Text style={styles.cloneNotice}>
                  ⚡ Verrà creata una copia fisica indipendente per ciascuno dei {selectedClientIds.length} destinatari selezionati.
                </Text>
              )}
            </View>
          )}

          {/* NOME SCHEDA */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>NOME SCHEDA *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Es. Spinta & Pettorali / Scheda A"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* CARTELLA */}
          <View style={styles.fieldGroup}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.fieldLabel}>CARTELLA</Text>
              <Pressable onPress={() => setShowNewFolderInput((v) => !v)}>
                <Text style={styles.newFolderLink}>
                  {showNewFolderInput ? 'Annulla' : '+ Nuova Cartella'}
                </Text>
              </Pressable>
            </View>

            {showNewFolderInput && (
              <View style={styles.newFolderRow}>
                <TextInput
                  style={[styles.input, { flex: 1, height: 40 }]}
                  placeholder="Nome nuova cartella..."
                  placeholderTextColor={colors.textMuted}
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                />
                <Pressable onPress={handleCreateFolder} style={styles.addFolderBtn}>
                  <Text style={styles.addFolderBtnText}>Crea</Text>
                </Pressable>
              </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              <Pressable
                onPress={() => setSelectedFolderId(null)}
                style={[styles.chip, selectedFolderId === null && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedFolderId === null && styles.chipTextActive]}>
                  Nessuna Cartella
                </Text>
              </Pressable>
              {folders.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => setSelectedFolderId(f.id)}
                  style={[styles.chip, selectedFolderId === f.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, selectedFolderId === f.id && styles.chipTextActive]}>
                    📁 {f.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* DURATA (SETTIMANE) & TIPO ALLENAMENTO */}
          <View style={styles.rowTwoCols}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>DURATA (SETTIMANE)</Text>
              <View style={styles.chipsRowWrap}>
                {DURATION_WEEKS_OPTIONS.map((w) => (
                  <Pressable
                    key={w}
                    onPress={() => setDurationWeeks(String(w))}
                    style={[styles.miniChip, durationWeeks === String(w) && styles.miniChipActive]}
                  >
                    <Text
                      style={[
                        styles.miniChipText,
                        durationWeeks === String(w) && styles.miniChipTextActive,
                      ]}
                    >
                      {w} sett.
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>BORDO COLORE</Text>
              <View style={styles.colorPaletteRow}>
                {BORDER_PALETTE.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setSelectedBorderColor(c)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      selectedBorderColor === c && styles.colorDotSelected,
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>

          {/* TIPO ALLENAMENTO */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>TIPO ALLENAMENTO</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {WORKOUT_TYPES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setWorkoutType(t)}
                  style={[styles.chip, workoutType === t && styles.chipActive]}
                >
                  <Text style={[styles.chipText, workoutType === t && styles.chipTextActive]}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* DESCRIZIONE / NOTE GENERALI */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>NOTE GENERALI SCHEDA (OPZIONALE)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Focus su catena cinetica posteriore, progressione RPE..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>
        </Card>

        {/* ======================================================== */}
        {/* SEZIONE 2: LISTA BLOCCHI RIGIDI                          */}
        {/* ======================================================== */}
        <View style={styles.blocksSectionHeader}>
          <Text style={styles.blocksSectionTitle}>BLOCCHI DI ALLENAMENTO</Text>
          <Text style={styles.blocksSectionSubtitle}>
            {blocks.length === 0
              ? 'Nessun blocco inserito. Scegli un tipo di blocco in basso per iniziare.'
              : `${blocks.length} blocco/i inseriti`}
          </Text>
        </View>

        {blocks.map((block, bIdx) => {
          const isCollapsed = collapsedBlocks.has(block.tempId);

          return (
            <Card
              key={block.tempId}
              style={[
                styles.blockCard,
                block.blockType === 'SUPERSERIE' && styles.blockCardSuperserie,
                block.blockType === 'CIRCUIT_STANDARD' && styles.blockCardCircuitStd,
                block.blockType === 'CIRCUIT_INTERVAL' && styles.blockCardInterval,
              ]}
            >
              {/* BLOCK HEADER */}
              <View style={styles.blockHeader}>
                <View style={styles.blockTitleCol}>
                  <View style={styles.badgeRow}>
                    <Text style={styles.blockIndexText}>#{bIdx + 1}</Text>
                    {block.blockType === 'SINGLE' && (
                      <View style={[styles.blockTypeBadge, { backgroundColor: '#1E293B', borderColor: '#475569' }]}>
                        <Text style={[styles.blockTypeBadgeText, { color: colors.text }]}>👤 ESERCIZIO SINGOLO</Text>
                      </View>
                    )}
                    {block.blockType === 'SUPERSERIE' && (
                      <View style={[styles.blockTypeBadge, { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: '#3B82F6' }]}>
                        <Text style={[styles.blockTypeBadgeText, { color: '#60A5FA' }]}>⚡ SUPER SERIE</Text>
                      </View>
                    )}
                    {block.blockType === 'CIRCUIT_STANDARD' && (
                      <View style={[styles.blockTypeBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: '#F59E0B' }]}>
                        <Text style={[styles.blockTypeBadgeText, { color: '#FBBF24' }]}>🔄 CIRCUITO STANDARD</Text>
                      </View>
                    )}
                    {block.blockType === 'CIRCUIT_INTERVAL' && (
                      <View style={[styles.blockTypeBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#EF4444' }]}>
                        <Text style={[styles.blockTypeBadgeText, { color: '#F87171' }]}>⏱ INTERVAL TRAINING (HIIT)</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Block Controls: Reorder, Collapse, Delete */}
                <View style={styles.blockControlsRow}>
                  <Pressable
                    disabled={bIdx === 0}
                    onPress={() => handleMoveBlock(bIdx, 'up')}
                    style={[styles.blockActionBtn, bIdx === 0 && { opacity: 0.3 }]}
                  >
                    <Text style={styles.blockActionBtnText}>▲</Text>
                  </Pressable>
                  <Pressable
                    disabled={bIdx === blocks.length - 1}
                    onPress={() => handleMoveBlock(bIdx, 'down')}
                    style={[styles.blockActionBtn, bIdx === blocks.length - 1 && { opacity: 0.3 }]}
                  >
                    <Text style={styles.blockActionBtnText}>▼</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleBlockCollapse(block.tempId)}
                    style={styles.blockCollapseBtn}
                    accessibilityRole="button"
                    accessibilityLabel={isCollapsed ? 'Espandi blocco' : 'Riduci blocco'}
                  >
                    <Text style={styles.blockCollapseBtnText}>
                      {isCollapsed ? '▼ Espandi' : '▲ Riduci'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRemoveBlock(block.tempId)}
                    style={[styles.blockActionBtn, styles.blockDeleteBtn]}
                  >
                    <Text style={[styles.blockActionBtnText, { color: colors.danger }]}>🗑</Text>
                  </Pressable>
                </View>
              </View>

              {/* COLLAPSED BLOCK SUMMARY */}
              {isCollapsed && (
                <Pressable
                  onPress={() => toggleBlockCollapse(block.tempId)}
                  style={styles.blockCollapsedSummaryRow}
                  accessibilityRole="button"
                  accessibilityLabel="Tocca per espandere il blocco"
                >
                  <Text style={styles.blockCollapsedSummaryText}>
                    📦 {block.exercises.length} {block.exercises.length === 1 ? 'esercizio' : 'esercizi'}
                    {block.exercises.length > 0
                      ? ` • ${block.exercises
                          .map((e) => exerciseCatalogMap.get(e.exerciseId)?.name || 'Esercizio')
                          .join(' + ')}`
                      : ''} • Tocca per espandere
                  </Text>
                </Pressable>
              )}

              {/* BLOCK SETTINGS BAR (FOR SUPERSERIE, CIRCUITS, INTERVAL) */}
              {!isCollapsed && block.blockType !== 'SINGLE' && (
                <View style={styles.blockSettingsCard}>
                  {block.blockType === 'SUPERSERIE' && (
                    <View style={styles.settingsRow}>
                      <View style={styles.settingCol}>
                        <Text style={styles.settingLabel}>SERIE GLOBALI</Text>
                        <TextInput
                          style={styles.settingInput}
                          keyboardType="numeric"
                          value={String(block.rounds)}
                          onChangeText={(v) => handleUpdateBlockField(block.tempId, 'rounds', parseInt(v, 10) || 1)}
                        />
                      </View>
                      <View style={styles.settingCol}>
                        <Text style={styles.settingLabel}>RECUPERO FINALE (s)</Text>
                        <TextInput
                          style={styles.settingInput}
                          keyboardType="numeric"
                          value={String(block.restBetweenRounds)}
                          onChangeText={(v) =>
                            handleUpdateBlockField(block.tempId, 'restBetweenRounds', parseInt(v, 10) || 0)
                          }
                        />
                      </View>
                    </View>
                  )}

                  {block.blockType === 'CIRCUIT_STANDARD' && (
                    <View style={styles.settingsRow}>
                      <View style={styles.settingCol}>
                        <Text style={styles.settingLabel}>GIRI TOTALI</Text>
                        <TextInput
                          style={styles.settingInput}
                          keyboardType="numeric"
                          value={String(block.rounds)}
                          onChangeText={(v) => handleUpdateBlockField(block.tempId, 'rounds', parseInt(v, 10) || 1)}
                        />
                      </View>
                      <View style={styles.settingCol}>
                        <Text style={styles.settingLabel}>RECUPERO TRA I GIRI (s)</Text>
                        <TextInput
                          style={styles.settingInput}
                          keyboardType="numeric"
                          value={String(block.restBetweenRounds)}
                          onChangeText={(v) =>
                            handleUpdateBlockField(block.tempId, 'restBetweenRounds', parseInt(v, 10) || 0)
                          }
                        />
                      </View>
                    </View>
                  )}

                  {block.blockType === 'CIRCUIT_INTERVAL' && (
                    <View style={styles.settingsRow}>
                      <View style={styles.settingCol}>
                        <Text style={styles.settingLabel}>GIRI TOTALI</Text>
                        <TextInput
                          style={styles.settingInput}
                          keyboardType="numeric"
                          value={String(block.rounds)}
                          onChangeText={(v) => handleUpdateBlockField(block.tempId, 'rounds', parseInt(v, 10) || 1)}
                        />
                      </View>
                      <View style={styles.settingCol}>
                        <Text style={styles.settingLabel}>LAVORO (s)</Text>
                        <TextInput
                          style={[styles.settingInput, { borderColor: '#EF4444', color: '#F87171' }]}
                          keyboardType="numeric"
                          value={String(block.intervalWorkSeconds || 40)}
                          onChangeText={(v) =>
                            handleUpdateBlockField(block.tempId, 'intervalWorkSeconds', parseInt(v, 10) || 0)
                          }
                        />
                      </View>
                      <View style={styles.settingCol}>
                        <Text style={styles.settingLabel}>RIPOSO (s)</Text>
                        <TextInput
                          style={[styles.settingInput, { borderColor: '#10B981', color: '#34D399' }]}
                          keyboardType="numeric"
                          value={String(block.intervalRestSeconds || 20)}
                          onChangeText={(v) =>
                            handleUpdateBlockField(block.tempId, 'intervalRestSeconds', parseInt(v, 10) || 0)
                          }
                        />
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* BLOCK EXERCISES LIST */}
              {!isCollapsed && (
                <View style={styles.blockExercisesContainer}>
                  {block.exercises.map((ex, exIdx) => {
                    const catalogEx = exerciseCatalogMap.get(ex.exerciseId);
                    const exName = catalogEx?.name || `Esercizio ID #${ex.exerciseId}`;
                    const muscleGroup = catalogEx?.muscle_group || 'Altro';
                    const isNotesOpen = Boolean(ex.showNotesBlock || ex.customDescription || ex.customVideoUrl);

                    return (
                      <View key={ex.tempId} style={styles.exerciseItemCard}>
                        {/* Exercise Top Row */}
                        <View style={styles.exHeaderRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.exNameText}>
                              {block.blockType !== 'SINGLE' ? `${exIdx + 1}. ` : ''}
                              {exName}
                            </Text>
                            <Text style={styles.exSubText}>{muscleGroup}</Text>
                          </View>

                          <View style={styles.exActionsRow}>
                            {catalogEx?.video_url && (
                              <Pressable
                                onPress={() =>
                                  setActiveVideoModal({
                                    visible: true,
                                    url: catalogEx.video_url!,
                                    name: exName,
                                  })
                                }
                                style={styles.videoIconBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Guarda video da catalogo"
                              >
                                <Text style={styles.videoIconText}>▶ Video</Text>
                              </Pressable>
                            )}
                            <Pressable
                              onPress={() => handleRemoveExerciseFromBlock(block.tempId, ex.tempId)}
                              style={styles.removeExBtn}
                              accessibilityRole="button"
                              accessibilityLabel={`Rimuovi ${exName}`}
                            >
                              <Text style={styles.removeExBtnText}>✕ Rimuovi</Text>
                            </Pressable>
                          </View>
                        </View>

                        {/* ======================================================== */}
                        {/* OPTIONAL NOTES & VIDEO BLOCK (MAX 1 PER EXERCISE)        */}
                        {/* ======================================================== */}
                        {isNotesOpen && (
                          <View style={styles.exerciseNotesBox}>
                            <View style={styles.exerciseNotesHeader}>
                              <Text style={styles.exerciseNotesTitle}>📝 NOTE TECNICHE & VIDEO GUIDA</Text>
                              <Pressable
                                onPress={() => handleRemoveExerciseNotes(block.tempId, ex.tempId)}
                                style={styles.removeNotesBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Rimuovi note e video"
                              >
                                <Text style={styles.removeNotesBtnText}>🗑 Rimuovi Note/Video</Text>
                              </Pressable>
                            </View>

                            <View style={styles.notesFieldGroup}>
                              <Text style={styles.notesFieldLabel}>Descrizione / Istruzioni Esercizio</Text>
                              <TextInput
                                style={styles.notesTextArea}
                                multiline
                                numberOfLines={2}
                                placeholder="Es: Focus su eccentrica lenta 3s, gomiti aderenti al busto..."
                                placeholderTextColor={colors.textMuted}
                                value={ex.customDescription || ''}
                                onChangeText={(text) =>
                                  handleUpdateExerciseField(block.tempId, ex.tempId, 'customDescription', text)
                                }
                              />
                            </View>

                            <View style={styles.notesFieldGroup}>
                              <Text style={styles.notesFieldLabel}>Link Video (YouTube, Shorts, Reels)</Text>
                              <View style={styles.videoUrlRow}>
                                <TextInput
                                  style={styles.videoUrlInput}
                                  placeholder="https://youtu.be/... o instagram.com/reel/..."
                                  placeholderTextColor={colors.textMuted}
                                  value={ex.customVideoUrl || ''}
                                  autoCapitalize="none"
                                  keyboardType="url"
                                  onChangeText={(text) =>
                                    handleUpdateExerciseField(block.tempId, ex.tempId, 'customVideoUrl', text)
                                  }
                                />
                                {Boolean(ex.customVideoUrl?.trim()) && (
                                  <Pressable
                                    onPress={() =>
                                      setActiveVideoModal({
                                        visible: true,
                                        url: ex.customVideoUrl!.trim(),
                                        name: exName,
                                      })
                                    }
                                    style={styles.videoPreviewBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel="Anteprima video personalizzato"
                                  >
                                    <Text style={styles.videoPreviewBtnText}>▶ Anteprima</Text>
                                  </Pressable>
                                )}
                              </View>
                            </View>
                          </View>
                        )}

                        {/* ======================================================== */}
                        {/* CASE A: INTERVAL TRAINING (TARGET REPS & ATTREZZATURA)  */}
                        {/* ======================================================== */}
                        {block.blockType === 'CIRCUIT_INTERVAL' ? (
                          <>
                            <View style={styles.intervalExRow}>
                              <Text style={styles.intervalOnlyNotice}>
                                ⏱ {block.intervalWorkSeconds || 40}s Work / {block.intervalRestSeconds || 20}s Rest (definiti dall'header del circuito)
                              </Text>
                            </View>

                            {/* Row: Target Reps & Equipment / Load Selector */}
                            {(() => {
                              const set = ex.sets[0] || {
                                setNumber: 1,
                                setType: 'NORMAL' as SetType,
                                targetType: 'time' as TargetType,
                                targetValue: block.intervalWorkSeconds || 40,
                                targetWeightKg: 0,
                                targetReps: 0,
                                targetTimeSeconds: block.intervalWorkSeconds || 40,
                                equipment: 'bodyweight' as EquipmentType,
                                bandAssistance: 'none' as BandAssistance,
                                bandIntensity: 'medium' as BandIntensity,
                                restSeconds: block.intervalRestSeconds || 20,
                              };

                              return (
                                <View style={[styles.setControlsRow, { marginTop: 6, marginBottom: 8 }]}>
                                  {/* Target Reps Input */}
                                  <View style={styles.controlGroup}>
                                    <Text style={styles.controlGroupLabel}>TARGET REPS</Text>
                                    <TextInput
                                      style={styles.controlNumericInput}
                                      keyboardType="numeric"
                                      value={set.targetReps ? String(set.targetReps) : ''}
                                      onChangeText={(v) => {
                                        const num = parseInt(v, 10) || 0;
                                        handleUpdateSetFields(block.tempId, ex.tempId, 0, {
                                          targetReps: num,
                                          targetValue: num,
                                        });
                                      }}
                                      placeholder="es. 10 (o max)"
                                      placeholderTextColor={colors.textMuted}
                                    />
                                  </View>

                                  {/* Equipment / Load Selector */}
                                  <View style={styles.controlGroup}>
                                    <Text style={styles.controlGroupLabel}>ATTREZZATURA / CARICO</Text>
                                    <View style={styles.controlComboRow}>
                                      <CompactDropdown
                                        title="Attrezzatura"
                                        value={set.equipment || 'bodyweight'}
                                        options={EQUIPMENT_OPTIONS}
                                        onChange={(newEquip) => {
                                          handleUpdateSet(block.tempId, ex.tempId, 0, 'equipment', newEquip);
                                          if (newEquip === 'band' && !set.bandIntensity) {
                                            handleUpdateSet(block.tempId, ex.tempId, 0, 'bandIntensity', 'medium');
                                          }
                                        }}
                                        minWidth={88}
                                      />

                                      {set.equipment === 'kg' && (
                                        <View style={styles.inputWithUnit}>
                                          <TextInput
                                            style={styles.controlNumericInput}
                                            keyboardType="decimal-pad"
                                            value={set.targetWeightKg === 0 ? '' : String(set.targetWeightKg)}
                                            onChangeText={(v) =>
                                              handleUpdateSet(
                                                block.tempId,
                                                ex.tempId,
                                                0,
                                                'targetWeightKg',
                                                parseFloat(v) || 0
                                              )
                                            }
                                            placeholder="0"
                                            placeholderTextColor={colors.textMuted}
                                          />
                                          <Text style={styles.unitSuffix}>kg</Text>
                                        </View>
                                      )}

                                      {set.equipment === 'band' && (
                                        <CompactDropdown
                                          title="Intensità Elastico"
                                          value={set.bandIntensity || 'medium'}
                                          options={BAND_INTENSITY_OPTIONS}
                                          onChange={(val) => {
                                            handleUpdateSet(block.tempId, ex.tempId, 0, 'bandIntensity', val);
                                            handleUpdateSet(block.tempId, ex.tempId, 0, 'bandAssistance', val);
                                          }}
                                          minWidth={80}
                                        />
                                      )}

                                      {set.equipment === 'bodyweight' && (
                                        <View style={styles.bodyweightBadge}>
                                          <Text style={styles.bodyweightBadgeText}>Libero</Text>
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                </View>
                              );
                            })()}

                            {!isNotesOpen && (
                              <View style={styles.exActionButtonsRow}>
                                <Pressable
                                  onPress={() => handleAddExerciseNotes(block.tempId, ex.tempId)}
                                  style={styles.addNotesBtn}
                                  accessibilityRole="button"
                                  accessibilityLabel="Aggiungi Note o Video all'esercizio"
                                >
                                  <Text style={styles.addNotesBtnText}>+ Aggiungi Note/Video</Text>
                                </Pressable>
                              </View>
                            )}
                          </>
                        ) : (
                          /* ======================================================== */
                          /* CASE B: SINGLE, SUPERSERIE, CIRCUIT STANDARD (FULL SETS) */
                          /* ======================================================== */
                          <>
                            {ex.sets.length === 0 ? (
                              <View style={styles.emptySetsNotice}>
                                <Text style={styles.emptySetsNoticeText}>
                                  Nessuna serie impostata. Clicca "+ Aggiungi Serie" per iniziare.
                                </Text>
                              </View>
                            ) : (
                              <View style={styles.setsTable}>
                                {ex.sets.map((set, sIdx) => {
                                  const isStripping = set.setType === 'STRIPPING';

                                  return (
                                    <View key={`s-${sIdx}`} style={styles.setRowCard}>
                                      {/* Row 1: Set Number, Set Type Chips, Delete button */}
                                      <View style={styles.setTopRow}>
                                        <View style={styles.setNumberBadge}>
                                          <Text style={styles.setNumberText}>SET {sIdx + 1}</Text>
                                        </View>

                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.setTypeScroll}>
                                          {SET_TYPES.map((st) => (
                                            <Pressable
                                              key={st.key}
                                              onPress={() => {
                                                handleUpdateSet(block.tempId, ex.tempId, sIdx, 'setType', st.key);
                                                if (st.key === 'REST_PAUSE') {
                                                  if (!set.dropCount || set.dropCount < 2) {
                                                    handleUpdateSet(block.tempId, ex.tempId, sIdx, 'dropCount', 2);
                                                  }
                                                  if (!set.restPauseSeconds) {
                                                    handleUpdateSet(block.tempId, ex.tempId, sIdx, 'restPauseSeconds', 20);
                                                  }
                                                } else if (st.key === 'STRIPPING') {
                                                  if (!set.dropCount || set.dropCount < 1) {
                                                    handleUpdateSet(block.tempId, ex.tempId, sIdx, 'dropCount', 2);
                                                  }
                                                  if (!set.dropPercentage) {
                                                    handleUpdateSet(block.tempId, ex.tempId, sIdx, 'dropPercentage', 20);
                                                  }
                                                }
                                              }}
                                              style={[
                                                styles.setTypeMiniChip,
                                                set.setType === st.key && {
                                                  backgroundColor: st.badgeBg,
                                                  borderColor: st.badgeColor,
                                                },
                                              ]}
                                            >
                                              <Text
                                                style={[
                                                  styles.setTypeMiniChipText,
                                                  set.setType === st.key && { color: st.badgeColor, fontWeight: '800' },
                                                ]}
                                              >
                                                {st.label}
                                              </Text>
                                            </Pressable>
                                          ))}
                                        </ScrollView>

                                        <Pressable
                                          onPress={() => handleRemoveSet(block.tempId, ex.tempId, sIdx)}
                                          style={styles.setDeleteBtn}
                                          accessibilityRole="button"
                                          accessibilityLabel={`Elimina serie ${sIdx + 1}`}
                                        >
                                          <Text style={styles.setDeleteBtnText}>🗑</Text>
                                        </Pressable>
                                      </View>

                                      {/* Row 2: Target, Equipment & Recovery Controls */}
                                      <View style={styles.setControlsRow}>
                                        {/* Target Group */}
                                        <View style={styles.controlGroup}>
                                          <Text style={styles.controlGroupLabel}>TARGET</Text>
                                          <View style={styles.controlComboRow}>
                                            <CompactDropdown
                                              title="Seleziona Tipo Target"
                                              value={set.targetType || 'reps'}
                                              options={TARGET_OPTIONS}
                                              onChange={(newType) => {
                                                if (newType === 'time') {
                                                  const val = set.targetTimeSeconds || (set.targetType === 'time' ? set.targetValue : 30) || 30;
                                                  handleUpdateSetFields(block.tempId, ex.tempId, sIdx, {
                                                    targetType: 'time',
                                                    targetValue: val,
                                                    targetTimeSeconds: val,
                                                    targetReps: 0,
                                                  });
                                                } else {
                                                  const val = set.targetReps || (set.targetType === 'reps' ? set.targetValue : 10) || 10;
                                                  handleUpdateSetFields(block.tempId, ex.tempId, sIdx, {
                                                    targetType: 'reps',
                                                    targetValue: val,
                                                    targetReps: val,
                                                    targetTimeSeconds: null,
                                                  });
                                                }
                                              }}
                                              minWidth={78}
                                            />
                                            <TextInput
                                              style={styles.controlNumericInput}
                                              keyboardType="numeric"
                                              value={
                                                set.targetValue === 0
                                                  ? ''
                                                  : String(set.targetValue ?? (set.targetType === 'time' ? 30 : 10))
                                              }
                                              onChangeText={(v) => {
                                                const num = parseInt(v, 10) || 0;
                                                if (set.targetType === 'time') {
                                                  handleUpdateSetFields(block.tempId, ex.tempId, sIdx, {
                                                    targetValue: num,
                                                    targetTimeSeconds: num,
                                                    targetReps: 0,
                                                  });
                                                } else {
                                                  handleUpdateSetFields(block.tempId, ex.tempId, sIdx, {
                                                    targetValue: num,
                                                    targetReps: num,
                                                    targetTimeSeconds: null,
                                                  });
                                                }
                                              }}
                                              placeholder={set.targetType === 'time' ? '30s' : '10'}
                                              placeholderTextColor={colors.textMuted}
                                            />
                                          </View>
                                        </View>

                                        {/* Equipment / Load Group */}
                                        <View style={styles.controlGroup}>
                                          <Text style={styles.controlGroupLabel}>ATTREZZATURA / CARICO</Text>
                                          <View style={styles.controlComboRow}>
                                            <CompactDropdown
                                              title="Attrezzatura"
                                              value={set.equipment || 'kg'}
                                              options={EQUIPMENT_OPTIONS}
                                              onChange={(newEquip) => {
                                                handleUpdateSet(block.tempId, ex.tempId, sIdx, 'equipment', newEquip);
                                                if (newEquip === 'band' && !set.bandIntensity) {
                                                  handleUpdateSet(block.tempId, ex.tempId, sIdx, 'bandIntensity', 'medium');
                                                }
                                              }}
                                              minWidth={88}
                                            />

                                            {set.equipment === 'kg' && (
                                              <View style={styles.inputWithUnit}>
                                                <TextInput
                                                  style={styles.controlNumericInput}
                                                  keyboardType="decimal-pad"
                                                  value={set.targetWeightKg === 0 ? '' : String(set.targetWeightKg)}
                                                  onChangeText={(v) =>
                                                    handleUpdateSet(
                                                      block.tempId,
                                                      ex.tempId,
                                                      sIdx,
                                                      'targetWeightKg',
                                                      parseFloat(v) || 0
                                                    )
                                                  }
                                                  placeholder="0"
                                                  placeholderTextColor={colors.textMuted}
                                                />
                                                <Text style={styles.unitSuffix}>kg</Text>
                                              </View>
                                            )}

                                            {set.equipment === 'band' && (
                                              <CompactDropdown
                                                title="Intensità Elastico"
                                                value={set.bandIntensity || 'medium'}
                                                options={BAND_INTENSITY_OPTIONS}
                                                onChange={(val) => {
                                                  handleUpdateSet(block.tempId, ex.tempId, sIdx, 'bandIntensity', val);
                                                  handleUpdateSet(block.tempId, ex.tempId, sIdx, 'bandAssistance', val);
                                                }}
                                                minWidth={80}
                                              />
                                            )}

                                            {set.equipment === 'bodyweight' && (
                                              <View style={styles.bodyweightBadge}>
                                                <Text style={styles.bodyweightBadgeText}>Libero</Text>
                                              </View>
                                            )}
                                          </View>
                                        </View>

                                        {/* Rest Seconds (Hidden in standard circuit since it's global between rounds) */}
                                        {block.blockType !== 'CIRCUIT_STANDARD' && (
                                          <View style={[styles.controlGroup, { minWidth: 60, flex: 0 }]}>
                                            <Text style={styles.controlGroupLabel}>REC (s)</Text>
                                            <TextInput
                                              style={styles.controlNumericInput}
                                              keyboardType="numeric"
                                              value={String(set.restSeconds ?? 90)}
                                              onChangeText={(v) =>
                                                handleUpdateSet(
                                                  block.tempId,
                                                  ex.tempId,
                                                  sIdx,
                                                  'restSeconds',
                                                  parseInt(v, 10) || 0
                                                )
                                              }
                                              placeholder="90"
                                              placeholderTextColor={colors.textMuted}
                                            />
                                          </View>
                                        )}
                                      </View>

                                      {/* Stripping Inputs: N. Drop e % Scarico */}
                                      {isStripping && (
                                        <View style={styles.strippingConfigRow}>
                                          <Text style={styles.strippingConfigLabel}>⚡ STRIPPING:</Text>

                                          <View style={styles.strippingInputCol}>
                                            <Text style={styles.strippingMiniLabel}>N. DROP</Text>
                                            <TextInput
                                              style={styles.strippingInput}
                                              keyboardType="numeric"
                                              value={String(set.dropCount ?? 2)}
                                              onChangeText={(v) =>
                                                handleUpdateSet(
                                                  block.tempId,
                                                  ex.tempId,
                                                  sIdx,
                                                  'dropCount',
                                                  parseInt(v, 10) || 1
                                                )
                                              }
                                            />
                                          </View>

                                          <View style={styles.strippingInputCol}>
                                            <Text style={styles.strippingMiniLabel}>% SCARICO</Text>
                                            <TextInput
                                              style={styles.strippingInput}
                                              keyboardType="numeric"
                                              value={String(set.dropPercentage ?? 20)}
                                              onChangeText={(v) =>
                                                handleUpdateSet(
                                                  block.tempId,
                                                  ex.tempId,
                                                  sIdx,
                                                  'dropPercentage',
                                                  parseFloat(v) || 0
                                                )
                                              }
                                            />
                                          </View>

                                          <View style={styles.strippingPreviewCol}>
                                            <Text style={styles.strippingPreviewText}>
                                              {set.targetWeightKg > 0
                                                ? `Es: ${set.targetWeightKg}kg → ${Math.round(
                                                    set.targetWeightKg * (1 - (set.dropPercentage || 20) / 100)
                                                  )}kg → ${Math.round(
                                                    set.targetWeightKg *
                                                      Math.pow(1 - (set.dropPercentage || 20) / 100, 2)
                                                  )}kg`
                                                : `-${set.dropPercentage || 20}% a drop`}
                                            </Text>
                                          </View>
                                        </View>
                                      )}

                                      {/* Rest-Pause Inputs: N. Sottoserie (Cluster) e Recupero tra sottoserie (s) */}
                                      {set.setType === 'REST_PAUSE' && (
                                        <View style={styles.strippingConfigRow}>
                                          <Text style={[styles.strippingConfigLabel, { color: colors.volume }]}>⏱ REST-PAUSE:</Text>

                                          <View style={styles.strippingInputCol}>
                                            <Text style={styles.strippingMiniLabel}>N. CLUSTER</Text>
                                            <TextInput
                                              style={styles.strippingInput}
                                              keyboardType="numeric"
                                              value={String(set.dropCount ?? 2)}
                                              onChangeText={(v) =>
                                                handleUpdateSet(
                                                  block.tempId,
                                                  ex.tempId,
                                                  sIdx,
                                                  'dropCount',
                                                  Math.max(2, parseInt(v, 10) || 2)
                                                )
                                              }
                                            />
                                          </View>

                                          <View style={styles.strippingInputCol}>
                                            <Text style={styles.strippingMiniLabel}>RECUPERO INTRA (s)</Text>
                                            <TextInput
                                              style={styles.strippingInput}
                                              keyboardType="numeric"
                                              value={String(set.restPauseSeconds ?? 20)}
                                              onChangeText={(v) =>
                                                handleUpdateSet(
                                                  block.tempId,
                                                  ex.tempId,
                                                  sIdx,
                                                  'restPauseSeconds',
                                                  parseInt(v, 10) || 0
                                                )
                                              }
                                            />
                                          </View>

                                          <View style={styles.strippingPreviewCol}>
                                            <Text style={[styles.strippingPreviewText, { color: colors.volume }]}>
                                              {`${set.dropCount ?? 2} cluster • Pausa intra ${set.restPauseSeconds ?? 20}s`}
                                            </Text>
                                          </View>
                                        </View>
                                      )}
                                    </View>
                                  );
                                })}
                              </View>
                            )}

                            {/* Action Buttons Row: "+ Aggiungi Note/Video" (if !isNotesOpen) & "+ Aggiungi Serie" */}
                            <View style={styles.exActionButtonsRow}>
                              {!isNotesOpen && (
                                <Pressable
                                  onPress={() => handleAddExerciseNotes(block.tempId, ex.tempId)}
                                  style={styles.addNotesBtn}
                                  accessibilityRole="button"
                                  accessibilityLabel="Aggiungi Note o Video all'esercizio"
                                >
                                  <Text style={styles.addNotesBtnText}>+ Aggiungi Note/Video</Text>
                                </Pressable>
                              )}

                              <Pressable
                                onPress={() => handleAddSet(block.tempId, ex.tempId)}
                                style={[styles.addSetBtn, { flex: 1, marginTop: 0 }]}
                                accessibilityRole="button"
                                accessibilityLabel="Aggiungi serie all'esercizio"
                              >
                                <Text style={styles.addSetBtnText}>+ Aggiungi Serie</Text>
                              </Pressable>
                            </View>
                          </>
                        )}
                      </View>
                    );
                  })}

                  {/* + Aggiungi Esercizio al Blocco (For SUPERSERIE, CIRCUITS) */}
                  {block.blockType !== 'SINGLE' && (
                    <Pressable
                      onPress={() => openAddExerciseToBlockPicker(block.tempId)}
                      style={styles.addExerciseToBlockBtn}
                    >
                      <Text style={styles.addExerciseToBlockBtnText}>
                        + Aggiungi Esercizio a questo blocco
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </Card>
          );
        })}

        {/* ======================================================== */}
        {/* SEZIONE 3: I 4 BOTTONI DEDICATI "+ AGGIUNGI BLOCCO"      */}
        {/* ======================================================== */}
        <View style={styles.addBlockSection}>
          <Text style={styles.addBlockSectionTitle}>AGGIUNGI BLOCCO AL MESOCICLO</Text>

          <View style={styles.fourButtonsGrid}>
            {/* 1. ESERCIZIO SINGOLO */}
            <Pressable
              onPress={() => openNewBlockPicker('SINGLE')}
              style={[styles.blockTypeBtn, styles.btnSingle]}
            >
              <Text style={styles.blockTypeBtnIcon}>👤</Text>
              <Text style={styles.blockTypeBtnTitle}>ESERCIZIO SINGOLO</Text>
              <Text style={styles.blockTypeBtnDesc}>1 esercizio con serie, carichi, reps e stripping</Text>
            </Pressable>

            {/* 2. SUPER SERIE */}
            <Pressable
              onPress={() => openNewBlockPicker('SUPERSERIE')}
              style={[styles.blockTypeBtn, styles.btnSuperserie]}
            >
              <Text style={styles.blockTypeBtnIcon}>⚡</Text>
              <Text style={styles.blockTypeBtnTitle}>SUPER SERIE</Text>
              <Text style={styles.blockTypeBtnDesc}>2+ esercizi consecutivi per N serie globali</Text>
            </Pressable>

            {/* 3. CIRCUITO STANDARD */}
            <Pressable
              onPress={() => openNewBlockPicker('CIRCUIT_STANDARD')}
              style={[styles.blockTypeBtn, styles.btnCircuitStd]}
            >
              <Text style={styles.blockTypeBtnIcon}>🔄</Text>
              <Text style={styles.blockTypeBtnTitle}>CIRCUITO STANDARD</Text>
              <Text style={styles.blockTypeBtnDesc}>Giri totali, recupero tra i giri, carichi/reps propri</Text>
            </Pressable>

            {/* 4. INTERVAL TRAINING */}
            <Pressable
              onPress={() => openNewBlockPicker('CIRCUIT_INTERVAL')}
              style={[styles.blockTypeBtn, styles.btnInterval]}
            >
              <Text style={styles.blockTypeBtnIcon}>⏱</Text>
              <Text style={styles.blockTypeBtnTitle}>INTERVAL TRAINING (HIIT)</Text>
              <Text style={styles.blockTypeBtnDesc}>Giri, secondi Work & Rest. Target reps e carichi/elastici</Text>
            </Pressable>
          </View>
        </View>

        {/* FOOTER ACTIONS */}
        <View style={styles.footerContainer}>
          {isEditing ? (
            <>
              <View style={styles.footerEditTopRow}>
                {/* 1. CREA NUOVA */}
                <Pressable
                  onPress={() => handleSave('CREATE_NEW')}
                  disabled={isSaving || isDeleting}
                  style={[styles.saveAsNewRoutineBtn, (isSaving || isDeleting) && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Crea nuova scheda duplicata"
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#10B981" />
                  ) : (
                    <Text style={styles.saveAsNewRoutineBtnText}>🆕 CREA NUOVA</Text>
                  )}
                </Pressable>

                {/* 2. AGGIORNA ORIGINALE */}
                <Pressable
                  onPress={() => handleSave('UPDATE')}
                  disabled={isSaving || isDeleting}
                  style={[styles.updateRoutineBtn, (isSaving || isDeleting) && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Aggiorna scheda originale"
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.updateRoutineBtnText}>🔄 AGGIORNA ORIGINALE</Text>
                  )}
                </Pressable>
              </View>

              {/* 3. ELIMINA SCHEDA */}
              <Pressable
                onPress={confirmDeleteRoutine}
                disabled={isSaving || isDeleting}
                style={[styles.deleteRoutineBtn, (isSaving || isDeleting) && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Elimina scheda"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Text style={styles.deleteRoutineBtnText}>🗑️ ELIMINA SCHEDA</Text>
                )}
              </Pressable>
            </>
          ) : (
            <View style={styles.footerCreateRow}>
              {/* CREA SCHEDA */}
              <Pressable
                onPress={() => handleSave('CREATE_NEW')}
                disabled={isSaving}
                style={[styles.saveRoutineFullBtn, isSaving && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Crea nuova scheda"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.saveRoutineFullBtnText}>✓ CREA SCHEDA</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL: EXERCISE PICKER                                   */}
      {/* ======================================================== */}
      <Modal visible={showExercisePicker} animationType="slide" transparent>
        <View style={styles.pickerBackdrop}>
          <View style={[styles.pickerContainer, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
            <View style={styles.pickerTopBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerTitle}>
                  {pickerTarget?.mode === 'new_block' && pickerTarget.blockType === 'SINGLE'
                    ? 'Scegli Esercizio Singolo'
                    : pickerTarget?.mode === 'new_block' && pickerTarget.blockType === 'SUPERSERIE'
                    ? 'Scegli Esercizi Super Serie'
                    : pickerTarget?.mode === 'new_block' && pickerTarget.blockType === 'CIRCUIT_INTERVAL'
                    ? 'Scegli Esercizi Interval Training'
                    : 'Scegli Esercizi per il Circuito'}
                </Text>
                {selectedPickerExerciseIds.length > 0 && (
                  <Text style={styles.pickerSelectedCount}>
                    {selectedPickerExerciseIds.length} selezionati
                  </Text>
                )}
              </View>

              <Pressable
                onPress={() => {
                  setShowExercisePicker(false);
                  setPickerTarget(null);
                  setSelectedPickerExerciseIds([]);
                }}
                style={styles.pickerCloseBtn}
              >
                <Text style={styles.pickerCloseBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={styles.pickerSearchRow}>
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Cerca esercizio..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Muscle Group Filter Scroll */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerMuscleScroll}>
              {MUSCLE_GROUPS.map((grp) => (
                <Pressable
                  key={grp}
                  onPress={() => setFilterMuscle(grp)}
                  style={[styles.pickerMuscleChip, filterMuscle === grp && styles.pickerMuscleChipActive]}
                >
                  <Text
                    style={[
                      styles.pickerMuscleChipText,
                      filterMuscle === grp && styles.pickerMuscleChipTextActive,
                    ]}
                  >
                    {grp}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Exercises List */}
            <ScrollView style={styles.pickerExerciseList}>
              {filteredExercises.map((ex) => {
                const isSelected = selectedPickerExerciseIds.includes(ex.id);
                const isSingleMode =
                  pickerTarget?.mode === 'new_block' && pickerTarget.blockType === 'SINGLE';

                return (
                  <Pressable
                    key={ex.id}
                    onPress={() => handleTogglePickerExercise(ex.id)}
                    style={[styles.pickerItemCard, isSelected && styles.pickerItemCardSelected]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerItemName}>{ex.name}</Text>
                      <Text style={styles.pickerItemSub}>
                        {ex.muscle_group} • {ex.exercise_type}
                      </Text>
                    </View>

                    {isSingleMode ? (
                      <View style={styles.pickerSelectBadge}>
                        <Text style={styles.pickerSelectBadgeText}>Scegli</Text>
                      </View>
                    ) : (
                      <View style={[styles.pickerCheckbox, isSelected && styles.pickerCheckboxActive]}>
                        {isSelected && <Text style={styles.pickerCheckmark}>✓</Text>}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Multi-Select Confirm Footer */}
            {!(pickerTarget?.mode === 'new_block' && pickerTarget.blockType === 'SINGLE') && (
              <View style={styles.pickerFooterBar}>
                <Pressable
                  onPress={() => handleConfirmExerciseSelection()}
                  disabled={selectedPickerExerciseIds.length === 0}
                  style={[
                    styles.pickerConfirmBtn,
                    selectedPickerExerciseIds.length === 0 && { opacity: 0.5 },
                  ]}
                >
                  <Text style={styles.pickerConfirmBtnText}>
                    Conferma ({selectedPickerExerciseIds.length} Esercizi)
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* YOUTUBE VIDEO OVERLAY */}
      <YouTubeModalOverlay
        visible={activeVideoModal.visible}
        videoUrl={activeVideoModal.url}
        exerciseName={activeVideoModal.name}
        onClose={() => setActiveVideoModal({ visible: false, url: '', name: '' })}
      />



      {/* TOAST FEEDBACK */}
      <ToastFeedback
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
};

// -------------------------------------------------------------
// STYLES
// -------------------------------------------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundElevated,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
  },
  cancelHeaderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  cancelHeaderBtnText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Metadata Card
  metaCard: {
    marginBottom: 20,
    padding: 16,
  },
  clientsSection: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  toggleAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  clientChipsScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  clientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.backgroundSubtle,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  clientChipSelected: {
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    borderColor: colors.accent,
  },
  clientCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textMuted,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientCheckboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  clientCheckmark: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  clientChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  clientChipTextSelected: {
    color: colors.text,
    fontWeight: '700',
  },
  cloneNotice: {
    fontSize: 11,
    color: colors.emerald,
    marginTop: 4,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  newFolderLink: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '700',
  },
  newFolderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  addFolderBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFolderBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 12,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.backgroundSubtle,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  chipsRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  miniChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  miniChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  miniChipTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
  colorPaletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: colors.white,
    transform: [{ scale: 1.15 }],
  },

  // Blocks Section
  blocksSectionHeader: {
    marginBottom: 12,
  },
  blocksSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.5,
  },
  blocksSectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  blockCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    backgroundColor: colors.backgroundElevated,
  },
  blockCardSuperserie: {
    borderColor: '#3B82F6',
    borderLeftWidth: 4,
  },
  blockCardCircuitStd: {
    borderColor: '#F59E0B',
    borderLeftWidth: 4,
  },
  blockCardInterval: {
    borderColor: '#EF4444',
    borderLeftWidth: 4,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  blockTitleCol: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blockIndexText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textSecondary,
  },
  blockTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  blockTypeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  blockControlsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  blockActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockActionBtnText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '700',
  },
  blockDeleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  blockCollapseBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockCollapseBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  blockCollapsedSummaryRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  blockCollapsedSummaryText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  blockSettingsCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  settingsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  settingCol: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  settingInput: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.borderLight,
    textAlign: 'center',
  },
  blockExercisesContainer: {
    marginTop: 8,
  },
  exerciseItemCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  exHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  exSubText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  exActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  videoIconBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  videoIconText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F87171',
  },
  removeExBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  removeExBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger,
  },
  intervalExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  intervalOnlyNotice: {
    fontSize: 11,
    color: '#F87171',
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },

  // Compact Dropdown Styles
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
  },
  dropdownTriggerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  dropdownChevron: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModalBox: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.backgroundElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  dropdownModalTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  dropdownCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownCloseBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  dropdownOptionsContainer: {
    gap: 4,
  },
  dropdownOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  dropdownOptionRowSelected: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
  },
  dropdownOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownOptionIcon: {
    fontSize: 14,
  },
  dropdownOptionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dropdownOptionLabelSelected: {
    color: colors.text,
    fontWeight: '800',
  },
  dropdownCheckmark: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '900',
  },

  // Exercise Notes & Video Box
  exerciseNotesBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  exerciseNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exerciseNotesTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  removeNotesBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  removeNotesBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.danger,
  },
  notesFieldGroup: {
    marginBottom: 8,
  },
  notesFieldLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  notesTextArea: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: colors.text,
    fontSize: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    height: 52,
    textAlignVertical: 'top',
  },
  videoUrlRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  videoUrlInput: {
    flex: 1,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: colors.text,
    fontSize: 11,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  videoPreviewBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  videoPreviewBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F87171',
  },

  // Sets Table & Set Row Card Styles
  setsTable: {
    marginTop: 4,
  },
  setRowCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  setTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  setNumberBadge: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 6,
  },
  setNumberText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.accent,
  },
  setTypeScroll: {
    flex: 1,
    marginRight: 6,
  },
  setTypeMiniChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: colors.backgroundSubtle,
    marginRight: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  setTypeMiniChipText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  setDeleteBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setDeleteBtnText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  setControlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'flex-end',
  },
  controlGroup: {
    flex: 1,
    minWidth: 110,
  },
  controlGroupLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  controlComboRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  controlNumericInput: {
    minWidth: 44,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 6,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  inputWithUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingRight: 6,
  },
  unitSuffix: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    marginLeft: 2,
  },
  bodyweightBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  bodyweightBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#34D399',
  },
  strippingConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 6,
    padding: 6,
    marginTop: 6,
    gap: 8,
  },
  strippingConfigLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.danger,
  },
  strippingInputCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  strippingMiniLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  strippingInput: {
    width: 38,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 2,
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  strippingPreviewCol: {
    flex: 1,
  },
  strippingPreviewText: {
    fontSize: 10,
    color: '#FCA5A5',
    fontWeight: '600',
    textAlign: 'right',
  },
  emptySetsNotice: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
  },
  emptySetsNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  exActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  addNotesBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  addNotesBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  addSetBtn: {
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
  },
  addSetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  addExerciseToBlockBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
    marginTop: 6,
  },
  addExerciseToBlockBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
  },

  // Four Buttons Grid
  addBlockSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  addBlockSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.accent,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  fourButtonsGrid: {
    gap: 10,
  },
  blockTypeBtn: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  btnSingle: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderColor: colors.borderLight,
  },
  btnSuperserie: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: '#3B82F6',
  },
  btnCircuitStd: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#F59E0B',
  },
  btnInterval: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
  },
  blockTypeBtnIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  blockTypeBtnTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 2,
  },
  blockTypeBtnDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  footerContainer: {
    marginTop: 18,
    marginBottom: 8,
    gap: 10,
  },
  footerEditTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerCreateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  updateRoutineBtn: {
    flex: 1.15,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateRoutineBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 12.5,
    letterSpacing: 0.3,
  },
  saveAsNewRoutineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1.5,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveAsNewRoutineBtnText: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 12.5,
    letterSpacing: 0.3,
  },
  saveRoutineFullBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveRoutineFullBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  deleteRoutineBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1.5,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteRoutineBtnText: {
    color: colors.danger,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.3,
  },

  // Picker Modal
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: colors.backgroundElevated,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    paddingHorizontal: 16,
  },
  pickerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  pickerSelectedCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginTop: 2,
  },
  pickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCloseBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  pickerSearchRow: {
    marginTop: 10,
    marginBottom: 8,
  },
  pickerSearchInput: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pickerMuscleScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  pickerMuscleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.backgroundSubtle,
    marginRight: 6,
  },
  pickerMuscleChipActive: {
    backgroundColor: colors.accent,
  },
  pickerMuscleChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pickerMuscleChipTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
  pickerExerciseList: {
    maxHeight: 360,
  },
  pickerItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerItemCardSelected: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderColor: colors.accent,
  },
  pickerItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  pickerItemSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pickerSelectBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pickerSelectBadgeText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 11,
  },
  pickerCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCheckboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pickerCheckmark: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  pickerFooterBar: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pickerConfirmBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerConfirmBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
});

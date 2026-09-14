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
import {
  ExerciseSet,
  SetType,
  WorkoutExercise,
  ExerciseType,
  BandAssistance,
  SetDropStep,
} from '../../types/workout';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Card } from '../../components/Card';
import { ImmersiveTimerOverlay } from '../../components/ImmersiveTimerOverlay';
import { CustomConfirmModal } from '../../components/CustomConfirmModal';
import { ToastFeedback, ToastType } from '../../components/ToastFeedback';
import { YouTubeModalOverlay } from '../../components/YouTubeModalOverlay';
import { BandSelectDropdown, BAND_OPTIONS } from '../../components/BandSelectDropdown';

type WorkoutModalRouteProp = RouteProp<RootStackParamList, 'WorkoutModal'>;

interface LiveSetState extends ExerciseSet {
  tempId: string;
  targetWeightKg: number;
  targetReps: number;
  targetTimeSeconds?: number | null;
}

interface LiveExerciseState {
  exerciseId: number;
  name: string;
  muscleGroup: string;
  exerciseType: ExerciseType;
  exerciseOrder: number;
  supersetGroup: string | null;
  restSeconds: number;
  description?: string | null;
  videoUrl?: string | null;
  sets: LiveSetState[];
}

export const WorkoutModal: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<WorkoutModalRouteProp>();
  const insets = useSafeAreaInsets();
  const {
    routines,
    exercises,
    saveWorkout,
    getLastPerformance,
    getPreviousPerformanceForExercise,
    calculateTotalVolume,
    calculateTotalTimeSeconds,
  } = useGym();

  const routineId = route.params?.routineId;
  const initialWeek = route.params?.weekNumber || 1;

  // Selected routine or fallback to first
  const selectedRoutine = routines.find((r) => r.id === routineId) || routines[0];
  const workoutName = selectedRoutine ? selectedRoutine.name : 'Sessione Libera';

  const [weekNumber, setWeekNumber] = useState(initialWeek);
  const [sessionNotes, setSessionNotes] = useState('');
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Accordion collapsed section/exercise indices
  const [collapsedSectionIdxs, setCollapsedSectionIdxs] = useState<Set<number>>(new Set());

  const toggleSectionCollapse = (secIdx: number) => {
    setCollapsedSectionIdxs((prev) => {
      const next = new Set(prev);
      if (next.has(secIdx)) {
        next.delete(secIdx);
      } else {
        next.add(secIdx);
      }
      return next;
    });
  };

  // YouTube Video Modal Overlay State
  const [activeVideoModal, setActiveVideoModal] = useState<{
    visible: boolean;
    url: string;
    name: string;
  }>({
    visible: false,
    url: '',
    name: '',
  });

  // Immersive Timer Overlay State
  const [timerOverlay, setTimerOverlay] = useState<{
    visible: boolean;
    seconds: number;
    exerciseName: string;
    setNumberText: string;
    targetSetCallback: () => void;
  }>({
    visible: false,
    seconds: 90,
    exerciseName: '',
    setNumberText: '',
    targetSetCallback: () => {},
  });

  // Confirm End Session Modal
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Toast Feedback
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

  // Live exercises and sets state
  const [liveExercises, setLiveExercises] = useState<LiveExerciseState[]>([]);

  // Initialize protected routine structure for execution
  useEffect(() => {
    if (selectedRoutine && selectedRoutine.exercises && selectedRoutine.exercises.length > 0) {
      const mapped: LiveExerciseState[] = selectedRoutine.exercises.map((re, idx) => {
        const fullExercise =
          re.exercise || exercises.find((e) => e.id === re.exercise_id);
        const name = fullExercise ? fullExercise.name : `Esercizio ${re.exercise_id}`;
        const muscleGroup = fullExercise ? fullExercise.muscle_group : 'Generale';
        const exerciseType: ExerciseType = fullExercise ? fullExercise.exercise_type : 'reps';
        const description = re.custom_description ?? fullExercise?.description ?? null;
        const videoUrl = re.custom_video_url ?? fullExercise?.video_url ?? null;

        const sets: LiveSetState[] = (re.sets || []).map((s, sIdx) => {
          let mappedDrops: SetDropStep[] | undefined = undefined;
          if (s.drops && s.drops.length > 0) {
            mappedDrops = s.drops.map((d) => ({
              id: d.id,
              kg: d.kg || 0,
              reps: d.reps || 8,
              rest_seconds: d.rest_seconds,
            }));
          } else if (s.set_type === 'dropset') {
            mappedDrops = [
              { id: `d1-${sIdx}`, kg: s.target_weight_kg || 0, reps: s.target_reps || 8 },
              { id: `d2-${sIdx}`, kg: s.dropset_weight_kg || 0, reps: s.target_reps || 8 },
            ];
          } else if (s.set_type === 'rest_pause') {
            mappedDrops = [
              { id: `rp1-${sIdx}`, kg: s.target_weight_kg || 0, reps: s.target_reps || 10, rest_seconds: 20 },
              { id: `rp2-${sIdx}`, kg: s.target_weight_kg || 0, reps: 4, rest_seconds: 20 },
            ];
          }

          return {
            tempId: `live-set-${re.exercise_id}-${sIdx + 1}-${Date.now()}`,
            set_number: s.set_number,
            set_type: s.set_type || 'normal',
            weight_kg: s.target_weight_kg || 0,
            reps: s.target_reps || (exerciseType === 'time' ? 0 : 10),
            time_seconds: s.target_time_seconds || (exerciseType === 'time' ? 60 : null),
            band_assistance: s.band_assistance || 'none',
            dropset_weight_kg: s.dropset_weight_kg || null,
            drops: mappedDrops,
            rest_seconds: s.rest_seconds || 90,
            targetWeightKg: s.target_weight_kg || 0,
            targetReps: s.target_reps || (exerciseType === 'time' ? 0 : 10),
            targetTimeSeconds: s.target_time_seconds || (exerciseType === 'time' ? 60 : null),
            completed: false,
          };
        });

        const defaultRest = sets.length > 0 ? sets[0].rest_seconds || 90 : 90;

        return {
          exerciseId: re.exercise_id,
          name,
          muscleGroup,
          exerciseType,
          exerciseOrder: idx + 1,
          supersetGroup: re.superset_group || null,
          restSeconds: defaultRest,
          description,
          videoUrl,
          sets,
        };
      });

      setLiveExercises(mapped);
    }
  }, [selectedRoutine, exercises]);

  // Comparison helpers for Target vs Previous Week / Session
  const getPreviousSetSummary = (
    exerciseId: number,
    setIdx: number,
    exerciseType: ExerciseType
  ): string => {
    const prevPerf = getPreviousPerformanceForExercise(exerciseId);
    if (!prevPerf || !prevPerf.sets || !prevPerf.sets[setIdx]) {
      return '--';
    }
    const s = prevPerf.sets[setIdx];
    if (exerciseType === 'time') {
      return `${s.time_seconds || 0}s`;
    }
    if (exerciseType === 'bodyweight') {
      const band = s.band_assistance;
      if (band === 'weighted') return `Zavorra +${s.weight_kg}kg × ${s.reps}`;
      if (band === 'light') return `Elastico bassa × ${s.reps}`;
      if (band === 'medium') return `Elastico media × ${s.reps}`;
      if (band === 'heavy') return `Elastico alta × ${s.reps}`;
      return `Corpo libero × ${s.reps}`;
    }
    if (s.drops && s.drops.length > 0) {
      return s.drops.map((d) => `${d.kg}kg×${d.reps}`).join('+');
    }
    return `${s.weight_kg}kg × ${s.reps}`;
  };

  const getTargetSetSummary = (
    set: LiveSetState,
    exerciseType: ExerciseType
  ): string => {
    if (exerciseType === 'time') {
      return `${set.targetTimeSeconds || 60}s`;
    }
    if (exerciseType === 'bodyweight') {
      const band = set.band_assistance;
      if (band === 'weighted') return `Zavorra +${set.targetWeightKg || 0}kg × ${set.targetReps}`;
      if (band === 'light') return `Elastico bassa × ${set.targetReps}`;
      if (band === 'medium') return `Elastico media × ${set.targetReps}`;
      if (band === 'heavy') return `Elastico alta × ${set.targetReps}`;
      return `Corpo libero × ${set.targetReps}`;
    }
    return `${set.targetWeightKg}kg × ${set.targetReps}`;
  };

  // Session Stopwatch
  useEffect(() => {
    const interval: ReturnType<typeof setInterval> = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatStopwatch = (totalSecs: number): string => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Live KPI Calculations
  const allSets = liveExercises.flatMap((e) =>
    e.sets.map((s) => ({
      ...s,
      exercise_type: e.exerciseType,
    }))
  );

  const completedSetsCount = allSets.filter((s) => s.completed).length;
  const totalVolumeKg = calculateTotalVolume(allSets);
  const totalTimeSecs = calculateTotalTimeSeconds(allSets);

  // Set Value Handlers
  const handleUpdateWeight = (exIdx: number, setIdx: number, val: string) => {
    const clean = val.replace(',', '.');
    const num = parseFloat(clean);
    const updated = [...liveExercises];
    updated[exIdx].sets[setIdx].weight_kg = isNaN(num) ? 0 : num;
    setLiveExercises(updated);
  };

  const handleUpdateReps = (exIdx: number, setIdx: number, val: string) => {
    const num = parseInt(val, 10);
    const updated = [...liveExercises];
    updated[exIdx].sets[setIdx].reps = isNaN(num) ? 0 : num;
    setLiveExercises(updated);
  };

  const handleUpdateTimeSeconds = (exIdx: number, setIdx: number, val: string) => {
    const num = parseInt(val, 10);
    const updated = [...liveExercises];
    updated[exIdx].sets[setIdx].time_seconds = isNaN(num) ? 0 : num;
    setLiveExercises(updated);
  };

  const handleUpdateDropKg = (exIdx: number, setIdx: number, dropIdx: number, val: string) => {
    const clean = val.replace(',', '.');
    const num = parseFloat(clean);
    const updated = [...liveExercises];
    if (updated[exIdx].sets[setIdx].drops) {
      updated[exIdx].sets[setIdx].drops![dropIdx].kg = isNaN(num) ? 0 : num;
    }
    setLiveExercises(updated);
  };

  const handleUpdateDropReps = (exIdx: number, setIdx: number, dropIdx: number, val: string) => {
    const num = parseInt(val, 10);
    const updated = [...liveExercises];
    if (updated[exIdx].sets[setIdx].drops) {
      updated[exIdx].sets[setIdx].drops![dropIdx].reps = isNaN(num) ? 0 : num;
    }
    setLiveExercises(updated);
  };

  const handleCycleBandAssistance = (exIdx: number, setIdx: number) => {
    const current = liveExercises[exIdx].sets[setIdx].band_assistance || 'none';
    const order: BandAssistance[] = ['none', 'weighted', 'light', 'medium', 'heavy'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    const updated = [...liveExercises];
    updated[exIdx].sets[setIdx].band_assistance = next;
    setLiveExercises(updated);
  };

  // Open Immersive Timer for a specific set (final inter-set rest)
  const handleOpenRestTimerForSet = (exIdx: number, setIdx: number) => {
    const targetSet = liveExercises[exIdx].sets[setIdx];
    const restSecs = targetSet.rest_seconds || liveExercises[exIdx].restSeconds || 90;
    const isSpecial = targetSet.set_type === 'dropset' || targetSet.set_type === 'rest_pause';

    setTimerOverlay({
      visible: true,
      seconds: restSecs,
      exerciseName: liveExercises[exIdx].name,
      setNumberText: isSpecial
        ? `Recupero Finale • Serie ${targetSet.set_number}`
        : `Serie ${targetSet.set_number}`,
      targetSetCallback: () => {
        // Auto-complete set on timer completion or skip!
        const updated = [...liveExercises];
        updated[exIdx].sets[setIdx].completed = true;
        setLiveExercises(updated);
        setTimerOverlay((prev) => ({ ...prev, visible: false }));
        showToast('success', `Serie ${targetSet.set_number} completata!`);
      },
    });
  };

  // Open Immersive Timer for an intra-set drop step (Stripping or Rest-Pause)
  const handleOpenIntraRestTimer = (exIdx: number, setIdx: number, dropIdx: number) => {
    const targetSet = liveExercises[exIdx].sets[setIdx];
    const drop = targetSet.drops ? targetSet.drops[dropIdx] : null;
    const isRestPause = targetSet.set_type === 'rest_pause';
    const intraSecs = (drop && drop.rest_seconds !== undefined) ? drop.rest_seconds : (isRestPause ? 10 : 0);

    if (intraSecs <= 0) {
      showToast('info', 'Pausa intra-serie impostata a 0s (cambio carico immediato).');
      return;
    }

    setTimerOverlay({
      visible: true,
      seconds: intraSecs,
      exerciseName: `${liveExercises[exIdx].name} (Step ${dropIdx + 1} → ${dropIdx + 2})`,
      setNumberText: `${isRestPause ? 'Pausa Rest-Pause' : 'Pausa Stripping'} • Serie ${targetSet.set_number}`,
      targetSetCallback: () => {
        setTimerOverlay((prev) => ({ ...prev, visible: false }));
        showToast('success', `Pausa conclusa! Procedi con lo Step ${dropIdx + 2}`);
      },
    });
  };

  // Open Immersive Timer for a Super Serie Round
  const handleOpenRestTimerForSupersetRound = (
    supersetGroup: string,
    roundIdx: number,
    groupExIndices: number[]
  ) => {
    // Find rest time from the first exercise of the superset
    const firstEx = liveExercises[groupExIndices[0]];
    const restSecs =
      (firstEx.sets[roundIdx] && firstEx.sets[roundIdx].rest_seconds) ||
      firstEx.restSeconds ||
      90;

    setTimerOverlay({
      visible: true,
      seconds: restSecs,
      exerciseName: `Super Serie ${supersetGroup}`,
      setNumberText: `Round ${roundIdx + 1}`,
      targetSetCallback: () => {
        // Auto-complete all sets of this round across the superset exercises!
        const updated = [...liveExercises];
        groupExIndices.forEach((exIdx) => {
          if (updated[exIdx].sets[roundIdx]) {
            updated[exIdx].sets[roundIdx].completed = true;
          }
        });
        setLiveExercises(updated);
        setTimerOverlay((prev) => ({ ...prev, visible: false }));
        showToast('success', `Round ${roundIdx + 1} Super Serie ${supersetGroup} completato!`);
      },
    });
  };

  const handleToggleComplete = (exIdx: number, setIdx: number) => {
    const targetSet = liveExercises[exIdx].sets[setIdx];
    const isNowCompleted = !targetSet.completed;

    const updated = [...liveExercises];
    updated[exIdx].sets[setIdx].completed = isNowCompleted;
    setLiveExercises(updated);

    if (isNowCompleted) {
      handleOpenRestTimerForSet(exIdx, setIdx);
    }
  };

  // Conclude & Save Session to History
  const handleConfirmSaveSession = async () => {
    setShowSaveConfirm(false);
    if (completedSetsCount === 0) {
      showToast('error', 'Spunta almeno una serie come completata prima di salvare la sessione.');
      return;
    }

    const durationMins = Math.max(1, Math.round(secondsElapsed / 60));
    const today = new Date().toISOString().split('T')[0];

    const mappedExercises: WorkoutExercise[] = liveExercises.map((e, idx) => ({
      exercise_id: e.exerciseId,
      exercise_order: idx + 1,
      superset_group: e.supersetGroup,
      sets: e.sets.map((s) => ({
        set_number: s.set_number,
        set_type: s.set_type,
        weight_kg: s.weight_kg,
        reps: s.reps,
        time_seconds: s.time_seconds,
        band_assistance: s.band_assistance,
        dropset_weight_kg: s.dropset_weight_kg,
        drops: s.drops,
        completed: s.completed,
      })),
    }));

    try {
      await saveWorkout({
        name: workoutName,
        date: today,
        duration_minutes: durationMins,
        routine_id: selectedRoutine ? selectedRoutine.id : null,
        week_number: weekNumber,
        notes: sessionNotes.trim() || null,
        exercises: mappedExercises,
      });

      let summaryMsg = `Tonnellaggio registrato: ${totalVolumeKg.toLocaleString()} kg in ${durationMins} min.`;
      if (totalTimeSecs > 0) {
        summaryMsg += ` Tempo isometrico: ${totalTimeSecs}s.`;
      }

      showToast('success', `Sessione registrata con successo! ${summaryMsg}`);
      setTimeout(() => navigation.goBack(), 900);
    } catch (err: any) {
      showToast('error', err?.message || 'Impossibile salvare la sessione.');
    }
  };

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

  const getBandLabel = (band: BandAssistance) => {
    switch (band) {
      case 'heavy':
        return 'Elastico tensione alta';
      case 'medium':
        return 'Elastico tensione media';
      case 'light':
        return 'Elastico tensione bassa';
      case 'none':
        return 'Corpo libero';
      case 'weighted':
        return 'Zavorra';
      default:
        return 'Corpo libero';
    }
  };

  // Separate Standalone Exercises vs Superset Groups
  // We collect items in appearance order
  interface DisplaySection {
    type: 'standalone' | 'superset';
    supersetGroup?: string;
    exerciseIndices: number[];
  }

  const sections: DisplaySection[] = [];
  const handledIndices = new Set<number>();

  liveExercises.forEach((ex, idx) => {
    if (handledIndices.has(idx)) return;

    if (!ex.supersetGroup) {
      sections.push({
        type: 'standalone',
        exerciseIndices: [idx],
      });
      handledIndices.add(idx);
    } else {
      const group = ex.supersetGroup;
      const groupIndices: number[] = [];
      liveExercises.forEach((otherEx, oIdx) => {
        if (otherEx.supersetGroup === group) {
          groupIndices.push(oIdx);
          handledIndices.add(oIdx);
        }
      });
      sections.push({
        type: 'superset',
        supersetGroup: group,
        exerciseIndices: groupIndices,
      });
    }
  });

  return (
    <View style={styles.container}>
      {/* Toast Feedback */}
      <ToastFeedback
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      {/* Immersive Fullscreen Timer Overlay */}
      <ImmersiveTimerOverlay
        visible={timerOverlay.visible}
        initialSeconds={timerOverlay.seconds}
        exerciseName={timerOverlay.exerciseName}
        setNumberText={timerOverlay.setNumberText}
        onComplete={timerOverlay.targetSetCallback}
        onDismiss={() => setTimerOverlay((prev) => ({ ...prev, visible: false }))}
      />

      {/* Top Header */}
      <View style={styles.modalHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.protectedRow}>
            <Text style={styles.protectedBadge}>🔒 MODALITÀ SOLA ESECUZIONE</Text>
          </View>
          <Text style={typography.h2} numberOfLines={1}>
            {workoutName}
          </Text>
        </View>
        <Pressable
          onPress={() => setShowDiscardConfirm(true)}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Chiudi live logger"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      {/* Real-time KPI Bar */}
      <View style={styles.kpiBar}>
        <View style={styles.kpiItem}>
          <Text style={styles.kpiBarLabel}>DURATA</Text>
          <Text style={styles.kpiBarValue}>{formatStopwatch(secondsElapsed)}</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={styles.kpiBarLabel}>VOLUME TONN</Text>
          <Text style={[styles.kpiBarValue, { color: colors.volume }]}>
            {totalVolumeKg.toLocaleString()} kg
          </Text>
        </View>
        {totalTimeSecs > 0 && (
          <>
            <View style={styles.kpiDivider} />
            <View style={styles.kpiItem}>
              <Text style={styles.kpiBarLabel}>ISOMETRIA</Text>
              <Text style={[styles.kpiBarValue, { color: colors.emerald }]}>
                {totalTimeSecs}s
              </Text>
            </View>
          </>
        )}
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={styles.kpiBarLabel}>SERIE CHIUSE</Text>
          <Text style={[styles.kpiBarValue, { color: colors.emerald }]}>
            {completedSetsCount}/{allSets.length}
          </Text>
        </View>
      </View>

      {/* Execution Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section, secIdx) => {
          // --- CASE 1: SUPER SERIE GROUP (ALTERNATING ROUND BY ROUND) ---
          if (section.type === 'superset' && section.supersetGroup) {
            const groupExs = section.exerciseIndices.map((i) => ({
              idx: i,
              ex: liveExercises[i],
            }));
            const maxRounds = Math.max(...groupExs.map((g) => g.ex.sets.length), 0);

            return (
              <Card key={`ss-section-${section.supersetGroup}-${secIdx}`} style={styles.supersetSectionCard}>
                {/* Superset Block Header */}
                <View style={styles.supersetBlockHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.supersetTagBadge}>
                      <Text style={styles.supersetTagBadgeText}>
                        ⚡ SUPER SERIE {section.supersetGroup}
                      </Text>
                    </View>
                    <Text style={typography.h3}>
                      {groupExs.map((g) => g.ex.name).join(' + ')}
                    </Text>
                    <Text style={typography.caption}>
                      Esecuzione alternata round per round • Recupero post Super Serie
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => toggleSectionCollapse(secIdx)}
                    style={styles.collapseBtn}
                    accessibilityRole="button"
                    accessibilityLabel={collapsedSectionIdxs.has(secIdx) ? "Espandi super serie" : "Riduci super serie"}
                  >
                    <Text style={styles.collapseBtnText}>
                      {collapsedSectionIdxs.has(secIdx) ? '▼ Espandi' : '▲ Riduci'}
                    </Text>
                  </Pressable>
                </View>

                {collapsedSectionIdxs.has(secIdx) ? (
                  <Pressable
                    onPress={() => toggleSectionCollapse(secIdx)}
                    style={styles.collapsedSummaryRow}
                  >
                    <Text style={styles.collapsedSummaryText}>
                      ⚡ Super Serie {section.supersetGroup} • {groupExs.map((g) => g.ex.name).join(' + ')} • Tocca per espandere
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    {/* Rounds Loop (Round 1, Round 2, ...) */}
                    {Array.from({ length: maxRounds }).map((_, roundIdx) => {
                      const roundNumber = roundIdx + 1;
                      const allRoundSetsCompleted = groupExs.every((g) => {
                        const s = g.ex.sets[roundIdx];
                        return !s || s.completed;
                      });

                      return (
                        <View
                          key={`ss-round-${roundIdx}`}
                          style={[
                            styles.supersetRoundContainer,
                            allRoundSetsCompleted && styles.supersetRoundCompleted,
                          ]}
                        >
                          <View style={styles.roundHeaderRow}>
                            <Text style={styles.roundTitle}>ROUND {roundNumber}</Text>
                            <Text style={styles.roundSubtitle}>
                              {allRoundSetsCompleted ? '✓ COMPLETATO' : 'IN CORSO'}
                            </Text>
                          </View>

                          {/* Each Exercise in this round */}
                          {groupExs.map(({ idx: exIdx, ex }) => {
                            const set = ex.sets[roundIdx];
                            if (!set) return null;
                            const bStyle = getBadgeStyle(set.set_type);

                            return (
                              <View key={`ss-ex-${ex.exerciseId}-s-${roundIdx}`} style={styles.supersetExRow}>
                                <View style={styles.supersetExHeader}>
                                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.supersetExName} numberOfLines={1}>
                                      {ex.name}
                                    </Text>
                                    {Boolean(ex.videoUrl?.trim()) && (
                                      <Pressable
                                        onPress={() =>
                                          setActiveVideoModal({
                                            visible: true,
                                            url: ex.videoUrl!.trim(),
                                            name: ex.name,
                                          })
                                        }
                                        style={styles.videoHeaderBtnMini}
                                      >
                                        <Text style={styles.videoHeaderBtnMiniText}>🎬 Video</Text>
                                      </Pressable>
                                    )}
                                  </View>
                                  <View style={[styles.setTypeBadgeSmall, { backgroundColor: bStyle.bg }]}>
                                    <Text style={[styles.setTypeBadgeSmallText, { color: bStyle.text }]}>
                                      {bStyle.label}
                                    </Text>
                                  </View>
                                </View>

                                {/* Dual Comparison Badge: Target vs Prec */}
                                <View style={styles.targetVsPrevRow}>
                                  <Text style={styles.targetVsPrevBadgeTarget}>
                                    🎯 Target: {getTargetSetSummary(set, ex.exerciseType)}
                                  </Text>
                                  <Text style={styles.targetVsPrevBadgePrev}>
                                    📈 Prec: {getPreviousSetSummary(ex.exerciseId, roundIdx, ex.exerciseType)}
                                  </Text>
                                </View>

                                {/* Set Inputs */}
                                <View style={styles.setMainRow}>
                                  {ex.exerciseType === 'reps' && (
                                    <View style={styles.inputsRow}>
                                      <View style={styles.inputCol}>
                                        <TextInput
                                          style={[
                                            styles.inputBox,
                                            set.completed && styles.inputBoxCompleted,
                                          ]}
                                          keyboardType="decimal-pad"
                                          value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                          onChangeText={(val) => handleUpdateWeight(exIdx, roundIdx, val)}
                                          placeholder="0"
                                          placeholderTextColor={colors.textMuted}
                                        />
                                        <Text style={styles.inputSubLabel}>kg</Text>
                                      </View>

                                      <View style={styles.inputCol}>
                                        <TextInput
                                          style={[
                                            styles.inputBox,
                                            set.completed && styles.inputBoxCompleted,
                                          ]}
                                          keyboardType="numeric"
                                          value={set.reps === 0 ? '' : String(set.reps)}
                                          onChangeText={(val) => handleUpdateReps(exIdx, roundIdx, val)}
                                          placeholder="0"
                                          placeholderTextColor={colors.textMuted}
                                        />
                                        <Text style={styles.inputSubLabel}>reps</Text>
                                      </View>
                                    </View>
                                  )}

                                  {ex.exerciseType === 'time' && (
                                    <View style={styles.inputsRow}>
                                      <View style={[styles.inputCol, { flex: 2 }]}>
                                        <View style={styles.timeInputRow}>
                                          <Pressable
                                            onPress={() => {
                                              const cur = set.time_seconds || 60;
                                              handleUpdateTimeSeconds(exIdx, roundIdx, String(Math.max(5, cur - 5)));
                                            }}
                                            style={styles.stepBtn}
                                          >
                                            <Text style={styles.stepBtnText}>-5s</Text>
                                          </Pressable>

                                          <TextInput
                                            style={[
                                              styles.inputBox,
                                              styles.timeInputBox,
                                              set.completed && styles.inputBoxCompleted,
                                            ]}
                                            keyboardType="numeric"
                                            value={String(set.time_seconds || 60)}
                                            onChangeText={(val) => handleUpdateTimeSeconds(exIdx, roundIdx, val)}
                                            placeholder="60"
                                            placeholderTextColor={colors.textMuted}
                                          />

                                          <Pressable
                                            onPress={() => {
                                              const cur = set.time_seconds || 60;
                                              handleUpdateTimeSeconds(exIdx, roundIdx, String(cur + 5));
                                            }}
                                            style={styles.stepBtn}
                                          >
                                            <Text style={styles.stepBtnText}>+5s</Text>
                                          </Pressable>
                                        </View>
                                        <Text style={styles.inputSubLabel}>
                                          secondi
                                        </Text>
                                      </View>
                                    </View>
                                  )}

                                   {ex.exerciseType === 'bodyweight' && (
                                     <View style={styles.inputsRow}>
                                       <View style={{ flex: 1, minWidth: 150, marginRight: 6 }}>
                                         <BandSelectDropdown
                                           compact
                                           disabled={set.completed}
                                           value={set.band_assistance || 'none'}
                                           onChange={(val) => {
                                             const updated = [...liveExercises];
                                             updated[exIdx].sets[roundIdx].band_assistance = val;
                                             setLiveExercises(updated);
                                           }}
                                         />
                                         <Text style={styles.inputSubLabel}>modalità</Text>
                                       </View>

                                       {set.band_assistance === 'weighted' && (
                                         <View style={[styles.inputCol, { width: 68, marginRight: 6 }]}>
                                           <TextInput
                                             style={[
                                               styles.inputBox,
                                               set.completed && styles.inputBoxCompleted,
                                             ]}
                                             keyboardType="decimal-pad"
                                             editable={!set.completed}
                                             value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                             onChangeText={(val) => handleUpdateWeight(exIdx, roundIdx, val)}
                                             placeholder="+0"
                                             placeholderTextColor={colors.textMuted}
                                           />
                                           <Text style={styles.inputSubLabel}>+kg zavorra</Text>
                                         </View>
                                       )}

                                       <View style={[styles.inputCol, { width: 56 }]}>
                                         <TextInput
                                           style={[
                                             styles.inputBox,
                                             set.completed && styles.inputBoxCompleted,
                                           ]}
                                           keyboardType="numeric"
                                           editable={!set.completed}
                                           value={set.reps === 0 ? '' : String(set.reps)}
                                           onChangeText={(val) => handleUpdateReps(exIdx, roundIdx, val)}
                                           placeholder="0"
                                           placeholderTextColor={colors.textMuted}
                                         />
                                         <Text style={styles.inputSubLabel}>reps</Text>
                                       </View>
                                     </View>
                                   )}

                                  {/* Single Set Checkbox */}
                                  <Pressable
                                    onPress={() => {
                                      const updated = [...liveExercises];
                                      updated[exIdx].sets[roundIdx].completed = !set.completed;
                                      setLiveExercises(updated);
                                    }}
                                    style={[
                                      styles.checkboxBtn,
                                      set.completed && styles.checkboxBtnChecked,
                                    ]}
                                  >
                                    {set.completed && <Text style={styles.checkmarkText}>✓</Text>}
                                  </Pressable>
                                </View>
                              </View>
                            );
                          })}

                          {/* Post-Superset Recovery Row with Timer Overlay Trigger */}
                          <View style={styles.supersetRecoveryRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.recLabel}>RECUPERO SUPER SERIE</Text>
                              <Text style={styles.recTargetText}>
                                Target: {groupExs[0].ex.restSeconds}s
                              </Text>
                            </View>

                            <Pressable
                              onPress={() =>
                                handleOpenRestTimerForSupersetRound(
                                  section.supersetGroup!,
                                  roundIdx,
                                  section.exerciseIndices
                                )
                              }
                              style={styles.actionTimerBtn}
                            >
                              <Text style={styles.actionTimerBtnText}>
                                ⏱ {groupExs[0].ex.restSeconds}s REC.
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}
              </Card>
            );
          }

          // --- CASE 2: STANDALONE EXERCISE ---
          const exIdx = section.exerciseIndices[0];
          const exercise = liveExercises[exIdx];
          const lastPerf = getLastPerformance(exercise.exerciseId);

          return (
            <Card key={`standalone-ex-${exercise.exerciseId}-${secIdx}`} style={styles.exerciseCard}>
              {/* Exercise Header */}
              <View style={styles.exerciseCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h3}>
                    {exercise.exerciseOrder}. {exercise.name}
                  </Text>
                  <Text style={typography.caption}>
                    {exercise.muscleGroup} • Tipo:{' '}
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>
                      {exercise.exerciseType === 'reps'
                        ? 'CARICO + REPS'
                        : exercise.exerciseType === 'time'
                        ? 'ISOMETRIA'
                        : 'CORPO LIBERO'}
                    </Text>
                  </Text>
                </View>

                <View style={styles.exHeaderActions}>
                  {Boolean(exercise.videoUrl?.trim()) && (
                    <Pressable
                      onPress={() =>
                        setActiveVideoModal({
                          visible: true,
                          url: exercise.videoUrl!.trim(),
                          name: exercise.name,
                        })
                      }
                      style={styles.videoHeaderBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Guarda video esercizio"
                    >
                      <Text style={styles.videoHeaderBtnText}>🎬 Video</Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={() => toggleSectionCollapse(secIdx)}
                    style={styles.collapseBtn}
                    accessibilityRole="button"
                    accessibilityLabel={collapsedSectionIdxs.has(secIdx) ? "Espandi esercizio" : "Riduci esercizio"}
                  >
                    <Text style={styles.collapseBtnText}>
                      {collapsedSectionIdxs.has(secIdx) ? '▼ Espandi' : '▲ Riduci'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Technical Description if available */}
              {Boolean(exercise.description?.trim()) && (
                <View style={styles.exDescContainer}>
                  <Text style={styles.exDescText}>📋 {exercise.description}</Text>
                </View>
              )}

              {/* Progressive Overload / Reference Load */}
              {lastPerf && (
                <View style={styles.overloadBox}>
                  <Text style={styles.overloadText}>
                    💡 Storico ({lastPerf.date}): Max {lastPerf.maxWeightKg} kg ({lastPerf.setsSummary})
                  </Text>
                </View>
              )}

              {collapsedSectionIdxs.has(secIdx) ? (
                <Pressable
                  onPress={() => toggleSectionCollapse(secIdx)}
                  style={styles.collapsedSummaryRow}
                >
                  <Text style={styles.collapsedSummaryText}>
                    📦 {exercise.sets.filter((s) => s.completed).length}/{exercise.sets.length} serie completate • Tocca per espandere
                  </Text>
                </Pressable>
              ) : (
                <>
                  {/* Table Column Header */}
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.colHeader, { width: 34 }]}>SET</Text>
                    <Text style={[styles.colHeader, { width: 78 }]}>TIPO</Text>
                    <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>
                      {exercise.exerciseType === 'time'
                        ? 'DURATA EFFETTIVA'
                        : 'CARICO EFFETTIVO & REPS'}
                    </Text>
                    <Text style={[styles.colHeader, { width: 56, textAlign: 'center' }]}>FATTA</Text>
                  </View>

                  {/* Execution Set Rows */}
                  {exercise.sets.map((set, setIdx) => {
                    const bStyle = getBadgeStyle(set.set_type);

                    return (
                      <View
                        key={set.tempId || `live-s-${setIdx}`}
                        style={[
                          styles.setRowBlock,
                          set.completed && styles.setRowBlockCompleted,
                        ]}
                      >
                        {/* Dual Comparison Badge: Target vs Prec */}
                        <View style={styles.targetVsPrevRow}>
                          <Text style={styles.targetVsPrevBadgeTarget}>
                            🎯 Target: {getTargetSetSummary(set, exercise.exerciseType)}
                          </Text>
                          <Text style={styles.targetVsPrevBadgePrev}>
                            📈 Prec: {getPreviousSetSummary(exercise.exerciseId, setIdx, exercise.exerciseType)}
                          </Text>
                        </View>

                        <View style={styles.setMainRow}>
                          {/* Set Number */}
                          <Text style={styles.setNumText}>S{set.set_number}</Text>

                          {/* Set Type Badge */}
                          <View style={[styles.setTypeBadge, { backgroundColor: bStyle.bg }]}>
                            <Text style={[styles.setTypeBadgeText, { color: bStyle.text }]}>
                              {bStyle.label}
                            </Text>
                          </View>

                          {/* Polymorphic Inputs */}
                          {exercise.exerciseType === 'reps' && (
                            <View style={styles.inputsRow}>
                              <View style={styles.inputCol}>
                                <TextInput
                                  style={[
                                    styles.inputBox,
                                    set.completed && styles.inputBoxCompleted,
                                  ]}
                                  keyboardType="decimal-pad"
                                  value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                  onChangeText={(val) => handleUpdateWeight(exIdx, setIdx, val)}
                                  placeholder="0"
                                  placeholderTextColor={colors.textMuted}
                                />
                                <Text style={styles.inputSubLabel}>kg</Text>
                              </View>

                              <View style={styles.inputCol}>
                                <TextInput
                                  style={[
                                    styles.inputBox,
                                    set.completed && styles.inputBoxCompleted,
                                  ]}
                                  keyboardType="numeric"
                                  value={set.reps === 0 ? '' : String(set.reps)}
                                  onChangeText={(val) => handleUpdateReps(exIdx, setIdx, val)}
                                  placeholder="0"
                                  placeholderTextColor={colors.textMuted}
                                />
                                <Text style={styles.inputSubLabel}>reps</Text>
                              </View>
                            </View>
                          )}

                          {exercise.exerciseType === 'time' && (
                            <View style={styles.inputsRow}>
                              <View style={[styles.inputCol, { flex: 2 }]}>
                                <View style={styles.timeInputRow}>
                                  <Pressable
                                    onPress={() => {
                                      const cur = set.time_seconds || 60;
                                      handleUpdateTimeSeconds(exIdx, setIdx, String(Math.max(5, cur - 5)));
                                    }}
                                    style={styles.stepBtn}
                                  >
                                    <Text style={styles.stepBtnText}>-5s</Text>
                                  </Pressable>

                                  <TextInput
                                    style={[
                                      styles.inputBox,
                                      styles.timeInputBox,
                                      set.completed && styles.inputBoxCompleted,
                                    ]}
                                    keyboardType="numeric"
                                    value={String(set.time_seconds || 60)}
                                    onChangeText={(val) => handleUpdateTimeSeconds(exIdx, setIdx, val)}
                                    placeholder="60"
                                    placeholderTextColor={colors.textMuted}
                                  />

                                  <Pressable
                                    onPress={() => {
                                      const cur = set.time_seconds || 60;
                                      handleUpdateTimeSeconds(exIdx, setIdx, String(cur + 5));
                                    }}
                                    style={styles.stepBtn}
                                  >
                                    <Text style={styles.stepBtnText}>+5s</Text>
                                  </Pressable>
                                </View>
                                <Text style={styles.inputSubLabel}>
                                  secondi
                                </Text>
                              </View>
                            </View>
                          )}

                          {exercise.exerciseType === 'bodyweight' && (
                            <View style={styles.inputsRow}>
                              <View style={{ flex: 1, minWidth: 150, marginRight: 6 }}>
                                <BandSelectDropdown
                                  compact
                                  disabled={set.completed}
                                  value={set.band_assistance || 'none'}
                                  onChange={(val) => {
                                    const updated = [...liveExercises];
                                    updated[exIdx].sets[setIdx].band_assistance = val;
                                    setLiveExercises(updated);
                                  }}
                                />
                                <Text style={styles.inputSubLabel}>modalità</Text>
                              </View>

                              {set.band_assistance === 'weighted' && (
                                <View style={[styles.inputCol, { width: 68, marginRight: 6 }]}>
                                  <TextInput
                                    style={[
                                      styles.inputBox,
                                      set.completed && styles.inputBoxCompleted,
                                    ]}
                                    keyboardType="decimal-pad"
                                    editable={!set.completed}
                                    value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                    onChangeText={(val) => handleUpdateWeight(exIdx, setIdx, val)}
                                    placeholder="+0"
                                    placeholderTextColor={colors.textMuted}
                                  />
                                  <Text style={styles.inputSubLabel}>+kg zavorra</Text>
                                </View>
                              )}

                              <View style={[styles.inputCol, { width: 56 }]}>
                                <TextInput
                                  style={[
                                    styles.inputBox,
                                    set.completed && styles.inputBoxCompleted,
                                  ]}
                                  keyboardType="numeric"
                                  editable={!set.completed}
                                  value={set.reps === 0 ? '' : String(set.reps)}
                                  onChangeText={(val) => handleUpdateReps(exIdx, setIdx, val)}
                                  placeholder="0"
                                  placeholderTextColor={colors.textMuted}
                                />
                                <Text style={styles.inputSubLabel}>reps</Text>
                              </View>
                            </View>
                          )}

                          {/* Action Column: Checkbox + 'rec.' and Rest Seconds Button */}
                          <View style={styles.actionColumn}>
                            <Pressable
                              onPress={() => handleToggleComplete(exIdx, setIdx)}
                              style={[
                                styles.checkboxBtn,
                                set.completed && styles.checkboxBtnChecked,
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="Segna serie come completata"
                            >
                              {set.completed && <Text style={styles.checkmarkText}>✓</Text>}
                            </Pressable>

                            <Text style={styles.actionRecLabel}>rec.</Text>
                            <Pressable
                              onPress={() => handleOpenRestTimerForSet(exIdx, setIdx)}
                              style={styles.actionRecBtn}
                            >
                              <Text style={styles.actionRecBtnText}>
                                {set.rest_seconds || 90}s
                              </Text>
                            </Pressable>
                          </View>
                        </View>

                        {/* Dynamic Drops Rows for Stripping & Rest-Pause */}
                        {(set.set_type === 'dropset' || set.set_type === 'rest_pause') &&
                          set.drops &&
                          set.drops.length > 0 && (
                            <View style={styles.liveDropsContainer}>
                              <View style={styles.liveDropsHeaderRow}>
                                <Text style={styles.liveDropsTitle}>
                                  {set.set_type === 'dropset' ? '⚡ DROP STRIPPING EFFETTIVI:' : '⏱ REST-PAUSE EFFETTIVI:'}
                                </Text>
                                <Text style={styles.liveDropsSubtitle}>
                                  Rec. finale serie: {set.rest_seconds || 90}s
                                </Text>
                              </View>
                              {set.drops.map((drop, dIdx) => {
                                const isLastDrop = dIdx === (set.drops?.length || 0) - 1;
                                const intraSecs =
                                  drop.rest_seconds !== undefined
                                    ? drop.rest_seconds
                                    : set.set_type === 'rest_pause'
                                    ? 10
                                    : 0;

                                return (
                                  <View key={drop.id || `drop-${dIdx}`} style={styles.liveDropStepRow}>
                                    <Text style={styles.liveDropBadge}>Step {dIdx + 1}</Text>
                                    <View style={styles.liveDropInputCol}>
                                      <TextInput
                                        style={[
                                          styles.inputBox,
                                          set.completed && styles.inputBoxCompleted,
                                        ]}
                                        keyboardType="decimal-pad"
                                        editable={!set.completed}
                                        value={drop.kg === 0 ? '' : String(drop.kg)}
                                        onChangeText={(val) => handleUpdateDropKg(exIdx, setIdx, dIdx, val)}
                                        placeholder="0"
                                        placeholderTextColor={colors.textMuted}
                                      />
                                      <Text style={styles.inputSubLabel}>kg</Text>
                                    </View>
                                    <View style={styles.liveDropInputCol}>
                                      <TextInput
                                        style={[
                                          styles.inputBox,
                                          set.completed && styles.inputBoxCompleted,
                                        ]}
                                        keyboardType="numeric"
                                        editable={!set.completed}
                                        value={drop.reps === 0 ? '' : String(drop.reps)}
                                        onChangeText={(val) => handleUpdateDropReps(exIdx, setIdx, dIdx, val)}
                                        placeholder="0"
                                        placeholderTextColor={colors.textMuted}
                                      />
                                      <Text style={styles.inputSubLabel}>reps</Text>
                                    </View>

                                    {/* Intra-rest button between steps */}
                                    {!isLastDrop ? (
                                      <Pressable
                                        onPress={() => handleOpenIntraRestTimer(exIdx, setIdx, dIdx)}
                                        style={[
                                          styles.liveIntraRestBtn,
                                          intraSecs === 0 && styles.liveIntraRestBtnZero,
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Avvia pausa intra serie di ${intraSecs} secondi`}
                                      >
                                        <Text style={styles.liveIntraRestBtnText}>
                                          ⏱ {intraSecs}s
                                        </Text>
                                      </Pressable>
                                    ) : (
                                      <View style={styles.liveLastDropBadge}>
                                        <Text style={styles.liveLastDropBadgeText}>FINE STEP</Text>
                                      </View>
                                    )}
                                  </View>
                                );
                              })}
                            </View>
                          )}
                      </View>
                    );
                  })}
                </>
              )}
            </Card>
          );
        })}

        {/* Optional Session Feedback Note */}
        <Card style={styles.notesCard}>
          <Text style={typography.label}>NOTE SESSIONE & SENSAZIONI</Text>
          <TextInput
            style={[styles.notesInput]}
            value={sessionNotes}
            onChangeText={setSessionNotes}
            placeholder="Feedback sull'energia, carichi aumentati, RPE percepito..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={2}
          />
        </Card>
      </ScrollView>

      {/* Confirmation Modals */}
      <CustomConfirmModal
        visible={showSaveConfirm}
        title="Concludi e Salva Sessione"
        message={`Confermi di voler registrare l'allenamento nello storico? Tonnellaggio calcolato: ${totalVolumeKg.toLocaleString()} kg (${completedSetsCount} serie completate).`}
        confirmText="Salva Sessione"
        onConfirm={handleConfirmSaveSession}
        onCancel={() => setShowSaveConfirm(false)}
      />

      <CustomConfirmModal
        visible={showDiscardConfirm}
        title="Interrompi Allenamento"
        message="Sei sicuro di voler uscire dal Live Logger? I dati non salvati di questa sessione andranno persi."
        confirmText="Esci senza Salvare"
        isDestructive
        onConfirm={() => {
          setShowDiscardConfirm(false);
          navigation.goBack();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />

      {/* Footer Conclude Session */}
      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <Pressable
          onPress={() => setShowSaveConfirm(true)}
          style={({ pressed }) => [
            styles.saveSessionBtn,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Salva e termina sessione"
        >
          <Text style={styles.saveSessionBtnText}>
            ✓ SALVA & CONCLUDI ({totalVolumeKg.toLocaleString()} KG)
          </Text>
        </Pressable>
      </View>

      <YouTubeModalOverlay
        visible={activeVideoModal.visible}
        videoUrl={activeVideoModal.url}
        exerciseName={activeVideoModal.name}
        onClose={() => setActiveVideoModal((prev) => ({ ...prev, visible: false }))}
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
  protectedRow: {
    marginBottom: 2,
  },
  protectedBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.emerald,
    letterSpacing: 0.5,
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
  kpiBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  kpiItem: {
    alignItems: 'center',
  },
  kpiDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  kpiBarLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  kpiBarValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  supersetSectionCard: {
    marginBottom: 16,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  supersetBlockHeader: {
    marginBottom: 12,
  },
  supersetTagBadge: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  supersetTagBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  supersetRoundContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: layout.borderRadiusMd,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
    padding: 12,
    marginBottom: 12,
  },
  supersetRoundCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  roundHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.3)',
    paddingBottom: 4,
  },
  roundTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  roundSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  supersetExRow: {
    marginBottom: 10,
  },
  supersetExHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  supersetExName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  setTypeBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginLeft: 6,
  },
  setTypeBadgeSmallText: {
    fontSize: 9,
    fontWeight: '800',
  },
  supersetRecoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.3)',
  },
  recLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
  },
  recTargetText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  actionTimerBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: layout.borderRadiusSm,
  },
  actionTimerBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  exerciseCard: {
    marginBottom: 16,
    padding: 14,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  overloadBox: {
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    padding: 8,
    borderRadius: layout.borderRadiusSm,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    marginVertical: 6,
  },
  overloadText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: 6,
  },
  colHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  setRowBlock: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.4)',
  },
  setRowBlockCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderRadius: 6,
  },
  setMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setNumText: {
    width: 32,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  setTypeBadge: {
    width: 74,
    height: 28,
    borderRadius: layout.borderRadiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  setTypeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  inputsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputCol: {
    flex: 1,
  },
  inputBox: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusSm,
    paddingVertical: 6,
    paddingHorizontal: 8,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  inputBoxCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: colors.emerald,
  },
  inputSubLabel: {
    fontSize: 8,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '600',
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  timeInputBox: {
    minWidth: 50,
  },
  stepBtn: {
    backgroundColor: colors.backgroundSubtle,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
  },
  stepBtnText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  bandCycleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 4,
    maxWidth: 90,
  },
  bandCycleText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  actionColumn: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  checkboxBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxBtnChecked: {
    borderColor: colors.emerald,
    backgroundColor: colors.emerald,
  },
  checkmarkText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  actionRecLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  actionRecBtn: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginTop: 1,
  },
  actionRecBtnText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  liveDropsContainer: {
    marginTop: 6,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: colors.danger,
  },
  liveDropsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  liveDropsTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.danger,
  },
  liveDropsSubtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
  },
  liveDropStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  liveDropBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    width: 44,
  },
  liveDropInputCol: {
    flex: 1,
  },
  liveIntraRestBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(14, 165, 233, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveIntraRestBtnZero: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  liveIntraRestBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
  },
  liveLastDropBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveLastDropBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  notesCard: {
    padding: 14,
    marginBottom: 20,
  },
  notesInput: {
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusMd,
    padding: 10,
    color: colors.text,
    fontSize: 13,
    marginTop: 8,
    minHeight: 50,
  },
  footer: {
    padding: 16,
    backgroundColor: colors.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveSessionBtn: {
    backgroundColor: colors.emerald,
    paddingVertical: 16,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveSessionBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  exHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoHeaderBtn: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: layout.borderRadiusSm,
  },
  videoHeaderBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  videoHeaderBtnMini: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: layout.borderRadiusSm,
  },
  videoHeaderBtnMiniText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  collapseBtn: {
    backgroundColor: colors.backgroundSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  collapseBtnText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  exDescContainer: {
    backgroundColor: '#162235',
    padding: 8,
    borderRadius: layout.borderRadiusSm,
    marginTop: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  exDescText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  collapsedSummaryRow: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: layout.borderRadiusSm,
    marginTop: 8,
    alignItems: 'center',
  },
  collapsedSummaryText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  targetVsPrevRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  targetVsPrevBadgeTarget: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  targetVsPrevBadgePrev: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.volume,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bodyweightSetBlock: {
    flex: 1,
    marginRight: 8,
  },
  bandPillsScroll: {
    marginBottom: 6,
  },
  bandPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusPill,
    marginRight: 5,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  bandPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  bandPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  bandPillTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
});


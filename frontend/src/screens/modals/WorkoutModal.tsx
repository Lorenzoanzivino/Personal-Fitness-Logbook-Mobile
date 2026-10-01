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
  RoutineBlockType,
  RoutineBlock,
  CircuitType,
} from '../../types/workout';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Card } from '../../components/Card';
import { ImmersiveTimerOverlay, IntervalCircuitConfig } from '../../components/ImmersiveTimerOverlay';
import { CustomConfirmModal } from '../../components/CustomConfirmModal';
import { ToastFeedback, ToastType } from '../../components/ToastFeedback';
import { YouTubeModalOverlay } from '../../components/YouTubeModalOverlay';
import { BandSelectDropdown, BAND_OPTIONS } from '../../components/BandSelectDropdown';
import { useAudioPlayer } from 'expo-audio';

const ALARM_ASSET = require('../../../assets/alarm.wav');

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
  blockType: RoutineBlockType;
  blockId: number | string;
  circuitRounds: number;
  circuitRestBetweenRounds: number;
  circuitType?: CircuitType | null;
  intervalWorkSeconds?: number | null;
  intervalRestSeconds?: number | null;
  intraRestSeconds: number;
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

  const [weekNumber, setWeekNumber] = useState(selectedRoutine?.current_week || initialWeek || 1);

  useEffect(() => {
    if (selectedRoutine?.current_week) {
      setWeekNumber(selectedRoutine.current_week);
    }
  }, [selectedRoutine?.current_week]);
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
    timerMode?: 'rest' | 'work' | 'interval';
    targetSetCallback: () => void;
    intervalConfig?: IntervalCircuitConfig;
    onStationComplete?: (roundIndex: number, stationIndex: number) => void;
    onCircuitComplete?: () => void;
  }>({
    visible: false,
    seconds: 90,
    exerciseName: '',
    setNumberText: '',
    timerMode: 'rest',
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

  // Active inline timer countdown state
  interface ActiveCountdown {
    id: string;
    type: 'work' | 'rest' | 'intra' | 'round';
    title: string;
    subtitle?: string;
    totalSeconds: number;
    secondsLeft: number;
    isRunning: boolean;
    targetSetKey?: { exIdx: number; setIdx: number };
    onFinish: () => void;
  }

  const [activeCountdown, setActiveCountdown] = useState<ActiveCountdown | null>(null);
  const [highlightedSetKeys, setHighlightedSetKeys] = useState<Set<string>>(new Set());
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  const [alarmMessage, setAlarmMessage] = useState<string>('');

  const alarmPlayer = useAudioPlayer(ALARM_ASSET);

  const playAlarmSound = (msg?: string) => {
    try {
      if (alarmPlayer) {
        alarmPlayer.loop = true;
        alarmPlayer.play();
      }
    } catch (e) {
      console.warn('Alarm audio warning:', e);
    }
    setIsAlarmPlaying(true);
    if (msg) setAlarmMessage(msg);
  };

  const stopAlarmSound = () => {
    try {
      if (alarmPlayer) {
        alarmPlayer.pause();
        alarmPlayer.seekTo(0);
      }
    } catch (e) {}
    setIsAlarmPlaying(false);
    setAlarmMessage('');
  };

  // Active countdown timer effect
  useEffect(() => {
    if (!activeCountdown || !activeCountdown.isRunning) return;

    const interval = setInterval(() => {
      setActiveCountdown((prev) => {
        if (!prev || !prev.isRunning) return prev;
        if (prev.secondsLeft <= 1) {
          clearInterval(interval);
          playAlarmSound(`🔔 Tempo scaduto: ${prev.title}!`);
          if (prev.targetSetKey) {
            const key = `${prev.targetSetKey.exIdx}-${prev.targetSetKey.setIdx}`;
            setHighlightedSetKeys((hk) => new Set(hk).add(key));
          }
          prev.onFinish();
          return { ...prev, secondsLeft: 0, isRunning: false };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCountdown?.isRunning, activeCountdown?.id]);

  const startCountdown = (
    id: string,
    type: 'work' | 'rest' | 'intra' | 'round',
    seconds: number,
    title: string,
    subtitle?: string,
    targetSetKey?: { exIdx: number; setIdx: number },
    onFinish?: () => void
  ) => {
    stopAlarmSound();
    setActiveCountdown({
      id,
      type,
      title,
      subtitle,
      totalSeconds: Math.max(1, seconds),
      secondsLeft: Math.max(1, seconds),
      isRunning: true,
      targetSetKey,
      onFinish: onFinish || (() => {}),
    });
  };

  const togglePauseCountdown = () => {
    if (!activeCountdown) return;
    setActiveCountdown((prev) => (prev ? { ...prev, isRunning: !prev.isRunning } : null));
  };

  const resetCountdown = () => {
    if (!activeCountdown) return;
    stopAlarmSound();
    setActiveCountdown((prev) =>
      prev ? { ...prev, secondsLeft: prev.totalSeconds, isRunning: false } : null
    );
  };

  const dismissCountdown = () => {
    stopAlarmSound();
    setActiveCountdown(null);
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Initialize protected routine structure for execution
  useEffect(() => {
    if (selectedRoutine) {
      if (selectedRoutine.blocks && selectedRoutine.blocks.length > 0) {
        // Modern Block-Based Architecture
        const mapped: LiveExerciseState[] = [];
        let orderCounter = 1;

        selectedRoutine.blocks.forEach((block, bIdx) => {
          let bType: RoutineBlockType = block.block_type || 'STANDARD';
          if ((bType as string) === 'CIRCUIT') {
            bType = block.circuit_type === 'INTERVAL' ? 'CIRCUIT_INTERVAL' : 'CIRCUIT_STANDARD';
          } else if ((bType as string) === 'STANDARD') {
            bType = block.exercises && block.exercises.length > 1 ? 'CIRCUIT_STANDARD' : 'SINGLE';
          } else if ((bType as string) === 'SUPERSET') {
            bType = 'SUPERSERIE';
          }

          const isCircuit =
            bType === 'CIRCUIT' ||
            bType === 'CIRCUIT_STANDARD' ||
            bType === 'CIRCUIT_INTERVAL';
          const isInterval =
            bType === 'CIRCUIT_INTERVAL' ||
            block.circuit_type === 'INTERVAL';
          const bCircuitType: CircuitType = isInterval ? 'INTERVAL' : 'STANDARD';

          const bId = block.id ?? `blk-${bIdx}`;
          const bWorkSecs = block.interval_work_seconds ?? 40;
          const bRestSecs = block.interval_rest_seconds ?? 20;
          const bRounds = isCircuit ? (block.rounds || 3) : 1;
          const bRestBetweenRounds = isCircuit
            ? (block.rest_between_rounds ?? (isInterval ? 0 : 60))
            : 0;

          (block.exercises || []).forEach((re) => {
            const fullExercise =
              re.exercise || exercises.find((e) => e.id === re.exercise_id);
            const name = fullExercise ? fullExercise.name : `Esercizio ${re.exercise_id}`;
            const muscleGroup = fullExercise ? fullExercise.muscle_group : 'Generale';
            const exerciseType: ExerciseType = fullExercise ? fullExercise.exercise_type : 'reps';
            const description = re.custom_description ?? fullExercise?.description ?? null;
            const videoUrl = re.custom_video_url ?? fullExercise?.video_url ?? null;
            const intraRest = re.intra_rest_seconds ?? (isCircuit ? (isInterval ? bRestSecs : 15) : 0);

            let sets: LiveSetState[] = [];

            if (isCircuit) {
              // Circuit execution: Each round corresponds to a set!
              const firstRaw = re.sets && re.sets[0];
              const firstSTime = Number(firstRaw?.target_time_seconds || (firstRaw as any)?.targetTimeSeconds || (firstRaw as any)?.time_seconds || (firstRaw as any)?.timeSeconds || 0);
              const firstSReps = Number(firstRaw?.target_reps != null ? firstRaw.target_reps : ((firstRaw as any)?.targetReps != null ? (firstRaw as any).targetReps : ((firstRaw as any)?.reps != null ? (firstRaw as any).reps : 0)));
              const firstSWeight = Number(firstRaw?.target_weight_kg ?? (firstRaw as any)?.targetWeightKg ?? (firstRaw as any)?.weight_kg ?? 0);
              const firstSBand = (firstRaw?.band_assistance as any) || (firstRaw as any)?.bandAssistance || 'none';

              const firstEffectiveTime = isInterval
                ? (firstSTime > 0 ? firstSTime : bWorkSecs)
                : (exerciseType === 'time' || firstSTime > 0 ? (firstSTime > 0 ? firstSTime : 60) : null);
              const firstEffectiveReps = isInterval
                ? firstSReps
                : (exerciseType === 'time' || firstSTime > 0 ? 0 : (firstSReps > 0 ? firstSReps : 10));

              const firstSet = firstRaw || {
                set_number: 1,
                set_type: 'normal',
                target_weight_kg: firstSWeight,
                target_reps: firstEffectiveReps,
                target_time_seconds: firstEffectiveTime,
                band_assistance: firstSBand,
                rest_seconds: intraRest,
              };

              for (let r = 1; r <= bRounds; r++) {
                const s = (re.sets && re.sets[r - 1]) || firstRaw || firstSet;
                const sTime = Number(s.target_time_seconds || (s as any).targetTimeSeconds || (s as any).time_seconds || (s as any).timeSeconds || 0);
                const sReps = Number(s.target_reps != null ? s.target_reps : ((s as any).targetReps != null ? (s as any).targetReps : ((s as any).reps != null ? (s as any).reps : 0)));
                const sWeight = Number(s.target_weight_kg ?? (s as any).targetWeightKg ?? (s as any).weight_kg ?? 0);
                const sBand = (s.band_assistance as any) || (s as any).bandAssistance || 'none';

                let effectiveTime: number | null = null;
                let effectiveReps = 0;

                if (isInterval) {
                  effectiveTime = sTime > 0 ? sTime : bWorkSecs;
                  effectiveReps = sReps;
                } else {
                  const isTimeBased = exerciseType === 'time' || sTime > 0;
                  effectiveTime = isTimeBased ? (sTime > 0 ? sTime : 60) : null;
                  effectiveReps = isTimeBased ? 0 : (sReps > 0 ? sReps : 10);
                }

                sets.push({
                  tempId: `live-set-${re.exercise_id}-r${r}-${Date.now()}-${r}`,
                  set_number: r,
                  set_type: (s.set_type as any) || 'normal',
                  weight_kg: sWeight,
                  reps: effectiveReps,
                  time_seconds: effectiveTime,
                  band_assistance: sBand,
                  dropset_weight_kg: s.dropset_weight_kg ? Number(s.dropset_weight_kg) : null,
                  drops: s.drops ? s.drops.map((d) => ({ id: d.id, kg: d.kg || 0, reps: d.reps || 8, rest_seconds: d.rest_seconds })) : undefined,
                  rest_seconds: intraRest,
                  targetWeightKg: sWeight,
                  targetReps: effectiveReps,
                  targetTimeSeconds: effectiveTime,
                  completed: false,
                });
              }
            } else {
              // STANDARD or SUPERSET
              sets = (re.sets || []).map((s, sIdx) => {
                let mappedDrops: SetDropStep[] | undefined = undefined;
                const normalizedSetType = String(s.set_type || 'normal').toLowerCase();
                const dropCount = Math.max(2, (s as any).drop_count || (normalizedSetType === 'rest_pause' ? 3 : 2));
                const rpRest = (s as any).rest_pause_seconds ?? 20;

                const sTime = Number(s.target_time_seconds || (s as any).targetTimeSeconds || (s as any).time_seconds || (s as any).timeSeconds || 0);
                const isTimeBased = exerciseType === 'time' || sTime > 0;
                const effectiveTime = isTimeBased ? (sTime > 0 ? sTime : 60) : null;
                const effectiveReps = isTimeBased
                  ? 0
                  : (s.target_reps != null && Number(s.target_reps) > 0
                    ? Number(s.target_reps)
                    : ((s as any).targetReps != null && Number((s as any).targetReps) > 0
                    ? Number((s as any).targetReps)
                    : 10));

                if (s.drops && s.drops.length > 0) {
                  mappedDrops = s.drops.map((d) => ({
                    id: d.id,
                    kg: d.kg || 0,
                    reps: d.reps || 8,
                    rest_seconds: d.rest_seconds,
                  }));
                } else if (normalizedSetType === 'dropset' || normalizedSetType === 'stripping') {
                  const baseKg = Number(s.target_weight_kg || 0);
                  const dropPct = (s as any).drop_percentage ? Number((s as any).drop_percentage) : 20;
                  mappedDrops = Array.from({ length: dropCount }).map((_, dIdx) => ({
                    id: `d${dIdx + 1}-${sIdx}`,
                    kg: dIdx === 0 ? baseKg : Math.max(0, Math.round(baseKg * (1 - (dIdx * dropPct) / 100))),
                    reps: effectiveReps || 8,
                    rest_seconds: 0,
                  }));
                } else if (normalizedSetType === 'rest_pause') {
                  const baseKg = Number(s.target_weight_kg || 0);
                  const firstReps = effectiveReps || 10;
                  const clusterReps = Math.max(2, Math.floor(firstReps / 2)) || 4;
                  mappedDrops = Array.from({ length: dropCount }).map((_, cIdx) => ({
                    id: `rp${cIdx + 1}-${sIdx}`,
                    kg: baseKg,
                    reps: cIdx === 0 ? firstReps : clusterReps,
                    rest_seconds: rpRest,
                  }));
                }

                return {
                  tempId: `live-set-${re.exercise_id}-${sIdx + 1}-${Date.now()}`,
                  set_number: s.set_number,
                  set_type: (s.set_type as any) || 'normal',
                  weight_kg: Number(s.target_weight_kg || 0),
                  reps: effectiveReps,
                  time_seconds: effectiveTime,
                  band_assistance: (s.band_assistance as any) || 'none',
                  dropset_weight_kg: s.dropset_weight_kg ? Number(s.dropset_weight_kg) : null,
                  drops: mappedDrops,
                  drop_count: (s as any).drop_count,
                  rest_pause_seconds: rpRest,
                  rest_seconds: s.rest_seconds || 90,
                  targetWeightKg: Number(s.target_weight_kg || 0),
                  targetReps: effectiveReps,
                  targetTimeSeconds: effectiveTime,
                  completed: false,
                };
              });
            }

            const defaultRest = sets.length > 0 ? (sets[0].rest_seconds || 90) : 90;

            mapped.push({
              exerciseId: re.exercise_id,
              name,
              muscleGroup,
              exerciseType,
              exerciseOrder: orderCounter++,
              blockType: bType,
              blockId: bId,
              circuitRounds: bRounds,
              circuitRestBetweenRounds: bRestBetweenRounds,
              circuitType: bCircuitType,
              intervalWorkSeconds: bWorkSecs,
              intervalRestSeconds: bRestSecs,
              intraRestSeconds: intraRest,
              supersetGroup: re.superset_group || (bType === 'SUPERSERIE' || bType === 'SUPERSET' ? `SS-${bId}` : null),
              restSeconds: defaultRest,
              description,
              videoUrl,
              sets,
            });
          });
        });

        setLiveExercises(mapped);
      } else if (selectedRoutine.exercises && selectedRoutine.exercises.length > 0) {
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
            const normalizedSetType = String(s.set_type || 'normal').toLowerCase();
            const dropCount = Math.max(2, (s as any).drop_count || (normalizedSetType === 'rest_pause' ? 3 : 2));
            const rpRest = (s as any).rest_pause_seconds ?? 20;

            const sTime = Number(s.target_time_seconds || (s as any).targetTimeSeconds || (s as any).time_seconds || (s as any).timeSeconds || 0);
            const isTimeBased = exerciseType === 'time' || sTime > 0;
            const effectiveTime = isTimeBased ? (sTime > 0 ? sTime : 60) : null;
            const effectiveReps = isTimeBased
              ? 0
              : (s.target_reps != null && Number(s.target_reps) > 0
                ? Number(s.target_reps)
                : ((s as any).targetReps != null && Number((s as any).targetReps) > 0
                ? Number((s as any).targetReps)
                : 10));

            if (s.drops && s.drops.length > 0) {
              mappedDrops = s.drops.map((d) => ({
                id: d.id,
                kg: d.kg || 0,
                reps: d.reps || 8,
                rest_seconds: d.rest_seconds,
              }));
            } else if (normalizedSetType === 'dropset' || normalizedSetType === 'stripping') {
              const baseKg = Number(s.target_weight_kg || 0);
              const dropPct = (s as any).drop_percentage ? Number((s as any).drop_percentage) : 20;
              mappedDrops = Array.from({ length: dropCount }).map((_, dIdx) => ({
                id: `d${dIdx + 1}-${sIdx}`,
                kg: dIdx === 0 ? baseKg : Math.max(0, Math.round(baseKg * (1 - (dIdx * dropPct) / 100))),
                reps: effectiveReps || 8,
                rest_seconds: 0,
              }));
            } else if (normalizedSetType === 'rest_pause') {
              const baseKg = Number(s.target_weight_kg || 0);
              const firstReps = effectiveReps || 10;
              const clusterReps = Math.max(2, Math.floor(firstReps / 2)) || 4;
              mappedDrops = Array.from({ length: dropCount }).map((_, cIdx) => ({
                id: `rp${cIdx + 1}-${sIdx}`,
                kg: baseKg,
                reps: cIdx === 0 ? firstReps : clusterReps,
                rest_seconds: rpRest,
              }));
            }

            return {
              tempId: `live-set-${re.exercise_id}-${sIdx + 1}-${Date.now()}`,
              set_number: s.set_number,
              set_type: (s.set_type as any) || 'normal',
              weight_kg: Number(s.target_weight_kg || 0),
              reps: effectiveReps,
              time_seconds: effectiveTime,
              band_assistance: (s.band_assistance as any) || 'none',
              dropset_weight_kg: s.dropset_weight_kg ? Number(s.dropset_weight_kg) : null,
              drops: mappedDrops,
              drop_count: (s as any).drop_count,
              rest_pause_seconds: rpRest,
              rest_seconds: s.rest_seconds || 90,
              targetWeightKg: Number(s.target_weight_kg || 0),
              targetReps: effectiveReps,
              targetTimeSeconds: effectiveTime,
              completed: false,
            };
          });

          const defaultRest = sets.length > 0 ? (sets[0].rest_seconds || 90) : 90;

          return {
            exerciseId: re.exercise_id,
            name,
            muscleGroup,
            exerciseType,
            exerciseOrder: idx + 1,
            blockType: re.superset_group ? 'SUPERSERIE' : 'SINGLE',
            blockId: re.superset_group ? `ss-${re.superset_group}` : `std-${idx}`,
            circuitRounds: 1,
            circuitRestBetweenRounds: 0,
            circuitType: null,
            intervalWorkSeconds: null,
            intervalRestSeconds: null,
            intraRestSeconds: re.intra_rest_seconds ?? 0,
            supersetGroup: re.superset_group || null,
            restSeconds: defaultRest,
            description,
            videoUrl,
            sets,
          };
        });

        setLiveExercises(mapped);
      }
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
    const isPrevTime = exerciseType === 'time' || Boolean(s.time_seconds && Number(s.time_seconds) > 0);
    if (isPrevTime) {
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
    exerciseType: ExerciseType,
    isIntervalCircuit?: boolean
  ): string => {
    if (isIntervalCircuit) {
      const timeVal = set.targetTimeSeconds || set.time_seconds || 0;
      let loadPart = '';
      const band = set.band_assistance;
      if (exerciseType === 'bodyweight' || (band && band !== 'none')) {
        if (band === 'weighted') loadPart = `+${set.targetWeightKg || 0}kg`;
        else if (band === 'light') loadPart = 'Elastico bassa';
        else if (band === 'medium') loadPart = 'Elastico media';
        else if (band === 'heavy') loadPart = 'Elastico alta';
        else loadPart = 'Corpo libero';
      } else if (Number(set.targetWeightKg) > 0) {
        loadPart = `${set.targetWeightKg}kg`;
      }
      const reps = Number(set.targetReps != null ? set.targetReps : (set.reps || 0));
      const parts: string[] = [];
      if (timeVal > 0) parts.push(`⏱️ ${timeVal}s`);
      if (loadPart && reps > 0) {
        parts.push(`${loadPart} × ${reps}`);
      } else if (loadPart) {
        parts.push(loadPart);
      } else if (reps > 0) {
        parts.push(`${reps} reps`);
      }
      return parts.join(' • ') || (timeVal > 0 ? `⏱️ ${timeVal}s` : 'Intervallo');
    }

    const isTime =
      exerciseType === 'time' ||
      Boolean(
        (set.targetTimeSeconds != null && Number(set.targetTimeSeconds) > 0) ||
        (set.time_seconds != null && Number(set.time_seconds) > 0)
      );
    if (isTime) {
      return `⏱️ ${set.targetTimeSeconds || set.time_seconds || 60}s`;
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
    if (val.trim() === '') {
      const updated = [...liveExercises];
      updated[exIdx].sets[setIdx].weight_kg = 0;
      setLiveExercises(updated);
      return;
    }
    const clean = val.replace(',', '.');
    const num = parseFloat(clean);
    const updated = [...liveExercises];
    updated[exIdx].sets[setIdx].weight_kg = isNaN(num) ? 0 : num;
    setLiveExercises(updated);
  };

  const handleUpdateReps = (exIdx: number, setIdx: number, val: string) => {
    if (val.trim() === '') {
      const updated = [...liveExercises];
      updated[exIdx].sets[setIdx].reps = 0;
      setLiveExercises(updated);
      return;
    }
    const num = parseInt(val, 10);
    const updated = [...liveExercises];
    updated[exIdx].sets[setIdx].reps = isNaN(num) ? 0 : num;
    setLiveExercises(updated);
  };

  const handleUpdateTimeSeconds = (exIdx: number, setIdx: number, val: string) => {
    if (val.trim() === '') {
      const updated = [...liveExercises];
      updated[exIdx].sets[setIdx].time_seconds = 0;
      setLiveExercises(updated);
      return;
    }
    const num = parseInt(val, 10);
    const updated = [...liveExercises];
    updated[exIdx].sets[setIdx].time_seconds = isNaN(num) ? 0 : num;
    setLiveExercises(updated);
  };

  const handleUpdateDropKg = (exIdx: number, setIdx: number, dropIdx: number, val: string) => {
    const updated = [...liveExercises];
    const targetSet = updated[exIdx]?.sets[setIdx];
    const drops = targetSet?.drops;
    if (!drops || !drops[dropIdx]) return;
    if (val.trim() === '') {
      drops[dropIdx].kg = 0;
      if (dropIdx === 0) {
        targetSet.weight_kg = 0;
      }
      setLiveExercises(updated);
      return;
    }
    const clean = val.replace(',', '.');
    const num = parseFloat(clean);
    const newKg = isNaN(num) ? 0 : num;
    drops[dropIdx].kg = newKg;
    if (dropIdx === 0) {
      targetSet.weight_kg = newKg;
    }
    setLiveExercises(updated);
  };

  const handleUpdateDropReps = (exIdx: number, setIdx: number, dropIdx: number, val: string) => {
    const updated = [...liveExercises];
    const targetSet = updated[exIdx]?.sets[setIdx];
    const drops = targetSet?.drops;
    if (!drops || !drops[dropIdx]) return;
    if (val.trim() === '') {
      drops[dropIdx].reps = 0;
      if (dropIdx === 0) {
        targetSet.reps = 0;
      }
      setLiveExercises(updated);
      return;
    }
    const num = parseInt(val, 10);
    const newReps = isNaN(num) ? 0 : num;
    drops[dropIdx].reps = newReps;
    if (dropIdx === 0) {
      targetSet.reps = newReps;
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
    const restId = `rest-${exIdx}-${setIdx}`;
    const isRestActive = activeCountdown?.id === restId;
    const restSecs = (isRestActive && activeCountdown && activeCountdown.secondsLeft > 0)
      ? activeCountdown.secondsLeft
      : (targetSet.rest_seconds || liveExercises[exIdx].restSeconds || 90);
    const normalizedSetType = String(targetSet.set_type || '').toLowerCase();
    const isSpecial = normalizedSetType === 'dropset' || normalizedSetType === 'stripping' || normalizedSetType === 'rest_pause';

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
    const normalizedSetType = String(targetSet.set_type || '').toLowerCase();
    const isRestPause = normalizedSetType === 'rest_pause';
    const intraSecs = (drop && drop.rest_seconds !== undefined) 
      ? drop.rest_seconds 
      : (isRestPause ? ((targetSet as any).rest_pause_seconds ?? 20) : 0);

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

  // Open Immersive Timer for Circuit intra-exercise rest
  const handleOpenCircuitIntraTimer = (
    exName: string,
    nextExName: string,
    roundIdx: number,
    totalRounds: number,
    intraSecs: number
  ) => {
    setTimerOverlay({
      visible: true,
      seconds: intraSecs,
      exerciseName: exName,
      setNumberText: `Pausa intra-circuito (${intraSecs}s) • Prossimo: ${nextExName} (Giro ${roundIdx + 1}/${totalRounds})`,
      timerMode: 'rest',
      targetSetCallback: () => {
        setTimerOverlay((prev) => ({ ...prev, visible: false }));
        showToast('info', `Pausa conclusa! Procedi con ${nextExName}`);
      },
    });
  };

  // Open Immersive Timer for Circuit End-of-Round rest
  const handleOpenCircuitRoundEndTimer = (
    roundNumber: number,
    totalRounds: number,
    restBetweenRounds: number,
    firstExName: string
  ) => {
    setTimerOverlay({
      visible: true,
      seconds: restBetweenRounds,
      exerciseName: `Circuito - Fine Giro ${roundNumber} di ${totalRounds}`,
      setNumberText: `Recupero fine giro (${restBetweenRounds}s) • Prossimo: Giro ${roundNumber + 1}`,
      timerMode: 'rest',
      targetSetCallback: () => {
        setTimerOverlay((prev) => ({ ...prev, visible: false }));
        showToast('success', `Giro ${roundNumber + 1} iniziato! Vai con ${firstExName}`);
      },
    });
  };

  // Handle Circuit Set Completion with automatic intra-exercise & round-end transitions
  const handleToggleCompleteCircuitSet = (
    secIdx: number,
    exInGroupIdx: number,
    roundIdx: number,
    forceCompleted?: boolean
  ) => {
    const section = sections[secIdx];
    if (!section || section.type !== 'circuit') return;

    const groupIndices = section.exerciseIndices;
    const globalExIdx = groupIndices[exInGroupIdx];
    const currentEx = liveExercises[globalExIdx];
    const targetSet = currentEx.sets[roundIdx];
    if (!targetSet) return;

    const isNowCompleted = forceCompleted !== undefined ? forceCompleted : !targetSet.completed;
    const key = `${globalExIdx}-${roundIdx}`;
    setHighlightedSetKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    stopAlarmSound();

    const updated = [...liveExercises];
    updated[globalExIdx].sets[roundIdx].completed = isNowCompleted;
    setLiveExercises(updated);

    if (isNowCompleted && forceCompleted === undefined) {
      const isLastExInRound = exInGroupIdx === groupIndices.length - 1;
      const isLastRound = roundIdx + 1 >= section.rounds;
      const firstEx = liveExercises[groupIndices[0]];

      if (!isLastExInRound) {
        // More exercises in this round: trigger intra-rest
        const nextExIdx = groupIndices[exInGroupIdx + 1];
        const nextEx = liveExercises[nextExIdx];
        const intraSecs = currentEx.intraRestSeconds || 15;

        if (intraSecs > 0) {
          startCountdown(
            `intra-c-${globalExIdx}-${roundIdx}`,
            'intra',
            intraSecs,
            `Intra: ${currentEx.name}`,
            `Pausa prima di ${nextEx.name}`,
            undefined,
            () => {
              showToast('info', `Pausa conclusa! Procedi con ${nextEx.name}`);
            }
          );
        } else {
          showToast('info', `Prossimo esercizio: ${nextEx.name}`);
        }
      } else {
        // Last exercise in this round!
        if (!isLastRound) {
          // More rounds remain: trigger rest_between_rounds!
          const restBetweenRounds = section.restBetweenRounds ?? 60;
          if (restBetweenRounds > 0) {
            startCountdown(
              `round-c-${secIdx}-${roundIdx}`,
              'round',
              restBetweenRounds,
              `Fine Giro ${roundIdx + 1} di ${section.rounds}`,
              `Recupero prima di Giro ${roundIdx + 2}`,
              undefined,
              () => {
                showToast('success', `Giro ${roundIdx + 2} iniziato! Vai con ${firstEx.name}`);
              }
            );
          } else {
            showToast('success', `Giro ${roundIdx + 2} di ${section.rounds} iniziato!`);
          }
        } else {
          // Final round finished!
          showToast('success', `🏆 Circuito completato con successo (${section.rounds} Giri)!`);
        }
      }
    }
  };

  const handleToggleComplete = (exIdx: number, setIdx: number, forceCompleted?: boolean) => {
    const key = `${exIdx}-${setIdx}`;
    setHighlightedSetKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    stopAlarmSound();

    const targetSet = liveExercises[exIdx].sets[setIdx];
    const isNowCompleted = forceCompleted !== undefined ? forceCompleted : !targetSet.completed;

    const updated = [...liveExercises];
    updated[exIdx].sets[setIdx].completed = isNowCompleted;
    setLiveExercises(updated);

    if (isNowCompleted && forceCompleted === undefined) {
      handleOpenRestTimerForSet(exIdx, setIdx);
    }
  };

  const handleStartWorkTimer = (exIdx: number, setIdx: number) => {
    const exercise = liveExercises[exIdx];
    const set = exercise.sets[setIdx];
    const workSeconds = set.time_seconds || set.targetTimeSeconds || 60;

    setTimerOverlay({
      visible: true,
      seconds: workSeconds,
      timerMode: 'work',
      exerciseName: exercise.name,
      setNumberText: `Serie ${set.set_number} • Tensione Attiva: ${workSeconds}s`,
      targetSetCallback: () => {
        // 1. Marca la serie come completata
        handleToggleComplete(exIdx, setIdx, true);
        // 2. Avvia direttamente il timer di recupero classico
        setTimeout(() => {
          handleOpenRestTimerForSet(exIdx, setIdx);
        }, 400);
      },
    });
  };

  const handleStartCircuitWorkTimer = (
    secIdx: number,
    exInGroupIdx: number,
    roundIdx: number
  ) => {
    const section = sections[secIdx];
    if (!section || section.type !== 'circuit') return;
    const groupIndices = section.exerciseIndices;
    const globalExIdx = groupIndices[exInGroupIdx];
    const currentEx = liveExercises[globalExIdx];
    const targetSet = currentEx?.sets[roundIdx];
    if (!currentEx || !targetSet) return;
    const workSeconds = targetSet.time_seconds || targetSet.targetTimeSeconds || 60;
    const totalRounds = section.rounds || 1;
    const roundNumber = roundIdx + 1;

    setTimerOverlay({
      visible: true,
      seconds: workSeconds,
      timerMode: 'work',
      exerciseName: currentEx.name,
      setNumberText: `Circuito • Giro ${roundNumber}/${totalRounds} • Isometria: ${workSeconds}s`,
      targetSetCallback: () => {
        // 1. Marca la serie del circuito come completata
        handleToggleCompleteCircuitSet(secIdx, exInGroupIdx, roundIdx, true);
        setTimerOverlay((prev) => ({ ...prev, visible: false }));
        showToast('success', `Isometria completata! ${currentEx.name}`);

        // 2. Transizione al recupero se previsto (intra-rest o fine giro)
        const isLastExInRound = exInGroupIdx === groupIndices.length - 1;
        const isLastRound = roundIdx + 1 >= totalRounds;

        if (!isLastExInRound) {
          const nextExIdx = groupIndices[exInGroupIdx + 1];
          const nextEx = liveExercises[nextExIdx];
          const intraSecs = currentEx.intraRestSeconds || 0;
          if (intraSecs > 0) {
            setTimeout(() => {
              handleOpenCircuitIntraTimer(
                currentEx.name,
                nextEx?.name || 'Prossimo Esercizio',
                roundIdx,
                totalRounds,
                intraSecs
              );
            }, 400);
          }
        } else if (!isLastRound) {
          const restBetweenRounds = section.restBetweenRounds ?? 60;
          if (restBetweenRounds > 0) {
            const firstEx = liveExercises[groupIndices[0]];
            setTimeout(() => {
              handleOpenCircuitRoundEndTimer(
                roundNumber,
                totalRounds,
                restBetweenRounds,
                firstEx?.name || 'Inizio Giro'
              );
            }, 400);
          }
        }
      },
    });
  };

  const handleStartHandsFreeInterval = (secIdx: number) => {
    const section = sections[secIdx];
    if (!section || section.type !== 'circuit') return;

    const groupExs = section.exerciseIndices.map((i) => liveExercises[i]);
    const totalRounds = section.rounds || 3;
    const workSecs = section.intervalWorkSeconds || 40;
    const restSecs = section.intervalRestSeconds || 20;

    const config: IntervalCircuitConfig = {
      rounds: totalRounds,
      workSeconds: workSecs,
      restSeconds: restSecs,
      prepareSeconds: 10,
      exercises: groupExs.map((ex) => {
        const firstSet = ex.sets[0];
        return {
          name: ex.name,
          weightKg: firstSet?.weight_kg || 0,
          bandAssistance: firstSet?.band_assistance || 'none',
          muscleGroup: ex.muscleGroup,
        };
      }),
    };

    setTimerOverlay({
      visible: true,
      seconds: workSecs,
      timerMode: 'interval',
      exerciseName: groupExs[0]?.name || 'Circuito',
      setNumberText: `Interval Training • ${totalRounds} Giri (${workSecs}s / ${restSecs}s)`,
      targetSetCallback: () => {},
      intervalConfig: config,
      onStationComplete: (roundIndex, stationIndex) => {
        handleToggleCompleteCircuitSet(secIdx, stationIndex, roundIndex, true);
      },
      onCircuitComplete: () => {
        showToast('success', '🏆 Interval Training completato con successo!');
        setTimerOverlay((prev) => ({ ...prev, visible: false }));
      },
    });
  };

  const handleStartSupersetWorkTimer = (
    secIdx: number,
    exIdx: number,
    roundIdx: number
  ) => {
    const section = sections[secIdx];
    const currentEx = liveExercises[exIdx];
    const targetSet = currentEx?.sets[roundIdx];
    if (!currentEx || !targetSet) return;
    const workSeconds = targetSet.time_seconds || targetSet.targetTimeSeconds || 60;
    const roundNumber = roundIdx + 1;

    setTimerOverlay({
      visible: true,
      seconds: workSeconds,
      timerMode: 'work',
      exerciseName: currentEx.name,
      setNumberText: `Super Serie ${section?.supersetGroup || ''} • Round ${roundNumber} • Isometria: ${workSeconds}s`,
      targetSetCallback: () => {
        // 1. Marca la serie come completata
        handleToggleComplete(exIdx, roundIdx, true);
        setTimerOverlay((prev) => ({ ...prev, visible: false }));
        showToast('success', `Isometria completata! ${currentEx.name}`);

        // 2. Se tutti gli esercizi del round sono ora completati, apri recupero superserie
        if (section && section.exerciseIndices) {
          const otherExIndices = section.exerciseIndices.filter((i) => i !== exIdx);
          const allOthersCompleted = otherExIndices.every(
            (i) => liveExercises[i]?.sets[roundIdx]?.completed
          );
          if (allOthersCompleted) {
            setTimeout(() => {
              handleOpenRestTimerForSupersetRound(
                section.supersetGroup || '',
                roundIdx,
                section.exerciseIndices
              );
            }, 400);
          }
        }
      },
    });
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
        drop_count: s.drop_count,
        rest_pause_seconds: s.rest_pause_seconds,
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
    const normalized = String(type || '').toLowerCase();
    switch (normalized) {
      case 'warmup':
        return { bg: 'rgba(245, 158, 11, 0.2)', text: colors.warning, label: 'WARM-UP' };
      case 'dropset':
      case 'stripping':
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

  // Separate Standalone Exercises vs Superset Groups vs Circuit Blocks
  // We collect items in appearance order
  interface DisplaySection {
    type: 'standalone' | 'superset' | 'circuit';
    blockType: RoutineBlockType;
    blockId: number | string;
    circuitType?: CircuitType | null;
    intervalWorkSeconds?: number | null;
    intervalRestSeconds?: number | null;
    supersetGroup?: string;
    rounds: number;
    restBetweenRounds: number;
    exerciseIndices: number[];
  }

  const sections: DisplaySection[] = [];
  const handledIndices = new Set<number>();

  liveExercises.forEach((ex, idx) => {
    if (handledIndices.has(idx)) return;

    const isCircuit =
      ex.blockType === 'CIRCUIT_STANDARD' ||
      ex.blockType === 'CIRCUIT_INTERVAL' ||
      ex.blockType === 'CIRCUIT';

    if (isCircuit) {
      const bId = ex.blockId;
      const groupIndices: number[] = [];
      liveExercises.forEach((otherEx, oIdx) => {
        const otherIsCircuit =
          otherEx.blockType === 'CIRCUIT_STANDARD' ||
          otherEx.blockType === 'CIRCUIT_INTERVAL' ||
          otherEx.blockType === 'CIRCUIT';
        if (otherEx.blockId === bId && otherIsCircuit) {
          groupIndices.push(oIdx);
          handledIndices.add(oIdx);
        }
      });

      const isInterval =
        ex.blockType === 'CIRCUIT_INTERVAL' ||
        ex.circuitType === 'INTERVAL';

      sections.push({
        type: 'circuit',
        blockType: ex.blockType,
        circuitType: isInterval ? 'INTERVAL' : 'STANDARD',
        blockId: bId,
        rounds: ex.circuitRounds || 3,
        restBetweenRounds: ex.circuitRestBetweenRounds ?? (isInterval ? 0 : 60),
        intervalWorkSeconds: ex.intervalWorkSeconds ?? 40,
        intervalRestSeconds: ex.intervalRestSeconds ?? 20,
        exerciseIndices: groupIndices,
      });
    } else if (
      ex.blockType === 'SUPERSET' ||
      ex.blockType === 'SUPERSERIE' ||
      Boolean(ex.supersetGroup)
    ) {
      const group = ex.supersetGroup || String(ex.blockId);
      const groupIndices: number[] = [];
      liveExercises.forEach((otherEx, oIdx) => {
        const otherIsSuperset =
          otherEx.blockType === 'SUPERSET' ||
          otherEx.blockType === 'SUPERSERIE' ||
          Boolean(otherEx.supersetGroup);
        if (
          otherIsSuperset &&
          ((otherEx.supersetGroup && otherEx.supersetGroup === group) ||
            (otherEx.blockId != null && otherEx.blockId === ex.blockId))
        ) {
          groupIndices.push(oIdx);
          handledIndices.add(oIdx);
        }
      });
      sections.push({
        type: 'superset',
        blockType: ex.blockType === 'SUPERSET' ? 'SUPERSET' : 'SUPERSERIE',
        blockId: ex.blockId,
        supersetGroup: ex.supersetGroup || 'A',
        rounds: 1,
        restBetweenRounds: 0,
        exerciseIndices: groupIndices,
      });
    } else {
      sections.push({
        type: 'standalone',
        blockType: 'SINGLE',
        blockId: ex.blockId,
        rounds: 1,
        restBetweenRounds: 0,
        exerciseIndices: [idx],
      });
      handledIndices.add(idx);
    }
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
        timerMode={timerOverlay.timerMode}
        exerciseName={timerOverlay.exerciseName}
        setNumberText={timerOverlay.setNumberText}
        intervalConfig={timerOverlay.intervalConfig}
        onStationComplete={timerOverlay.onStationComplete}
        onCircuitComplete={timerOverlay.onCircuitComplete}
        onComplete={timerOverlay.targetSetCallback}
        onDismiss={() => setTimerOverlay((prev) => ({ ...prev, visible: false }))}
      />

      {/* Top Header */}
      <View style={styles.modalHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.protectedRow}>
            <View
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                borderWidth: 1,
                borderColor: 'rgba(234, 179, 8, 0.4)',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 4,
                alignSelf: 'flex-start',
                marginBottom: 4,
              }}
            >
              <Text
                style={{
                  color: '#eab308',
                  fontSize: 11,
                  fontWeight: '900',
                  letterSpacing: 0.5,
                }}
              >
                📅 SETTIMANA {weekNumber}{selectedRoutine?.duration_weeks ? ` / ${selectedRoutine.duration_weeks}` : ''}
              </Text>
            </View>
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

      {/* Alarm Alert Banner */}
      {isAlarmPlaying && (
        <Pressable
          onPress={stopAlarmSound}
          style={styles.alarmBanner}
          accessibilityRole="button"
          accessibilityLabel="Silenzia sveglia"
        >
          <Text style={styles.alarmBannerIcon}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.alarmBannerTitle}>TIMER SCADUTO!</Text>
            <Text style={styles.alarmBannerText}>
              {alarmMessage || 'Tocca qui o spunta la serie per fermare la sveglia'}
            </Text>
          </View>
          <View style={styles.alarmBannerBtn}>
            <Text style={styles.alarmBannerBtnText}>SILENZIA ✕</Text>
          </View>
        </Pressable>
      )}

      {/* Real-time KPI Bar (Minimalist Icon Strip) */}
      <View style={styles.kpiBar}>
        <View style={styles.kpiItem}>
          <Text style={styles.kpiBarLabel}>⏱️</Text>
          <Text style={styles.kpiBarValue}>{formatStopwatch(secondsElapsed)}</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={styles.kpiBarLabel}>⚖️</Text>
          <Text style={[styles.kpiBarValue, { color: colors.volume }]}>
            {totalVolumeKg.toLocaleString()} kg
          </Text>
        </View>
        {totalTimeSecs > 0 && (
          <>
            <View style={styles.kpiDivider} />
            <View style={styles.kpiItem}>
              <Text style={styles.kpiBarLabel}>⌛</Text>
              <Text style={[styles.kpiBarValue, { color: colors.emerald }]}>
                {totalTimeSecs}s
              </Text>
            </View>
          </>
        )}
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={styles.kpiBarLabel}>✓</Text>
          <Text style={[styles.kpiBarValue, { color: colors.emerald }]}>
            {completedSetsCount}/{allSets.length}
          </Text>
        </View>
      </View>

      {/* Execution Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(120, insets.bottom + 90) + (activeCountdown ? 64 : 0) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section, secIdx) => {
          // --- CASE 0: CIRCUIT BLOCK (SEQUENTIAL ROUND BY ROUND) ---
          if (section.type === 'circuit') {
            const groupExs = section.exerciseIndices.map((i) => ({
              idx: i,
              ex: liveExercises[i],
            }));
            const totalRounds = section.rounds || 3;
            const isInterval =
              section.blockType === 'CIRCUIT_INTERVAL' ||
              section.circuitType === 'INTERVAL';

            const isRoundDone = (rIdx: number) => {
              return groupExs.every((g) => g.ex.sets[rIdx]?.completed);
            };

            let currentActiveRoundIdx = 0;
            for (let r = 0; r < totalRounds; r++) {
              if (!isRoundDone(r)) {
                currentActiveRoundIdx = r;
                break;
              }
              currentActiveRoundIdx = r;
            }
            const allCircuitDone = totalRounds > 0 && isRoundDone(totalRounds - 1);
            const currentRoundNumber = currentActiveRoundIdx + 1;

            return (
              <Card
                key={`circuit-section-${secIdx}`}
                style={[
                  styles.circuitSectionCard,
                  isInterval ? styles.circuitSectionCardInterval : styles.circuitSectionCardStandard,
                ]}
              >
                {/* Circuit Block Header */}
                <View style={styles.circuitBlockHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View
                      style={[
                        styles.circuitTagBadge,
                        isInterval ? styles.circuitTagBadgeInterval : styles.circuitTagBadgeStandard,
                      ]}
                    >
                      <Text
                        style={[
                          styles.circuitTagBadgeText,
                          isInterval ? styles.circuitTagBadgeTextInterval : styles.circuitTagBadgeTextStandard,
                        ]}
                      >
                        {isInterval
                          ? `⚡ INTERVAL TRAINING - ${allCircuitDone ? 'COMPLETATO' : `GIRO ${currentRoundNumber} DI ${totalRounds}`}`
                          : `🔄 CIRCUITO STANDARD - ${allCircuitDone ? 'COMPLETATO' : `GIRO ${currentRoundNumber} DI ${totalRounds}`}`}
                      </Text>
                    </View>
                    <Text style={typography.h3}>
                      {groupExs.map((g) => g.ex.name).join(' → ')}
                    </Text>
                    <Text style={typography.caption}>
                      {isInterval
                        ? `⚡ ${totalRounds} Giri • ⏱️ ${section.intervalWorkSeconds || 40}s Lavoro / ${section.intervalRestSeconds || 20}s Recupero`
                        : `🔄 ${totalRounds} Giri • ⏱️ Fine giro ${section.restBetweenRounds}s`}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => toggleSectionCollapse(secIdx)}
                    style={styles.collapseBtn}
                    accessibilityRole="button"
                    accessibilityLabel={collapsedSectionIdxs.has(secIdx) ? "Espandi circuito" : "Riduci circuito"}
                  >
                    <Text style={styles.collapseBtnText}>
                      {collapsedSectionIdxs.has(secIdx) ? '▼ Espandi' : '▲ Riduci'}
                    </Text>
                  </Pressable>
                </View>

                {/* Pulsante HANDS-FREE per INTERVAL TRAINING */}
                {isInterval && !collapsedSectionIdxs.has(secIdx) && (
                  <Pressable
                    onPress={() => handleStartHandsFreeInterval(secIdx)}
                    style={({ pressed }) => [
                      styles.startHandsFreeBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Avvia Interval Training Hands-Free"
                  >
                    <Text style={styles.startHandsFreeBtnText}>
                      ▶ AVVIA INTERVAL TRAINING (HANDS-FREE)
                    </Text>
                  </Pressable>
                )}

                {collapsedSectionIdxs.has(secIdx) ? (
                  <Pressable
                    onPress={() => toggleSectionCollapse(secIdx)}
                    style={styles.collapsedSummaryRow}
                  >
                    <Text style={styles.collapsedSummaryText}>
                      {isInterval ? '⚡ Interval Training' : '🔄 Circuito'} • {groupExs.map((g) => g.ex.name).join(' → ')} • Tocca per espandere
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    {/* Rounds Loop */}
                    {Array.from({ length: totalRounds }).map((_, roundIdx) => {
                      const roundNumber = roundIdx + 1;
                      const roundCompleted = isRoundDone(roundIdx);
                      const isCurrentRound = roundIdx === currentActiveRoundIdx && !allCircuitDone;

                      return (
                        <View
                          key={`circuit-round-${roundIdx}`}
                          style={[
                            styles.circuitRoundContainer,
                            isCurrentRound && (isInterval ? styles.circuitRoundActiveInterval : styles.circuitRoundActive),
                            roundCompleted && styles.circuitRoundCompleted,
                          ]}
                        >
                          <View style={styles.roundHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text
                                style={[
                                  styles.roundTitle,
                                  { color: isInterval ? '#EF4444' : '#eab308' },
                                ]}
                              >
                                GIRO {roundNumber} DI {totalRounds}
                              </Text>
                              {isCurrentRound && (
                                <View
                                  style={[
                                    styles.currentRoundBadge,
                                    isInterval && {
                                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                      borderColor: '#EF4444',
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.currentRoundBadgeText,
                                      isInterval && { color: '#EF4444' },
                                    ]}
                                  >
                                    IN CORSO
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.roundSubtitle}>
                              {roundCompleted
                                ? '✓ COMPLETATO'
                                : `${groupExs.filter((g) => g.ex.sets[roundIdx]?.completed).length}/${groupExs.length} ESERCIZI`}
                            </Text>
                          </View>

                          {/* Exercises in this Round */}
                          {groupExs.map(({ idx: globalExIdx, ex }, exInGroupIdx) => {
                            const set = ex.sets[roundIdx];
                            if (!set) return null;
                            const isLastExInRound = exInGroupIdx === groupExs.length - 1;
                            const isTimeSet =
                              !isInterval && (
                                ex.exerciseType === 'time' ||
                                Boolean(
                                  (set.targetTimeSeconds != null && Number(set.targetTimeSeconds) > 0) ||
                                  (set.time_seconds != null && Number(set.time_seconds) > 0)
                                )
                              );

                            return (
                              <React.Fragment key={`circuit-frag-${ex.exerciseId}-r-${roundIdx}`}>
                                <View
                                  style={[
                                    styles.circuitExCard,
                                    set.completed && styles.circuitExCardCompleted,
                                  ]}
                                >
                                  <View style={styles.circuitExHeader}>
                                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                      <View style={styles.circuitExOrderBadge}>
                                        <Text style={styles.circuitExOrderBadgeText}>{exInGroupIdx + 1}</Text>
                                      </View>
                                      <Text style={styles.circuitExName} numberOfLines={1}>
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

                                    {set.completed && (
                                      <View style={styles.circuitExCompletedBadge}>
                                        <Text style={styles.circuitExCompletedBadgeText}>✓ FATTO</Text>
                                      </View>
                                    )}
                                  </View>

                                  {/* Target vs Previous Badge */}
                                  <View style={styles.targetVsPrevRow}>
                                    <Text style={styles.targetVsPrevBadgeTarget}>
                                      🎯 {getTargetSetSummary(set, ex.exerciseType, isInterval)}
                                    </Text>
                                    <Text style={styles.targetVsPrevBadgePrev}>
                                      📈 {getPreviousSetSummary(ex.exerciseId, roundIdx, ex.exerciseType)}
                                    </Text>
                                  </View>

                                  {/* Set Inputs & Checkbox: Stacked Mobile Layout */}
                                  <View style={styles.stackedSetControlsRow}>
                                    {/* Left: Stacked Controls (Inputs on top, Actions/Timers below) */}
                                    <View style={styles.stackedControlsCol}>
                                      {/* Riga Superiore: Controlli Principali (Input) */}
                                      <View style={styles.stackedInputsRow}>
                                        {isInterval ? (
                                          ex.exerciseType === 'bodyweight' ? (
                                            <>
                                              <BandSelectDropdown
                                                compact
                                                disabled={false}
                                                value={set.band_assistance || 'none'}
                                                onChange={(val) => {
                                                  const up = [...liveExercises];
                                                  up[globalExIdx].sets[roundIdx].band_assistance = val;
                                                  setLiveExercises(up);
                                                }}
                                                style={styles.bandDropdownCompact}
                                              />

                                              {set.band_assistance === 'weighted' && (
                                                <View style={[styles.cellInputWrapper, styles.cellInputWrapperWeighted, set.completed && styles.cellInputWrapperCompleted]}>
                                                  <TextInput
                                                    style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                    keyboardType="decimal-pad"
                                                    editable={true}
                                                    value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                                    onChangeText={(val) => handleUpdateWeight(globalExIdx, roundIdx, val)}
                                                    placeholder="+0"
                                                    placeholderTextColor={colors.textMuted}
                                                  />
                                                  <Text style={styles.cellInputUnit}>+kg</Text>
                                                </View>
                                              )}

                                              <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                                <TextInput
                                                  style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                  keyboardType="numeric"
                                                  editable={true}
                                                  value={set.reps === 0 ? '' : String(set.reps)}
                                                  onChangeText={(val) => handleUpdateReps(globalExIdx, roundIdx, val)}
                                                  placeholder="0"
                                                  placeholderTextColor={colors.textMuted}
                                                />
                                                <Text style={styles.cellInputUnit}>reps</Text>
                                              </View>
                                            </>
                                          ) : (
                                            <>
                                              <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                                <TextInput
                                                  style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                  keyboardType="decimal-pad"
                                                  editable={true}
                                                  value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                                  onChangeText={(val) => handleUpdateWeight(globalExIdx, roundIdx, val)}
                                                  placeholder="0"
                                                  placeholderTextColor={colors.textMuted}
                                                />
                                                <Text style={styles.cellInputUnit}>kg</Text>
                                              </View>

                                              <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                                <TextInput
                                                  style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                  keyboardType="numeric"
                                                  editable={true}
                                                  value={set.reps === 0 ? '' : String(set.reps)}
                                                  onChangeText={(val) => handleUpdateReps(globalExIdx, roundIdx, val)}
                                                  placeholder="0"
                                                  placeholderTextColor={colors.textMuted}
                                                />
                                                <Text style={styles.cellInputUnit}>reps</Text>
                                              </View>
                                            </>
                                          )
                                        ) : (
                                          <>
                                            {!isTimeSet && ex.exerciseType === 'reps' && (
                                              <>
                                                <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                                  <TextInput
                                                    style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                    keyboardType="decimal-pad"
                                                    editable={!set.completed}
                                                    value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                                    onChangeText={(val) => handleUpdateWeight(globalExIdx, roundIdx, val)}
                                                    placeholder="0"
                                                    placeholderTextColor={colors.textMuted}
                                                  />
                                                  <Text style={styles.cellInputUnit}>kg</Text>
                                                </View>

                                                <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                                  <TextInput
                                                    style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                    keyboardType="numeric"
                                                    editable={!set.completed}
                                                    value={set.reps === 0 ? '' : String(set.reps)}
                                                    onChangeText={(val) => handleUpdateReps(globalExIdx, roundIdx, val)}
                                                    placeholder="0"
                                                    placeholderTextColor={colors.textMuted}
                                                  />
                                                  <Text style={styles.cellInputUnit}>reps</Text>
                                                </View>
                                              </>
                                            )}

                                            {!isTimeSet && ex.exerciseType === 'bodyweight' && (
                                              <>
                                                <BandSelectDropdown
                                                  compact
                                                  disabled={set.completed}
                                                  value={set.band_assistance || 'none'}
                                                  onChange={(val) => {
                                                    const up = [...liveExercises];
                                                    up[globalExIdx].sets[roundIdx].band_assistance = val;
                                                    setLiveExercises(up);
                                                  }}
                                                  style={styles.bandDropdownCompact}
                                                />

                                                {set.band_assistance === 'weighted' && (
                                                  <View style={[styles.cellInputWrapper, styles.cellInputWrapperWeighted, set.completed && styles.cellInputWrapperCompleted]}>
                                                    <TextInput
                                                      style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                      keyboardType="decimal-pad"
                                                      editable={!set.completed}
                                                      value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                                      onChangeText={(val) => handleUpdateWeight(globalExIdx, roundIdx, val)}
                                                      placeholder="+0"
                                                      placeholderTextColor={colors.textMuted}
                                                    />
                                                    <Text style={styles.cellInputUnit}>+kg</Text>
                                                  </View>
                                                )}

                                                <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                                  <TextInput
                                                    style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                    keyboardType="numeric"
                                                    editable={!set.completed}
                                                    value={set.reps === 0 ? '' : String(set.reps)}
                                                    onChangeText={(val) => handleUpdateReps(globalExIdx, roundIdx, val)}
                                                    placeholder="0"
                                                    placeholderTextColor={colors.textMuted}
                                                  />
                                                  <Text style={styles.cellInputUnit}>reps</Text>
                                                </View>
                                              </>
                                            )}

                                            {isTimeSet && (
                                              <>
                                                {ex.exerciseType === 'bodyweight' && (
                                                  <>
                                                    <BandSelectDropdown
                                                      compact
                                                      disabled={set.completed}
                                                      value={set.band_assistance || 'none'}
                                                      onChange={(val) => {
                                                        const up = [...liveExercises];
                                                        up[globalExIdx].sets[roundIdx].band_assistance = val;
                                                        setLiveExercises(up);
                                                      }}
                                                      style={styles.bandDropdownCompact}
                                                    />
                                                    {set.band_assistance === 'weighted' && (
                                                      <View style={[styles.cellInputWrapper, styles.cellInputWrapperWeighted, set.completed && styles.cellInputWrapperCompleted]}>
                                                        <TextInput
                                                          style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                          keyboardType="decimal-pad"
                                                          editable={!set.completed}
                                                          value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                                          onChangeText={(val) => handleUpdateWeight(globalExIdx, roundIdx, val)}
                                                          placeholder="+0"
                                                          placeholderTextColor={colors.textMuted}
                                                        />
                                                        <Text style={styles.cellInputUnit}>+kg</Text>
                                                      </View>
                                                    )}
                                                  </>
                                                )}
                                                {ex.exerciseType === 'reps' && (
                                                  <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                                    <TextInput
                                                      style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                      keyboardType="decimal-pad"
                                                      editable={!set.completed}
                                                      value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                                      onChangeText={(val) => handleUpdateWeight(globalExIdx, roundIdx, val)}
                                                      placeholder="0"
                                                      placeholderTextColor={colors.textMuted}
                                                    />
                                                    <Text style={styles.cellInputUnit}>kg</Text>
                                                  </View>
                                                )}
                                                <View style={styles.timeStepperRow}>
                                                  <Pressable
                                                    onPress={() => {
                                                      const cur = set.time_seconds ?? set.targetTimeSeconds ?? 60;
                                                      handleUpdateTimeSeconds(globalExIdx, roundIdx, String(Math.max(0, cur - 5)));
                                                    }}
                                                    style={styles.stepBtnCompact}
                                                    accessibilityRole="button"
                                                    accessibilityLabel="-5 secondi"
                                                  >
                                                    <Text style={styles.stepBtnCompactText}>-5s</Text>
                                                  </Pressable>

                                                  <View style={[styles.timeInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                                    <TextInput
                                                      style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                      keyboardType="numeric"
                                                      editable={!set.completed}
                                                      value={set.time_seconds === 0 ? '' : String(set.time_seconds ?? set.targetTimeSeconds ?? '')}
                                                      onChangeText={(val) => handleUpdateTimeSeconds(globalExIdx, roundIdx, val)}
                                                      placeholder="0"
                                                      placeholderTextColor={colors.textMuted}
                                                    />
                                                    <Text style={styles.cellInputUnit}>s</Text>
                                                  </View>

                                                  <Pressable
                                                    onPress={() => {
                                                      const cur = set.time_seconds ?? set.targetTimeSeconds ?? 60;
                                                      handleUpdateTimeSeconds(globalExIdx, roundIdx, String(cur + 5));
                                                    }}
                                                    style={styles.stepBtnCompact}
                                                    accessibilityRole="button"
                                                    accessibilityLabel="+5 secondi"
                                                  >
                                                    <Text style={styles.stepBtnCompactText}>+5s</Text>
                                                  </Pressable>
                                                </View>
                                              </>
                                            )}
                                          </>
                                        )}
                                      </View>

                                      {/* Riga Inferiore: Blocco Azioni (Timer Lavoro e/o Intra-Rest) */}
                                      {!isInterval && (isTimeSet || (!isLastExInRound && (ex.intraRestSeconds || 0) > 0)) && (
                                        <View style={styles.stackedActionsRow}>
                                          {isTimeSet && (
                                            <Pressable
                                              onPress={() => handleStartCircuitWorkTimer(secIdx, exInGroupIdx, roundIdx)}
                                              style={({ pressed }) => [
                                                styles.startWorkTimerBtnStacked,
                                                set.completed && styles.startWorkTimerBtnStackedCompleted,
                                                pressed && { opacity: 0.8 },
                                              ]}
                                              accessibilityRole="button"
                                              accessibilityLabel={`Avvia timer lavoro isometria ${set.time_seconds || set.targetTimeSeconds || 60} secondi`}
                                            >
                                              <Text style={styles.startWorkTimerBtnStackedText} numberOfLines={1}>
                                                ▶ {set.time_seconds || set.targetTimeSeconds || 60}s
                                              </Text>
                                            </Pressable>
                                          )}

                                          {!isLastExInRound && (ex.intraRestSeconds || 0) > 0 && (
                                            <Pressable
                                              onPress={() =>
                                                handleOpenCircuitIntraTimer(
                                                  ex.name,
                                                  groupExs[exInGroupIdx + 1]?.ex.name || 'Prossimo Esercizio',
                                                  roundIdx,
                                                  totalRounds,
                                                  ex.intraRestSeconds || 15
                                                )
                                              }
                                              style={[
                                                styles.inlineRestBtnStacked,
                                                isTimeSet && { flex: 0.85 },
                                              ]}
                                              accessibilityRole="button"
                                              accessibilityLabel={`Avvia recupero intra-esercizio di ${ex.intraRestSeconds} secondi verso ${groupExs[exInGroupIdx + 1]?.ex.name}`}
                                            >
                                              <Text style={styles.inlineRestBtnStackedText} numberOfLines={1}>
                                                ⏱️ {ex.intraRestSeconds}s
                                              </Text>
                                            </Pressable>
                                          )}
                                        </View>
                                      )}
                                    </View>

                                    {/* Right: Checkbox Dedicata e Ben Spaziata */}
                                    <View style={styles.stackedCheckboxContainer}>
                                      <Pressable
                                        onPress={() =>
                                          handleToggleCompleteCircuitSet(
                                            secIdx,
                                            exInGroupIdx,
                                            roundIdx
                                          )
                                        }
                                        style={[
                                          styles.checkboxBtn,
                                          set.completed && styles.checkboxBtnChecked,
                                          highlightedSetKeys.has(`${globalExIdx}-${roundIdx}`) && styles.checkboxBtnHighlighted,
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityLabel="Segna serie come completata"
                                      >
                                        {set.completed && <Text style={styles.checkmarkText}>✓</Text>}
                                      </Pressable>
                                    </View>
                                  </View>
                                </View>

                                {!isLastExInRound && <View style={styles.circuitExSeparator} />}
                              </React.Fragment>
                            );
                          })}

                          {/* Round End Rest Action Row */}
                          {roundIdx + 1 < totalRounds && (
                            <View style={styles.circuitRecoveryRow}>
                              <Pressable
                                onPress={() =>
                                  handleOpenCircuitRoundEndTimer(
                                    roundNumber,
                                    totalRounds,
                                    section.restBetweenRounds ?? (isInterval ? 30 : 60),
                                    groupExs[0].ex.name
                                  )
                                }
                                style={[
                                  styles.unifiedTimerBar,
                                  isInterval && styles.unifiedTimerBarInterval,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`Avvia recupero fine giro di ${section.restBetweenRounds ?? (isInterval ? 30 : 60)} secondi`}
                              >
                                <Text
                                  style={[
                                    styles.unifiedTimerBarText,
                                    isInterval && styles.unifiedTimerBarTextInterval,
                                  ]}
                                  numberOfLines={1}
                                >
                                  ⏱️ RECUPERO FINE GIRO {roundNumber} ({section.restBetweenRounds ?? (isInterval ? 30 : 60)}s)
                                </Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}
              </Card>
            );
          }

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
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={styles.supersetTagBadge}>
                      <Text style={styles.supersetTagBadgeText}>
                        ⚡ SUPER SERIE {section.supersetGroup}
                      </Text>
                    </View>
                    <Text style={typography.h3}>
                      {groupExs.map((g) => g.ex.name).join(' + ')}
                    </Text>
                    <Text style={typography.caption}>
                      ⚡ {maxRounds} Round • ⏱️ Rec. {groupExs[0]?.ex.restSeconds || 0}s
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
                          {groupExs.map(({ idx: exIdx, ex }, exInGroupIdx) => {
                            const set = ex.sets[roundIdx];
                            if (!set) return null;
                            const bStyle = getBadgeStyle(set.set_type);
                            const isLastExInGroup = exInGroupIdx === groupExs.length - 1;
                            const isTimeSet =
                              ex.exerciseType === 'time' ||
                              Boolean(
                                (set.targetTimeSeconds != null && Number(set.targetTimeSeconds) > 0) ||
                                (set.time_seconds != null && Number(set.time_seconds) > 0)
                              );

                            return (
                              <React.Fragment key={`ss-frag-${ex.exerciseId}-s-${roundIdx}`}>
                                <View
                                  style={[
                                    styles.supersetExCard,
                                    set.completed && styles.supersetExCardCompleted,
                                  ]}
                                >
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
                                      🎯 {getTargetSetSummary(set, ex.exerciseType)}
                                    </Text>
                                    <Text style={styles.targetVsPrevBadgePrev}>
                                      📈 {getPreviousSetSummary(ex.exerciseId, roundIdx, ex.exerciseType)}
                                    </Text>
                                  </View>

                                  {/* Set Inputs & Checkbox: Stacked Mobile Layout */}
                                  <View style={styles.stackedSetControlsRow}>
                                    {/* Left: Stacked Controls (Inputs on top, Actions/Timers below) */}
                                    <View style={styles.stackedControlsCol}>
                                      {/* Riga Superiore: Controlli Principali (Input) */}
                                      <View style={styles.stackedInputsRow}>
                                        {!isTimeSet && ex.exerciseType === 'reps' && (
                                          <>
                                            <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                              <TextInput
                                                style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                keyboardType="decimal-pad"
                                                editable={!set.completed}
                                                value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                                onChangeText={(val) => handleUpdateWeight(exIdx, roundIdx, val)}
                                                placeholder="0"
                                                placeholderTextColor={colors.textMuted}
                                              />
                                              <Text style={styles.cellInputUnit}>kg</Text>
                                            </View>

                                            <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                              <TextInput
                                                style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                keyboardType="numeric"
                                                editable={!set.completed}
                                                value={set.reps === 0 ? '' : String(set.reps)}
                                                onChangeText={(val) => handleUpdateReps(exIdx, roundIdx, val)}
                                                placeholder="0"
                                                placeholderTextColor={colors.textMuted}
                                              />
                                              <Text style={styles.cellInputUnit}>reps</Text>
                                            </View>
                                          </>
                                        )}

                                        {!isTimeSet && ex.exerciseType === 'bodyweight' && (
                                          <>
                                            <BandSelectDropdown
                                              compact
                                              disabled={set.completed}
                                              value={set.band_assistance || 'none'}
                                              onChange={(val) => {
                                                const updated = [...liveExercises];
                                                updated[exIdx].sets[roundIdx].band_assistance = val;
                                                setLiveExercises(updated);
                                              }}
                                              style={styles.bandDropdownCompact}
                                            />

                                            {set.band_assistance === 'weighted' && (
                                              <View style={[styles.cellInputWrapper, styles.cellInputWrapperWeighted, set.completed && styles.cellInputWrapperCompleted]}>
                                                <TextInput
                                                  style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                  keyboardType="decimal-pad"
                                                  editable={!set.completed}
                                                  value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                                  onChangeText={(val) => handleUpdateWeight(exIdx, roundIdx, val)}
                                                  placeholder="+0"
                                                  placeholderTextColor={colors.textMuted}
                                                />
                                                <Text style={styles.cellInputUnit}>+kg</Text>
                                              </View>
                                            )}

                                            <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                              <TextInput
                                                style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                keyboardType="numeric"
                                                editable={!set.completed}
                                                value={set.reps === 0 ? '' : String(set.reps)}
                                                onChangeText={(val) => handleUpdateReps(exIdx, roundIdx, val)}
                                                placeholder="0"
                                                placeholderTextColor={colors.textMuted}
                                              />
                                              <Text style={styles.cellInputUnit}>reps</Text>
                                            </View>
                                          </>
                                        )}

                                        {isTimeSet && (
                                          <>
                                            {ex.exerciseType === 'bodyweight' && (
                                              <>
                                                <BandSelectDropdown
                                                  compact
                                                  disabled={set.completed}
                                                  value={set.band_assistance || 'none'}
                                                  onChange={(val) => {
                                                    const updated = [...liveExercises];
                                                    updated[exIdx].sets[roundIdx].band_assistance = val;
                                                    setLiveExercises(updated);
                                                  }}
                                                  style={styles.bandDropdownCompact}
                                                />
                                                {set.band_assistance === 'weighted' && (
                                                  <View style={[styles.cellInputWrapper, styles.cellInputWrapperWeighted, set.completed && styles.cellInputWrapperCompleted]}>
                                                    <TextInput
                                                      style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                      keyboardType="decimal-pad"
                                                      editable={!set.completed}
                                                      value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                                      onChangeText={(val) => handleUpdateWeight(exIdx, roundIdx, val)}
                                                      placeholder="+0"
                                                      placeholderTextColor={colors.textMuted}
                                                    />
                                                    <Text style={styles.cellInputUnit}>+kg</Text>
                                                  </View>
                                                )}
                                              </>
                                            )}
                                            {ex.exerciseType === 'reps' && (
                                              <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                                <TextInput
                                                  style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                  keyboardType="decimal-pad"
                                                  editable={!set.completed}
                                                  value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                                  onChangeText={(val) => handleUpdateWeight(exIdx, roundIdx, val)}
                                                  placeholder="0"
                                                  placeholderTextColor={colors.textMuted}
                                                />
                                                <Text style={styles.cellInputUnit}>kg</Text>
                                              </View>
                                            )}
                                            <View style={styles.timeStepperRow}>
                                              <Pressable
                                                onPress={() => {
                                                  const cur = set.time_seconds ?? set.targetTimeSeconds ?? 60;
                                                  handleUpdateTimeSeconds(exIdx, roundIdx, String(Math.max(0, cur - 5)));
                                                }}
                                                style={styles.stepBtnCompact}
                                                accessibilityRole="button"
                                                accessibilityLabel="-5 secondi"
                                              >
                                                <Text style={styles.stepBtnCompactText}>-5s</Text>
                                              </Pressable>

                                              <View style={[styles.timeInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                                <TextInput
                                                  style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                                  keyboardType="numeric"
                                                  editable={!set.completed}
                                                  value={set.time_seconds === 0 ? '' : String(set.time_seconds ?? set.targetTimeSeconds ?? '')}
                                                  onChangeText={(val) => handleUpdateTimeSeconds(exIdx, roundIdx, val)}
                                                  placeholder="0"
                                                  placeholderTextColor={colors.textMuted}
                                                />
                                                <Text style={styles.cellInputUnit}>s</Text>
                                              </View>

                                              <Pressable
                                                onPress={() => {
                                                  const cur = set.time_seconds ?? set.targetTimeSeconds ?? 60;
                                                  handleUpdateTimeSeconds(exIdx, roundIdx, String(cur + 5));
                                                }}
                                                style={styles.stepBtnCompact}
                                                accessibilityRole="button"
                                                accessibilityLabel="+5 secondi"
                                              >
                                                <Text style={styles.stepBtnCompactText}>+5s</Text>
                                              </Pressable>
                                            </View>
                                          </>
                                        )}
                                      </View>

                                      {/* Riga Inferiore: Blocco Azioni (Timer Lavoro) */}
                                      {isTimeSet && (
                                        <View style={styles.stackedActionsRow}>
                                          <Pressable
                                            onPress={() => handleStartSupersetWorkTimer(secIdx, exIdx, roundIdx)}
                                            style={({ pressed }) => [
                                              styles.startWorkTimerBtnStacked,
                                              set.completed && styles.startWorkTimerBtnStackedCompleted,
                                              pressed && { opacity: 0.8 },
                                            ]}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Avvia timer lavoro isometria ${set.time_seconds || set.targetTimeSeconds || 60} secondi`}
                                          >
                                            <Text style={styles.startWorkTimerBtnStackedText} numberOfLines={1}>
                                              ▶ {set.time_seconds || set.targetTimeSeconds || 60}s
                                            </Text>
                                          </Pressable>
                                        </View>
                                      )}
                                    </View>

                                    {/* Right: Checkbox Dedicata e Ben Spaziata */}
                                    <View style={styles.stackedCheckboxContainer}>
                                      <Pressable
                                        onPress={() => handleToggleComplete(exIdx, roundIdx)}
                                        style={[
                                          styles.checkboxBtn,
                                          set.completed && styles.checkboxBtnChecked,
                                          highlightedSetKeys.has(`${exIdx}-${roundIdx}`) && styles.checkboxBtnHighlighted,
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityLabel="Segna serie come completata"
                                      >
                                        {set.completed && <Text style={styles.checkmarkText}>✓</Text>}
                                      </Pressable>
                                    </View>
                                  </View>
                                </View>

                                {!isLastExInGroup && <View style={styles.supersetExSeparator} />}
                              </React.Fragment>
                            );
                          })}

                          {/* Post-Superset Recovery Row with Fullscreen Timer Overlay Trigger */}
                          <View style={styles.supersetRecoveryRow}>
                            <Pressable
                              onPress={() =>
                                handleOpenRestTimerForSupersetRound(
                                  section.supersetGroup || '',
                                  roundIdx,
                                  section.exerciseIndices
                                )
                              }
                              style={styles.unifiedTimerBar}
                              accessibilityRole="button"
                              accessibilityLabel={`Avvia recupero super serie di ${groupExs[0].ex.restSeconds || 90} secondi`}
                            >
                              <Text style={styles.unifiedTimerBarText} numberOfLines={1}>
                                ⏱️ RECUPERO SUPER SERIE ({groupExs[0].ex.restSeconds || 90}s)
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
                    <Text style={[styles.colHeader, { width: 44, textAlign: 'center', marginRight: 8 }]}>SET</Text>
                    <Text style={[styles.colHeader, { flex: 1, textAlign: 'center' }]}>
                      {exercise.exerciseType === 'time' ||
                      exercise.sets.some((s) =>
                        Boolean(
                          (s.targetTimeSeconds != null && Number(s.targetTimeSeconds) > 0) ||
                          (s.time_seconds != null && Number(s.time_seconds) > 0)
                        )
                      )
                        ? 'OBIETTIVO & LAVORO'
                        : 'CARICO & RIPETIZIONI'}
                    </Text>
                    <Text style={[styles.colHeader, { width: 48, textAlign: 'center', marginLeft: 12 }]}>FATTA</Text>
                  </View>

                  {/* Execution Set Rows */}
                  {exercise.sets.map((set, setIdx) => {
                    const bStyle = getBadgeStyle(set.set_type);
                    const restSecs = set.rest_seconds !== undefined && set.rest_seconds !== null
                      ? set.rest_seconds
                      : (exercise.restSeconds !== undefined && exercise.restSeconds !== null ? exercise.restSeconds : 90);
                    const restId = `rest-${exIdx}-${setIdx}`;
                    const isRestActive = activeCountdown?.id === restId;
                    const normalizedSetType = String(set.set_type || '').toLowerCase();
                    const isSpecial = normalizedSetType === 'dropset' || normalizedSetType === 'stripping' || normalizedSetType === 'rest_pause';

                    if (isSpecial) {
                      const isRp = normalizedSetType === 'rest_pause';
                      const rpRest = (set as any).rest_pause_seconds ?? 20;
                      const clusterCount = Math.max(2, (set as any).drop_count || (isRp ? 3 : 2));
                      const firstReps = set.reps || 10;
                      const clusterReps = Math.max(2, Math.floor(firstReps / 2)) || 4;

                      let fallbackDrops: SetDropStep[];
                      if (isRp) {
                        fallbackDrops = Array.from({ length: clusterCount }).map((_, cIdx) => ({
                          id: `rp-${cIdx}`,
                          kg: set.weight_kg || 0,
                          reps: cIdx === 0 ? firstReps : clusterReps,
                          rest_seconds: rpRest,
                        }));
                      } else {
                        const baseKg = set.weight_kg || 0;
                        fallbackDrops = Array.from({ length: clusterCount }).map((_, dIdx) => ({
                          id: `drop-${dIdx}`,
                          kg: dIdx === 0 ? baseKg : (set.dropset_weight_kg || Math.round(baseKg * 0.8)),
                          reps: set.reps || 8,
                          rest_seconds: 0,
                        }));
                      }

                      const drops = set.drops && set.drops.length > 0 ? set.drops : fallbackDrops;

                      return (
                        <View
                          key={set.tempId || `live-s-${setIdx}`}
                          style={[
                            styles.setRowBlock,
                            set.completed && styles.setRowBlockCompleted,
                          ]}
                        >
                          {/* Header Serie: S{X} [BADGE STRIPPING / REST-PAUSE] + Checkbox */}
                          <View style={styles.specialSetHeaderRow}>
                            <View style={styles.specialSetBadgeCol}>
                              <Text style={styles.setNumText}>S{set.set_number}</Text>
                              <View style={[styles.setTypeBadge, { backgroundColor: bStyle.bg }]}>
                                <Text style={[styles.setTypeBadgeText, { color: bStyle.text }]} numberOfLines={1}>
                                  {bStyle.label}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.stackedCheckboxContainer}>
                              <Pressable
                                onPress={() => handleToggleComplete(exIdx, setIdx)}
                                style={[
                                  styles.checkboxBtn,
                                  set.completed && styles.checkboxBtnChecked,
                                  highlightedSetKeys.has(`${exIdx}-${setIdx}`) && styles.checkboxBtnHighlighted,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel="Segna serie come completata"
                              >
                                {set.completed && <Text style={styles.checkmarkText}>✓</Text>}
                              </Pressable>
                            </View>
                          </View>

                          {/* Dual Comparison Badge: Target vs Prec */}
                          <View style={styles.targetVsPrevRow}>
                            <Text style={styles.targetVsPrevBadgeTarget}>
                              🎯 {getTargetSetSummary(set, exercise.exerciseType)}
                            </Text>
                            <Text style={styles.targetVsPrevBadgePrev}>
                              📈 {getPreviousSetSummary(exercise.exerciseId, setIdx, exercise.exerciseType)}
                            </Text>
                          </View>

                          {/* Lista degli Step */}
                          <View style={styles.liveDropsContainer}>
                            {drops.map((drop, dIdx) => {
                              const isLastDrop = dIdx === drops.length - 1;
                              const intraSecs =
                                drop.rest_seconds !== undefined
                                  ? drop.rest_seconds
                                  : isRp
                                  ? rpRest
                                  : 0;

                              return (
                                <View key={drop.id || `drop-${dIdx}`} style={styles.liveDropStepCard}>
                                  <View style={styles.liveDropStepHeaderRow}>
                                    <View style={styles.liveDropBadge}>
                                      <Text style={styles.liveDropBadgeText}>Step {dIdx + 1}</Text>
                                    </View>
                                    <Text style={styles.liveDropStepTitle}>
                                      {isRp ? 'Cluster Rest-Pause' : 'Scarico Carico'}
                                    </Text>
                                  </View>

                                  {/* Controlli Principali (Input Kg e Reps) */}
                                  <View style={styles.stackedInputsRow}>
                                    <View
                                      style={[
                                        styles.cellInputWrapper,
                                        set.completed && styles.cellInputWrapperCompleted,
                                      ]}
                                    >
                                      <TextInput
                                        style={[
                                          styles.cellTextInput,
                                          set.completed && styles.cellTextInputCompleted,
                                        ]}
                                        keyboardType="decimal-pad"
                                        editable={!set.completed}
                                        value={drop.kg === 0 ? '' : String(drop.kg ?? '')}
                                        onChangeText={(val) => handleUpdateDropKg(exIdx, setIdx, dIdx, val)}
                                        placeholder="0"
                                        placeholderTextColor={colors.textMuted}
                                      />
                                      <Text style={styles.cellInputUnit} pointerEvents="none">kg</Text>
                                    </View>

                                    <View
                                      style={[
                                        styles.cellInputWrapper,
                                        set.completed && styles.cellInputWrapperCompleted,
                                      ]}
                                    >
                                      <TextInput
                                        style={[
                                          styles.cellTextInput,
                                          set.completed && styles.cellTextInputCompleted,
                                        ]}
                                        keyboardType="numeric"
                                        editable={!set.completed}
                                        value={drop.reps === 0 ? '' : String(drop.reps ?? '')}
                                        onChangeText={(val) => handleUpdateDropReps(exIdx, setIdx, dIdx, val)}
                                        placeholder="0"
                                        placeholderTextColor={colors.textMuted}
                                      />
                                      <Text style={styles.cellInputUnit} pointerEvents="none">reps</Text>
                                    </View>
                                  </View>

                                  {/* Recupero Intermedio (Apertura Timer Fullscreen) */}
                                  {!isLastDrop && intraSecs > 0 && (
                                    <Pressable
                                      onPress={() => handleOpenIntraRestTimer(exIdx, setIdx, dIdx)}
                                      style={({ pressed }) => [
                                        styles.liveDropTimerBtnStacked,
                                        pressed && { opacity: 0.8 },
                                      ]}
                                      accessibilityRole="button"
                                      accessibilityLabel={`Avvia pausa intra serie di ${intraSecs} secondi verso step ${dIdx + 2}`}
                                    >
                                      <Text style={styles.liveDropTimerBtnStackedText} numberOfLines={1}>
                                        ⏱ Avvia Pausa Step {dIdx + 1} → {dIdx + 2} ({intraSecs}s)
                                      </Text>
                                    </Pressable>
                                  )}
                                </View>
                              );
                            })}
                          </View>

                          {/* Recupero Finale Serie */}
                          {restSecs > 0 && (
                            <Pressable
                              onPress={() => handleOpenRestTimerForSet(exIdx, setIdx)}
                              style={[
                                styles.specialSetFinalRestBtn,
                                isRestActive && (activeCountdown?.isRunning ? styles.inlineRestBtnStackedRunning : styles.inlineRestBtnStackedPaused),
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel={`Avvia recupero finale di ${restSecs} secondi`}
                            >
                              <Text style={[styles.specialSetFinalRestBtnText, isRestActive && { color: '#FFFFFF' }]} numberOfLines={1}>
                                {isRestActive
                                  ? `${activeCountdown?.isRunning ? '⏱' : '⏸'} ${formatCountdown(activeCountdown?.secondsLeft || 0)}`
                                  : `⏱️ Recupero Finale (${restSecs}s)`}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    }

                    const isTimeSet =
                      exercise.exerciseType === 'time' ||
                      Boolean(
                        (set.targetTimeSeconds != null && Number(set.targetTimeSeconds) > 0) ||
                        (set.time_seconds != null && Number(set.time_seconds) > 0)
                      );

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
                            🎯 {getTargetSetSummary(set, exercise.exerciseType)}
                          </Text>
                          <Text style={styles.targetVsPrevBadgePrev}>
                            📈 {getPreviousSetSummary(exercise.exerciseId, setIdx, exercise.exerciseType)}
                          </Text>
                        </View>

                        <View style={styles.setMainRow}>
                          {/* Colonna 1: Tipo Serie & Numero */}
                          <View style={styles.colSetType}>
                            <Text style={styles.setNumText}>S{set.set_number}</Text>
                            <View style={[styles.setTypeBadge, { backgroundColor: bStyle.bg }]}>
                              <Text style={[styles.setTypeBadgeText, { color: bStyle.text }]} numberOfLines={1}>
                                {bStyle.label}
                              </Text>
                            </View>
                          </View>

                          {/* Colonna 2: Stacked Controls (Inputs on top, Actions/Timers below) */}
                          <View style={styles.stackedControlsCol}>
                            {/* Riga Superiore: Controlli Principali (Input) */}
                            <View style={styles.stackedInputsRow}>
                              {!isTimeSet && exercise.exerciseType === 'reps' && (
                                <>
                                  <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                    <TextInput
                                      style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                      keyboardType="decimal-pad"
                                      editable={!set.completed}
                                      value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                      onChangeText={(val) => handleUpdateWeight(exIdx, setIdx, val)}
                                      placeholder="0"
                                      placeholderTextColor={colors.textMuted}
                                    />
                                    <Text style={styles.cellInputUnit} pointerEvents="none">kg</Text>
                                  </View>

                                  <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                    <TextInput
                                      style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                      keyboardType="numeric"
                                      editable={!set.completed}
                                      value={set.reps === 0 ? '' : String(set.reps)}
                                      onChangeText={(val) => handleUpdateReps(exIdx, setIdx, val)}
                                      placeholder="0"
                                      placeholderTextColor={colors.textMuted}
                                    />
                                    <Text style={styles.cellInputUnit} pointerEvents="none">reps</Text>
                                  </View>
                                </>
                              )}

                              {!isTimeSet && exercise.exerciseType === 'bodyweight' && (
                                <>
                                  <BandSelectDropdown
                                    compact
                                    disabled={set.completed}
                                    value={set.band_assistance || 'none'}
                                    onChange={(val) => {
                                      const updated = [...liveExercises];
                                      updated[exIdx].sets[setIdx].band_assistance = val;
                                      setLiveExercises(updated);
                                    }}
                                    style={styles.bandDropdownCompact}
                                  />

                                  {set.band_assistance === 'weighted' && (
                                    <View style={[styles.cellInputWrapper, styles.cellInputWrapperWeighted, set.completed && styles.cellInputWrapperCompleted]}>
                                      <TextInput
                                        style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                        keyboardType="decimal-pad"
                                        editable={!set.completed}
                                        value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                        onChangeText={(val) => handleUpdateWeight(exIdx, setIdx, val)}
                                        placeholder="+0"
                                        placeholderTextColor={colors.textMuted}
                                      />
                                      <Text style={styles.cellInputUnit} pointerEvents="none">+kg</Text>
                                    </View>
                                  )}

                                  <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                    <TextInput
                                      style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                      keyboardType="numeric"
                                      editable={!set.completed}
                                      value={set.reps === 0 ? '' : String(set.reps)}
                                      onChangeText={(val) => handleUpdateReps(exIdx, setIdx, val)}
                                      placeholder="0"
                                      placeholderTextColor={colors.textMuted}
                                    />
                                    <Text style={styles.cellInputUnit} pointerEvents="none">reps</Text>
                                  </View>
                                </>
                              )}

                              {isTimeSet && (
                                <>
                                  {exercise.exerciseType === 'bodyweight' && (
                                    <>
                                      <BandSelectDropdown
                                        compact
                                        disabled={set.completed}
                                        value={set.band_assistance || 'none'}
                                        onChange={(val) => {
                                          const updated = [...liveExercises];
                                          updated[exIdx].sets[setIdx].band_assistance = val;
                                          setLiveExercises(updated);
                                        }}
                                        style={styles.bandDropdownCompact}
                                      />
                                      {set.band_assistance === 'weighted' && (
                                        <View style={[styles.cellInputWrapper, styles.cellInputWrapperWeighted, set.completed && styles.cellInputWrapperCompleted]}>
                                          <TextInput
                                            style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                            keyboardType="decimal-pad"
                                            editable={!set.completed}
                                            value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                            onChangeText={(val) => handleUpdateWeight(exIdx, setIdx, val)}
                                            placeholder="+0"
                                            placeholderTextColor={colors.textMuted}
                                          />
                                          <Text style={styles.cellInputUnit} pointerEvents="none">+kg</Text>
                                        </View>
                                      )}
                                    </>
                                  )}
                                  {exercise.exerciseType === 'reps' && (
                                    <View style={[styles.cellInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                      <TextInput
                                        style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                        keyboardType="decimal-pad"
                                        editable={!set.completed}
                                        value={set.weight_kg === 0 ? '' : String(set.weight_kg)}
                                        onChangeText={(val) => handleUpdateWeight(exIdx, setIdx, val)}
                                        placeholder="0"
                                        placeholderTextColor={colors.textMuted}
                                      />
                                      <Text style={styles.cellInputUnit} pointerEvents="none">kg</Text>
                                    </View>
                                  )}
                                  <View style={styles.timeStepperRow}>
                                    <Pressable
                                      onPress={() => {
                                        const cur = set.time_seconds ?? set.targetTimeSeconds ?? 60;
                                        handleUpdateTimeSeconds(exIdx, setIdx, String(Math.max(0, cur - 5)));
                                      }}
                                      style={styles.stepBtnCompact}
                                      accessibilityRole="button"
                                      accessibilityLabel="-5 secondi"
                                    >
                                      <Text style={styles.stepBtnCompactText}>-5s</Text>
                                    </Pressable>

                                    <View style={[styles.timeInputWrapper, set.completed && styles.cellInputWrapperCompleted]}>
                                      <TextInput
                                        style={[styles.cellTextInput, set.completed && styles.cellTextInputCompleted]}
                                        keyboardType="numeric"
                                        editable={!set.completed}
                                        value={set.time_seconds === 0 ? '' : String(set.time_seconds ?? set.targetTimeSeconds ?? '')}
                                        onChangeText={(val) => handleUpdateTimeSeconds(exIdx, setIdx, val)}
                                        placeholder="0"
                                        placeholderTextColor={colors.textMuted}
                                      />
                                      <Text style={styles.cellInputUnit} pointerEvents="none">s</Text>
                                    </View>

                                    <Pressable
                                      onPress={() => {
                                        const cur = set.time_seconds ?? set.targetTimeSeconds ?? 60;
                                        handleUpdateTimeSeconds(exIdx, setIdx, String(cur + 5));
                                      }}
                                      style={styles.stepBtnCompact}
                                      accessibilityRole="button"
                                      accessibilityLabel="+5 secondi"
                                    >
                                      <Text style={styles.stepBtnCompactText}>+5s</Text>
                                    </Pressable>
                                  </View>
                                </>
                              )}
                            </View>

                            {/* Riga Inferiore: Blocco Azioni (Timer Lavoro e/o Recupero) */}
                            {(isTimeSet || restSecs > 0) && (
                              <View style={styles.stackedActionsRow}>
                                {isTimeSet && (
                                  <Pressable
                                    onPress={() => handleStartWorkTimer(exIdx, setIdx)}
                                    style={({ pressed }) => [
                                      styles.startWorkTimerBtnStacked,
                                      set.completed && styles.startWorkTimerBtnStackedCompleted,
                                      pressed && { opacity: 0.8 },
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Avvia timer lavoro ${set.time_seconds || set.targetTimeSeconds || 60} secondi`}
                                  >
                                    <Text style={styles.startWorkTimerBtnStackedText} numberOfLines={1}>
                                      ▶ {set.time_seconds || set.targetTimeSeconds || 60}s
                                    </Text>
                                  </Pressable>
                                )}

                                {restSecs > 0 && (
                                  <Pressable
                                    onPress={() => handleOpenRestTimerForSet(exIdx, setIdx)}
                                    style={[
                                      styles.inlineRestBtnStacked,
                                      isRestActive && (activeCountdown?.isRunning ? styles.inlineRestBtnStackedRunning : styles.inlineRestBtnStackedPaused),
                                      isTimeSet && { flex: 0.85 },
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Avvia recupero serie di ${restSecs} secondi`}
                                  >
                                    <Text style={[styles.inlineRestBtnStackedText, isRestActive && { color: '#FFFFFF' }]} numberOfLines={1}>
                                      {isRestActive
                                        ? `${activeCountdown?.isRunning ? '⏱' : '⏸'} ${formatCountdown(activeCountdown?.secondsLeft || 0)}`
                                        : `⏱️ ${restSecs}s`}
                                    </Text>
                                  </Pressable>
                                )}
                              </View>
                            )}
                          </View>

                          {/* Colonna 3: Checkbox Dedicata e Ben Spaziata */}
                          <View style={styles.stackedCheckboxContainer}>
                            <Pressable
                              onPress={() => handleToggleComplete(exIdx, setIdx)}
                              style={[
                                styles.checkboxBtn,
                                set.completed && styles.checkboxBtnChecked,
                                highlightedSetKeys.has(`${exIdx}-${setIdx}`) && styles.checkboxBtnHighlighted,
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="Segna serie come completata"
                            >
                              {set.completed && <Text style={styles.checkmarkText}>✓</Text>}
                            </Pressable>
                          </View>
                        </View>
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

      {/* Active Floating Countdown Bar */}
      {activeCountdown && (
        <View style={styles.floatingTimerBar}>
          <View style={styles.floatingTimerInfo}>
            <View style={styles.floatingTimerTagRow}>
              <View
                style={[
                  styles.floatingTimerTag,
                  activeCountdown.type === 'work' && { backgroundColor: 'rgba(245, 158, 11, 0.25)', borderColor: colors.warning },
                  activeCountdown.type === 'round' && { backgroundColor: 'rgba(234, 179, 8, 0.25)', borderColor: '#eab308' },
                ]}
              >
                <Text
                  style={[
                    styles.floatingTimerTagText,
                    activeCountdown.type === 'work' && { color: colors.warning },
                    activeCountdown.type === 'round' && { color: '#eab308' },
                  ]}
                >
                  {activeCountdown.type === 'work'
                    ? '⚡ LAVORO'
                    : activeCountdown.type === 'round'
                    ? '🔄 REC. GIRO'
                    : activeCountdown.type === 'intra'
                    ? '⏱ INTRA'
                    : '⏱ RECUPERO'}
                </Text>
              </View>
              <Text style={styles.floatingTimerTitle} numberOfLines={1}>
                {activeCountdown.title}
              </Text>
            </View>
            {Boolean(activeCountdown.subtitle) && (
              <Text style={styles.floatingTimerSubtitle} numberOfLines={1}>
                {activeCountdown.subtitle}
              </Text>
            )}
          </View>

          <Text
            style={[
              styles.floatingTimerClock,
              activeCountdown.secondsLeft <= 5 && { color: colors.danger },
            ]}
          >
            {formatCountdown(activeCountdown.secondsLeft)}
          </Text>

          <View style={styles.floatingTimerActions}>
            <Pressable
              onPress={togglePauseCountdown}
              style={[
                styles.floatingTimerBtn,
                !activeCountdown.isRunning && styles.floatingTimerBtnResume,
              ]}
              accessibilityRole="button"
              accessibilityLabel={activeCountdown.isRunning ? "Pausa timer" : "Riprendi timer"}
            >
              <Text style={styles.floatingTimerBtnText}>
                {activeCountdown.isRunning ? '⏸' : '▶'}
              </Text>
            </Pressable>

            <Pressable
              onPress={resetCountdown}
              style={styles.floatingTimerBtnSecondary}
              accessibilityRole="button"
              accessibilityLabel="Resetta timer"
            >
              <Text style={styles.floatingTimerBtnSecondaryText}>↺</Text>
            </Pressable>

            <Pressable
              onPress={dismissCountdown}
              style={styles.floatingTimerBtnSecondary}
              accessibilityRole="button"
              accessibilityLabel="Chiudi timer"
            >
              <Text style={styles.floatingTimerBtnSecondaryText}>✕</Text>
            </Pressable>
          </View>
        </View>
      )}

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
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
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
  circuitSectionCard: {
    marginBottom: 16,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#eab308',
  },
  circuitSectionCardStandard: {
    borderLeftWidth: 5,
    borderLeftColor: '#F59E0B',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  circuitSectionCardInterval: {
    borderLeftWidth: 5,
    borderLeftColor: '#EF4444',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  circuitBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  circuitTagBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  circuitTagBadgeText: {
    color: '#eab308',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  circuitTagBadgeStandard: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: 'rgba(234, 179, 8, 0.4)',
  },
  circuitTagBadgeTextStandard: {
    color: '#eab308',
  },
  circuitTagBadgeInterval: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  circuitTagBadgeTextInterval: {
    color: '#EF4444',
  },
  startHandsFreeBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 12,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  startHandsFreeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  circuitRoundContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: layout.borderRadiusMd,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
    padding: 12,
    marginBottom: 12,
  },
  circuitRoundActive: {
    borderColor: 'rgba(234, 179, 8, 0.5)',
    backgroundColor: 'rgba(234, 179, 8, 0.03)',
  },
  circuitRoundActiveInterval: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(239, 68, 68, 0.03)',
  },
  circuitRoundCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  currentRoundBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentRoundBadgeText: {
    color: '#eab308',
    fontSize: 9,
    fontWeight: '800',
  },
  circuitExCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.7)',
    borderRadius: layout.borderRadiusSm,
    padding: 10,
    marginVertical: 4,
  },
  circuitExCardCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  circuitExCompletedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  circuitExCompletedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.emerald,
    letterSpacing: 0.3,
  },
  intraRestDividerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.35)',
    borderStyle: 'dashed',
    borderRadius: layout.borderRadiusSm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 6,
  },
  intraRestDividerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  intraRestDividerIcon: {
    fontSize: 16,
    color: colors.accent,
  },
  intraRestDividerTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  intraRestDividerSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 1,
  },
  intraRestDividerBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  intraRestDividerBtnText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
  },
  circuitExSeparator: {
    height: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
    marginVertical: 6,
  },
  circuitExRow: {
    marginBottom: 10,
  },
  circuitExHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  circuitExOrderBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    borderWidth: 1,
    borderColor: '#eab308',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuitExOrderBadgeText: {
    color: '#eab308',
    fontSize: 10,
    fontWeight: '800',
  },
  circuitExName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  circuitRecoveryRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(234, 179, 8, 0.3)',
  },
  supersetSectionCard: {
    marginBottom: 16,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  supersetBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  supersetExCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.7)',
    borderRadius: layout.borderRadiusSm,
    padding: 10,
    marginVertical: 4,
  },
  supersetExCardCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  supersetExSeparator: {
    height: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
    marginVertical: 6,
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
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(234, 179, 8, 0.3)',
  },
  unifiedTimerBar: {
    width: '100%',
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1.5,
    borderColor: '#eab308',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  unifiedTimerBarText: {
    color: '#eab308',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  unifiedTimerBarInterval: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  unifiedTimerBarTextInterval: {
    color: '#EF4444',
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
    width: '100%',
  },
  colSetType: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stackedSetControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  stackedControlsCol: {
    flex: 1,
  },
  stackedInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stackedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  stackedCheckboxContainer: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeStepperRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colInputs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginRight: 6,
    gap: 4,
  },
  colAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 14,
  },
  setTypeBadge: {
    width: '100%',
    maxWidth: 44,
    height: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  setTypeBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  inputBoxCompact: {
    paddingHorizontal: 2,
    fontSize: 12,
  },
  inputsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cellInputWrapper: {
    height: 48,
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    minWidth: 0,
    justifyContent: 'center',
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cellInputWrapperWeighted: {
    flex: 0.85,
  },
  cellInputWrapperCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  cellTextInput: {
    flex: 1,
    width: '100%',
    height: 48,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 0,
    paddingLeft: 8,
    paddingRight: 32,
  },
  cellTextInputCompleted: {
    color: colors.emerald,
  },
  cellInputUnit: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    lineHeight: 48,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'lowercase',
    pointerEvents: 'none' as any,
  },
  bandDropdownCompact: {
    height: 48,
    flex: 1.2,
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
  timeInputRowClean: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  timeInputRowInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeInputWrapper: {
    flex: 1,
    height: 48,
    position: 'relative',
    overflow: 'hidden',
    minWidth: 0,
    justifyContent: 'center',
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  stepBtnCompact: {
    width: 48,
    height: 48,
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnCompactText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  startWorkTimerBtnStacked: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderWidth: 1.5,
    borderColor: '#0EA5E9',
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  startWorkTimerBtnStackedCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: colors.emerald,
  },
  startWorkTimerBtnStackedText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  inlineRestBtnStacked: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1.5,
    borderColor: '#eab308',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  inlineRestBtnStackedRunning: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  inlineRestBtnStackedPaused: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  inlineRestBtnStackedText: {
    color: '#eab308',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  timeInputBoxInline: {
    width: 44,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 2,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  startWorkTimerBtnInline: {
    height: 44,
    flex: 1,
    minWidth: 78,
    maxWidth: 130,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderWidth: 1,
    borderColor: '#0EA5E9',
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startWorkTimerBtnInlineCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: colors.emerald,
  },
  startWorkTimerBtnInlineText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  inlineRestBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    borderWidth: 1,
    borderColor: '#EA580C',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginRight: 6,
    minWidth: 54,
    maxWidth: 78,
  },
  inlineRestBtnRunning: {
    backgroundColor: 'rgba(245, 158, 11, 0.35)',
    borderColor: colors.warning,
  },
  inlineRestBtnPaused: {
    backgroundColor: 'rgba(14, 165, 233, 0.25)',
    borderColor: colors.accent,
  },
  inlineRestBtnText: {
    color: '#FB923C',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  timeInputBoxClean: {
    minWidth: 70,
    fontSize: 15,
    fontWeight: '800',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  inputSubLabelClean: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    width: 48,
    height: 48,
    borderRadius: 10,
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
    fontSize: 20,
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
  specialSetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  specialSetBadgeCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  specialSetFinalRestBtn: {
    height: 48,
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1.5,
    borderColor: '#eab308',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
  },
  specialSetFinalRestBtnText: {
    color: '#eab308',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  liveDropsContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    gap: 8,
  },
  liveDropsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  liveDropsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 0.5,
  },
  liveDropsSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  liveDropStepCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  liveDropStepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveDropBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  liveDropBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.danger,
  },
  liveDropStepTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  liveDropTimerBtnStacked: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: 'rgba(14, 165, 233, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDropTimerBtnStackedText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
  },
  liveLastDropBadgeStacked: {
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveLastDropBadgeStackedText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  liveIntraRestBtnZero: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
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
  startWorkTimerBtn: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderWidth: 1,
    borderColor: '#0EA5E9',
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startWorkTimerBtnCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: colors.emerald,
  },
  startWorkTimerBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  alarmBanner: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  alarmBannerIcon: {
    fontSize: 22,
  },
  alarmBannerTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  alarmBannerText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
  alarmBannerBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  alarmBannerBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '900',
  },
  checkboxBtnHighlighted: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    backgroundColor: 'rgba(245, 158, 11, 0.35)',
  },
  activeTimerInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerPauseBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  timerResumeBtn: {
    backgroundColor: 'rgba(14, 165, 233, 0.25)',
    borderColor: colors.accent,
  },
  timerPauseBtnText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '800',
  },
  timerResetBtn: {
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerResetBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  timerResetBtnMini: {
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerResetBtnTextMini: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },
  timerStartBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerStartBtnCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: colors.emerald,
  },
  timerStartBtnText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  intraRestBtn: {
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
    borderRadius: layout.borderRadiusPill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intraRestBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: colors.warning,
  },
  intraRestBtnPaused: {
    backgroundColor: 'rgba(14, 165, 233, 0.25)',
    borderColor: colors.accent,
  },
  intraRestBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
  },
  actionRecBtnActive: {
    backgroundColor: '#F59E0B',
  },
  actionRecBtnPaused: {
    backgroundColor: colors.accent,
  },
  floatingTimerBar: {
    position: 'relative',
    backgroundColor: '#0F172A',
    borderTopWidth: 2,
    borderTopColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  floatingTimerInfo: {
    flex: 1,
  },
  floatingTimerTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  floatingTimerTag: {
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  floatingTimerTagText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '900',
  },
  floatingTimerTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  floatingTimerSubtitle: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  floatingTimerClock: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
    marginHorizontal: 4,
  },
  floatingTimerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  floatingTimerBtn: {
    backgroundColor: colors.accent,
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTimerBtnResume: {
    backgroundColor: colors.warning,
  },
  floatingTimerBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
  },
  floatingTimerBtnSecondary: {
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTimerBtnSecondaryText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
});


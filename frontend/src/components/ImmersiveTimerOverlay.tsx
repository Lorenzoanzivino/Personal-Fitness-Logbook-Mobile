import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Vibration,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';

const ALARM_ASSET = require('../../assets/alarm.wav');

export type IntervalTimerPhase = 'prepare' | 'work' | 'rest' | 'finished';

export interface IntervalCircuitExercise {
  name: string;
  weightKg?: number;
  bandAssistance?: string;
  muscleGroup?: string;
}

export interface IntervalCircuitConfig {
  exercises: IntervalCircuitExercise[];
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  prepareSeconds?: number; // default: 10
}

export interface ImmersiveTimerOverlayProps {
  visible: boolean;
  // Single Timer Mode (backwards compatible)
  initialSeconds?: number;
  exerciseName?: string;
  setNumberText?: string;
  timerMode?: 'rest' | 'work' | 'interval';
  autoAdvance?: boolean;
  onComplete?: () => void;
  onDismiss: () => void;

  // Interval Circuit State Machine Mode
  intervalConfig?: IntervalCircuitConfig;
  onStationComplete?: (roundIndex: number, stationIndex: number) => void;
  onCircuitComplete?: () => void;
}

export const ImmersiveTimerOverlay: React.FC<ImmersiveTimerOverlayProps> = ({
  visible,
  initialSeconds = 60,
  exerciseName,
  setNumberText,
  timerMode = 'rest',
  autoAdvance = false,
  onComplete,
  onDismiss,
  intervalConfig,
  onStationComplete,
  onCircuitComplete,
}) => {
  const insets = useSafeAreaInsets();
  const isIntervalMode = timerMode === 'interval' && Boolean(intervalConfig);

  // Audio refs
  const beepSoundRef = useRef<Audio.Sound | null>(null);

  // Interval Circuit State
  const [intervalPhase, setIntervalPhase] = useState<IntervalTimerPhase>('prepare');
  const [currentRound, setCurrentRound] = useState(0);
  const [currentStation, setCurrentStation] = useState(0);
  const [intervalSecondsLeft, setIntervalSecondsLeft] = useState(10);
  const [intervalTotalSeconds, setIntervalTotalSeconds] = useState(10);
  const [isIntervalPaused, setIsIntervalPaused] = useState(false);

  // Single Timer State
  const [singleTotalTime, setSingleTotalTime] = useState(initialSeconds);
  const [singleTimeLeft, setSingleTimeLeft] = useState(initialSeconds);
  const [isSingleRunning, setIsSingleRunning] = useState(true);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);

  // Interval timers refs for zero memory leaks
  const intervalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const singleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webAudioAlarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mutable refs to prevent stale closures in interval ticks
  const intervalStateRef = useRef({
    phase: 'prepare' as IntervalTimerPhase,
    round: 0,
    station: 0,
    secondsLeft: 10,
    totalSeconds: 10,
    isPaused: false,
    config: intervalConfig,
  });

  intervalStateRef.current = {
    phase: intervalPhase,
    round: currentRound,
    station: currentStation,
    secondsLeft: intervalSecondsLeft,
    totalSeconds: intervalTotalSeconds,
    isPaused: isIntervalPaused,
    config: intervalConfig,
  };

  // Synchronized visual & audio cue state ("START", "REST", "STOP", "FINISH")
  const [cueWord, setCueWord] = useState<'START' | 'STOP' | 'REST' | 'FINISH' | null>(null);
  const cueWordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- AUDIO MOTOR HELPERS ---
  const playWebBeep = (freq = 880, duration = 0.12) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // ignore
    }
  };

  const playVoiceCue = useCallback((cue: 'START' | 'STOP' | 'FINISH') => {
    try {
      Speech.stop();
      const text = cue === 'START' ? 'Start!' : cue === 'STOP' ? 'Stop!' : 'Finish!';
      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.1,
        rate: 1.15,
      });
    } catch {
      // ignore
    }

    // Web Audio Chime on zero transition
    if (Platform.OS === 'web') {
      if (cue === 'START') {
        playWebBeep(880, 0.1);
        setTimeout(() => playWebBeep(1174, 0.22), 110);
      } else if (cue === 'STOP') {
        playWebBeep(659, 0.12);
        setTimeout(() => playWebBeep(440, 0.22), 120);
      } else if (cue === 'FINISH') {
        playWebBeep(523, 0.12);
        setTimeout(() => playWebBeep(659, 0.12), 120);
        setTimeout(() => playWebBeep(784, 0.35), 240);
      }
    }

    // Tactile Vibration patterns
    try {
      if (cue === 'START') {
        Vibration.vibrate([0, 180, 80, 180]);
      } else if (cue === 'STOP') {
        Vibration.vibrate([0, 250]);
      } else if (cue === 'FINISH') {
        Vibration.vibrate([0, 200, 100, 200, 100, 450]);
      }
    } catch {
      // ignore
    }
  }, []);

  const showVisualAndAudioCue = useCallback(
    (cue: 'START' | 'STOP' | 'REST' | 'FINISH') => {
      if (cueWordTimeoutRef.current) {
        clearTimeout(cueWordTimeoutRef.current);
      }
      setCueWord(cue);
      cueWordTimeoutRef.current = setTimeout(() => {
        setCueWord(null);
      }, 1200);

      playVoiceCue(cue === 'REST' ? 'STOP' : cue);
    },
    [playVoiceCue]
  );

  const playShortCountdownBeep = useCallback(async () => {
    // 1. High-pitch digital beep (Web Audio)
    playWebBeep(1046, 0.12);

    // 2. Native expo-av sound
    try {
      if (beepSoundRef.current) {
        await beepSoundRef.current.setPositionAsync(0);
        await beepSoundRef.current.playAsync();
      }
    } catch {
      // ignore
    }

    // 3. Tactile short tap
    try {
      Vibration.vibrate(70);
    } catch {
      // ignore
    }
  }, []);

  // Initialize and clean up Audio Sound
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          ALARM_ASSET,
          { shouldPlay: false, volume: 1.0 }
        );
        if (isMounted) {
          beepSoundRef.current = sound;
        } else {
          await sound.unloadAsync();
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      isMounted = false;
      if (cueWordTimeoutRef.current) {
        clearTimeout(cueWordTimeoutRef.current);
      }
      if (beepSoundRef.current) {
        beepSoundRef.current.unloadAsync().catch(() => {});
        beepSoundRef.current = null;
      }
      Speech.stop().catch(() => {});
    };
  }, []);

  // --- INTERVAL CIRCUIT STATE MACHINE ---
  const advanceIntervalPhase = useCallback(() => {
    const { phase, round, station, config } = intervalStateRef.current;
    if (!config) return;

    const totalRounds = config.rounds || 3;
    const totalStations = config.exercises.length;
    const isLastStation = station >= totalStations - 1;
    const isLastRound = round >= totalRounds - 1;

    if (phase === 'prepare') {
      // PREPARE EXPIRED -> START WORK
      showVisualAndAudioCue('START');
      setIntervalPhase('work');
      setIntervalSecondsLeft(config.workSeconds);
      setIntervalTotalSeconds(config.workSeconds);
    } else if (phase === 'work') {
      // WORK EXPIRED
      onStationComplete?.(round, station);

      if (isLastStation && isLastRound) {
        // ENTIRE CIRCUIT FINISHED!
        showVisualAndAudioCue('FINISH');
        setIntervalPhase('finished');
        setIntervalSecondsLeft(0);
        if (intervalTimerRef.current) {
          clearInterval(intervalTimerRef.current);
          intervalTimerRef.current = null;
        }
        onCircuitComplete?.();
      } else {
        // STOP WORK -> REST
        if (config.restSeconds > 0) {
          // ENTER REST PHASE
          showVisualAndAudioCue('REST');
          setIntervalPhase('rest');
          setIntervalSecondsLeft(config.restSeconds);
          setIntervalTotalSeconds(config.restSeconds);
        } else {
          // REST IS 0 -> DIRECTLY ADVANCE TO NEXT WORK
          showVisualAndAudioCue('START');
          const nextStation = isLastStation ? 0 : station + 1;
          const nextRound = isLastStation ? round + 1 : round;
          setCurrentStation(nextStation);
          setCurrentRound(nextRound);
          setIntervalPhase('work');
          setIntervalSecondsLeft(config.workSeconds);
          setIntervalTotalSeconds(config.workSeconds);
        }
      }
    } else if (phase === 'rest') {
      // REST EXPIRED -> START NEXT WORK
      showVisualAndAudioCue('START');
      const nextStation = isLastStation ? 0 : station + 1;
      const nextRound = isLastStation ? round + 1 : round;
      setCurrentStation(nextStation);
      setCurrentRound(nextRound);
      setIntervalPhase('work');
      setIntervalSecondsLeft(config.workSeconds);
      setIntervalTotalSeconds(config.workSeconds);
    }
  }, [showVisualAndAudioCue, onStationComplete, onCircuitComplete]);

  // Interval timer initialization
  useEffect(() => {
    if (!visible || !isIntervalMode || !intervalConfig) {
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
        intervalTimerRef.current = null;
      }
      return;
    }

    const prep = intervalConfig.prepareSeconds ?? 10;
    setIntervalPhase('prepare');
    setCurrentRound(0);
    setCurrentStation(0);
    setIntervalSecondsLeft(prep);
    setIntervalTotalSeconds(prep);
    setIsIntervalPaused(false);

    return () => {
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
        intervalTimerRef.current = null;
      }
      Speech.stop().catch(() => {});
    };
  }, [visible, isIntervalMode, intervalConfig]);

  // Interval timer tick loop
  useEffect(() => {
    if (!visible || !isIntervalMode || !intervalConfig) return;
    if (intervalPhase === 'finished' || isIntervalPaused) {
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
        intervalTimerRef.current = null;
      }
      return;
    }

    intervalTimerRef.current = setInterval(() => {
      const cur = intervalStateRef.current;
      if (cur.isPaused || cur.phase === 'finished') return;

      const next = cur.secondsLeft - 1;

      // Audio countdown cue at 3, 2, 1
      if (next === 3 || next === 2 || next === 1) {
        playShortCountdownBeep();
      }

      if (next <= 0) {
        setIntervalSecondsLeft(0);
        advanceIntervalPhase();
      } else {
        setIntervalSecondsLeft(next);
      }
    }, 1000);

    return () => {
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
        intervalTimerRef.current = null;
      }
    };
  }, [visible, isIntervalMode, intervalConfig, intervalPhase, isIntervalPaused, playShortCountdownBeep, advanceIntervalPhase]);

  // --- SINGLE TIMER LOGIC (STANDALONE REST / WORK) ---
  const stopAlarmSound = () => {
    if (webAudioAlarmIntervalRef.current) {
      clearInterval(webAudioAlarmIntervalRef.current);
      webAudioAlarmIntervalRef.current = null;
    }
    try {
      if (beepSoundRef.current) {
        beepSoundRef.current.pauseAsync().catch(() => {});
      }
    } catch {}
    try {
      Vibration.cancel();
    } catch {}
  };

  const triggerAlarm = () => {
    setIsAlarmRinging(true);
    playWebBeep(880, 0.2);
    try {
      if (beepSoundRef.current) {
        beepSoundRef.current.setIsLoopingAsync(true).catch(() => {});
        beepSoundRef.current.playAsync().catch(() => {});
      }
    } catch {}
    try {
      Vibration.vibrate([0, 400, 200, 400, 200, 400], true);
    } catch {}
  };

  useEffect(() => {
    if (isIntervalMode) return;
    if (visible) {
      setSingleTotalTime(initialSeconds);
      setSingleTimeLeft(initialSeconds);
      setIsSingleRunning(true);
      setIsAlarmRinging(false);
      stopAlarmSound();
    } else {
      stopAlarmSound();
    }

    return () => {
      stopAlarmSound();
      if (singleTimerRef.current) clearInterval(singleTimerRef.current);
    };
  }, [visible, initialSeconds, isIntervalMode]);

  useEffect(() => {
    if (isIntervalMode || !visible) {
      if (singleTimerRef.current) clearInterval(singleTimerRef.current);
      stopAlarmSound();
      return;
    }

    if (isSingleRunning && singleTimeLeft > 0 && !isAlarmRinging) {
      singleTimerRef.current = setInterval(() => {
        setSingleTimeLeft((prev) => {
          if (prev <= 1) {
            if (singleTimerRef.current) clearInterval(singleTimerRef.current);
            if (timerMode === 'work' || autoAdvance) {
              showVisualAndAudioCue('STOP');
              onComplete?.();
              return 0;
            } else {
              showVisualAndAudioCue('START');
              triggerAlarm();
              return 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (singleTimerRef.current) clearInterval(singleTimerRef.current);
    }

    return () => {
      if (singleTimerRef.current) clearInterval(singleTimerRef.current);
    };
  }, [visible, isIntervalMode, isSingleRunning, singleTimeLeft, isAlarmRinging, timerMode, autoAdvance, onComplete, showVisualAndAudioCue]);

  if (!visible) return null;

  // --- RENDER INTERVAL CIRCUIT OVERLAY ---
  if (isIntervalMode && intervalConfig) {
    const totalRounds = intervalConfig.rounds || 3;
    const totalStations = intervalConfig.exercises.length;
    const currentEx = intervalConfig.exercises[currentStation] || { name: 'Esercizio' };

    const isLastStation = currentStation >= totalStations - 1;
    const nextStationIdx = isLastStation ? 0 : currentStation + 1;
    const nextRoundIdx = isLastStation ? currentRound + 1 : currentRound;
    const nextEx = intervalConfig.exercises[nextStationIdx] || { name: 'Esercizio' };

    const progressPercent =
      intervalTotalSeconds > 0
        ? Math.min(100, Math.max(0, ((intervalTotalSeconds - intervalSecondsLeft) / intervalTotalSeconds) * 100))
        : 100;

    const mins = Math.floor(intervalSecondsLeft / 60);
    const secs = intervalSecondsLeft % 60;
    const timeFormatted = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}`;

    const handleSkipPhase = () => {
      advanceIntervalPhase();
    };

    const handleToggleIntervalPause = () => {
      setIsIntervalPaused((prev) => !prev);
    };

    const handleExitInterval = () => {
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
        intervalTimerRef.current = null;
      }
      Speech.stop().catch(() => {});
      onDismiss();
    };

    return (
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={handleExitInterval}
      >
        <View
          style={[
            styles.overlayContainer,
            intervalPhase === 'prepare' && styles.overlayContainerPrepare,
            intervalPhase === 'work' && styles.overlayContainerWork,
            intervalPhase === 'rest' && styles.overlayContainerRest,
            intervalPhase === 'finished' && styles.overlayContainerFinished,
            { paddingBottom: insets.bottom + 20, paddingTop: insets.top + 16 },
          ]}
        >
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View
                style={[
                  styles.recBadge,
                  intervalPhase === 'prepare' && styles.recBadgePrepare,
                  intervalPhase === 'work' && styles.recBadgeWork,
                  intervalPhase === 'rest' && styles.recBadgeRest,
                  intervalPhase === 'finished' && styles.recBadgeFinished,
                ]}
              >
                <Text
                  style={[
                    styles.recTitle,
                    intervalPhase === 'prepare' && styles.recTitlePrepare,
                    intervalPhase === 'work' && styles.recTitleWork,
                    intervalPhase === 'rest' && styles.recTitleRest,
                    intervalPhase === 'finished' && styles.recTitleFinished,
                  ]}
                >
                  {intervalPhase === 'prepare'
                    ? '⚡ PREPARAZIONE'
                    : intervalPhase === 'work'
                    ? '🔥 FASE ATTIVA • LAVORO'
                    : intervalPhase === 'rest'
                    ? '🌿 RECUPERO • PAUSA'
                    : '🏆 CIRCUITO COMPLETATO'}
                </Text>
              </View>

              <Text style={styles.setSubtitle}>
                {intervalPhase === 'finished'
                  ? 'TUTTI I GIRI COMPLETATI!'
                  : `GIRO ${currentRound + 1} DI ${totalRounds} • STAZIONE ${currentStation + 1} DI ${totalStations}`}
              </Text>
            </View>

            {/* Exit Button */}
            <Pressable
              onPress={handleExitInterval}
              style={styles.closeOverlayBtn}
              accessibilityRole="button"
              accessibilityLabel="Esci dal circuito"
            >
              <Text style={styles.closeOverlayBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Center Stage & Giant Timer */}
          {intervalPhase === 'finished' ? (
            <View style={styles.centerSectionFinished}>
              <Text style={styles.finishedIcon}>🏆</Text>
              <Text style={styles.finishedTitle}>CIRCUITO COMPLETATO!</Text>
              <Text style={styles.finishedSubtitle}>
                Hai terminato con successo tutti i {totalRounds} giri ({totalStations} stazioni ad alta intensità).
              </Text>

              <Pressable
                onPress={handleExitInterval}
                style={styles.finishedCloseBtn}
                accessibilityRole="button"
              >
                <Text style={styles.finishedCloseBtnText}>Torna alla Sessione</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.centerSection}>
              {/* Exercise Focus Banner */}
              <View style={styles.exerciseFocusBox}>
                <Text style={styles.exerciseFocusCategory}>
                  {intervalPhase === 'prepare'
                    ? 'PREPARATI PER:'
                    : intervalPhase === 'work'
                    ? 'IN ESECUZIONE:'
                    : 'PAUSA'}
                </Text>
                <Text style={styles.exerciseFocusName} numberOfLines={2}>
                  {intervalPhase === 'rest' ? 'RECUPERO ATTIVO' : currentEx.name}
                </Text>

                {intervalPhase !== 'rest' && (currentEx.weightKg || (currentEx.bandAssistance && currentEx.bandAssistance !== 'none')) ? (
                  <View style={styles.exerciseExtrasRow}>
                    {Boolean(currentEx.weightKg) && (
                      <View style={styles.extraBadge}>
                        <Text style={styles.extraBadgeText}>🏋️ {currentEx.weightKg} kg</Text>
                      </View>
                    )}
                    {Boolean(currentEx.bandAssistance && currentEx.bandAssistance !== 'none') && (
                      <View style={styles.extraBadge}>
                        <Text style={styles.extraBadgeText}>🎗️ {currentEx.bandAssistance}</Text>
                      </View>
                    )}
                  </View>
                ) : null}

                {/* In Rest: Show next up exercise */}
                {intervalPhase === 'rest' && (
                  <View style={styles.nextUpCard}>
                    <Text style={styles.nextUpLabel}>PROSSIMO ESERCIZIO:</Text>
                    <Text style={styles.nextUpName} numberOfLines={1}>
                      {nextEx.name}
                    </Text>
                    <Text style={styles.nextUpSubtitle}>
                      Giro {nextRoundIdx + 1} di {totalRounds} • Stazione {nextStationIdx + 1}
                    </Text>
                  </View>
                )}
              </View>

              {/* Giant Circular Timer */}
              <View
                style={[
                  styles.timerCircleOuter,
                  intervalPhase === 'prepare' && styles.timerCircleOuterPrepare,
                  intervalPhase === 'work' && styles.timerCircleOuterWork,
                  intervalPhase === 'rest' && styles.timerCircleOuterRest,
                ]}
              >
                <View style={styles.timerCircleInner}>
                  <Text
                    style={[
                      styles.giantTimerText,
                      intervalPhase === 'prepare' && styles.giantTimerTextPrepare,
                      intervalPhase === 'work' && styles.giantTimerTextWork,
                      intervalPhase === 'rest' && styles.giantTimerTextRest,
                      Boolean(cueWord) && styles.giantTimerTextCue,
                      cueWord === 'START' && styles.giantTimerCueStart,
                      cueWord === 'REST' && styles.giantTimerCueRest,
                      cueWord === 'STOP' && styles.giantTimerCueStop,
                      cueWord === 'FINISH' && styles.giantTimerCueFinish,
                    ]}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                  >
                    {cueWord ? cueWord : timeFormatted}
                  </Text>
                  <Text style={styles.secondsLabel}>
                    {intervalPhase === 'prepare'
                      ? '⏱ Secondi al via'
                      : intervalPhase === 'work'
                      ? '🔥 Spingi!'
                      : '🌿 Respira'}
                  </Text>

                  {isIntervalPaused && (
                    <View style={styles.pausedBadge}>
                      <Text style={styles.pausedBadgeText}>IN PAUSA</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor:
                        intervalPhase === 'prepare'
                          ? '#F59E0B'
                          : intervalPhase === 'work'
                          ? '#EF4444'
                          : '#10B981',
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Bottom Action Controls */}
          {intervalPhase !== 'finished' && (
            <View style={styles.bottomControlsRow}>
              <Pressable
                onPress={handleToggleIntervalPause}
                style={[styles.bottomControlBtn, styles.pauseControlBtn]}
                accessibilityRole="button"
                accessibilityLabel={isIntervalPaused ? "Riprendi circuito" : "Metti in pausa"}
              >
                <Text style={styles.bottomControlBtnText}>
                  {isIntervalPaused ? '▶ Riprendi' : '⏸ Pausa'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSkipPhase}
                style={[styles.bottomControlBtn, styles.skipControlBtn]}
                accessibilityRole="button"
                accessibilityLabel="Salta fase corrente"
              >
                <Text style={styles.bottomControlBtnText}>
                  {intervalPhase === 'prepare'
                    ? '⚡ Salta Prep (Via)'
                    : intervalPhase === 'work'
                    ? '⏭ Salta Lavoro'
                    : '⚡ Salta Riposo'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    );
  }

  // --- RENDER SINGLE TIMER OVERLAY (BACKWARDS COMPATIBLE) ---
  const singleMinutes = Math.floor(singleTimeLeft / 60);
  const singleSeconds = singleTimeLeft % 60;
  const singleFormatted = `${singleMinutes}:${singleSeconds.toString().padStart(2, '0')}`;
  const singleProgressPercent =
    singleTotalTime > 0 ? Math.min(100, Math.max(0, ((singleTotalTime - singleTimeLeft) / singleTotalTime) * 100)) : 100;

  const handleToggleSinglePause = () => {
    if (isAlarmRinging) return;
    setIsSingleRunning(!isSingleRunning);
  };

  const handleStopSingleAlarm = () => {
    stopAlarmSound();
    setIsAlarmRinging(false);
    onComplete?.();
  };

  const handleSkipSingle = () => {
    if (singleTimerRef.current) clearInterval(singleTimerRef.current);
    stopAlarmSound();
    setIsAlarmRinging(false);
    onComplete?.();
  };

  const handleDismissSingle = () => {
    if (singleTimerRef.current) clearInterval(singleTimerRef.current);
    stopAlarmSound();
    setIsAlarmRinging(false);
    onDismiss();
  };

  const handleAddSingleSeconds = (delta: number) => {
    if (isAlarmRinging) {
      stopAlarmSound();
      setIsAlarmRinging(false);
      setSingleTimeLeft(Math.max(1, delta));
      setSingleTotalTime(Math.max(singleTotalTime, delta));
      setIsSingleRunning(true);
      return;
    }
    setSingleTimeLeft((prev) => Math.max(0, prev + delta));
    setSingleTotalTime((prev) => Math.max(prev, prev + delta));
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={timerMode === 'work' ? handleSkipSingle : handleDismissSingle}
    >
      <View
        style={[
          styles.overlayContainer,
          timerMode === 'work' ? styles.overlayContainerWork : styles.overlayContainerRest,
          isAlarmRinging && styles.overlayContainerAlarm,
          { paddingBottom: insets.bottom + 20, paddingTop: insets.top + 16 },
        ]}
      >
        {/* Header info */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View
              style={[
                styles.recBadge,
                timerMode === 'work' ? styles.recBadgeWork : styles.recBadgeRest,
                isAlarmRinging && styles.recBadgeAlarm,
              ]}
            >
              <Text
                style={[
                  styles.recTitle,
                  timerMode === 'work' ? styles.recTitleWork : styles.recTitleRest,
                  isAlarmRinging && styles.recTitleAlarm,
                ]}
              >
                {isAlarmRinging
                  ? '🚨 SVEGLIA RECUPERO ATTIVA'
                  : autoAdvance
                  ? timerMode === 'work'
                    ? '🔥 FASE DI LAVORO (ATTIVA)'
                    : '🌿 FASE DI RIPOSO (PAUSA)'
                  : timerMode === 'work'
                  ? '⚡ SOTTO SFORZO • ISOMETRIA ATTIVA'
                  : '⏱ TEMPO DI RECUPERO'}
              </Text>
            </View>
            {exerciseName && (
              <Text style={styles.exNameText} numberOfLines={1}>
                {exerciseName}
              </Text>
            )}
            {setNumberText && (
              <Text style={styles.setSubtitle}>{setNumberText}</Text>
            )}
          </View>

          <Pressable
            onPress={timerMode === 'work' ? handleSkipSingle : handleDismissSingle}
            style={styles.closeOverlayBtn}
            accessibilityRole="button"
            accessibilityLabel={timerMode === 'work' ? "Stop e avanza" : "Chiudi timer"}
          >
            <Text style={styles.closeOverlayBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* Center Giant Display */}
        <View style={styles.centerSection}>
          <View
            style={[
              styles.timerCircleOuter,
              timerMode === 'work' ? styles.timerCircleOuterWork : styles.timerCircleOuterRest,
              isAlarmRinging && styles.timerCircleOuterAlarm,
            ]}
          >
            <View style={styles.timerCircleInner}>
              <Text
                style={[
                  styles.giantTimerText,
                  timerMode === 'work' && styles.giantTimerTextWork,
                  timerMode !== 'work' && !isAlarmRinging && styles.giantTimerTextRest,
                  isAlarmRinging && styles.giantTimerTextAlarm,
                  Boolean(cueWord) && styles.giantTimerTextCue,
                  cueWord === 'START' && styles.giantTimerCueStart,
                  cueWord === 'REST' && styles.giantTimerCueRest,
                  cueWord === 'STOP' && styles.giantTimerCueStop,
                  cueWord === 'FINISH' && styles.giantTimerCueFinish,
                ]}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                {cueWord ? cueWord : (isAlarmRinging ? '0:00' : singleFormatted)}
              </Text>
              <Text style={[styles.secondsLabel, isAlarmRinging && styles.secondsLabelAlarm]}>
                {isAlarmRinging
                  ? '⏰ TEMPO SCADUTO!'
                  : timerMode === 'work'
                  ? `⚡ Fase attiva! ${singleTimeLeft}s`
                  : `🌿 Recupero! ${singleTimeLeft}s`}
              </Text>

              {isAlarmRinging && (
                <View style={styles.alarmNoticeBadge}>
                  <Text style={styles.alarmNoticeText}>SPEGNI PER CONTINUARE</Text>
                </View>
              )}

              {!isAlarmRinging && !isSingleRunning && (
                <View style={[styles.pausedBadge, timerMode === 'work' && styles.pausedBadgeWork]}>
                  <Text style={[styles.pausedBadgeText, timerMode === 'work' && styles.pausedBadgeTextWork]}>
                    IN PAUSA
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${singleProgressPercent}%`,
                  backgroundColor: isAlarmRinging
                    ? colors.danger
                    : timerMode === 'work'
                    ? colors.danger
                    : colors.emerald,
                },
              ]}
            />
          </View>
        </View>

        {/* Adjust Pills (Rest only) */}
        {!isAlarmRinging && timerMode !== 'work' && (
          <View style={styles.adjustRow}>
            <Pressable
              onPress={() => handleAddSingleSeconds(-15)}
              style={styles.adjustPill}
            >
              <Text style={styles.adjustPillText}>-15s</Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddSingleSeconds(15)}
              style={styles.adjustPill}
            >
              <Text style={styles.adjustPillText}>+15s</Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddSingleSeconds(30)}
              style={styles.adjustPill}
            >
              <Text style={styles.adjustPillText}>+30s</Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddSingleSeconds(60)}
              style={styles.adjustPill}
            >
              <Text style={styles.adjustPillText}>+60s</Text>
            </Pressable>
          </View>
        )}

        {/* Action Controls */}
        <View style={styles.actionsContainer}>
          {isAlarmRinging ? (
            <Pressable
              onPress={handleStopSingleAlarm}
              style={styles.stopAlarmBtn}
              accessibilityRole="button"
              accessibilityLabel="Spegni allarme"
            >
              <Text style={styles.stopAlarmBtnText}>🔔 SPEGNI SVEGLIA E RIPARTI</Text>
            </Pressable>
          ) : (
            <View style={styles.buttonsRow}>
              <Pressable
                onPress={handleToggleSinglePause}
                style={[
                  styles.primaryActionBtn,
                  timerMode === 'work' ? styles.primaryActionBtnWork : styles.primaryActionBtnRest,
                ]}
                accessibilityRole="button"
                accessibilityLabel={isSingleRunning ? "Metti in pausa" : "Riprendi"}
              >
                <Text style={styles.primaryActionBtnText}>
                  {isSingleRunning ? '⏸ Pausa' : '▶ Riprendi'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSkipSingle}
                style={styles.skipBtn}
                accessibilityRole="button"
                accessibilityLabel="Salta recupero"
              >
                <Text style={styles.skipBtnText}>
                  {timerMode === 'work' ? 'Stop e Salva Serie' : 'Salta Recupero ⏭'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  overlayContainerPrepare: {
    backgroundColor: '#7C2D12', // Deep warm amber/orange
  },
  overlayContainerWork: {
    backgroundColor: '#7F1D1D', // Deep intense red
  },
  overlayContainerRest: {
    backgroundColor: '#064E3B', // Deep emerald green
  },
  overlayContainerFinished: {
    backgroundColor: '#0F172A', // Dark navy celebration
  },
  overlayContainerAlarm: {
    backgroundColor: '#450A0A',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  recBadgePrepare: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  recBadgeWork: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  recBadgeRest: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  recBadgeFinished: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  recBadgeAlarm: {
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
  },
  recTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  recTitlePrepare: {
    color: '#FBBF24',
  },
  recTitleWork: {
    color: '#F87171',
  },
  recTitleRest: {
    color: '#34D399',
  },
  recTitleFinished: {
    color: '#60A5FA',
  },
  recTitleAlarm: {
    color: '#FCA5A5',
  },
  exNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
    marginTop: 2,
  },
  setSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  closeOverlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeOverlayBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },

  // Center Stage
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  centerSectionFinished: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 20,
  },
  finishedIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  finishedTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  finishedSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  finishedCloseBtn: {
    backgroundColor: colors.emerald,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: layout.borderRadiusLg,
  },
  finishedCloseBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 15,
  },

  exerciseFocusBox: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    width: '100%',
  },
  exerciseFocusCategory: {
    fontSize: 12,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  exerciseFocusName: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.white,
    textAlign: 'center',
    lineHeight: 32,
  },
  exerciseExtrasRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  extraBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  extraBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  nextUpCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: layout.borderRadiusMd,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    width: '90%',
  },
  nextUpLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#34D399',
    letterSpacing: 0.8,
  },
  nextUpName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
    marginTop: 2,
    textAlign: 'center',
  },
  nextUpSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '600',
    marginTop: 2,
  },

  // Giant Circular Timer
  timerCircleOuter: {
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 6,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  timerCircleOuterPrepare: {
    borderColor: '#F59E0B',
  },
  timerCircleOuterWork: {
    borderColor: '#EF4444',
  },
  timerCircleOuterRest: {
    borderColor: '#10B981',
  },
  timerCircleOuterAlarm: {
    borderColor: '#EF4444',
  },
  timerCircleInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  giantTimerText: {
    fontSize: 70,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -1,
  },
  giantTimerTextPrepare: {
    color: '#FDE68A',
  },
  giantTimerTextWork: {
    color: '#FECACA',
  },
  giantTimerTextRest: {
    color: '#A7F3D0',
  },
  giantTimerTextAlarm: {
    color: '#F87171',
  },
  giantTimerTextCue: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  giantTimerCueStart: {
    color: '#FECACA',
  },
  giantTimerCueRest: {
    color: '#A7F3D0',
  },
  giantTimerCueStop: {
    color: '#FECACA',
  },
  giantTimerCueFinish: {
    color: '#FDE68A',
  },
  secondsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  secondsLabelAlarm: {
    color: '#F87171',
  },
  alarmNoticeBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 6,
  },
  alarmNoticeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pausedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  pausedBadgeWork: {
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
  },
  pausedBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pausedBadgeTextWork: {
    color: '#FEE2E2',
  },

  // Progress Bar
  progressBarTrack: {
    width: '85%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    marginTop: 24,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Adjust Row
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 12,
  },
  adjustPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  adjustPillText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },

  // Bottom Controls
  bottomControlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  bottomControlBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: layout.borderRadiusLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseControlBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  skipControlBtn: {
    backgroundColor: colors.white,
  },
  bottomControlBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },

  actionsContainer: {
    marginTop: 10,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryActionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: layout.borderRadiusLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnRest: {
    backgroundColor: colors.emerald,
  },
  primaryActionBtnWork: {
    backgroundColor: colors.danger,
  },
  primaryActionBtnText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 14,
  },
  skipBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 14,
    borderRadius: layout.borderRadiusLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
  },
  stopAlarmBtn: {
    backgroundColor: colors.danger,
    paddingVertical: 16,
    borderRadius: layout.borderRadiusLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopAlarmBtnText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});

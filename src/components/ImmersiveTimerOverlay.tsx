import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Vibration,
} from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';

const ALARM_ASSET = require('../../assets/alarm.wav');

interface ImmersiveTimerOverlayProps {
  visible: boolean;
  initialSeconds: number;
  exerciseName?: string;
  setNumberText?: string;
  timerMode?: 'rest' | 'work';
  onComplete: () => void;
  onDismiss: () => void;
}

export const ImmersiveTimerOverlay: React.FC<ImmersiveTimerOverlayProps> = ({
  visible,
  initialSeconds,
  exerciseName,
  setNumberText,
  timerMode = 'rest',
  onComplete,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets();
  const [totalTime, setTotalTime] = useState(initialSeconds);
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webAudioAlarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Expo Audio player for alarm
  const player = useAudioPlayer(ALARM_ASSET);

  // Stop all alarm sounds and vibrations
  const stopAlarmSound = () => {
    // 1. Stop Web Audio loop
    if (webAudioAlarmIntervalRef.current) {
      clearInterval(webAudioAlarmIntervalRef.current);
      webAudioAlarmIntervalRef.current = null;
    }

    // 2. Stop Expo Audio player
    try {
      if (player) {
        player.pause();
        player.seekTo(0);
      }
    } catch {
      // ignore
    }

    // 3. Stop vibration
    try {
      Vibration.cancel();
    } catch {
      // ignore
    }
  };

  // Web Audio Alarm tone generator (cross-browser fallback)
  const playWebAudioBeepCycle = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        // 4 rapid digital alarm beeps (880Hz, 880Hz, 880Hz, 1174Hz)
        const beeps = [
          { time: 0.0, freq: 880, dur: 0.1 },
          { time: 0.16, freq: 880, dur: 0.1 },
          { time: 0.32, freq: 880, dur: 0.1 },
          { time: 0.48, freq: 1174.66, dur: 0.2 },
        ];

        beeps.forEach((b) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'square';
          osc.frequency.setValueAtTime(b.freq, ctx.currentTime + b.time);

          const start = ctx.currentTime + b.time;
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + b.dur);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(start);
          osc.stop(start + b.dur + 0.02);
        });
      } catch (err) {
        console.warn('Web Audio Alarm error:', err);
      }
    }
  };

  // Start continuous alarm loop
  const triggerAlarm = () => {
    setIsAlarmRinging(true);

    // 1. Play native expo-audio
    try {
      if (player) {
        player.loop = true;
        player.play();
      }
    } catch (e) {
      console.warn('Expo audio play warning:', e);
    }

    // 2. Play Web Audio loop
    if (Platform.OS === 'web') {
      playWebAudioBeepCycle();
      if (!webAudioAlarmIntervalRef.current) {
        webAudioAlarmIntervalRef.current = setInterval(() => {
          playWebAudioBeepCycle();
        }, 1100);
      }
    }

    // 3. Continuous Vibration pattern
    try {
      // 0ms delay, 400ms vibrate, 200ms pause, 400ms vibrate, 200ms pause, 600ms pause
      Vibration.vibrate([0, 400, 200, 400, 200, 400, 600], true);
    } catch (e) {
      console.warn('Vibration error:', e);
    }
  };

  // Sync state whenever timer opens with new duration
  useEffect(() => {
    if (visible) {
      setTotalTime(initialSeconds);
      setTimeLeft(initialSeconds);
      setIsRunning(true);
      setIsAlarmRinging(false);
      stopAlarmSound();
    } else {
      stopAlarmSound();
    }

    return () => {
      stopAlarmSound();
    };
  }, [visible, initialSeconds]);

  // Countdown timer loop
  useEffect(() => {
    if (!visible) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopAlarmSound();
      return;
    }

    if (isRunning && timeLeft > 0 && !isAlarmRinging) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            triggerAlarm();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible, isRunning, timeLeft, isAlarmRinging]);

  if (!visible) return null;

  const handleTogglePause = () => {
    if (isAlarmRinging) return;
    setIsRunning(!isRunning);
  };

  // Athlete explicitly turns off alarm to continue
  const handleStopAlarm = () => {
    stopAlarmSound();
    setIsAlarmRinging(false);
    onComplete();
  };

  // Skip before alarm rings
  const handleSkip = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    stopAlarmSound();
    setIsAlarmRinging(false);
    onComplete();
  };

  const handleDismiss = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    stopAlarmSound();
    setIsAlarmRinging(false);
    onDismiss();
  };

  const handleAddSeconds = (delta: number) => {
    if (isAlarmRinging) {
      // If user adds time during alarm, resume countdown
      stopAlarmSound();
      setIsAlarmRinging(false);
      setTimeLeft(Math.max(1, delta));
      setTotalTime(Math.max(totalTime, delta));
      setIsRunning(true);
      return;
    }
    setTimeLeft((prev) => Math.max(0, prev + delta));
    setTotalTime((prev) => Math.max(prev, prev + delta));
  };

  const progressPercent =
    totalTime > 0 ? Math.min(100, Math.max(0, ((totalTime - timeLeft) / totalTime) * 100)) : 100;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View
        style={[
          styles.overlayContainer,
          isAlarmRinging && styles.overlayContainerAlarm,
          { paddingBottom: insets.bottom + 20 },
        ]}
      >
        {/* Top Header info */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View
              style={[
                styles.recBadge,
                timerMode === 'work' && styles.recBadgeWork,
                isAlarmRinging && styles.recBadgeAlarm,
              ]}
            >
              <Text
                style={[
                  styles.recTitle,
                  timerMode === 'work' && styles.recTitleWork,
                  isAlarmRinging && styles.recTitleAlarm,
                ]}
              >
                {isAlarmRinging
                  ? timerMode === 'work'
                    ? '🚨 LAVORO COMPLETATO!'
                    : '🚨 SVEGLIA RECUPERO ATTIVA'
                  : timerMode === 'work'
                  ? '🔥 LAVORO ATTIVO (ISOMETRIA)'
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
            onPress={handleDismiss}
            style={styles.closeOverlayBtn}
            accessibilityRole="button"
            accessibilityLabel="Chiudi timer"
          >
            <Text style={styles.closeOverlayBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* Center Giant Timer Display */}
        <View style={styles.centerSection}>
          <View
            style={[
              styles.timerCircleOuter,
              timerMode === 'work' && styles.timerCircleOuterWork,
              isAlarmRinging && styles.timerCircleOuterAlarm,
            ]}
          >
            <View style={styles.timerCircleInner}>
              <Text
                style={[
                  styles.giantTimerText,
                  timerMode === 'work' && !isAlarmRinging && styles.giantTimerTextWork,
                  isAlarmRinging && styles.giantTimerTextAlarm,
                ]}
              >
                {isAlarmRinging ? '0:00' : timeFormatted}
              </Text>
              <Text style={[styles.secondsLabel, isAlarmRinging && styles.secondsLabelAlarm]}>
                {isAlarmRinging
                  ? timerMode === 'work'
                    ? '⏰ TEMPO DI LAVORO TERMINATO!'
                    : '⏰ TEMPO SCADUTO!'
                  : `${timeLeft}s rimanenti`}
              </Text>

              {isAlarmRinging && (
                <View
                  style={[
                    styles.alarmNoticeBadge,
                    timerMode === 'work' && styles.alarmNoticeBadgeWork,
                  ]}
                >
                  <Text style={styles.alarmNoticeText}>
                    {timerMode === 'work'
                      ? 'CONFERMA PER AVVIARE IL RECUPERO'
                      : 'SPEGNI PER CONTINUARE'}
                  </Text>
                </View>
              )}

              {!isAlarmRinging && !isRunning && (
                <View style={styles.pausedBadge}>
                  <Text style={styles.pausedBadgeText}>IN PAUSA</Text>
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
                  width: `${progressPercent}%`,
                  backgroundColor: isAlarmRinging
                    ? colors.danger
                    : timerMode === 'work'
                    ? colors.warning
                    : colors.accent,
                },
              ]}
            />
          </View>
        </View>

        {/* Quick Adjustment Pills (-15s, +15s, +30s) */}
        {!isAlarmRinging && (
          <View style={styles.adjustRow}>
            <Pressable
              onPress={() => handleAddSeconds(-15)}
              style={styles.adjustPill}
            >
              <Text style={styles.adjustPillText}>-15s</Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddSeconds(15)}
              style={styles.adjustPill}
            >
              <Text style={styles.adjustPillText}>+15s</Text>
            </Pressable>

            <Pressable
              onPress={() => handleAddSeconds(30)}
              style={styles.adjustPill}
            >
              <Text style={styles.adjustPillText}>+30s</Text>
            </Pressable>
          </View>
        )}

        {/* Bottom Command Buttons */}
        {isAlarmRinging ? (
          <View style={styles.alarmActionRow}>
            <Pressable
              onPress={handleStopAlarm}
              style={[
                styles.stopAlarmButton,
                timerMode === 'work' && styles.stopAlarmButtonWork,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                timerMode === 'work'
                  ? 'Completa fase attiva e avvia recupero'
                  : 'Spegni sveglia e continua allenamento'
              }
            >
              <Text style={styles.stopAlarmButtonIcon}>
                {timerMode === 'work' ? '✓' : '🔔'}
              </Text>
              <Text style={styles.stopAlarmButtonText}>
                {timerMode === 'work'
                  ? '✓ COMPLETA & AVVIA RECUPERO'
                  : 'SPEGNI SVEGLIA & CONTINUA'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.bottomButtonsRow}>
            <Pressable
              onPress={handleTogglePause}
              style={[
                styles.actionButton,
                isRunning ? styles.pauseButton : styles.resumeButton,
              ]}
            >
              <Text style={styles.actionButtonText}>
                {isRunning ? '⏸ PAUSA' : '▶ RIPRENDI'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSkip}
              style={[styles.actionButton, styles.skipButton]}
            >
              <Text style={[styles.actionButtonText, styles.skipButtonText]}>
                ⏭ SALTA & COMPLETA
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 40,
  },
  overlayContainerAlarm: {
    backgroundColor: 'rgba(25, 6, 6, 0.96)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    marginBottom: 6,
  },
  recBadgeAlarm: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  recTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.accent,
  },
  recTitleAlarm: {
    color: colors.danger,
  },
  exNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
  },
  setSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeOverlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeOverlayBtnText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  timerCircleOuter: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 4,
    borderColor: 'rgba(14, 165, 233, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.05)',
  },
  timerCircleOuterAlarm: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 5,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 12,
  },
  timerCircleInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  giantTimerText: {
    fontSize: 68,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  giantTimerTextAlarm: {
    color: colors.danger,
  },
  secondsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
  },
  secondsLabelAlarm: {
    color: colors.danger,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  alarmNoticeBadge: {
    marginTop: 12,
    backgroundColor: colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  alarmNoticeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  pausedBadge: {
    marginTop: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: colors.warning,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pausedBadgeText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  progressBarTrack: {
    width: '100%',
    maxWidth: 320,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    marginTop: 32,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  adjustPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: layout.borderRadiusLg,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  adjustPillText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  alarmActionRow: {
    width: '100%',
  },
  stopAlarmButton: {
    backgroundColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: layout.borderRadiusMd,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  stopAlarmButtonWork: {
    backgroundColor: colors.emerald,
    shadowColor: colors.emerald,
  },
  recBadgeWork: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: colors.warning,
  },
  recTitleWork: {
    color: colors.warning,
  },
  timerCircleOuterWork: {
    borderColor: 'rgba(245, 158, 11, 0.6)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 4,
  },
  giantTimerTextWork: {
    color: colors.warning,
  },
  alarmNoticeBadgeWork: {
    backgroundColor: colors.emeraldDark,
  },
  stopAlarmButtonIcon: {
    fontSize: 22,
  },
  stopAlarmButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButton: {
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resumeButton: {
    backgroundColor: colors.warning,
  },
  skipButton: {
    backgroundColor: colors.accent,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.5,
  },
  skipButtonText: {
    color: colors.white,
  },
});

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';

interface ImmersiveTimerOverlayProps {
  visible: boolean;
  initialSeconds: number;
  exerciseName?: string;
  setNumberText?: string;
  onComplete: () => void;
  onDismiss: () => void;
}

export const ImmersiveTimerOverlay: React.FC<ImmersiveTimerOverlayProps> = ({
  visible,
  initialSeconds,
  exerciseName,
  setNumberText,
  onComplete,
  onDismiss,
}) => {
  const [totalTime, setTotalTime] = useState(initialSeconds);
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync state whenever timer opens with new duration
  useEffect(() => {
    if (visible) {
      setTotalTime(initialSeconds);
      setTimeLeft(initialSeconds);
      setIsRunning(true);
    }
  }, [visible, initialSeconds]);

  // Web Audio API Chime
  const playChime = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        // Arpeggio Re5 (587.33), Sol5 (783.99), Si5 (987.77), Re6 (1174.66)
        const notes = [587.33, 783.99, 987.77, 1174.66];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);

          const startTime = ctx.currentTime + idx * 0.1;
          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.4);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.45);
        });
      } catch (err) {
        console.warn('Audio chime fallback:', err);
      }
    }
  };

  // Countdown timer loop
  useEffect(() => {
    if (!visible) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            playChime();
            setTimeout(() => {
              onComplete();
            }, 300);
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
  }, [visible, isRunning, timeLeft, onComplete]);

  if (!visible) return null;

  const handleTogglePause = () => {
    setIsRunning(!isRunning);
  };

  const handleSkip = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    onComplete();
  };

  const handleAddSeconds = (delta: number) => {
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
      onRequestClose={onDismiss}
    >
      <View style={styles.overlayContainer}>
        {/* Top Header info */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recTitle}>TEMPO DI RECUPERO</Text>
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
            onPress={onDismiss}
            style={styles.closeOverlayBtn}
            accessibilityRole="button"
            accessibilityLabel="Chiudi timer senza completare"
          >
            <Text style={styles.closeOverlayBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* Center Giant Timer Display */}
        <View style={styles.centerSection}>
          <View style={styles.timerCircleOuter}>
            <View style={styles.timerCircleInner}>
              <Text style={styles.giantTimerText}>{timeFormatted}</Text>
              <Text style={styles.secondsLabel}>{timeLeft}s rimanenti</Text>
              {!isRunning && (
                <View style={styles.pausedBadge}>
                  <Text style={styles.pausedBadgeText}>IN PAUSA</Text>
                </View>
              )}
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {/* Quick Adjustment Pills (-15s, +15s) */}
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

        {/* Bottom Command Buttons */}
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
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.90)',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.accent,
    marginBottom: 4,
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
  secondsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
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

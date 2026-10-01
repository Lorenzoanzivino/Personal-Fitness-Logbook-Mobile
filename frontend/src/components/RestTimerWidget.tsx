import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';

interface RestTimerWidgetProps {
  initialSeconds: number;
  exerciseName?: string;
  setNumber?: number;
  onFinish?: () => void;
  onDismiss?: () => void;
}

export const RestTimerWidget: React.FC<RestTimerWidgetProps> = ({
  initialSeconds,
  exerciseName,
  setNumber,
  onFinish,
  onDismiss,
}) => {
  const [totalTime, setTotalTime] = useState(initialSeconds);
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(true);

  // Audio synthesizer via Web Audio API (cross-platform fallback)
  const playChime = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        // 3 note arpeggio: Re5 (587.33), Sol5 (783.99), Si5 (987.77)
        const notes = [587.33, 783.99, 987.77];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);

          // Attack and exponential decay
          const startTime = ctx.currentTime + idx * 0.12;
          gain.gain.setValueAtTime(0.001, startTime);
          gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.4);
        });
      } catch (e) {
        console.warn('Audio chime warning:', e);
      }
    }
  };

  useEffect(() => {
    setTimeLeft(initialSeconds);
    setTotalTime(initialSeconds);
    setIsRunning(true);
  }, [initialSeconds]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            playChime();
            onFinish?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft]);

  const handleAdd15s = () => {
    setTimeLeft((t) => t + 15);
    setTotalTime((t) => t + 15);
  };

  const handleTogglePause = () => {
    setIsRunning(!isRunning);
  };

  const handleSkip = () => {
    setTimeLeft(0);
    setIsRunning(false);
    onDismiss?.();
  };

  const progressPct = totalTime > 0 ? Math.max(0, Math.min(100, ((totalTime - timeLeft) / totalTime) * 100)) : 100;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timeFormatted = `${mins}:${secs.toString().padStart(2, '0')}`;

  const isCompleted = timeLeft === 0;

  return (
    <View style={[styles.container, isCompleted && styles.containerCompleted]}>
      {/* Top Bar with Info and Timer */}
      <View style={styles.topRow}>
        <View style={styles.infoCol}>
          <Text style={styles.badgeText}>
            ⏱ RECUPERO {setNumber ? `• SERIE ${setNumber}` : ''}
          </Text>
          {exerciseName ? (
            <Text style={styles.exerciseText} numberOfLines={1}>
              {exerciseName}
            </Text>
          ) : null}
        </View>

        <View style={styles.countdownBox}>
          <Text style={[styles.countdownText, isCompleted && styles.countdownCompleted]}>
            {isCompleted ? 'PRONTO!' : timeFormatted}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBackground}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${progressPct}%`,
              backgroundColor: isCompleted ? colors.emerald : colors.accent,
            },
          ]}
        />
      </View>

      {/* Control Buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={handleAdd15s}
          style={({ pressed }) => [styles.btn, styles.btnSecondary, { opacity: pressed ? 0.75 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Aggiungi 15 secondi al recupero"
        >
          <Text style={styles.btnSecondaryText}>+15s</Text>
        </Pressable>

        <Pressable
          onPress={handleTogglePause}
          style={({ pressed }) => [styles.btn, styles.btnSecondary, { opacity: pressed ? 0.75 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={isRunning ? 'Metti in pausa il recupero' : 'Riprendi il recupero'}
        >
          <Text style={styles.btnSecondaryText}>{isRunning ? 'Pausa ⏸' : 'Riprendi ▶'}</Text>
        </Pressable>

        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => [styles.btn, styles.btnPrimary, { opacity: pressed ? 0.75 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Salta recupero"
        >
          <Text style={styles.btnPrimaryText}>{isCompleted ? 'Chiudi ✕' : 'Salta ⏩'}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#162235',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: layout.borderRadiusMd,
    padding: 14,
    marginVertical: 10,
    elevation: 6,
  },
  containerCompleted: {
    borderColor: colors.emerald,
    backgroundColor: '#0f241d',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoCol: {
    flex: 1,
    marginRight: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  exerciseText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    marginTop: 2,
  },
  countdownBox: {
    alignItems: 'flex-end',
  },
  countdownText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1,
  },
  countdownCompleted: {
    color: colors.emerald,
    fontSize: 20,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  btn: {
    flex: 1,
    height: 40,
    borderRadius: layout.borderRadiusSm,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
  },
  btnSecondary: {
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  btnSecondaryText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  btnPrimary: {
    backgroundColor: colors.accent,
  },
  btnPrimaryText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
});

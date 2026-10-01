import { colors } from '../theme/colors';

export type MetricType =
  | 'weight'
  | 'bmi'
  | 'body_fat'
  | 'muscle_mass'
  | 'bmr'
  | 'water'
  | 'fat_mass'
  | 'lean_mass'
  | 'bone_mass'
  | 'visceral_fat'
  | 'protein'
  | 'skeletal_muscle'
  | 'subcutaneous_fat';

export interface DeltaResult {
  currentValue: number;
  previousValue: number | null;
  delta: number | null;
  hasDelta: boolean;
  deltaText: string; // e.g. "(+ 1.2 kg)" or "(- 0.5 %)"
  absoluteText: string; // e.g. "65.0 kg"
  color: string; // colors.emerald, colors.danger, colors.textMuted
  isImprovement: boolean | null; // true, false, or null
}

const DECREASE_IS_IMPROVEMENT: Set<MetricType> = new Set([
  'weight',
  'bmi',
  'body_fat',
  'fat_mass',
  'visceral_fat',
  'subcutaneous_fat',
]);

/**
 * Pure helper function to compute conditional delta between current and previous measurement.
 * Calculates delta ONLY if both current and previous values exist.
 * Formats: "Valore Assoluto (± Delta Unità)", with intelligent color feedback:
 * - Green for improvements (fat/weight loss, lean/muscle gain)
 * - Red for deteriorations (fat gain, muscle loss)
 * - Gray for neutral / incalculable
 */
export function calculateDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  metricType: MetricType,
  unit: string = '',
  decimals: number = 1
): DeltaResult | null {
  if (current === null || current === undefined || isNaN(Number(current))) {
    return null;
  }

  const curNum = Number(current);
  const curFormatted = decimals === 0 ? Math.round(curNum).toString() : curNum.toFixed(decimals);
  const absoluteText = unit ? `${curFormatted} ${unit}` : curFormatted;

  if (previous === null || previous === undefined || isNaN(Number(previous))) {
    return {
      currentValue: curNum,
      previousValue: null,
      delta: null,
      hasDelta: false,
      deltaText: '',
      absoluteText,
      color: colors.textSecondary,
      isImprovement: null,
    };
  }

  const prevNum = Number(previous);
  const factor = Math.pow(10, decimals);
  const rawDelta = Math.round((curNum - prevNum) * factor) / factor;

  const sign = rawDelta > 0 ? '+ ' : rawDelta < 0 ? '- ' : '';
  const absDelta = Math.abs(rawDelta);
  const formattedDeltaVal = decimals === 0 ? Math.round(absDelta).toString() : absDelta.toFixed(decimals);
  const deltaText = rawDelta === 0 ? '(0.0)' : `(${sign}${formattedDeltaVal}${unit ? ` ${unit}` : ''})`;

  let isImprovement: boolean | null = null;
  let color: string = colors.textMuted;

  if (rawDelta !== 0) {
    const isDecreaseGood = DECREASE_IS_IMPROVEMENT.has(metricType);
    if (isDecreaseGood) {
      isImprovement = rawDelta < 0;
    } else {
      isImprovement = rawDelta > 0;
    }

    color = isImprovement ? colors.emerald : colors.danger;
  }

  return {
    currentValue: curNum,
    previousValue: prevNum,
    delta: rawDelta,
    hasDelta: true,
    deltaText,
    absoluteText,
    color,
    isImprovement,
  };
}

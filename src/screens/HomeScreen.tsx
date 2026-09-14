import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TabNavigationProp } from '../types/navigation';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { WeightTrendChart } from '../components/WeightTrendChart';
import { profileService } from '../services/profileService';
import { useGym } from '../context/GymContext';
import { useMeasurements } from '../context/MeasurementContext';
import { useDiet } from '../context/DietContext';
import { UserProfile } from '../types/profile';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<TabNavigationProp<'Home'>>();
  const { workouts, routines, calculateTotalVolume } = useGym();
  const { measurements, latestMeasurement } = useMeasurements();
  const { activeDiet } = useDiet();

  const [profile, setProfile] = useState<UserProfile>(profileService.getCurrentProfile());

  useEffect(() => {
    const unsubscribe = profileService.subscribe((p) => {
      setProfile(p);
    });
    return () => unsubscribe();
  }, []);

  // Calculate Real 7-day stats from Gym workouts
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const recentWorkouts7d = workouts.filter((w) => w.date >= sevenDaysAgoStr);
  const frequency7d = recentWorkouts7d.length;

  const volume7dKg = recentWorkouts7d.reduce((sum, w) => {
    const sets = (w.exercises || []).flatMap((e) => e.sets);
    return sum + calculateTotalVolume(sets);
  }, 0);

  const volume7dTon = (volume7dKg / 1000).toFixed(1);

  // Suggested Routine for quick launch
  const suggestedRoutine = routines[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Section with User Avatar on the Right */}
      <View style={styles.heroSection}>
        <View style={styles.heroHeaderRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={typography.caption}>BENVENUTO NEL TUO LOGBOOK</Text>
            <Text style={typography.h1}>
              Ciao, {profile.first_name || 'Atleta'} 👋
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              Dashboard e andamento prestazioni in tempo reale.
            </Text>
          </View>

          {/* Clickable Avatar navigating to Profile tab */}
          <Avatar
            imageUri={profile.avatar_url}
            name={`${profile.first_name || ''} ${profile.last_name || ''}`}
            size={48}
            editable={false}
            showBorder={false}
            onPress={() => navigation.navigate('Profile')}
            accessibilityLabel="Apri il tuo profilo utente"
          />
        </View>
      </View>

      {/* 4 Clickable KPI Cards */}
      <View style={styles.kpiGrid}>
        {/* KPI 1: Ultimo Peso (Dati Reali da MeasurementContext) */}
        <Pressable
          onPress={() => navigation.navigate('Measurements')}
          style={({ pressed }) => [styles.kpiWrapper, { opacity: pressed ? 0.8 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Apri schermata Misurazioni e peso corporeo"
        >
          <Card style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>ULTIMO PESO</Text>
              <Text style={styles.arrowIcon}>↗</Text>
            </View>
            <Text style={styles.kpiValue}>
              {latestMeasurement ? latestMeasurement.weight_kg.toFixed(1) : '--'}{' '}
              <Text style={styles.kpiUnit}>kg</Text>
            </Text>
            <View
              style={[
                styles.deltaBadge,
                {
                  backgroundColor:
                    (latestMeasurement?.weight_delta_kg ?? 0) < 0
                      ? 'rgba(16, 185, 129, 0.15)'
                      : (latestMeasurement?.weight_delta_kg ?? 0) > 0
                      ? 'rgba(245, 158, 11, 0.15)'
                      : colors.backgroundSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.deltaText,
                  {
                    color:
                      (latestMeasurement?.weight_delta_kg ?? 0) < 0
                        ? colors.emerald
                        : (latestMeasurement?.weight_delta_kg ?? 0) > 0
                        ? colors.warning
                        : colors.textSecondary,
                  },
                ]}
              >
                {latestMeasurement?.weight_delta_kg !== null &&
                latestMeasurement?.weight_delta_kg !== undefined
                  ? `${latestMeasurement.weight_delta_kg > 0 ? '+' : ''}${latestMeasurement.weight_delta_kg.toFixed(1)} kg vs prec.`
                  : 'Nessun delta'}
              </Text>
            </View>
          </Card>
        </Pressable>

        {/* KPI 2: Volume Totale 7GG */}
        <Pressable
          onPress={() => navigation.navigate('Gym', { initialSubTab: 'progression' })}
          style={({ pressed }) => [styles.kpiWrapper, { opacity: pressed ? 0.8 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Apri progressione volume e carichi palestra"
        >
          <Card style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>VOLUME 7GG</Text>
              <Text style={styles.arrowIcon}>↗</Text>
            </View>
            <Text style={styles.kpiValue}>
              {volume7dTon} <Text style={styles.kpiUnit}>ton</Text>
            </Text>
            <View
              style={[
                styles.deltaBadge,
                { backgroundColor: 'rgba(168, 85, 247, 0.15)' },
              ]}
            >
              <Text style={[styles.deltaText, { color: colors.volume }]}>
                {volume7dKg.toLocaleString()} kg totali
              </Text>
            </View>
          </Card>
        </Pressable>

        {/* KPI 3: Frequenza Settimanale */}
        <Pressable
          onPress={() => navigation.navigate('Gym', { initialSubTab: 'history' })}
          style={({ pressed }) => [styles.kpiWrapper, { opacity: pressed ? 0.8 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Apri storico sessioni allenamento"
        >
          <Card style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>FREQUENZA</Text>
              <Text style={styles.arrowIcon}>↗</Text>
            </View>
            <Text style={styles.kpiValue}>
              {frequency7d} <Text style={styles.kpiUnit}>sessioni</Text>
            </Text>
            <View
              style={[
                styles.deltaBadge,
                {
                  backgroundColor:
                    frequency7d >= 3 ? colors.emeraldMuted : colors.backgroundSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.deltaText,
                  { color: frequency7d >= 3 ? colors.emerald : colors.textSecondary },
                ]}
              >
                {frequency7d >= 3 ? 'Target raggiunto ✓' : 'In corso'}
              </Text>
            </View>
          </Card>
        </Pressable>

        {/* KPI 4: Dieta Attiva (Dati Reali da DietContext) */}
        <Pressable
          onPress={() => navigation.navigate('Diet')}
          style={({ pressed }) => [styles.kpiWrapper, { opacity: pressed ? 0.8 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Apri piano nutrizionale e documento PDF"
        >
          <Card style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <Text style={styles.kpiLabel}>DIETA ATTIVA</Text>
              <Text style={styles.arrowIcon}>↗</Text>
            </View>
            <Text
              style={[styles.kpiValue, { fontSize: 14, marginTop: 4 }]}
              numberOfLines={1}
            >
              {activeDiet ? activeDiet.name : 'Nessuna dieta'}
            </Text>
            <View
              style={[
                styles.deltaBadge,
                {
                  backgroundColor: activeDiet
                    ? colors.accentMuted
                    : colors.backgroundSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.deltaText,
                  { color: activeDiet ? colors.accent : colors.textMuted },
                ]}
              >
                {activeDiet ? 'PDF Pronto 📄' : 'Nessun PDF'}
              </Text>
            </View>
          </Card>
        </Pressable>
      </View>

      {/* Visual Weight Trend Chart (Curva Andamento Peso) */}
      <WeightTrendChart
        measurements={measurements}
        onAddPress={() => navigation.navigate('MeasurementModal')}
      />

      {/* Live Logger Quick Action Banner */}
      <Card highlighted style={styles.actionCard}>
        <View style={styles.actionCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={typography.h2}>Sessione Programmata</Text>
            <Text style={typography.caption}>
              {suggestedRoutine ? suggestedRoutine.name : 'Allenamento del Giorno'}
            </Text>
          </View>
          <View style={styles.overloadBadge}>
            <Text style={styles.overloadBadgeText}>OVERLOAD</Text>
          </View>
        </View>

        <Pressable
          onPress={() =>
            navigation.navigate('WorkoutModal', {
              routineId: suggestedRoutine?.id,
              routineName: suggestedRoutine?.name || 'Spinta & Petto Focus',
              weekNumber: 3,
            })
          }
          style={({ pressed }) => [
            styles.primaryButton,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Avvia Allenamento Live"
        >
          <Text style={styles.primaryButtonText}>▶ AVVIA LIVE LOGGER PALESTRA</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 96,
  },
  heroSection: {
    marginBottom: 16,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  kpiWrapper: {
    width: '48.5%',
    marginBottom: 10,
  },
  kpiCard: {
    padding: 12,
  },
  kpiTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  arrowIcon: {
    fontSize: 12,
    color: colors.textMuted,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  kpiUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  deltaBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.backgroundSubtle,
  },
  deltaText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  actionCard: {
    marginTop: 4,
    marginBottom: 16,
    padding: 16,
  },
  actionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  overloadBadge: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: layout.borderRadiusSm,
  },
  overloadBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: layout.borderRadiusMd,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Card } from '../components/Card';
import { ScreenBackgroundWrapper } from '../components/ScreenBackgroundWrapper';
import { CustomConfirmModal } from '../components/CustomConfirmModal';
import { ToastFeedback, ToastType } from '../components/ToastFeedback';
import { API_CONFIG } from '../services/config';
import { gymStorage } from '../services/gymStorage';
import { measurementStorage } from '../services/measurementStorage';
import { dietStorage } from '../services/dietStorage';
import { profileService } from '../services/profileService';
import { authService } from '../services/authService';
import { useGym } from '../context/GymContext';

export const SettingsScreen: React.FC = () => {
  const { resetEntireApp } = useGym();

  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

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

  const handleExportJson = async () => {
    try {
      const [routines, workouts, folders, exercises, measurements, diets] = await Promise.all([
        gymStorage.loadRoutines(),
        gymStorage.loadWorkouts(),
        gymStorage.loadFolders(),
        gymStorage.loadExercises(),
        measurementStorage.loadMeasurements(),
        dietStorage.loadDiets(),
      ]);
      const profile = profileService.getCurrentProfile();
      const backupData = {
        exportedAt: new Date().toISOString(),
        appName: 'MyTrainUp Logbook',
        version: '1.0.0',
        profile,
        stats: {
          routinesCount: routines.length,
          workoutsCount: workouts.length,
          foldersCount: folders.length,
          exercisesCount: exercises.length,
          measurementsCount: measurements.length,
          dietsCount: diets.length,
        },
        data: {
          routines,
          workouts,
          folders,
          exercises,
          measurements,
          diets,
        },
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      await Clipboard.setStringAsync(jsonString);
      showToast(
        'success',
        `Backup JSON (${backupData.stats.routinesCount} schede, ${backupData.stats.workoutsCount} sessioni, ${backupData.stats.measurementsCount} pesate) copiato negli appunti!`
      );
    } catch {
      showToast('error', 'Errore durante la generazione del backup JSON.');
    }
  };

  const handleResetAppConfirm = () => {
    setConfirmModal({
      visible: true,
      title: '⚠️ Reset Totale Applicazione',
      message:
        'ATTENZIONE: Questa azione eliminerà DEFINITIVAMENTE tutti i dati memorizzati: profilo atleta/trainer, schede di allenamento, storico sessioni, pesate e diete.\n\nIl catalogo dei 46 esercizi predefiniti rimarrà integro.\n\nQuesta operazione non è reversibile. Vuoi procedere?',
      confirmText: 'Svuota Tutto',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await resetEntireApp();
          await measurementStorage.clearAllMeasurements();
          await dietStorage.clearAllDiets();
          await authService.clearAllProvisionedClients();
          await profileService.resetProfile();
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('success', 'Applicazione ripristinata con successo ai valori iniziali.');
        } catch {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('error', 'Errore durante il reset dell\'applicazione.');
        }
      },
    });
  };

  return (
    <ScreenBackgroundWrapper>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={typography.caption}>SISTEMA & PORTABILITÀ</Text>
          <Text style={typography.h1}>Impostazioni</Text>
        </View>

        {/* Backend & Networking Info */}
        <Card style={styles.sectionCard}>
          <Text style={typography.h3}>Connessione Backend</Text>
          <Text style={[typography.caption, { marginTop: 4, marginBottom: 12 }]}>
            Endpoint API configurato per sincronizzazione client / trainer
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Base URL:</Text>
            <Text style={styles.infoValue}>{API_CONFIG.baseUrl}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Timeout:</Text>
            <Text style={styles.infoValue}>{API_CONFIG.timeoutMs / 1000}s</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Stato Connessione:</Text>
            <View style={styles.onlinePill}>
              <Text style={styles.onlinePillText}>Configurato</Text>
            </View>
          </View>
        </Card>

        {/* Backup & Portability */}
        <Card style={styles.sectionCard}>
          <Text style={typography.h3}>Backup & Portabilità Dati</Text>
          <Text style={[typography.caption, { marginTop: 4, marginBottom: 12 }]}>
            Esporta l'intero database locale in formato JSON portabile (copia direttamente negli appunti)
          </Text>

          <Pressable
            onPress={handleExportJson}
            style={({ pressed }) => [
              styles.actionButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Esporta backup JSON negli appunti"
          >
            <Text style={styles.actionButtonText}>⬇ Copia Backup JSON negli Appunti</Text>
          </Pressable>
        </Card>

        {/* Target and Build Info */}
        <Card style={styles.sectionCard}>
          <Text style={typography.h3}>Info Applicazione</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Applicazione:</Text>
            <Text style={styles.infoValue}>MyTrainUp Logbook</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Versione:</Text>
            <Text style={styles.infoValue}>1.0.0 Standalone (Fase 6)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Target:</Text>
            <Text style={styles.infoValue}>Android APK Standalone / Web Preview</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Architettura Storage:</Text>
            <Text style={styles.infoValue}>AsyncStorage Persistente Locale</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Esercizi Predefiniti:</Text>
            <Text style={styles.infoValue}>46 Esercizi nel Catalogo Base</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Framework:</Text>
            <Text style={styles.infoValue}>React Native + Expo SDK 57</Text>
          </View>
        </Card>

        {/* Danger Zone: Moved from Profile */}
        <Card style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>⚠️ Zona di Pericolo: Reset Completo</Text>
          <Text style={styles.dangerDesc}>
            Se desideri ripartire completamente da zero o cancellare ogni dato memorizzato sul dispositivo,
            puoi eseguire un reset totale. Verranno eliminati: il profilo, tutte le schede create,
            lo storico completo delle sessioni, le misurazioni e le diete salvate. Il catalogo dei 46 esercizi rimarrà intatto.
          </Text>
          <Pressable
            onPress={handleResetAppConfirm}
            style={({ pressed }) => [
              styles.dangerButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cancella tutti i dati dell'applicazione"
          >
            <Text style={styles.dangerButtonText}>SVUOTA TUTTO & RESET COMPLETO</Text>
          </Pressable>
        </Card>
      </ScrollView>

      {/* Custom Confirmation Modal */}
      <CustomConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
      />

      {/* Toast Feedback */}
      <ToastFeedback
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </ScreenBackgroundWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 96,
  },
  header: {
    marginBottom: 16,
  },
  sectionCard: {
    marginBottom: 14,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '700',
  },
  onlinePill: {
    backgroundColor: colors.emeraldMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: layout.borderRadiusSm,
  },
  onlinePillText: {
    color: colors.emerald,
    fontSize: 11,
    fontWeight: '700',
  },
  actionButton: {
    backgroundColor: colors.backgroundSubtle,
    height: layout.minTouchTarget,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  actionButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  dangerCard: {
    marginBottom: 14,
    padding: 16,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.danger,
    marginBottom: 6,
  },
  dangerDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  dangerButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger,
    height: layout.minTouchTarget,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
});

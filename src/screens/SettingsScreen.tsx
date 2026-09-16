import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
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
import { exportFullBackup, shareBackupFile } from '../services/backupService';
import { useGym } from '../context/GymContext';
import { useMeasurements } from '../context/MeasurementContext';
import { useDiet } from '../context/DietContext';

interface ParsedBackupData {
  appName: string;
  exportedAt: string | null;
  routines: any[];
  workouts: any[];
  folders: any[];
  exercises: any[];
  measurements: any[];
  diets: any[];
  profile: any | null;
}

export const SettingsScreen: React.FC = () => {
  const { resetEntireApp, reloadGymData } = useGym();
  const { reloadMeasurements } = useMeasurements();
  const { reloadDiets } = useDiet();

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

  // Import Modal State
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('');
  const [parsedBackup, setParsedBackup] = useState<ParsedBackupData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const showToast = (type: ToastType, message: string) => {
    setToast({ visible: true, type, message });
  };

  const [isExportingBackup, setIsExportingBackup] = useState(false);

  // Export Logic - Full Backup with Sharing / Download
  const handleExportFullBackup = async () => {
    if (isExportingBackup) return;
    try {
      setIsExportingBackup(true);
      const jsonString = await exportFullBackup();
      await shareBackupFile(jsonString);
      showToast('success', 'Backup JSON completo esportato con successo!');
    } catch (err: any) {
      console.error('Errore esportazione backup:', err);
      showToast('error', err?.message || 'Errore durante l\'esportazione del backup.');
    } finally {
      setIsExportingBackup(false);
    }
  };

  // Export Logic - Copy to Clipboard fallback
  const handleCopyJsonToClipboard = async () => {
    try {
      const jsonString = await exportFullBackup();
      await Clipboard.setStringAsync(jsonString);
      showToast('success', 'Backup JSON completo copiato negli appunti!');
    } catch {
      showToast('error', 'Errore durante la copia del backup JSON negli appunti.');
    }
  };

  // Validation & Parse Logic for Import
  const validateAndParseJson = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setParsedBackup(null);
      setParseError(null);
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      const data = parsed.data || parsed;
      const routines = Array.isArray(data.routines) ? data.routines : [];
      const workouts = Array.isArray(data.workouts) ? data.workouts : [];
      const folders = Array.isArray(data.folders) ? data.folders : [];
      const exercises = Array.isArray(data.exercises) ? data.exercises : [];
      const measurements = Array.isArray(data.measurements) ? data.measurements : [];
      const diets = Array.isArray(data.diets) ? data.diets : [];

      if (
        routines.length === 0 &&
        workouts.length === 0 &&
        measurements.length === 0 &&
        diets.length === 0 &&
        exercises.length === 0 &&
        !parsed.profile
      ) {
        setParseError('Il JSON non contiene entità di backup valide (schede, allenamenti, pesate o profilo).');
        setParsedBackup(null);
        return;
      }

      setParsedBackup({
        appName: parsed.appName || 'MY TRAIN UP',
        exportedAt: parsed.exportedAt || null,
        routines,
        workouts,
        folders,
        exercises,
        measurements,
        diets,
        profile: parsed.profile || null,
      });
      setParseError(null);
    } catch {
      setParseError('Sintassi JSON non valida. Assicurati che il testo incollato sia un file JSON corretto.');
      setParsedBackup(null);
    }
  };

  // Paste from Clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const clipText = await Clipboard.getStringAsync();
      if (!clipText || !clipText.trim()) {
        showToast('error', 'Gli appunti sono vuoti. Copia prima un testo JSON.');
        return;
      }
      setRawJsonText(clipText);
      validateAndParseJson(clipText);
    } catch {
      showToast('error', 'Impossibile leggere dagli appunti.');
    }
  };

  // Pick .json File
  const handlePickJsonFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let text = '';
        if ((asset as any).file) {
          text = await (asset as any).file.text();
        } else if (asset.uri) {
          const res = await fetch(asset.uri);
          text = await res.text();
        }

        if (text) {
          setRawJsonText(text);
          validateAndParseJson(text);
        }
      }
    } catch {
      showToast('error', 'Errore durante la lettura del file JSON selezionato.');
    }
  };

  // Confirm and Execute Import
  const handleConfirmImport = () => {
    if (!parsedBackup) return;

    setConfirmModal({
      visible: true,
      title: 'Ripristina Dati da Backup',
      message: `Verranno ripristinate:\n• ${parsedBackup.routines.length} schede di allenamento\n• ${parsedBackup.workouts.length} sessioni registrate\n• ${parsedBackup.folders.length} cartelle\n• ${parsedBackup.measurements.length} pesate / misure\n• ${parsedBackup.diets.length} piani alimentari\n\nATTENZIONE: I dati attuali verranno sostituiti con quelli di questo backup. Vuoi procedere?`,
      confirmText: 'Sì, Ripristina Ora',
      isDestructive: true,
      onConfirm: async () => {
        setImporting(true);
        try {
          if (parsedBackup.routines) {
            await gymStorage.saveRoutines(parsedBackup.routines);
          }
          if (parsedBackup.workouts) {
            await gymStorage.saveWorkouts(parsedBackup.workouts);
          }
          if (parsedBackup.folders) {
            await gymStorage.saveFolders(parsedBackup.folders);
          }
          if (parsedBackup.exercises && parsedBackup.exercises.length > 0) {
            await gymStorage.saveExercises(parsedBackup.exercises);
          }
          if (parsedBackup.measurements) {
            await measurementStorage.saveMeasurements(parsedBackup.measurements);
          }
          if (parsedBackup.diets) {
            await dietStorage.saveDiets(parsedBackup.diets);
          }
          if (parsedBackup.profile) {
            await profileService.updateProfile(parsedBackup.profile);
          }

          // Aggiorna gli stati in memoria di tutti i contesti
          await reloadGymData();
          await reloadMeasurements();
          await reloadDiets();

          setConfirmModal((prev) => ({ ...prev, visible: false }));
          setImportModalVisible(false);
          setRawJsonText('');
          setParsedBackup(null);
          showToast('success', 'Backup JSON ripristinato con successo! Dati caricati nell\'app.');
        } catch {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          showToast('error', 'Errore durante il ripristino del backup.');
        } finally {
          setImporting(false);
        }
      },
    });
  };

  // Danger Reset Logic
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
          await reloadGymData();
          await reloadMeasurements();
          await reloadDiets();
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
            Esporta o ripristina l'intero database locale in formato JSON portabile
          </Text>

          <View style={styles.backupActionsContainer}>
            <Pressable
              onPress={handleExportFullBackup}
              disabled={isExportingBackup}
              style={({ pressed }) => [
                styles.primaryActionButton,
                isExportingBackup && styles.actionButtonDisabled,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Esporta Backup Completo"
            >
              {isExportingBackup ? (
                <View style={styles.buttonLoadingRow}>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.primaryActionButtonText}>Esportazione in corso...</Text>
                </View>
              ) : (
                <Text style={styles.primaryActionButtonText}>📦 Esporta Backup Completo</Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleCopyJsonToClipboard}
              disabled={isExportingBackup}
              style={({ pressed }) => [
                styles.actionButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Copia backup JSON negli appunti"
            >
              <Text style={styles.actionButtonText}>📋 Copia Backup JSON negli Appunti</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setImportModalVisible(true);
                setRawJsonText('');
                setParsedBackup(null);
                setParseError(null);
              }}
              disabled={isExportingBackup}
              style={({ pressed }) => [
                styles.importActionButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Importa o ripristina backup JSON"
            >
              <Text style={styles.importActionButtonText}>⬆ Importa / Ripristina Backup JSON</Text>
            </Pressable>
          </View>
        </Card>

        {/* Target and Build Info */}
        <Card style={styles.sectionCard}>
          <Text style={typography.h3}>Info Applicazione</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Applicazione:</Text>
            <Text style={styles.infoValue}>MY TRAIN UP</Text>
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

        {/* Danger Zone */}
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

      {/* Import Backup Modal */}
      <Modal
        visible={importModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setImportModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContentCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Ripristino Backup JSON</Text>
                <Text style={styles.modalSubtitle}>
                  Incolla il testo del backup o seleziona un file JSON
                </Text>
              </View>
              <Pressable
                onPress={() => setImportModalVisible(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Chiudi modale importazione"
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Quick Action Buttons */}
              <View style={styles.modalQuickActionsRow}>
                <Pressable
                  onPress={handlePasteFromClipboard}
                  style={styles.quickActionBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Incolla dagli appunti"
                >
                  <Text style={styles.quickActionBtnText}>📋 Incolla da Appunti</Text>
                </Pressable>

                <Pressable
                  onPress={handlePickJsonFile}
                  style={styles.quickActionBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Carica file JSON"
                >
                  <Text style={styles.quickActionBtnText}>📁 Sfoglia File .json</Text>
                </Pressable>
              </View>

              {/* Text Input Area */}
              <Text style={styles.fieldLabel}>CONTENUTO JSON DEL BACKUP:</Text>
              <TextInput
                style={styles.jsonTextInput}
                value={rawJsonText}
                onChangeText={(val) => {
                  setRawJsonText(val);
                  validateAndParseJson(val);
                }}
                placeholder="Incolla qui la stringa JSON generata dal backup..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Error Message Banner */}
              {parseError && (
                <View style={styles.parseErrorBanner}>
                  <Text style={styles.parseErrorIcon}>⚠️</Text>
                  <Text style={styles.parseErrorText}>{parseError}</Text>
                </View>
              )}

              {/* Valid Backup Summary Preview */}
              {parsedBackup && (
                <View style={styles.backupSummaryCard}>
                  <View style={styles.summaryBadgeRow}>
                    <View style={styles.summaryBadge}>
                      <Text style={styles.summaryBadgeText}>✓ BACKUP VALIDO RICONOSCIUTO</Text>
                    </View>
                    <Text style={styles.summaryAppName}>{parsedBackup.appName}</Text>
                  </View>

                  {parsedBackup.exportedAt && (
                    <Text style={styles.summaryExportDate}>
                      Esportato il: {new Date(parsedBackup.exportedAt).toLocaleString('it-IT')}
                    </Text>
                  )}

                  <View style={styles.summaryStatsGrid}>
                    <View style={styles.summaryStatBox}>
                      <Text style={styles.summaryStatValue}>{parsedBackup.routines.length}</Text>
                      <Text style={styles.summaryStatLabel}>Schede</Text>
                    </View>
                    <View style={styles.summaryStatBox}>
                      <Text style={styles.summaryStatValue}>{parsedBackup.workouts.length}</Text>
                      <Text style={styles.summaryStatLabel}>Sessioni</Text>
                    </View>
                    <View style={styles.summaryStatBox}>
                      <Text style={styles.summaryStatValue}>{parsedBackup.folders.length}</Text>
                      <Text style={styles.summaryStatLabel}>Cartelle</Text>
                    </View>
                    <View style={styles.summaryStatBox}>
                      <Text style={styles.summaryStatValue}>{parsedBackup.measurements.length}</Text>
                      <Text style={styles.summaryStatLabel}>Pesate</Text>
                    </View>
                    <View style={styles.summaryStatBox}>
                      <Text style={styles.summaryStatValue}>{parsedBackup.diets.length}</Text>
                      <Text style={styles.summaryStatLabel}>Diete</Text>
                    </View>
                  </View>

                  {parsedBackup.profile && (
                    <View style={styles.summaryProfileRow}>
                      <Text style={styles.summaryProfileLabel}>Profilo incluso:</Text>
                      <Text style={styles.summaryProfileValue}>
                        👤 {parsedBackup.profile.first_name || ''} {parsedBackup.profile.last_name || ''} ({parsedBackup.profile.role || 'TRAINER'})
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Modal Bottom Actions */}
            <View style={styles.modalFooterRow}>
              <Pressable
                onPress={() => setImportModalVisible(false)}
                style={styles.modalCancelBtn}
                accessibilityRole="button"
                accessibilityLabel="Annulla importazione"
              >
                <Text style={styles.modalCancelBtnText}>Annulla</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmImport}
                disabled={!parsedBackup || importing}
                style={[
                  styles.modalConfirmBtn,
                  (!parsedBackup || importing) && styles.modalConfirmBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Ripristina dati del backup"
              >
                <Text style={styles.modalConfirmBtnText}>
                  {importing ? 'Ripristino in corso...' : '✅ Ripristina Questo Backup'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
    padding: 14,
    paddingBottom: 100,
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
  backupActionsContainer: {
    gap: 10,
  },
  primaryActionButton: {
    backgroundColor: colors.accent,
    height: layout.minTouchTarget,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.6,
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
  importActionButton: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    height: layout.minTouchTarget,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  importActionButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContentCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 18,
    maxHeight: '88%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalQuickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: colors.backgroundSubtle,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  quickActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  jsonTextInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    padding: 10,
    color: colors.text,
    fontSize: 12,
    minHeight: 90,
    maxHeight: 140,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 10,
  },
  parseErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  parseErrorIcon: {
    fontSize: 16,
  },
  parseErrorText: {
    flex: 1,
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
    lineHeight: 16,
  },
  backupSummaryCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  summaryBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryBadge: {
    backgroundColor: colors.emeraldMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.emerald,
  },
  summaryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.emerald,
  },
  summaryAppName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  summaryExportDate: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  summaryStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  summaryStatBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: 56,
  },
  summaryStatValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.accent,
  },
  summaryStatLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  summaryProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.2)',
    paddingTop: 8,
  },
  summaryProfileLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  summaryProfileValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '700',
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: colors.backgroundSubtle,
    height: layout.minTouchTarget,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalCancelBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    flex: 2,
    backgroundColor: colors.emerald,
    height: layout.minTouchTarget,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnDisabled: {
    backgroundColor: colors.backgroundSubtle,
    opacity: 0.5,
  },
  modalConfirmBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },
});

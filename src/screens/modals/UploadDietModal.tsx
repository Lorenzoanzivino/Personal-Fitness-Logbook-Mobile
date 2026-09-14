import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { RootStackNavigationProp } from '../../types/navigation';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Card } from '../../components/Card';
import { useDiet } from '../../context/DietContext';
import { ToastFeedback, ToastType } from '../../components/ToastFeedback';

export const UploadDietModal: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { addDiet } = useDiet();

  const [dietName, setDietName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isActive, setIsActive] = useState(true);

  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    uri: string;
    size?: number;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; type: ToastType; message: string }>({
    visible: false,
    type: 'info',
    message: '',
  });

  const handlePickDocument = async () => {
    setErrorMessage(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFile({
          name: asset.name,
          uri: asset.uri,
          size: asset.size,
        });

        // Suggerisci il nome del piano dal file se il campo è vuoto
        if (!dietName.trim()) {
          const cleanName = asset.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');
          const capitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
          setDietName(capitalized);
        }
      }
    } catch (err) {
      console.warn('Errore durante la selezione del documento:', err);
      setErrorMessage('Impossibile aprire il selettore documenti del sistema.');
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  const handleUpload = async () => {
    if (!dietName.trim()) {
      setErrorMessage('Inserisci un nome descrittivo per il piano nutrizionale.');
      return;
    }

    if (!selectedFile) {
      setErrorMessage('Seleziona un file PDF prima di procedere con il caricamento.');
      return;
    }

    try {
      await addDiet({
        name: dietName.trim(),
        description: description.trim() || 'Piano nutrizionale PDF caricato dall\'utente.',
        start_date: startDate.trim() || new Date().toISOString().split('T')[0],
        end_date: null,
        is_active: isActive ? 1 : 0,
        notes: null,
        source_file_name: selectedFile.name,
        file_path: selectedFile.uri,
        file_size: selectedFile.size || null,
        mime_type: 'application/pdf',
      });

      setToast({
        visible: true,
        type: 'success',
        message: `Piano "${dietName.trim()}" caricato ed impostato come ${
          isActive ? 'ATTIVO' : 'ARCHIVIATO'
        }! 🥗`,
      });

      setTimeout(() => {
        navigation.goBack();
      }, 700);
    } catch (err) {
      console.warn('Errore salvataggio piano dieta:', err);
      setErrorMessage('Si è verificato un errore durante il salvataggio.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.modalHeader}>
        <View>
          <Text style={typography.label}>NUTRIZIONE & DIETA</Text>
          <Text style={typography.h2}>Carica PDF Dieta</Text>
        </View>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Chiudi modale upload dieta"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
          </View>
        )}

        <Card style={styles.formCard}>
          {/* File Picker Zone */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DOCUMENTO PDF (SELEZIONA DA DISPOSITIVO) *</Text>
            <Pressable
              onPress={handlePickDocument}
              style={({ pressed }) => [
                styles.fileDropZone,
                selectedFile && styles.fileDropZoneActive,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Seleziona file PDF dal dispositivo"
            >
              <Text style={styles.uploadIcon}>{selectedFile ? '📄' : '📁'}</Text>
              <Text style={styles.dropZoneTitle}>
                {selectedFile ? selectedFile.name : 'Tocca per scegliere il file PDF'}
              </Text>
              <Text style={styles.dropZoneSubtitle}>
                {selectedFile
                  ? `${formatFileSize(selectedFile.size)} • File PDF pronto per l'archiviazione`
                  : 'Apre il file manager di Ubuntu/Android/iOS (filtro .pdf)'}
              </Text>

              <View
                style={[
                  styles.pickFileBtn,
                  selectedFile && styles.pickFileBtnActive,
                ]}
              >
                <Text style={styles.pickFileBtnText}>
                  {selectedFile ? '✓ Cambia File' : '+ Seleziona File PDF'}
                </Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NOME DEL PIANO *</Text>
            <TextInput
              style={styles.textInput}
              value={dietName}
              onChangeText={(text) => {
                setDietName(text);
                setErrorMessage(null);
              }}
              placeholder="es. Dieta Definizione Primavera 2026"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DATA INIZIO (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.textInput}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-09-14"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DESCRIZIONE / MACRO TARGET (OPZIONALE)</Text>
            <TextInput
              style={[styles.textInput, styles.descInput]}
              value={description}
              onChangeText={setDescription}
              placeholder="es. Target: 2.800 kcal, 40C / 30P / 30F, rilasciata dal nutrizionista..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Toggle Active Status */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>STATO DEL PIANO</Text>
            <View style={styles.statusToggleRow}>
              <Pressable
                onPress={() => setIsActive(true)}
                style={[styles.statusOption, isActive && styles.statusOptionActive]}
              >
                <Text style={[styles.statusOptionText, isActive && styles.statusOptionTextActive]}>
                  ✓ Imposta come Piano Attivo
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setIsActive(false)}
                style={[styles.statusOption, !isActive && styles.statusOptionActive]}
              >
                <Text style={[styles.statusOptionText, !isActive && styles.statusOptionTextActive]}>
                  📁 Archivia nello Storico
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleUpload}
            style={({ pressed }) => [
              styles.submitButton,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Conferma caricamento piano dieta"
          >
            <Text style={styles.submitButtonText}>💾 SALVA PIANO NUTRIZIONALE</Text>
          </Pressable>
        </Card>
      </ScrollView>

      <ToastFeedback
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.primary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: layout.borderRadiusSm,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  formCard: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.borderRadiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  descInput: {
    minHeight: 60,
  },
  fileDropZone: {
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
    borderRadius: layout.borderRadiusMd,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSubtle,
  },
  fileDropZoneActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  dropZoneTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  dropZoneSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  pickFileBtn: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: colors.accent,
  },
  pickFileBtnActive: {
    backgroundColor: colors.emerald,
  },
  pickFileBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  statusToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: layout.borderRadiusSm,
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statusOptionActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statusOptionTextActive: {
    color: colors.accent,
    fontWeight: '800',
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: layout.borderRadiusMd,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
});

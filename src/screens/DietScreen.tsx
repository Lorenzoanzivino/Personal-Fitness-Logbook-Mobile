import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TabNavigationProp } from '../types/navigation';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Card } from '../components/Card';
import { useDiet } from '../context/DietContext';
import { DietPdf } from '../types/diet';
import { CustomConfirmModal } from '../components/CustomConfirmModal';
import { ToastFeedback, ToastType } from '../components/ToastFeedback';

export const DietScreen: React.FC = () => {
  const navigation = useNavigation<TabNavigationProp<'Diet'>>();
  const { diets, activeDiet, setActiveDiet, deleteDiet } = useDiet();

  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [toast, setToast] = useState<{ visible: boolean; type: ToastType; message: string }>({
    visible: false,
    type: 'info',
    message: '',
  });

  const formatSize = (bytes?: number | null): string => {
    if (!bytes) return '';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  const handleOpenViewer = (diet: DietPdf) => {
    navigation.navigate('PdfViewerModal', {
      dietId: diet.id,
      title: diet.name,
      pdfUri: diet.file_path || undefined,
    });
  };

  const handleDeleteConfirm = (diet: DietPdf) => {
    setConfirmModal({
      visible: true,
      title: 'Elimina Piano Dieta',
      message: `Sei sicuro di voler eliminare "${diet.name}" e il relativo file associato?`,
      onConfirm: async () => {
        try {
          await deleteDiet(diet.id);
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          setToast({
            visible: true,
            type: 'success',
            message: `Piano "${diet.name}" eliminato.`,
          });
        } catch {
          setConfirmModal((prev) => ({ ...prev, visible: false }));
          setToast({
            visible: true,
            type: 'error',
            message: 'Errore durante l\'eliminazione del piano.',
          });
        }
      },
    });
  };

  const archivedDiets = diets.filter((d) => d.id !== activeDiet?.id);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={typography.caption}>NUTRIZIONE & PIANI ALIMENTARI</Text>
            <Text style={typography.h1}>Piani Dieta PDF</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('UploadDietModal')}
            style={({ pressed }) => [
              styles.uploadButton,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Carica nuovo file PDF dieta"
          >
            <Text style={styles.uploadButtonText}>+ Carica PDF</Text>
          </Pressable>
        </View>

        {/* Active Diet Card */}
        {activeDiet ? (
          <Card highlighted style={styles.activePlanCard}>
            <View style={styles.statusRow}>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>PIANO ATTIVO</Text>
              </View>
              <Text style={typography.caption}>Valido dal {activeDiet.start_date}</Text>
            </View>

            <Text style={[typography.h2, { marginVertical: 6 }]}>
              {activeDiet.name}
            </Text>
            <Text style={typography.body}>
              {activeDiet.description || 'Nessuna descrizione specificata.'}
            </Text>

            <Pressable
              onPress={() => handleOpenViewer(activeDiet)}
              style={styles.pdfInfoBox}
              accessibilityRole="button"
              accessibilityLabel="Visualizza anteprima documento PDF"
            >
              <Text style={styles.pdfIcon}>📄</Text>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={typography.bodyBold}>
                  {activeDiet.source_file_name || 'documento_dieta.pdf'}
                </Text>
                <Text style={typography.caption}>
                  Documento PDF {formatSize(activeDiet.file_size)} • Tocca per visualizzare
                </Text>
              </View>
              <Text style={styles.arrowIcon}>↗</Text>
            </Pressable>

            <Pressable
              onPress={() => handleOpenViewer(activeDiet)}
              style={({ pressed }) => [
                styles.viewPdfButton,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Apri visualizzatore PDF a schermo intero"
            >
              <Text style={styles.viewPdfButtonText}>👁 APRI VISUALIZZATORE PDF</Text>
            </Pressable>
          </Card>
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyCardIcon}>🥗</Text>
            <Text style={typography.h3}>Nessun piano nutrizionale attivo</Text>
            <Text style={[typography.caption, { textAlign: 'center', marginTop: 4 }]}>
              Carica il tuo primo piano PDF per consultarlo durante la giornata.
            </Text>
          </Card>
        )}

        {/* Archivio Piani Passati */}
        <Text style={[typography.h3, { marginTop: 16, marginBottom: 8 }]}>
          Archivio Piani Nutrizionali ({archivedDiets.length})
        </Text>

        {archivedDiets.length === 0 ? (
          <Text style={styles.emptyArchiveText}>
            Nessun altro piano presente nell'archivio.
          </Text>
        ) : (
          archivedDiets.map((diet) => (
            <Card key={diet.id} style={styles.archiveCard}>
              <View style={styles.archiveRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={typography.bodyBold}>{diet.name}</Text>
                  <Text style={typography.caption}>
                    {diet.start_date} • {formatSize(diet.file_size) || 'PDF'}
                  </Text>
                </View>

                <View style={styles.archiveActions}>
                  <Pressable
                    onPress={() => handleOpenViewer(diet)}
                    style={styles.archiveViewBtn}
                  >
                    <Text style={styles.archiveViewBtnText}>Visualizza</Text>
                  </Pressable>

                  <Pressable
                    onPress={async () => {
                      await setActiveDiet(diet.id);
                      setToast({
                        visible: true,
                        type: 'success',
                        message: `"${diet.name}" impostato come piano attivo!`,
                      });
                    }}
                    style={styles.archiveActivateBtn}
                  >
                    <Text style={styles.archiveActivateBtnText}>Attiva</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleDeleteConfirm(diet)}
                    style={styles.archiveDeleteBtn}
                  >
                    <Text style={styles.archiveDeleteBtnText}>🗑</Text>
                  </Pressable>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Confirmation Modal */}
      <CustomConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Elimina"
        isDestructive
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
    </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  uploadButton: {
    backgroundColor: colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: layout.borderRadiusLg,
  },
  uploadButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  activePlanCard: {
    marginBottom: 16,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    color: colors.emerald,
    fontSize: 10,
    fontWeight: '800',
  },
  pdfInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusSm,
    padding: 12,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pdfIcon: {
    fontSize: 24,
  },
  arrowIcon: {
    fontSize: 16,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  viewPdfButton: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: layout.borderRadiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewPdfButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyCardIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyArchiveText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  archiveCard: {
    marginBottom: 8,
    padding: 12,
  },
  archiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  archiveActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  archiveViewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  archiveViewBtnText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  archiveActivateBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: colors.emerald,
  },
  archiveActivateBtnText: {
    color: colors.emerald,
    fontSize: 11,
    fontWeight: '700',
  },
  archiveDeleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  archiveDeleteBtnText: {
    fontSize: 12,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList, RootStackNavigationProp } from '../../types/navigation';
import { colors } from '../../theme/colors';
import { layout } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Card } from '../../components/Card';
import { useDiet } from '../../context/DietContext';

type PdfViewerRouteProp = RouteProp<RootStackParamList, 'PdfViewerModal'>;

export const PdfViewerModal: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<PdfViewerRouteProp>();
  const { activeDiet, diets } = useDiet();

  const currentDiet = route.params?.dietId
    ? diets.find((d) => d.id === route.params?.dietId)
    : activeDiet;

  const title = route.params?.title || currentDiet?.name || 'Piano Nutrizionale PDF';
  const pdfUri = route.params?.pdfUri || currentDiet?.file_path;

  const [zoom, setZoom] = useState(100);

  const handleOpenInBrowser = () => {
    if (pdfUri) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(pdfUri, '_blank');
      } else {
        Linking.openURL(pdfUri).catch((err) => {
          console.warn('Impossibile aprire l\'URL del PDF:', err);
        });
      }
    } else {
      // Fallback per file senza URI fisico
      alert('Questo documento di esempio non ha un file PDF fisico associato. Carica un PDF reale dal modale "Carica PDF".');
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.modalHeader}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={typography.label}>DOCUMENTO NUTRIZIONALE</Text>
          <Text style={typography.h3} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Chiudi visualizzatore PDF"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      {/* Primary Action: Apri PDF nel Browser */}
      <View style={styles.browserBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.browserBarTitle} numberOfLines={1}>
            📄 {currentDiet?.source_file_name || 'documento_dieta.pdf'}
          </Text>
          <Text style={styles.browserBarSubtitle}>
            {currentDiet?.file_size
              ? `${(currentDiet.file_size / (1024 * 1024)).toFixed(1)} MB • PDF`
              : 'Documento PDF'}
          </Text>
        </View>
        <Pressable
          onPress={handleOpenInBrowser}
          style={styles.openBrowserBtn}
          accessibilityRole="button"
          accessibilityLabel="Apri PDF nel Browser in una nuova scheda"
        >
          <Text style={styles.openBrowserBtnText}>🌐 Apri PDF nel Browser ↗</Text>
        </Pressable>
      </View>

      {/* PDF Controls Bar */}
      <View style={styles.controlsBar}>
        <View style={styles.statusInfo}>
          <Text style={styles.statusInfoText}>
            {pdfUri ? 'Documento caricato da dispositivo' : 'Anteprima struttura documento'}
          </Text>
        </View>

        <View style={styles.zoomControls}>
          <Pressable
            onPress={() => setZoom((z) => Math.max(75, z - 25))}
            style={styles.controlBtn}
          >
            <Text style={styles.controlBtnText}>-</Text>
          </Pressable>
          <Text style={styles.zoomText}>{zoom}%</Text>
          <Pressable
            onPress={() => setZoom((z) => Math.min(150, z + 25))}
            style={styles.controlBtn}
          >
            <Text style={styles.controlBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Document Content View */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {pdfUri && Platform.OS === 'web' ? (
          <View style={styles.webEmbedContainer}>
            <Pressable onPress={handleOpenInBrowser} style={styles.directOpenBanner}>
              <Text style={styles.directOpenBannerIcon}>🚀</Text>
              <Text style={styles.directOpenBannerText}>
                File PDF reale caricato! Tocca per aprirlo a schermo intero nel browser.
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Card style={styles.sheetCanvas}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>PIANO ALIMENTARE PERSONALIZZATO</Text>
            <Text style={styles.sheetSubtitle}>
              Dott. Biologo Nutrizionista Sportivo • Valido dal {currentDiet?.start_date || '01-09-2026'}
            </Text>
          </View>

          <View style={styles.sheetMetaBox}>
            <View style={styles.sheetMetaCol}>
              <Text style={styles.metaLabel}>PIANO</Text>
              <Text style={styles.metaValue}>{currentDiet?.name || 'Dieta Ipertrofia'}</Text>
            </View>
            <View style={styles.sheetMetaCol}>
              <Text style={styles.metaLabel}>STATO</Text>
              <Text style={[styles.metaValue, { color: colors.emerald }]}>
                {currentDiet?.is_active ? 'ATTIVO ✓' : 'ARCHIVIATO'}
              </Text>
            </View>
            <View style={styles.sheetMetaCol}>
              <Text style={styles.metaLabel}>FILE ORIGINALE</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {currentDiet?.source_file_name || 'dieta.pdf'}
              </Text>
            </View>
          </View>

          <View style={styles.docSection}>
            <Text style={styles.docSectionTitle}>LINEE GUIDA NUTRIZIONALI</Text>
            <Text style={styles.docParagraph}>
              {currentDiet?.description ||
                'Target calorico e ripartizione macronutrienti calibrati sulle sessioni di allenamento con carichi progressivi.'}
            </Text>
          </View>

          <View style={styles.docSection}>
            <Text style={styles.docSectionTitle}>INDICAZIONI INTEGRATORI & IDRATAZIONE</Text>
            <Text style={styles.docParagraph}>
              - Acqua: minimo 2.5 - 3 litri al giorno distribuiti uniformemente.
              {'\n'}- Creatina Monoidrato: 5g al giorno post-workout o al pasto principale.
              {'\n'}- Omega-3: 2g al giorno con la colazione.
            </Text>
          </View>

          <Pressable onPress={handleOpenInBrowser} style={styles.fullScreenPdfButton}>
            <Text style={styles.fullScreenPdfButtonText}>
              🌐 Apri il file originale in una nuova finestra
            </Text>
          </Pressable>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSolid,
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
  browserBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  browserBarTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  browserBarSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  openBrowserBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: layout.borderRadiusSm,
  },
  openBrowserBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.primary,
  },
  statusInfo: {
    flex: 1,
  },
  statusInfoText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  controlBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  controlBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  zoomText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    minWidth: 40,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  webEmbedContainer: {
    marginBottom: 12,
  },
  directOpenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: colors.emerald,
    borderRadius: layout.borderRadiusMd,
    padding: 12,
    gap: 10,
  },
  directOpenBannerIcon: {
    fontSize: 22,
  },
  directOpenBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.emerald,
  },
  sheetCanvas: {
    backgroundColor: '#0F172A',
    borderRadius: layout.borderRadiusMd,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sheetHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: 12,
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.5,
  },
  sheetSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  sheetMetaBox: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusSm,
    padding: 10,
    marginBottom: 16,
    gap: 12,
  },
  sheetMetaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  docSection: {
    marginBottom: 14,
  },
  docSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  docParagraph: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  fullScreenPdfButton: {
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
  },
  fullScreenPdfButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});

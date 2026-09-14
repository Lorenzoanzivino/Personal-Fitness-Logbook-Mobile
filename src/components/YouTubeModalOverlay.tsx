import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Linking,
} from 'react-native';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';
import { typography } from '../theme/typography';

interface YouTubeModalOverlayProps {
  visible: boolean;
  videoUrl?: string | null;
  exerciseName?: string;
  description?: string | null;
  onDismiss?: () => void;
  onClose?: () => void;
}

export const extractYouTubeId = (url?: string | null): string | null => {
  if (!url) return null;
  const cleanUrl = url.trim();
  // Regex supporting:
  // youtube.com/watch?v=ID
  // youtu.be/ID
  // youtube.com/embed/ID
  // youtube.com/shorts/ID
  const match = cleanUrl.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i
  );
  return match ? match[1] : null;
};

export const YouTubeModalOverlay: React.FC<YouTubeModalOverlayProps> = ({
  visible,
  videoUrl,
  exerciseName = 'Guida Esercizio',
  description,
  onDismiss,
  onClose,
}) => {
  const handleClose = () => {
    if (onDismiss) onDismiss();
    if (onClose) onClose();
  };
  if (!visible) return null;

  const videoId = extractYouTubeId(videoUrl);

  const handleOpenExternal = () => {
    if (videoUrl) {
      Linking.openURL(videoUrl).catch((err) =>
        console.warn('Impossibile aprire il link YouTube:', err)
      );
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tag}>🎬 VIDEO GUIDA ESECUZIONE</Text>
              <Text style={styles.title} numberOfLines={1}>
                {exerciseName}
              </Text>
            </View>

            <Pressable
              onPress={handleClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Chiudi video player"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Video Player Box */}
          <View style={styles.videoWrapper}>
            {videoId && Platform.OS === 'web' ? (
              React.createElement('iframe', {
                src: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`,
                style: {
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  borderRadius: 12,
                },
                allow:
                  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
                allowFullScreen: true,
              })
            ) : (
              <View style={styles.fallbackPlayer}>
                <Text style={styles.fallbackIcon}>📺</Text>
                <Text style={styles.fallbackTitle}>
                  {videoId ? 'Video YouTube Pronto' : 'Nessun Video Configurato'}
                </Text>
                <Text style={styles.fallbackDesc}>
                  {videoUrl || 'Non è stato specificato alcun link YouTube.'}
                </Text>
                {videoUrl && (
                  <Pressable
                    onPress={handleOpenExternal}
                    style={styles.openExternalBtn}
                  >
                    <Text style={styles.openExternalBtnText}>
                      ▶ Apri su YouTube
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* Optional Exercise Description */}
          {description ? (
            <View style={styles.descBox}>
              <Text style={styles.descTitle}>INDICAZIONI TECNICHE</Text>
              <Text style={styles.descText}>{description}</Text>
            </View>
          ) : null}

          {/* Footer Controls */}
          <View style={styles.footer}>
            {videoUrl && (
              <Pressable
                onPress={handleOpenExternal}
                style={styles.extLinkBtn}
              >
                <Text style={styles.extLinkText}>Apri direttamente nell'app YouTube ↗</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: colors.backgroundElevated,
    borderRadius: layout.borderRadiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tag: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: '700',
  },
  videoWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackPlayer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  fallbackDesc: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  openExternalBtn: {
    backgroundColor: colors.danger,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: layout.borderRadiusMd,
  },
  openExternalBtnText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
  },
  descBox: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  descTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  descText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    padding: 12,
    alignItems: 'center',
  },
  extLinkBtn: {
    padding: 6,
  },
  extLinkText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
});

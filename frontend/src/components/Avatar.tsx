import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';

interface AvatarProps {
  imageUri?: string | null;
  name?: string;
  size?: number;
  editable?: boolean;
  showBorder?: boolean;
  onPress?: () => void;
  onImageSelected?: (uri: string) => void;
  accessibilityLabel?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  imageUri,
  name = 'User',
  size = 96,
  editable = true,
  showBorder = true,
  onPress,
  onImageSelected,
  accessibilityLabel,
}) => {
  const [loading, setLoading] = React.useState(false);

  const getInitials = (text: string): string => {
    const parts = text.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const handlePickImage = async () => {
    if (!editable) return;

    try {
      setLoading(true);

      if (Platform.OS !== 'web') {
        const permissionResult =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionResult.granted === false) {
          Alert.alert(
            'Permesso Richiesto',
            'È necessario consentire l\'accesso alla galleria fotografica per aggiornare l\'avatar.'
          );
          setLoading(false);
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        onImageSelected?.(selectedUri);
      }
    } catch (error) {
      console.warn('Errore durante la selezione immagine:', error);
      Alert.alert('Errore', 'Impossibile selezionare l\'immagine.');
    } finally {
      setLoading(false);
    }
  };

  const avatarRadius = size / 2;
  const isInteractive = editable || Boolean(onPress);
  const handlePress = editable ? handlePickImage : onPress;

  const content = (
    <>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: avatarRadius,
            },
          ]}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.initialsContainer,
            {
              width: size,
              height: size,
              borderRadius: avatarRadius,
            },
          ]}
        >
          <Text style={[styles.initialsText, { fontSize: size * 0.38 }]}>
            {getInitials(name)}
          </Text>
        </View>
      )}

      {loading && (
        <View
          style={[
            styles.loadingOverlay,
            {
              width: size,
              height: size,
              borderRadius: avatarRadius,
            },
          ]}
        >
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      )}

      {editable && !loading && (
        <View style={styles.editBadge}>
          <Text style={styles.editBadgeIcon}>✎</Text>
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.container, !editable && { marginVertical: 0 }]}>
      {isInteractive ? (
        <Pressable
          onPress={handlePress}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={
            accessibilityLabel ||
            (editable ? 'Cambia immagine profilo' : 'Profilo utente')
          }
          style={({ pressed }) => [
            styles.pressableContainer,
            {
              width: size,
              height: size,
              borderRadius: avatarRadius,
              borderWidth: showBorder ? 2 : 0,
              borderColor: showBorder ? colors.accent : 'transparent',
              overflow: 'hidden',
              opacity: pressed ? 0.8 : 1,
              ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
            },
          ]}
        >
          {content}
        </Pressable>
      ) : (
        <View
          pointerEvents="none"
          style={[
            styles.pressableContainer,
            {
              width: size,
              height: size,
              borderRadius: avatarRadius,
              borderWidth: showBorder ? 2 : 0,
              borderColor: showBorder ? colors.accent : 'transparent',
              overflow: 'hidden',
            },
          ]}
        >
          {content}
        </View>
      )}

      {editable && (
        <Text style={styles.helperText}>Tocca per scegliere dalla galleria</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  pressableContainer: {
    position: 'relative',
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.backgroundElevated,
    overflow: 'visible',
    minHeight: layout.minTouchTarget,
    minWidth: layout.minTouchTarget,
  },
  image: {
    backgroundColor: colors.backgroundElevated,
  },
  initialsContainer: {
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: colors.accent,
    fontWeight: '700',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.accent,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  editBadgeIcon: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
});

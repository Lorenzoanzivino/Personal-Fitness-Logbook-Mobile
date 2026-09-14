import React from 'react';
import { StyleSheet, View, ImageBackground, ViewStyle, StyleProp } from 'react-native';

const BG_WALLPAPER = require('../../assets/sfondo_app.jpg');

interface ScreenBackgroundWrapperProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  overlayOpacity?: number;
}

export const ScreenBackgroundWrapper: React.FC<ScreenBackgroundWrapperProps> = ({
  children,
  style,
  overlayOpacity = 0.40,
}) => {
  return (
    <View style={[styles.container, style, styles.forceBlackBackground]}>
      <ImageBackground
        source={BG_WALLPAPER}
        style={styles.imageBackground}
        imageStyle={styles.image}
        resizeMode="contain"
      >
        <View
          pointerEvents="none"
          style={[
            styles.overlay,
            { backgroundColor: `rgba(15, 23, 42, ${overlayOpacity})` },
          ]}
        />
        {children}
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Sfondo nero assoluto dietro l'immagine per compensare le bande di contain
  },
  forceBlackBackground: {
    backgroundColor: '#000000',
  },
  imageBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

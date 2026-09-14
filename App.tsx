import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { RootStackNavigator } from './src/navigation';
import { Header } from './src/components';
import { colors } from './src/theme/colors';
import { GymProvider } from './src/context/GymContext';
import { MeasurementProvider } from './src/context/MeasurementContext';
import { DietProvider } from './src/context/DietContext';

const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.primary,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style="light" />
        <GymProvider>
          <MeasurementProvider>
            <DietProvider>
              <View style={styles.container}>
                <Header />
                <NavigationContainer theme={customDarkTheme}>
                  <RootStackNavigator />
                </NavigationContainer>
              </View>
            </DietProvider>
          </MeasurementProvider>
        </GymProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

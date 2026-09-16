import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { BottomTabNavigator } from './BottomTabNavigator';
import { LoginScreen, ClientOnboardingScreen } from '../screens/auth';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import {
  WorkoutModal,
  NewRoutineModal,
  MeasurementModal,
  UploadDietModal,
  ExerciseModal,
} from '../screens/modals';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootStackNavigator: React.FC = () => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const isClientOnboardingRequired =
    isAuthenticated && user?.role === 'CLIENT' && user?.is_profile_completed === false;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : isClientOnboardingRequired ? (
        <Stack.Screen name="ClientOnboarding" component={ClientOnboardingScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
          <Stack.Group
            screenOptions={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              contentStyle: { backgroundColor: colors.backgroundSolid },
            }}
          >
            <Stack.Screen name="WorkoutModal" component={WorkoutModal} />
            <Stack.Screen name="NewRoutineModal" component={NewRoutineModal} />
            <Stack.Screen name="MeasurementModal" component={MeasurementModal} />
            <Stack.Screen name="UploadDietModal" component={UploadDietModal} />
            <Stack.Screen name="ExerciseModal" component={ExerciseModal} />
          </Stack.Group>
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

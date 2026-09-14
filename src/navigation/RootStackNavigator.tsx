import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { BottomTabNavigator } from './BottomTabNavigator';
import { LoginScreen } from '../screens/auth';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import {
  WorkoutModal,
  NewRoutineModal,
  MeasurementModal,
  UploadDietModal,
  PdfViewerModal,
  ExerciseModal,
} from '../screens/modals';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootStackNavigator: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
          <Stack.Group
            screenOptions={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          >
            <Stack.Screen name="WorkoutModal" component={WorkoutModal} />
            <Stack.Screen name="NewRoutineModal" component={NewRoutineModal} />
            <Stack.Screen name="MeasurementModal" component={MeasurementModal} />
            <Stack.Screen name="UploadDietModal" component={UploadDietModal} />
            <Stack.Screen name="PdfViewerModal" component={PdfViewerModal} />
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

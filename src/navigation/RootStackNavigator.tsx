import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { BottomTabNavigator } from './BottomTabNavigator';
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
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
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
    </Stack.Navigator>
  );
};

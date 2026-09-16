import { NavigatorScreenParams, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootTabParamList = {
  Home: undefined;
  Gym: { initialSubTab?: 'routines' | 'history' | 'progression' | 'exercises' } | undefined;
  Clients: undefined;
  Measurements: undefined;
  Diet: undefined;
  Profile: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  ClientOnboarding: undefined;
  MainTabs: NavigatorScreenParams<RootTabParamList>;
  WorkoutModal: { routineId?: number; routineName?: string; weekNumber?: number } | undefined;
  NewRoutineModal: { routineId?: number } | undefined;
  MeasurementModal: undefined;
  UploadDietModal: undefined;
  PdfViewerModal: { dietId?: number; title?: string; pdfUri?: string } | undefined;
  ExerciseModal: { exerciseId?: number } | undefined;
};

// Navigation Prop Helper Types
export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export type TabNavigationProp<RouteName extends keyof RootTabParamList> =
  CompositeNavigationProp<
    BottomTabNavigationProp<RootTabParamList, RouteName>,
    NativeStackNavigationProp<RootStackParamList>
  >;

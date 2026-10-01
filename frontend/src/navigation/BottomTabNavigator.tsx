import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootTabParamList } from '../types/navigation';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';

import { useAuth } from '../context/AuthContext';
import {
  HomeScreen,
  GymScreen,
  ClientsScreen,
  MeasurementsScreen,
  DietScreen,
  ProfileScreen,
  SettingsScreen,
} from '../screens';

const Tab = createBottomTabNavigator<RootTabParamList>();

export const BottomTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user, role } = useAuth();
  const isTrainer = (user?.role || role) === 'TRAINER';
  const baseHeight = 62;
  const dynamicHeight = baseHeight + insets.bottom;
  const dynamicPaddingBottom = insets.bottom > 0 ? insets.bottom + 5 : 6;

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: [
          styles.tabBar,
          {
            height: dynamicHeight,
            paddingBottom: dynamicPaddingBottom,
          },
        ],
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'ellipse';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Gym') {
            iconName = focused ? 'barbell' : 'barbell-outline';
          } else if (route.name === 'Clients') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Measurements') {
            iconName = focused ? 'fitness' : 'fitness-outline';
          } else if (route.name === 'Diet') {
            iconName = focused ? 'restaurant' : 'restaurant-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return (
            <View style={styles.iconContainer}>
              <Ionicons name={iconName} size={22} color={color} />
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Gym"
        component={GymScreen}
        options={{ tabBarLabel: 'Gym' }}
      />
      {isTrainer && (
        <Tab.Screen
          name="Clients"
          component={ClientsScreen}
          options={{ tabBarLabel: 'Clienti' }}
        />
      )}
      <Tab.Screen
        name="Measurements"
        component={MeasurementsScreen}
        options={{ tabBarLabel: 'Misure' }}
      />
      <Tab.Screen
        name="Diet"
        component={DietScreen}
        options={{ tabBarLabel: 'Dieta' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profilo' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Setup' }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.primary,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 6,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
  },
  tabBarItem: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 0,
  },
  tabBarLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 0,
    letterSpacing: 0.2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
});

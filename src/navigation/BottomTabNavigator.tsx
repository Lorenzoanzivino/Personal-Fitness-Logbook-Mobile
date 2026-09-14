import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootTabParamList } from '../types/navigation';
import { colors } from '../theme/colors';
import { layout } from '../theme/spacing';

import {
  HomeScreen,
  GymScreen,
  MeasurementsScreen,
  DietScreen,
  ProfileScreen,
  SettingsScreen,
} from '../screens';

const Tab = createBottomTabNavigator<RootTabParamList>();

export const BottomTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'ellipse';

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Gym') {
            iconName = focused ? 'barbell' : 'barbell-outline';
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
    height: layout.bottomBarHeight,
    paddingBottom: 8,
    paddingTop: 6,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
  },
  tabBarItem: {
    minHeight: layout.minTouchTarget,
    paddingVertical: 2,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

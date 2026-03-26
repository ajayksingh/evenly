import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withSpring } from 'react-native-reanimated';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';
import { hapticSelection } from '../utils/haptics';
import SyncBanner from '../components/SyncBanner';

import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import GroupsScreen from '../screens/GroupsScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import FriendsScreen from '../screens/FriendsScreen';
import ActivityScreen from '../screens/ActivityScreen';
import SettleUpScreen from '../screens/SettleUpScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CurrencyScreen from '../screens/CurrencyScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MODAL_OPTIONS = { headerShown: false, presentation: 'modal', cardStyle: { backgroundColor: COLORS.background } };
const CARD_OPTIONS  = { headerShown: false, cardStyle: { backgroundColor: COLORS.background } };

// ─── Per-tab nested stacks ────────────────────────────────────────────────────

const HomeStack = () => (
  <Stack.Navigator screenOptions={CARD_OPTIONS}>
    <Stack.Screen name="HomeMain"   component={HomeScreen} />
    <Stack.Screen name="SettleUp"   component={SettleUpScreen}  options={MODAL_OPTIONS} />
    <Stack.Screen name="Profile"    component={ProfileScreen} />
    <Stack.Screen name="Currency"   component={CurrencyScreen} />
  </Stack.Navigator>
);

const GroupsStack = () => (
  <Stack.Navigator screenOptions={CARD_OPTIONS}>
    <Stack.Screen name="GroupsList"  component={GroupsScreen} />
    <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
    <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
    <Stack.Screen name="AddExpense"  component={AddExpenseScreen} options={MODAL_OPTIONS} />
    <Stack.Screen name="SettleUp"    component={SettleUpScreen}   options={MODAL_OPTIONS} />
  </Stack.Navigator>
);

const FriendsStack = () => (
  <Stack.Navigator screenOptions={CARD_OPTIONS}>
    <Stack.Screen name="FriendsList" component={FriendsScreen} />
    <Stack.Screen name="SettleUp"    component={SettleUpScreen} options={MODAL_OPTIONS} />
  </Stack.Navigator>
);

// ─── Animated tab icon ────────────────────────────────────────────────────────

const AnimatedTabIcon = ({ name, focused, color }) => {
  const scale      = useSharedValue(1);
  const translateY = useSharedValue(0);
  const animStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));
  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withSpring(1.28, { damping: 7,  stiffness: 420 }),
        withSpring(1,    { damping: 14, stiffness: 300 })
      );
      translateY.value = withSequence(
        withSpring(-4, { damping: 7,  stiffness: 420 }),
        withSpring(0,  { damping: 14, stiffness: 300 })
      );
    }
  }, [focused]);
  return (
    <Animated.View style={animStyle}>
      <Ionicons name={name} size={22} color={color} />
    </Animated.View>
  );
};

// ─── Main tab navigator ───────────────────────────────────────────────────────

const MainTabs = () => {
  const { bottom } = useSafeAreaInsets();
  const tabBarHeight = 62 + bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: 'rgba(10,10,15,0.95)',
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: bottom > 0 ? bottom : 12,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
          elevation: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Home:     focused ? 'home'   : 'home-outline',
            Activity: focused ? 'time'   : 'time-outline',
            Groups:   focused ? 'people' : 'people-outline',
            Friends:  focused ? 'person' : 'person-outline',
          };
          return <AnimatedTabIcon name={icons[route.name]} focused={focused} color={color} />;
        },
      })}
      screenListeners={{ tabPress: () => hapticSelection() }}
    >
      <Tab.Screen name="Home"     component={HomeStack} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Groups"   component={GroupsStack} />
      <Tab.Screen name="Friends"  component={FriendsStack} />
    </Tab.Navigator>
  );
};

// ─── Root navigator ───────────────────────────────────────────────────────────

const AppNavigator = () => {
  const { user, loading, syncStatus } = useApp();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  if (loading) return null;

  return (
    <View style={isDesktop ? styles.desktopContainer : { flex: 1 }}>
      <View style={isDesktop ? styles.desktopApp : { flex: 1 }}>
        <NavigationContainer>
          <View style={{ flex: 1 }}>
            <Stack.Navigator
              key={user ? 'main' : 'auth'}
              screenOptions={{ headerShown: false, cardStyle: { backgroundColor: COLORS.background } }}
            >
              {!user ? (
                <Stack.Screen name="Auth" component={AuthScreen} />
              ) : (
                <Stack.Screen name="Main" component={MainTabs} />
              )}
            </Stack.Navigator>
            <SyncBanner status={syncStatus} />
          </View>
        </NavigationContainer>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    backgroundColor: '#050508',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopApp: {
    width: 430,
    maxWidth: '100%',
    flex: 1,
    overflow: 'hidden',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#00d4aa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
  },
});

export default AppNavigator;

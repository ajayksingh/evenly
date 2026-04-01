import React, { useEffect, useState, Suspense, lazy } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withSpring } from 'react-native-reanimated';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { hapticSelection } from '../utils/haptics';
import SyncBanner from '../components/SyncBanner';

// Eagerly load tab screens (always visible)
import HomeScreen from '../screens/HomeScreen';
import GroupsScreen from '../screens/GroupsScreen';
import FriendsScreen from '../screens/FriendsScreen';
import ActivityScreen from '../screens/ActivityScreen';
import AuthScreen from '../screens/AuthScreen';

// Lazy load non-tab screens (loaded on demand)
const OnboardingScreen = lazy(() => import('../screens/OnboardingScreen'));
const GroupDetailScreen = lazy(() => import('../screens/GroupDetailScreen'));
const AddExpenseScreen = lazy(() => import('../screens/AddExpenseScreen'));
const SettleUpScreen = lazy(() => import('../screens/SettleUpScreen'));
const ProfileScreen = lazy(() => import('../screens/ProfileScreen'));
const CurrencyScreen = lazy(() => import('../screens/CurrencyScreen'));
const CreateGroupScreen = lazy(() => import('../screens/CreateGroupScreen'));
const ExpenseTrackerScreen = lazy(() => import('../screens/ExpenseTrackerScreen'));
const ReconciliationScreen = lazy(() => import('../screens/ReconciliationScreen'));
const ConnectedAccountsScreen = lazy(() => import('../screens/ConnectedAccountsScreen'));

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Per-tab nested stacks ────────────────────────────────────────────────────

const HomeStack = () => {
  const { theme } = useTheme();
  const cardOptions = { headerShown: false, cardStyle: { backgroundColor: theme.background } };
  const modalOptions = { headerShown: false, presentation: 'modal', cardStyle: { backgroundColor: theme.background } };
  return (
    <Stack.Navigator screenOptions={cardOptions}>
      <Stack.Screen name="HomeMain"   component={HomeScreen} />
      <Stack.Screen name="SettleUp"   component={SettleUpScreen}  options={modalOptions} />
      <Stack.Screen name="Profile"    component={ProfileScreen} />
      <Stack.Screen name="Currency"   component={CurrencyScreen} />
      <Stack.Screen name="ExpenseTracker" component={ExpenseTrackerScreen} />
      <Stack.Screen name="Reconciliation" component={ReconciliationScreen} />
      <Stack.Screen name="ConnectedAccounts" component={ConnectedAccountsScreen} />
    </Stack.Navigator>
  );
};

const GroupsStack = () => {
  const { theme } = useTheme();
  const cardOptions = { headerShown: false, cardStyle: { backgroundColor: theme.background } };
  const modalOptions = { headerShown: false, presentation: 'modal', cardStyle: { backgroundColor: theme.background } };
  return (
    <Stack.Navigator screenOptions={cardOptions}>
      <Stack.Screen name="GroupsList"  component={GroupsScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="AddExpense"  component={AddExpenseScreen} options={modalOptions} />
      <Stack.Screen name="SettleUp"    component={SettleUpScreen}   options={modalOptions} />
    </Stack.Navigator>
  );
};

const FriendsStack = () => {
  const { theme } = useTheme();
  const cardOptions = { headerShown: false, cardStyle: { backgroundColor: theme.background } };
  const modalOptions = { headerShown: false, presentation: 'modal', cardStyle: { backgroundColor: theme.background } };
  return (
    <Stack.Navigator screenOptions={cardOptions}>
      <Stack.Screen name="FriendsList" component={FriendsScreen} />
      <Stack.Screen name="SettleUp"    component={SettleUpScreen} options={modalOptions} />
    </Stack.Navigator>
  );
};

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
  const { theme } = useTheme();
  const tabBarHeight = 62 + bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: 'fade',
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.border,
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
      <Tab.Screen name="Home"     component={HomeStack} options={{ tabBarAccessibilityLabel: 'Navigate to Home tab' }} />
      <Tab.Screen name="Activity" component={ActivityScreen} options={{ tabBarAccessibilityLabel: 'Navigate to Activity tab' }} />
      <Tab.Screen name="Groups"   component={GroupsStack} options={{ tabBarAccessibilityLabel: 'Navigate to Groups tab' }} />
      <Tab.Screen name="Friends"  component={FriendsStack} options={{ tabBarAccessibilityLabel: 'Navigate to Friends tab' }} />
    </Tab.Navigator>
  );
};

// ─── Root navigator ───────────────────────────────────────────────────────────

const AppNavigator = () => {
  const { user, loading, syncStatus } = useApp();
  const { theme, colorScheme } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;
  const [hasOnboarded, setHasOnboarded] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('@evenly_onboarded').then(val => {
      setHasOnboarded(val === 'true');
    });
  }, []);

  if (loading || hasOnboarded === null) return null;

  const navigationTheme = {
    dark: colorScheme === 'dark',
    colors: {
      primary: theme.primary,
      background: theme.background,
      card: theme.card,
      text: theme.text,
      border: theme.border,
      notification: theme.primary,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium: { fontFamily: 'System', fontWeight: '500' },
      bold: { fontFamily: 'System', fontWeight: '700' },
      heavy: { fontFamily: 'System', fontWeight: '800' },
    },
  };

  return (
    <View style={isDesktop ? [styles.desktopContainer, { backgroundColor: theme.desktopBg }] : { flex: 1 }}>
      <View style={isDesktop ? [styles.desktopApp, { borderColor: theme.desktopBorder, shadowColor: theme.primary }] : { flex: 1 }}>
        <NavigationContainer theme={navigationTheme}>
          <Suspense fallback={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" /></View>}>
          <View style={{ flex: 1 }}>
            <Stack.Navigator
              key={user ? 'main' : hasOnboarded ? 'auth' : 'onboarding'}
              screenOptions={{ headerShown: false, cardStyle: { backgroundColor: theme.background } }}
            >
              {!hasOnboarded ? (
                <Stack.Screen name="Onboarding">
                  {(props) => (
                    <OnboardingScreen
                      {...props}
                      onComplete={() => setHasOnboarded(true)}
                    />
                  )}
                </Stack.Screen>
              ) : !user ? (
                <Stack.Screen name="Auth" component={AuthScreen} />
              ) : (
                <Stack.Screen name="Main" component={MainTabs} />
              )}
            </Stack.Navigator>
            <SyncBanner status={syncStatus} />
          </View>
          </Suspense>
        </NavigationContainer>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
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
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
  },
});

export default AppNavigator;

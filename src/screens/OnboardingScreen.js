import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, useWindowDimensions, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

const AppLogo = require('../../assets/icon.png');

const ONBOARDED_KEY = '@evenly_onboarded';

const PAGES = [
  {
    icon: 'cash-outline',
    title: 'Split expenses effortlessly',
    subtitle: 'Add an expense, choose how to split, and Evenly does the math',
    showLogo: true,
  },
  {
    icon: 'bar-chart-outline',
    title: 'Track who owes what',
    subtitle: 'See real-time balances with every friend and group',
  },
  {
    icon: 'checkmark-circle-outline',
    title: 'Settle up instantly',
    subtitle: 'Record payments and keep everyone in the loop',
    showButton: true,
  },
];

const OnboardingScreen = ({ navigation, onComplete }) => {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef(null);
  const styles = useMemo(() => getStyles(theme, width, height), [theme, width, height]);

  const handleScroll = (e) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    if (page !== currentPage) setCurrentPage(page);
  };

  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
    if (onComplete) onComplete();
  };

  return (
    <View style={styles.container} testID="onboarding-screen">
      {/* Skip button on pages 1-2 */}
      {currentPage < 2 && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={completeOnboarding}
          testID="onboarding-skip"
          accessibilityLabel="Skip onboarding"
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        testID="onboarding-scroll"
        style={{ flex: 1 }}
        contentContainerStyle={{ height: '100%' }}
      >
        {PAGES.map((page, index) => (
          <View key={index} style={[styles.page, { width, height: height - 100 }]}>
            {page.showLogo && (
              <Image source={AppLogo} style={styles.logo} resizeMode="contain" />
            )}
            <Ionicons
              name={page.icon}
              size={80}
              color={theme.primary}
              style={styles.icon}
            />
            <Text style={styles.title}>{page.title}</Text>
            <Text style={styles.subtitle}>{page.subtitle}</Text>
            {page.showButton && (
              <TouchableOpacity
                onPress={completeOnboarding}
                activeOpacity={0.85}
                testID="onboarding-get-started"
                accessibilityLabel="Get started"
              >
                <LinearGradient
                  colors={theme.primaryGradient || [theme.primary, theme.primaryDark || theme.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>Get Started</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Dots indicator */}
      <View style={styles.dotsContainer} testID="onboarding-dots">
        {PAGES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              currentPage === index ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const getStyles = (theme, width, height) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    skipButton: {
      position: 'absolute',
      top: 54,
      right: 24,
      zIndex: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    skipText: {
      color: theme.textLight,
      fontSize: 16,
      fontWeight: '600',
    },
    page: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    logo: {
      width: 80,
      height: 80,
      borderRadius: 20,
      marginBottom: 24,
    },
    icon: {
      marginBottom: 28,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 14,
    },
    subtitle: {
      fontSize: 16,
      color: theme.textLight,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 320,
    },
    button: {
      marginTop: 36,
      paddingHorizontal: 48,
      paddingVertical: 16,
      borderRadius: 30,
    },
    buttonText: {
      color: theme.background,
      fontSize: 17,
      fontWeight: '700',
      textAlign: 'center',
    },
    dotsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 50,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginHorizontal: 5,
    },
    dotActive: {
      backgroundColor: theme.primary,
    },
    dotInactive: {
      backgroundColor: theme.textMuted,
      opacity: 0.4,
    },
  });

export default OnboardingScreen;

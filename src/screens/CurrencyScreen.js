import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Animated as RNAnimated, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';
import { useTheme } from '../context/ThemeContext';
import { SUPPORTED_CURRENCIES, fetchExchangeRates, formatAmount, detectDefaultCurrency } from '../services/currency';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';

const CurrencyScreen = ({ navigation }) => {
  const { theme, colorScheme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { currency, setCurrency } = useApp();

  const isWeb = Platform.OS === 'web';
  const animatedOnce = useRef(false);
  const screenOpacity = useSharedValue(isWeb ? 1 : 0);
  const screenTranslateY = useSharedValue(isWeb ? 0 : 32);
  const screenAnimStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ translateY: screenTranslateY.value }],
  }));
  useFocusEffect(useCallback(() => {
    if (!isWeb && !animatedOnce.current) {
      animatedOnce.current = true;
      screenOpacity.value = withTiming(1, { duration: 380 });
      screenTranslateY.value = withSpring(0, { damping: 18, stiffness: 120 });
    }
  }, []));

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const headerBg = scrollY.interpolate({ inputRange: [0, 80], outputRange: [theme.headerBgTransparent, theme.headerBg], extrapolate: 'clamp' });
  const headerBorder = scrollY.interpolate({ inputRange: [0, 80], outputRange: ['transparent', theme.border], extrapolate: 'clamp' });

  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(true);
  const [baseCurrency, setBaseCurrency] = useState(currency);

  useEffect(() => {
    loadRates();
  }, [baseCurrency]);

  const loadRates = async () => {
    setLoading(true);
    try {
      const r = await fetchExchangeRates(baseCurrency);
      setRates(r);
    } catch (e) {
      Alert.alert('Error', 'Could not load exchange rates');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (code) => {
    await setCurrency(code);
    Alert.alert('Currency Updated', `Default currency set to ${code}`);
    navigation.goBack();
  };

  const deviceDefault = detectDefaultCurrency();

  return (
    <Animated.View style={[{ flex: 1 }, screenAnimStyle]}>
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <RNAnimated.View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBorder }]}>
        <TouchableOpacity accessibilityLabel="Go back" activeOpacity={0.7} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Currency Settings</Text>
        <View style={{ width: 24 }} />
      </RNAnimated.View>

      <View style={styles.infoCard}>
        <Ionicons name="location" size={18} color={theme.primary} />
        <Text style={styles.infoText}>
          Detected location default: <Text style={styles.infoBold}>{deviceDefault}</Text>
        </Text>
      </View>

      <View style={styles.ratesHeader}>
        <Text style={styles.ratesTitle}>Live Exchange Rates</Text>
        <Text style={styles.ratesBase}>Base: <Text style={styles.infoBold}>{baseCurrency}</Text></Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Fetching live rates...</Text>
        </View>
      ) : (
        <FlatList
          data={SUPPORTED_CURRENCIES}
          keyExtractor={item => item.code}
          scrollEventThrottle={16}
          onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          renderItem={({ item }) => {
            const rate = rates[item.code];
            const isSelected = item.code === currency;
            return (
              <TouchableOpacity
                accessibilityLabel={`Select currency: ${item.code} ${item.name}`}
                activeOpacity={0.7}
                style={[styles.currencyRow, isSelected && styles.currencyRowSelected]}
                onPress={() => handleSelect(item.code)}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <View style={styles.currencyInfo}>
                  <Text style={[styles.currencyCode, isSelected && { color: theme.primary }]}>{item.code}</Text>
                  <Text style={styles.currencyName}>{item.name}</Text>
                </View>
                <View style={styles.currencyRight}>
                  {rate && (
                    <Text style={styles.rateText}>
                      {item.symbol}{rate.toFixed(item.code === 'JPY' || item.code === 'INR' ? 1 : 3)}
                    </Text>
                  )}
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
    </Animated.View>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: theme.white, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: theme.text },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', margin: 16,
    backgroundColor: theme.primaryLight, borderRadius: 12, padding: 14,
  },
  infoText: { flex: 1, marginLeft: 8, fontSize: 14, color: theme.text },
  infoBold: { fontWeight: '700', color: theme.primary },
  ratesHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 8,
  },
  ratesTitle: { fontSize: 14, fontWeight: '600', color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  ratesBase: { fontSize: 13, color: theme.textLight },
  loading: { alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: theme.textLight },
  currencyRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.white,
    marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 2,
  },
  currencyRowSelected: { borderWidth: 2, borderColor: theme.primary, backgroundColor: theme.primaryLight },
  flag: { fontSize: 28, marginRight: 14 },
  currencyInfo: { flex: 1 },
  currencyCode: { fontSize: 16, fontWeight: '700', color: theme.text },
  currencyName: { fontSize: 13, color: theme.textLight, marginTop: 2 },
  currencyRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rateText: { fontSize: 15, fontWeight: '600', color: theme.text },
  selectedBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default CurrencyScreen;

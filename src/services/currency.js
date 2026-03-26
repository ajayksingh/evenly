/**
 * Currency Service
 * - Auto-detects locale → default currency
 * - Live exchange rates via Open Exchange Rates (free tier) / fallback
 * - Converts between currencies
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

const RATES_CACHE_KEY = 'sw_currency_rates';
const SELECTED_CURRENCY_KEY = 'sw_selected_currency';
const CACHE_TTL = 3600000; // 1 hour

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', flag: '🇲🇾' },
];

// Locale → currency mapping
const LOCALE_CURRENCY_MAP = {
  IN: 'INR', US: 'USD', GB: 'GBP', AU: 'AUD',
  CA: 'CAD', SG: 'SGD', JP: 'JPY', AE: 'AED',
  MY: 'MYR', DE: 'EUR', FR: 'EUR', IT: 'EUR',
};

// Detect device locale/country
export const detectDefaultCurrency = () => {
  try {
    let locale = '';
    if (Platform.OS === 'android') {
      locale = NativeModules.I18nManager?.localeIdentifier || '';
    } else {
      locale = NativeModules.SettingsManager?.settings?.AppleLocale ||
               NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] || '';
    }
    // locale looks like "en_IN" or "hi_IN"
    const country = locale.split('_').pop()?.toUpperCase();
    return LOCALE_CURRENCY_MAP[country] || 'INR'; // Default to INR
  } catch {
    return 'INR';
  }
};

// Fetch live rates from exchangerate.host (100% free, no key needed)
export const fetchExchangeRates = async (baseCurrency = 'USD') => {
  try {
    // Check cache
    const cached = await AsyncStorage.getItem(RATES_CACHE_KEY);
    if (cached) {
      const { rates, timestamp, base } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL && base === baseCurrency) {
        return rates;
      }
    }

    // Fetch from free API (no key required)
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${baseCurrency}`,
      { timeout: 5000 }
    );
    const data = await response.json();
    if (data.result === 'success') {
      await AsyncStorage.setItem(RATES_CACHE_KEY, JSON.stringify({
        rates: data.rates, timestamp: Date.now(), base: baseCurrency,
      }));
      return data.rates;
    }
  } catch (e) {
    console.log('Exchange rate fetch failed, using fallback');
  }

  // Hardcoded fallback rates (USD base, updated periodically)
  return {
    INR: 83.5, EUR: 0.92, GBP: 0.79, AUD: 1.54,
    CAD: 1.37, SGD: 1.35, JPY: 149.5, AED: 3.67,
    MYR: 4.73, USD: 1.0,
  };
};

// Convert amount from one currency to another
export const convertCurrency = async (amount, fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) return amount;
  const rates = await fetchExchangeRates('USD');
  // Convert to USD first, then to target
  const inUSD = fromCurrency === 'USD' ? amount : amount / (rates[fromCurrency] || 1);
  const result = toCurrency === 'USD' ? inUSD : inUSD * (rates[toCurrency] || 1);
  return parseFloat(result.toFixed(2));
};

export const getCurrencySymbol = (code) => {
  return SUPPORTED_CURRENCIES.find(c => c.code === code)?.symbol || code;
};

export const formatAmount = (amount, currencyCode) => {
  const symbol = getCurrencySymbol(currencyCode);
  const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
  const formatted = Math.abs(amount).toLocaleString(locale, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
};

// Persist selected currency
export const saveSelectedCurrency = async (code) => {
  await AsyncStorage.setItem(SELECTED_CURRENCY_KEY, code);
};

export const loadSelectedCurrency = async () => {
  const saved = await AsyncStorage.getItem(SELECTED_CURRENCY_KEY);
  return saved || detectDefaultCurrency();
};

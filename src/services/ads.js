import { Platform } from 'react-native';

// Only load AdMob on native — not available on web
let MobileAds, BannerAd, BannerAdSize, InterstitialAd, AdEventType, TestIds;

if (Platform.OS !== 'web') {
  try {
    const admob = require('react-native-google-mobile-ads');
    MobileAds = admob.default;
    BannerAd = admob.BannerAd;
    BannerAdSize = admob.BannerAdSize;
    InterstitialAd = admob.InterstitialAd;
    AdEventType = admob.AdEventType;
    TestIds = admob.TestIds;
  } catch (_) {}
}

export const AD_UNIT_IDS = {
  banner: __DEV__
    ? (TestIds?.BANNER || 'ca-app-pub-3940256099942544/6300978111')
    : 'ca-app-pub-9004418283363709/7297137403',
  interstitial: __DEV__
    ? (TestIds?.INTERSTITIAL || 'ca-app-pub-3940256099942544/1033173712')
    : 'ca-app-pub-9004418283363709/4684384107',
};

// Initialize AdMob once at app start
export const initAds = async () => {
  if (Platform.OS === 'web' || !MobileAds) return;
  try {
    await MobileAds().initialize();
  } catch (e) {
    console.warn('[Ads] init failed:', e);
  }
};

// Load and show an interstitial — call after settlement success
export const showInterstitial = () => {
  if (Platform.OS === 'web' || !InterstitialAd || !AdEventType) return;
  try {
    const interstitial = InterstitialAd.createForAdRequest(AD_UNIT_IDS.interstitial, {
      requestNonPersonalizedAdsOnly: false,
    });
    const unsubscribe = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      unsubscribe();
      interstitial.show();
    });
    interstitial.load();
  } catch (e) {
    console.warn('[Ads] interstitial failed:', e);
  }
};

export { BannerAd, BannerAdSize };

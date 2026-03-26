import { useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Returns scroll tracking utilities for a blur-on-scroll header effect.
 *
 * Usage:
 *   const { onScroll, scrollEventThrottle, headerAnimStyle } = useScrollHeader();
 *
 *   <Animated.View style={[styles.header, headerAnimStyle]} />
 *   <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={scrollEventThrottle} />
 */
export const useScrollHeader = ({ startBlurAt = 10, fullBlurAt = 80 } = {}) => {
  const scrollY = useRef(new Animated.Value(0)).current;

  const bgOpacity = scrollY.interpolate({
    inputRange: [startBlurAt, fullBlurAt],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const borderOpacity = scrollY.interpolate({
    inputRange: [startBlurAt, fullBlurAt],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerAnimStyle = {
    backgroundColor: bgOpacity.interpolate
      ? undefined // handled below
      : undefined,
    // We export them separately so callers can compose as needed
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  return {
    onScroll,
    scrollEventThrottle: 16,
    bgOpacity,
    borderOpacity,
  };
};

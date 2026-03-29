import React, { useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';

const FadeInView = ({ index = 0, delay = 60, duration = 320, children, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    const staggerDelay = index * delay;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay: staggerDelay,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay: staggerDelay,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
};

export default FadeInView;

import React, { useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const Skeleton = ({ width, height, borderRadius = 8, style }) => {
  const { colorScheme } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const bgColor = colorScheme === 'dark' ? '#2a2a34' : '#e0e0e0';

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: bgColor,
          opacity,
        },
        style,
      ]}
    />
  );
};

export default Skeleton;

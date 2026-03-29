import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { Animated, Platform } from 'react-native';

const ShakeView = forwardRef(({ children, style }, ref) => {
  const translateX = useRef(new Animated.Value(0)).current;

  useImperativeHandle(ref, () => ({
    shake: () => {
      Animated.sequence([
        Animated.timing(translateX, { toValue: -10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(translateX, { toValue: 10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(translateX, { toValue: -10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(translateX, { toValue: 10, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(translateX, { toValue: 0, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    },
  }));

  return (
    <Animated.View style={[style, { transform: [{ translateX }] }]}>
      {children}
    </Animated.View>
  );
});

export default ShakeView;

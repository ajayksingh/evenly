import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { getInitials, generateAvatarColor } from '../utils/splitCalculator';

const Avatar = ({ name, avatar, size = 40, fontSize }) => {
  const initials = getInitials(name);
  const color = generateAvatarColor(name);
  const fs = fontSize || size * 0.38;

  if (avatar) {
    return (
      <Image
        source={{ uri: avatar }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.initials, { fontSize: fs }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default Avatar;

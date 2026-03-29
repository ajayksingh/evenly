import React from 'react';
import { View, Text, Image } from 'react-native';
import { getInitials, generateAvatarColor } from '../utils/splitCalculator';
import { useTheme } from '../context/ThemeContext';

const Avatar = ({ name, avatar, size = 40, fontSize }) => {
  const { theme } = useTheme();
  const initials = getInitials(name);
  const color = generateAvatarColor(name);
  const fs = fontSize || size * 0.38;

  const [imgError, setImgError] = React.useState(false);

  if (avatar && !imgError) {
    return (
      <Image
        source={{ uri: avatar }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: fs, color: theme.background, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
};

export default React.memo(Avatar, (prev, next) =>
  prev.avatar === next.avatar && prev.name === next.name && prev.size === next.size
);

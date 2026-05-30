import React from 'react';
import { View, Text } from 'react-native';

const AVATAR_COLORS = [
  '#E1306C',
  '#405DE6',
  '#833AB4',
  '#FCAF45',
  '#4CAF50',
  '#FF6B6B',
  '#4ECDC4',
];

interface UserAvatarProps {
  username: string;
  size?: number;
}

export default function UserAvatar({ username, size = 44 }: UserAvatarProps) {
  const safeUsername = username && username.length > 0 ? username : '?';
  const colorIndex =
    safeUsername.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    AVATAR_COLORS.length;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: AVATAR_COLORS[colorIndex],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#fff',
          fontSize: size * 0.38,
          fontWeight: 'bold',
        }}
      >
        {safeUsername[0].toUpperCase()}
      </Text>
    </View>
  );
}

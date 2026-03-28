import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, FONT, RADIUS } from '../../design/tokens';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  size?: 'xs' | 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  color = C.teal,
  size = 'sm',
}) => {
  const fontSize = size === 'xs' ? 8 : size === 'sm' ? 10 : 12;
  const paddingH = size === 'xs' ? 5 : size === 'sm' ? 7 : 10;
  const paddingV = size === 'xs' ? 1.5 : size === 'sm' ? 2.5 : 4;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: color + '20',
          borderColor: color + '40',
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
        },
      ]}
    >
      <Text
        style={[styles.text, { color, fontSize }]}
        numberOfLines={1}
      >
        {children}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: FONT.uiBd,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, FONT, RADIUS } from '../../design/tokens';

interface AiBadgeProps {
  text?: string;
}

export const AiBadge: React.FC<AiBadgeProps> = ({ text = 'AI' }) => (
  <LinearGradient
    colors={[C.teal, C.blue]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={styles.gradient}
  >
    <Text style={styles.text}>{text}</Text>
  </LinearGradient>
);

const styles = StyleSheet.create({
  gradient: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: FONT.uiBk,
    fontSize: 8,
    color: '#000',
    letterSpacing: 0.6,
  },
});

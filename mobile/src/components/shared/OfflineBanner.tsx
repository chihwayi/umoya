import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNetworkStore } from '../../stores/useNetworkStore';
import { C, FONT } from '../../design/tokens';

export const OfflineBanner: React.FC = () => {
  const { isOnline, lastOnlineAt } = useNetworkStore();
  const slideAnim = useRef(new Animated.Value(isOnline ? -40 : 0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOnline ? -40 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, slideAnim]);

  const minutesAgo = lastOnlineAt
    ? Math.round((Date.now() - lastOnlineAt) / 60000)
    : null;

  const label = minutesAgo !== null && minutesAgo > 0
    ? `Offline — showing data from ${minutesAgo} min ago`
    : 'Offline — showing cached data';

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}
      pointerEvents="none"
    >
      <Text style={styles.text}>{label}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#B45309',
    paddingVertical: 6,
    paddingHorizontal: 16,
    zIndex: 9000,
    alignItems: 'center',
  },
  text: {
    fontFamily: FONT.uiSb,
    fontSize: 12,
    color: '#FEF3C7',
    letterSpacing: 0.2,
  },
});

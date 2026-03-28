import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image } from 'react-native';
import { C } from '../../design/tokens';

const LOGO = require('../../../assets/medicore-logo.png');

interface AiPulseProps {
  size?: number;
  active?: boolean;
}

export const AiPulse: React.FC<AiPulseProps> = ({ size = 48, active = true }) => {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    const a1 = pulse(ring1, 0);
    const a2 = pulse(ring2, 600);
    a1.start();
    a2.start();
    return () => { a1.stop(); a2.stop(); };
  }, [active]);

  const ringStyle = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    width: size * 1.6,
    height: size * 1.6,
    borderRadius: (size * 1.6) / 2,
    borderWidth: 1.5,
    borderColor: C.teal,
    opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.15, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
  });

  return (
    <View style={[styles.container, { width: size * 1.6, height: size * 1.6 }]}>
      {active && <Animated.View style={ringStyle(ring1)} />}
      {active && <Animated.View style={ringStyle(ring2)} />}
      <View style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }]}>
        <Image source={LOGO} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="contain" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: C.teal + '50',
  },
});

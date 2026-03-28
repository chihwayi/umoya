import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C, FONT } from '../../design/tokens';

interface SlaTimerProps {
  totalSeconds: number;
  onExpire?: () => void;
  size?: number;
}

export const SlaTimer: React.FC<SlaTimerProps> = ({
  totalSeconds,
  onExpire,
  size = 52,
}) => {
  const [remaining, setRemaining] = useState(totalSeconds);
  const flash = useRef(new Animated.Value(1)).current;

  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / totalSeconds;
  const strokeDashoffset = circumference * (1 - progress);

  const color =
    remaining > totalSeconds * 0.5
      ? C.teal
      : remaining > totalSeconds * 0.2
      ? C.amber
      : C.red;

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.();
      return;
    }
    const timer = setInterval(() => setRemaining(r => r - 1), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  useEffect(() => {
    if (remaining <= 120) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(flash, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [remaining <= 120]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <Animated.View style={{ opacity: remaining <= 120 ? flash : 1 }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={C.border}
          strokeWidth={3}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={3}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={[styles.time, { color }]}>{fmt(remaining)}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  time: { fontFamily: FONT.monoBd, fontSize: 11 },
});

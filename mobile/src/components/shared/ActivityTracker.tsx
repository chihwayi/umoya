import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

interface ActivityTrackerProps {
  onActivity: () => void;
  children: React.ReactNode;
}

export const ActivityTracker: React.FC<ActivityTrackerProps> = ({ onActivity, children }) => {
  const touch = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      onActivity();
    })
    .runOnJS(true);

  return (
    <GestureDetector gesture={touch}>
      <View style={styles.container}>{children}</View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

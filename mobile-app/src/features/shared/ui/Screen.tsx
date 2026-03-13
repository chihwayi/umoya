import React, { PropsWithChildren } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { theme } from '../../../design/theme';

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  container: {
    flex: 1,
    padding: theme.layout.screenPadding,
    gap: theme.layout.cardGap
  }
});

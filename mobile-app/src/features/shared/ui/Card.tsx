import React, { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../../design/theme';

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg
  }
});

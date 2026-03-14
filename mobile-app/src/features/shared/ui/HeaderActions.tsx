import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../../design/theme';
import { LogoutButton } from './LogoutButton';

export function HeaderActions() {
  return (
    <View style={styles.row}>
      <LogoutButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: theme.spacing.lg,
  },
});

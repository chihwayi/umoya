import React from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../../design/theme';
import { LogoutButton } from './LogoutButton';

export function HeaderActions() {
  const router = useRouter();

  return (
    <View style={styles.row}>
      <Pressable onPress={() => router.push('/diagnostics')} style={styles.button}>
        <Text style={styles.text}>Diag</Text>
      </Pressable>
      <LogoutButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  button: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  text: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700'
  }
});

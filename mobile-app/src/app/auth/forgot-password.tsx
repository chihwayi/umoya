import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../features/shared/ui/Screen';
import { theme } from '../../design/theme';

export default function ForgotPasswordScreen() {
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Forgot password?</Text>
        <Text style={styles.body}>
          Contact your clinic to reset your patient portal password.
        </Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back to sign in</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  body: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  button: {
    backgroundColor: theme.colors.accentTeal,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    paddingVertical: 15,
  },
  buttonText: {
    color: '#022018',
    fontWeight: '700',
    fontSize: 16,
  },
});

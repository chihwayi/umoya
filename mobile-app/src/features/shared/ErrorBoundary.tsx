import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../design/theme';

type Props = { children: ReactNode };

type State = { error: Error | null; errorInfo: ErrorInfo | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, errorInfo.componentStack);
    }
  }

  render() {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;

    const message = __DEV__ && errorInfo?.componentStack
      ? `${error.message}\n\n${errorInfo.componentStack}`
      : error.message;

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Something went wrong</Text>
          <ScrollView style={styles.messageScroll} nestedScrollEnabled>
            <Text style={styles.message}>
              {__DEV__ ? message : 'An unexpected error occurred. Try opening the app again or go back to start.'}
            </Text>
          </ScrollView>
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={() => {
                this.setState({ error: null, errorInfo: null });
              }}
            >
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonPressed]}
              onPress={() => {
                this.setState({ error: null, errorInfo: null });
                router.replace('/auth');
              }}
            >
              <Text style={styles.buttonSecondaryText}>Go to start</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    maxWidth: 400
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm
  },
  messageScroll: {
    maxHeight: 200,
    marginBottom: theme.spacing.lg
  },
  message: {
    fontSize: 14,
    color: theme.colors.textSecondary
  },
  actions: {
    gap: theme.spacing.sm
  },
  button: {
    backgroundColor: theme.colors.accentTeal,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center'
  },
  buttonSecondary: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: {
    color: '#fff',
    fontWeight: '600'
  },
  buttonSecondaryText: {
    color: theme.colors.textPrimary,
    fontWeight: '500'
  }
});

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../features/shared/ui/Screen';
import { theme } from '../../design/theme';
import { getTenantBootstrap } from '../../lib/tenant/tenant-resolver';

export default function ClinicConfirmedScreen() {
  const tenant = getTenantBootstrap();

  // Subtle entrance animations
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!tenant) {
      router.replace('/clinic/select');
      return;
    }

    Animated.sequence([
      Animated.parallel([
        Animated.spring(ringScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 14,
          stiffness: 160,
        }),
        Animated.timing(ringOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslate, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  function handleContinue() {
    router.replace('/auth/patient-login');
  }

  function handleChangeClinic() {
    router.replace('/clinic/select');
  }

  return (
    <Screen>
      <View style={styles.container}>
        {/* ── Settings gear (top-right) ── */}
        <View style={styles.topBar}>
          <Pressable style={styles.gearButton} onPress={() => router.push('/settings')}>
            <Text style={styles.gearIcon}>⚙</Text>
          </Pressable>
        </View>

        {/* ── Centred content ── */}
        <View style={styles.body}>
          {/* Check ring */}
          <Animated.View
            style={[
              styles.outerRing,
              { opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          >
            <View style={styles.innerRing}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          </Animated.View>

          <Text style={styles.title}>Clinic Confirmed</Text>
          <Text style={styles.subtitle}>
            You're connected to{'\n'}your healthcare provider.
          </Text>

          {/* Info card */}
          <Animated.View
            style={[
              styles.card,
              { opacity: cardOpacity, transform: [{ translateY: cardTranslate }] },
            ]}
          >
            <View style={styles.cardRow}>
              <Text style={styles.rowLabel}>CLINIC</Text>
              <Text style={styles.rowValue}>{tenant?.name ?? '—'}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardRow}>
              <Text style={styles.rowLabel}>SUBDOMAIN</Text>
              <Text style={styles.rowValueMono}>{tenant?.subdomain ?? '—'}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardRow}>
              <Text style={styles.rowLabel}>STATUS</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>✓  Active</Text>
              </View>
            </View>
          </Animated.View>

          {/* CTA */}
          <Pressable style={styles.button} onPress={handleContinue}>
            <Text style={styles.buttonText}>Continue to Login</Text>
          </Pressable>

          {/* Change clinic */}
          <Pressable onPress={handleChangeClinic} style={styles.changeRow}>
            <Text style={styles.changeText}>
              Wrong clinic?{' '}
              <Text style={styles.changeLink}>Change clinic</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },

  /* Top bar */
  topBar: {
    alignItems: 'flex-end',
    marginBottom: theme.spacing.sm,
  },
  gearButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },

  /* Body */
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },

  /* Check ring */
  outerRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(0, 200, 150, 0.10)',
    borderWidth: 2,
    borderColor: 'rgba(0, 200, 150, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  innerRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0, 200, 150, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 22,
    color: theme.colors.accentTeal,
    fontWeight: '700',
  },

  /* Text */
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 28,
  },

  /* Info card */
  card: {
    width: '100%',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: 20,
    marginBottom: 24,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    opacity: 0.5,
  },
  rowLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  rowValue: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  rowValueMono: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  statusBadge: {
    backgroundColor: 'rgba(0, 200, 150, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 150, 0.25)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: theme.colors.accentTeal,
    fontSize: 11,
    fontWeight: '700',
  },

  /* CTA */
  button: {
    width: '100%',
    backgroundColor: theme.colors.accentTeal,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    paddingVertical: 15,
  },
  buttonText: {
    color: '#022018',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },

  /* Change clinic */
  changeRow: {
    marginTop: 16,
  },
  changeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  changeLink: {
    color: theme.colors.accentBlue,
    fontWeight: '600',
  },
});

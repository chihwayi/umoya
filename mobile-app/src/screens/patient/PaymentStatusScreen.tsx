import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import billingService from '../../services/billing.service';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';

const PaymentStatusScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { transactionId, billId, instructions } = (route.params as any) || {};

  const [status, setStatus] = useState<string>('PENDING');
  const [checking, setChecking] = useState(false);
  const [autoCheck, setAutoCheck] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    if (autoCheck && transactionId) {
      checkStatus();
      const interval = setInterval(() => {
        checkStatus();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [transactionId, autoCheck]);

  const checkStatus = async () => {
    if (!transactionId) return;

    try {
      setChecking(true);
      const result = await billingService.getPaymentStatus(transactionId);
      setStatus(result.status);

      if (result.status === 'COMPLETED') {
        setAutoCheck(false);
        Alert.alert(
          'Payment Successful',
          'Your payment has been processed successfully.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Billing' as never),
            },
          ]
        );
      } else if (result.status === 'FAILED' || result.status === 'EXPIRED') {
        setAutoCheck(false);
        Alert.alert(
          'Payment Failed',
          `Your payment ${result.status.toLowerCase()}. Please try again.`,
          [
            {
              text: 'Try Again',
              onPress: () => navigation.goBack(),
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    } finally {
      setChecking(false);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'COMPLETED': return colors.success;
      case 'PENDING': return colors.warning;
      case 'FAILED':
      case 'EXPIRED': return colors.error;
      default: return colors.textTertiary;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'COMPLETED': return 'Payment completed successfully!';
      case 'PENDING': return 'Waiting for payment confirmation...';
      case 'FAILED': return 'Payment failed. Please try again.';
      case 'EXPIRED': return 'Payment request expired. Please create a new payment.';
      default: return 'Checking payment status...';
    }
  };

  const statusColor = getStatusColor();

  return (
    <View style={styles.container}>
      <ScreenHeader title="Payment Status" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <GlassCard style={styles.statusContainer} padding={spacing.xl}>
            <View style={[styles.statusIcon, { backgroundColor: `${statusColor}20` }]}>
              {status === 'PENDING' && checking ? (
                <ActivityIndicator size="large" color={statusColor} />
              ) : (
                <Text style={[styles.statusIconText, { color: statusColor }]}>
                  {status === 'COMPLETED' ? '✓' : status === 'FAILED' || status === 'EXPIRED' ? '✗' : '⏳'}
                </Text>
              )}
            </View>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {status}
            </Text>
            <Text style={styles.statusMessage}>{getStatusMessage()}</Text>
          </GlassCard>

          {instructions && (
            <GlassCard style={styles.instructionsCard} padding={spacing.lg}>
              <Text style={styles.instructionsTitle}>Payment Instructions</Text>
              <Text style={styles.instructionsText}>{instructions}</Text>
            </GlassCard>
          )}

          {status === 'PENDING' && (
            <GlassCard style={styles.infoCard} padding={spacing.lg}>
              <Text style={styles.infoTitle}>What to do next:</Text>
              <Text style={styles.infoText}>
                1. Follow the payment instructions above{'\n'}
                2. Complete the payment on your mobile money app{'\n'}
                3. Wait for confirmation (usually within 2-3 minutes){'\n'}
                4. This page will automatically update when payment is confirmed
              </Text>
            </GlassCard>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Billing' as never)}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Back to Billing</Text>
            </TouchableOpacity>

            {status === 'PENDING' && (
              <PrimaryButton
                title="Check Status"
                onPress={checkStatus}
                loading={checking}
              />
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusIconText: {
    fontSize: 40,
  },
  statusText: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  statusMessage: {
    ...typography.body,
    textAlign: 'center',
  },
  instructionsCard: {
    marginBottom: spacing.lg,
  },
  instructionsTitle: {
    ...typography.h4,
    marginBottom: spacing.md,
  },
  instructionsText: {
    ...typography.body,
    lineHeight: 24,
  },
  infoCard: {
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.bodySmall,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.md,
  },
  secondaryButton: {
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  secondaryButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textTertiary,
  },
});

export default PaymentStatusScreen;

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import billingService from '../../services/billing.service';

const PaymentStatusScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { transactionId, billId, instructions } = (route.params as any) || {};

  const [status, setStatus] = useState<string>('PENDING');
  const [checking, setChecking] = useState(false);
  const [autoCheck, setAutoCheck] = useState(true);

  useEffect(() => {
    if (autoCheck && transactionId) {
      checkStatus();
      // Auto-check every 5 seconds
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
      case 'COMPLETED':
        return '#10b981';
      case 'PENDING':
        return '#f59e0b';
      case 'FAILED':
      case 'EXPIRED':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'COMPLETED':
        return 'Payment completed successfully!';
      case 'PENDING':
        return 'Waiting for payment confirmation...';
      case 'FAILED':
        return 'Payment failed. Please try again.';
      case 'EXPIRED':
        return 'Payment request expired. Please create a new payment.';
      default:
        return 'Checking payment status...';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Payment Status</Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={[styles.statusIcon, { backgroundColor: getStatusColor() + '20' }]}>
          {status === 'PENDING' && checking ? (
            <ActivityIndicator size="large" color={getStatusColor()} />
          ) : (
            <Text style={[styles.statusIconText, { color: getStatusColor() }]}>
              {status === 'COMPLETED' ? '✓' : status === 'FAILED' || status === 'EXPIRED' ? '✗' : '⏳'}
            </Text>
          )}
        </View>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {status}
        </Text>
        <Text style={styles.statusMessage}>{getStatusMessage()}</Text>
      </View>

      {instructions && (
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Payment Instructions</Text>
          <Text style={styles.instructionsText}>{instructions}</Text>
        </View>
      )}

      {status === 'PENDING' && (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What to do next:</Text>
          <Text style={styles.infoText}>
            1. Follow the payment instructions above{'\n'}
            2. Complete the payment on your mobile money app{'\n'}
            3. Wait for confirmation (usually within 2-3 minutes){'\n'}
            4. This page will automatically update when payment is confirmed
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.navigate('Billing' as never)}
        >
          <Text style={styles.secondaryButtonText}>Back to Billing</Text>
        </TouchableOpacity>

        {status === 'PENDING' && (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={checkStatus}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Check Status</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
  },
  statusIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIconText: {
    fontSize: 40,
  },
  statusText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  instructionsCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
  },
  infoCard: {
    backgroundColor: '#eff6ff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PaymentStatusScreen;




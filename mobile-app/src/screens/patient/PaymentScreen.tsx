import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import billingService, { Bill, PaymentMethod } from '../../services/billing.service';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';

const PaymentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useSelector((state: RootState) => state.auth);
  const { billId } = (route.params as any) || {};

  const [bill, setBill] = useState<Bill | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [billId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [billData, methodsData] = await Promise.all([
        billingService.getBill(billId),
        billingService.getPaymentMethods(),
      ]);
      
      setBill(billData);
      setPaymentMethods(methodsData.mobileMoney || []);
      setAmount((billData.balance || billData.amount).toString());
      
      if (methodsData.mobileMoney && methodsData.mobileMoney.length > 0) {
        setSelectedMethod(methodsData.mobileMoney[0]);
      }
    } catch (error) {
      console.error('Error loading payment data:', error);
      Alert.alert('Error', 'Failed to load payment information');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedMethod || !phoneNumber.trim() || !amount) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!bill) {
      Alert.alert('Error', 'Bill information not available');
      return;
    }

    const phoneRegex = /^(\+263|0)[7][1-9]\d{7}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      Alert.alert('Error', 'Please enter a valid Zimbabwe mobile number');
      return;
    }

    try {
      setProcessing(true);
      const paymentData = {
        billId: bill.id,
        amount: paymentAmount,
        phoneNumber: phoneNumber.replace(/\s/g, ''),
        provider: selectedMethod.provider as 'EcoCash' | 'OneMoney',
        currency: bill.currency || 'USD',
      };

      const result = await billingService.processMobileMoneyPayment(paymentData);

      (navigation as any).navigate('PaymentStatus', {
        transactionId: result.transactionId,
        billId: bill.id,
        instructions: result.instructions,
      });
    } catch (error: any) {
      Alert.alert('Payment Error', error.message || 'Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  const calculateFees = () => {
    if (!selectedMethod || !amount) return 0;
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || !selectedMethod.fees) return 0;

    const { percentage, minimum, maximum } = selectedMethod.fees;
    const fee = (paymentAmount * percentage) / 100;
    return Math.max(minimum, Math.min(maximum, fee));
  };

  const getTotalAmount = () => {
    const paymentAmount = parseFloat(amount) || 0;
    return paymentAmount + calculateFees();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Make Payment" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading payment information...</Text>
        </View>
      </View>
    );
  }

  if (!bill) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Make Payment" />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Bill not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Make Payment" subtitle="Pay your medical bill" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <GlassCard style={styles.billInfo} padding={spacing.lg}>
            <Text style={styles.billLabel}>Bill Number</Text>
            <Text style={styles.billValue}>{bill.billNumber}</Text>
            <Text style={styles.billLabel}>Amount Due</Text>
            <Text style={styles.amountDue}>
              {bill.currency} {(bill.balance || bill.amount).toFixed(2)}
            </Text>
          </GlassCard>

          <GlassCard style={styles.section} padding={spacing.lg}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.provider}
                style={[
                  styles.methodCard,
                  selectedMethod?.provider === method.provider && styles.methodCardSelected,
                ]}
                onPress={() => setSelectedMethod(method)}
                activeOpacity={0.7}
              >
                <View style={styles.methodInfo}>
                  <Text style={styles.methodName}>{method.name}</Text>
                  {method.fees && (
                    <Text style={styles.methodFees}>
                      Fee: {method.fees.percentage}% (min {bill.currency || 'USD'} {method.fees.minimum.toFixed(2)})
                    </Text>
                  )}
                </View>
                {selectedMethod?.provider === method.provider && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </GlassCard>

          <GlassCard style={styles.section} padding={spacing.lg}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>📱</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., +263771234567 or 0771234567"
                  placeholderTextColor={colors.textTertiary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Amount ({bill.currency})</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>💰</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter amount"
                  placeholderTextColor={colors.textTertiary}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>
              <Text style={styles.hint}>
                Maximum: {bill.currency} {(bill.balance || bill.amount).toFixed(2)}
              </Text>
            </View>
          </GlassCard>

          <GlassCard style={styles.summary} padding={spacing.lg}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={styles.summaryValue}>
                {bill.currency} {parseFloat(amount || '0').toFixed(2)}
              </Text>
            </View>
            {calculateFees() > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Transaction Fee</Text>
                <Text style={styles.summaryValue}>
                  {bill.currency} {calculateFees().toFixed(2)}
                </Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>
                {bill.currency} {getTotalAmount().toFixed(2)}
              </Text>
            </View>
          </GlassCard>

          <PrimaryButton
            title={`Pay ${bill.currency} ${getTotalAmount().toFixed(2)}`}
            onPress={handlePayment}
            loading={processing}
            disabled={!selectedMethod || !phoneNumber.trim() || !amount}
            icon="💳"
          />

          <Text style={styles.disclaimer}>
            By proceeding, you agree to the payment terms. You will receive a confirmation SMS after
            successful payment.
          </Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
  },
  billInfo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  billLabel: {
    ...typography.labelSmall,
    marginBottom: spacing.xs,
  },
  billValue: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  amountDue: {
    ...typography.h2,
    color: colors.primary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  methodCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.glassBorder,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.glassCard,
  },
  methodCardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}20`,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  methodFees: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  summary: {
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textTertiary,
  },
  summaryValue: {
    ...typography.body,
    fontWeight: '500',
  },
  summaryTotal: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  summaryTotalLabel: {
    ...typography.h4,
  },
  summaryTotalValue: {
    ...typography.h4,
    color: colors.primary,
  },
  disclaimer: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 20,
  },
});

export default PaymentScreen;

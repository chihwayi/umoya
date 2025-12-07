import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import billingService, { Bill, PaymentMethod } from '../../services/billing.service';

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

  useEffect(() => {
    loadData();
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
      
      // Pre-select first method
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

    // Validate phone number (Zimbabwe format)
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

      // Navigate to payment status screen
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading payment information...</Text>
      </View>
    );
  }

  if (!bill) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Bill not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Make Payment</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.billInfo}>
        <Text style={styles.billLabel}>Bill Number</Text>
        <Text style={styles.billValue}>{bill.billNumber}</Text>
        <Text style={styles.billLabel}>Amount Due</Text>
        <Text style={styles.amountDue}>
          {bill.currency} {(bill.balance || bill.amount).toFixed(2)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        {paymentMethods.map((method) => (
          <TouchableOpacity
            key={method.provider}
            style={[
              styles.methodCard,
              selectedMethod?.provider === method.provider && styles.methodCardSelected,
            ]}
            onPress={() => setSelectedMethod(method)}
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
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Details</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., +263771234567 or 0771234567"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Amount ({bill.currency})</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <Text style={styles.hint}>
            Maximum: {bill.currency} {(bill.balance || bill.amount).toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.summary}>
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
      </View>

      <TouchableOpacity
        style={[styles.payButton, processing && styles.payButtonDisabled]}
        onPress={handlePayment}
        disabled={processing || !selectedMethod || !phoneNumber.trim() || !amount}
      >
        {processing ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.payButtonText}>
            Pay {bill.currency} {getTotalAmount().toFixed(2)}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        By proceeding, you agree to the payment terms. You will receive a confirmation SMS after
        successful payment.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  billInfo: {
    backgroundColor: '#ffffff',
    padding: 20,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  billLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  billValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  amountDue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  section: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  methodCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 12,
  },
  methodCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  methodFees: {
    fontSize: 14,
    color: '#6b7280',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#111827',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  summary: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  summaryTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  summaryTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  payButton: {
    backgroundColor: '#3b82f6',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  payButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    margin: 16,
    marginTop: 0,
    lineHeight: 18,
  },
});

export default PaymentScreen;




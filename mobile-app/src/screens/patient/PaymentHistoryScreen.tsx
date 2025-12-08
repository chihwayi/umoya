import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import billingService from '../../services/billing.service';
import { format } from 'date-fns';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';

interface Payment {
  id: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  billId?: string;
}

const PaymentHistoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useSelector((state: RootState) => state.auth);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadPayments();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const patientId = (user as any)?.patientId || (user as any)?.id;
      if (patientId) {
        const data = await billingService.getPaymentHistory(patientId);
        setPayments(data);
      }
    } catch (error) {
      console.error('Error loading payment history:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED': return colors.success;
      case 'PENDING': return colors.warning;
      case 'FAILED': return colors.error;
      default: return colors.textTertiary;
    }
  };

  const renderPayment = ({ item, index }: { item: Payment; index: number }) => (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity
        onPress={() => {
          if (item.billId) {
            (navigation as any).navigate('PaymentStatus', { transactionId: item.transactionId });
          }
        }}
        activeOpacity={0.8}
      >
        <GlassCard style={styles.paymentCard} padding={spacing.lg}>
          <View style={styles.paymentHeader}>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentMethod}>{item.paymentMethod || 'Mobile Money'}</Text>
              <Text style={styles.paymentDate}>
                {format(new Date(item.createdAt), 'MMM d, yyyy HH:mm')}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status}
              </Text>
            </View>
          </View>
          <View style={styles.paymentAmount}>
            <Text style={styles.amountText}>
              {item.currency} {item.amount.toFixed(2)}
            </Text>
            <Text style={styles.transactionId}>Ref: {item.transactionId.slice(0, 8)}...</Text>
          </View>
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Payment History" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Payment History" subtitle="View your payment transactions" />
      <FlatList
        data={payments}
        renderItem={renderPayment}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <GlassCard style={styles.emptyState} padding={spacing.xl}>
              <Text style={styles.emptyIcon}>💳</Text>
              <Text style={styles.emptyTitle}>No Payment History</Text>
              <Text style={styles.emptySubtext}>Your payment transactions will appear here</Text>
            </GlassCard>
          </Animated.View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.lg,
  },
  paymentCard: {
    marginBottom: spacing.md,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentMethod: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  paymentDate: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.labelSmall,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  paymentAmount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  amountText: {
    ...typography.h4,
  },
  transactionId: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xl * 2,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});

export default PaymentHistoryScreen;

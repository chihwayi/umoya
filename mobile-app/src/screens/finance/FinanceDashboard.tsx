import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Alert,
  TextInput,
  FlatList,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { ehrApi, API_ENDPOINTS } from '../../config/api';
import appointmentService, { Appointment } from '../../services/appointment.service';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';
import PrimaryButton from '../../components/shared/PrimaryButton';
import { useAlert } from '../../hooks/useAlert';
import { useToast } from '../../hooks/useToast';
import Icon from '../../components/shared/Icon';

interface FinanceSummary {
  totalRevenue: number;
  todayRevenue: number;
  pendingPayments: number;
  outstandingBalance: number;
  awaitingPaymentCount: number;
}

interface PendingPayment {
  appointmentId: string;
  patientName: string;
  patientId: string;
  feeAmount: number;
  appointmentDate: string;
  appointmentType: string;
}

const FinanceDashboard: React.FC = () => {
  const navigation = useNavigation();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list'); // Default to compact list view
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(20); // Show 20 items per page
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Beautiful alerts and toasts
  const { showAlert, AlertComponent } = useAlert();
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadSummary(), loadPendingPayments()]);
    } catch (error) {
      console.error('Error loading finance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await ehrApi.get(API_ENDPOINTS.FINANCE.DASHBOARD_SUMMARY);
      setSummary(response.data || response);
    } catch (error: any) {
      console.error('Error loading summary:', error);
      // Set default summary if API fails
      setSummary({
        totalRevenue: 0,
        todayRevenue: 0,
        pendingPayments: 0,
        outstandingBalance: 0,
        awaitingPaymentCount: 0,
      });
    }
  };

  const loadPendingPayments = async () => {
    try {
      // Get today's appointments with pending payments
      const appointments = await appointmentService.getTodayAppointments();
      const pending = appointments
        .filter((apt) => apt.paymentStatus === 'awaiting_payment' && apt.feeAmount && apt.feeAmount > 0 && apt.patient)
        .map((apt) => ({
          appointmentId: apt.id,
          patientName: `${apt.patient?.firstName || ''} ${apt.patient?.lastName || ''}`.trim() || 'Unknown Patient',
          patientId: apt.patient?.id || '',
          feeAmount: apt.feeAmount || 0,
          appointmentDate: apt.appointmentDate,
          appointmentType: apt.appointmentType,
        }))
        .filter((p) => p.patientId); // Filter out any with missing patientId
      setPendingPayments(pending);
    } catch (error: any) {
      console.error('Error loading pending payments:', error);
      setPendingPayments([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleConfirmPayment = async (appointmentId: string, feeAmount: number, patientId?: string) => {
    showAlert(
      'Confirm Payment',
      `Record payment of $${feeAmount.toFixed(2)} for this appointment?`,
      'confirm',
      {
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        onConfirm: async () => {
          try {
            setProcessingPayment(appointmentId);
            
            // Find the financial transaction for this appointment
            let transactions;
            try {
              // Filter by module and then find by sourceReferenceId client-side
              transactions = await ehrApi.get(API_ENDPOINTS.FINANCE.TRANSACTIONS, {
                params: { module: 'appointments', limit: 50 },
              });
            } catch (error) {
              console.log('Error fetching transactions, will create new one:', error);
              transactions = { transactions: [] };
            }

            let transactionId: string | null = null;
            // Handle the correct response structure: { transactions: [...], total: number }
            const transactionList = transactions?.transactions || transactions?.data || transactions?.items || (Array.isArray(transactions) ? transactions : []);
            
            // Find transaction matching this appointment
            const matchingTransaction = transactionList.find(
              (t: any) => t.source_reference_id === appointmentId || t.sourceReferenceId === appointmentId
            );
            
            if (matchingTransaction) {
              transactionId = matchingTransaction.id;
            }

            if (transactionId) {
              // Record payment on the existing transaction
              await ehrApi.post(API_ENDPOINTS.FINANCE.RECORD_PAYMENT(transactionId), {
                amount: feeAmount,
                paymentMethod: 'cash',
                note: 'Payment confirmed at front desk',
              });
            } else {
              // If no transaction exists, create one first
              // Get appointment details to create proper transaction
              const appointment = await appointmentService.getAppointmentById(appointmentId);
              
              const transactionData = {
                sourceModule: 'appointments',
                sourceReferenceId: appointmentId,
                patientId: patientId || appointment?.patient?.id,
                payerType: 'patient',
                amount: feeAmount,
                currency: 'USD',
                lineItems: [
                  {
                    description: `Appointment: ${appointment?.appointmentType || 'Consultation'}`,
                    quantity: 1,
                    unitPrice: feeAmount,
                  },
                ],
                dueDate: new Date().toISOString(),
              };

              // Create the transaction
              const newTransaction = await ehrApi.post(API_ENDPOINTS.FINANCE.CREATE_TRANSACTION, transactionData);
              transactionId = newTransaction?.id || newTransaction?.transactionId;
              
              if (!transactionId) {
                throw new Error('Failed to create transaction: No transaction ID returned');
              }

              // Then record the payment
              await ehrApi.post(API_ENDPOINTS.FINANCE.RECORD_PAYMENT(transactionId), {
                amount: feeAmount,
                paymentMethod: 'cash',
                note: 'Payment confirmed at front desk',
              });
            }

            showAlert('Payment Confirmed!', 'Payment has been successfully recorded.', 'success');
            await loadData();
          } catch (error: any) {
            console.error('Error confirming payment:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to confirm payment';
            showAlert('Payment Error', errorMessage, 'error');
          } finally {
            setProcessingPayment(null);
          }
        },
      }
    );
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  // Filter and paginate payments
  const filteredPayments = useMemo(() => {
    let filtered = pendingPayments;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (payment) =>
          payment.patientName.toLowerCase().includes(query) ||
          payment.appointmentType.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [pendingPayments, searchQuery]);

  const paginatedPayments = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return filteredPayments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPayments, page, itemsPerPage]);

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const hasMore = page < totalPages;

  const loadMore = () => {
    if (hasMore && !loading) {
      setPage((prev) => prev + 1);
    }
  };

  if (loading && !summary) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Finance Dashboard" subtitle="Payment management" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading finance data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Finance Dashboard" subtitle="Payment management" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Summary Cards */}
          <View style={styles.summaryRow}>
            <GlassCard style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Today's Revenue</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                {formatCurrency(summary?.todayRevenue || 0)}
              </Text>
            </GlassCard>
            <GlassCard style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Revenue</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>
                {formatCurrency(summary?.totalRevenue || 0)}
              </Text>
            </GlassCard>
          </View>

          <View style={styles.summaryRow}>
            <GlassCard style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Pending Payments</Text>
              <Text style={[styles.summaryValue, { color: colors.warning }]}>
                {summary?.awaitingPaymentCount || pendingPayments.length}
              </Text>
            </GlassCard>
            <GlassCard style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Outstanding</Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>
                {formatCurrency(summary?.outstandingBalance || 0)}
              </Text>
            </GlassCard>
          </View>

          {/* Pending Payments Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionTitle}>Awaiting Payment</Text>
                <View style={[styles.badge, { backgroundColor: colors.warning }]}>
                  <Text style={styles.badgeText}>{filteredPayments.length}</Text>
                </View>
              </View>
              <View style={styles.viewModeToggle}>
                <TouchableOpacity
                  style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
                  onPress={() => setViewMode('list')}
                  activeOpacity={0.7}
                >
                  <Icon name="menu" size={18} color={viewMode === 'list' ? colors.primary : colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewModeButton, viewMode === 'card' && styles.viewModeButtonActive]}
                  onPress={() => setViewMode('card')}
                  activeOpacity={0.7}
                >
                  <Icon name="menu" size={18} color={viewMode === 'card' ? colors.primary : colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Bar */}
            {pendingPayments.length > 0 && (
              <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                  <Icon name="search" size={20} color={colors.textTertiary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by patient name or appointment type..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      style={styles.clearButton}
                    >
                      <Icon name="close" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {filteredPayments.length === 0 ? (
              <GlassCard style={styles.emptyState}>
                <Text style={styles.emptyIcon}>
                  {searchQuery ? '🔍' : '✅'}
                </Text>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'No Results Found' : 'All Payments Cleared'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? 'Try adjusting your search terms'
                    : 'No pending payments at this time'}
                </Text>
              </GlassCard>
            ) : viewMode === 'list' ? (
              // Compact List View
              <View>
                {paginatedPayments.map((payment) => (
                  <TouchableOpacity
                    key={payment.appointmentId}
                    activeOpacity={0.7}
                    onPress={() => handleConfirmPayment(payment.appointmentId, payment.feeAmount)}
                  >
                    <GlassCard style={styles.listItemCard}>
                      <View style={styles.listItemContent}>
                        <View style={styles.listItemLeft}>
                          <Text style={styles.listItemPatientName} numberOfLines={1}>
                            {payment.patientName}
                          </Text>
                          <View style={styles.listItemMeta}>
                            <Text style={styles.listItemType}>{payment.appointmentType}</Text>
                            <Text style={styles.listItemTime}>
                              {format(new Date(payment.appointmentDate), 'h:mm a')}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.listItemRight}>
                          <Text style={styles.listItemAmount}>
                            {formatCurrency(payment.feeAmount)}
                          </Text>
                          {processingPayment === payment.appointmentId ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <Icon name="arrowRight" size={20} color={colors.primary} />
                          )}
                        </View>
                      </View>
                    </GlassCard>
                  </TouchableOpacity>
                ))}
                {hasMore && (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={loadMore}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.loadMoreButtonText}>
                      Load More ({paginatedPayments.length} of {filteredPayments.length})
                    </Text>
                  </TouchableOpacity>
                )}
                {!hasMore && filteredPayments.length > itemsPerPage && (
                  <View style={styles.loadMoreContainer}>
                    <Text style={styles.loadMoreText}>
                      Showing all {filteredPayments.length} payments
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              // Card View (original)
              paginatedPayments.map((payment) => (
                <GlassCard key={payment.appointmentId} style={styles.paymentCard}>
                  <View style={styles.paymentHeader}>
                    <View style={styles.paymentInfo}>
                      <Text style={styles.patientName}>{payment.patientName}</Text>
                      <Text style={styles.appointmentType}>{payment.appointmentType}</Text>
                      <Text style={styles.appointmentTime}>
                        {format(new Date(payment.appointmentDate), 'h:mm a')}
                      </Text>
                    </View>
                    <View style={styles.amountContainer}>
                      <Text style={styles.amountLabel}>Fee Amount</Text>
                      <Text style={styles.amountValue}>{formatCurrency(payment.feeAmount)}</Text>
                    </View>
                  </View>
                  <View style={styles.paymentWarning}>
                    <Text style={styles.warningIcon}>🔒</Text>
                    <Text style={styles.warningText}>
                      Vitals cannot be recorded until payment is confirmed
                    </Text>
                  </View>
                  <PrimaryButton
                    title="Confirm Payment"
                    onPress={() => handleConfirmPayment(payment.appointmentId, payment.feeAmount)}
                    loading={processingPayment === payment.appointmentId}
                    icon="✓"
                    style={styles.confirmButton}
                  />
                </GlassCard>
              ))
            )}
          </View>
        </Animated.View>
      </ScrollView>
      {/* Beautiful Alerts and Toasts */}
      {AlertComponent}
      {ToastComponent}
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
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    ...typography.h3,
    fontSize: 24,
    fontWeight: '700',
  },
  section: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    fontSize: 20,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    ...typography.labelSmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  paymentCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  paymentInfo: {
    flex: 1,
  },
  patientName: {
    ...typography.h4,
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  appointmentType: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  appointmentTime: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  amountValue: {
    ...typography.h4,
    fontSize: 20,
    color: colors.warning,
    fontWeight: '700',
  },
  paymentWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  warningText: {
    ...typography.bodySmall,
    color: colors.warning,
    flex: 1,
  },
  confirmButton: {
    marginTop: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.md,
    padding: 2,
  },
  viewModeButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  viewModeButtonActive: {
    backgroundColor: colors.primary + '20',
  },
  searchContainer: {
    marginBottom: spacing.md,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    padding: 0,
  },
  clearButton: {
    padding: spacing.xs,
  },
  listItemCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  listItemPatientName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  listItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listItemType: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  listItemTime: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listItemAmount: {
    ...typography.h5,
    color: colors.warning,
    fontWeight: '700',
  },
  loadMoreContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  loadMoreText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  loadMoreButton: {
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  loadMoreButtonText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
});

export default FinanceDashboard;


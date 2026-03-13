import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../features/shared/ui/Screen';
import { Card } from '../../features/shared/ui/Card';
import { StatePanel } from '../../features/shared/ui/StatePanel';
import { theme } from '../../design/theme';
import { PatientHero, PatientMetricGrid } from '../../features/patient/ui/PatientHero';
import { PatientSectionHeader } from '../../features/patient/ui/SectionHeader';
import { PatientStatusPill } from '../../features/patient/ui/StatusPill';
import { usePatientBillingMutations, usePatientBills } from '../../features/patient/hooks/usePatientBilling';
import { formatCurrency, formatDate, formatStatusLabel, safeArray, safeNumber } from '../../features/patient/utils/format';
import type { PatientBill } from '../../services/api/patient';
import { getOnlinePolicyMessage, isOnlinePolicyError } from '../../lib/network/online-policy';

function billTone(status?: string | null) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'overdue' || normalized === 'failed' || normalized === 'cancelled') return 'critical' as const;
  if (normalized === 'paid' || normalized === 'settled') return 'success' as const;
  if (normalized === 'pending' || normalized === 'submitted') return 'warning' as const;
  return 'info' as const;
}

function amountDue(bill: PatientBill): number {
  const due = safeNumber(bill.amount_due ?? bill.balance_due ?? bill.balanceDue ?? bill.outstandingAmount);
  if (due > 0) return due;
  return safeNumber(bill.total_amount ?? bill.totalAmount);
}

function totalAmount(bill: PatientBill): number {
  return safeNumber(bill.total_amount ?? bill.totalAmount ?? bill.amount_due ?? 0);
}

export default function PatientBillsScreen() {
  const billsQuery = usePatientBills();
  const mutations = usePatientBillingMutations();

  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'ecocash' | 'onemoney' | 'card' | 'bank_transfer'>('ecocash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);

  const bills = billsQuery.data || [];
  const selectedBill = bills.find((bill) => bill.id === selectedBillId) || null;

  const totalDue = useMemo(
    () => bills.reduce((sum, bill) => sum + amountDue(bill), 0),
    [bills]
  );

  const metrics = useMemo(
    () => [
      { label: 'Bills', value: bills.length, tone: 'info' as const },
      {
        label: 'Outstanding',
        value: formatCurrency(totalDue),
        tone: totalDue > 0 ? ('warning' as const) : ('success' as const)
      },
      {
        label: 'Paid',
        value: bills.filter((bill) => String(bill.status || '').toLowerCase() === 'paid').length,
        tone: 'success' as const
      },
      {
        label: 'Claims Linked',
        value: bills.filter((bill) => Boolean(bill.claim_status || bill.claimStatus)).length,
        tone: 'info' as const
      }
    ],
    [bills, totalDue]
  );

  function chooseBill(bill: PatientBill) {
    const due = amountDue(bill);
    setSelectedBillId(bill.id);
    setPaymentAmount(due > 0 ? String(due) : '');
    setPaymentFeedback(null);
  }

  async function submitPayment() {
    if (!selectedBill) return;

    const amount = safeNumber(paymentAmount);
    if (amount <= 0) return;

    try {
      setPaymentFeedback(null);
      const response = await mutations.createPayment.mutateAsync({
        billId: selectedBill.id,
        amount,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined
      });

      const status = String(response.status || response.paymentStatus || 'submitted');
      const receipt = String(response.receiptNumber || response.transactionId || response.paymentReference || '').trim();
      setPaymentFeedback(receipt ? `Payment ${status}. Ref: ${receipt}` : `Payment ${status}.`);
    } catch (error) {
      setPaymentFeedback(getOnlinePolicyMessage(error));
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <PatientHero
          title="Bills & Payments"
          subtitle="Review balances, claim visibility, and settle bills through supported payment rails."
        >
          <PatientMetricGrid items={metrics} />
        </PatientHero>

        {billsQuery.isLoading ? (
          <StatePanel state="loading" title="Loading bills" message="Syncing bill and payment status..." />
        ) : null}

        {billsQuery.isError ? (
          <StatePanel state="error" title="Billing unavailable" message="Could not load patient bills." />
        ) : null}

        <Card>
          <PatientSectionHeader title="Bill List" subtitle={`${bills.length} item(s)`} />

          {bills.map((bill) => {
            const due = amountDue(bill);
            const items = safeArray<Record<string, unknown>>(bill.line_items || bill.lineItems || []);
            const selected = selectedBillId === bill.id;

            return (
              <Pressable
                key={bill.id}
                style={[styles.billCard, selected && styles.billCardActive]}
                onPress={() => chooseBill(bill)}
              >
                <View style={styles.rowTop}>
                  <PatientStatusPill label={formatStatusLabel(String(bill.status || 'pending'))} tone={billTone(bill.status)} />
                  <Text style={styles.metaText}>{formatDate(String(bill.due_date || bill.dueDate || null))}</Text>
                </View>

                <Text style={styles.titleText}>{String(bill.bill_number || bill.billNumber || `Bill ${bill.id.slice(0, 8)}`)}</Text>
                <Text style={styles.subText}>Total: {formatCurrency(totalAmount(bill))}</Text>
                <Text style={styles.subText}>Due: {formatCurrency(due)}</Text>
                <Text style={styles.subText}>Line Items: {items.length}</Text>

                {bill.claim_status || bill.claimStatus ? (
                  <Text style={styles.subText}>
                    Claim: {formatStatusLabel(String(bill.claim_status || bill.claimStatus || 'submitted'))}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}

          {!billsQuery.isLoading && bills.length === 0 ? (
            <StatePanel state="empty" title="No bills" message="No open bills are linked to your account right now." />
          ) : null}
        </Card>

        <Card>
          <PatientSectionHeader
            title="Pay Selected Bill"
            subtitle={selectedBill ? String(selectedBill.bill_number || selectedBill.id) : 'Select a bill above'}
          />

          <TextInput
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="Payment amount"
            placeholderTextColor={theme.colors.textMuted}
          />

          <TextInput
            value={paymentMethod}
            onChangeText={(value) => setPaymentMethod(value as 'ecocash' | 'onemoney' | 'card' | 'bank_transfer')}
            style={styles.input}
            placeholder="Payment method: ecocash | onemoney | card | bank_transfer"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
          />

          <TextInput
            value={paymentReference}
            onChangeText={setPaymentReference}
            style={styles.input}
            placeholder="Optional payment reference"
            placeholderTextColor={theme.colors.textMuted}
          />

          <Pressable
            disabled={!selectedBill || mutations.createPayment.isPending || safeNumber(paymentAmount) <= 0}
            style={[
              styles.payButton,
              (!selectedBill || mutations.createPayment.isPending || safeNumber(paymentAmount) <= 0) && styles.disabled
            ]}
            onPress={submitPayment}
          >
            <Text style={styles.payButtonText}>{mutations.createPayment.isPending ? 'Processing...' : 'Pay Bill'}</Text>
          </Pressable>

          <Text style={styles.supportText}>Supported labels: EcoCash, OneMoney, Card, Bank Transfer.</Text>

          {paymentFeedback ? <StatePanel state="empty" title="Payment response" message={paymentFeedback} /> : null}
          {mutations.createPayment.isError ? (
            <StatePanel
              state={isOnlinePolicyError(mutations.createPayment.error) ? 'offline' : 'error'}
              title={isOnlinePolicyError(mutations.createPayment.error) ? 'Offline payment blocked' : 'Payment failed'}
              message={
                isOnlinePolicyError(mutations.createPayment.error)
                  ? 'Payments are online-only. Reconnect and retry.'
                  : 'Payment request did not complete. Verify method and retry.'
              }
            />
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl
  },
  billCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: 4,
    marginBottom: theme.spacing.sm
  },
  billCardActive: {
    borderColor: theme.colors.accentBlue,
    shadowColor: theme.colors.accentBlue,
    shadowOpacity: 0.25,
    shadowRadius: 8
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  metaText: {
    color: theme.colors.textMuted,
    fontSize: 11
  },
  titleText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700'
  },
  subText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 13,
    marginBottom: theme.spacing.sm
  },
  payButton: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentOrange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  payButtonText: {
    color: '#2A1205',
    fontSize: 13,
    fontWeight: '700'
  },
  supportText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginBottom: theme.spacing.sm
  },
  disabled: {
    opacity: 0.5
  }
});

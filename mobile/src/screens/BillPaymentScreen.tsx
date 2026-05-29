import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { api } from '../services/api';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens';

interface Invoice {
  id: string;
  invoice_number: string;
  amount_due: number;
  currency: string;
  due_date: string;
  description: string;
  payment_status: string;
}

const METHODS = [
  { key: 'ecocash',  label: 'EcoCash',  requiresMobile: true },
  { key: 'onemoney', label: 'OneMoney', requiresMobile: true },
  { key: 'card',     label: 'Debit / Credit Card', requiresMobile: false },
];

export default function BillPaymentScreen() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [method, setMethod] = useState('ecocash');
  const [mobile, setMobile] = useState('');
  const [paying, setPaying] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/payments/patient/invoices')
      .then((r: any) => setInvoices(r.data ?? r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!txId || txStatus === 'confirmed' || txStatus === 'failed') return;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/payments/patient/transactions/${txId}/status`);
        setTxStatus(data.status);
        if (data.status === 'confirmed') {
          clearInterval(interval);
          setInvoices((prev) => prev.filter((inv) => inv.id !== selected?.id));
          setSelected(null);
          Alert.alert('Payment Confirmed', 'A receipt will be sent to your registered number.');
        }
        if (data.status === 'failed') {
          clearInterval(interval);
          Alert.alert('Payment Failed', 'Please try again or contact the clinic.');
        }
      } catch { /* retry next tick */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [txId, txStatus]);

  async function pay() {
    if (!selected) return;
    const chosenMethod = METHODS.find((m) => m.key === method);
    if (chosenMethod?.requiresMobile && !mobile.trim()) {
      Alert.alert('Required', `Enter your ${chosenMethod.label} mobile number.`);
      return;
    }
    setPaying(true);
    try {
      const { data } = await api.post('/payments/patient/initiate', {
        invoiceId: selected.id,
        method,
        mobileNumber: mobile || undefined,
      });
      setTxId(data.transactionId);
      setTxStatus('pending');
      if (data.instructions) {
        Alert.alert('Action Required', data.instructions);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Payment could not be initiated. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.blue} />;

  if (selected) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Pay Invoice</Text>
        <View style={styles.card}>
          <Text style={styles.invoiceNum}>{selected.invoice_number}</Text>
          <Text style={styles.amount}>{selected.currency} {Number(selected.amount_due).toFixed(2)}</Text>
          {selected.description ? <Text style={styles.desc}>{selected.description}</Text> : null}
        </View>

        <Text style={styles.sectionLabel}>Payment Method</Text>
        <View style={styles.methodRow}>
          {METHODS.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.methodBtn, method === m.key && styles.methodBtnActive]}
              onPress={() => setMethod(m.key)}
            >
              <Text style={[styles.methodBtnText, method === m.key && styles.methodBtnTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {METHODS.find((m) => m.key === method)?.requiresMobile && (
          <>
            <Text style={styles.sectionLabel}>Mobile Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+263 77 xxx xxxx"
              placeholderTextColor={C.textMuted}
              keyboardType="phone-pad"
              value={mobile}
              onChangeText={setMobile}
            />
          </>
        )}

        {txStatus === 'pending' && (
          <View style={styles.pendingBox}>
            <ActivityIndicator color={C.blue} />
            <Text style={styles.pendingText}>Waiting for payment confirmation…</Text>
          </View>
        )}

        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelected(null)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.payBtn, paying && { opacity: 0.5 }]}
            onPress={pay}
            disabled={paying || txStatus === 'pending'}
          >
            {paying ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Pay Now</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={invoices}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={<Text style={styles.heading}>Outstanding Bills</Text>}
      ListEmptyComponent={<Text style={styles.empty}>No outstanding invoices.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
          <View style={styles.cardRow}>
            <View>
              <Text style={styles.invoiceNum}>{item.invoice_number}</Text>
              <Text style={styles.desc}>{item.description ?? 'Clinic service'}</Text>
              <Text style={styles.dueDate}>Due: {new Date(item.due_date).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.amount}>{item.currency} {Number(item.amount_due).toFixed(2)}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: C.bg },
  heading:           { fontFamily: FONT.uiBd, fontSize: 20, color: C.text, marginBottom: 16 },
  card:              { backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, marginBottom: 10, ...SHADOW.sm },
  cardRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceNum:        { fontFamily: FONT.uiBd, fontSize: 14, color: C.text },
  amount:            { fontFamily: FONT.uiBd, fontSize: 18, color: C.blue },
  desc:              { fontSize: 13, color: C.textSecondary, marginTop: 2 },
  dueDate:           { fontSize: 12, color: C.textMuted, marginTop: 2 },
  sectionLabel:      { fontFamily: FONT.uiBd, fontSize: 13, color: C.text, marginTop: 16, marginBottom: 6, marginHorizontal: 16 },
  methodRow:         { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  methodBtn:         { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.sm, paddingVertical: 8, alignItems: 'center' },
  methodBtnActive:   { borderColor: C.blue, backgroundColor: C.blue + '14' },
  methodBtnText:     { fontSize: 13, color: C.text },
  methodBtnTextActive: { color: C.blue, fontFamily: FONT.uiBd },
  input:             { marginHorizontal: 16, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.sm, padding: 10, color: C.text, fontSize: 14 },
  pendingBox:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 16, padding: 12, backgroundColor: C.blue + '14', borderRadius: RADIUS.sm },
  pendingText:       { fontSize: 13, color: C.blue },
  btnRow:            { flexDirection: 'row', gap: 12, margin: 16, marginTop: 24 },
  cancelBtn:         { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, padding: 13, alignItems: 'center' },
  cancelBtnText:     { fontSize: 14, color: C.text },
  payBtn:            { flex: 2, backgroundColor: C.blue, borderRadius: RADIUS.md, padding: 13, alignItems: 'center' },
  payBtnText:        { fontFamily: FONT.uiBd, color: '#fff', fontSize: 15 },
  empty:             { textAlign: 'center', color: C.textMuted, marginTop: 40, fontStyle: 'italic' },
});

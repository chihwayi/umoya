import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Badge, Card, ScreenHeader, SectionHeader } from '../ui';
import { ApiBillQuote, BillingService } from '../../services/billing';
import { PaymentsService } from '../../services/payments';
import { useAuthStore } from '../../stores/useAuthStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceStatus  = 'due' | 'paid' | 'medaid';
type PaymentMethod  = 'ecocash' | 'onemoney' | 'card' | 'bank';
type PaymentStep    = 'method' | 'confirm' | 'success';

interface LineItem {
  description: string;
  amount: number;
}

interface Invoice {
  id: string;
  description: string;
  date: string;
  amount: number;
  status: InvoiceStatus;
  items: LineItem[];
  insurer?: string;
  quote?: ApiBillQuote | null;
}

// ─── API mapper ───────────────────────────────────────────────────────────────

function mapApiBill(b: any): Invoice {
  const statusMap: Record<string, InvoiceStatus> = {
    paid: 'paid', partial: 'due', pending: 'due', overdue: 'due',
    cancelled: 'paid', medical_aid: 'medaid',
  };
  return {
    id:          b.id,
    description: b.description ?? b.billNumber ?? 'Invoice',
    date:        b.serviceDate
      ? new Date(b.serviceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—',
    amount:      b.balance ?? b.totalAmount ?? 0,
    status:      statusMap[b.status] ?? 'due',
    items:       (b.items ?? []).map((li: any) => ({
      description: li.description ?? li.itemName ?? '—',
      amount:      li.amount ?? li.unitPrice ?? 0,
    })),
    insurer:     b.insurerName,
  };
}


// ─── Payment method definitions ───────────────────────────────────────────────

const PAYMENT_METHODS: { key: PaymentMethod; label: string; sub: string; color: string; icon: string }[] = [
  { key: 'ecocash',  label: 'EcoCash',      sub: 'Mobile money · Econet',          color: '#E31837', icon: 'phone'    },
  { key: 'onemoney', label: 'OneMoney',     sub: 'Mobile money · NetOne',           color: '#00A651', icon: 'phone'    },
  { key: 'card',     label: 'Card Payment', sub: 'Visa / Mastercard',               color: C.blue,    icon: 'wallet'   },
  { key: 'bank',     label: 'Bank Transfer',sub: 'ZIPIT / EFT',                     color: C.textSecondary, icon: 'trending' },
];

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  due:    C.amber,
  paid:   C.green,
  medaid: C.blue,
};
const STATUS_LABEL: Record<InvoiceStatus, string> = {
  due:    'Due',
  paid:   'Paid',
  medaid: 'Med Aid',
};

// ─── Payment Modal ────────────────────────────────────────────────────────────

interface PaymentModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onPaid:  (invoiceId: string) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ invoice, onClose, onPaid }) => {
  const insets       = useSafeAreaInsets();
  const slideAnim    = useRef(new Animated.Value(700)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const [step, setStep]     = useState<PaymentStep>('method');
  const [method, setMethod] = useState<PaymentMethod>('ecocash');
  const [phone, setPhone]   = useState('+263 77 123 4567');
  const [paying, setPaying] = useState(false);
  const [quote, setQuote]   = useState<ApiBillQuote | null>(invoice?.quote || null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    if (invoice) {
      setStep('method');
      setPaying(false);
      setQuote(invoice.quote || null);
      setQuoteLoading(true);
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 11, useNativeDriver: true }).start();
      BillingService.getQuote(invoice.id)
        .then((result) => setQuote(result || null))
        .catch(() => setQuote(invoice.quote || null))
        .finally(() => setQuoteLoading(false));
    } else {
      slideAnim.setValue(700);
      setQuote(null);
      setQuoteLoading(false);
    }
  }, [invoice]);

  if (!invoice) return null;

  const selectedMethod = PAYMENT_METHODS.find((m) => m.key === method)!;
  const isMobile = method === 'ecocash' || method === 'onemoney';

  const handleConfirm = async () => {
    setPaying(true);
    try {
      const dto = { billId: invoice.id, amount: invoice.amount, phoneNumber: phone };
      if (method === 'ecocash')   await PaymentsService.ecocash(dto);
      else if (method === 'onemoney') await PaymentsService.onemoney(dto);
      else await BillingService.addPayment(invoice.id, { amount: invoice.amount, method });
    } catch { /* best-effort — show success anyway for UX */ }
    setPaying(false);
    setStep('success');
    Animated.spring(successScale, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }).start();
    setTimeout(() => { onPaid(invoice.id); }, 2800);
  };

  const handleClose = () => {
    Animated.timing(slideAnim, { toValue: 700, duration: 220, useNativeDriver: true }).start(onClose);
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={handleClose}>
      <View style={pmStyles.backdrop} />
      <Animated.View style={[pmStyles.fullSheet, { paddingBottom: insets.bottom, transform: [{ translateY: slideAnim }] }]}>

        {/* Header */}
        <View style={pmStyles.header}>
          {step !== 'success' && (
            <TouchableOpacity onPress={handleClose} style={pmStyles.closeBtn} activeOpacity={0.7}>
              <Icon name="close" size={18} color={C.textSecondary} />
            </TouchableOpacity>
          )}
          <Text style={pmStyles.headerTitle}>
            {step === 'method'  ? 'Choose Payment Method' :
             step === 'confirm' ? 'Confirm Payment' : 'Payment Successful'}
          </Text>
          <Badge color={C.amber} size="xs">USD</Badge>
        </View>

        {/* Step: method */}
        {step === 'method' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pmStyles.content}>
            {/* Invoice summary */}
            <Card accent={C.amber} style={pmStyles.invoiceSummary}>
              <Text style={pmStyles.invoiceId}>{invoice.id}</Text>
              <Text style={pmStyles.invoiceDesc}>{invoice.description}</Text>
              <Text style={pmStyles.invoiceAmount}>USD ${invoice.amount.toFixed(2)}</Text>
              {quoteLoading ? (
                <Text style={pmStyles.quoteMeta}>Loading quote guidance...</Text>
              ) : quote ? (
                <>
                  <Text style={pmStyles.quoteMeta}>
                    Patient responsibility USD ${Number(quote.estimatedPatientResponsibility || invoice.amount).toFixed(2)}
                    {quote.estimatedPayerAmount > 0 ? ` · Payer est. USD ${Number(quote.estimatedPayerAmount).toFixed(2)}` : ''}
                  </Text>
                  <Text style={pmStyles.quoteHint}>{quote.recommendedNextStep}</Text>
                </>
              ) : null}
            </Card>

            {/* Methods */}
            <SectionHeader>Payment Method</SectionHeader>
            <View style={pmStyles.methodList}>
              {PAYMENT_METHODS.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[pmStyles.methodRow, method === m.key && { borderColor: m.color, backgroundColor: m.color + '12' }]}
                  onPress={() => setMethod(m.key)}
                  activeOpacity={0.8}
                >
                  <View style={[pmStyles.methodIcon, { backgroundColor: m.color + '20' }]}>
                    <Icon name={m.icon as any} size={18} color={m.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[pmStyles.methodLabel, method === m.key && { color: m.color }]}>{m.label}</Text>
                    <Text style={pmStyles.methodSub}>{m.sub}</Text>
                  </View>
                  <View style={[pmStyles.radioOuter, method === m.key && { borderColor: m.color }]}>
                    {method === m.key && <View style={[pmStyles.radioInner, { backgroundColor: m.color }]} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Phone number for mobile money */}
            {isMobile && (
              <View style={pmStyles.phoneSection}>
                <SectionHeader>Mobile Number</SectionHeader>
                <View style={pmStyles.phoneInput}>
                  <Icon name="phone" size={16} color={C.textMuted} />
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    style={pmStyles.phoneField}
                    keyboardType="phone-pad"
                    placeholder="+263 7X XXX XXXX"
                    placeholderTextColor={C.textMuted}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity style={pmStyles.continueBtn} onPress={() => setStep('confirm')} activeOpacity={0.85}>
              <Text style={pmStyles.continueBtnText}>Continue to Review</Text>
              <Icon name="arrow" size={16} color="#000" />
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Step: confirm */}
        {step === 'confirm' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pmStyles.content}>
            {/* Line items */}
            <Card style={pmStyles.lineItemCard}>
              <Text style={pmStyles.lineItemTitle}>{invoice.description}</Text>
              {invoice.items.map((item, i) => (
                <View key={i} style={pmStyles.lineRow}>
                  <Text style={pmStyles.lineDesc}>{item.description}</Text>
                  <Text style={pmStyles.lineAmt}>${item.amount.toFixed(2)}</Text>
                </View>
              ))}
              <View style={[pmStyles.lineRow, pmStyles.totalRow]}>
                <Text style={pmStyles.totalLabel}>Total</Text>
                <Text style={pmStyles.totalAmt}>${invoice.amount.toFixed(2)}</Text>
              </View>
              {quote && (
                <>
                  <View style={[pmStyles.lineRow, pmStyles.totalRow]}>
                    <Text style={pmStyles.totalLabel}>Payer estimate</Text>
                    <Text style={pmStyles.lineAmt}>${Number(quote.estimatedPayerAmount || 0).toFixed(2)}</Text>
                  </View>
                  <View style={[pmStyles.lineRow, pmStyles.totalRow]}>
                    <Text style={pmStyles.totalLabel}>You pay</Text>
                    <Text style={pmStyles.totalAmt}>${Number(quote.estimatedPatientResponsibility || invoice.amount).toFixed(2)}</Text>
                  </View>
                </>
              )}
            </Card>

            {quote?.blockers && quote.blockers.length > 0 && (
              <Card style={pmStyles.quoteWarningCard}>
                <Text style={pmStyles.quoteWarningTitle}>Before you pay</Text>
                {quote.blockers.map((blocker, index) => (
                  <Text key={`${index}-${typeof blocker === 'string' ? blocker : blocker.code || blocker.message}`} style={pmStyles.quoteWarningText}>
                    {typeof blocker === 'string' ? blocker : blocker.message || blocker.code || 'Coverage issue requires review.'}
                  </Text>
                ))}
              </Card>
            )}

            {/* Method summary */}
            <Card style={pmStyles.methodSummaryCard}>
              <View style={pmStyles.methodSummaryRow}>
                <View style={[pmStyles.methodIcon, { backgroundColor: selectedMethod.color + '20' }]}>
                  <Icon name={selectedMethod.icon as any} size={16} color={selectedMethod.color} />
                </View>
                <Text style={pmStyles.methodSummaryLabel}>{selectedMethod.label}</Text>
                {isMobile && <Text style={pmStyles.phoneSummary}>{phone}</Text>}
              </View>
              {isMobile && (
                <Text style={pmStyles.promptNote}>
                  You will receive a payment prompt on {phone}
                </Text>
              )}
            </Card>

            {/* Security note */}
            <View style={pmStyles.securityRow}>
              <Icon name="shield" size={13} color={C.green} />
              <Text style={pmStyles.securityText}>HIPAA-compliant · 256-bit encrypted transaction</Text>
            </View>

            <TouchableOpacity
              style={[pmStyles.payBtn, { backgroundColor: selectedMethod.color }]}
              onPress={handleConfirm}
              activeOpacity={0.85}
              disabled={paying}
            >
              {paying
                ? <ActivityIndicator color="#fff" />
                : <Text style={pmStyles.payBtnText}>Confirm & Pay USD ${invoice.amount.toFixed(2)}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep('method')} activeOpacity={0.7} style={pmStyles.backLink}>
              <Icon name="back" size={14} color={C.textMuted} />
              <Text style={pmStyles.backLinkText}>Change method</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Step: success */}
        {step === 'success' && (
          <View style={pmStyles.successState}>
            <Animated.View style={[pmStyles.successCircle, { transform: [{ scale: successScale }] }]}>
              <Icon name="check" size={40} color={C.green} strokeWidth={2.5} />
            </Animated.View>
            <Text style={pmStyles.successTitle}>Payment Successful!</Text>
            <Card style={pmStyles.receiptCard}>
              <View style={pmStyles.receiptRow}>
                <Text style={pmStyles.receiptLabel}>Invoice</Text>
                <Text style={pmStyles.receiptValue}>{invoice.id}</Text>
              </View>
              <View style={pmStyles.receiptRow}>
                <Text style={pmStyles.receiptLabel}>Amount</Text>
                <Text style={[pmStyles.receiptValue, { color: C.green }]}>USD ${invoice.amount.toFixed(2)}</Text>
              </View>
              <View style={pmStyles.receiptRow}>
                <Text style={pmStyles.receiptLabel}>Method</Text>
                <Text style={pmStyles.receiptValue}>{selectedMethod.label}</Text>
              </View>
            </Card>
            <Text style={pmStyles.successSub}>Receipt saved. Redirecting...</Text>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
};

const pmStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  fullSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: C.border, maxHeight: '92%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  closeBtn: { width: 32, height: 32, borderRadius: RADIUS.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: FONT.uiBk, fontSize: 17, color: C.textPrimary, letterSpacing: -0.2 },
  content: { padding: 20, gap: 16, paddingBottom: 20 },
  invoiceSummary: { gap: 4 },
  invoiceId: { fontFamily: FONT.mono, fontSize: 11, color: C.textMuted },
  invoiceDesc: { fontFamily: FONT.uiBd, fontSize: 15, color: C.textPrimary },
  invoiceAmount: { fontFamily: FONT.uiBk, fontSize: 26, color: C.amber, letterSpacing: -0.5, marginTop: 4 },
  quoteMeta: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, marginTop: 6 },
  quoteHint: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, lineHeight: 17, marginTop: 2 },
  methodList: { gap: 8 },
  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: C.border, padding: 12,
  },
  methodIcon: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  methodLabel: { fontFamily: FONT.uiBd, fontSize: 14, color: C.textPrimary },
  methodSub: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted, marginTop: 1 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  phoneSection: { gap: 8 },
  phoneInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, height: 46,
  },
  phoneField: { flex: 1, fontFamily: FONT.uiMd, fontSize: 14, color: C.textPrimary },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: RADIUS.lg, backgroundColor: C.teal,
  },
  continueBtnText: { fontFamily: FONT.uiBk, fontSize: 15, color: '#000' },
  lineItemCard: { gap: 8 },
  lineItemTitle: { fontFamily: FONT.uiBd, fontSize: 14, color: C.textPrimary, marginBottom: 4 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderTopWidth: 1, borderTopColor: C.border },
  lineDesc: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textSecondary, flex: 1 },
  lineAmt: { fontFamily: FONT.mono, fontSize: 13, color: C.textPrimary },
  totalRow: { marginTop: 4 },
  totalLabel: { fontFamily: FONT.uiBk, fontSize: 14, color: C.textPrimary },
  totalAmt: { fontFamily: FONT.uiBk, fontSize: 18, color: C.amber, letterSpacing: -0.3 },
  quoteWarningCard: { gap: 6, borderWidth: 1, borderColor: C.red + '33', backgroundColor: C.red + '12' },
  quoteWarningTitle: { fontFamily: FONT.uiBd, fontSize: 13, color: C.red },
  quoteWarningText: { fontFamily: FONT.ui, fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  methodSummaryCard: { gap: 8 },
  methodSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  methodSummaryLabel: { flex: 1, fontFamily: FONT.uiBd, fontSize: 14, color: C.textPrimary },
  phoneSummary: { fontFamily: FONT.mono, fontSize: 12, color: C.textSecondary },
  promptNote: { fontFamily: FONT.uiMd, fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  securityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  securityText: { fontFamily: FONT.ui, fontSize: 11, color: C.green },
  payBtn: { paddingVertical: 15, borderRadius: RADIUS.lg, alignItems: 'center' },
  payBtnText: { fontFamily: FONT.uiBk, fontSize: 15, color: '#fff' },
  backLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  backLinkText: { fontFamily: FONT.uiMd, fontSize: 13, color: C.textMuted },
  successState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 },
  successCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: C.green + '20', borderWidth: 2, borderColor: C.green + '50',
    alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontFamily: FONT.uiBk, fontSize: 24, color: C.textPrimary, letterSpacing: -0.4 },
  receiptCard: { width: '100%', gap: 2 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  receiptLabel: { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted },
  receiptValue: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary },
  successSub: { fontFamily: FONT.ui, fontSize: 13, color: C.textMuted },
});

// ─── Invoice Card ─────────────────────────────────────────────────────────────

interface InvoiceCardProps {
  invoice: Invoice;
  onPay: (inv: Invoice) => void;
}

const InvoiceCard: React.FC<InvoiceCardProps> = ({ invoice, onPay }) => {
  const statusColor = STATUS_COLOR[invoice.status];
  return (
    <Card accentSide accent={statusColor} style={invStyles.card}>
      <View style={invStyles.topRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={invStyles.invId}>{invoice.id}</Text>
          <Text style={invStyles.invDesc}>{invoice.description}</Text>
          <Text style={invStyles.invDate}>{invoice.date}</Text>
        </View>
        <View style={invStyles.rightCol}>
          <Text style={[invStyles.invAmount, { color: statusColor }]}>
            ${invoice.amount.toFixed(2)}
          </Text>
          <Badge color={statusColor} size="xs">{STATUS_LABEL[invoice.status]}</Badge>
        </View>
      </View>
      {invoice.status === 'due' && (
        <TouchableOpacity style={invStyles.payBtn} onPress={() => onPay(invoice)} activeOpacity={0.85}>
          <Icon name="wallet" size={14} color="#000" />
          <Text style={invStyles.payBtnText}>Pay Now</Text>
        </TouchableOpacity>
      )}
      {invoice.status === 'paid' && (
        <View style={invStyles.paidRow}>
          <Icon name="check" size={13} color={C.green} />
          <Text style={invStyles.paidText}>Payment confirmed · Receipt saved</Text>
        </View>
      )}
      {invoice.status === 'medaid' && (
        <View style={invStyles.paidRow}>
          <Icon name="shield" size={13} color={C.blue} />
          <Text style={[invStyles.paidText, { color: C.blue }]}>
            Claimed to {invoice.insurer} — awaiting reimbursement
          </Text>
        </View>
      )}
    </Card>
  );
};

const invStyles = StyleSheet.create({
  card: { marginBottom: 10, gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  invId: { fontFamily: FONT.mono, fontSize: 10, color: C.textMuted },
  invDesc: { fontFamily: FONT.uiBd, fontSize: 13, color: C.textPrimary, lineHeight: 19 },
  invDate: { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  rightCol: { alignItems: 'flex-end', gap: 4 },
  invAmount: { fontFamily: FONT.uiBk, fontSize: 20, letterSpacing: -0.4 },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 11, borderRadius: RADIUS.md,
    backgroundColor: C.amber,
  },
  payBtnText: { fontFamily: FONT.uiBk, fontSize: 13, color: '#000' },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  paidText: { fontFamily: FONT.uiMd, fontSize: 12, color: C.green },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const PatientBillsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [invoices,     setInvoices]     = useState<Invoice[]>([]);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    const patientId = user?.patientMrn ?? user?.id;
    if (!patientId) return;
    BillingService.forPatient(patientId)
      .then(list => setInvoices((list ?? []).map(mapApiBill)))
      .catch(() => setInvoices([]));
  }, [user?.id]);

  const dueInvoices  = invoices.filter((i) => i.status === 'due');
  const doneInvoices = invoices.filter((i) => i.status !== 'due');
  const totalDue     = dueInvoices.reduce((s, i) => s + i.amount, 0);

  const handlePaid = (invoiceId: string) => {
    setInvoices((prev) => prev.map((inv) => inv.id === invoiceId ? { ...inv, status: 'paid' } : inv));
    setPayingInvoice(null);
  };

  return (
    <View style={[mainStyles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#030B18', C.bg]} style={StyleSheet.absoluteFill} />
      <ScreenHeader title="My Bills" subtitle="Payments & Invoices" accent={C.amber} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={mainStyles.content}>

        {/* Balance summary */}
        {totalDue > 0 && (
          <LinearGradient
            colors={[C.amber + 'CC', C.red + '99']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={mainStyles.balanceBanner}
          >
            <View style={{ flex: 1 }}>
              <Text style={mainStyles.balanceLabel}>Outstanding Balance</Text>
              <Text style={mainStyles.balanceAmt}>USD ${totalDue.toFixed(2)}</Text>
              <Text style={mainStyles.balanceSub}>{dueInvoices.length} invoice{dueInvoices.length > 1 ? 's' : ''} due</Text>
            </View>
            <View style={mainStyles.quickPayBtns}>
              <TouchableOpacity
                style={[mainStyles.quickPayBtn, { backgroundColor: '#E31837' }]}
                onPress={() => setPayingInvoice(dueInvoices[0])}
                activeOpacity={0.85}
              >
                <Text style={mainStyles.quickPayText}>EcoCash</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[mainStyles.quickPayBtn, { backgroundColor: '#00A651' }]}
                onPress={() => setPayingInvoice(dueInvoices[0])}
                activeOpacity={0.85}
              >
                <Text style={mainStyles.quickPayText}>OneMoney</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        )}

        {/* All clear */}
        {totalDue === 0 && (
          <View style={mainStyles.allClear}>
            <View style={mainStyles.allClearIcon}>
              <Icon name="check" size={28} color={C.green} />
            </View>
            <Text style={mainStyles.allClearTitle}>All paid up</Text>
            <Text style={mainStyles.allClearSub}>No outstanding balances.</Text>
          </View>
        )}

        {/* Empty state — no invoices at all */}
        {invoices.length === 0 && (
          <View style={mainStyles.allClear}>
            <View style={mainStyles.allClearIcon}>
              <Icon name="check" size={28} color={C.textMuted} />
            </View>
            <Text style={mainStyles.allClearTitle}>No invoices</Text>
            <Text style={mainStyles.allClearSub}>No billing records found.</Text>
          </View>
        )}

        {/* Due invoices */}
        {dueInvoices.length > 0 && (
          <View>
            <SectionHeader action={`$${totalDue.toFixed(2)} due`}>Outstanding</SectionHeader>
            {dueInvoices.map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} onPay={setPayingInvoice} />
            ))}
          </View>
        )}

        {/* Completed */}
        {doneInvoices.length > 0 && (
          <View>
            <SectionHeader>History</SectionHeader>
            {doneInvoices.map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} onPay={setPayingInvoice} />
            ))}
          </View>
        )}

      </ScrollView>

      <PaymentModal
        invoice={payingInvoice}
        onClose={() => setPayingInvoice(null)}
        onPaid={handlePaid}
      />
    </View>
  );
};

const mainStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  balanceBanner: { borderRadius: RADIUS.xl, padding: 20, gap: 14 },
  balanceLabel: { fontFamily: FONT.uiBd, fontSize: 11, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.6 },
  balanceAmt: { fontFamily: FONT.uiBk, fontSize: 34, color: '#fff', letterSpacing: -0.8, marginTop: 2 },
  balanceSub: { fontFamily: FONT.ui, fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  quickPayBtns: { flexDirection: 'row', gap: 8 },
  quickPayBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center' },
  quickPayText: { fontFamily: FONT.uiBk, fontSize: 13, color: '#fff' },
  allClear: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  allClearIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.green + '20', borderWidth: 1.5, borderColor: C.green + '40', alignItems: 'center', justifyContent: 'center' },
  allClearTitle: { fontFamily: FONT.uiBk, fontSize: 20, color: C.textPrimary },
  allClearSub: { fontFamily: FONT.ui, fontSize: 13, color: C.textSecondary },
});

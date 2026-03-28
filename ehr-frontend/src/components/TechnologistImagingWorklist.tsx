import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Camera,
  ClipboardList,
  Clock,
  Loader2,
  PlayCircle,
  Search,
  ShieldAlert,
  StopCircle,
  Wallet,
  Sparkles,
} from 'lucide-react';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import { formatDateToDDMMYYYY } from '../utils/dateFormatting';

interface ImagingOrder {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_number?: string;
  study_name: string;
  study_type_id: string;
  modality_name?: string;
  order_status: string;
  payment_status: string;
  ordered_at: string;
  scheduled_date?: string;
  priority: string;
  clinical_indication?: string;
  finance_transaction_id?: string | null;
}

interface ImagingStudy {
  id: string;
  imaging_order_id: string;
  patient_name: string;
  study_name: string;
  study_status: string;
  study_date?: string;
  study_time?: string;
}

interface ImagingOrderAiReview {
  id: string;
  appropriatenessStatus: string;
  rationale: string;
  protocolSummary?: {
    contrastRequired?: boolean;
    preparationInstructions?: string | null;
  };
  blockingIssues?: Array<{ code?: string; message?: string }>;
  supportingSignals?: Array<{ code?: string; message?: string }>;
}

interface TechnologistImagingWorklistProps {
  tenantSlug: string;
  token: string;
  currentUser?: { id: string };
}

type QueueView = 'ready' | 'scheduled' | 'active' | 'payment' | 'all';

const defaultDate = () => new Date().toISOString().slice(0, 10);
const defaultTime = () => new Date().toISOString().slice(11, 16);

const TechnologistImagingWorklist: React.FC<TechnologistImagingWorklistProps> = ({
  tenantSlug,
  token,
  currentUser,
}) => {
  const { showError, showSuccess } = useNotification();
  const [orders, setOrders] = useState<ImagingOrder[]>([]);
  const [studies, setStudies] = useState<ImagingStudy[]>([]);
  const [loading, setLoading] = useState(false);

  const [scheduleTarget, setScheduleTarget] = useState<ImagingOrder | null>(null);
  const [scheduleDate, setScheduleDate] = useState(defaultDate());
  const [scheduleTime, setScheduleTime] = useState(defaultTime());

  const [startTarget, setStartTarget] = useState<ImagingOrder | null>(null);
  const [startDate, setStartDate] = useState(defaultDate());
  const [startTime, setStartTime] = useState(defaultTime());

  const [completeTarget, setCompleteTarget] = useState<ImagingStudy | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeQueueView, setActiveQueueView] = useState<QueueView>('ready');
  const [orderReviews, setOrderReviews] = useState<Record<string, ImagingOrderAiReview | null>>({});
  const [reviewLoadingIds, setReviewLoadingIds] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    if (!tenantSlug || !token) return;
    try {
      setLoading(true);
      const [ordersRes, studiesRes] = await Promise.all([
        ehrApi.getImagingOrders(tenantSlug, token, { limit: 100 }),
        ehrApi.getImagingStudies(tenantSlug, token, { status: 'in_progress' }),
      ]);
      setOrders(ordersRes.data.orders || []);
      setStudies(studiesRes.data.studies || []);
    } catch (error) {
      console.error('Failed to load imaging worklist', error);
      showError('Unable to load imaging worklist', 'Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, token, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const awaitingPayment = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.payment_status === 'awaiting_payment' || order.order_status === 'awaiting_payment',
      ),
    [orders],
  );

  const readyToSchedule = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.payment_status !== 'awaiting_payment' &&
          (order.order_status === 'ordered' || order.order_status === 'awaiting_study'),
      ),
    [orders],
  );

  const scheduledOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.payment_status !== 'awaiting_payment' && order.order_status === 'scheduled',
      ),
    [orders],
  );

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const matchesOrderSearch = useCallback(
    (order: ImagingOrder) => {
      if (!normalizedSearchTerm) return true;
      const haystack = [
        order.patient_name,
        order.patient_number,
        order.study_name,
        order.modality_name,
        order.clinical_indication,
        order.order_status,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return haystack.includes(normalizedSearchTerm);
    },
    [normalizedSearchTerm],
  );

  const matchesStudySearch = useCallback(
    (study: ImagingStudy) => {
      if (!normalizedSearchTerm) return true;
      const haystack = [study.patient_name, study.study_name, study.study_status]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return haystack.includes(normalizedSearchTerm);
    },
    [normalizedSearchTerm],
  );

  const filteredAwaitingPayment = useMemo(
    () => awaitingPayment.filter(matchesOrderSearch),
    [awaitingPayment, matchesOrderSearch],
  );

  const filteredReadyToSchedule = useMemo(
    () => readyToSchedule.filter(matchesOrderSearch),
    [readyToSchedule, matchesOrderSearch],
  );

  const filteredScheduledOrders = useMemo(
    () => scheduledOrders.filter(matchesOrderSearch),
    [scheduledOrders, matchesOrderSearch],
  );

  const filteredStudies = useMemo(
    () => studies.filter(matchesStudySearch),
    [matchesStudySearch, studies],
  );

  const handleScheduleSubmit = async () => {
    if (!scheduleTarget) return;
    try {
      const isoDate = `${scheduleDate}T${scheduleTime}:00`;
      await ehrApi.scheduleImagingOrder(tenantSlug, token, scheduleTarget.id, isoDate);
      showSuccess('Order scheduled', `${scheduleTarget.study_name} scheduled successfully.`);
      setScheduleTarget(null);
      await loadData();
    } catch (error) {
      console.error('Failed to schedule order', error);
      showError('Unable to schedule order', 'Please try again.');
    }
  };

  const handleStartStudy = async () => {
    if (!startTarget || !currentUser) return;
    try {
      await ehrApi.createImagingStudy(tenantSlug, token, {
        imaging_order_id: startTarget.id,
        patient_id: startTarget.patient_id,
        study_type_id: startTarget.study_type_id,
        patient_id_fallback: startTarget.patient_id,
        study_date: startDate,
        study_time: startTime,
        technologist: currentUser.id,
        study_description: startTarget.clinical_indication || '',
        technique: '',
        contrast_used: false,
      });
      showSuccess('Study started', `${startTarget.study_name} is now in progress.`);
      setStartTarget(null);
      await loadData();
    } catch (error) {
      console.error('Failed to create study', error);
      showError('Unable to start study', 'Please try again.');
    }
  };

  const handleCompleteStudy = async () => {
    if (!completeTarget) return;
    try {
      await ehrApi.completeImagingStudy(tenantSlug, token, completeTarget.id, {
        completion_notes: completionNotes || undefined,
      });
      showSuccess('Study completed', `${completeTarget.study_name} sent to radiologist queue.`);
      setCompleteTarget(null);
      setCompletionNotes('');
      await loadData();
    } catch (error) {
      console.error('Failed to complete study', error);
      showError('Unable to complete study', 'Please try again.');
    }
  };

  const handlePrepareAiReview = async (orderId: string) => {
    try {
      setReviewLoadingIds((current) => ({ ...current, [orderId]: true }));
      const response = await ehrApi.prepareImagingOrderAiReview(tenantSlug, token, orderId);
      setOrderReviews((current) => ({ ...current, [orderId]: response.data || null }));
      showSuccess('AI protocol ready', 'Radiology appropriateness and protocol review prepared.');
    } catch (error) {
      console.error('Failed to prepare imaging AI review', error);
      showError('Unable to prepare AI review', 'Please try again.');
    } finally {
      setReviewLoadingIds((current) => ({ ...current, [orderId]: false }));
    }
  };

  const renderOrderCard = (order: ImagingOrder, actions: React.ReactNode) => {
    const review = orderReviews[order.id];
    const reviewTone =
      review?.appropriatenessStatus === 'supported'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : review?.appropriatenessStatus === 'acceptable_with_caution'
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-slate-200 bg-slate-50 text-slate-700';
    return (
      <div
        key={order.id}
        className="border border-slate-100 rounded-2xl p-5 bg-white/95 shadow-lg shadow-slate-100/70 hover:shadow-2xl hover:-translate-y-0.5 transition-all"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">Patient</p>
            <p className="text-lg font-semibold text-slate-900">
              {order.patient_name}{' '}
              {order.patient_number && <span className="text-slate-500 text-sm">({order.patient_number})</span>}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
              order.priority === 'stat'
                ? 'bg-gradient-to-r from-rose-500/10 to-rose-500/20 text-rose-700'
                : order.priority === 'urgent'
                ? 'bg-gradient-to-r from-amber-500/10 to-amber-500/20 text-amber-700'
                : 'bg-gradient-to-r from-emerald-500/10 to-emerald-500/20 text-emerald-700'
            }`}
          >
            {order.priority.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600 mb-4">
          {[
            { label: 'Study', value: order.study_name },
            { label: 'Status', value: order.order_status.replace(/_/g, ' '), accent: true },
            {
              label: 'Payment',
              value: order.payment_status.replace(/_/g, ' '),
              accent: order.payment_status === 'awaiting_payment',
            },
            { label: 'Ordered', value: formatDateToDDMMYYYY(order.ordered_at) },
          ].map((item) => (
            <div key={`${order.id}-${item.label}`} className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-400">{item.label}</span>
              <span
                className={`font-medium ${
                  item.accent === true
                    ? 'text-amber-600'
                    : item.accent === false
                    ? 'text-slate-900'
                    : 'text-slate-900'
                }`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {order.clinical_indication && (
          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 mb-3">
            <span className="text-slate-500 uppercase tracking-wide text-[10px] block mb-1">
              Clinical Indication
            </span>
            {order.clinical_indication}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">{actions}</div>

        {review && (
          <div className={`mt-3 rounded-xl border p-3 text-xs ${reviewTone}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold uppercase tracking-wide">
                AI Protocol Review
              </span>
              <span className="rounded-full bg-white/70 px-2 py-1 font-semibold">
                {review.appropriatenessStatus.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="mt-2">{review.rationale}</p>
            {review.protocolSummary?.preparationInstructions && (
              <p className="mt-2">
                Preparation: {review.protocolSummary.preparationInstructions}
              </p>
            )}
            {Array.isArray(review.blockingIssues) && review.blockingIssues.length > 0 && (
              <ul className="mt-2 list-disc list-inside space-y-1">
                {review.blockingIssues.slice(0, 2).map((issue, index) => (
                  <li key={`${order.id}-issue-${index}`}>{issue.message || issue.code}</li>
                ))}
              </ul>
            )}
            {Array.isArray(review.supportingSignals) && review.supportingSignals.length > 0 && (
              <p className="mt-2">
                Key protocol signal: {review.supportingSignals[0].message || review.supportingSignals[0].code}
              </p>
            )}
          </div>
        )}

        {order.payment_status === 'awaiting_payment' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <Wallet className="w-4 h-4" />
            Finance must clear payment before this order can proceed.
          </div>
        )}
      </div>
    );
  };

  const renderStudyCard = (study: ImagingStudy) => (
    <div key={study.id} className="rounded-2xl p-4 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">Patient</p>
          <p className="text-lg font-semibold text-slate-900">{study.patient_name}</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
          {study.study_status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="text-sm text-slate-700">
        <p className="font-medium">{study.study_name}</p>
        <p className="text-slate-500">
          Started {study.study_date ? formatDateToDDMMYYYY(study.study_date) : '—'}{' '}
          {study.study_time?.substring(0, 5) || ''}
        </p>
      </div>

      <button
        onClick={() => setCompleteTarget(study)}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 shadow"
      >
        <StopCircle className="w-4 h-4" />
        Mark Completed
      </button>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: 'Awaiting Payment',
            value: awaitingPayment.length,
            icon: Wallet,
            gradient: 'from-rose-500/15 to-amber-400/10',
            text: 'text-rose-700',
          },
          {
            label: 'Ready to Schedule',
            value: readyToSchedule.length,
            icon: Calendar,
            gradient: 'from-indigo-500/15 to-purple-500/10',
            text: 'text-indigo-700',
          },
          {
            label: 'Active Studies',
            value: studies.length,
            icon: Camera,
            gradient: 'from-emerald-500/15 to-teal-500/10',
            text: 'text-emerald-700',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="relative overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-xl shadow-slate-200"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`} />
            <div className="relative p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{card.label}</p>
                <p className={`text-3xl font-semibold ${card.text}`}>{card.value}</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/70 shadow-inner">
                <card.icon className={`w-6 h-6 ${card.text}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search patient, study, modality, or indication…"
            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'ready', label: 'Ready', count: filteredReadyToSchedule.length },
            { key: 'scheduled', label: 'Scheduled', count: filteredScheduledOrders.length },
            { key: 'active', label: 'In Progress', count: filteredStudies.length },
            { key: 'payment', label: 'Awaiting Payment', count: filteredAwaitingPayment.length },
            {
              key: 'all',
              label: 'All',
              count:
                filteredReadyToSchedule.length +
                filteredScheduledOrders.length +
                filteredStudies.length +
                filteredAwaitingPayment.length,
            },
          ].map((view) => (
            <button
              key={view.key}
              onClick={() => setActiveQueueView(view.key as QueueView)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                activeQueueView === view.key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {view.label} ({view.count})
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading imaging workflow…
        </div>
      )}

      {!loading && (
        <>
          {(activeQueueView === 'ready' || activeQueueView === 'all') && (
          <section className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-500" />
                Ready for Scheduling
              </h3>
              <span className="text-xs px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                {filteredReadyToSchedule.length} orders
              </span>
            </div>
            {filteredReadyToSchedule.length === 0 ? (
              <div className="p-6 bg-white border border-slate-100 rounded-2xl text-center text-slate-500 shadow">
                <p className="flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {searchTerm.trim() ? 'No ready orders match your search.' : 'No orders waiting for scheduling.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredReadyToSchedule.map((order) =>
                  renderOrderCard(
                    order,
                    <>
                      <button
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 text-sm font-semibold hover:bg-sky-100"
                        onClick={() => void handlePrepareAiReview(order.id)}
                        disabled={Boolean(reviewLoadingIds[order.id])}
                      >
                        {reviewLoadingIds[order.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        {orderReviews[order.id] ? 'Refresh AI Protocol' : 'AI Protocol'}
                      </button>
                      <button
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white text-sm font-semibold shadow hover:opacity-95"
                        onClick={() => {
                          setScheduleTarget(order);
                          setScheduleDate(defaultDate());
                          setScheduleTime(defaultTime());
                        }}
                      >
                        <Calendar className="w-4 h-4" />
                        Schedule
                      </button>
                      <button
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-sm font-semibold shadow hover:opacity-95"
                        onClick={() => {
                          setStartTarget(order);
                          setStartDate(defaultDate());
                          setStartTime(defaultTime());
                        }}
                      >
                        <PlayCircle className="w-4 h-4" />
                        Start Study
                      </button>
                    </>,
                  ),
                )}
              </div>
            )}
          </section>
          )}

          {(activeQueueView === 'scheduled' || activeQueueView === 'all') && (
          <section className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-500" />
                Scheduled Orders
              </h3>
              <span className="text-xs px-3 py-1 rounded-full bg-purple-50 text-purple-600 font-medium">
                {filteredScheduledOrders.length} upcoming
              </span>
            </div>
            {filteredScheduledOrders.length === 0 ? (
              <div className="p-6 bg-white border border-slate-100 rounded-2xl text-center text-slate-500 shadow">
                {searchTerm.trim() ? 'No scheduled orders match your search.' : 'No upcoming scheduled appointments.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredScheduledOrders.map((order) =>
                  renderOrderCard(
                    order,
                    <>
                      <button
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 text-sm font-semibold hover:bg-sky-100"
                        onClick={() => void handlePrepareAiReview(order.id)}
                        disabled={Boolean(reviewLoadingIds[order.id])}
                      >
                        {reviewLoadingIds[order.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        {orderReviews[order.id] ? 'Refresh AI Protocol' : 'AI Protocol'}
                      </button>
                      <button
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-sm font-semibold shadow hover:opacity-95"
                        onClick={() => {
                          setStartTarget(order);
                          setStartDate(defaultDate());
                          setStartTime(defaultTime());
                        }}
                      >
                        <PlayCircle className="w-4 h-4" />
                        Start Study
                      </button>
                    </>,
                  ),
                )}
              </div>
            )}
          </section>
          )}

          {(activeQueueView === 'active' || activeQueueView === 'all') && (
          <section className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-500" />
                Studies In Progress
              </h3>
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">
                {filteredStudies.length} scanners busy
              </span>
            </div>
            {filteredStudies.length === 0 ? (
              <div className="p-6 bg-white border border-slate-100 rounded-2xl text-center text-slate-500 shadow">
                {searchTerm.trim() ? 'No active studies match your search.' : 'No active studies at the moment.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filteredStudies.map(renderStudyCard)}</div>
            )}
          </section>
          )}

          {(activeQueueView === 'payment' || activeQueueView === 'all') && filteredAwaitingPayment.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-amber-700 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                Waiting for Payment Clearance
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredAwaitingPayment.map((order) =>
                  renderOrderCard(
                    order,
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
                      Locked until Finance confirms payment
                    </span>,
                  ),
                )}
              </div>
            </section>
          )}
        </>
      )}

      {/* Schedule modal */}
      {scheduleTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h4 className="text-lg font-semibold text-slate-900">Schedule {scheduleTarget.study_name}</h4>
            <div className="space-y-3">
              <label className="text-sm text-slate-600">Scheduled Date</label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
              <label className="text-sm text-slate-600">Scheduled Time</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-lg border" onClick={() => setScheduleTarget(null)}>
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-blue-600 text-white"
                onClick={handleScheduleSubmit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start study modal */}
      {startTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h4 className="text-lg font-semibold text-slate-900">Start {startTarget.study_name}</h4>
            <div className="space-y-3">
              <label className="text-sm text-slate-600">Study Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
              <label className="text-sm text-slate-600">Study Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-lg border" onClick={() => setStartTarget(null)}>
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-purple-600 text-white"
                onClick={handleStartStudy}
              >
                Start Study
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete study modal */}
      {completeTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h4 className="text-lg font-semibold text-slate-900">
              Complete {completeTarget.study_name}
            </h4>
            <label className="text-sm text-slate-600">Technologist Notes (optional)</label>
            <textarea
              rows={4}
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2"
              placeholder="Document contrast usage, complications, etc."
            />
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-lg border" onClick={() => setCompleteTarget(null)}>
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-green-600 text-white"
                onClick={handleCompleteStudy}
              >
                Mark Completed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnologistImagingWorklist;

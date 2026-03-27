import React, { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Inbox, AlertTriangle, Clock, CheckCircle, ChevronDown, ChevronUp,
  FlaskConical, Scan, MessageSquare, Bell, ClipboardList, Send,
  RefreshCw, MailOpen, Filter,
} from 'lucide-react';
import { getSocketOriginFromApiUrl, runtimeUrls } from '../../config/runtime';
import { cdssApi } from '../../services/api';

interface InboxItem {
  id: string;
  userId: string;
  patientId?: string;
  sourceType: string;
  sourceId?: string;
  title: string;
  preview?: string;
  aiPriority: 'critical' | 'urgent' | 'routine' | 'informational' | 'pending_review';
  aiPriorityReason?: string;
  aiDraftReply?: string;
  isRead: boolean;
  isActioned: boolean;
  actionedAt?: string;
  dueBy?: string;
  triageScore?: number;
  createdAt: string;
}

interface Counts { critical: number; urgent: number; routine: number; informational: number; pending_review?: number }

interface SmartInboxProps {
  token: string;
  tenantSlug: string;
  userId: string;
  onCountsChange?: (counts: Counts) => void;
}

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; dot: string }> = {
  critical:      { label: 'Critical',      bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-800',    dot: 'bg-red-500' },
  urgent:        { label: 'Urgent',        bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', dot: 'bg-orange-500' },
  routine:       { label: 'Routine',       bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   dot: 'bg-blue-400' },
  informational: { label: 'Info',          bg: 'bg-slate-50',  border: 'border-slate-200',  text: 'text-slate-700',  dot: 'bg-slate-400' },
  pending_review: { label: '⚠ Needs Triage', bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', dot: 'bg-amber-500' },
};

const SOURCE_ICON: Record<string, React.ReactNode> = {
  lab_result:         <FlaskConical className="w-4 h-4 text-indigo-500" />,
  imaging_result:     <Scan className="w-4 h-4 text-purple-500" />,
  patient_message:    <MessageSquare className="w-4 h-4 text-teal-500" />,
  critical_alert:     <AlertTriangle className="w-4 h-4 text-red-500" />,
  task:               <ClipboardList className="w-4 h-4 text-amber-500" />,
  referral_response:  <Send className="w-4 h-4 text-green-500" />,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SmartInbox: React.FC<SmartInboxProps> = ({ token, tenantSlug, userId, onCountsChange }) => {
  const [items, setItems]             = useState<InboxItem[]>([]);
  const [counts, setCounts]           = useState<Counts>({ critical: 0, urgent: 0, routine: 0, informational: 0 });
  const [loading, setLoading]         = useState(true);
  const [filterPriority, setFilter]   = useState<string>('all');
  const [unreadOnly, setUnreadOnly]   = useState(false);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [replyDraft, setReplyDraft]   = useState<Record<string, string>>({});
  const socketRef = useRef<Socket | null>(null);

  const headers = { 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` };

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, countsRes] = await Promise.all([
        cdssApi.getInbox(token, tenantSlug, { unreadOnly, priority: filterPriority === 'all' ? undefined : filterPriority }),
        cdssApi.getInboxCounts(token, tenantSlug),
      ]);
      setItems(itemsRes.data || []);
      const c = countsRes.data || {};
      const merged: Counts = {
        critical:      c.critical      || 0,
        urgent:        c.urgent        || 0,
        routine:       c.routine       || 0,
        informational: c.informational || 0,
      };
      setCounts(merged);
      onCountsChange?.(merged);
    } catch {
      // swallow
    } finally {
      setLoading(false);
    }
  }, [token, tenantSlug, unreadOnly, filterPriority, onCountsChange]);

  useEffect(() => { loadInbox(); }, [loadInbox]);

  // ── WebSocket ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const origin = getSocketOriginFromApiUrl(runtimeUrls.ehrApi);
    const socket = io(`${origin}/inbox`, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      socket.emit('inbox:subscribe', { userId });
    });

    socket.on('inbox:item', ({ item }: { item: InboxItem }) => {
      setItems((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);
      setCounts((prev) => {
        const next = { ...prev, [item.aiPriority]: (prev[item.aiPriority as keyof Counts] || 0) + 1 };
        onCountsChange?.(next);
        return next;
      });
    });

    socket.on('inbox:counts', (c: Counts) => {
      setCounts(c);
      onCountsChange?.(c);
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [token, userId, onCountsChange]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleMarkRead = async (id: string) => {
    await cdssApi.markInboxRead(id, token, tenantSlug);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, isRead: true } : i));
  };

  const handleAction = async (id: string) => {
    await cdssApi.markInboxActioned(id, token, tenantSlug);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, isActioned: true, isRead: true } : i));
    loadInbox();
  };

  const handleMarkAllRead = async () => {
    await cdssApi.markAllInboxRead(token, tenantSlug);
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
    setCounts({ critical: 0, urgent: 0, routine: 0, informational: 0 });
    onCountsChange?.({ critical: 0, urgent: 0, routine: 0, informational: 0 });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const totalUnread = counts.critical + counts.urgent + counts.routine + counts.informational;
  const displayed = items.filter((i) => {
    if (unreadOnly && i.isRead) return false;
    if (filterPriority !== 'all' && i.aiPriority !== filterPriority) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5 text-indigo-600" />
          <span className="font-semibold text-slate-800 text-sm">Smart Inbox</span>
          {totalUnread > 0 && (
            <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-full text-xs font-bold">{totalUnread}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Priority badges */}
          {counts.critical > 0 && (
            <span className="px-2 py-0.5 bg-red-100 border border-red-300 text-red-700 rounded-full text-xs font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{counts.critical}
            </span>
          )}
          {counts.urgent > 0 && (
            <span className="px-2 py-0.5 bg-orange-100 border border-orange-300 text-orange-700 rounded-full text-xs font-semibold">{counts.urgent} urgent</span>
          )}
          <button onClick={loadInbox} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {totalUnread > 0 && (
            <button onClick={handleMarkAllRead} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded" title="Mark all read">
              <MailOpen className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-white overflow-x-auto">
        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        {(['all', 'critical', 'urgent', 'routine', 'informational'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filterPriority === p
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p === 'all' ? 'All' : PRIORITY_CONFIG[p].label}
            {p !== 'all' && counts[p as keyof Counts] > 0 && (
              <span className="ml-1 font-bold">{counts[p as keyof Counts]}</span>
            )}
          </button>
        ))}
        <button
          onClick={() => setUnreadOnly(!unreadOnly)}
          className={`ml-auto px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
            unreadOnly ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Unread only
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loading && (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}
        {!loading && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-sm gap-2">
            <Inbox className="w-8 h-8" />
            <p>No items{unreadOnly ? ' unread' : ''}{filterPriority !== 'all' ? ` at ${filterPriority} priority` : ''}</p>
          </div>
        )}
        {displayed.map((item) => {
          const cfg = PRIORITY_CONFIG[item.aiPriority] ?? PRIORITY_CONFIG.routine;
          const isOpen = expanded === item.id;

          return (
            <div
              key={item.id}
              className={`transition-colors ${item.isActioned ? 'opacity-50' : ''} ${!item.isRead ? cfg.bg : 'bg-white'}`}
            >
              <div
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 border-l-4 ${cfg.border}`}
                onClick={() => {
                  setExpanded(isOpen ? null : item.id);
                  if (!item.isRead) handleMarkRead(item.id);
                }}
              >
                {/* Source icon */}
                <div className="mt-0.5 shrink-0">
                  {SOURCE_ICON[item.sourceType] ?? <Bell className="w-4 h-4 text-slate-400" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot} ${item.isRead ? 'opacity-0' : ''}`} />
                    <span className={`text-xs font-semibold ${cfg.text} uppercase tracking-wide`}>
                      {cfg.label}
                      {item.triageScore !== undefined && (
                        <span className="ml-1 font-normal text-slate-400">({item.triageScore})</span>
                      )}
                    </span>
                    {item.dueBy && !item.isActioned && (
                      <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-medium">
                        <Clock className="w-2.5 h-2.5" />
                        Due {new Date(item.dueBy).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-slate-400">{timeAgo(item.createdAt)}</span>
                  </div>
                  <p className={`text-sm ${!item.isRead ? 'font-semibold text-slate-900' : 'text-slate-700'} truncate`}>
                    {item.title}
                  </p>
                  {item.preview && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{item.preview}</p>
                  )}
                </div>

                <button className="text-slate-300 mt-1 shrink-0">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-4 pb-4 pt-1 space-y-3 bg-white border-t border-slate-100">
                  {/* AI reasoning */}
                  {item.aiPriorityReason && (
                    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${cfg.bg} border ${cfg.border}`}>
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span><strong>AI says:</strong> {item.aiPriorityReason}</span>
                    </div>
                  )}

                  {/* Full preview */}
                  {item.preview && (
                    <p className="text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                      {item.preview}
                    </p>
                  )}

                  {/* AI draft reply for messages */}
                  {item.aiDraftReply && item.sourceType === 'patient_message' && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1">AI Draft Reply <span className="font-normal text-slate-400">· AI-generated · clinician review required</span></p>
                      <textarea
                        value={replyDraft[item.id] ?? item.aiDraftReply}
                        onChange={(e) => setReplyDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        rows={3}
                        className="w-full text-xs border border-indigo-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!item.isActioned && (
                      <button
                        onClick={() => handleAction(item.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Mark Actioned
                      </button>
                    )}
                    {item.isActioned && (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Actioned
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SmartInbox;

import React, { useState } from 'react';
import { api } from '../services/api';

interface InboxMessage {
  id: string;
  content: string;
  sender_name: string;
  created_at: string;
  urgency?: string;
  reply_draft?: string;
  translated_content?: string;
  detected_language?: string;
  draft_sent?: boolean;
}

interface Props {
  message: InboxMessage;
  onReplied?: () => void;
}

const URGENCY_COLORS: Record<string, string> = {
  urgent: '#dc2626',
  follow_up: '#2563eb',
  administrative: '#9ca3af',
  routine: '#16a34a',
};

export const MessageInboxItem: React.FC<Props> = ({ message, onReplied }) => {
  const [showDraft, setShowDraft] = useState(false);
  const [editedReply, setEditedReply] = useState(message.reply_draft ?? '');
  const [sent, setSent] = useState(message.draft_sent ?? false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [sending, setSending] = useState(false);

  const urgencyColor = URGENCY_COLORS[message.urgency ?? 'routine'];

  const sendReply = async () => {
    setSending(true);
    try {
      await api.post(`/messages/${message.id}/approve-draft`, { editedContent: editedReply });
      setSent(true);
      onReplied?.();
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderLeft: `4px solid ${urgencyColor}`,
      borderRadius: 8,
      padding: 16,
      marginBottom: 8,
      backgroundColor: '#fff',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{message.sender_name}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {message.urgency && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
              backgroundColor: urgencyColor + '20',
              color: urgencyColor,
            }}>
              {message.urgency.toUpperCase().replace('_', '-')}
            </span>
          )}
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            {new Date(message.created_at).toLocaleString()}
          </span>
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#374151', margin: '0 0 8px 0' }}>
        {message.content}
      </p>

      {message.translated_content && (
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={() => setShowTranslation(!showTranslation)}
            style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {showTranslation
              ? '▲ Hide translation'
              : `▼ Show translation (${message.detected_language ?? 'detected'})`}
          </button>
          {showTranslation && (
            <p style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic', marginTop: 4 }}>
              {message.translated_content}
            </p>
          )}
        </div>
      )}

      {!sent && message.reply_draft && (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => setShowDraft(!showDraft)}
            style={{ fontSize: 12, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            {showDraft ? '▲ Hide AI Draft' : '▼ View AI Draft Reply'}
          </button>
          {showDraft && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                AI suggests — you send
              </div>
              <textarea
                value={editedReply}
                onChange={(e) => setEditedReply(e.target.value)}
                rows={4}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
              />
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button
                  onClick={sendReply}
                  disabled={sending}
                  style={{
                    padding: '6px 16px', backgroundColor: '#7c3aed', color: 'white',
                    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                    opacity: sending ? 0.6 : 1,
                  }}
                >
                  {sending ? 'Sending...' : 'Send Reply'}
                </button>
                <button
                  onClick={() => setShowDraft(false)}
                  style={{ padding: '6px 16px', backgroundColor: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {sent && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
          ✓ Reply sent
        </div>
      )}
    </div>
  );
};

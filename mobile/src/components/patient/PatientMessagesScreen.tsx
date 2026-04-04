import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Card, ScreenHeader, Badge } from '../ui';
import { MessagesService, ApiMessage } from '../../services/messages';

type ThreadMessage = {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
  isRead: boolean;
};

type Conversation = {
  id: string;
  counterpartId?: string;
  counterpartType?: string;
  name: string;
  role: string;
  initials: string;
  unread: number;
  subject?: string;
  lastMessage: string;
  lastTime: string;
  messages: ThreadMessage[];
};

function getInitials(label: string): string {
  return label
    .split(' ')
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function labelForType(type?: string): { name: string; role: string } {
  if (type === 'doctor') return { name: 'Doctor', role: 'Care Team' };
  if (type === 'staff') return { name: 'Clinic Staff', role: 'Support Desk' };
  if (type === 'system') return { name: 'Medicore', role: 'System Message' };
  return { name: 'Care Team', role: 'Secure Messaging' };
}

function formatRelativeTime(timestamp?: string): string {
  if (!timestamp) return 'Now';
  const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (diffMinutes < 1) return 'Now';
  if (diffMinutes < 60) return `${diffMinutes} min`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hr`;
  return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function mapInboxToConversations(messages: ApiMessage[]): Conversation[] {
  const grouped = new Map<string, ApiMessage[]>();

  for (const message of messages ?? []) {
    const isOwn = message.senderRole === 'patient' || !message.senderRole;
    const counterpartId = isOwn ? message.recipientId : message.senderId;
    const counterpartType = isOwn ? undefined : message.senderRole;
    const groupingKey = message.threadId ?? counterpartId ?? message.id;
    const list = grouped.get(groupingKey) ?? [];
    list.push(message);
    grouped.set(groupingKey, list);
  }

  return Array.from(grouped.entries())
    .map(([key, threadMessages]) => {
      const sorted = [...threadMessages].sort(
        (a, b) => new Date(a.sentAt ?? 0).getTime() - new Date(b.sentAt ?? 0).getTime(),
      );
      const latest = sorted[sorted.length - 1];
      const inbound = [...sorted].reverse().find(message => message.senderRole && message.senderRole !== 'patient');
      const outbound = [...sorted].reverse().find(message => !message.senderRole || message.senderRole === 'patient');
      const counterpartType = inbound?.senderRole ?? 'staff';
      const counterpartId = inbound?.senderId ?? outbound?.recipientId;
      const labels = labelForType(counterpartType);
      const unread = sorted.filter(message => message.senderRole !== 'patient' && !message.isRead).length;

      return {
        id: key,
        counterpartId,
        counterpartType,
        name: labels.name,
        role: labels.role,
        initials: getInitials(labels.name),
        unread,
        subject: latest.subject,
        lastMessage: latest.body,
        lastTime: formatRelativeTime(latest.sentAt),
        messages: sorted.map(message => ({
          id: message.id,
          from: (message.senderRole === 'patient' || !message.senderRole ? 'me' : 'them') as 'me' | 'them',
          text: message.body,
          time: new Date(message.sentAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          isRead: !!message.isRead,
        })),
      };
    })
    .sort((a, b) => {
      const aLatest = a.messages[a.messages.length - 1];
      const bLatest = b.messages[b.messages.length - 1];
      return new Date(`1970-01-01T${bLatest?.time ?? '00:00'}:00Z`).getTime()
        - new Date(`1970-01-01T${aLatest?.time ?? '00:00'}:00Z`).getTime();
    });
}

const Avatar: React.FC<{ initials: string }> = ({ initials }) => (
  <View style={styles.avatar}>
    <Text style={styles.avatarText}>{initials}</Text>
  </View>
);

const ThreadView: React.FC<{
  conversation: Conversation;
  onBack: () => void;
}> = ({ conversation, onBack }) => {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState(conversation.messages);
  const listRef = useRef<FlatList>(null);

  const send = async () => {
    const body = text.trim();
    if (!body || !conversation.counterpartId || !conversation.counterpartType) return;

    const optimistic: ThreadMessage = {
      id: `temp-${Date.now()}`,
      from: 'me',
      text: body,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
    };

    setMessages(prev => [...prev, optimistic]);
    setText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      await MessagesService.patientSend({
        recipientId: conversation.counterpartId,
        recipientType: conversation.counterpartType,
        subject: conversation.subject,
        body,
      });
    } catch {
      setMessages(prev => prev.filter(message => message.id !== optimistic.id));
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title={conversation.name}
        subtitle={conversation.role}
        onBack={onBack}
      />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.threadList}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMe = item.from === 'me';
          return (
            <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
              {!isMe && <Avatar initials={conversation.initials} />}
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
                <View style={styles.bubbleMeta}>
                  <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>{item.time}</Text>
                  {isMe ? <Text style={styles.readReceipt}>{item.isRead ? '✓✓' : '✓'}</Text> : null}
                </View>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.composeBar}>
        <TextInput
          style={styles.composeInput}
          placeholder="Write a secure reply…"
          placeholderTextColor={C.textMuted}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          onPress={send}
          disabled={!text.trim()}
        >
          <Icon name="sparkle" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

interface PatientMessagesScreenProps {
  navigation?: any;
}

export const PatientMessagesScreen: React.FC<PatientMessagesScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const result = await MessagesService.patientInbox({ limit: '100' });
      setMessages(result.messages ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const conversations = useMemo(() => mapInboxToConversations(messages), [messages]);

  const openConversation = async (conversation: Conversation) => {
    setActiveConversation(conversation);

    const unreadIds = messages
      .filter(message =>
        (message.threadId ?? message.senderId ?? message.id) === conversation.id &&
        message.senderRole !== 'patient' &&
        !message.isRead,
      )
      .map(message => message.id);

    for (const id of unreadIds) {
      MessagesService.patientMarkRead(id).catch(() => {});
    }

    if (unreadIds.length > 0) {
      setMessages(prev =>
        prev.map(message =>
          unreadIds.includes(message.id) ? { ...message, isRead: true } : message,
        ),
      );
    }
  };

  if (activeConversation) {
    return <ThreadView conversation={activeConversation} onBack={() => setActiveConversation(null)} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Messages"
        subtitle="Patient Inbox"
        onBack={() => navigation?.goBack?.()}
        rightSlot={<Badge color={C.teal}>{conversations.length}</Badge>}
      />

      {loading ? (
        <View style={styles.centerState}>
          <Text style={styles.loadingText}>Loading secure messages…</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.teal} />}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Icon name="chat" size={34} color={C.textMuted} />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyBody}>
                Messages from your doctor, clinic staff, and care team will appear here.
              </Text>
            </Card>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.conversationRow} onPress={() => openConversation(item)} activeOpacity={0.85}>
              <Avatar initials={item.initials} />
              <View style={styles.conversationMeta}>
                <View style={styles.conversationTop}>
                  <Text style={[styles.conversationName, item.unread > 0 && styles.conversationNameUnread]}>
                    {item.name}
                  </Text>
                  <Text style={styles.conversationTime}>{item.lastTime}</Text>
                </View>
                <Text style={styles.conversationRole}>{item.role}</Text>
                <Text style={[styles.conversationPreview, item.unread > 0 && styles.conversationPreviewUnread]} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>
              {item.unread > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{item.unread}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontFamily: FONT.ui,
    fontSize: 14,
    color: C.textMuted,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: FONT.uiBd,
    fontSize: 16,
    color: C.text,
  },
  emptyBody: {
    fontFamily: FONT.ui,
    fontSize: 13,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  conversationRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    ...SHADOW.card,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.teal + '24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONT.uiBd,
    fontSize: 13,
    color: C.teal,
  },
  conversationMeta: {
    flex: 1,
    gap: 2,
  },
  conversationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  conversationName: {
    flex: 1,
    fontFamily: FONT.uiBd,
    fontSize: 14,
    color: C.text,
  },
  conversationNameUnread: {
    color: C.textPrimary,
  },
  conversationTime: {
    fontFamily: FONT.ui,
    fontSize: 11,
    color: C.textMuted,
  },
  conversationRole: {
    fontFamily: FONT.ui,
    fontSize: 11,
    color: C.teal,
  },
  conversationPreview: {
    fontFamily: FONT.ui,
    fontSize: 12,
    color: C.textMuted,
  },
  conversationPreviewUnread: {
    color: C.text,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontFamily: FONT.uiBd,
    fontSize: 11,
    color: '#fff',
  },
  threadList: {
    padding: 16,
    gap: 10,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    gap: 4,
  },
  bubbleThem: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  bubbleMe: {
    backgroundColor: C.teal,
  },
  bubbleText: {
    fontFamily: FONT.ui,
    fontSize: 14,
    color: C.text,
    lineHeight: 20,
  },
  bubbleTextMe: {
    color: '#fff',
  },
  bubbleMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  bubbleTime: {
    fontFamily: FONT.ui,
    fontSize: 10,
    color: C.textMuted,
  },
  bubbleTimeMe: {
    color: 'rgba(255,255,255,0.8)',
  },
  readReceipt: {
    fontFamily: FONT.uiBd,
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
  },
  composeBar: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  composeInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FONT.ui,
    fontSize: 14,
    color: C.text,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});

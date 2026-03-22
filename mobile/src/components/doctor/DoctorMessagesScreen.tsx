import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ScrollView, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens';
import { Icon, Card, AiBadge, Badge } from '../ui';
import { NotificationCentre } from '../shared/NotificationCentre';
import { MessagesService } from '../../services/messages';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubTab  = 'direct' | 'groups';
type MsgType = 'text' | 'voice' | 'attachment';

interface Message {
  id: string;
  from: 'me' | 'them';
  type: MsgType;
  text: string;
  time: string;
  read: boolean;
}

interface Conversation {
  id: string;
  name: string;
  role: string;
  avatar: string;
  online: boolean;
  unread: number;
  lastMessage: string;
  lastTime: string;
  messages: Message[];
}

interface Group {
  id: string;
  name: string;
  members: string;
  unread: number;
  lastMessage: string;
  lastTime: string;
  accent: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const CONVERSATIONS: Conversation[] = [
  {
    id: 'c1', name: 'Nurse Amai Dube', role: 'Senior Nurse · Ward C', avatar: 'AD',
    online: true, unread: 2, lastMessage: 'Patient asking about discharge timing.',
    lastTime: '14 min',
    messages: [
      { id: 'm1', from: 'them', type: 'text', text: 'Good morning Doctor. A patient is asking about his estimated discharge date.', time: '08:12', read: true },
      { id: 'm2', from: 'me',   type: 'text', text: 'Aiming for Friday if troponin stays flat. I\'ll speak to him during rounds.', time: '08:15', read: true },
      { id: 'm3', from: 'them', type: 'text', text: 'Thank you. Also, his SpO₂ has been 97–99% since 06:00. Looking stable.', time: '08:18', read: true },
      { id: 'm4', from: 'them', type: 'text', text: 'Patient asking about discharge timing. Can you advise?', time: '09:41', read: false },
      { id: 'm5', from: 'them', type: 'voice', text: '🎙 Voice memo  0:18', time: '09:42', read: false },
    ],
  },
  {
    id: 'c2', name: 'Dr. B. Moyo', role: 'Cardiology · Specialist', avatar: 'BM',
    online: false, unread: 1, lastMessage: 'Echo report for Thomas Ndlovu ready.',
    lastTime: '32 min',
    messages: [
      { id: 'm1', from: 'them', type: 'text',       text: 'Tinashe, just completed Thomas Ndlovu\'s echo. Significant LV dysfunction — EF 35%. Recommend urgent Cardiology review.',   time: '09:23', read: false },
      { id: 'm2', from: 'them', type: 'attachment', text: '📎 Echo_Report_Ndlovu_TN_210326.pdf  ·  348 KB', time: '09:23', read: false },
    ],
  },
  {
    id: 'c3', name: 'Nurse Takudzwa Phiri', role: 'Nurse · Ward B', avatar: 'TP',
    online: true, unread: 0, lastMessage: 'Amelia Chen moved to step-down.',
    lastTime: '1 hr',
    messages: [
      { id: 'm1', from: 'me',   type: 'text', text: 'How is Amelia doing post-IV antibiotics?', time: '07:50', read: true },
      { id: 'm2', from: 'them', type: 'text', text: 'Temp now 37.2°C, WBC trending down. She\'s responding well.', time: '07:55', read: true },
      { id: 'm3', from: 'them', type: 'text', text: 'Amelia Chen vitals stable. Moved to step-down.', time: '08:42', read: true },
    ],
  },
  {
    id: 'c4', name: 'Dr. P. Zungu', role: 'Night Registrar · Handover', avatar: 'PZ',
    online: false, unread: 0, lastMessage: 'Overnight summary attached.',
    lastTime: '6 hr',
    messages: [
      { id: 'm1', from: 'them', type: 'attachment', text: '📎 Overnight_Handover_2026-03-22.pdf  ·  88 KB', time: '02:00', read: true },
      { id: 'm2', from: 'them', type: 'text',       text: 'Quiet night overall. Samuel Park had one desaturation at 02:15 — resolved with repositioning. Keep an eye on him.',       time: '02:01', read: true },
    ],
  },
  {
    id: 'c5', name: 'Fatima Al-Rashid', role: 'Patient · Ward A Rm 204', avatar: 'FA',
    online: false, unread: 0, lastMessage: 'Thank you for explaining, doctor.',
    lastTime: 'Yesterday',
    messages: [
      { id: 'm1', from: 'them', type: 'text', text: 'Doctor, will I need the BP medication long-term?', time: '15:30', read: true },
      { id: 'm2', from: 'me',   type: 'text', text: 'Fatima, yes for now. We will reassess at your follow-up in 6 weeks. Your BP is responding well.', time: '15:44', read: true },
      { id: 'm3', from: 'them', type: 'text', text: 'Thank you for explaining, doctor.', time: '15:45', read: true },
    ],
  },
];

const GROUPS: Group[] = [
  { id: 'g1', name: 'Ward C Care Team',      members: '8 members',  unread: 4, lastMessage: '[Nurse Dube] Samuel Park IV site looks inflamed.',  lastTime: '5 min',  accent: C.teal   },
  { id: 'g2', name: 'Cardiac Consult Group', members: '5 members',  unread: 1, lastMessage: '[Dr. Moyo] New STEMI protocol uploaded.',            lastTime: '2 hr',   accent: C.red    },
  { id: 'g3', name: 'Daily Huddle — Morning',members: '12 members', unread: 0, lastMessage: '[Dr. Zungu] Handover complete. Good morning all.',   lastTime: 'Yesterday', accent: C.blue },
  { id: 'g4', name: 'Lab Alerts Channel',    members: 'Broadcast',  unread: 3, lastMessage: '[MediCore Labs] 4 results ready for review.',        lastTime: '1 hr',   accent: C.amber  },
];

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapInboxToConversations(msgs: any[]): Conversation[] {
  if (!msgs?.length) return [];
  const byThread: Record<string, any[]> = {};
  msgs.forEach((m: any) => {
    const key = m.threadId ?? m.senderId ?? String(m.id);
    if (!byThread[key]) byThread[key] = [];
    byThread[key].push(m);
  });
  const now = Date.now();
  return Object.entries(byThread).map(([key, threadMsgs]) => {
    const sorted = [...threadMsgs].sort((a, b) =>
      new Date(a.sentAt ?? a.createdAt ?? 0).getTime() - new Date(b.sentAt ?? b.createdAt ?? 0).getTime()
    );
    const latest = sorted[sorted.length - 1];
    const other = sorted.find((m: any) => m.senderId) ?? latest;
    const senderName: string = other.senderName ?? other.senderDisplayName ?? other.senderId ?? 'Unknown';
    const initials = senderName.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
    const unread = sorted.filter((m: any) => !m.isRead && !m.readAt).length;
    const ts = latest.sentAt ?? latest.createdAt;
    const diffMin = ts ? Math.floor((now - new Date(ts).getTime()) / 60000) : 0;
    const lastTime = diffMin < 60 ? `${diffMin} min` : diffMin < 1440 ? `${Math.floor(diffMin / 60)} hr` : 'Yesterday';
    return {
      id: key,
      name: senderName,
      role: other.senderRole ?? '',
      avatar: initials || 'U',
      online: false,
      unread,
      lastMessage: latest.body ?? '',
      lastTime,
      messages: sorted.map((m: any) => ({
        id: String(m.id ?? Math.random()),
        from: (m.isOwn ? 'me' : 'them') as 'me' | 'them',
        type: (m.attachments?.length ? 'attachment' : 'text') as MsgType,
        text: m.body ?? '',
        time: (m.sentAt ?? m.createdAt)
          ? new Date(m.sentAt ?? m.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          : '--:--',
        read: !!(m.isRead ?? m.readAt),
      })),
    };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const AvatarCircle: React.FC<{ initials: string; online: boolean; size?: number }> = ({ initials, online, size = 42 }) => (
  <View style={{ width: size, height: size }}>
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
    {online && <View style={styles.onlineDot} />}
  </View>
);

// ─── Thread view ──────────────────────────────────────────────────────────────

const ThreadView: React.FC<{ convo: Conversation; onBack: () => void }> = ({ convo, onBack }) => {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState(convo.messages);
  const flatRef = useRef<FlatList>(null);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    const newMsg: Message = {
      id: `m${Date.now()}`, from: 'me', type: 'text',
      text: body, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setMessages(prev => [...prev, newMsg]);
    setText('');
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    MessagesService.send({ recipient_id: convo.id, body }).catch(() => {});
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      {/* Thread header */}
      <View style={styles.threadHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="rounds" size={18} color={C.blue} />
        </TouchableOpacity>
        <AvatarCircle initials={convo.avatar} online={convo.online} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={styles.threadName}>{convo.name}</Text>
          <Text style={styles.threadRole}>{convo.role}  ·  {convo.online ? 'Online' : 'Offline'}</Text>
        </View>
        <TouchableOpacity style={styles.threadAction}>
          <Icon name="escalate" size={16} color={C.textMuted} />
        </TouchableOpacity>
      </View>

      {/* HIPAA banner */}
      <View style={styles.hipaaBar}>
        <Icon name="sparkle" size={10} color={C.green} />
        <Text style={styles.hipaaText}>End-to-end encrypted  ·  HIPAA compliant  ·  Audit logged</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.messageList}
        onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item: msg }) => {
          const isMe = msg.from === 'me';
          return (
            <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
              {!isMe && <AvatarCircle initials={convo.avatar} online={false} size={28} />}
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem,
                msg.type === 'attachment' && styles.bubbleAttachment,
              ]}>
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe,
                  msg.type === 'voice' && styles.bubbleVoice,
                  msg.type === 'attachment' && styles.bubbleAttachText,
                ]}>
                  {msg.text}
                </Text>
                <View style={styles.bubbleMeta}>
                  <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>{msg.time}</Text>
                  {isMe && <Text style={styles.readReceipt}>{msg.read ? '✓✓' : '✓'}</Text>}
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Compose */}
      <View style={styles.compose}>
        <TouchableOpacity style={styles.composeAction}>
          <Icon name="escalate" size={18} color={C.textMuted} />
        </TouchableOpacity>
        <TextInput
          style={styles.composeInput}
          placeholder="Secure message…"
          placeholderTextColor={C.textMuted}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={styles.composeAction}>
          <Icon name="brain" size={18} color={C.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sendBtn, { opacity: text.trim() ? 1 : 0.4 }]}
          onPress={send}
          disabled={!text.trim()}
        >
          <Icon name="sparkle" size={16} color={C.bg} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─── Conversation list ────────────────────────────────────────────────────────

const DirectTab: React.FC<{ onOpen: (c: Conversation) => void; conversations: Conversation[] }> = ({ onOpen, conversations }) => {
  const [search, setSearch] = useState('');
  const filtered = conversations.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.role.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchWrap}>
        <Icon name="rounds" size={15} color={C.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations…"
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={c => c.id}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item: c }) => (
          <TouchableOpacity style={styles.convoRow} onPress={() => onOpen(c)} activeOpacity={0.82}>
            <AvatarCircle initials={c.avatar} online={c.online} />
            <View style={styles.convoMeta}>
              <View style={styles.convoTopRow}>
                <Text style={[styles.convoName, c.unread > 0 && styles.convoNameUnread]}>{c.name}</Text>
                <Text style={styles.convoTime}>{c.lastTime}</Text>
              </View>
              <Text style={styles.convoRole}>{c.role}</Text>
              <Text style={[styles.convoLast, c.unread > 0 && styles.convoLastUnread]} numberOfLines={1}>{c.lastMessage}</Text>
            </View>
            {c.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{c.unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const GroupsTab: React.FC = () => (
  <FlatList
    data={GROUPS}
    keyExtractor={g => g.id}
    contentContainerStyle={{ padding: 14, paddingBottom: 32, gap: 10 }}
    renderItem={({ item: g }) => (
      <TouchableOpacity activeOpacity={0.85}>
        <Card style={[styles.groupCard, { borderLeftColor: g.accent, borderLeftWidth: 3 }]}>
          <View style={styles.groupRow}>
            <View style={[styles.groupIcon, { backgroundColor: g.accent + '22' }]}>
              <Icon name="chat" size={16} color={g.accent} />
            </View>
            <View style={styles.groupMeta}>
              <View style={styles.groupTopRow}>
                <Text style={[styles.groupName, g.unread > 0 && styles.groupNameUnread]}>{g.name}</Text>
                <Text style={styles.groupTime}>{g.lastTime}</Text>
              </View>
              <Text style={styles.groupMembers}>{g.members}</Text>
              <Text style={styles.groupLast} numberOfLines={1}>{g.lastMessage}</Text>
            </View>
            {g.unread > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: g.accent }]}>
                <Text style={styles.unreadBadgeText}>{g.unread}</Text>
              </View>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    )}
  />
);

// ─── Main screen ──────────────────────────────────────────────────────────────

export const DoctorMessagesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [tab, setTab]           = useState<SubTab>('direct');
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [notifVisible, setNotifVisible] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const loadInbox = useCallback(() => {
    MessagesService.inbox({}).then(msgs => {
      const mapped = mapInboxToConversations(msgs ?? []);
      if (mapped.length > 0) setConversations(mapped);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadInbox(); }, [loadInbox]);

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0) + GROUPS.reduce((s, g) => s + g.unread, 0);

  if (activeConvo) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <ThreadView convo={activeConvo} onBack={() => setActiveConvo(null)} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={['#030B18', C.bg]} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Messages</Text>
            <View style={styles.hipaaHeaderRow}>
              <Icon name="sparkle" size={11} color={C.green} />
              <Text style={styles.hipaaHeaderText}>HIPAA Secure</Text>
            </View>
          </View>
          <AiBadge text="S116" />
          <TouchableOpacity style={styles.notifBtn} onPress={() => setNotifVisible(true)}>
            <Icon name="escalate" size={20} color={C.blue} />
            {totalUnread > 0 && (
              <View style={styles.notifDot}>
                <Text style={styles.notifDotText}>{totalUnread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Sub-tab bar */}
        <View style={styles.tabRow}>
          {(['direct', 'groups'] as SubTab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'direct' ? 'Direct' : 'Groups & Channels'}
              </Text>
              {t === 'direct' && conversations.some(c => c.unread > 0) && <View style={styles.tabDot} />}
              {t === 'groups' && GROUPS.some(g => g.unread) && <View style={styles.tabDot} />}
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {tab === 'direct'
        ? <DirectTab onOpen={setActiveConvo} conversations={conversations} />
        : <GroupsTab />
      }

      <NotificationCentre visible={notifVisible} onClose={() => setNotifVisible(false)} />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingBottom: 0 },

  headerRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, paddingBottom: 10 },
  headerTitle:     { fontFamily: FONT.uiBk, fontSize: 22, color: C.text, letterSpacing: -0.4 },
  hipaaHeaderRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  hipaaHeaderText: { fontFamily: FONT.uiBd, fontSize: 10, color: C.green, letterSpacing: 0.3 },
  notifBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  notifDot:        { position: 'absolute', top: 0, right: 0, backgroundColor: C.red, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notifDotText:    { fontFamily: FONT.uiBd, fontSize: 9, color: '#fff' },

  tabRow:        { flexDirection: 'row', gap: 4, paddingBottom: 0 },
  tab:           { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: C.blue },
  tabText:       { fontFamily: FONT.uiBd, fontSize: 13, color: C.textMuted },
  tabTextActive: { color: C.blue },
  tabDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: C.red },

  // Search
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 14, backgroundColor: C.surface2, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontFamily: FONT.ui, fontSize: 13, color: C.text },

  // Convo list
  separator:         { height: 1, backgroundColor: C.border, marginLeft: 66 },
  convoRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  convoMeta:         { flex: 1, gap: 2 },
  convoTopRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convoName:         { fontFamily: FONT.uiBd, fontSize: 14, color: C.textMuted },
  convoNameUnread:   { color: C.text },
  convoRole:         { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  convoLast:         { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted },
  convoLastUnread:   { color: C.text },
  convoTime:         { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  unreadBadge:       { backgroundColor: C.blue, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadBadgeText:   { fontFamily: FONT.uiBd, fontSize: 10, color: '#fff' },

  // Avatar
  avatar:     { backgroundColor: C.blue + '33', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONT.uiBk, color: C.blue },
  onlineDot:  { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: C.green, borderWidth: 1.5, borderColor: C.bg },

  // Groups
  groupCard:    {},
  groupRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  groupIcon:    { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  groupMeta:    { flex: 1, gap: 2 },
  groupTopRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupName:    { fontFamily: FONT.uiBd, fontSize: 13, color: C.textMuted },
  groupNameUnread: { color: C.text },
  groupMembers: { fontFamily: FONT.ui, fontSize: 10, color: C.textMuted },
  groupLast:    { fontFamily: FONT.ui, fontSize: 12, color: C.textMuted },
  groupTime:    { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },

  // Thread
  threadHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  backBtn:       { width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  threadName:    { fontFamily: FONT.uiBd, fontSize: 14, color: C.text },
  threadRole:    { fontFamily: FONT.ui, fontSize: 11, color: C.textMuted },
  threadAction:  { width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },

  hipaaBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 6, backgroundColor: C.green + '12', borderBottomWidth: 1, borderBottomColor: C.green + '22' },
  hipaaText: { fontFamily: FONT.ui, fontSize: 10, color: C.green, letterSpacing: 0.3 },

  messageList: { padding: 14, gap: 10, flexGrow: 1 },

  msgRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },

  bubble:           { maxWidth: '75%', borderRadius: RADIUS.lg, padding: 10, gap: 4 },
  bubbleMe:         { backgroundColor: C.blue, borderBottomRightRadius: 4 },
  bubbleThem:       { backgroundColor: C.surface2, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
  bubbleAttachment: { borderStyle: 'dashed', borderWidth: 1, borderColor: C.blue + '55', backgroundColor: C.blue + '12' },
  bubbleText:       { fontFamily: FONT.ui, fontSize: 13, color: C.text, lineHeight: 19 },
  bubbleTextMe:     { color: '#fff' },
  bubbleVoice:      { fontFamily: FONT.mono, fontSize: 13 },
  bubbleAttachText: { fontFamily: FONT.uiBd, fontSize: 12, color: C.blue },
  bubbleMeta:       { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  bubbleTime:       { fontFamily: FONT.ui, fontSize: 9, color: C.textMuted },
  bubbleTimeMe:     { color: 'rgba(255,255,255,0.6)' },
  readReceipt:      { fontFamily: FONT.uiBd, fontSize: 10, color: 'rgba(255,255,255,0.7)' },

  compose:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  composeAction: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  composeInput:  { flex: 1, fontFamily: FONT.ui, fontSize: 13, color: C.text, backgroundColor: C.surface2, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, maxHeight: 100, borderWidth: 1, borderColor: C.border },
  sendBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
});

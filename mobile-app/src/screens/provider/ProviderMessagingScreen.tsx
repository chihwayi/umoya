import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import messagingService from '../../services/messaging.service';
import { format } from 'date-fns';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';

interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  recipientId: string;
  recipientName?: string;
  subject: string;
  messageText: string;
  messageType?: string;
  priority?: string;
  status: string;
  isRead?: boolean;
  sentAt: string;
  createdAt: string;
  threadId?: string;
  patientId?: string;
}

const ProviderMessagingScreen: React.FC = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'archived'>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadMessages();
    loadUnreadCount();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      let messages: Message[] = [];

      if (activeTab === 'inbox') {
        messages = await messagingService.getInbox({ limit: 50 });
      } else if (activeTab === 'sent') {
        messages = await messagingService.getSentMessages({ limit: 50 });
      } else {
        messages = await messagingService.getInbox({ status: 'archived', limit: 50 });
      }

      setMessages(messages);
    } catch (error: any) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', error.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const count = await messagingService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMessages();
    await loadUnreadCount();
    setRefreshing(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadMessages();
      return;
    }

    try {
      setLoading(true);
      const messages = await messagingService.searchMessages(searchQuery);
      setMessages(messages);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMessagePress = async (message: Message) => {
    try {
      if (message.status === 'sent' || message.status === 'delivered') {
        await messagingService.markAsRead(message.id);
        loadMessages();
        loadUnreadCount();
      }

      (navigation as any).navigate('MessageThread', { messageId: message.id });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to open message');
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return colors.error;
      case 'high': return colors.warning;
      case 'normal': return colors.primary;
      case 'low': return colors.textTertiary;
      default: return colors.textTertiary;
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => (
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
        onPress={() => handleMessagePress(item)}
        activeOpacity={0.8}
      >
        <GlassCard
          style={[
            styles.messageCard,
            !item.isRead && item.status !== 'read' && styles.unreadMessage,
          ]}
          padding={spacing.lg}
        >
          <View style={styles.messageHeader}>
            <View style={styles.messageHeaderLeft}>
              <View style={styles.messageIconContainer}>
                <Text style={styles.messageIcon}>💬</Text>
              </View>
              <View style={styles.messageInfo}>
                <Text style={styles.senderName}>
                  {activeTab === 'sent' ? (item.recipientName || 'Recipient') : (item.senderName || 'Sender')}
                </Text>
                {item.priority && item.priority !== 'normal' && (
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
                    <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.messageMeta}>
              <Text style={styles.messageDate}>
                {format(new Date(item.sentAt || item.createdAt), 'MMM d, yyyy')}
              </Text>
              {!item.isRead && item.status !== 'read' && <View style={styles.unreadIndicator} />}
            </View>
          </View>
          <Text style={styles.subject}>{item.subject}</Text>
          <Text style={styles.preview} numberOfLines={2}>
            {item.messageText}
          </Text>
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading && messages.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Messages" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Messages"
        subtitle="Communicate with patients and colleagues"
        rightAction={
          <TouchableOpacity
            style={styles.composeButton}
            onPress={() => (navigation as any).navigate('ComposeMessage')}
            activeOpacity={0.7}
          >
            <Text style={styles.composeButtonText}>+ Compose</Text>
          </TouchableOpacity>
        }
      />
      <View style={styles.content}>
        <GlassCard style={styles.searchContainer} padding={spacing.md}>
          <View style={styles.searchInputContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search messages..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch} activeOpacity={0.7}>
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'inbox' && styles.activeTab]}
            onPress={() => setActiveTab('inbox')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'inbox' && styles.activeTabText]}>
              Inbox {activeTab === 'inbox' && unreadCount > 0 && `(${unreadCount})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'sent' && styles.activeTab]}
            onPress={() => setActiveTab('sent')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>Sent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'archived' && styles.activeTab]}
            onPress={() => setActiveTab('archived')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'archived' && styles.activeTabText]}>Archived</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
              <GlassCard style={styles.emptyState} padding={spacing.xl}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>No Messages</Text>
                <Text style={styles.emptySubtext}>Your messages will appear here</Text>
              </GlassCard>
            </Animated.View>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  composeButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  searchContainer: {
    margin: spacing.lg,
    marginBottom: spacing.md,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glassCard,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  searchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginLeft: spacing.sm,
  },
  searchButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.glassCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    paddingHorizontal: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.lg,
  },
  messageCard: {
    marginBottom: spacing.md,
  },
  unreadMessage: {
    borderColor: colors.primary,
    borderWidth: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  messageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  messageIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  messageIcon: {
    fontSize: 24,
  },
  messageInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  senderName: {
    ...typography.h4,
    marginRight: spacing.sm,
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  priorityText: {
    ...typography.labelSmall,
    color: colors.textPrimary,
    fontSize: 10,
  },
  messageMeta: {
    alignItems: 'flex-end',
  },
  messageDate: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  subject: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  preview: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    lineHeight: 20,
  },
  unreadIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
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

export default ProviderMessagingScreen;

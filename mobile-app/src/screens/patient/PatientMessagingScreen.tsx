import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import messagingService, { Message } from '../../services/messaging.service';
import { format } from 'date-fns';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';

const PatientMessagingScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useSelector((state: RootState) => state.auth);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadMessages();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const patientId = (user as any)?.patientId || (user as any)?.id;
      if (patientId) {
        const data = await messagingService.getPatientMessages(patientId);
        setMessages(data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
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
        onPress={() => (navigation as any).navigate('MessageThread', { messageId: item.id })}
        activeOpacity={0.8}
      >
        <GlassCard style={styles.messageCard} padding={spacing.lg}>
          <View style={styles.messageHeader}>
            <View style={styles.messageIconContainer}>
              <Text style={styles.messageIcon}>💬</Text>
            </View>
            <View style={styles.messageInfo}>
              <Text style={styles.senderName}>{item.senderName || 'Provider'}</Text>
              <Text style={styles.messageDate}>
                {format(new Date(item.createdAt), 'MMM d, yyyy')}
              </Text>
            </View>
            {!item.isRead && <View style={styles.unreadIndicator} />}
          </View>
          <Text style={styles.subject}>{item.subject}</Text>
          <Text style={styles.preview} numberOfLines={2}>
            {item.messageText}
          </Text>
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
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
        subtitle="Communicate with your healthcare team"
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  listContent: {
    padding: spacing.lg,
  },
  messageCard: {
    marginBottom: spacing.md,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
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
  },
  senderName: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  messageDate: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  subject: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  preview: {
    ...typography.bodySmall,
    color: colors.textTertiary,
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

export default PatientMessagingScreen;

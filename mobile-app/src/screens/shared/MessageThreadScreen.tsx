import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ehrApi } from '../../config/api';
import { format } from 'date-fns';
import { colors, typography, spacing, borderRadius } from '../../theme/designSystem';
import ScreenHeader from '../../components/shared/ScreenHeader';
import GlassCard from '../../components/shared/GlassCard';

const MessageThreadScreen: React.FC = () => {
  const route = useRoute();
  const { messageId } = route.params as { messageId: string };
  const { token } = useSelector((state: RootState) => state.auth);
  const { currentTenant } = useSelector((state: RootState) => state.tenant);
  const [message, setMessage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadMessage();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [messageId]);

  const loadMessage = async () => {
    if (!token || !currentTenant?.slug) return;

    try {
      setLoading(true);
      const response = await ehrApi.getMessageById(messageId, token, currentTenant.slug);
      setMessage(response.data);
    } catch (error) {
      console.error('Error loading message:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Message" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!message) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Message" />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Message not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={message.subject || 'Message'} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <GlassCard style={styles.messageCard} padding={spacing.lg}>
            <View style={styles.messageHeader}>
              <View style={styles.messageIconContainer}>
                <Text style={styles.messageIcon}>💬</Text>
              </View>
              <View style={styles.messageInfo}>
                <Text style={styles.senderName}>
                  {message.senderName || 'Sender'}
                </Text>
                <Text style={styles.messageDate}>
                  {format(new Date(message.sentAt || message.createdAt), 'MMM d, yyyy h:mm a')}
                </Text>
              </View>
            </View>
            <View style={styles.messageDivider} />
            <Text style={styles.messageText}>{message.messageText}</Text>
          </GlassCard>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.error,
  },
  messageCard: {
    marginBottom: spacing.lg,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  messageIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  messageIcon: {
    fontSize: 28,
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
  messageDivider: {
    height: 1,
    backgroundColor: colors.glassBorder,
    marginVertical: spacing.md,
  },
  messageText: {
    ...typography.body,
    lineHeight: 24,
  },
});

export default MessageThreadScreen;

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProviderMessageInbox,
  getProviderThread,
  getProviderThreads,
  getProviderUnreadCount,
  markProviderMessageRead,
  replyToProviderMessage,
  sendProviderMessage,
  type SendProviderMessagePayload
} from '../../../services/api/provider';

const QUERY_KEYS = {
  inbox: (status?: string) => ['provider', 'messages', 'inbox', status || 'all'] as const,
  unread: ['provider', 'messages', 'unread'] as const,
  threads: ['provider', 'messages', 'threads'] as const,
  thread: (id?: string) => ['provider', 'messages', 'thread', id || 'none'] as const
};

export function useProviderInbox(status?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.inbox(status),
    queryFn: () => getProviderMessageInbox(status ? { status } : undefined),
    refetchInterval: 20_000
  });
}

export function useProviderUnreadCount() {
  return useQuery({
    queryKey: QUERY_KEYS.unread,
    queryFn: getProviderUnreadCount,
    refetchInterval: 15_000
  });
}

export function useProviderThreads() {
  return useQuery({
    queryKey: QUERY_KEYS.threads,
    queryFn: getProviderThreads,
    refetchInterval: 30_000
  });
}

export function useProviderThread(threadId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.thread(threadId),
    queryFn: () => getProviderThread(threadId || ''),
    enabled: Boolean(threadId)
  });
}

export function useProviderMessagingMutations() {
  const queryClient = useQueryClient();

  const invalidateMessaging = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['provider', 'messages'] }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inbox('all') }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unread }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.threads })
    ]);
  };

  const markRead = useMutation({
    mutationFn: (messageId: string) => markProviderMessageRead(messageId),
    onSuccess: invalidateMessaging
  });

  const sendMessage = useMutation({
    mutationFn: (payload: SendProviderMessagePayload) => sendProviderMessage(payload),
    onSuccess: invalidateMessaging
  });

  const replyMessage = useMutation({
    mutationFn: (args: { messageId: string; body: string }) =>
      replyToProviderMessage(args.messageId, { message_text: args.body }),
    onSuccess: invalidateMessaging
  });

  return {
    markRead,
    sendMessage,
    replyMessage
  };
}

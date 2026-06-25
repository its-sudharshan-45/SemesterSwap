import { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/ui/Toast';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    title: string;
    price: number;
    status: 'available' | 'sold';
    images: string[];
    seller_id: string;
  };
  buyer?: {
    id: string;
    full_name: string | null;
    profile_image: string | null;
  };
  seller?: {
    id: string;
    full_name: string | null;
    profile_image: string | null;
  };
  unread_count?: number;
  last_message?: Message | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useConversationsQuery = () => {
  const { session } = useAuth();
  return useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      if (!session) return [];
      const res = await fetch(`${API_URL}/api/v1/conversations`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch conversations');
      return res.json();
    },
    enabled: !!session,
  });
};

export const useListingConversationQuery = (listingId?: string) => {
  const { session } = useAuth();
  return useQuery<Conversation[]>({
    queryKey: ['conversations', { listingId }],
    queryFn: async () => {
      if (!session) return [];
      const res = await fetch(`${API_URL}/api/v1/conversations`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const data: Conversation[] = await res.json();
      return data.filter((c) => c.product_id === listingId);
    },
    enabled: !!session && !!listingId,
  });
};

export const useListingConversationCreateMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listingId, sellerId }: { listingId: string; sellerId: string }) => {
      if (!session) throw new Error('Sign in to contact the seller.');
      const res = await fetch(`${API_URL}/api/v1/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ product_id: listingId, seller_id: sellerId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to open chat');
      }
      return res.json() as Promise<Conversation>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

export const useMessagesQuery = (conversationId?: string, limit: number = 50, offset: number = 0) => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const syncedConversationRef = useRef<string | null>(null);

  const query = useQuery<Message[]>({
    queryKey: ['messages', conversationId, { limit, offset }],
    queryFn: async () => {
      if (!session || !conversationId) return [];
      const res = await fetch(`${API_URL}/api/v1/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    enabled: !!session && !!conversationId,
  });

  useEffect(() => {
    if (!query.data || !conversationId || !session) return;

    queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
      if (!old) return old;
      return old.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c));
    });

    if (syncedConversationRef.current !== conversationId) {
      syncedConversationRef.current = conversationId;
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  }, [query.data, conversationId, session, queryClient]);

  return query;
};


export const useSendMessageMutation = (conversationId: string) => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      if (!session) throw new Error('Sign in to message.');
      const res = await fetch(`${API_URL}/api/v1/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to send message');
      }
      return res.json() as Promise<Message>;
    },
    onSuccess: (newMessage) => {
      // Optimistically append message to query cache for all active pagination limits
      queryClient.setQueriesData({ queryKey: ['messages', conversationId] }, (oldMessages: Message[] | undefined) => {
        if (!oldMessages) return [newMessage];
        if (oldMessages.some((m) => m.id === newMessage.id)) return oldMessages;
        return [...oldMessages, newMessage];
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err: any) => {
      showToast(err.message || 'Error sending message', 'error');
    },
  });
};

export const useMarkMessageReadMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      if (!session) return;
      await fetch(`${API_URL}/api/v1/conversations/messages/${messageId}/read`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

// Custom Hook to sync messages in real-time
export const useRealtimeMessages = (conversationId?: string) => {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const markReadMutation = useMarkMessageReadMutation();

  useEffect(() => {
    if (!conversationId || !session) return;

    // Connect Supabase client Realtime access
    supabase.realtime.setAuth(session.access_token);

    // Subscribe to Postgres changes on messages table for this conversation ID
    const channel = supabase
      .channel(`chat_messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;

          // Optimistically update lists for all active pagination limits
          queryClient.setQueriesData({ queryKey: ['messages', conversationId] }, (oldMsgs: Message[] | undefined) => {
            if (!oldMsgs) return [newMsg];
            if (oldMsgs.some((m) => m.id === newMsg.id)) return oldMsgs;
            return [...oldMsgs, newMsg];
          });

          // Invalidate conversations to sync lists & badges
          queryClient.invalidateQueries({ queryKey: ['conversations'] });

          // Auto-mark received messages as read immediately if viewer has this active chat window open
          if (newMsg.sender_id !== user?.id) {
            markReadMutation.mutate(newMsg.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, session, user?.id]);
};

// Typing status broadcast hook
export const useTypingIndicator = (conversationId?: string) => {
  const { user } = useAuth();
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!conversationId || !user) {
      setTypingUser(null);
      return;
    }

    const channel = supabase.channel(`typing:${conversationId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        if (payload.payload.user_id !== user.id) {
          if (payload.payload.is_typing) {
            setTypingUser(payload.payload.name || 'Other student');
          } else {
            setTypingUser(null);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, user]);

  const sendTypingStatus = (isTyping: boolean) => {
    if (!conversationId || !user || !channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: user.id,
        name: user.full_name,
        is_typing: isTyping,
      },
    });
  };

  return { typingUser, sendTypingStatus };
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/ui/Toast';
import type { Listing } from './useListings';

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  profile_image: string | null;
  rating: number;
}

export interface TransactionConfirmation {
  id: string;
  meeting_id: string;
  buyer_confirmed: boolean;
  seller_confirmed: boolean;
  completed_at?: string | null;
}

export interface Meeting {
  id: string;
  request_id: string;
  location: string;
  date: string;
  time: string;
  payment_method: 'CASH' | 'UPI';
  status: 'PROPOSED' | 'SCHEDULED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
  confirmation?: TransactionConfirmation | null;
  cancelled_by?: string | null;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
}

export interface Order {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  amount: number;
  order_status: 'CREATED' | 'PAYMENT_PENDING' | 'PAID' | 'SELLER_ACCEPTED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  payment_method: 'CASH' | 'UPI';
  payment_status: 'PENDING' | 'SUCCESS' | 'FAILED';
  transaction_id: string | null;
  seller_accepted: boolean;
  paid_at?: string | null;
  expires_at?: string | null;
  cancelled_by?: string | null;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  buyer?: UserProfile;
  seller?: UserProfile;
  product?: Listing;
  meeting?: Meeting | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Query hooks
export const useBuyerOrdersQuery = () => {
  const { session } = useAuth();
  return useQuery<Order[]>({
    queryKey: ['orders', 'buyer'],
    queryFn: async () => {
      if (!session) return [];
      const res = await fetch(`${API_URL}/api/v1/orders/buyer`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load purchases');
      return res.json();
    },
    enabled: !!session,
  });
};

export const useSellerOrdersQuery = () => {
  const { session } = useAuth();
  return useQuery<Order[]>({
    queryKey: ['orders', 'seller'],
    queryFn: async () => {
      if (!session) return [];
      const res = await fetch(`${API_URL}/api/v1/orders/seller`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load incoming orders');
      return res.json();
    },
    enabled: !!session,
  });
};

export const useOrderDetailsQuery = (orderId: string | undefined) => {
  const { session } = useAuth();
  return useQuery<Order>({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!session || !orderId) throw new Error('Not authenticated or invalid order ID');
      const res = await fetch(`${API_URL}/api/v1/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load order details');
      return res.json();
    },
    enabled: !!session && !!orderId,
  });
};

// Mutation hooks
export const useCreateOrderMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      product_id: string;
      payment_method: string;
      meeting_date: string;
      meeting_time: string;
      meeting_location: string;
      message?: string;
    }) => {
      if (!session) throw new Error('You must be signed in to request a swap.');
      const res = await fetch(`${API_URL}/api/v1/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to place order');
      }
      return res.json() as Promise<Order>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      showToast('Swap meeting request sent!', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error creating swap request', 'error');
    },
  });
};

export const useAcceptOrderMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${API_URL}/api/v1/orders/${orderId}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to accept order');
      }
      return res.json() as Promise<Order>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      showToast('Meeting request accepted successfully.', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error accepting request', 'error');
    },
  });
};

export const useRejectOrderMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${API_URL}/api/v1/orders/${orderId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to reject order');
      }
      return res.json() as Promise<Order>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      showToast('Meeting request declined.', 'info');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error declining request', 'error');
    },
  });
};

export const useCompleteOrderMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${API_URL}/api/v1/orders/${orderId}/complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to confirm completion');
      }
      return res.json() as Promise<Order>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      showToast('Completion status confirmed.', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error confirming completion', 'error');
    },
  });
};

export const useMeetingLocationsQuery = () => {
  const { session } = useAuth();
  return useQuery<string[]>({
    queryKey: ['meeting-locations'],
    queryFn: async () => {
      if (!session) return [];
      const res = await fetch(`${API_URL}/api/v1/orders/locations`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load locations');
      return res.json();
    },
    enabled: !!session,
  });
};

export const useRescheduleMeetingMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      orderId: string;
      meeting_location: string;
      meeting_date: string;
      meeting_time: string;
    }) => {
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${API_URL}/api/v1/orders/${payload.orderId}/reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          meeting_location: payload.meeting_location,
          meeting_date: payload.meeting_date,
          meeting_time: payload.meeting_time,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to propose reschedule');
      }
      return res.json() as Promise<Order>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      showToast('Counter proposed successfully!', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error rescheduling meeting', 'error');
    },
  });
};

export const useAcceptRescheduleMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${API_URL}/api/v1/orders/${orderId}/accept-reschedule`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to accept reschedule');
      }
      return res.json() as Promise<Order>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      showToast('Rescheduled proposal accepted!', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error accepting rescheduling', 'error');
    },
  });
};

export const useCancelMeetingMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { orderId: string; reason: string }) => {
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${API_URL}/api/v1/orders/${payload.orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reason: payload.reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to cancel meeting');
      }
      return res.json() as Promise<Order>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      showToast('Swap coordination cancelled successfully.', 'info');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error cancelling coordination', 'error');
    },
  });
};



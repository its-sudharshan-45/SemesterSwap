import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/ui/Toast';

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer?: {
    id: string;
    full_name: string | null;
    profile_image: string | null;
    email: string;
  };
}

export interface UserTrustProfile {
  user_id: string;
  full_name: string | null;
  profile_image: string | null;
  college_name: string;
  department_name: string;
  admission_year: number | null;
  rating: number;
  total_reviews: number;
  completed_transactions: number;
  products_sold: number;
  created_at: string;
  verification_status: string;
  trust_score: number;
  reviews: Review[];
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useTrustProfileQuery = (userId?: string) => {
  const { session } = useAuth();
  return useQuery<UserTrustProfile>({
    queryKey: ['trust-profile', userId],
    queryFn: async () => {
      if (!session || !userId) throw new Error('No session or userId provided');
      const res = await fetch(`${API_URL}/api/v1/users/${userId}/trust-profile`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load trust profile');
      return res.json();
    },
    enabled: !!session && !!userId,
  });
};

export const useCreateReviewMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, rating, comment }: { orderId: string; rating: number; comment?: string }) => {
      if (!session) throw new Error('Sign in to submit a review.');
      const res = await fetch(`${API_URL}/api/v1/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ order_id: orderId, rating, comment }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to submit review');
      }
      return res.json() as Promise<Review>;
    },
    onSuccess: (data) => {
      showToast('Review submitted successfully!', 'success');
      // Invalidate target user's trust profile and auth session/profile
      queryClient.invalidateQueries({ queryKey: ['trust-profile', data.reviewee_id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-details'] });
    },
    onError: (err: any) => {
      showToast(err.message || 'Error submitting review', 'error');
    },
  });
};

export const useVerifyUserMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, approve }: { userId: string; approve: boolean }) => {
      if (!session) throw new Error('Sign in to perform verification.');
      const endpoint = approve ? 'approve' : 'reject';
      const res = await fetch(`${API_URL}/api/v1/users/${userId}/verify/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to toggle verification status');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      showToast(
        `User verification status updated to ${variables.approve ? 'APPROVED' : 'REJECTED'}`,
        'success'
      );
      queryClient.invalidateQueries({ queryKey: ['trust-profile', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
    onError: (err: any) => {
      showToast(err.message || 'Error changing verification status', 'error');
    },
  });
};

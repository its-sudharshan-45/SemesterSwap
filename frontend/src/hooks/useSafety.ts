import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/ui/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useBlockUserMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blockedId: string) => {
      if (!session) throw new Error('You must be signed in to block users.');
      const res = await fetch(`${API_URL}/api/v1/safety/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ blocked_id: blockedId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to block user');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      showToast(data.message || 'User blocked successfully.', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error blocking user', 'error');
    },
  });
};

export interface ReportPayload {
  reported_user_id: string;
  listing_id: string | null;
  reason: string;
}

export const useReportUserOrListingMutation = () => {
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (payload: ReportPayload) => {
      if (!session) throw new Error('You must be signed in to submit a report.');
      const res = await fetch(`${API_URL}/api/v1/safety/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to submit report');
      }
      return res.json();
    },
    onSuccess: (data) => {
      showToast(data.message || 'Report submitted successfully.', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error submitting report', 'error');
    },
  });
};

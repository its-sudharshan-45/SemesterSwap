import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface LogViewPayload {
  listing_id: string;
}

export interface LogSearchPayload {
  query: string;
}

export const useLogViewMutation = () => {
  const { session } = useAuth();

  return useMutation<void, Error, LogViewPayload>({
    mutationFn: async (payload) => {
      if (!session) return;
      
      const res = await fetch(`${API_URL}/api/v1/analytics/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to log view analytics');
      }
    },
  });
};

export const useLogSearchMutation = () => {
  const { session } = useAuth();

  return useMutation<void, Error, LogSearchPayload>({
    mutationFn: async (payload) => {
      if (!session) return;

      const res = await fetch(`${API_URL}/api/v1/analytics/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to log search analytics');
      }
    },
  });
};

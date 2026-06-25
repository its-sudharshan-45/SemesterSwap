import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/ui/Toast';
import type { Listing } from './useListings';

export interface WishlistItem {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
  listing: Listing;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useWishlistQuery = () => {
  const { session } = useAuth();
  return useQuery<WishlistItem[]>({
    queryKey: ['wishlist'],
    queryFn: async () => {
      if (!session) return [];
      const res = await fetch(`${API_URL}/api/v1/wishlist`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load wishlist items');
      return res.json();
    },
    enabled: !!session,
  });
};

export const useAddToWishlistMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listingId: string) => {
      if (!session) throw new Error('You must be signed in to add items to your wishlist.');
      const res = await fetch(`${API_URL}/api/v1/wishlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ listing_id: listingId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to add item to wishlist');
      }
      return res.json() as Promise<WishlistItem>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      showToast('Item saved to wishlist!', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error saving item', 'error');
    },
  });
};

export const useRemoveFromWishlistMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listingId: string) => {
      if (!session) throw new Error('You must be signed in to remove items from your wishlist.');
      const res = await fetch(`${API_URL}/api/v1/wishlist/${listingId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to remove item from wishlist');
      }
      return listingId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      showToast('Item removed from wishlist.', 'info');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error removing item', 'error');
    },
  });
};

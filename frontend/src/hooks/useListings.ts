import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/ui/Toast';

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  price: number;
  status: 'available' | 'reserved' | 'sold' | 'REQUEST_PENDING';
  images: string[];
  created_at: string;
  updated_at: string;
  reserved_until?: string | null;
  seller?: {
    id: string;
    full_name: string | null;
    email: string;
    profile_image: string | null;
    rating: number;
    college?: {
      name: string;
    };
    department?: {
      name: string;
    };
  };
}

export interface ListingFilters {
  q?: string;
  category?: string;
  condition?: string;
  min_price?: number;
  max_price?: number;
  status?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Helper for client-side Canvas compression to speed up upload & save bandwidth
export const compressImage = (
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.85
): Promise<File> => {
  return new Promise((resolve) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

export const useListingsQuery = (filters: ListingFilters = {}) => {
  return useQuery<Listing[]>({
    queryKey: ['listings', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.q) params.append('q', filters.q);
      if (filters.category) params.append('category', filters.category);
      if (filters.condition) params.append('condition', filters.condition);
      if (filters.min_price !== undefined) params.append('min_price', filters.min_price.toString());
      if (filters.max_price !== undefined) params.append('max_price', filters.max_price.toString());
      if (filters.status !== undefined) params.append('status', filters.status);

      const res = await fetch(`${API_URL}/api/v1/listings?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load listings');
      }
      return res.json();
    },
  });
};

export const useListingQuery = (id?: string) => {
  return useQuery<Listing>({
    queryKey: ['listing', id],
    queryFn: async () => {
      if (!id) throw new Error('Listing ID is required');
      const res = await fetch(`${API_URL}/api/v1/listings/${id}`);
      if (!res.ok) {
        throw new Error('Listing not found');
      }
      return res.json();
    },
    enabled: !!id,
  });
};

export const useCreateListingMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Omit<Listing, 'id' | 'seller_id' | 'status' | 'created_at' | 'updated_at'>) => {
      if (!session) throw new Error('You must be signed in to create a listing.');
      const res = await fetch(`${API_URL}/api/v1/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create listing');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      showToast('Listing created successfully!', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error creating listing', 'error');
    },
  });
};

export const useUpdateListingMutation = (id: string) => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<Omit<Listing, 'id' | 'seller_id' | 'created_at' | 'updated_at'>>) => {
      if (!session) throw new Error('You must be signed in to update a listing.');
      const res = await fetch(`${API_URL}/api/v1/listings/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to update listing');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['listing', id] });
      showToast('Listing updated successfully!', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error updating listing', 'error');
    },
  });
};

export const useDeleteListingMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!session) throw new Error('You must be signed in to delete a listing.');
      const res = await fetch(`${API_URL}/api/v1/listings/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to delete listing');
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.removeQueries({ queryKey: ['listing', id] });
      showToast('Listing deleted successfully', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error deleting listing', 'error');
    },
  });
};

export const useMarkSoldMutation = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!session) throw new Error('You must be signed in to update a listing.');
      const res = await fetch(`${API_URL}/api/v1/listings/${id}/sold`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to mark as sold');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['listing', data.id] });
      showToast('Marked item as Sold!', 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Error updating listing status', 'error');
    },
  });
};

export const useUploadImageMutation = () => {
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ listingId, file }: { listingId: string; file: File }) => {
      if (!session) throw new Error('You must be signed in to upload images.');

      // 1. Client-side Canvas Compression
      const compressedFile = await compressImage(file);

      // 2. Prepare Form Data
      const formData = new FormData();
      formData.append('file', compressedFile);

      // 3. Make POST request
      const res = await fetch(`${API_URL}/api/v1/uploads/listing-image?listing_id=${listingId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to upload image');
      }

      return res.json() as Promise<{ url: string; path: string }>;
    },
  });
};

export const useUploadProfileImageMutation = () => {
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!session) throw new Error('You must be signed in to upload a profile image.');

      // 1. Client-side Canvas Compression
      const compressedFile = await compressImage(file, 800, 800, 0.85);

      // 2. Prepare Form Data
      const formData = new FormData();
      formData.append('file', compressedFile);

      // 3. Make POST request
      const res = await fetch(`${API_URL}/api/v1/uploads/profile-image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to upload profile image');
      }

      return res.json() as Promise<{ url: string; path: string }>;
    },
  });
};


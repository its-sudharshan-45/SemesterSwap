import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/ui/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface GenerateDescriptionPayload {
  product_title: string;
  condition: string;
  additional_info?: string;
}

export interface GenerateDescriptionResponse {
  description: string;
}

export interface ImproveTitlePayload {
  title: string;
  condition?: string;
}

export interface ImproveTitleResponse {
  improved_title: string;
}

export interface SuggestCategoryPayload {
  title: string;
  description?: string;
}

export interface SuggestCategoryResponse {
  category: string;
}

export interface ReviewListingPayload {
  title: string;
  description: string;
  category: string;
  condition: string;
  price: number;
}

export interface ReviewListingResponse {
  score: number;
  suggestions: string[];
}

export const useGenerateDescriptionMutation = () => {
  const { session } = useAuth();

  return useMutation<GenerateDescriptionResponse, Error, GenerateDescriptionPayload>({
    mutationFn: async (payload) => {
      if (!session) throw new Error('You must be signed in to use AI assistant.');
      
      const res = await fetch(`${API_URL}/api/v1/ai/generate-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to generate description');
      }
      return res.json();
    },
    onError: (err: any) => {
      showToast(err.message || 'Error generating description', 'error');
    },
  });
};

export const useImproveTitleMutation = () => {
  const { session } = useAuth();

  return useMutation<ImproveTitleResponse, Error, ImproveTitlePayload>({
    mutationFn: async (payload) => {
      if (!session) throw new Error('You must be signed in to use AI assistant.');

      const res = await fetch(`${API_URL}/api/v1/ai/improve-title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to improve title');
      }
      return res.json();
    },
    onError: (err: any) => {
      showToast(err.message || 'Error improving title', 'error');
    },
  });
};

export const useSuggestCategoryMutation = () => {
  const { session } = useAuth();

  return useMutation<SuggestCategoryResponse, Error, SuggestCategoryPayload>({
    mutationFn: async (payload) => {
      if (!session) throw new Error('You must be signed in to use AI assistant.');

      const res = await fetch(`${API_URL}/api/v1/ai/suggest-category`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to suggest category');
      }
      return res.json();
    },
    onError: (err: any) => {
      showToast(err.message || 'Error suggesting category', 'error');
    },
  });
};

export const useReviewListingMutation = () => {
  const { session } = useAuth();

  return useMutation<ReviewListingResponse, Error, ReviewListingPayload>({
    mutationFn: async (payload) => {
      if (!session) throw new Error('You must be signed in to use AI assistant.');

      const res = await fetch(`${API_URL}/api/v1/ai/review-listing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to review listing quality');
      }
      return res.json();
    },
    onError: (err: any) => {
      showToast(err.message || 'Error reviewing listing', 'error');
    },
  });
};


export interface PriceAnalysisPayload {
  category: string;
  title: string;
  condition: string;
  original_price?: number;
  age_months?: number;
}

export interface PriceAnalysisResponse {
  average_price: number;
  min_price: number;
  max_price: number;
  confidence_level: string;
  method: string;
  explanation: string;
}

export interface ImageAnalysisResponse {
  product_type: string;
  title_brand: string;
  estimated_condition: string;
  confidence: number;
  suggestions: string[];
  warnings: string[];
}

export interface ImageTaskResponse {
  task_id: string;
  status: 'pending' | 'success' | 'failed';
  result?: ImageAnalysisResponse;
  error?: string;
}

export const usePriceAnalysisMutation = () => {
  const { session } = useAuth();

  return useMutation<PriceAnalysisResponse, Error, PriceAnalysisPayload>({
    mutationFn: async (payload) => {
      if (!session) throw new Error('You must be signed in to use AI assistant.');

      const res = await fetch(`${API_URL}/api/v1/ai/price-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to estimate fair price range');
      }
      return res.json();
    },
    onError: (err: any) => {
      showToast(err.message || 'Error estimating price range', 'error');
    },
  });
};

export const useImageAnalysisMutation = () => {
  const { session } = useAuth();

  return useMutation<ImageTaskResponse, Error, File>({
    mutationFn: async (file) => {
      if (!session) throw new Error('You must be signed in to use AI assistant.');

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/api/v1/ai/image-analysis`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to analyze listing image');
      }
      return res.json();
    },
    onError: (err: any) => {
      showToast(err.message || 'Error analyzing listing image', 'error');
    },
  });
};

export const useImageTaskQuery = (taskId: string | null) => {
  const { session } = useAuth();

  return useQuery<ImageTaskResponse, Error>({
    queryKey: ['image-task', taskId],
    queryFn: async () => {
      if (!session) throw new Error('You must be signed in to use AI assistant.');
      if (!taskId) throw new Error('Task ID is required.');

      const res = await fetch(`${API_URL}/api/v1/ai/image-analysis/task/${taskId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to poll vision task status');
      }
      return res.json();
    },
    enabled: !!session && !!taskId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'success' || data.status === 'failed')) {
        return false;
      }
      return 1500;
    },
  });
};

export const useRecommendationsQuery = () => {
  const { session } = useAuth();

  return useQuery<any[], Error>({
    queryKey: ['recommendations'],
    queryFn: async () => {
      if (!session) throw new Error('You must be signed in to view recommendations.');

      const res = await fetch(`${API_URL}/api/v1/ai/recommendations`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch recommendations');
      }
      return res.json();
    },
    enabled: !!session,
  });
};


export interface PricePredictionPayload {
  title: string;
  category: string;
  condition: string;
  original_price?: number;
  age_months?: number;
  product_id?: string;
}

export interface FraudAnalysisPayload {
  title: string;
  description: string;
  category: string;
  condition: string;
  price: number;
  product_id?: string;
}

export interface FraudAnalysisResponse {
  id: string;
  product_id?: string;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  analysis_reason: string;
  recommendations: string[];
}

export interface SmartSearchResponse {
  explanation: string;
  results: {
    listing: any;
    relevance_score: number;
    explanation: string;
  }[];
}

export interface SellerInsightsResponse {
  product_id: string;
  views: number;
  chats: number;
  wishlist_count: number;
  conversion_rate: number;
  average_response_time: number;
  selling_probability: number;
  suggestions: string[];
}

export interface ImageQualityResponse {
  id: string;
  product_id?: string;
  quality_score: number;
  quality_level: string;
  feedback: string[];
}

export interface RecommendationSectionsResponse {
  recommended_for_you: any[];
  similar_products: any[];
  trending_in_college: any[];
  based_on_searches: any[];
}

export const usePricePredictionMutation = () => {
  const { session } = useAuth();

  return useMutation<PriceAnalysisResponse, Error, PricePredictionPayload>({
    mutationFn: async (payload) => {
      if (!session) throw new Error('You must be signed in.');

      const res = await fetch(`${API_URL}/api/v1/ai/price-prediction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to predict price');
      }
      return res.json();
    },
    onError: (err: any) => {
      showToast(err.message || 'Error predicting price', 'error');
    },
  });
};

export const useFraudAnalysisMutation = () => {
  const { session } = useAuth();

  return useMutation<FraudAnalysisResponse, Error, FraudAnalysisPayload>({
    mutationFn: async (payload) => {
      if (!session) throw new Error('You must be signed in.');

      const res = await fetch(`${API_URL}/api/v1/ai/analyze-listing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to analyze fraud risk');
      }
      return res.json();
    },
    onError: (err: any) => {
      showToast(err.message || 'Error scanning listing fraud', 'error');
    },
  });
};

export const useSmartSearchMutation = () => {
  const { session } = useAuth();

  return useMutation<SmartSearchResponse, Error, string>({
    mutationFn: async (query) => {
      if (!session) throw new Error('You must be signed in.');

      const res = await fetch(`${API_URL}/api/v1/ai/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to execute smart search');
      }
      return res.json();
    },
    onError: (err: any) => {
      showToast(err.message || 'Error with semantic search', 'error');
    },
  });
};

export const useSellerInsightsQuery = (productId: string | null) => {
  const { session } = useAuth();

  return useQuery<SellerInsightsResponse, Error>({
    queryKey: ['seller-insights', productId],
    queryFn: async () => {
      if (!session) throw new Error('You must be signed in.');
      if (!productId) throw new Error('Product ID is required.');

      const res = await fetch(`${API_URL}/api/v1/ai/seller-insights/${productId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to load seller insights');
      }
      return res.json();
    },
    enabled: !!session && !!productId,
  });
};

export const useImageQualityMutation = () => {
  const { session } = useAuth();

  return useMutation<ImageQualityResponse, Error, File>({
    mutationFn: async (file) => {
      if (!session) throw new Error('You must be signed in.');

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/api/v1/ai/image-quality`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to inspect image quality');
      }
      return res.json();
    },
    onError: (err: any) => {
      showToast(err.message || 'Error checking image quality', 'error');
    },
  });
};

export const useRecommendationsSectionsQuery = () => {
  const { session } = useAuth();

  return useQuery<RecommendationSectionsResponse, Error>({
    queryKey: ['recommendation-sections'],
    queryFn: async () => {
      if (!session) throw new Error('You must be signed in.');

      const res = await fetch(`${API_URL}/api/v1/ai/recommendations/sections`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to load personalized sections');
      }
      return res.json();
    },
    enabled: !!session,
  });
};


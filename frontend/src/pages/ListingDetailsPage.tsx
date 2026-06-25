import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  useListingQuery,
  useUpdateListingMutation,
  useDeleteListingMutation,
  useMarkSoldMutation,
  useUploadImageMutation
} from '../hooks/useListings';
import { useWishlistQuery, useAddToWishlistMutation, useRemoveFromWishlistMutation } from '../hooks/useWishlist';
import { useListingConversationCreateMutation } from '../hooks/useChat';
import { useRecommendationsQuery } from '../hooks/useAI';
import { useLogViewMutation } from '../hooks/useAnalytics';
import { useCreateOrderMutation } from '../hooks/useOrders';
import { Card, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import { showToast } from '../components/ui/Toast';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  User,
  GraduationCap,
  Award,
  Star,
  CheckCircle,
  MessageSquare,
  Bookmark,
  Edit,
  Trash2,
  Check,
  Save,
  X,
  Upload,
  Calendar,
  Sparkles,
  MapPin,
  BookOpen,
  ArrowRight,
  ShoppingBag
} from 'lucide-react';

const CATEGORIES = [
  'Textbooks',
  'Notes',
  'Calculators',
  'Lab Equipment',
  'Electronics',
  'Accessories',
  'Others',
];

const CONDITIONS = ['New', 'Like New', 'Good', 'Acceptable'];

const getSavedMeetingValue = (id: string | undefined, key: string, defaultValue: any): any => {
  if (!id) return defaultValue;
  try {
    const saved = sessionStorage.getItem(`request_meeting_${id}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed[key] !== undefined) return parsed[key];
    }
  } catch (e) {}
  return defaultValue;
};

export const ListingDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // React Query hooks
  const { data: listing, isLoading, isError, refetch } = useListingQuery(id);
  const updateListingMutation = useUpdateListingMutation(id || '');
  const deleteListingMutation = useDeleteListingMutation();
  const markSoldMutation = useMarkSoldMutation();
  const uploadImageMutation = useUploadImageMutation();

  // Wishlist and Conversation hooks
  const { data: wishlistItems = [] } = useWishlistQuery();
  const isWishlisted = wishlistItems.some((item) => item.listing_id === listing?.id);
  const addToWishlistMutation = useAddToWishlistMutation();
  const removeFromWishlistMutation = useRemoveFromWishlistMutation();
  const createConversationMutation = useListingConversationCreateMutation();

  // Component states
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  const logViewMutation = useLogViewMutation();
  const { data: recommendations = [], isLoading: isRecLoading } = useRecommendationsQuery();

  // Meeting request states
  const createOrderMutation = useCreateOrderMutation();
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [meetingDate, setMeetingDate] = useState<string>(() => getSavedMeetingValue(id, 'meetingDate', ''));
  const [meetingTime, setMeetingTime] = useState<string>(() => getSavedMeetingValue(id, 'meetingTime', '10:00 AM - 12:00 PM'));
  const [meetingLocation, setMeetingLocation] = useState<string>(() => getSavedMeetingValue(id, 'meetingLocation', ''));
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI'>(() => getSavedMeetingValue(id, 'paymentMethod', 'UPI'));
  const [messageToSeller, setMessageToSeller] = useState<string>(() => getSavedMeetingValue(id, 'messageToSeller', ''));

  useEffect(() => {
    if (!id) return;
    const values = {
      meetingDate,
      meetingTime,
      meetingLocation,
      paymentMethod,
      messageToSeller,
    };
    sessionStorage.setItem(`request_meeting_${id}`, JSON.stringify(values));
  }, [id, meetingDate, meetingTime, meetingLocation, paymentMethod, messageToSeller]);

  const handleRequestMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast('Please sign in to request a meeting.', 'error');
      return;
    }
    if (!listing) return;
    if (!meetingDate) {
      showToast('Please choose a meeting date.', 'error');
      return;
    }

    try {
      const request = await createOrderMutation.mutateAsync({
        product_id: listing.id,
        payment_method: paymentMethod,
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        meeting_location: meetingLocation,
        message: messageToSeller.trim() || undefined,
      });
      sessionStorage.removeItem(`request_meeting_${listing.id}`);
      setIsRequestModalOpen(false);
      navigate(`/order-tracking/${request.id}`);
    } catch (err: any) {
      // Handled in mutation hook
    }
  };

  useEffect(() => {
    if (id) {
      logViewMutation.mutate({ listing_id: id });
    }
  }, [id]);
  
  // Inline edit fields
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCondition, setEditCondition] = useState('');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editImages, setEditImages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize editing state
  const startEditing = () => {
    if (!listing) return;
    setEditTitle(listing.title);
    setEditDescription(listing.description);
    setEditCategory(listing.category);
    setEditCondition(listing.condition);
    setEditPrice(listing.price);
    setEditImages([...listing.images]);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      showToast('Title is required', 'error');
      return;
    }
    if (editPrice <= 0) {
      showToast('Price must be greater than zero', 'error');
      return;
    }
    if (editImages.length < 1) {
      showToast('At least one image is required', 'error');
      return;
    }

    try {
      setIsSaving(true);
      await updateListingMutation.mutateAsync({
        title: editTitle,
        description: editDescription,
        category: editCategory,
        condition: editCondition,
        price: editPrice,
        images: editImages,
      });
      setIsEditing(false);
    } catch (err) {
      // Handled in mutation hooks
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkAsSold = async () => {
    if (!listing) return;
    if (window.confirm('Are you sure you want to mark this item as sold?')) {
      try {
        await markSoldMutation.mutateAsync(listing.id);
      } catch (err) {}
    }
  };

  const handleDeleteListing = async () => {
    if (!listing) return;
    if (window.confirm('Are you sure you want to permanently delete this listing?')) {
      try {
        await deleteListingMutation.mutateAsync(listing.id);
        navigate('/my-listings');
      } catch (err) {}
    }
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files[0] || !listing) return;
    
    const file = files[0];
    if (editImages.length >= 5) {
      showToast('Maximum 5 images allowed per listing.', 'error');
      return;
    }

    // Validate type & size
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Supported formats: JPEG, PNG, WEBP.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('File size must be less than 5MB.', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const result = await uploadImageMutation.mutateAsync({
        listingId: listing.id,
        file,
      });
      setEditImages((prev) => [...prev, result.url]);
      showToast('Image uploaded successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Image upload failed', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setEditImages((prev) => prev.filter((_, i) => i !== index));
    if (activeImageIndex >= editImages.length - 1 && activeImageIndex > 0) {
      setActiveImageIndex(activeImageIndex - 1);
    }
  };

  const nextImage = () => {
    const images = isEditing ? editImages : (listing?.images || []);
    if (images.length === 0) return;
    setActiveImageIndex((activeImageIndex + 1) % images.length);
  };

  const prevImage = () => {
    const images = isEditing ? editImages : (listing?.images || []);
    if (images.length === 0) return;
    setActiveImageIndex((activeImageIndex - 1 + images.length) % images.length);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
        <Skeleton variant="text" className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton variant="rectangular" className="h-[400px] rounded-3xl" />
          <div className="space-y-4">
            <Skeleton variant="text" className="h-10 w-3/4" />
            <Skeleton variant="text" className="h-6 w-1/4" />
            <Skeleton variant="rectangular" className="h-40 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-5 text-left animate-fade-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/20 border border-red-200/50">
          <X className="h-6 w-6 text-red-500" />
        </div>
        <div className="text-center">
          <h4 className="text-lg font-bold text-slate-900 dark:text-white">Listing not found</h4>
          <p className="text-slate-400 text-sm mt-1">
            We couldn't retrieve the listing details. It may have been deleted, or there is a connection issue.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => refetch()} variant="primary" className="font-semibold">
            Retry
          </Button>
          <Button onClick={() => navigate('/marketplace')} variant="outline" className="font-semibold">
            Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = user && listing.seller_id === user.id;
  const currentImages = isEditing ? editImages : listing.images;

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto animate-fade-in pb-16">
      
      {/* Top Navigation Row */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate('/marketplace')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-brand-500 dark:text-slate-500 dark:hover:text-brand-500 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Marketplace</span>
        </button>

        {isOwner && !isEditing && (
          <div className="flex gap-2">
            {listing.status === 'available' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAsSold}
                className="flex items-center gap-1.5 font-semibold text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-950/50 dark:hover:bg-emerald-950/10"
              >
                <Check className="h-4 w-4" />
                <span>Mark Sold</span>
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={startEditing}
              className="flex items-center gap-1.5 font-semibold"
            >
              <Edit className="h-4 w-4" />
              <span>Edit</span>
            </Button>

            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteListing}
              className="flex items-center gap-1.5 font-semibold"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Side: Images View */}
        <div className="space-y-4">
          <div className="relative aspect-video sm:aspect-square bg-slate-100 dark:bg-darkbg-body rounded-3xl border border-slate-200/50 dark:border-darkbg-border/60 overflow-hidden flex items-center justify-center shadow-sm">
            
            {currentImages.length > 0 ? (
              <img
                src={currentImages[activeImageIndex]}
                alt={listing.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-slate-300 dark:text-slate-600 flex flex-col items-center">
                <Upload className="h-12 w-12 stroke-[1.5]" />
                <span className="text-xs uppercase font-bold mt-1 tracking-wider">No Images</span>
              </div>
            )}

            {/* Slider triggers */}
            {currentImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                  title="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                  title="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}

            {/* Status Overlays */}
            {listing.status === 'sold' && !isEditing && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                <span className="px-6 py-2.5 bg-red-600 text-white font-extrabold tracking-wider text-sm rounded-full shadow-lg border border-red-500 uppercase select-none">
                  Sold Out
                </span>
              </div>
            )}
            {listing.status === 'reserved' && !isEditing && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                <span className="px-6 py-2.5 bg-amber-650 text-white font-extrabold tracking-wider text-sm rounded-full shadow-lg border border-amber-550 uppercase select-none">
                  Reserved
                </span>
              </div>
            )}
          </div>

          {/* Thumbnails list or uploading previews */}
          {currentImages.length > 0 && (
            <div className="grid grid-cols-5 gap-3.5">
              {currentImages.map((url, idx) => (
                <div key={idx} className="relative aspect-square">
                  <button
                    onClick={() => setActiveImageIndex(idx)}
                    className={`h-full w-full rounded-xl border overflow-hidden transition-all ${
                      idx === activeImageIndex
                        ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-md'
                        : 'border-slate-200 hover:border-slate-300 dark:border-darkbg-border'
                    }`}
                  >
                    <img src={url} alt={`Thumb ${idx}`} className="h-full w-full object-cover" />
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500 text-white border border-white dark:border-darkbg-body shadow active:scale-90"
                      title="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              
              {/* Add image thumbnail during inline editing */}
              {isEditing && editImages.length < 5 && (
                <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-brand-500 dark:border-darkbg-border dark:hover:border-brand-500/80 rounded-xl cursor-pointer transition-colors bg-slate-50/20 dark:bg-darkbg-body/10">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAddImage}
                    className="sr-only"
                  />
                  <Upload className="h-4.5 w-4.5 text-slate-400" />
                  <span className="text-[9px] font-bold text-slate-500 mt-1">Add Image</span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Details / Form fields */}
        <div className="space-y-6">
          {isEditing ? (
            /* Editing Content Form */
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Edit Listing Details</h3>
                
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-sm text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Category */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Category</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full px-2 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-sm text-slate-800 dark:text-slate-200"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Price */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Price (₹)</label>
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-sm text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>

                {/* Condition */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Condition</label>
                  <select
                    value={editCondition}
                    onChange={(e) => setEditCondition(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-sm text-slate-800 dark:text-slate-200"
                  >
                    {CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Description</label>
                  <textarea
                    rows={4}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-sm text-slate-800 dark:text-slate-200"
                  />
                </div>

                {/* Edit Save/Cancel Actions */}
                <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-darkbg-border/60">
                  <Button
                    onClick={() => setIsEditing(false)}
                    variant="outline"
                    className="flex-1 rounded-xl py-2 font-semibold"
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    variant="primary"
                    className="flex-1 rounded-xl py-2 font-semibold"
                    isLoading={isSaving}
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* View Display Content */
            <div className="space-y-6">
              <div className="space-y-2">
                {/* Condition and Category Tags */}
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 rounded-full border border-brand-200/30">
                    {listing.category}
                  </span>
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-full border border-emerald-200/30">
                    Condition: {listing.condition}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white leading-tight">
                  {listing.title}
                </h1>

                {/* Price */}
                <div className="text-3xl font-black text-slate-900 dark:text-white pt-2">
                  {formatPrice(listing.price)}
                </div>
              </div>

              {/* Description box */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Product Description</h4>
                <p className="text-slate-600 dark:text-slate-350 text-sm leading-relaxed whitespace-pre-wrap">
                  {listing.description}
                </p>
              </div>

              {/* Date Metadata */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium pt-2 border-t border-slate-100 dark:border-darkbg-border/40">
                <Calendar className="h-3.5 w-3.5" />
                <span>Listed on {formatDate(listing.created_at)}</span>
              </div>

              {/* Seller Information Card */}
              {listing.seller && (
                <Card className="bg-slate-100/50 dark:bg-darkbg-border/20 p-5">
                  <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-3.5">
                    Seller Profile Info
                  </h4>
                  <div className="flex items-start gap-4">
                    {/* Seller avatar */}
                    <Link to={`/profile/${listing.seller_id}`} className="shrink-0 hover:opacity-85 transition-opacity">
                      <div className="relative h-12 w-12 rounded-full overflow-hidden bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 ring-2 ring-brand-500/20 flex items-center justify-center shrink-0">
                        {listing.seller.profile_image ? (
                          <img
                            src={listing.seller.profile_image}
                            alt={listing.seller.full_name || 'Seller'}
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
                              if (fallback) {
                                fallback.classList.remove('hidden');
                                fallback.classList.add('flex');
                              }
                            }}
                          />
                        ) : null}
                        <div className={`avatar-fallback ${listing.seller.profile_image ? 'hidden' : 'flex'} h-full w-full items-center justify-center`}>
                          <User className="h-5 w-5" />
                        </div>
                      </div>
                    </Link>

                    {/* Meta info */}
                    <div className="space-y-1.5 flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <Link to={`/profile/${listing.seller_id}`} className="font-extrabold text-sm text-slate-800 dark:text-slate-200 hover:text-brand-500 transition-colors">
                          {listing.seller.full_name || 'Verified Student'}
                        </Link>
                        
                        {/* Verified account check */}
                        <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/20 px-2 py-0.5 rounded-full select-none">
                          <CheckCircle className="h-3 w-3" />
                          <span>Verified</span>
                        </div>
                      </div>

                      {/* College & Department */}
                      <div className="text-xs text-slate-400 dark:text-slate-500 flex flex-wrap gap-x-2 gap-y-1 leading-normal">
                        <span className="flex items-center gap-1">
                          <Award className="h-3.5 w-3.5 text-slate-400" />
                          {listing.seller.college?.name || 'KPRIET'}
                        </span>
                        <span className="flex items-center gap-1">
                          <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                          {listing.seller.department?.name || 'Engineering'}
                        </span>
                      </div>

                      {/* Rating stars */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="flex text-amber-400 items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3.5 w-3.5 ${
                                i < Math.round(listing.seller?.rating || 0)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-200 dark:text-slate-700'
                              }`}
                            />
                          ))}
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {listing.seller.rating.toFixed(1)} / 5.0
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Buyer Actions (Show if NOT the owner) */}
              {!isOwner && (
                <div className="flex gap-4 pt-2">
                  <Button
                    onClick={() => {
                      if (!user) {
                        showToast('Please sign in to request a meeting.', 'error');
                        return;
                      }
                      setIsRequestModalOpen(true);
                    }}
                    variant="ghost"
                    className="flex-1 py-3 font-bold rounded-2xl flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/10 transition-colors disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                    disabled={listing.status !== 'available' && listing.status !== 'REQUEST_PENDING'}
                  >
                    <ShoppingBag className="h-5 w-5" />
                    <span>
                      {listing.status === 'reserved'
                        ? 'Reserved'
                        : listing.status === 'sold'
                        ? 'Sold'
                        : listing.status === 'REQUEST_PENDING'
                        ? 'Pending Meeting'
                        : 'Request Meeting'}
                    </span>
                  </Button>

                  <Button
                    onClick={async () => {
                      if (!user) {
                        showToast('Please sign in to contact the seller.', 'error');
                        return;
                      }
                      try {
                        const conversation = await createConversationMutation.mutateAsync({
                          listingId: listing.id,
                          sellerId: listing.seller_id,
                        });
                        navigate(`/messages/${conversation.id}`);
                      } catch (err: any) {
                        showToast(err.message || 'Failed to start conversation.', 'error');
                      }
                    }}
                    variant="primary"
                    className="flex-1 py-3 font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-brand-500/10"
                    disabled={listing.status === 'sold' || createConversationMutation.isPending}
                    isLoading={createConversationMutation.isPending}
                  >
                    <MessageSquare className="h-5 w-5" />
                    <span>Contact Seller</span>
                  </Button>

                  <Button
                    onClick={async () => {
                      if (!user) {
                        showToast('Please sign in to save items.', 'error');
                        return;
                      }
                      try {
                        if (isWishlisted) {
                          await removeFromWishlistMutation.mutateAsync(listing.id);
                        } else {
                          await addToWishlistMutation.mutateAsync(listing.id);
                        }
                      } catch (err: any) {}
                    }}
                    variant="outline"
                    className={`p-3 font-bold rounded-2xl flex items-center justify-center border transition-all ${
                      isWishlisted
                        ? 'border-brand-200 bg-brand-50/50 text-brand-600 dark:border-brand-950/30 dark:bg-brand-950/10 dark:text-brand-400'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-darkbg-border dark:hover:bg-darkbg-card dark:text-slate-350'
                    }`}
                    disabled={addToWishlistMutation.isPending || removeFromWishlistMutation.isPending}
                  >
                    <Bookmark className={`h-5 w-5 ${isWishlisted ? 'fill-current' : ''}`} />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        
      </div>

      {/* Recommendations section */}
      {!isRecLoading && recommendations.length > 0 && (
        <div className="pt-10 border-t border-slate-100 dark:border-darkbg-border/40 mt-12 space-y-6">
          <h3 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-500 animate-pulse" />
            <span>Recommended For You</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {recommendations.slice(0, 4).map((item) => (
              <Card
                key={item.id}
                hoverEffect
                onClick={() => {
                  navigate(`/listings/${item.id}`);
                  window.scrollTo(0, 0);
                }}
                className="flex flex-col p-0 cursor-pointer overflow-hidden border border-slate-200/50 hover:border-slate-300 dark:border-darkbg-border/60 dark:hover:border-darkbg-border/80 group bg-white dark:bg-darkbg-card"
              >
                {/* Image Container */}
                <div className="h-40 w-full overflow-hidden relative bg-slate-100 dark:bg-darkbg-body flex items-center justify-center border-b border-slate-100 dark:border-darkbg-border/40">
                  {item.images && item.images.length > 0 ? (
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-slate-300 dark:text-slate-600 flex flex-col items-center">
                      <BookOpen className="h-8 w-8 stroke-[1.5]" />
                      <span className="text-[9px] uppercase font-bold mt-1 tracking-wider">No Image</span>
                    </div>
                  )}
                  {/* Condition Badge */}
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase bg-white/90 backdrop-blur-sm text-brand-600 dark:bg-darkbg-card/90 dark:text-brand-400 rounded-full border border-slate-200/50 dark:border-darkbg-border/50 shadow-sm">
                    {item.condition}
                  </span>
                </div>

                {/* Details Container */}
                <div className="p-3.5 flex-1 flex flex-col justify-between text-left space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                        {formatPrice(item.price)}
                      </span>
                    </div>
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 group-hover:text-brand-500 transition-colors line-clamp-1 leading-snug">
                      {item.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 leading-none">
                      <MapPin className="h-2.5 w-2.5 inline text-slate-400" />
                      <span>
                        {item.seller?.college?.name || 'KPRIET'} — {item.seller?.department?.name?.split(' ')[0] || 'CSE'}
                      </span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-darkbg-border/40 flex items-center justify-between text-[10px] font-bold text-brand-500 dark:text-brand-400 select-none">
                    <span>View Details</span>
                    <ArrowRight className="h-3 w-3 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      {/* Request Meeting Modal Dialog */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-darkbg-card rounded-3xl max-w-md w-full border border-slate-200 dark:border-darkbg-border p-6 shadow-2xl space-y-4 animate-fade-in text-left">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-darkbg-border/60 pb-3">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-brand-500" />
                <span>Request Swap Meeting</span>
              </h3>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-50 dark:hover:bg-darkbg-body transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRequestMeeting} className="space-y-4 pt-1">
              {/* Meeting Date */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Preferred Date
                </label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-sm text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Meeting Time Slots */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Preferred Time Slot
                </label>
                <select
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-sm text-slate-800 dark:text-slate-200"
                >
                  <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM</option>
                  <option value="12:00 PM - 2:00 PM">12:00 PM - 2:00 PM</option>
                  <option value="2:00 PM - 4:00 PM">2:00 PM - 4:00 PM</option>
                  <option value="4:00 PM - 6:00 PM">4:00 PM - 6:00 PM</option>
                  <option value="Other (discuss in chat)">Other (discuss in chat)</option>
                </select>
              </div>

              {/* Campus Location */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Preferred Campus Location
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Library Entrance, CSE Block Lobby..."
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-sm text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                  Preferred Direct Payment Method
                </label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="payment_method"
                      value="UPI"
                      checked={paymentMethod === 'UPI'}
                      onChange={() => setPaymentMethod('UPI')}
                      className="accent-brand-500 h-4 w-4"
                    />
                    <span>UPI Transfer (Direct)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="payment_method"
                      value="CASH"
                      checked={paymentMethod === 'CASH'}
                      onChange={() => setPaymentMethod('CASH')}
                      className="accent-brand-500 h-4 w-4"
                    />
                    <span>Cash on Hand</span>
                  </label>
                </div>
              </div>

              {/* Optional message to seller */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Message to Seller (Optional)
                </label>
                <textarea
                  rows={2}
                  value={messageToSeller}
                  onChange={(e) => setMessageToSeller(e.target.value)}
                  placeholder="Hey, let's meet up to exchange..."
                  className="w-full px-3 py-2 border border-slate-200 focus:border-brand-500 dark:bg-darkbg-body dark:border-darkbg-border dark:focus:border-brand-500 rounded-xl outline-none text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Disclaimer */}
              <div className="bg-slate-50 dark:bg-darkbg-body p-3 rounded-xl border border-slate-100 dark:border-darkbg-border/60 text-[10px] text-slate-500 leading-normal flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-brand-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Safety Notice:</strong> You will pay the seller directly during the meeting. Remember to inspect the item's condition before payment.
                </span>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  variant="outline"
                  className="flex-1 font-bold py-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1 font-bold py-2 bg-brand-500 hover:bg-brand-600 text-white"
                  isLoading={createOrderMutation.isPending}
                >
                  Send Proposal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ListingDetailsPage;

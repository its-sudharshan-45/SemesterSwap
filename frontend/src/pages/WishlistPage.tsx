import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWishlistQuery, useRemoveFromWishlistMutation } from '../hooks/useWishlist';
import { useListingConversationCreateMutation } from '../hooks/useChat';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import { Bookmark, MessageSquare, Trash2, ShoppingBag } from 'lucide-react';
import { showToast } from '../components/ui/Toast';

export const WishlistPage: React.FC = () => {
  const navigate = useNavigate();
  
  // Queries & Mutations
  const { data: wishlistItems = [], isLoading, isError, refetch } = useWishlistQuery();
  const removeMutation = useRemoveFromWishlistMutation();
  const contactMutation = useListingConversationCreateMutation();

  const handleRemove = async (e: React.MouseEvent, listingId: string) => {
    e.stopPropagation();
    try {
      await removeMutation.mutateAsync(listingId);
      showToast('Item removed from wishlist.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error removing item.', 'error');
    }
  };

  const handleContact = async (e: React.MouseEvent, listingId: string, sellerId: string) => {
    e.stopPropagation();
    try {
      const conv = await contactMutation.mutateAsync({ listingId, sellerId });
      navigate(`/messages/${conv.id}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to start conversation.', 'error');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white text-left">My Saved items</h1>
          <p className="text-slate-500 text-sm mt-1 text-left">Loading your wishlist items...</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="space-y-3">
              <Skeleton variant="rectangular" className="h-48 rounded-2xl" />
              <Skeleton variant="text" className="h-6 w-3/4" />
              <Skeleton variant="text" className="h-4 w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-5 animate-fade-in text-left">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/20 border border-red-200/50">
          <Bookmark className="h-6 w-6 text-red-500" />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Failed to load wishlist</h3>
          <p className="text-slate-500 text-sm mt-1">There was an issue fetching your saved items. Please check your connection and try again.</p>
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

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-left animate-fade-in pb-12">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">My Wishlist</h1>
        <p className="text-slate-500 text-sm mt-1">Keep track of items you are interested in buying</p>
      </div>

      {wishlistItems.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto space-y-5 bg-white/50 dark:bg-darkbg-body/50 border border-slate-200/50 dark:border-darkbg-border/60">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-950/20 text-brand-500 border border-brand-200/20 shadow-inner">
            <Bookmark className="h-8 w-8 stroke-[1.5]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Wishlist is empty</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
              Save essentials like textbooks, notes, electronics, and accessories to find them again.
            </p>
          </div>
          <Button onClick={() => navigate('/marketplace')} variant="primary" className="font-semibold rounded-xl flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span>Browse Marketplace</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {wishlistItems.map((item) => {
            const { listing } = item;
            if (!listing) return null;

            return (
              <Card
                key={item.id}
                hoverEffect
                className="relative flex flex-col justify-between overflow-hidden border border-slate-200/50 dark:border-darkbg-border/60 bg-white dark:bg-darkbg-card/30 p-0 cursor-pointer rounded-2xl group transition-all"
                onClick={() => navigate(`/listings/${listing.id}`)}
              >
                {/* Image & Status Badge */}
                <div className="relative aspect-video w-full bg-slate-100 dark:bg-darkbg-body overflow-hidden">
                  {listing.images && listing.images.length > 0 ? (
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-100 dark:bg-darkbg-body">
                      No Image
                    </div>
                  )}

                  {/* Sold badge */}
                  {listing.status === 'sold' ? (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                      <span className="px-3 py-1 bg-red-600 text-white font-black text-[10px] tracking-wider uppercase rounded-full shadow border border-red-500">
                        Sold
                      </span>
                    </div>
                  ) : (
                    <span className="absolute top-3 left-3 px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-black tracking-wider uppercase rounded-full shadow">
                      Available
                    </span>
                  )}

                  {/* Remove Wishlist Button overlay */}
                  <button
                    onClick={(e) => handleRemove(e, listing.id)}
                    disabled={removeMutation.isPending}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-white/90 hover:bg-red-50 text-slate-500 hover:text-red-500 shadow border border-slate-200/20 active:scale-95 transition-all dark:bg-darkbg-body/90 dark:hover:bg-red-950/20 dark:text-slate-400"
                    title="Remove from wishlist"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Card Content info */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {listing.category}
                    </span>
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 line-clamp-1 group-hover:text-brand-500 transition-colors">
                      {listing.title}
                    </h3>
                    <div className="text-base font-black text-slate-900 dark:text-white pt-1">
                      {formatPrice(listing.price)}
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="pt-4 mt-3 border-t border-slate-100 dark:border-darkbg-border/40 flex items-center gap-2">
                    <Button
                      onClick={(e) => handleContact(e, listing.id, listing.seller_id)}
                      disabled={listing.status === 'sold' || contactMutation.isPending}
                      variant="primary"
                      size="sm"
                      className="flex-1 text-xs py-2 font-bold rounded-xl flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Contact</span>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default WishlistPage;

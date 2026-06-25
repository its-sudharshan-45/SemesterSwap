import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useListingsQuery, useDeleteListingMutation, useMarkSoldMutation } from '../hooks/useListings';
import { useSellerInsightsQuery } from '../hooks/useAI';
import { Card } from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import { PlusCircle, ExternalLink, Trash2, Check, Tag, Info, ShoppingBag, Landmark, Sparkles } from 'lucide-react';

export const MyListingsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tab state: 'active' | 'sold'
  const [activeTab, setActiveTab] = useState<'active' | 'sold'>('active');

  // Fetch all listings (we will filter client-side to show user's own)
  const { data: listings, isLoading, isError, refetch } = useListingsQuery({ status: '' }); // Fetch both available and sold

  const deleteListingMutation = useDeleteListingMutation();
  const markSoldMutation = useMarkSoldMutation();

  const handleMarkAsSold = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to mark this item as sold?')) {
      try {
        await markSoldMutation.mutateAsync(id);
      } catch (err) {}
    }
  };

  const handleDeleteListing = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to permanently delete this listing?')) {
      try {
        await deleteListingMutation.mutateAsync(id);
      } catch (err) {}
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
      <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
        <Skeleton variant="text" className="h-10 w-48" />
        <Skeleton variant="rectangular" className="h-24 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton variant="rectangular" className="h-48 rounded-2xl" />
          <Skeleton variant="rectangular" className="h-48 rounded-2xl" />
          <Skeleton variant="rectangular" className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Filter listings for the current user
  const myListings = listings?.filter((l) => l.seller_id === user?.id) || [];
  const activeListings = myListings.filter((l) => l.status === 'available');
  const soldListings = myListings.filter((l) => l.status === 'sold');

  // Metrics calculations
  const totalSwapsCount = myListings.length;
  const activeCount = activeListings.length;
  const soldCount = soldListings.length;
  const totalEarnings = soldListings.reduce((sum, item) => sum + item.price, 0);

  const displayListings = activeTab === 'active' ? activeListings : soldListings;

  return (
    <div className="space-y-8 animate-fade-in text-left max-w-5xl mx-auto pb-16">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200/50 dark:border-darkbg-border/50 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            Seller Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your items, check completed swaps, and check listing statuses.
          </p>
        </div>
        
        <Button
          onClick={() => navigate('/sell')}
          variant="primary"
          className="flex items-center gap-2 font-bold py-2.5 rounded-xl shadow-md shadow-brand-500/10"
        >
          <PlusCircle className="h-4.5 w-4.5" />
          <span>Sell New Item</span>
        </Button>
      </div>

      {/* Metrics Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-4 bg-white/60 dark:bg-darkbg-card/60">
          <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Listed</span>
            <span className="text-xl font-extrabold text-slate-800 dark:text-slate-200">{totalSwapsCount}</span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 bg-white/60 dark:bg-darkbg-card/60">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Active Swaps</span>
            <span className="text-xl font-extrabold text-slate-800 dark:text-slate-200">{activeCount}</span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 bg-white/60 dark:bg-darkbg-card/60">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Items Sold</span>
            <span className="text-xl font-extrabold text-slate-800 dark:text-slate-200">{soldCount}</span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 bg-white/60 dark:bg-darkbg-card/60">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Value</span>
            <span className="text-xl font-extrabold text-slate-800 dark:text-slate-200">{formatPrice(totalEarnings)}</span>
          </div>
        </Card>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200/60 dark:border-darkbg-border/60">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors relative ${
            activeTab === 'active'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <span>Active Swaps ({activeCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('sold')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors relative ${
            activeTab === 'sold'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <span>Sold Swaps ({soldCount})</span>
        </button>
      </div>

      {/* List / Grid layout */}
      {isError && (
        <div className="py-12 text-center max-w-sm mx-auto space-y-3">
          <Info className="h-10 w-10 text-red-500 mx-auto" />
          <h4 className="font-bold text-slate-800 dark:text-slate-200">Failed to load dashboard listings</h4>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      )}

      {!isError && displayListings.length === 0 && (
        <div className="py-16 text-center max-w-md mx-auto space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 dark:bg-darkbg-border/40 border border-slate-100 dark:border-darkbg-border/30">
            <ShoppingBag className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">
              No {activeTab === 'active' ? 'active' : 'sold'} items
            </h4>
            <p className="text-slate-400 text-sm mt-1">
              {activeTab === 'active'
                ? "You don't have any active listings. Tap the button above to sell your first item!"
                : "You haven't marked any items as sold yet."}
            </p>
          </div>
        </div>
      )}

      {!isError && displayListings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayListings.map((item) => {
            if (activeTab === 'active') {
              return (
                <ActiveListingCard
                  key={item.id}
                  item={item}
                  onNavigate={(id) => navigate(`/listings/${id}`)}
                  onMarkAsSold={handleMarkAsSold}
                  onDeleteListing={handleDeleteListing}
                  formatPrice={formatPrice}
                />
              );
            }
            return (
              <Card
                key={item.id}
                onClick={() => navigate(`/listings/${item.id}`)}
                className="flex flex-col p-0 cursor-pointer overflow-hidden border border-slate-200/50 hover:border-slate-350 dark:border-darkbg-border/60 dark:hover:border-darkbg-border/80 group"
              >
                {/* Product preview image */}
                <div className="h-40 bg-slate-100 dark:bg-darkbg-body relative overflow-hidden flex items-center justify-center border-b border-slate-100 dark:border-darkbg-border/40">
                  {item.images && item.images.length > 0 ? (
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="h-full w-full object-cover group-hover:scale-102 transition-transform duration-350"
                    />
                  ) : (
                    <ShoppingBag className="h-8 w-8 text-slate-300 dark:text-slate-650" />
                  )}
                  <span className="absolute top-3 right-3 px-2 py-0.5 text-[9px] font-bold bg-white/95 backdrop-blur-sm text-slate-700 dark:bg-darkbg-card/90 dark:text-slate-300 rounded-full shadow-sm">
                    {item.condition}
                  </span>
                  <span className="absolute bottom-3 left-3 px-2 py-0.5 text-[9px] font-bold bg-brand-500 text-white rounded">
                    {item.category}
                  </span>
                </div>

                {/* Text metadata */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between items-baseline">
                      <span className="font-extrabold text-base text-slate-800 dark:text-slate-100">
                        {formatPrice(item.price)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {item.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-500 transition-colors line-clamp-1">
                      {item.title}
                    </h4>
                  </div>

                  {/* Dashboard Quick Actions */}
                  <div className="pt-3 border-t border-slate-100 dark:border-darkbg-border/40 flex items-center justify-between gap-2">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/listings/${item.id}`);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-[11px] font-semibold flex items-center justify-center gap-1 rounded-lg py-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>View / Edit</span>
                    </Button>

                    <Button
                      onClick={(e) => handleDeleteListing(item.id, e)}
                      variant="ghost"
                      size="sm"
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg"
                      title="Delete listing"
                    >
                      <Trash2 className="h-4 w-4" />
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

// ActiveListingCard Subcomponent with Seller Insights
const ActiveListingCard: React.FC<{
  item: any;
  onNavigate: (id: string) => void;
  onMarkAsSold: (id: string, e: React.MouseEvent) => void;
  onDeleteListing: (id: string, e: React.MouseEvent) => void;
  formatPrice: (price: number) => string;
}> = ({ item, onNavigate, onMarkAsSold, onDeleteListing, formatPrice }) => {
  const { data: insights, isLoading } = useSellerInsightsQuery(item.id);

  return (
    <Card
      onClick={() => onNavigate(item.id)}
      className="flex flex-col p-0 cursor-pointer overflow-hidden border border-slate-200/50 hover:border-slate-350 dark:border-darkbg-border/60 dark:hover:border-darkbg-border/80 group"
    >
      {/* Product preview image */}
      <div className="h-40 bg-slate-100 dark:bg-darkbg-body relative overflow-hidden flex items-center justify-center border-b border-slate-100 dark:border-darkbg-border/40">
        {item.images && item.images.length > 0 ? (
          <img
            src={item.images[0]}
            alt={item.title}
            className="h-full w-full object-cover group-hover:scale-102 transition-transform duration-350"
          />
        ) : (
          <ShoppingBag className="h-8 w-8 text-slate-300 dark:text-slate-650" />
        )}
        <span className="absolute top-3 right-3 px-2 py-0.5 text-[9px] font-bold bg-white/95 backdrop-blur-sm text-slate-700 dark:bg-darkbg-card/90 dark:text-slate-300 rounded-full shadow-sm">
          {item.condition}
        </span>
        <span className="absolute bottom-3 left-3 px-2 py-0.5 text-[9px] font-bold bg-brand-500 text-white rounded">
          {item.category}
        </span>
      </div>

      {/* Text metadata */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between items-baseline">
            <span className="font-extrabold text-base text-slate-800 dark:text-slate-100">
              {formatPrice(item.price)}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {item.status}
            </span>
          </div>
          <h4 className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-500 transition-colors line-clamp-1">
            {item.title}
          </h4>
        </div>

        {/* AI Seller Insights Sub-panel */}
        {isLoading && (
          <div className="py-2 space-y-1 border-t border-dashed border-slate-100 dark:border-darkbg-border/40 animate-pulse">
            <div className="h-3 bg-slate-100 dark:bg-slate-850 rounded w-1/2"></div>
            <div className="h-6 bg-slate-100 dark:bg-slate-850 rounded w-full"></div>
          </div>
        )}

        {!isLoading && insights && (
          <div className="pt-3 pb-1 border-t border-dashed border-slate-200/60 dark:border-darkbg-border/60 space-y-3 text-xs text-left">
            <div className="flex justify-between items-center text-[10px] font-black uppercase text-brand-500 tracking-wider">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 animate-pulse" />
                AI Seller Insights
              </span>
              <span>{Math.round(insights.selling_probability)}% Sell Prob</span>
            </div>

            {/* Selling probability progress bar */}
            <div className="w-full bg-slate-100 dark:bg-darkbg-body h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  insights.selling_probability >= 70
                    ? 'bg-emerald-500'
                    : insights.selling_probability >= 40
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.round(insights.selling_probability)}%` }}
              ></div>
            </div>

            {/* Mini metrics bar */}
            <div className="grid grid-cols-4 gap-1 py-1 text-center bg-slate-50 dark:bg-darkbg-body rounded-lg text-[10px]">
              <div>
                <span className="block font-semibold text-slate-400">Views</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{insights.views}</span>
              </div>
              <div>
                <span className="block font-semibold text-slate-400">Chats</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{insights.chats}</span>
              </div>
              <div>
                <span className="block font-semibold text-slate-400">Wishlist</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{insights.wishlist_count}</span>
              </div>
              <div>
                <span className="block font-semibold text-slate-400">Resp. T</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">~{Math.round(insights.average_response_time)}m</span>
              </div>
            </div>

            {/* Suggestions list optimization card */}
            {insights.suggestions && insights.suggestions.length > 0 && (
              <div className="p-2.5 bg-brand-50/20 dark:bg-brand-950/10 border border-brand-200/50 dark:border-brand-500/10 rounded-xl space-y-1">
                <span className="block text-[9px] font-bold text-brand-600 dark:text-brand-400 uppercase">Optimization Tips:</span>
                <ul className="list-disc list-inside text-[10px] text-slate-500 dark:text-slate-450 space-y-0.5">
                  {insights.suggestions.slice(0, 2).map((sug: string, i: number) => (
                    <li key={i} className="line-clamp-2 leading-tight">{sug}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Dashboard Quick Actions */}
        <div className="pt-3 border-t border-slate-100 dark:border-darkbg-border/40 flex items-center justify-between gap-2">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(item.id);
            }}
            variant="outline"
            size="sm"
            className="flex-1 text-[11px] font-semibold flex items-center justify-center gap-1 rounded-lg py-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>View / Edit</span>
          </Button>

          <Button
            onClick={(e) => onMarkAsSold(item.id, e)}
            variant="secondary"
            size="sm"
            className="flex-1 text-[11px] font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/30 rounded-lg py-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Sold</span>
          </Button>

          <Button
            onClick={(e) => onDeleteListing(item.id, e)}
            variant="ghost"
            size="sm"
            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg"
            title="Delete listing"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default MyListingsPage;

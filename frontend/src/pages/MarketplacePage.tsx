import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListingsQuery } from '../hooks/useListings';
import { useLogSearchMutation } from '../hooks/useAnalytics';
import { useSmartSearchMutation } from '../hooks/useAI';
import { Card } from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import { showToast } from '../components/ui/Toast';
import { Search, SlidersHorizontal, MapPin, BookOpen, ArrowRight, Sparkles, Filter, X, Tag } from 'lucide-react';

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

export const MarketplacePage: React.FC = () => {
  const navigate = useNavigate();

  // Search & Filter state
  const [searchMode, setSearchMode] = useState<'traditional' | 'ai'>('traditional');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCondition, setSelectedCondition] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Active filter payload to send to React Query
  const [filters, setFilters] = useState({
    q: '',
    category: '',
    condition: '',
    min_price: undefined as number | undefined,
    max_price: undefined as number | undefined,
  });

  const { data: listings, isLoading: isTraditionalLoading, isError, refetch } = useListingsQuery(filters);
  const logSearchMutation = useLogSearchMutation();

  // AI Smart Search
  const smartSearchMutation = useSmartSearchMutation();
  const [aiSearchResults, setAiSearchResults] = useState<any>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);

  const isLoading = isTraditionalLoading || isAiSearching;

  // Apply button click
  const handleApplyFilters = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (searchMode === 'ai') {
      if (!searchQuery.trim()) {
        showToast('Please enter a query for AI Smart Search.', 'error');
        return;
      }
      try {
        setIsAiSearching(true);
        const res = await smartSearchMutation.mutateAsync(searchQuery.trim());
        setAiSearchResults(res);
      } catch (err) {
        console.error(err);
      } finally {
        setIsAiSearching(false);
      }
    } else {
      setFilters({
        q: searchQuery,
        category: selectedCategory,
        condition: selectedCondition,
        min_price: minPrice ? parseFloat(minPrice) : undefined,
        max_price: maxPrice ? parseFloat(maxPrice) : undefined,
      });
      if (searchQuery.trim()) {
        logSearchMutation.mutate({ query: searchQuery.trim() });
      }
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedCondition('');
    setMinPrice('');
    setMaxPrice('');
    setAiSearchResults(null);
    setFilters({
      q: '',
      category: '',
      condition: '',
      min_price: undefined,
      max_price: undefined,
    });
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const displayedListings = searchMode === 'ai' && aiSearchResults
    ? aiSearchResults.results.map((r: any) => ({
        ...r.listing,
        relevance_score: r.relevance_score,
        search_explanation: r.explanation
      }))
    : listings || [];

  return (
    <div className="space-y-8 animate-fade-in text-left">
      
      {/* Banner / Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-12 sm:px-12 sm:py-16 shadow-xl shadow-brand-500/10">
        {/* Visual geometric designs */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-80 w-80 rounded-full bg-white/10 blur-[60px]" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-brand-400/20 blur-[50px]" />

        <div className="relative max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white text-xs font-semibold select-none">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Campus Exclusive Marketplace</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Find Semester Essentials at Half the Price
          </h1>
          <p className="text-brand-100 text-sm sm:text-base leading-relaxed max-w-lg">
            Buy, sell, or exchange textbooks, notes, lab tools, and calculators directly with other students on campus.
          </p>
        </div>
      </div>

      {/* Search Mode Selector Toggle */}
      <div className="flex justify-start gap-2 p-1 bg-slate-100 dark:bg-darkbg-card rounded-2xl w-fit border border-slate-200/50 dark:border-darkbg-border/60">
        <button
          type="button"
          onClick={() => {
            setSearchMode('traditional');
            handleClearFilters();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all ${
            searchMode === 'traditional'
              ? 'bg-white dark:bg-brand-950/20 text-slate-800 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Traditional Search
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchMode('ai');
            handleClearFilters();
          }}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-wide transition-all flex items-center gap-1.5 ${
            searchMode === 'ai'
              ? 'bg-brand-500 dark:bg-brand-600 text-white shadow-md shadow-brand-500/10'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Smart Search
        </button>
      </div>

      {/* Search Bar & Filter Toggle Row */}
      <form onSubmit={handleApplyFilters} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 pointer-events-none">
              <Search className="h-5 w-5" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 focus:border-brand-500 focus:bg-white dark:bg-darkbg-card dark:border-darkbg-border/80 dark:focus:border-brand-500 rounded-2xl outline-none text-sm shadow-sm transition-all text-slate-800 dark:text-slate-200"
              placeholder={
                searchMode === 'ai'
                  ? "Ask AI: 'I need a programmable calculator under 500 INR' or 'ECE textbooks'..."
                  : "Search books, calculators, lab gear, notes..."
              }
            />
          </div>

          <div className="flex gap-2">
            {searchMode === 'traditional' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 py-3 rounded-2xl font-semibold border-slate-200 dark:border-darkbg-border text-slate-700 dark:text-slate-300"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filters</span>
                {(selectedCategory || selectedCondition || minPrice || maxPrice) && (
                  <span className="ml-1 flex h-2 w-2 rounded-full bg-brand-500" />
                )}
              </Button>
            )}

            <Button type="submit" variant="primary" className="px-6 py-3 rounded-2xl font-semibold flex items-center gap-1.5">
              {searchMode === 'ai' && <Sparkles className="h-4 w-4" />}
              <span>{searchMode === 'ai' ? 'Analyze & Find' : 'Search'}</span>
            </Button>
          </div>
        </div>

        {/* Collapsible Filter Panel (Traditional Search Only) */}
        {searchMode === 'traditional' && showFilters && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200/60 dark:bg-darkbg-card dark:border-darkbg-border/60 shadow-lg space-y-6 animate-fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-darkbg-border/50">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Filter className="h-4.5 w-4.5 text-brand-500" />
                Filter Options
              </h4>
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-semibold text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 flex items-center gap-1 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Category selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 dark:bg-darkbg-body dark:border-darkbg-border/80 rounded-xl outline-none text-sm focus:border-brand-500 text-slate-800 dark:text-slate-200"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Condition selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Condition
                </label>
                <select
                  value={selectedCondition}
                  onChange={(e) => setSelectedCondition(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 dark:bg-darkbg-body dark:border-darkbg-border/80 rounded-xl outline-none text-sm focus:border-brand-500 text-slate-800 dark:text-slate-200"
                >
                  <option value="">All Conditions</option>
                  {CONDITIONS.map((cond) => (
                    <option key={cond} value={cond}>
                      {cond}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Range filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Price Range (₹)
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 dark:bg-darkbg-body dark:border-darkbg-border/80 rounded-xl outline-none text-sm focus:border-brand-500 text-slate-800 dark:text-slate-200"
                    placeholder="Min"
                  />
                  <span className="text-slate-400 text-xs">to</span>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 dark:bg-darkbg-body dark:border-darkbg-border/80 rounded-xl outline-none text-sm focus:border-brand-500 text-slate-800 dark:text-slate-200"
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" onClick={() => handleApplyFilters()} className="font-semibold py-2">
                Apply Filters
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* AI Explanation / Search Info */}
      {searchMode === 'ai' && aiSearchResults && (
        <div className="p-4 bg-brand-50/20 dark:bg-brand-950/10 border border-brand-200/50 dark:border-brand-500/20 rounded-2xl text-xs text-left leading-normal space-y-1">
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
            <Sparkles className="h-4 w-4 text-brand-500" />
            AI Query Analysis
          </span>
          <p className="text-slate-600 dark:text-slate-300">
            {aiSearchResults.explanation}
          </p>
        </div>
      )}

      {/* Grid Header */}
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-darkbg-border/50 pb-4">
        <h3 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
          <span>{searchMode === 'ai' ? 'AI Search Results' : 'New Items Listed'}</span>
          {displayedListings && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-darkbg-border text-slate-500 dark:text-slate-400">
              {displayedListings.length} items
            </span>
          )}
        </h3>
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col space-y-3">
              <Skeleton variant="rectangular" className="h-48 rounded-2xl w-full" />
              <div className="space-y-1">
                <Skeleton variant="text" className="h-5 w-3/4" />
                <Skeleton variant="text" className="h-4 w-1/2" />
                <Skeleton variant="text" className="h-5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="py-16 text-center max-w-md mx-auto space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/20 border border-red-200/50">
            <X className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Failed to load listings</h4>
            <p className="text-slate-400 text-sm mt-1">
              There was an error communicating with the backend API. Please make sure the server is running.
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="font-semibold">
            Retry Connection
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && displayedListings.length === 0 && (
        <div className="py-20 text-center max-w-md mx-auto space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-darkbg-border/60 border border-slate-200/30">
            <Tag className="h-6 w-6 text-slate-400" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">No items found</h4>
            <p className="text-slate-400 text-sm mt-1">
              {searchMode === 'ai'
                ? "AI couldn't locate matching items. Try rephrasing your search query!"
                : "We couldn't find any listings matching your search parameters. Try adjusting filters or keyword searches."}
            </p>
          </div>
          <Button onClick={handleClearFilters} variant="secondary" className="font-semibold">
            Reset Filters
          </Button>
        </div>
      )}

      {/* Product Grid */}
      {!isLoading && !isError && displayedListings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {displayedListings.map((item: any) => (
            <Card
              key={item.id}
              hoverEffect
              onClick={() => navigate(`/listings/${item.id}`)}
              className="flex flex-col p-0 cursor-pointer overflow-hidden border border-slate-200/50 hover:border-slate-300 dark:border-darkbg-border/60 dark:hover:border-darkbg-border/80 group"
            >
              {/* Image Container */}
              <div className="h-48 w-full overflow-hidden relative bg-slate-100 dark:bg-darkbg-body flex items-center justify-center border-b border-slate-100 dark:border-darkbg-border/40">
                {item.images && item.images.length > 0 ? (
                  <img
                    src={item.images[0]}
                    alt={item.title}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="text-slate-300 dark:text-slate-600 flex flex-col items-center">
                    <BookOpen className="h-10 w-10 stroke-[1.5]" />
                    <span className="text-[10px] uppercase font-bold mt-1 tracking-wider">No Image</span>
                  </div>
                )}
                {/* Relevance Score Badge */}
                {searchMode === 'ai' && item.relevance_score !== undefined && (
                  <span className="absolute top-3 left-3 px-2 py-0.5 text-[10px] font-black tracking-wider uppercase bg-brand-500 text-white rounded-full shadow-sm">
                    {Math.round(item.relevance_score * 100)}% Match
                  </span>
                )}
                {/* Condition Badge */}
                <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-white/90 backdrop-blur-sm text-brand-600 dark:bg-darkbg-card/90 dark:text-brand-400 rounded-full border border-slate-200/50 dark:border-darkbg-border/50 shadow-sm">
                  {item.condition}
                </span>
                {/* Category tag */}
                <span className="absolute bottom-3 left-3 px-2.5 py-0.5 text-[9px] font-bold tracking-wider uppercase bg-brand-500 text-white rounded-md shadow-sm">
                  {item.category}
                </span>
              </div>

              {/* Text / Details Container */}
              <div className="p-4 flex-1 flex flex-col justify-between text-left space-y-4">
                <div className="space-y-1.5">
                  {/* Price & Status */}
                  <div className="flex justify-between items-baseline">
                    <span className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                      {formatPrice(item.price)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-500 transition-colors line-clamp-1 leading-snug">
                    {item.title}
                  </h4>

                  {/* Seller Info summary */}
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 leading-none">
                    <MapPin className="h-3 w-3 inline text-slate-400" />
                    <span>
                      {item.seller?.college?.name || 'KPRIET'} — {item.seller?.department?.name?.split(' ')[0] || 'CSE'}
                    </span>
                  </p>
                  
                  {/* Relevance Explanation */}
                  {searchMode === 'ai' && item.search_explanation && (
                    <p className="text-[10px] text-brand-500 dark:text-brand-400 italic font-semibold leading-normal pt-1">
                      Reason: {item.search_explanation}
                    </p>
                  )}
                </div>

                {/* View Details Call to Action */}
                <div className="pt-2 border-t border-slate-100 dark:border-darkbg-border/40 flex items-center justify-between text-[11px] font-bold text-brand-500 dark:text-brand-400 select-none">
                  <span>View Product</span>
                  <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketplacePage;

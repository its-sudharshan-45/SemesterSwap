import React, { useState } from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import { showToast } from '../ui/Toast';
import SmartPriceGuider from './SmartPriceGuider';

interface CoreDetailsStepProps {
  register: any;
  errors: any;
  watch: any;
  setValue: any;
  categories: string[];
  onImproveTitle: () => Promise<string>;
  isImprovingTitle: boolean;
}

export const CoreDetailsStep: React.FC<CoreDetailsStepProps> = ({
  register,
  errors,
  watch,
  setValue,
  categories,
  onImproveTitle,
  isImprovingTitle,
}) => {
  const watchCategory = watch('category');
  const watchPrice = watch('price');
  const watchTitle = watch('title');

  // Local state for suggestion previews
  const [pendingTitleSuggestion, setPendingTitleSuggestion] = useState<string | null>(null);
  const [originalTitle, setOriginalTitle] = useState<string | null>(null);

  const handleTitleImproveClick = async () => {
    if (!watchTitle) {
      showToast('Please enter a product title first.', 'error');
      return;
    }
    try {
      const original = watchTitle;
      const improved = await onImproveTitle();
      if (improved && improved !== original) {
        setOriginalTitle(original);
        setPendingTitleSuggestion(improved);
      } else {
        showToast('Your title is already optimized!', 'success');
      }
    } catch (e) {
      // Error handled by mutation
    }
  };

  const acceptTitleSuggestion = () => {
    if (pendingTitleSuggestion) {
      setValue('title', pendingTitleSuggestion);
      setPendingTitleSuggestion(null);
      setOriginalTitle(null);
      showToast('AI Title applied!', 'success');
    }
  };

  return (
    <div className="space-y-6">
      {/* Product Title */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Product Title <span className="text-red-500">*</span>
          </label>
          
          {!pendingTitleSuggestion && (
            <button
              type="button"
              onClick={handleTitleImproveClick}
              disabled={isImprovingTitle || !watchTitle}
              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 dark:text-rose-400 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isImprovingTitle ? 'Polishing...' : 'Polish Title with AI'}</span>
            </button>
          )}
        </div>
        <input
          type="text"
          {...register('title', {
            required: 'Product title is required',
            minLength: { value: 3, message: 'Title must be at least 3 characters' },
            maxLength: { value: 100, message: 'Title cannot exceed 100 characters' },
          })}
          className={`w-full px-4 py-3 bg-slate-50 border ${
            errors.title ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-brand-500'
          } dark:bg-darkbg-body dark:border-darkbg-border/80 dark:focus:border-brand-500 rounded-xl outline-none text-sm transition-all text-slate-800 dark:text-slate-200`}
          placeholder="e.g. Casio fx-991EX Calculator, 3rd Sem ECE Notes"
        />
        {!!errors.title && (
          <p className="text-xs font-semibold text-red-500 mt-1">{errors.title.message}</p>
        )}

        {/* AI Title Polish Diff Area */}
        {pendingTitleSuggestion && (
          <div className="rounded-2xl border border-indigo-150 bg-indigo-50/30 p-4 dark:border-brand-500/25 dark:bg-brand-950/10 animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-indigo-650 dark:text-brand-400">
                <Sparkles className="h-4.5 w-4.5 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider">AI Title Recommendation</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={acceptTitleSuggestion}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white font-bold text-xs rounded-lg hover:bg-emerald-600 transition-colors shadow-sm cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Apply</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingTitleSuggestion(null);
                    setOriginalTitle(null);
                  }}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                  title="Discard Suggestion"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
              <div className="p-3 rounded-xl bg-white border border-slate-100 dark:bg-darkbg-card dark:border-darkbg-border">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Your Draft</span>
                <p className="text-slate-600 dark:text-slate-350 mt-1 line-through">{originalTitle}</p>
              </div>
              <div className="p-3 rounded-xl bg-white border-2 border-brand-500 dark:bg-darkbg-card">
                <span className="text-[9px] uppercase tracking-wider font-bold text-brand-500 flex items-center gap-1">
                  <span>Optimized Title</span>
                  <Check className="h-3 w-3" />
                </span>
                <p className="text-slate-800 dark:text-white font-bold mt-1">{pendingTitleSuggestion}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            {...register('category', { required: 'Please select a product category' })}
            className={`w-full px-3.5 py-3 bg-slate-50 border ${
              errors.category ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-brand-500'
            } dark:bg-darkbg-body dark:border-darkbg-border/80 dark:focus:border-brand-500 rounded-xl outline-none text-sm transition-all text-slate-800 dark:text-slate-200`}
          >
            <option value="">Select Category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {!!errors.category && (
            <p className="text-xs font-semibold text-red-500 mt-1">{errors.category.message}</p>
          )}
        </div>

        {/* Price */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Price (INR ₹) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
              ₹
            </span>
            <input
              type="number"
              step="1"
              {...register('price', {
                required: 'Price is required',
                min: { value: 1, message: 'Price must be greater than zero' },
              })}
              className={`w-full pl-8 pr-4 py-3 bg-slate-50 border ${
                errors.price ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-brand-500'
              } dark:bg-darkbg-body dark:border-darkbg-border/80 dark:focus:border-brand-500 rounded-xl outline-none text-sm transition-all text-slate-800 dark:text-slate-200`}
              placeholder="e.g. 350"
            />
          </div>
          {!!errors.price && (
            <p className="text-xs font-semibold text-red-500 mt-1">{errors.price.message}</p>
          )}
        </div>
      </div>

      {/* Smart Price Guider Section */}
      {watchCategory && (
        <div className="pt-2 animate-fade-in">
          <SmartPriceGuider category={watchCategory} price={watchPrice} />
        </div>
      )}
    </div>
  );
};

export default CoreDetailsStep;

import React from 'react';
import { HelpCircle, TrendingDown, CheckCircle, AlertTriangle } from 'lucide-react';

interface SmartPriceGuiderProps {
  category: string;
  price: number | undefined;
}

const PRICE_RANGES: Record<string, { min: number; max: number; label: string }> = {
  'Textbooks': { min: 200, max: 1000, label: 'Textbooks' },
  'Notes': { min: 50, max: 300, label: 'Study Notes' },
  'Calculators': { min: 400, max: 2000, label: 'Graphing & Scientific Calculators' },
  'Lab Equipment': { min: 100, max: 800, label: 'Lab Coats, Glasses & Kits' },
  'Electronics': { min: 800, max: 8000, label: 'Tablets, Chargers & Accessories' },
  'Accessories': { min: 100, max: 800, label: 'Bags, Organizers & Campus Gear' },
  'Others': { min: 50, max: 3000, label: 'Miscellaneous Items' },
};

export const SmartPriceGuider: React.FC<SmartPriceGuiderProps> = ({ category, price }) => {
  if (!category || !PRICE_RANGES[category]) return null;

  const range = PRICE_RANGES[category];
  const hasPrice = price !== undefined && !isNaN(price) && price > 0;

  // Determine status
  let status: 'idle' | 'good' | 'low' | 'high' = 'idle';
  let percentage = 50;

  if (hasPrice) {
    const currentPrice = price as number;
    if (currentPrice < range.min) {
      status = 'low';
      // Calculate position below min
      percentage = Math.max(10, (currentPrice / range.min) * 30);
    } else if (currentPrice > range.max) {
      status = 'high';
      // Calculate position above max
      percentage = Math.min(90, 70 + ((currentPrice - range.max) / range.max) * 20);
    } else {
      status = 'good';
      // Interpolate within min-max (30% to 70% range on bar)
      const rangeSpan = range.max - range.min;
      const progress = (currentPrice - range.min) / (rangeSpan || 1);
      percentage = 30 + progress * 40;
    }
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-darkbg-border/40 dark:bg-darkbg-card/20 transition-all duration-300">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Smart Price Guide
            </span>
            <div className="group relative">
              <HelpCircle className="h-3.5 w-3.5 text-slate-400 hover:text-slate-650 cursor-pointer" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-48 rounded-lg bg-slate-900 p-2 text-[10px] text-white shadow-lg group-hover:block z-50 leading-relaxed font-medium">
                Pricing guidelines are calculated from successful historical swaps at KPRIET.
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">
            Typical range for {range.label}: <span className="text-slate-700 dark:text-slate-300">₹{range.min} – ₹{range.max}</span>
          </p>
        </div>

        {hasPrice && (
          <div className="shrink-0">
            {status === 'low' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 px-2.5 py-1 rounded-full border border-indigo-150/10">
                <TrendingDown className="h-3 w-3" />
                <span>Priced to Sell fast!</span>
              </span>
            )}
            {status === 'good' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full border border-emerald-150/10">
                <CheckCircle className="h-3 w-3" />
                <span>Perfect Sweet Spot</span>
              </span>
            )}
            {status === 'high' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-full border border-amber-150/10">
                <AlertTriangle className="h-3 w-3" />
                <span>Priced above average</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Visual Slider Meter */}
      <div className="relative mt-4 h-2.5 w-full rounded-full bg-slate-200/60 dark:bg-darkbg-border/50">
        {/* Sweet spot colored range band (30% to 70% of bar width) */}
        <div className="absolute left-[30%] right-[30%] h-full bg-emerald-500/25 dark:bg-emerald-500/15 border-x border-emerald-500/20" />
        
        {/* Marker for min and max limits */}
        <div className="absolute left-[30%] top-full mt-1 -translate-x-1/2 text-[9px] font-bold text-slate-400">
          ₹{range.min}
        </div>
        <div className="absolute right-[30%] top-full mt-1 translate-x-1/2 text-[9px] font-bold text-slate-400">
          ₹{range.max}
        </div>

        {/* User price indicator dot */}
        {hasPrice && (
          <div
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-brand-500 shadow-md shadow-brand-500/30 transition-all duration-500 ease-out"
            style={{ left: `${percentage}%` }}
          >
            {/* Pulsing indicator core */}
            <span className="absolute inset-0.5 rounded-full bg-white scale-75 animate-ping opacity-75" />
          </div>
        )}
      </div>
      <div className="h-4" /> {/* Spacer for pricing markers */}
    </div>
  );
};

export default SmartPriceGuider;

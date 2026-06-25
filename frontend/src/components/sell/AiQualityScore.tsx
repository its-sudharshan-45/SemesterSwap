import React from 'react';
import { Sparkles, CheckCircle2, Circle } from 'lucide-react';

interface AiQualityScoreProps {
  title: string;
  description: string;
  condition: string;
  price: number | undefined;
  imageCount: number;
}

export const AiQualityScore: React.FC<AiQualityScoreProps> = ({
  title,
  description,
  condition,
  price,
  imageCount,
}) => {
  // Score calculator
  const checklist = [
    {
      id: 'title_length',
      label: 'Descriptive, search-friendly title',
      met: title.trim().length >= 15,
      points: 20,
      tip: 'Add brand, model, or course details to the title.',
    },
    {
      id: 'desc_length',
      label: 'Detailed product description',
      met: description.trim().length >= 40,
      points: 25,
      tip: 'Explain item condition, usage notes, or textbook edition.',
    },
    {
      id: 'has_images',
      label: 'At least one product photo uploaded',
      met: imageCount >= 1,
      points: 20,
      tip: 'Upload clear photos of the actual item.',
    },
    {
      id: 'multiple_images',
      label: 'Multi-angle showcase (2+ photos)',
      met: imageCount >= 2,
      points: 10,
      tip: 'Add more photos showing side angles or wear marks.',
    },
    {
      id: 'has_price',
      label: 'Realistic price defined',
      met: price !== undefined && !isNaN(price) && price > 0,
      points: 15,
      tip: 'Set a reasonable price or check the pricing guide.',
    },
    {
      id: 'has_condition',
      label: 'Item condition specified',
      met: !!condition,
      points: 10,
      tip: 'Select the current condition of your item.',
    },
  ];

  const maxPoints = checklist.reduce((acc, item) => acc + item.points, 0);
  const score = checklist.reduce((acc, item) => acc + (item.met ? item.points : 0), 0);

  // SVG parameters
  const radius = 36;
  const strokeWidth = 6.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / maxPoints) * circumference;

  // Determine feedback text & color
  let statusText = 'Draft Listing';
  let gradientStart = 'text-amber-500';
  let gradientEnd = 'text-orange-600';
  let badgeBg = 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400';

  if (score >= 90) {
    statusText = 'Superb Quality';
    gradientStart = 'text-emerald-500';
    gradientEnd = 'text-teal-600';
    badgeBg = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400';
  } else if (score >= 60) {
    statusText = 'Good Listing';
    gradientStart = 'text-brand-500';
    gradientEnd = 'text-indigo-650';
    badgeBg = 'bg-brand-50 text-brand-600 dark:bg-brand-950/20 dark:text-brand-400';
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 dark:border-darkbg-border/60 dark:bg-darkbg-card shadow-xl shadow-slate-100/40 dark:shadow-none flex flex-col md:flex-row gap-6 items-center">
      {/* Circle Meter Left */}
      <div className="flex flex-col items-center shrink-0 space-y-3">
        <div className="relative flex items-center justify-center">
          <svg className="h-28 w-28 -rotate-95">
            {/* Background Track */}
            <circle
              cx="56"
              cy="56"
              r={radius}
              fill="transparent"
              stroke="currentColor"
              className="text-slate-100 dark:text-darkbg-border/40"
              strokeWidth={strokeWidth}
            />
            {/* Progress Stroke */}
            <circle
              cx="56"
              cy="56"
              r={radius}
              fill="transparent"
              stroke="url(#gradient-score)"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              strokeWidth={strokeWidth}
              className="transition-all duration-700 ease-out"
            />
            <defs>
              <linearGradient id="gradient-score" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" className={gradientStart} stopColor="currentColor" />
                <stop offset="100%" className={gradientEnd} stopColor="currentColor" />
              </linearGradient>
            </defs>
          </svg>
          {/* Inner Content */}
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">
              {score}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
              Score
            </span>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${badgeBg}`}>
          {statusText}
        </span>
      </div>

      {/* Checklist Right */}
      <div className="flex-1 space-y-4 w-full">
        <div>
          <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Sparkles className="h-4.5 w-4.5 text-brand-500" />
            <span>Listing Completeness Inspector</span>
          </h4>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            High score listings sell 2.5x faster on campus due to better student trust.
          </p>
        </div>

        {/* Dynamic Tips Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {checklist.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-2 p-2 rounded-xl transition-all duration-200 ${
                item.met
                  ? 'bg-slate-50/50 dark:bg-darkbg-body/20 text-slate-500 dark:text-slate-400'
                  : 'bg-amber-50/20 dark:bg-amber-950/5 text-slate-700 dark:text-slate-350'
              }`}
            >
              {item.met ? (
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-4.5 w-4.5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <span className={`font-semibold ${item.met ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                  {item.label}
                </span>
                {!item.met && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-normal leading-normal">
                    {item.tip}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AiQualityScore;

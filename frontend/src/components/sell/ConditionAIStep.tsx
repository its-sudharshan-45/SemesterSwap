import React, { useState } from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import { showToast } from '../ui/Toast';

interface ConditionAIStepProps {
  register: any;
  errors: any;
  watch: any;
  setValue: any;
  onGenerateDescription: (context?: string) => Promise<string>;
  isGeneratingDescription: boolean;
}

const CONDITIONS = [
  { value: 'New', label: 'New', desc: 'Brand new, unopened, in original packaging' },
  { value: 'Like New', label: 'Like New', desc: 'Opened, used once or twice, zero signs of wear' },
  { value: 'Good', label: 'Good', desc: 'Minor cosmetic wear, fully operational and clean' },
  { value: 'Acceptable', label: 'Acceptable', desc: 'Visible wear and tear, but functions perfectly' },
];

export const ConditionAIStep: React.FC<ConditionAIStepProps> = ({
  register,
  errors,
  watch,
  setValue,
  onGenerateDescription,
  isGeneratingDescription,
}) => {
  const watchTitle = watch('title');
  const selectedCondition = watch('condition');
  const watchDescription = watch('description');

  // Local state for suggestion previews
  const [pendingDescSuggestion, setPendingDescSuggestion] = useState<string | null>(null);
  const [originalDesc, setOriginalDesc] = useState<string | null>(null);

  const [showPromptInput, setShowPromptInput] = useState(false);
  const [customContext, setCustomContext] = useState('');

  const handleDescGenerateClick = async () => {
    if (!watchTitle) {
      showToast('Please enter a title in Step 1 first.', 'error');
      return;
    }
    if (!selectedCondition) {
      showToast('Please select a condition first.', 'error');
      return;
    }
    try {
      const original = watchDescription;
      const generated = await onGenerateDescription(customContext);
      if (generated) {
        setOriginalDesc(original || '');
        setPendingDescSuggestion(generated);
        setShowPromptInput(false);
        setCustomContext('');
      }
    } catch (e) {
      // Error handled by mutation
    }
  };

  const acceptDescSuggestion = () => {
    if (pendingDescSuggestion) {
      setValue('description', pendingDescSuggestion);
      setPendingDescSuggestion(null);
      setOriginalDesc(null);
      showToast('AI Description applied!', 'success');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Item Condition Grid */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
          Item Condition <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CONDITIONS.map((cond) => {
            const isSelected = selectedCondition === cond.value;
            return (
              <label
                key={cond.value}
                onClick={() => setValue('condition', cond.value)}
                className={`flex flex-col p-4 rounded-2xl border text-left cursor-pointer transition-all duration-300 select-none ${
                  isSelected
                    ? 'bg-brand-50/40 border-brand-500 dark:bg-brand-900/10 dark:border-brand-500 shadow-lg shadow-brand-500/5 scale-[1.01]'
                    : 'bg-slate-50/50 border-slate-200 hover:border-slate-350 dark:bg-darkbg-body/50 dark:border-darkbg-border hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  value={cond.value}
                  {...register('condition', { required: 'Please select item condition' })}
                  className="sr-only"
                />
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {cond.label}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 leading-normal">
                  {cond.desc}
                </span>
              </label>
            );
          })}
        </div>
        {!!errors.condition && (
          <p className="text-xs font-semibold text-red-500 mt-1">{errors.condition.message}</p>
        )}
      </div>

      {/* 3. Description Area */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Detailed Description <span className="text-red-500">*</span>
          </label>
          
          {!showPromptInput && !pendingDescSuggestion && (
            <button
              type="button"
              onClick={() => {
                if (!watchTitle || !selectedCondition) {
                  showToast('Please specify title (Step 1) and condition (Step 2) first.', 'error');
                  return;
                }
                setShowPromptInput(true);
              }}
              disabled={isGeneratingDescription}
              className="px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-650 dark:bg-brand-950/20 dark:hover:bg-brand-900/30 dark:text-brand-400 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
            >
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              <span>Autofill with AI</span>
            </button>
          )}
        </div>

        {/* Optional Custom Context Input */}
        {showPromptInput && (
          <div className="p-4 bg-slate-100 dark:bg-darkbg-body rounded-2xl border border-slate-200 dark:border-darkbg-border flex flex-col gap-2.5 animate-fade-in text-left">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">
              Include specific details for the AI (Optional):
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                placeholder="e.g. 5th edition, minimal markings, highlights, include sleeve..."
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 dark:bg-darkbg-body dark:border-darkbg-border rounded-xl text-xs outline-none text-slate-800 dark:text-slate-200"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDescGenerateClick}
                  disabled={isGeneratingDescription}
                  className="flex-1 sm:flex-none px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
                >
                  {isGeneratingDescription ? 'Generating...' : 'Generate'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPromptInput(false);
                    setCustomContext('');
                  }}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-350 dark:bg-slate-750 dark:hover:bg-slate-700 text-slate-750 dark:text-white text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Description Suggestion Drawer */}
        {pendingDescSuggestion && (
          <div className="rounded-2xl border border-indigo-150 bg-indigo-50/30 p-4 dark:border-brand-500/25 dark:bg-brand-950/10 animate-fade-in space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-indigo-650 dark:text-brand-400">
                <Sparkles className="h-4.5 w-4.5 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider">AI Generated Description</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={acceptDescSuggestion}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white font-bold text-xs rounded-lg hover:bg-emerald-600 transition-colors shadow-sm"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Apply</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingDescSuggestion(null);
                    setOriginalDesc(null);
                  }}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                  title="Discard Suggestion"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-3 text-xs font-medium">
              {originalDesc && originalDesc.trim() && (
                <div className="p-3 rounded-xl bg-white border border-slate-100 dark:bg-darkbg-card dark:border-darkbg-border">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Your Original Description</span>
                  <p className="text-slate-500 mt-1 max-h-24 overflow-y-auto">{originalDesc}</p>
                </div>
              )}
              <div className="p-3.5 rounded-xl bg-white border-2 border-brand-500 dark:bg-darkbg-card">
                <span className="text-[9px] uppercase tracking-wider font-bold text-brand-500 flex items-center gap-1">
                  <span>Gemini Suggestion</span>
                  <Check className="h-3 w-3" />
                </span>
                <p className="text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
                  {pendingDescSuggestion}
                </p>
              </div>
            </div>
          </div>
        )}

        <textarea
          rows={6}
          {...register('description', {
            required: 'Detailed description is required',
            minLength: { value: 10, message: 'Description must be at least 10 characters' },
          })}
          className={`w-full px-4 py-3.5 bg-slate-50 border ${
            errors.description ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-brand-500'
          } dark:bg-darkbg-body dark:border-darkbg-border/80 dark:focus:border-brand-500 rounded-xl outline-none text-sm transition-all text-slate-800 dark:text-slate-200`}
          placeholder="Describe your item. For books/notes, mention authors, highlights, or course code. For electronics, detail functionalities, accessories included, and operational condition."
        />
        {!!errors.description && (
          <p className="text-xs font-semibold text-red-500 mt-1">{errors.description.message}</p>
        )}
      </div>
    </div>
  );
};

export default ConditionAIStep;

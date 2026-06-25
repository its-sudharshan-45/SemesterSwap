import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useCreateListingMutation, useUploadImageMutation } from '../hooks/useListings';
import {
  useGenerateDescriptionMutation,
  useImproveTitleMutation,
} from '../hooks/useAI';
import Button from '../components/ui/Button';
import { showToast } from '../components/ui/Toast';
import { ArrowLeft, Sparkles, ChevronRight, Check } from 'lucide-react';

import CoreDetailsStep from '../components/sell/CoreDetailsStep';
import ConditionAIStep from '../components/sell/ConditionAIStep';
import ImageUploadStep from '../components/sell/ImageUploadStep';
import AiQualityScore from '../components/sell/AiQualityScore';


const CATEGORIES = [
  'Textbooks',
  'Notes',
  'Calculators',
  'Lab Equipment',
  'Electronics',
  'Accessories',
  'Others',
];



const listingSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long').max(100, 'Title cannot exceed 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters long'),
  category: z.string().min(1, 'Please select a category'),
  condition: z.string().min(1, 'Please select the condition'),
  price: z.preprocess((val) => Number(val), z.number().gt(0, 'Price must be greater than zero')),
});

type FormData = z.infer<typeof listingSchema>;

const getSavedFormData = (): any => {
  try {
    const saved = sessionStorage.getItem('create_listing_form');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error(e);
  }
  return {
    title: '',
    description: '',
    category: '',
    condition: '',
    price: undefined,
  };
};

export const CreateListingPage: React.FC = () => {
  const navigate = useNavigate();
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');

  const createListingMutation = useCreateListingMutation();
  const uploadImageMutation = useUploadImageMutation();

  // AI Assistant mutations
  const improveTitleMutation = useImproveTitleMutation();
  const generateDescriptionMutation = useGenerateDescriptionMutation();

  // AI Assistant loader states
  const [isImprovingTitle, setIsImprovingTitle] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  // Wizard state
  const [step, setStep] = useState(1);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: getSavedFormData(),
  });

  const formValues = watch();

  useEffect(() => {
    sessionStorage.setItem('create_listing_form', JSON.stringify(formValues));
  }, [formValues]);

  // Watches for AI context inputs
  const watchTitle = watch('title');
  const selectedCondition = watch('condition');
  const watchDescription = watch('description');

  // AI helper actions
  const handleImproveTitle = async (): Promise<string> => {
    if (!watchTitle) {
      showToast('Please enter a product title first.', 'error');
      return '';
    }
    try {
      setIsImprovingTitle(true);
      const result = await improveTitleMutation.mutateAsync({
        title: watchTitle,
        condition: selectedCondition || undefined,
      });
      return result.improved_title;
    } catch (e) {
      return '';
    } finally {
      setIsImprovingTitle(false);
    }
  };

  const handleGenerateDescription = async (context?: string): Promise<string> => {
    if (!watchTitle) {
      showToast('Please enter a product title first.', 'error');
      return '';
    }
    if (!selectedCondition) {
      showToast('Please select item condition first.', 'error');
      return '';
    }
    try {
      setIsGeneratingDescription(true);
      const result = await generateDescriptionMutation.mutateAsync({
        product_title: watchTitle,
        condition: selectedCondition,
        additional_info: context || undefined,
      });
      return result.description;
    } catch (e) {
      return '';
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleNextStep = async () => {
    if (step === 1) {
      const isValid = await trigger(['title', 'category', 'price']);
      if (isValid) setStep(2);
    } else if (step === 2) {
      const isValid = await trigger(['condition', 'description']);
      if (isValid) setStep(3);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) setStep(step - 1);
  };


  // Handle preview generation and cleanup
  useEffect(() => {
    return () => {
      // Clean up object URLs to avoid memory leaks
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);







  // Generate safe UUID client side
  const generateUUID = (): string => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const onSubmit = async (data: FormData) => {
    // Custom images validation
    if (imageFiles.length < 1) {
      showToast('At least one product image is required.', 'error');
      return;
    }

    try {
      setIsUploading(true);
      const listingId = generateUUID();
      const uploadedUrls: string[] = [];

      // Upload files sequentially
      for (let i = 0; i < imageFiles.length; i++) {
        setUploadProgressText(`Compressing & Uploading image ${i + 1} of ${imageFiles.length}...`);
        const result = await uploadImageMutation.mutateAsync({
          listingId,
          file: imageFiles[i],
        });
        uploadedUrls.push(result.url);
      }

      setUploadProgressText('Creating listing details...');
      
      // Post listing schema validation
      const payload = {
        id: listingId,
        title: data.title,
        description: data.description,
        category: data.category,
        condition: data.condition,
        price: data.price,
        images: uploadedUrls,
      };

      // Ensure it passes type parsing
      listingSchema.parse(data);

      await createListingMutation.mutateAsync(payload);
      sessionStorage.removeItem('create_listing_form');
      
      // Success, route back to my listings
      navigate('/my-listings');
    } catch (err: any) {
      console.error(err);
      // Toast notifications are already shown in useMutation onError hooks
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-left animate-fade-in pb-16">
      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-brand-500 dark:text-slate-500 dark:hover:text-brand-500 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to browse</span>
      </button>

      {/* Header Banner */}
      <div className="border-b border-slate-200/50 dark:border-darkbg-border/50 pb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <span>List an Item for Swap</span>
          <Sparkles className="h-5.5 w-5.5 text-brand-500 animate-pulse" />
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Fill in the details below to publish your listing to college peers.
        </p>

        {/* Wizard Steps indicator */}
        <div className="relative mt-8">
          {/* Progress bar line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 dark:bg-darkbg-border/60 -translate-y-1/2 -z-10" />
          <div 
            className="absolute top-1/2 left-0 h-0.5 bg-brand-500 -translate-y-1/2 -z-10 transition-all duration-300"
            style={{ width: `${((step - 1) / 2) * 100}%` }}
          />

          <div className="flex justify-between">
            {[
              { num: 1, label: 'Core Details' },
              { num: 2, label: 'Quality & AI Polish' },
              { num: 3, label: 'Photos & Review' }
            ].map((s) => {
              const isActive = step === s.num;
              const isCompleted = step > s.num;

              return (
                <div key={s.num} className="flex flex-col items-center">
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 ${
                      isActive
                        ? 'bg-brand-500 border-brand-500 text-white ring-4 ring-brand-500/20'
                        : isCompleted
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'bg-white border-slate-200 text-slate-400 dark:bg-darkbg-card dark:border-darkbg-border/80'
                    }`}
                  >
                    {isCompleted ? <Check className="h-4.5 w-4.5" /> : s.num}
                  </div>
                  <span
                    className={`text-[11px] font-bold mt-2 transition-colors ${
                      isActive
                        ? 'text-brand-500'
                        : isCompleted
                        ? 'text-emerald-500'
                        : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Real-time Listing Quality check showing on Step 2 & 3 */}
      {step > 1 && (
        <div className="animate-fade-in">
          <AiQualityScore
            title={watchTitle}
            description={watchDescription || ''}
            condition={watch('condition')}
            price={watch('price')}
            imageCount={imageFiles.length}
          />
        </div>
      )}

      {/* Form Steps */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white dark:bg-darkbg-card border border-slate-100 dark:border-darkbg-border/60 rounded-3xl p-6 md:p-8 shadow-sm">
          {step === 1 && (
            <div className="animate-fade-in">
              <CoreDetailsStep
                register={register}
                errors={errors}
                watch={watch}
                setValue={setValue}
                categories={CATEGORIES}
                onImproveTitle={handleImproveTitle}
                isImprovingTitle={isImprovingTitle}
              />
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <ConditionAIStep
                register={register}
                errors={errors}
                watch={watch}
                setValue={setValue}
                onGenerateDescription={handleGenerateDescription}
                isGeneratingDescription={isGeneratingDescription}
              />
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <ImageUploadStep
                imageFiles={imageFiles}
                imagePreviews={imagePreviews}
                onChangeFiles={(files, previews) => {
                  setImageFiles(files);
                  setImagePreviews(previews);
                }}
              />
            </div>
          )}
        </div>

        {/* Wizard Controls */}
        <div className="flex gap-4">
          {step === 1 ? (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || isUploading}
              onClick={() => navigate('/my-listings')}
              className="flex-1 py-3 font-semibold rounded-2xl"
            >
              Cancel
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || isUploading}
              onClick={handlePrevStep}
              className="flex-1 py-3 font-semibold rounded-2xl"
            >
              Back
            </Button>
          )}

          {step < 3 ? (
            <Button
              type="button"
              variant="primary"
              onClick={handleNextStep}
              className="flex-[2] py-3 font-bold rounded-2xl shadow-lg shadow-brand-500/10 flex items-center justify-center gap-1.5"
            >
              <span>Continue</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting || isUploading}
              className="flex-[2] py-3 font-bold rounded-2xl shadow-lg shadow-brand-500/10"
            >
              {isUploading ? uploadProgressText : 'Publish Listing'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
export default CreateListingPage;

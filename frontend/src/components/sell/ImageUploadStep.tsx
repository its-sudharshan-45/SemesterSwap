import React, { useRef } from 'react';
import { Upload, X, Star, ShieldAlert } from 'lucide-react';
import { showToast } from '../ui/Toast';

interface ImageUploadStepProps {
  imageFiles: File[];
  imagePreviews: string[];
  onChangeFiles: (files: File[], previews: string[]) => void;
}

export const ImageUploadStep: React.FC<ImageUploadStepProps> = ({
  imageFiles,
  imagePreviews,
  onChangeFiles,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    
    // Check total limit
    if (imageFiles.length + newFiles.length > 5) {
      showToast('Maximum 5 images allowed per listing.', 'error');
      return;
    }

    const validFiles: File[] = [];
    const validPreviews: string[] = [];

    newFiles.forEach((file) => {
      // Validate format
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        showToast(`"${file.name}" is not supported. Only JPEG, PNG, and WEBP are allowed.`, 'error');
        return;
      }
      // Validate size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast(`"${file.name}" exceeds the 5MB limit.`, 'error');
        return;
      }

      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    });

    onChangeFiles(
      [...imageFiles, ...validFiles],
      [...imagePreviews, ...validPreviews]
    );
  };

  const removeImage = (index: number) => {
    // Revoke URL to prevent memory leaks
    URL.revokeObjectURL(imagePreviews[index]);

    const updatedFiles = imageFiles.filter((_, i) => i !== index);
    const updatedPreviews = imagePreviews.filter((_, i) => i !== index);

    onChangeFiles(updatedFiles, updatedPreviews);
  };

  // Reorder cover image by moving the selected index to position 0
  const makeCoverImage = (index: number) => {
    if (index === 0) return;

    const updatedFiles = [...imageFiles];
    const updatedPreviews = [...imagePreviews];

    // Move item to index 0
    const [selectedFile] = updatedFiles.splice(index, 1);
    const [selectedPreview] = updatedPreviews.splice(index, 1);

    updatedFiles.unshift(selectedFile);
    updatedPreviews.unshift(selectedPreview);

    onChangeFiles(updatedFiles, updatedPreviews);
    showToast('Cover photo updated!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Visual Header */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-darkbg-border/40">
        <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
          Upload Product Photos
        </h4>
        <span className="text-xs font-bold text-slate-400 bg-slate-50 dark:bg-darkbg-body/50 border border-slate-100 dark:border-darkbg-border/60 px-3 py-1 rounded-full">
          {imageFiles.length} / 5 photos
        </span>
      </div>

      {/* Drag & Drop Input Zone */}
      {imageFiles.length < 5 && (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-brand-500 dark:border-darkbg-border/70 dark:hover:border-brand-500/80 rounded-2xl py-9 px-4 cursor-pointer transition-colors text-center bg-slate-50/20 dark:bg-darkbg-body/10 hover:bg-slate-50/50 dark:hover:bg-darkbg-body/25">
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="sr-only"
          />
          <Upload className="h-8 w-8 text-slate-400" />
          <span className="font-extrabold text-slate-700 dark:text-slate-350 text-sm mt-3.5">
            Add Photos to Swap
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
            Drag & drop files or click to browse. <br />
            JPEG, PNG, or WEBP supported up to 5MB.
          </span>
        </label>
      )}

      {/* Previews Grid */}
      {imagePreviews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {imagePreviews.map((url, index) => {
            const isCover = index === 0;
            return (
              <div
                key={index}
                className={`aspect-square relative rounded-xl border overflow-hidden bg-slate-50 dark:bg-darkbg-body transition-all duration-300 ${
                  isCover
                    ? 'border-brand-500 shadow-md ring-2 ring-brand-500/10'
                    : 'border-slate-200/50 dark:border-darkbg-border'
                }`}
              >
                <img src={url} alt={`Preview ${index}`} className="h-full w-full object-cover" />
                
                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-red-500 hover:scale-105 active:scale-95 transition-all shadow-md"
                  title="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>

                {/* Make Cover Button / Cover Badge */}
                {isCover ? (
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] font-black text-white bg-brand-500 px-2 py-0.5 rounded-lg flex items-center gap-0.5 shadow-md">
                    <Star className="h-2.5 w-2.5 fill-white" />
                    <span>Cover</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeCoverImage(index)}
                    className="absolute bottom-1.5 left-1.5 text-[9px] font-bold text-slate-700 bg-white/95 dark:text-white dark:bg-darkbg-card/95 hover:bg-brand-500 hover:text-white dark:hover:bg-brand-500 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-darkbg-border/60 transition-all opacity-0 group-hover:opacity-100 md:opacity-100 shadow-md"
                  >
                    Set Cover
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Verification Alert Info */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-200/30 text-xs leading-normal">
        <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
        <div>
          <span className="font-extrabold block mb-0.5">Campus swap regulations:</span>
          Always post photos of the actual item in your possession. Do not upload generic store catalog or stock images, as it violates SemesterSwap's student terms and reduces listing trust scores.
        </div>
      </div>
    </div>
  );
};

export default ImageUploadStep;

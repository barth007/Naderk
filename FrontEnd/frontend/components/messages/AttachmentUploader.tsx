import React, { useRef, useState } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useUploadAttachment } from '@/services/messaging/messaging.hooks';
import { toast } from 'sonner';

interface AttachmentUploaderProps {
  onUploadSuccess: (url: string | null) => void;
  currentUrl: string | null;
}

export function AttachmentUploader({ onUploadSuccess, currentUrl }: AttachmentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadAttachment();
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size exceeds the 5MB limit.');
      return;
    }

    // Validate type (JPG, PNG, PDF)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and PDF formats are supported.');
      return;
    }

    setFileName(file.name);
    
    uploadMutation.mutate(file, {
      onSuccess: (url) => {
        onUploadSuccess(url);
        toast.success('File uploaded successfully.');
      },
      onError: () => {
        setFileName(null);
        toast.error('Failed to upload file. Please try again.');
      }
    });
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUploadSuccess(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isImage = (url: string) => {
    return url.match(/\.(jpeg|jpg|gif|png)$/) != null || url.includes('image');
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".jpg,.jpeg,.png,.pdf"
      />
      
      {!currentUrl && !uploadMutation.isPending && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 hover:border-[#E03E3E] rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-red-50/10 transition-colors"
        >
          <Upload className="w-5 h-5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-700">Attach a photo or document</span>
          <span className="text-[10px] text-gray-400">JPG, PNG, PDF (Max 5MB)</span>
        </button>
      )}

      {uploadMutation.isPending && (
        <div className="w-full border border-gray-100 rounded-xl p-4 flex items-center justify-center gap-3 bg-gray-50/50">
          <Loader2 className="w-4 h-4 text-[#E03E3E] animate-spin" />
          <span className="text-xs text-gray-500 font-medium">Uploading attachment...</span>
        </div>
      )}

      {currentUrl && (
        <div className="w-full border border-gray-100 rounded-xl p-3 flex items-center justify-between bg-gray-50 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-3 overflow-hidden">
            {isImage(currentUrl) ? (
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                <img src={currentUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0 text-[#E03E3E]">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div className="flex flex-col truncate">
              <span className="text-xs font-bold text-gray-900 truncate">
                {fileName || 'Uploaded Attachment'}
              </span>
              <span className="text-[10px] text-green-600 font-semibold mt-0.5">Ready to send</span>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleRemove}
            className="p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-900 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
export default AttachmentUploader;

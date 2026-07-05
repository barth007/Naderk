import React, { useState, useRef } from 'react';
import { Send, Paperclip, X, FileText, Image as ImageIcon, Loader2, Smile } from 'lucide-react';
import { useUploadAttachment } from '@/services/messaging/messaging.hooks';
import { toast } from 'sonner';

interface MessageComposerProps {
  onSend: (content: string, attachmentUrl?: string) => void;
  disabled?: boolean;
}

export function MessageComposer({ onSend, disabled = false }: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadAttachment();

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !attachmentUrl) return;

    onSend(content, attachmentUrl || undefined);
    setContent('');
    setAttachmentUrl(null);
    setAttachmentName(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size exceeds the 5MB limit.');
      return;
    }

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and PDF formats are supported.');
      return;
    }

    setAttachmentName(file.name);
    
    uploadMutation.mutate(file, {
      onSuccess: (url) => {
        setAttachmentUrl(url);
        toast.success('File attached successfully.');
      },
      onError: () => {
        setAttachmentName(null);
        toast.error('Failed to attach file.');
      }
    });
  };

  const handleRemoveAttachment = () => {
    setAttachmentUrl(null);
    setAttachmentName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isImage = (url: string) => {
    return url.match(/\.(jpeg|jpg|gif|png)$/) != null || url.includes('image');
  };

  return (
    <div className="border-t border-gray-100 p-4 bg-white shrink-0">
      {/* File input (hidden) */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".jpg,.jpeg,.png,.pdf"
      />

      <form onSubmit={handleSend} className="flex flex-col gap-2">
        {/* Attachment preview bar */}
        {attachmentName && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50 border border-gray-100 max-w-md mb-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
            <div className="flex items-center gap-2 overflow-hidden text-xs font-semibold text-gray-700">
              {uploadMutation.isPending ? (
                <Loader2 className="w-4 h-4 text-[#E03E3E] animate-spin" />
              ) : attachmentUrl && isImage(attachmentUrl) ? (
                <div className="w-6 h-6 rounded overflow-hidden border border-gray-200 shrink-0">
                  <img src={attachmentUrl} alt="Upload preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <FileText className="w-4 h-4 text-[#E03E3E] shrink-0" />
              )}
              <span className="truncate flex-grow">{attachmentName}</span>
              {uploadMutation.isPending && <span className="text-[10px] text-gray-400 font-medium">Uploading...</span>}
            </div>
            
            <button
              type="button"
              onClick={handleRemoveAttachment}
              className="p-1 hover:bg-gray-200 text-gray-400 hover:text-gray-900 rounded-full transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Integrated Composer Box */}
        <div className="bg-gray-50 border border-gray-100 focus-within:border-gray-200 focus-within:bg-gray-100/50 rounded-md p-1.5 pr-2 pl-3 flex items-center gap-1 transition-all">
          {/* Paperclip Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploadMutation.isPending}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Attach Document (PDF)"
          >
            <Paperclip className="w-4.5 h-4.5" />
          </button>

          {/* Image Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploadMutation.isPending}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Attach Image (JPG, PNG)"
          >
            <ImageIcon className="w-4.5 h-4.5" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            placeholder="Type your message here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={disabled || uploadMutation.isPending}
            className="flex-grow bg-transparent border-none text-sm text-gray-800 focus:outline-none placeholder-gray-400 px-3 h-10"
          />

          {/* Emoji/Smiley Button */}
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Add Emoji"
            onClick={() => setContent(prev => prev + '😊')}
          >
            <Smile className="w-4.5 h-4.5" />
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={disabled || uploadMutation.isPending || (!content.trim() && !attachmentUrl)}
            className="p-2.5 bg-[#E03E3E] text-white rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400 focus:outline-none shadow-sm cursor-pointer shrink-0 flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        
        {/* Encryption Footnote */}
        <span className="text-[10px] text-gray-400 font-semibold mt-1.5 block text-center uppercase tracking-wider">
          All messages are end-to-end encrypted.
        </span>
      </form>
    </div>
  );
}
export default MessageComposer;


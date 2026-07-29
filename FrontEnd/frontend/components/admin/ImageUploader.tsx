'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, ImageIcon, Star } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface ImageUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  prefix?: string; // storage folder, e.g. 'frames' | 'products'
}

/**
 * Multi-image uploader (up to `max`, default 4). Uploads each file to
 * POST /storage/upload/ and stores the returned URLs. The first image is the
 * primary view shown on the product/frame detail page.
 */
export default function ImageUploader({ value, onChange, max = 4, prefix = 'misc' }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = max - value.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) { toast.error(`You can add up to ${max} images.`); return; }

    setUploading(true);
    const uploaded: string[] = [];
    for (const file of toUpload) {
      if (!file.type.startsWith('image/')) { toast.error(`${file.name} is not an image.`); continue; }
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('bucket_type', 'public');
        fd.append('prefix', prefix);
        const res = await apiClient.post('/storage/upload/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        const url = res.data?.data?.url;
        if (url) uploaded.push(url);
      } catch {
        toast.error(`Failed to upload ${file.name}.`);
      }
    }
    setUploading(false);
    if (uploaded.length) onChange([...value, ...uploaded].slice(0, max));
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const makePrimary = (i: number) => {
    if (i === 0) return;
    const next = [...value];
    const [img] = next.splice(i, 1);
    onChange([img, ...next]);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {value.map((url, i) => (
          <div key={url + i} className="relative group aspect-square rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
            <img src={url} alt={`view ${i + 1}`} className="object-contain w-full h-full p-1" />
            {i === 0 && (
              <span className="absolute top-1 left-1 text-[8px] font-bold uppercase bg-[#E03E3E] text-white px-1.5 py-0.5 rounded-full">Primary</span>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
              {i !== 0 && (
                <button type="button" onClick={() => makePrimary(i)} title="Make primary" className="p-1.5 bg-white rounded-full text-gray-700 hover:text-[#E03E3E]">
                  <Star className="w-3.5 h-3.5" />
                </button>
              )}
              <button type="button" onClick={() => remove(i)} title="Remove" className="p-1.5 bg-white rounded-full text-gray-700 hover:text-red-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-lg border-2 border-dashed border-gray-200 hover:border-[#E03E3E] flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-[#E03E3E] transition disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            <span className="text-[9px] font-semibold">{uploading ? 'Uploading…' : 'Add view'}</span>
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
      <p className="text-[10px] text-gray-400 flex items-center gap-1">
        <ImageIcon className="w-3 h-3" /> Up to {max} views (front, side, angle, detail). First image is the primary shown to customers.
      </p>
    </div>
  );
}

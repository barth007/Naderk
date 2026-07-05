import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Calendar, 
  User, 
  ZoomIn, 
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MedicalScan } from '@/services/medical-records/records.types';
import { cn } from '@/lib/cn';

interface ScanPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  scan: MedicalScan | null;
}

export function ScanPreviewModal({ isOpen, onClose, scan }: ScanPreviewModalProps) {
  const [zoom, setZoom] = useState(1);

  if (!isOpen || !scan) return null;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => setZoom(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Dialog container */}
      <div className="bg-zinc-950 rounded-3xl w-full max-w-4xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col max-h-[90vh] border border-zinc-800">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-950">
          <div>
            <h2 className="text-base font-bold text-zinc-100 leading-tight">{scan.scan_type}</h2>
            <p className="text-[10px] text-zinc-500 mt-1 font-semibold">
              Clinical Eye Imaging Scan
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Viewer area */}
        <div className="relative flex-grow flex items-center justify-center bg-zinc-900 p-6 overflow-hidden min-h-[350px]">
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-md rounded-xl p-1.5 border border-zinc-800 z-20">
            <button
              onClick={handleZoomOut}
              className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-all"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] text-zinc-300 font-extrabold px-1.5 min-w-[35px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-all"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1 text-[10px] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg px-2 font-bold border-l border-zinc-800 transition-all"
            >
              Reset
            </button>
          </div>

          <div 
            className="transition-transform duration-200 ease-out max-w-full max-h-[50vh] flex items-center justify-center"
            style={{ transform: `scale(${zoom})` }}
          >
            <img 
              src={scan.image} 
              alt={scan.scan_type}
              className="max-w-full max-h-[50vh] object-contain rounded-lg shadow-2xl border border-zinc-800 select-none"
              draggable={false}
            />
          </div>
        </div>

        {/* Scan Metadata & Footer Details */}
        <div className="bg-zinc-950 p-6 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0 text-xs">
          <div className="flex items-center gap-3 bg-zinc-900/40 p-3.5 rounded-2xl border border-zinc-900">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-zinc-500 font-semibold text-[10px] uppercase">Captured At</p>
              <p className="text-zinc-200 font-bold mt-0.5">
                {new Date(scan.captured_at).toLocaleDateString(undefined, { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-zinc-900/40 p-3.5 rounded-2xl border border-zinc-900">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <p className="text-zinc-500 font-semibold text-[10px] uppercase">Uploaded By</p>
              <p className="text-zinc-200 font-bold mt-0.5">{scan.uploaded_by_name || 'Clinic Optician'}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <a
              href={scan.image}
              target="_blank"
              download={`${scan.scan_type.toLowerCase().replace(/\s+/g, '_')}_scan.jpg`}
              rel="noreferrer"
              className="font-bold text-xs uppercase tracking-wider bg-[#E03E3E] hover:bg-red-700 text-white h-11 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all w-full md:w-auto shadow-lg shadow-red-900/20"
            >
              <Download className="w-4 h-4" />
              Download Image
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
export default ScanPreviewModal;

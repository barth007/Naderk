'use client';

import React, { useEffect, useState } from 'react';
import { X, FileDown, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { medicalRecordsApi } from '@/services/medical-records/records.api';
import { toast } from 'sonner';

/**
 * Preview and download the generated prescription PDF.
 *
 * The dashboard used to link straight at `prescription_file`, the Cloudinary
 * upload — which is no longer used and simply 404s. The PDF is generated
 * server-side from the prescription record instead, so it carries the current
 * branding and the values as they stand.
 */
export function PrescriptionPdfModal({
  prescriptionId, onClose,
}: {
  prescriptionId: string | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!prescriptionId) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    setUrl(null);
    setError(false);

    medicalRecordsApi
      .prescriptionPdfPreviewUrl(prescriptionId)
      .then((u) => {
        objectUrl = u;
        // Revoke immediately if the modal closed while the request was in
        // flight, or the blob leaks for the life of the tab.
        if (cancelled) { window.URL.revokeObjectURL(u); return; }
        setUrl(u);
      })
      .catch(() => { if (!cancelled) setError(true); });

    return () => {
      cancelled = true;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [prescriptionId]);

  if (!prescriptionId) return null;

  const download = async () => {
    setDownloading(true);
    try {
      await medicalRecordsApi.downloadPrescriptionPdf(prescriptionId);
    } catch {
      toast.error('Could not download the prescription PDF.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl relative z-10 flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 leading-tight">Prescription</h2>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">
              Ref: RX-{prescriptionId.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-grow overflow-hidden bg-slate-100 min-h-[60vh]">
          {error ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8">
              <AlertCircle className="w-8 h-8 text-gray-300" />
              <p className="text-sm font-bold text-gray-700">Could not load the prescription.</p>
              <p className="text-xs text-gray-500 max-w-sm">
                Please try again, or contact support if it keeps failing.
              </p>
            </div>
          ) : !url ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#E03E3E]" />
              <p className="text-xs text-gray-500 font-semibold">Preparing your prescription…</p>
            </div>
          ) : (
            <iframe src={url} title="Prescription preview" className="w-full h-full min-h-[60vh]" />
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="font-semibold text-xs uppercase tracking-wider h-10 rounded-xl"
          >
            Close
          </Button>
          <Button
            onClick={download}
            disabled={downloading || error}
            className="bg-[#E03E3E] text-white font-semibold text-xs uppercase tracking-wider h-10 rounded-xl"
          >
            {downloading
              ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              : <FileDown className="w-4 h-4 mr-1.5" />}
            Download PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PrescriptionPdfModal;

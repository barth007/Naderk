'use client';

import React from 'react';
import { X, FileDown, Pill, Glasses, Calendar, User, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { medicalRecordsApi } from '@/services/medical-records/records.api';
import type { EyewearPrescription } from '@/services/medical-records/records.types';
import type { Medication } from '@/services/medical-records/records.hooks';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';

/**
 * Full detail for one prescription.
 *
 * The records dashboard listed prescriptions as a single summary line — for
 * eyewear only right_sph/left_sph, for medications only "dosage — frequency" —
 * with no way to open them. Everything else the API already returns (the rest
 * of the Rx grid, pupillary distance, segment/fitting heights, review status,
 * expiry, prescriber, the PDF) was fetched and thrown away.
 */

type Selection =
  | { kind: 'EYEWEAR'; rx: EyewearPrescription }
  | { kind: 'MEDICATION'; med: Medication };

const RX_STATUS_STYLES: Record<EyewearPrescription['status'], string> = {
  APPROVED: 'bg-emerald-50 text-emerald-600',
  PENDING_REVIEW: 'bg-yellow-50 text-yellow-700',
  UNDER_REVIEW: 'bg-blue-50 text-blue-600',
  REQUIRES_CORRECTION: 'bg-orange-50 text-orange-600',
  REJECTED: 'bg-red-50 text-red-600',
};

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold text-gray-900">{value ?? '—'}</p>
    </div>
  );
}

export function PrescriptionDetailModal({
  selection,
  onClose,
}: {
  selection: Selection | null;
  onClose: () => void;
}) {
  if (!selection) return null;

  const isEyewear = selection.kind === 'EYEWEAR';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />

      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            {isEyewear ? (
              <Glasses className="w-5 h-5 text-[#E03E3E]" />
            ) : (
              <Pill className="w-5 h-5 text-emerald-500" />
            )}
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                {isEyewear ? 'Eyewear Prescription' : 'Medication'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5 font-semibold">
                {isEyewear
                  ? `Issued ${formatDate(selection.rx.created_at)}`
                  : selection.med.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-grow space-y-5 bg-slate-50/50">
          {isEyewear ? (
            <EyewearBody rx={selection.rx} />
          ) : (
            <MedicationBody med={selection.med} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
          {isEyewear ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  await medicalRecordsApi.downloadPrescriptionPdf(selection.rx.id);
                } catch {
                  toast.error('Could not download the prescription PDF.');
                }
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-[#E03E3E] hover:text-red-700 transition-colors"
            >
              <FileDown className="w-4 h-4" /> Download PDF
            </button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="font-semibold text-xs uppercase tracking-wider h-10 rounded-xl"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function EyewearBody({ rx }: { rx: EyewearPrescription }) {
  const expiry = formatDate(rx.expires_at);
  const expired = rx.expires_at ? new Date(rx.expires_at) < new Date() : false;

  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'text-[10px] px-2 py-0.5 rounded-full font-bold',
            RX_STATUS_STYLES[rx.status] ?? 'bg-gray-100 text-gray-500',
          )}
        >
          {rx.status.replace(/_/g, ' ')}
        </span>
        {expired && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-50 text-red-600">
            EXPIRED
          </span>
        )}
      </div>

      {/* Rx grid */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-slate-50 text-gray-500 font-bold border-b border-gray-100">
              <th className="p-2.5">Eye</th>
              <th className="p-2.5">SPH</th>
              <th className="p-2.5">CYL</th>
              <th className="p-2.5">AXIS</th>
              <th className="p-2.5">ADD</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-50">
              <td className="p-2.5 font-bold text-gray-900">OD (Right)</td>
              <td className="p-2.5">{rx.right_sph || '—'}</td>
              <td className="p-2.5">{rx.right_cyl || '—'}</td>
              <td className="p-2.5">{rx.right_axis ?? '—'}</td>
              <td className="p-2.5">{rx.right_add || '—'}</td>
            </tr>
            <tr>
              <td className="p-2.5 font-bold text-gray-900">OS (Left)</td>
              <td className="p-2.5">{rx.left_sph || '—'}</td>
              <td className="p-2.5">{rx.left_cyl || '—'}</td>
              <td className="p-2.5">{rx.left_axis ?? '—'}</td>
              <td className="p-2.5">{rx.left_add || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Measurements */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-2 gap-4">
        <Field label="Pupillary Distance" value={rx.pupillary_distance ? `${rx.pupillary_distance} mm` : null} />
        <Field label="Near PD" value={rx.near_pd ? `${rx.near_pd} mm` : null} />
        <Field label="Segment Height" value={rx.segment_height ? `${rx.segment_height} mm` : null} />
        <Field label="Fitting Height" value={rx.fitting_height ? `${rx.fitting_height} mm` : null} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-2 gap-4">
        <Field
          label="Issued"
          value={
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {formatDate(rx.created_at)}
            </span>
          }
        />
        <Field label="Expires" value={expiry} />
      </div>

      {rx.prescription_file && (
        <a
          href={rx.prescription_file}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs font-bold text-[#E03E3E] hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" /> View uploaded prescription file
        </a>
      )}
    </>
  );
}

function MedicationBody({ med }: { med: Medication }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'text-[10px] px-2 py-0.5 rounded-full font-bold',
            med.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500',
          )}
        >
          {med.status}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
        <Field label="Medication" value={med.name} />
        <Field label="Dosage" value={med.dosage} />
        <div className="space-y-0.5">
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
            Directions (SIG)
          </p>
          <p className="text-sm text-gray-700 font-medium leading-relaxed">
            {med.frequency || '—'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 grid grid-cols-2 gap-4">
        <Field
          label="Start Date"
          value={
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {formatDate(med.start_date)}
            </span>
          }
        />
        <Field label="End Date" value={formatDate(med.end_date)} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <Field
          label="Prescribed By"
          value={
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-gray-400" />
              {med.prescribed_by_name || '—'}
            </span>
          }
        />
      </div>
    </>
  );
}

export default PrescriptionDetailModal;

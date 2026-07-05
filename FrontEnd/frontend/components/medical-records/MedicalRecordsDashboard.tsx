'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  ArrowLeft,
  FileText,
  Download,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Link2,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  useMedicalRecordsOverview,
  useMedicalEncounters,
  useMedicalPrescriptions,
  useMedicalDiagnostics,
  useMedicalScans
} from '@/services/medical-records/records.hooks';
import { medicalRecordsApi } from '@/services/medical-records/records.api';
import { MedicalRecordSummaryModal } from './MedicalRecordSummaryModal';
import { ScanPreviewModal } from './ScanPreviewModal';
import { MedicalScan } from '@/services/medical-records/records.types';
import { cn } from '@/lib/cn';

interface MedicalRecordsDashboardProps {
  mode: 'PATIENT' | 'DOCTOR';
  patientId?: string;
}

export function MedicalRecordsDashboard({ mode, patientId }: MedicalRecordsDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedEncounter = searchParams.get('selected_encounter');

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [encountersPage, setEncountersPage] = useState(1);
  const [prescriptionsPage, setPrescriptionsPage] = useState(1);
  const [diagnosticsPage, setDiagnosticsPage] = useState(1);
  const [scansPage, setScansPage] = useState(1);

  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [selectedScan, setSelectedScan] = useState<MedicalScan | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setEncountersPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    if (preSelectedEncounter) setSelectedEncounterId(preSelectedEncounter);
  }, [preSelectedEncounter]);

  const { data: overview, isLoading: isOverviewLoading, error: overviewError } = useMedicalRecordsOverview(patientId);
  const { data: encountersResponse, isLoading: isEncountersLoading } = useMedicalEncounters({ patient_id: patientId, search: debouncedSearch, page: encountersPage });
  const { data: prescriptionsResponse, isLoading: isPrescriptionsLoading } = useMedicalPrescriptions({ patient_id: patientId, page: prescriptionsPage });
  const { data: diagnosticsResponse, isLoading: isDiagnosticsLoading } = useMedicalDiagnostics({ patient_id: patientId, page: diagnosticsPage });
  const { data: scansResponse, isLoading: isScansLoading } = useMedicalScans({ patient_id: patientId, page: scansPage });

  if (isOverviewLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-10 h-10 text-[#E03E3E] animate-spin" />
        <p className="text-sm font-semibold text-gray-500">Retrieving health records...</p>
      </div>
    );
  }

  if (overviewError) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-2 text-center p-4">
        <p className="text-red-600 font-bold text-base">Unable to access medical records.</p>
        <p className="text-gray-400 text-xs max-w-md">
          You may not have authorization to view this patient's history, or they have no records assigned.
        </p>
        {mode === 'DOCTOR' && (
          <Button onClick={() => router.push('/doctor/dashboard')} variant="outline" className="mt-4 rounded-md">
            Back to Dashboard
          </Button>
        )}
      </div>
    );
  }

  const isHistoryEmpty =
    !overview || (
      (!overview.recent_encounters || overview.recent_encounters.length === 0) &&
      (!overview.active_medications || overview.active_medications.length === 0) &&
      (!overview.recent_diagnostics || overview.recent_diagnostics.length === 0) &&
      (!overview.recent_scans || overview.recent_scans.length === 0) &&
      (!overview.eyewear_prescriptions || overview.eyewear_prescriptions.length === 0)
    );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 select-none">

      {/* Header */}
      <div className="flex items-center gap-3">
        {mode === 'DOCTOR' && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/doctor/dashboard')}
            className="rounded-full w-9 h-9 border-gray-200 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
            {mode === 'PATIENT' ? 'Your Health History' : `Patient: ${overview?.patient_info?.name || '—'}`}
          </h1>
          <p className="text-gray-500 text-sm mt-1 font-semibold">
            {mode === 'PATIENT'
              ? 'Access clinical summaries, prescriptions, and lab results in one place.'
              : `Clinical dashboard history · ID: ${overview?.patient_info?.patient_id || '—'}`}
          </p>
        </div>
      </div>

      {isHistoryEmpty ? (
        <div className="py-12">
          <EmptyState
            role={mode}
            configKey="NO_RECORDS"
            actionLabel={mode === 'PATIENT' ? 'Book Appointment' : undefined}
            onAction={mode === 'PATIENT' ? () => router.push('/dashboard/appointments') : undefined}
            className="max-w-xl mx-auto"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* LEFT COLUMN — Visit Notes + Diagnostic Results */}
          <div className="lg:col-span-8 space-y-8">

            {/* Recent Visit Notes */}
            <div>
              <h3 className="font-extrabold text-gray-900 text-base mb-4">Recent Visit Notes</h3>
              <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)]">
                {isEncountersLoading ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="w-6 h-6 text-[#E03E3E] animate-spin" />
                  </div>
                ) : !encountersResponse || encountersResponse.results.length === 0 ? (
                  <div className="p-6">
                    <EmptyState role={mode} configKey="NO_ENCOUNTERS" />
                  </div>
                ) : (
                  <div>
                    {encountersResponse.results.map((enc, idx) => (
                      <div
                        key={enc.id}
                        onClick={() => setSelectedEncounterId(enc.id)}
                        className={cn(
                          "flex items-center gap-4 px-6 py-4 hover:bg-gray-50/60 cursor-pointer transition-colors group",
                          idx < encountersResponse.results.length - 1 && "border-b border-gray-100"
                        )}
                      >
                        {/* Icon */}
                        <div className="w-9 h-9 rounded-md bg-[#faeaea] text-[#E03E3E] flex items-center justify-center shrink-0">
                          <Link2 className="w-4 h-4 rotate-45" />
                        </div>

                        {/* Info */}
                        <div className="flex-grow min-w-0">
                          <h4 className="text-sm font-extrabold text-gray-900 group-hover:text-[#E03E3E] transition-colors truncate">
                            {enc.diagnosis || 'Clinical Consultation'}
                          </h4>
                          <p className="text-xs text-gray-400 font-semibold mt-0.5">
                            Ref: #{enc.reference_number} &nbsp;·&nbsp; Dr. {enc.doctor_detail.first_name} {enc.doctor_detail.last_name}
                          </p>
                        </div>

                        {/* Download */}
                        <a
                          href={medicalRecordsApi.getPrescriptionPdfUrl(enc.id)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1.5 text-[#E03E3E] text-xs font-bold hover:underline shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download PDF
                        </a>
                      </div>
                    ))}

                    {/* Pagination */}
                    {encountersResponse.count > 10 && (
                      <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 text-xs font-bold text-gray-500">
                        <Button variant="outline" size="sm" disabled={encountersPage === 1} onClick={() => setEncountersPage(p => p - 1)} className="rounded-md flex items-center gap-1">
                          <ChevronLeft className="w-3.5 h-3.5" /> Previous
                        </Button>
                        <span>Page {encountersPage} of {Math.ceil(encountersResponse.count / 10)}</span>
                        <Button variant="outline" size="sm" disabled={encountersPage * 10 >= encountersResponse.count} onClick={() => setEncountersPage(p => p + 1)} className="rounded-md flex items-center gap-1">
                          Next <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>

            {/* Diagnostic Results */}
            <div>
              <h3 className="font-extrabold text-gray-900 text-base mb-4">Diagnostic Results</h3>
              {isDiagnosticsLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 text-[#E03E3E] animate-spin" />
                </div>
              ) : !diagnosticsResponse || diagnosticsResponse.results.length === 0 ? (
                <EmptyState role={mode} configKey="NO_DIAGNOSTICS" />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {diagnosticsResponse.results.map((diag) => (
                      <Card key={diag.id} className="p-4 bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                            {diag.category || 'Lab Test'}
                          </span>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-sm",
                            diag.status === 'READY' ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50'
                          )}>
                            {diag.status}
                          </span>
                        </div>
                        <h4 className="text-sm font-extrabold text-gray-900">{diag.test_name}</h4>
                        <p className="text-xs text-gray-500 font-semibold">
                          Tested: {new Date(diag.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                        {diag.result_summary && (
                          <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-md border border-gray-100">
                            {diag.result_summary}
                          </p>
                        )}
                        {diag.attachments && diag.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {diag.attachments.map(att => (
                              <a key={att.id} href={att.file} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#E03E3E] text-[10px] font-bold hover:underline">
                                <Download className="w-3 h-3" /> {att.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>

                  {diagnosticsResponse.count > 10 && (
                    <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                      <Button variant="outline" size="sm" disabled={diagnosticsPage === 1} onClick={() => setDiagnosticsPage(p => p - 1)} className="rounded-md">Previous</Button>
                      <span>Page {diagnosticsPage} of {Math.ceil(diagnosticsResponse.count / 10)}</span>
                      <Button variant="outline" size="sm" disabled={diagnosticsPage * 10 >= diagnosticsResponse.count} onClick={() => setDiagnosticsPage(p => p + 1)} className="rounded-md">Next</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN — Prescriptions + Scans + Privacy Note */}
          <div className="lg:col-span-4 space-y-6">

            {/* Prescriptions: Active Eyewear + Medications combined */}
            <div>
              <h3 className="font-extrabold text-gray-900 text-base mb-4">Prescriptions</h3>
              <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)] overflow-hidden">

                {/* Active Eyewear sub-section */}
                {isPrescriptionsLoading ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="w-6 h-6 text-[#E03E3E] animate-spin" />
                  </div>
                ) : (
                  <>
                    {prescriptionsResponse && prescriptionsResponse.results.length > 0 && (
                      <div>
                        <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100">
                          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Active Eyewear</span>
                        </div>
                        {prescriptionsResponse.results.map((rx, idx) => (
                          <div key={rx.id} className={cn("px-5 py-3.5 flex items-start justify-between", idx < prescriptionsResponse.results.length - 1 && "border-b border-gray-100")}>
                            <div className="space-y-0.5">
                              <h4 className="text-sm font-extrabold text-gray-900">Distance Vision</h4>
                              <p className="text-xs text-gray-400 font-semibold">
                                OD:{rx.right_sph || '—'} &nbsp;OS:{rx.left_sph || '—'}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap ml-2 mt-0.5">
                              {new Date(rx.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Medications sub-section */}
                    {overview?.active_medications && overview.active_medications.length > 0 && (
                      <div>
                        <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 border-t border-t-gray-100">
                          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Medications</span>
                        </div>
                        {overview.active_medications.map((med, idx) => (
                          <div key={med.id} className={cn("px-5 py-3.5 flex items-start justify-between", idx < overview.active_medications.length - 1 && "border-b border-gray-100")}>
                            <div className="space-y-0.5">
                              <h4 className="text-sm font-extrabold text-gray-900">{med.name}</h4>
                              <p className="text-xs text-gray-400 font-semibold">{med.dosage} — {med.frequency}</p>
                            </div>
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-sm whitespace-nowrap ml-2 mt-0.5">
                              ACTIVE
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {(!prescriptionsResponse || prescriptionsResponse.results.length === 0) && (!overview?.active_medications || overview.active_medications.length === 0) && (
                      <div className="p-6">
                        <EmptyState role={mode} configKey="NO_PRESCRIPTIONS" />
                      </div>
                    )}
                  </>
                )}
              </Card>
            </div>

            {/* Recent Scans */}
            <div>
              <h3 className="font-extrabold text-gray-900 text-base mb-4">Recent Scans</h3>
              {isScansLoading ? (
                <div className="py-6 flex justify-center">
                  <Loader2 className="w-6 h-6 text-[#E03E3E] animate-spin" />
                </div>
              ) : !scansResponse || scansResponse.results.length === 0 ? (
                <EmptyState role={mode} configKey="NO_SCANS" />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {scansResponse.results.map(scan => (
                      <div
                        key={scan.id}
                        onClick={() => setSelectedScan(scan)}
                        className="rounded-md overflow-hidden cursor-pointer hover:shadow-md transition-all group relative"
                      >
                        <div className="h-28 w-full relative bg-black">
                          <img src={scan.image} alt={scan.scan_type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80" />
                          {/* Overlay label */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-[11px] font-bold text-white truncate">{scan.scan_type}</p>
                            <p className="text-[9px] text-white/70">{new Date(scan.captured_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {scansResponse.count > 10 && (
                    <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                      <Button variant="outline" size="sm" disabled={scansPage === 1} onClick={() => setScansPage(p => p - 1)} className="rounded-md">Previous</Button>
                      <span>Page {scansPage} of {Math.ceil(scansResponse.count / 10)}</span>
                      <Button variant="outline" size="sm" disabled={scansPage * 10 >= scansResponse.count} onClick={() => setScansPage(p => p + 1)} className="rounded-md">Next</Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Privacy Note */}
            <Card className="p-4 bg-[#FEF6F6] border border-red-100 rounded-md flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-white border border-red-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-[#E03E3E]" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-[#E03E3E]">Privacy Note</h4>
                <p className="text-[11px] text-gray-500 font-semibold mt-0.5 leading-relaxed">
                  Your medical records are encrypted and protected. Only authorized medical staff have access.
                </p>
              </div>
            </Card>

          </div>
        </div>
      )}

      {/* Summary Modal */}
      {selectedEncounterId && (
        <MedicalRecordSummaryModal
          isOpen={!!selectedEncounterId}
          onClose={() => {
            setSelectedEncounterId(null);
            if (preSelectedEncounter) {
              const url = new URL(window.location.href);
              url.searchParams.delete('selected_encounter');
              window.history.replaceState({}, '', url.toString());
            }
          }}
          encounterId={selectedEncounterId}
          mode={mode}
          patientId={patientId}
        />
      )}

      {/* Scan Preview Modal */}
      {selectedScan && (
        <ScanPreviewModal
          isOpen={!!selectedScan}
          onClose={() => setSelectedScan(null)}
          scan={selectedScan}
        />
      )}
    </div>
  );
}

export default MedicalRecordsDashboard;

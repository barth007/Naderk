import React from 'react';
import { 
  X, 
  Calendar, 
  User, 
  Download, 
  FileText, 
  Pill, 
  Clipboard, 
  Image as ImageIcon,
  Loader2,
  FileDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useMedicalEncounterDetail } from '@/services/medical-records/records.hooks';
import { medicalRecordsApi } from '@/services/medical-records/records.api';
import { cn } from '@/lib/cn';
import Link from 'next/link';

interface MedicalRecordSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  encounterId: string;
  mode: 'PATIENT' | 'DOCTOR';
  patientId?: string;
}

export function MedicalRecordSummaryModal({ 
  isOpen, 
  onClose, 
  encounterId, 
  mode,
  patientId
}: MedicalRecordSummaryModalProps) {
  const { data: encounter, isLoading, error } = useMedicalEncounterDetail(encounterId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      
      {/* Dialog container */}
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Consultation Record</h2>
            <p className="text-xs text-gray-400 mt-1 font-semibold">
              Ref: {encounter?.reference_number || 'Loading...'}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-grow space-y-6 bg-slate-50/50">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#E03E3E] animate-spin" />
              <p className="text-xs text-gray-500 font-semibold">Loading consultation details...</p>
            </div>
          )}

          {error && (
            <div className="py-8 text-center text-red-600">
              <p className="text-sm font-bold">Failed to load record details.</p>
              <p className="text-xs text-gray-400 mt-1">Please check your permissions and try again.</p>
            </div>
          )}

          {encounter && (
            <>
              {/* Doctor and Date Section */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.01)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar 
                    src={encounter.doctor_detail.avatar} 
                    alt={encounter.doctor_detail.last_name}
                    fallback={`${encounter.doctor_detail.first_name[0]}${encounter.doctor_detail.last_name[0]}`}
                    size="md"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">
                      Dr. {encounter.doctor_detail.first_name} {encounter.doctor_detail.last_name}
                    </h4>
                    <p className="text-xs text-gray-400 font-medium">{encounter.doctor_detail.specialization}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5 text-gray-600 text-xs font-semibold justify-end">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(encounter.created_at).toLocaleDateString(undefined, { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">Consultation Date</p>
                </div>
              </div>

              {/* Complaints & Findings */}
              {encounter.complaints && (
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.01)]">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Patient Complaints</h3>
                  <p className="text-sm text-gray-700 leading-relaxed font-medium">{encounter.complaints}</p>
                </div>
              )}

              {/* Diagnosis & Clinical Findings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.01)]">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-blue-500" /> Diagnosis
                  </h3>
                  <p className="text-sm text-gray-800 font-bold leading-relaxed">{encounter.diagnosis || 'No diagnosis logged.'}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.01)]">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Clipboard className="w-3.5 h-3.5 text-indigo-500" /> Clinical Findings
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed font-medium">
                    {encounter.clinical_findings || 'No specific findings logged.'}
                  </p>
                </div>
              </div>

              {/* Eyewear Prescriptions */}
              {encounter.eyewear_prescriptions && encounter.eyewear_prescriptions.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.01)] space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Eyewear Prescription</h3>
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
                      Active
                    </span>
                  </div>

                  {encounter.eyewear_prescriptions.map((rx) => (
                    <div key={rx.id} className="space-y-3">
                      {/* Grid RX parameters */}
                      <div className="overflow-x-auto border border-gray-100 rounded-xl">
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
                              <td className="p-2.5">{rx.right_sph || '-'}</td>
                              <td className="p-2.5">{rx.right_cyl || '-'}</td>
                              <td className="p-2.5">{rx.right_axis || '-'}</td>
                              <td className="p-2.5">{rx.right_add || '-'}</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 font-bold text-gray-900">OS (Left)</td>
                              <td className="p-2.5">{rx.left_sph || '-'}</td>
                              <td className="p-2.5">{rx.left_cyl || '-'}</td>
                              <td className="p-2.5">{rx.left_axis || '-'}</td>
                              <td className="p-2.5">{rx.left_add || '-'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center justify-between text-xs font-semibold text-gray-600 bg-slate-50 p-2.5 rounded-xl border border-gray-100">
                        <span>Pupillary Distance: <span className="text-gray-900 font-bold">{rx.pupillary_distance} mm</span></span>
                        <a 
                          href={medicalRecordsApi.getPrescriptionPdfUrl(rx.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[#E03E3E] hover:text-red-700 transition-colors"
                        >
                          <FileDown className="w-4 h-4" /> Download PDF
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Medications List */}
              {encounter.medications && encounter.medications.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.01)]">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                    <Pill className="w-4 h-4 text-emerald-500" /> Prescribed Medications
                  </h3>
                  <div className="divide-y divide-gray-50 space-y-2.5">
                    {encounter.medications.map((med) => (
                      <div key={med.id} className="pt-2.5 first:pt-0 flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-gray-950">{med.name}</h4>
                          <p className="text-xs text-gray-500 mt-0.5 font-medium">
                            {med.dosage} — {med.frequency}
                          </p>
                        </div>
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-bold",
                          med.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                        )}>
                          {med.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diagnostic Results */}
              {encounter.diagnostics && encounter.diagnostics.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.01)]">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Diagnostic Results</h3>
                  <div className="space-y-4 divide-y divide-gray-50">
                    {encounter.diagnostics.map((diag) => (
                      <div key={diag.id} className="pt-3 first:pt-0 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-gray-900">{diag.test_name} ({diag.category})</h4>
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-bold",
                            diag.status === 'READY' ? 'bg-emerald-50 text-emerald-600' : 
                            diag.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
                          )}>
                            {diag.status.replace('_', ' ')}
                          </span>
                        </div>
                        {diag.result_summary && (
                          <p className="text-xs text-gray-600 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-gray-100">
                            {diag.result_summary}
                          </p>
                        )}
                        {diag.attachments && diag.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {diag.attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.file}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 bg-[#FEF6F6] text-[#E03E3E] text-[11px] font-bold px-3 py-1.5 rounded-lg border border-red-50 hover:bg-red-50 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                {att.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Medical Scans */}
              {encounter.scans && encounter.scans.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.01)]">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                    <ImageIcon className="w-4 h-4 text-purple-500" /> Uploaded Clinical Scans
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {encounter.scans.map((scan) => (
                      <div key={scan.id} className="border border-gray-100 rounded-xl overflow-hidden bg-slate-50">
                        <div className="h-32 w-full overflow-hidden relative group">
                          <img 
                            src={scan.image} 
                            alt={scan.scan_type} 
                            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                          />
                        </div>
                        <div className="p-2 text-center border-t border-gray-50 bg-white">
                          <p className="text-xs font-bold text-gray-900 truncate">{scan.scan_type}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(scan.captured_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow up Recommendations */}
              {(encounter.recommendations || encounter.follow_up_date) && (
                <div className="bg-[#FEF6F6]/30 p-5 rounded-2xl border border-red-100/50">
                  <h3 className="text-xs font-bold text-[#E03E3E] uppercase tracking-wider mb-2">Recommendations & Follow-up</h3>
                  {encounter.recommendations && (
                    <p className="text-xs text-gray-700 leading-relaxed font-semibold">{encounter.recommendations}</p>
                  )}
                  {encounter.follow_up_date && (
                    <p className="text-xs text-gray-500 font-bold mt-2">
                      Suggested Follow-up Date: <span className="text-gray-900 font-extrabold">{new Date(encounter.follow_up_date).toLocaleDateString()}</span>
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="font-semibold text-xs uppercase tracking-wider h-10 rounded-xl"
          >
            Close
          </Button>

          {encounter && (
            <Link
              href={
                mode === 'PATIENT' 
                  ? `/dashboard/records?selected_encounter=${encounter.id}` 
                  : `/doctor/records/${patientId}?selected_encounter=${encounter.id}`
              }
              onClick={onClose}
              className="font-bold text-xs uppercase tracking-wider bg-[#E03E3E] hover:bg-red-700 h-10 px-6 rounded-xl flex items-center justify-center text-white transition-all shadow-sm"
            >
              View Full Record
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}
export default MedicalRecordSummaryModal;

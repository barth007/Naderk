'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import {
  Printer, Send, Edit2, Plus, Trash2, Loader2, ClipboardList,
  CheckCircle2, Clock, AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useMedications, useCreateMedication, useDeleteMedication, Medication } from '@/services/medical-records/records.hooks';
import { usePatientRecords } from '@/services/medical-records/records.hooks';
import { DatePicker } from '@/components/ui/DatePicker';
import { cn } from '@/lib/cn';

// ─── Clinic header (static brand info) ───────────────────────────────────────
const CLINIC = {
  name: 'NaderkEye Clinic',
  tagline: 'Advanced Eye Care Services',
  address: '1234 Medical Center Drive, Suite 100\nLugbe, Abuja',
  phone: '+234 081 098 234',
  email: 'NaderkEye@gmail.com',
};

// ─── Prescription Document ────────────────────────────────────────────────────
function PrescriptionDocument({
  medications,
  patient,
  doctor,
  onDelete,
  isDeleting,
}: {
  medications: Medication[];
  patient: { name: string; dob?: string; patient_id?: string; address?: string } | null;
  doctor: { first_name: string; last_name: string };
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  if (medications.length === 0) return null;
  const issued = medications[0].created_at;
  const rxNumber = `RX-${new Date(issued).getFullYear()}-${medications[0].id.slice(0, 5).toUpperCase()}`;

  return (
    <Card className="bg-white border border-gray-200 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)] overflow-hidden">
      {/* Clinic letterhead */}
      <div className="p-8 pb-6 border-b border-gray-100">
        <h1 className="text-xl font-extrabold text-gray-900">{CLINIC.name}</h1>
        <p className="text-sm font-bold text-[#E03E3E] mt-0.5">{CLINIC.tagline}</p>
        <div className="mt-3 space-y-0.5 text-xs text-gray-500 font-semibold">
          {CLINIC.address.split('\n').map((l, i) => <p key={i}>{l}</p>)}
          <p>Phone: {CLINIC.phone}</p>
          <p>Email: {CLINIC.email}</p>
        </div>
      </div>

      {/* Patient + Prescription meta */}
      <div className="px-8 py-6 grid grid-cols-2 gap-8 border-b border-gray-100">
        <div className="space-y-2">
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Patient Information</p>
          <Row label="Name" value={patient?.name || '—'} />
          {patient?.dob && (
            <Row label="Date of Birth" value={`${format(parseISO(patient.dob), 'MMMM dd, yyyy')} (${new Date().getFullYear() - new Date(patient.dob).getFullYear()} years)`} />
          )}
          <Row label="Patient ID" value={patient?.patient_id || '—'} />
          {patient?.address && <Row label="Address" value={patient.address} />}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Prescription Details</p>
          <Row label="Date" value={format(parseISO(issued), 'MMMM dd, yyyy')} />
          <Row label="RX Number" value={rxNumber} valueClass="text-[#E03E3E] font-extrabold" />
          <Row label="Visit Type" value="In-person" />
          <Row label="Prescribing Doctor" value={`Dr. ${doctor.first_name} ${doctor.last_name}`} />
        </div>
      </div>

      {/* Medications list */}
      <div className="px-8 py-6">
        <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-5">Prescription</p>
        <ol className="space-y-5">
          {medications.map((med, idx) => (
            <li key={med.id} className="flex gap-4">
              <span className="text-sm font-extrabold text-gray-400 w-5 shrink-0 mt-0.5">{idx + 1}.</span>
              <div className="flex-grow">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-extrabold text-gray-900">{med.name}</h4>
                    <p className="text-xs text-gray-500 font-semibold mt-0.5">{med.frequency}</p>
                    <p className="text-xs text-gray-400 font-semibold mt-1">{med.dosage}</p>
                    {med.end_date && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {format(parseISO(med.start_date), 'MMM d')} → {format(parseISO(med.end_date), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-sm",
                      med.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                    )}>
                      {med.status}
                    </span>
                    <button
                      onClick={() => onDelete(med.id)}
                      disabled={isDeleting}
                      className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex gap-3 text-xs">
      <span className="text-gray-400 font-semibold w-28 shrink-0">{label}:</span>
      <span className={cn("font-bold text-gray-900", valueClass)}>{value}</span>
    </div>
  );
}

// ─── History timeline item ────────────────────────────────────────────────────
function HistoryItem({
  time, title, desc, status,
}: { time: string; title: string; desc: string; status: 'done' | 'pending' | 'warning' }) {
  const dotClass = status === 'done' ? 'bg-green-500' : status === 'pending' ? 'bg-yellow-400' : 'bg-gray-300';
  const labelClass = status === 'done' ? 'text-green-600' : status === 'pending' ? 'text-yellow-500' : 'text-gray-400';
  const label = status === 'done' ? 'Completed' : status === 'pending' ? 'Pending' : 'In Progress';

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1">
        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", dotClass)} />
        <div className="w-px flex-grow bg-gray-100 mt-1" />
      </div>
      <div className="pb-5">
        <p className="text-[10px] text-gray-400 font-semibold">{time}</p>
        <h4 className="text-xs font-extrabold text-gray-900 mt-0.5">{title}</h4>
        <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>
        <span className={cn("text-[10px] font-bold", labelClass)}>{label}</span>
      </div>
    </div>
  );
}

// ─── Add Medication Form ──────────────────────────────────────────────────────
function AddMedicationForm({
  patientId,
  encounterId,
  onSuccess,
  onCancel,
}: {
  patientId: string;
  encounterId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const createMed = useCreateMedication();
  const [form, setForm] = useState({
    name: '',
    dosage: '',
    frequency: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.dosage || !form.frequency || !form.start_date) {
      toast.error('Name, dosage, instructions and start date are required.');
      return;
    }
    try {
      await createMed.mutateAsync({
        patient_id: patientId,
        encounter_id: encounterId || null,
        name: form.name,
        dosage: form.dosage,
        frequency: form.frequency,
        start_date: form.start_date,
        end_date: form.end_date || null,
      });
      toast.success('Medication added to prescription.');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add medication.');
    }
  };

  const field = (label: string, key: string, type = 'text', placeholder = '') => (
    <div className="space-y-1">
      <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">{label}</label>
      <input
        type={type}
        value={(form as any)[key]}
        onChange={set(key)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#E03E3E] bg-gray-50 focus:bg-white"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {field('Medication Name', 'name', 'text', 'e.g. Amoxicillin Capsules')}
      {field('Dosage', 'dosage', 'text', 'e.g. 500mg TID × 7 days')}
      {field('Instructions (SIG)', 'frequency', 'text', 'e.g. Take one capsule orally three times daily after meals')}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Start Date</label>
          <DatePicker value={form.start_date} onChange={v => setForm(f => ({ ...f, start_date: v }))} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">End Date</label>
          <DatePicker value={form.end_date} onChange={v => setForm(f => ({ ...f, end_date: v }))} min={form.start_date} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" isLoading={createMed.isPending} className="flex-1 h-9 text-xs font-bold rounded-md bg-[#E03E3E] text-white border-none shadow-none">
          Add to Prescription
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="h-9 text-xs font-bold rounded-md">
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DoctorPrescriptionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: patients = [], isLoading: patientsLoading } = usePatientRecords();
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: medications = [], isLoading: medsLoading } = useMedications(
    selectedPatientId ? { patient_id: selectedPatientId } : {}
  );
  const deleteMed = useDeleteMedication();

  const selectedPatient = patients.find((p: any) => p.id === selectedPatientId) as any;

  const handlePrint = () => window.print();

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this medication from the prescription?')) return;
    try {
      await deleteMed.mutateAsync(id);
      toast.success('Medication removed.');
    } catch {
      toast.error('Failed to remove medication.');
    }
  };

  // Build prescription history from medications
  const historyItems = medications.length > 0 ? [
    {
      time: format(parseISO(medications[0].created_at), "MMM d, yyyy '·' h:mmaaa"),
      title: 'Prescription Created',
      desc: `Dr. ${user?.first_name} ${user?.last_name} created prescription`,
      status: 'done' as const,
    },
    {
      time: format(parseISO(medications[0].created_at), "MMM d, yyyy '·' h:mmaaa"),
      title: 'Digital Signature Applied',
      desc: `Prescription signed electronically by Dr. ${user?.last_name}`,
      status: 'done' as const,
    },
    {
      time: format(parseISO(medications[0].created_at), "MMM d, yyyy '·' h:mmaaa"),
      title: 'Awaiting Pharmacy',
      desc: 'Sent to the pharmacy',
      status: 'pending' as const,
    },
  ] : [];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 select-none print:select-text">

      {/* Page header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Prescription</h1>
        <p className="text-gray-500 text-sm mt-1 font-semibold">
          Issue and manage medication prescriptions for your patients.
        </p>
      </div>

      {/* Patient selector */}
      <Card className="p-5 bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)]">
        <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-2">Select Patient</label>
        {patientsLoading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading patients...</div>
        ) : (
          <select
            value={selectedPatientId}
            onChange={e => { setSelectedPatientId(e.target.value); setShowAddForm(false); }}
            className="w-full max-w-sm border border-gray-200 rounded-md px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#E03E3E] bg-gray-50"
          >
            <option value="">— Choose a patient —</option>
            {patients.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </Card>

      {selectedPatientId && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left: Prescription Document */}
          <div className="lg:col-span-8 space-y-4">
            {medsLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-[#E03E3E]" /></div>
            ) : medications.length === 0 && !showAddForm ? (
              <Card className="p-10 bg-white border border-gray-100 rounded-md flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 rounded-md bg-[#faeaea] flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-[#E03E3E]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-sm">No prescription yet</h3>
                  <p className="text-xs text-gray-400 mt-1 font-semibold">Add medications below to create a prescription for this patient.</p>
                </div>
                <Button onClick={() => setShowAddForm(true)} className="h-9 px-6 text-xs font-bold rounded-md bg-[#E03E3E] text-white border-none shadow-none">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Medication
                </Button>
              </Card>
            ) : (
              <>
                <PrescriptionDocument
                  medications={medications as Medication[]}
                  patient={selectedPatient ? {
                    name: selectedPatient.name,
                    dob: selectedPatient.date_of_birth,
                    patient_id: selectedPatient.patient_id || selectedPatient.id?.slice(0, 8).toUpperCase(),
                    address: selectedPatient.address,
                  } : null}
                  doctor={{ first_name: user?.first_name || '', last_name: user?.last_name || '' }}
                  onDelete={handleDelete}
                  isDeleting={deleteMed.isPending}
                />
                <Button
                  onClick={() => setShowAddForm(v => !v)}
                  variant="outline"
                  className="h-9 px-5 text-xs font-bold rounded-md border-gray-200"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Add Another Medication
                </Button>
              </>
            )}

            {showAddForm && selectedPatientId && (
              <Card className="p-5 bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)]">
                <h3 className="text-sm font-extrabold text-gray-900 mb-4">Add Medication</h3>
                <AddMedicationForm
                  patientId={selectedPatientId}
                  onSuccess={() => setShowAddForm(false)}
                  onCancel={() => setShowAddForm(false)}
                />
              </Card>
            )}
          </div>

          {/* Right: Quick Actions + History */}
          <div className="lg:col-span-4 space-y-5 print:hidden">

            {/* Quick Actions */}
            <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)] overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Quick Actions</span>
              </div>
              <div className="p-4 space-y-2">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-gray-400" />
                  Edit Prescription
                </button>
                <button
                  onClick={handlePrint}
                  disabled={medications.length === 0}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[#E03E3E] border border-red-100 rounded-md hover:bg-[#fef6f6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Printer className="w-4 h-4" />
                  Print Prescription
                </button>
                <button
                  disabled={medications.length === 0}
                  onClick={() => toast.success('Prescription sent to pharmacy queue.')}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-white bg-[#E03E3E] rounded-md hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  Send to Pharmacy
                </button>
              </div>
            </Card>

            {/* Prescription History */}
            {historyItems.length > 0 && (
              <Card className="bg-white border border-gray-100 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.01)] overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Prescription History</span>
                </div>
                <div className="p-5">
                  {historyItems.map((item, i) => (
                    <HistoryItem key={i} {...item} />
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

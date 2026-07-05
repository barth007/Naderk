import React from 'react';
import { PatientRecord } from '@/services/medical-records/records.types';
import { X, Phone, MessageSquare, User } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

interface PatientSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientRecord | null;
}

export function PatientSummaryModal({ isOpen, onClose, patient }: PatientSummaryModalProps) {
  const { user } = useAuth();
  const isDoctor = user?.role === 'DOCTOR';

  if (!isOpen || !patient) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Header Section */}
        <div className="p-6 pb-4 flex items-start justify-between relative shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#faeaea] text-[#E03E3E] font-bold text-lg flex items-center justify-center border-2 border-white shadow-sm shrink-0">
              {getInitials(patient.name)}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">{patient.name}</h2>
              <p className="text-xs text-gray-500 font-semibold mt-1">{patient.address || 'Address not provided'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="w-full border-b border-gray-50"></div>

        {/* Modal Body */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {/* Demographic & Clinical Grid */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Clinical Summary</h3>
            <div className="grid grid-cols-3 gap-y-5 gap-x-4 text-xs">
              <div>
                <p className="text-gray-400 font-semibold mb-0.5">D.O.B</p>
                <p className="font-bold text-gray-850">{patient.dob}</p>
              </div>
              <div>
                <p className="text-gray-400 font-semibold mb-0.5">Sex</p>
                <p className="font-bold text-gray-850">{patient.gender}</p>
              </div>
              <div>
                <p className="text-gray-400 font-semibold mb-0.5">Weight</p>
                <p className="font-bold text-gray-850">{patient.weight}</p>
              </div>
              
              <div>
                <p className="text-gray-400 font-semibold mb-0.5">Vitals</p>
                <p className="font-bold text-gray-850">{patient.vitals}</p>
              </div>
              <div>
                <p className="text-gray-400 font-semibold mb-0.5">Last Appointment</p>
                <p className="font-bold text-gray-850">{patient.last_appointment}</p>
              </div>
              <div>
                <p className="text-gray-400 font-semibold mb-0.5">Register Date</p>
                <p className="font-bold text-gray-850">{patient.register_date}</p>
              </div>

              <div>
                <p className="text-gray-400 font-semibold mb-0.5">Next Appointment</p>
                <p className="font-bold text-gray-850">{patient.next_appointment}</p>
              </div>
              <div>
                <p className="text-gray-400 font-semibold mb-0.5">Previous Rx</p>
                <p className="font-bold text-gray-850 leading-tight">{patient.previous_rx}</p>
              </div>
              <div>
                <p className="text-gray-400 font-semibold mb-0.5">Current Rx</p>
                <p className="font-bold text-gray-850 leading-tight">{patient.current_rx}</p>
              </div>
            </div>
          </div>

          {/* Complaints list */}
          <div className="space-y-2.5">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Complaints</h3>
            <ul className="space-y-1.5 pl-1.5">
              {patient.complaints.map((complaint, idx) => (
                <li key={idx} className="text-xs font-semibold text-gray-750 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  {complaint}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="w-full border-t border-gray-50"></div>

        {/* Footer Actions */}
        <div className="p-6 bg-gray-50/50 flex flex-col gap-3 shrink-0">
          <div className="flex gap-3">
            <a 
              href={`tel:${patient.phone_number}`}
              className="flex-grow bg-[#E03E3E] hover:bg-red-750 text-white font-bold h-11 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-red-500/10"
            >
              <Phone className="w-4.5 h-4.5" /> {patient.phone_number}
            </a>
            <Link 
              href={isDoctor ? '/doctor/messages' : '/agent/chats'}
              onClick={onClose}
              className="flex-grow border border-gray-200 hover:bg-gray-150/50 bg-white text-gray-700 font-bold h-11 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <MessageSquare className="w-4.5 h-4.5 text-gray-400" /> Chat
            </Link>
          </div>
          
          {isDoctor ? (
            <Link 
              href={`/doctor/records/${patient.id}`}
              onClick={onClose}
              className="w-full bg-gray-900 hover:bg-black text-white font-bold h-11 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <User className="w-4.5 h-4.5" /> View Full Record
            </Link>
          ) : (
            <button 
              onClick={onClose}
              className="w-full bg-gray-900 hover:bg-black text-white font-bold h-11 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <User className="w-4.5 h-4.5" /> Close Details
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default PatientSummaryModal;

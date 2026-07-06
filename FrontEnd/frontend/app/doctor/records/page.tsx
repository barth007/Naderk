"use client";

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePatientRecords } from '@/services/medical-records/records.hooks';
import { PatientRecord } from '@/services/medical-records/records.types';
import { PatientSummaryModal } from '@/components/medical-records/PatientSummaryModal';
import { Loader2, FileText, User, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';

export default function DoctorPatientRecordsPage() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  
  const { data: records = [], isLoading, error, refetch } = usePatientRecords(searchQuery);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const handleRowClick = (patient: PatientRecord) => {
    setSelectedPatient(patient);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedPatient(null);
    setIsModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-[450px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#E03E3E] mb-4" />
        <p className="text-gray-500 text-sm font-semibold">Retrieving patient database records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 max-w-md mx-auto flex flex-col justify-center min-h-[400px]">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mx-auto mb-4 border border-red-100/35">
          <FileText className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Failed to load records</h3>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          There was an error pulling the clinical patient database. Please try again.
        </p>
        <button
          onClick={() => refetch()}
          className="px-5 py-2.5 bg-[#E03E3E] text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 mx-auto cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    );
  }

  // Filter and pagination calculation
  const totalItems = records.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = records.slice(indexOfFirstItem, indexOfLastItem);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('completed')) return 'text-green-700 bg-green-50 border-green-100';
    if (s.includes('cancelled')) return 'text-red-700 bg-red-50 border-red-100';
    if (s.includes('rescheduled')) return 'text-amber-700 bg-amber-50 border-amber-100';
    return 'text-gray-600 bg-gray-50 border-gray-150';
  };

  return (
    <div className="space-y-6 select-none">
      {/* Page Title & Subtitle */}
      <div className="border-b border-gray-100 pb-5">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          Patient Records
        </h1>
        <p className="text-sm text-gray-500 mt-1 font-semibold">
          View all patient records
        </p>
      </div>

      {records.length === 0 ? (
        /* Empty State */
        <div className="w-full flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white border border-gray-100 rounded-3xl shadow-sm">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-[#E03E3E] mb-5 border border-red-100/50">
            <User className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-gray-900 text-lg">No Patient Records Available</h3>
          <p className="text-gray-500 text-sm mt-1 max-w-sm font-semibold leading-relaxed">
            Patients assigned to you will appear here once consultations begin.
          </p>
          <Button 
            onClick={() => refetch()} 
            className="mt-6 bg-[#E03E3E] hover:bg-red-700 text-white font-bold px-6 py-2.5 h-11 rounded-xl flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Records
          </Button>
        </div>
      ) : (
        /* Data Table Card */
        <Card className="border border-gray-100 rounded-3xl overflow-hidden bg-white shadow-sm flex flex-col">
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse text-left text-xs font-semibold text-gray-600">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-4.5">Patient ID</th>
                  <th className="px-6 py-4.5">Name & Contact</th>
                  <th className="px-6 py-4.5">Last Visit</th>
                  <th className="px-6 py-4.5">Complaints</th>
                  <th className="px-6 py-4.5">Mode</th>
                  <th className="px-6 py-4.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentItems.map((record) => (
                  <tr 
                    key={record.id} 
                    onClick={() => handleRowClick(record)}
                    className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 text-gray-900 font-bold">{record.patient_id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#faeaea] text-[#E03E3E] font-bold text-xs flex items-center justify-center border border-white shrink-0">
                          {getInitials(record.name)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 leading-tight">{record.name}</span>
                          <span className="text-[10px] text-gray-400 font-semibold mt-0.5">{record.phone_number}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-medium">{record.last_visit}</td>
                    <td className="px-6 py-4 text-gray-500 font-medium max-w-xs truncate" title={record.complaints_summary}>
                      {record.complaints_summary}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                        record.mode === 'Online' ? 'text-indigo-700 bg-indigo-50 border-indigo-100' : 'text-gray-700 bg-gray-50 border-gray-150'
                      }`}>
                        {record.mode}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${getStatusStyle(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            shownItems={currentItems.length}
            noun="patients"
            onPageChange={setCurrentPage}
          />
        </Card>
      )}

      {/* Patient Summary Modal */}
      <PatientSummaryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        patient={selectedPatient}
      />
    </div>
  );
}

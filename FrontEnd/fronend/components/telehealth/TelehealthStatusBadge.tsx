import React from 'react';
import { TelehealthSessionStatus } from '@/services/telehealth/telehealth.types';
import { cn } from '@/lib/cn';

interface TelehealthStatusBadgeProps {
  status: TelehealthSessionStatus;
  className?: string;
}

export default function TelehealthStatusBadge({ status, className }: TelehealthStatusBadgeProps) {
  let styles = 'bg-gray-100 text-gray-700 border-gray-200';
  let label: string = status;


  switch (status) {
    case 'SCHEDULED':
      styles = 'bg-blue-50 text-blue-700 border-blue-100';
      label = 'Scheduled';
      break;
    case 'WAITING_ROOM':
      styles = 'bg-amber-50 text-amber-700 border-amber-200';
      label = 'Waiting Room';
      break;
    case 'WAITING_FOR_DOCTOR':
      styles = 'bg-amber-50 text-amber-700 border-amber-200';
      label = 'Waiting for Doctor';
      break;
    case 'ACTIVE':
      styles = 'bg-green-100 text-green-800 border-green-200 font-bold';
      label = 'Active';
      break;
    case 'COMPLETED':
      styles = 'bg-gray-100 text-gray-600 border-gray-200';
      label = 'Completed';
      break;
    case 'CANCELLED':
      styles = 'bg-red-50 text-red-600 border-red-100';
      label = 'Cancelled';
      break;
    case 'PATIENT_NO_SHOW':
      styles = 'bg-rose-50 text-rose-600 border-rose-100';
      label = 'Patient Absent';
      break;
    case 'DOCTOR_NO_SHOW':
      styles = 'bg-rose-50 text-rose-600 border-rose-100';
      label = 'Doctor Absent';
      break;
    case 'MISSED':
      styles = 'bg-rose-50 text-rose-600 border-rose-100';
      label = 'Missed';
      break;
  }

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-1 text-xs font-semibold border rounded-md shadow-sm uppercase tracking-wide",
      styles,
      className
    )}>
      {label}
    </span>
  );
}

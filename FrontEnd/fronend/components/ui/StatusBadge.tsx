import React from 'react';
import { AppointmentStatus } from '@/services/appointments/appointments.types';

interface StatusBadgeProps {
  status: AppointmentStatus | string;
  label?: string; // override the label if passed
}

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  let displayStatus = label;
  
  switch (status) {
    case 'PENDING':
      displayStatus = displayStatus || 'Pending';
      return (
        <div className="tooltip tooltip-top" data-tip={displayStatus}>
          <div className="badge gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md bg-yellow-50 text-yellow-700 border-none whitespace-nowrap truncate max-w-[120px]">
            <span className="w-1.5 h-1.5 rounded-md bg-yellow-500 shrink-0"></span>
            {displayStatus}
          </div>
        </div>
      );
    case 'CONFIRMED':
      displayStatus = displayStatus || 'Confirmed';
      return (
        <div className="tooltip tooltip-top" data-tip={displayStatus}>
          <div className="badge gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border-none whitespace-nowrap truncate max-w-[120px]">
            <span className="w-1.5 h-1.5 rounded-md bg-blue-500 shrink-0"></span>
            {displayStatus}
          </div>
        </div>
      );
    case 'CHECKED_IN':
      displayStatus = displayStatus || 'Checked In';
      return (
        <div className="tooltip tooltip-top" data-tip={displayStatus}>
          <div className="badge gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md bg-cyan-50 text-cyan-700 border-none whitespace-nowrap truncate max-w-[120px]">
            <span className="w-1.5 h-1.5 rounded-md bg-cyan-500 shrink-0"></span>
            {displayStatus}
          </div>
        </div>
      );
    case 'IN_PROGRESS':
      displayStatus = displayStatus || 'In Progress';
      return (
        <div className="tooltip tooltip-top" data-tip={displayStatus}>
          <div className="badge gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border-none whitespace-nowrap truncate max-w-[120px]">
            <span className="w-1.5 h-1.5 rounded-md bg-purple-500 shrink-0"></span>
            {displayStatus}
          </div>
        </div>
      );
    case 'COMPLETED':
      displayStatus = displayStatus || 'Completed';
      return (
        <div className="tooltip tooltip-top" data-tip={displayStatus}>
          <div className="badge gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md bg-green-50 text-green-600 border-none whitespace-nowrap truncate max-w-[120px]">
            <span className="w-1.5 h-1.5 rounded-md bg-green-500 shrink-0"></span>
            {displayStatus}
          </div>
        </div>
      );
    case 'NO_SHOW':
      displayStatus = displayStatus || 'Missed';
      return (
        <div className="tooltip tooltip-top" data-tip={displayStatus}>
          <div className="badge gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md bg-red-50 text-red-600 border-none whitespace-nowrap truncate max-w-[120px]">
            <span className="w-1.5 h-1.5 rounded-md bg-red-500 shrink-0"></span>
            {displayStatus}
          </div>
        </div>
      );
    case 'CANCELLED':
      displayStatus = displayStatus || 'Cancelled';
      return (
        <div className="tooltip tooltip-top" data-tip={displayStatus}>
          <div className="badge gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 border-none whitespace-nowrap truncate max-w-[120px]">
            <span className="w-1.5 h-1.5 rounded-md bg-gray-500 shrink-0"></span>
            {displayStatus}
          </div>
        </div>
      );
    default:
      return (
        <div className="tooltip tooltip-top" data-tip={displayStatus || status}>
          <div className="badge gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 border-none whitespace-nowrap truncate max-w-[120px]">
            {displayStatus || status}
          </div>
        </div>
      );
  }
}

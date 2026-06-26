import React from 'react';
import { AppointmentType } from '@/services/appointments/appointments.types';
import { Video, MapPin, Home, AlertCircle, RefreshCw } from 'lucide-react';

interface AppointmentTypeBadgeProps {
  type: AppointmentType | string;
  label?: string;
}

export function AppointmentTypeBadge({ type, label }: AppointmentTypeBadgeProps) {
  switch (type) {
    case 'TELEHEALTH':
      return (
        <div className="tooltip tooltip-top" data-tip={label || 'Telehealth'}>
          <div className="badge gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border-none whitespace-nowrap truncate max-w-[120px]">
            <Video className="w-3.5 h-3.5 shrink-0" />
            {label || 'Telehealth'}
          </div>
        </div>
      );
    case 'PHYSICAL':
      return (
        <div className="tooltip tooltip-top" data-tip={label || 'Physical'}>
          <div className="badge gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 border-none whitespace-nowrap truncate max-w-[120px]">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {label || 'Physical'}
          </div>
        </div>
      );
    case 'HOME_VISIT':
      return (
        <div className="tooltip tooltip-top" data-tip={label || 'Home Visit'}>
          <div className="badge gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border-none whitespace-nowrap truncate max-w-[120px]">
            <Home className="w-3.5 h-3.5 shrink-0" />
            {label || 'Home Visit'}
          </div>
        </div>
      );
    case 'EMERGENCY':
      return (
        <div className="tooltip tooltip-top" data-tip={label || 'Emergency'}>
          <div className="badge gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md bg-red-50 text-red-700 border-none whitespace-nowrap truncate max-w-[120px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {label || 'Emergency'}
          </div>
        </div>
      );
    case 'FOLLOW_UP':
      return (
        <div className="tooltip tooltip-top" data-tip={label || 'Follow-up'}>
          <div className="badge gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border-none whitespace-nowrap truncate max-w-[120px]">
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            {label || 'Follow-up'}
          </div>
        </div>
      );
    default:
      return (
        <div className="tooltip tooltip-top" data-tip={label || type}>
          <div className="badge gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 border-none whitespace-nowrap truncate max-w-[120px]">
            {label || type}
          </div>
        </div>
      );
  }
}

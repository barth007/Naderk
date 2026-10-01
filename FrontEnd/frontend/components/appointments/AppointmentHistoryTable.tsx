import React from 'react';
import { format, parseISO } from 'date-fns';
import { Appointment } from '@/services/appointments/appointments.types';
import StatusBadge from '@/components/ui/StatusBadge';
import { AppointmentTypeBadge } from './AppointmentTypeBadge';

interface AppointmentHistoryTableProps {
  history: Appointment[];
  /** When provided, missed (NO_SHOW) rows get a Reschedule action. */
  onReschedule?: (apt: Appointment) => void;
}

function DoctorCell({ apt }: { apt: Appointment }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {apt.doctor?.avatar ? (
        <div className="w-8 h-8 rounded-full border border-gray-200 overflow-hidden shrink-0">
          <img src={apt.doctor.avatar} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="bg-gray-100 text-gray-600 rounded-full w-8 h-8 font-bold text-[11px] flex items-center justify-center shrink-0">
          {apt.doctor?.first_name?.[0] || 'D'}{apt.doctor?.last_name?.[0] || ''}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-bold text-gray-900 leading-tight text-xs truncate">
          {apt.doctor ? `Dr. ${apt.doctor.last_name}` : 'On-Site Service'}
        </p>
        <p className="text-[10px] text-gray-500 truncate">
          {apt.doctor ? (apt.doctor.specialization?.replace(/_/g, ' ') || 'Specialist') : 'No doctor required'}
        </p>
      </div>
    </div>
  );
}

export default function AppointmentHistoryTable({ history, onReschedule }: AppointmentHistoryTableProps) {
  const rows = history.slice(0, 5);
  const canReschedule = (apt: Appointment) => apt.status === 'NO_SHOW' && !!onReschedule;
  const showActions = !!onReschedule && rows.some((apt) => apt.status === 'NO_SHOW');

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-md border border-gray-100 shadow-sm px-5 py-8 text-center text-xs text-gray-500">
        No past appointments found.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
      {/* Stacked cards below md. Five columns in a horizontally scrolling table
          meant everything except "Type" was off-screen on a phone. */}
      <ul className="md:hidden divide-y divide-gray-100">
        {rows.map(apt => (
          <li key={apt.id} className="p-3.5 space-y-2.5">
            <div className="flex items-center flex-wrap gap-1.5">
              <AppointmentTypeBadge type={apt.appointment_type} label={apt.appointment_type_display} />
              <StatusBadge status={apt.status} label={apt.status_display} />
              <span className="ml-auto text-[11px] font-semibold text-gray-400 whitespace-nowrap">
                {format(parseISO(apt.appointment_date), 'MMM dd, yyyy')}
              </span>
            </div>
            <DoctorCell apt={apt} />
            <p className="text-xs text-gray-500 truncate">{apt.service?.name}</p>
            {canReschedule(apt) && (
              <button
                onClick={() => onReschedule!(apt)}
                className="mt-1 text-[11px] font-bold text-[#E03E3E] hover:underline"
              >
                Reschedule Visit
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden md:block overflow-x-auto">
        <table className="table w-full text-left text-xs">
          <thead className="text-gray-900 font-bold border-b border-gray-100 bg-white">
            <tr>
              <th className="px-4 py-3 font-bold text-xs">Type</th>
              <th className="px-4 py-3 font-bold text-xs">Status</th>
              <th className="px-4 py-3 font-bold text-xs">Doctor</th>
              <th className="px-4 py-3 font-bold text-xs">Service</th>
              <th className="px-4 py-3 font-bold text-xs whitespace-nowrap">Date</th>
              {showActions && <th className="px-4 py-3 font-bold text-xs whitespace-nowrap">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(apt => (
              <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <AppointmentTypeBadge type={apt.appointment_type} label={apt.appointment_type_display} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={apt.status} label={apt.status_display} />
                </td>
                <td className="px-4 py-3 max-w-[200px]"><DoctorCell apt={apt} /></td>
                <td className="px-4 py-3 text-gray-500 max-w-[220px]">
                  <span className="block truncate">{apt.service?.name}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {format(parseISO(apt.appointment_date), 'MMM dd, yyyy')}
                </td>
                {showActions && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    {canReschedule(apt) ? (
                      <button
                        onClick={() => onReschedule!(apt)}
                        className="text-[11px] font-bold text-[#E03E3E] hover:underline"
                      >
                        Reschedule Visit
                      </button>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React from 'react';
import { format, parseISO } from 'date-fns';
import { Appointment } from '@/services/appointments/appointments.types';
import StatusBadge from '@/components/ui/StatusBadge';
import { AppointmentTypeBadge } from './AppointmentTypeBadge';
import { Button } from '@/components/ui/button';

interface AppointmentHistoryTableProps {
  history: Appointment[];
}

export default function AppointmentHistoryTable({ history }: AppointmentHistoryTableProps) {
  return (
    <div className="bg-white rounded-md border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table w-full text-left text-[13px]">
          <thead className="text-gray-900 font-bold border-b border-gray-100 bg-white">
            <tr>
              <th className="px-5 py-4 font-bold text-sm">Type</th>
              <th className="px-5 py-4 font-bold text-sm">Status</th>
              <th className="px-5 py-4 font-bold text-sm">Doctor</th>
              <th className="px-5 py-4 font-bold text-sm">Service</th>
              <th className="px-5 py-4 font-bold text-sm">Date & Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                  No past appointments found.
                </td>
              </tr>
            ) : (
              history.slice(0, 5).map((apt: Appointment) => (
                <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <AppointmentTypeBadge type={apt.appointment_type} label={apt.appointment_type_display} />
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={apt.status} label={apt.status_display} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {apt.doctor?.avatar ? (
                        <div className="avatar">
                          <div className="w-8 h-8 rounded-full border border-gray-200 overflow-hidden">
                            <img src={apt.doctor.avatar} alt="Doctor" className="w-full h-full object-cover" />
                          </div>
                        </div>
                      ) : (
                        <div className="avatar placeholder">
                          <div className="bg-gray-100 text-gray-600 rounded-full w-8 h-8 font-bold text-xs flex items-center justify-center">
                            <span>{apt.doctor?.first_name?.[0] || 'D'}{apt.doctor?.last_name?.[0] || ''}</span>
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900 leading-tight">
                          {apt.doctor ? `Dr. ${apt.doctor.last_name}` : 'On-Site Service'}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {apt.doctor ? (apt.doctor.specialization?.replace('_', ' ') || 'Specialist') : 'No doctor required'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{apt.service?.name}</td>
                  <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                    {format(parseISO(apt.appointment_date), 'MMM dd, yyyy')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

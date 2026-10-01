'use client';

import React from 'react';
import { Loader2, UserCheck, Undo2, Clock, Building2, Video } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { toastApiError } from '@/lib/api-errors';
import {
  useAdminTodayArrivals, useCheckInAppointment, useUndoCheckIn, AdminArrival,
} from '@/services/admin/admin-appointments.hooks';

/**
 * The front desk's arrivals list.
 *
 * Check-in had an endpoint but no interface anywhere, and no appointment had
 * ever reached CHECKED_IN. The desk is the authority here — it can see the
 * patient — while a patient may also check themselves in from their own
 * appointments page near their slot.
 */
export default function TodayArrivalsPanel() {
  const { data: arrivals = [], isLoading } = useAdminTodayArrivals();
  const checkIn = useCheckInAppointment();
  const undo = useUndoCheckIn();

  const waiting = arrivals.filter(a => a.status === 'CONFIRMED');
  const arrived = arrivals.filter(a => a.status !== 'CONFIRMED');

  const doCheckIn = (a: AdminArrival) =>
    checkIn.mutate(a.id, {
      onSuccess: () => toast.success(`${a.patient_name} checked in.`),
      onError: (e) => toastApiError(e, 'Could not check this patient in.'),
    });

  const doUndo = (a: AdminArrival) =>
    undo.mutate(a.id, {
      onSuccess: () => toast.success(`Check-in undone for ${a.patient_name}.`),
      onError: (e) => toastApiError(e, 'Could not undo the check-in.'),
    });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-gray-900 text-sm">Today&rsquo;s Arrivals</h2>
          {arrivals.length > 0 && (
            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {arrived.length}/{arrivals.length} in
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Mark patients as arrived at the front desk</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
        ) : arrivals.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-10 px-4">
            No confirmed appointments today.
          </p>
        ) : (
          <>
            {waiting.map(a => (
              <ArrivalRow key={a.id} a={a} onAction={() => doCheckIn(a)} pending={checkIn.isPending} />
            ))}
            {arrived.length > 0 && (
              <p className="px-4 pt-3 pb-1 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                Arrived
              </p>
            )}
            {arrived.map(a => (
              <ArrivalRow key={a.id} a={a} onAction={() => doUndo(a)} pending={undo.isPending} arrived />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ArrivalRow({
  a, onAction, pending, arrived = false,
}: {
  a: AdminArrival; onAction: () => void; pending: boolean; arrived?: boolean;
}) {
  // IN_PROGRESS means the consultation has started — undoing that is not the
  // desk's job, so only offer it while the patient is merely checked in.
  const canUndo = a.status === 'CHECKED_IN';

  return (
    <div className={cn(
      'px-4 py-3 border-b border-gray-50 flex items-center gap-3',
      arrived && 'bg-emerald-50/30',
    )}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-800 truncate">{a.patient_name}</p>
        <p className="text-xs text-gray-400 truncate flex items-center gap-1.5">
          <Clock className="w-3 h-3 shrink-0" />
          {a.appointment_time ?? '—'}
          <span className="text-gray-300">·</span>
          <span className="truncate">{a.service_name}</span>
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
          {a.appointment_type === 'TELEHEALTH'
            ? <><Video className="w-3 h-3" /> Telehealth</>
            : a.is_onsite
              ? <><Building2 className="w-3 h-3" /> On-site · no doctor</>
              : <>{a.doctor_name ?? 'Unassigned'}</>}
        </p>
      </div>

      {arrived ? (
        canUndo ? (
          <button
            onClick={onAction}
            disabled={pending}
            title="Undo check-in"
            className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-gray-900 border border-gray-200 bg-white px-2 py-1.5 rounded-md disabled:opacity-50"
          >
            <Undo2 className="w-3 h-3" /> Undo
          </button>
        ) : (
          <span className="shrink-0 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
            In session
          </span>
        )
      ) : (
        <button
          onClick={onAction}
          disabled={pending}
          className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#E03E3E] hover:bg-[#c93535] px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          <UserCheck className="w-3.5 h-3.5" /> Check in
        </button>
      )}
    </div>
  );
}

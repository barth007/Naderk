import React, { useState, useEffect } from 'react';
import { useRescheduleAppointment } from '@/services/appointments/appointments.hooks';
import { Appointment } from '@/services/appointments/appointments.types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import CalendarTimeSlotPicker from './CalendarTimeSlotPicker';
import { Button } from '@/components/ui/button';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
}

export default function RescheduleModal({ isOpen, onClose, appointment }: RescheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  
  const formattedDate = format(selectedDate, 'yyyy-MM-dd');
  const rescheduleMutation = useRescheduleAppointment();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(new Date());
      setSelectedTime(null);
    }
  }, [isOpen]);

  if (!isOpen || !appointment) return null;

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleConfirm = () => {
    if (!selectedTime) {
      toast.error("Please select a time slot");
      return;
    }
    
    rescheduleMutation.mutate(
      { id: appointment.id, date: formattedDate, time: selectedTime },
      {
        onSuccess: () => {
          toast.success("Appointment rescheduled successfully");
          onClose();
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || err.response?.data?.detail || "Failed to reschedule appointment");
        }
      }
    );
  };

  return (
    <dialog className={`modal ${isOpen ? 'modal-open' : ''}`}>
      <div className="modal-box w-full max-w-lg p-0 bg-white rounded-[16px] shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Reschedule Appointment</h2>
            <p className="text-xs text-gray-500 mt-1">Select a new date and time for {appointment.service?.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          <CalendarTimeSlotPicker 
            doctorId={appointment.doctor?.id}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            selectedTime={selectedTime}
            onTimeSelect={setSelectedTime}
            compact={true}
          />
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-50 bg-gray-50 flex justify-end gap-3 shrink-0">
          <Button 
            variant="outline"
            onClick={onClose}
            className="px-5 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 border-none"
          >
            Cancel
          </Button>
          <Button 
            variant="default"
            onClick={handleConfirm}
            disabled={!selectedTime}
            isLoading={rescheduleMutation.isPending}
            loadingText="Processing..."
            className="px-5 font-bold text-white bg-[#E03E3E] hover:bg-red-700 border-none"
          >
            Confirm Reschedule
          </Button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

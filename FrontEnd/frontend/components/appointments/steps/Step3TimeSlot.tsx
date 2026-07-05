import React, { useState } from 'react';
import { useBookingStore } from '@/store/useBookingStore';
import { format } from 'date-fns';
import CalendarTimeSlotPicker from '../CalendarTimeSlotPicker';

export default function Step3TimeSlot() {
  const { doctor, setDateTime, time: selectedTime } = useBookingStore();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setDateTime(format(date, 'yyyy-MM-dd'), null); // Reset time when date changes
  };

  const handleSlotSelect = (time: string) => {
    if (!doctor) return;
    setDateTime(format(selectedDate, 'yyyy-MM-dd'), time);
  };

  if (!doctor) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-sm font-bold text-gray-700">3. Preferred Time Slot</h2>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 sm:p-6">
        <CalendarTimeSlotPicker 
          doctorId={doctor.id}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          selectedTime={selectedTime}
          onTimeSelect={handleSlotSelect}
        />
      </div>
    </div>
  );
}

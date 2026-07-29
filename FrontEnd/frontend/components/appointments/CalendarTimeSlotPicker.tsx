import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, isSameDay, isBefore, startOfDay, addMonths, subMonths, startOfMonth, isSameMonth } from 'date-fns';
import { useAvailableSlots } from '@/services/appointments/appointments.hooks';
import { Button } from '@/components/ui/button';

interface CalendarTimeSlotPickerProps {
  doctorId: string | undefined;
  serviceId?: string | undefined;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  selectedTime: string | null;
  onTimeSelect: (time: string) => void;
  compact?: boolean;
}

export default function CalendarTimeSlotPicker({
  doctorId,
  serviceId,
  selectedDate,
  onDateSelect,
  selectedTime,
  onTimeSelect,
  compact = false
}: CalendarTimeSlotPickerProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(selectedDate));

  const formattedDate = format(selectedDate, 'yyyy-MM-dd');
  const { data: slots, isLoading, isError } = useAvailableSlots(doctorId, formattedDate, serviceId);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarDays = Array.from({ length: 42 }).map((_, i) => addDays(startDate, i));
  const today = startOfDay(new Date());

  // Use smaller sizing if compact is true
  const monthMargin = compact ? "mb-6" : "mb-6";
  const gridGap = compact ? "gap-y-4 gap-x-2 mb-8" : "gap-y-6 gap-x-2 mb-10 max-w-lg mx-auto";
  const dayText = compact ? "text-[12px]" : "text-[13px]";
  const dateText = compact ? "text-[13px] py-1" : "text-[13px] py-1";
  
  const slotContainerGap = compact ? "gap-3" : "gap-4";
  const slotPadding = compact ? "py-1.5 px-4 text-xs" : "py-2 px-6 text-sm";
  const slotHeaderSize = compact ? "text-[11px]" : "text-xs";
  const loadingPulse = compact ? "w-20 h-9" : "w-24 h-10";

  return (
    <>
      {/* Month Header */}
      <div className={`flex items-center justify-center gap-6 sm:gap-12 ${monthMargin}`}>
        <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="text-gray-400 hover:text-gray-600 h-8 w-8 rounded-full">
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </Button>
        <span className="font-bold text-sm text-gray-900 min-w-[120px] text-center">{format(currentMonth, 'MMMM yyyy')}</span>
        <Button variant="ghost" size="icon" onClick={handleNextMonth} className="text-gray-400 hover:text-gray-600 h-8 w-8 rounded-full">
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className={`grid grid-cols-7 text-center ${gridGap}`}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className={`${dayText} font-bold text-gray-900 mb-2`}>{day}</div>
        ))}

        {calendarDays.map(date => {
          const isSelected = isSameDay(date, selectedDate);
          const isPast = isBefore(startOfDay(date), today);
          const isCurrentMonth = isSameMonth(date, currentMonth);
          
          return (
            <button
              key={date.toISOString()}
              onClick={() => onDateSelect(date)}
              disabled={isPast}
              className={`w-full h-8 flex items-center justify-center ${dateText} font-medium transition-colors rounded-md
                ${!isCurrentMonth ? 'text-gray-300' : ''}
                ${isPast ? 'text-gray-300 cursor-not-allowed opacity-50' : 
                  isSelected ? 'text-[#E03E3E] font-bold bg-red-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}
              `}
            >
              {format(date, 'dd')}
            </button>
          )
        })}
      </div>

      {/* Time Slots */}
      <div className="text-center">
        <h3 className={`${slotHeaderSize} font-bold text-gray-900 uppercase tracking-wider mb-6`}>
          AVAILABLE TIME SLOT FOR {format(selectedDate, 'MMM dd').toUpperCase()}
        </h3>

        {isLoading ? (
          <div className={`flex flex-wrap justify-center ${slotContainerGap}`}>
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className={`${loadingPulse} bg-gray-100 rounded-md animate-pulse`}></div>)}
          </div>
        ) : isError ? (
          <div className="text-red-500 text-sm">Failed to load slots.</div>
        ) : slots && slots.length > 0 ? (
          <div className={`flex flex-wrap justify-center ${slotContainerGap}`}>
            {slots.map((time) => (
              <Button
                variant="outline"
                key={time}
                onClick={() => onTimeSelect(time)}
                className={`${slotPadding} h-auto ${selectedTime === time
                  ? 'border-[#E03E3E] text-[#E03E3E] bg-[#FEF6F6] hover:bg-[#FEF6F6] hover:text-[#E03E3E]'
                  : 'border-gray-200 text-gray-700 hover:border-[#E03E3E] hover:text-[#E03E3E] hover:bg-transparent'
                  }`}
              >
                {time}
              </Button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 py-4">No slots available on this date.</div>
        )}
      </div>
    </>
  );
}

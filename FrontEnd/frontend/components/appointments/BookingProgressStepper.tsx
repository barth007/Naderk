import React from 'react';

interface Props {
  currentStep: number;
}

export default function BookingProgressStepper({ currentStep }: Props) {
  const steps = [
    { num: 1, label: 'Service' },
    { num: 2, label: 'Doctor' },
    { num: 3, label: 'Time Slot' },
    { num: 4, label: 'Details' },
  ];

  return (
    <div className="w-full pb-6 border-b border-gray-200">
      <div className="flex justify-between w-full max-w-4xl mx-auto md:mx-0">
        {steps.map((step) => {
          const isActive = currentStep === step.num;
          const isPast = currentStep > step.num;
          
          return (
            <div key={step.num} className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
              <div 
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all duration-300
                  ${isActive || isPast ? 'bg-[#E03E3E] text-white' : 'bg-gray-400 text-white'}`}
              >
                {step.num}
              </div>
              <span className={`text-[11px] sm:text-sm font-bold transition-colors duration-300 ${isActive || isPast ? 'text-gray-900' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

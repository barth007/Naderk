import React from 'react';
import { ConversationStatus, ConversationPriority, MessagingDepartment } from '@/services/messaging/messaging.types';

interface BadgeProps {
  status?: ConversationStatus;
  priority?: ConversationPriority;
  department?: MessagingDepartment;
  className?: string;
}

export function ConversationStatusBadge({ status, priority, department, className = '' }: BadgeProps) {
  if (status) {
    let classes = '';
    let label = status.replace(/_/g, ' ');

    switch (status) {
      case 'OPEN':
        classes = 'bg-gray-100 text-gray-700';
        break;
      case 'ASSIGNED':
        classes = 'bg-blue-50 text-blue-700';
        break;
      case 'IN_PROGRESS':
        classes = 'bg-indigo-50 text-indigo-700';
        break;
      case 'WAITING_FOR_PATIENT':
        classes = 'bg-amber-50 text-amber-700';
        label = 'Awaiting Patient';
        break;
      case 'ESCALATED':
        classes = 'bg-red-50 text-[#E03E3E] font-bold';
        break;
      case 'RESOLVED':
        classes = 'bg-green-50 text-green-700';
        break;
      case 'CLOSED':
        classes = 'bg-gray-200 text-gray-600';
        break;
      default:
        classes = 'bg-gray-100 text-gray-700';
    }

    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${classes} ${className}`}>
        {label}
      </span>
    );
  }

  if (priority) {
    let classes = '';
    switch (priority) {
      case 'LOW':
        classes = 'bg-gray-100 text-gray-500';
        break;
      case 'NORMAL':
        classes = 'bg-blue-50 text-blue-600';
        break;
      case 'HIGH':
        classes = 'bg-amber-50 text-amber-600';
        break;
      case 'URGENT':
        classes = 'bg-red-100 text-red-700 font-bold animate-pulse';
        break;
      default:
        classes = 'bg-gray-100 text-gray-500';
    }

    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${classes} ${className}`}>
        {priority}
      </span>
    );
  }

  if (department) {
    let classes = 'bg-gray-100 text-gray-600 border border-gray-200';
    let label = department.replace(/_/g, ' ');

    switch (department) {
      case 'APPOINTMENTS':
        classes = 'bg-sky-50 text-sky-700 border border-sky-100';
        break;
      case 'OPHTHALMOLOGY':
        classes = 'bg-rose-50 text-rose-700 border border-rose-100';
        break;
      case 'OPTOMETRY':
        classes = 'bg-teal-50 text-teal-700 border border-teal-100';
        break;
      case 'BILLING':
        classes = 'bg-purple-50 text-purple-700 border border-purple-100';
        break;
      case 'TELEHEALTH':
        classes = 'bg-violet-50 text-violet-700 border border-violet-100';
        break;
      case 'MEDICAL_RECORDS':
        classes = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
        break;
      case 'INSURANCE':
        classes = 'bg-cyan-50 text-cyan-700 border border-cyan-100';
        break;
      default:
        classes = 'bg-gray-50 text-gray-500 border border-gray-100';
    }

    return (
      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide ${classes} ${className}`}>
        {label}
      </span>
    );
  }

  return null;
}
export default ConversationStatusBadge;

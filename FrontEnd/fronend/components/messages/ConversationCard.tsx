import React from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar, CreditCard, FileText, MessageSquare, User } from 'lucide-react';
import { Conversation } from '@/services/messaging/messaging.types';
import { ConversationStatusBadge } from './ConversationStatusBadge';
import { useAuth } from '@/hooks/useAuth';

interface ConversationCardProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export function ConversationCard({ conversation, isActive, onClick }: ConversationCardProps) {
  const { user } = useAuth();
  const isStaff = !!user?.role && ['AGENT', 'DOCTOR', 'ADMIN'].includes(user.role);

  const getFormattedTime = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      const isToday = new Date().toDateString() === date.toDateString();
      return format(date, isToday ? 'h:mm a' : 'MMM d');
    } catch {
      return '';
    }
  };

  const getChannelName = () => {
    if (conversation.assigned_doctor && !isStaff) {
      return `Dr. ${conversation.assigned_doctor.first_name} ${conversation.assigned_doctor.last_name}`;
    }
    
    const channelNames: Record<string, string> = {
      APPOINTMENT: 'Appointment Desk',
      CONSULTATION: 'Eye Consultation Desk',
      PRESCRIPTION: 'Prescription Desk',
      BILLING: 'Billing Support',
      INSURANCE: 'Insurance Support',
      MEDICAL_RECORDS: 'Medical Records',
      TELEHEALTH: 'Telehealth Desk',
      OTHER: 'General Support',
    };
    return channelNames[conversation.category] || 'Support Desk';
  };

  const getLastMessageText = () => {
    if (conversation.last_message) {
      return conversation.last_message.content;
    }
    return 'No messages yet.';
  };

  // Render the left-side icon/avatar based on the conversation type and category
  const renderIcon = () => {
    const iconClass = "w-5 h-5 text-[#E03E3E]";
    const wrapperClass = "w-10 h-10 shrink-0 rounded-full bg-[#faeaea] flex items-center justify-center border border-transparent relative";

    // Staff sees patient avatar
    if (isStaff) {
      return (
        <div className="w-10 h-10 shrink-0 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 relative">
          <span className="font-bold text-xs text-gray-700">
            {conversation.patient.first_name?.[0]}{conversation.patient.last_name?.[0]}
          </span>
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />
        </div>
      );
    }

    // Patient chatting with specific doctor
    if (conversation.assigned_doctor) {
      return (
        <div className="w-10 h-10 shrink-0 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 relative">
          <span className="font-bold text-xs text-gray-600">
            {conversation.assigned_doctor.first_name?.[0]}{conversation.assigned_doctor.last_name?.[0]}
          </span>
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />
        </div>
      );
    }

    // Support Channels
    switch (conversation.category) {
      case 'BILLING':
      case 'INSURANCE':
        return (
          <div className={wrapperClass}>
            <CreditCard className={iconClass} />
          </div>
        );
      case 'APPOINTMENT':
      case 'CONSULTATION':
      case 'TELEHEALTH':
        return (
          <div className={wrapperClass}>
            <Calendar className={iconClass} />
          </div>
        );
      case 'PRESCRIPTION':
      case 'MEDICAL_RECORDS':
        return (
          <div className={wrapperClass}>
            <FileText className={iconClass} />
          </div>
        );
      default:
        return (
          <div className={wrapperClass}>
            <MessageSquare className={iconClass} />
          </div>
        );
    }
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border-b border-gray-100 flex gap-4 transition-all hover:bg-gray-50 focus:outline-none cursor-pointer ${
        isActive ? 'bg-red-50/10 border-l-4 border-l-[#E03E3E] pl-3' : ''
      }`}
    >
      {renderIcon()}

      {/* Main Details */}
      <div className="flex-grow min-w-0 flex flex-col">
        <div className="flex justify-between items-start gap-1">
          <h4 className="font-bold text-gray-950 text-sm truncate leading-tight">
            {isStaff ? `${conversation.patient.first_name} ${conversation.patient.last_name}` : getChannelName()}
          </h4>
          <span className="text-[10px] text-gray-400 shrink-0 font-bold uppercase tracking-wider">
            {getFormattedTime(conversation.last_message_at)}
          </span>
        </div>
        
        {/* Red Subject Line (matching Figma) */}
        {conversation.subject && (
          <p className="text-[11px] font-bold text-[#E03E3E] truncate mt-0.5 leading-tight">
            {conversation.subject}
          </p>
        )}

        <p className={`text-xs mt-1 truncate ${
          conversation.unread_count > 0 && !isActive ? 'text-gray-900 font-bold' : 'text-gray-400 font-medium'
        }`}>
          {getLastMessageText()}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <ConversationStatusBadge department={conversation.department} />
          <ConversationStatusBadge status={conversation.status} />
        </div>
      </div>

      {/* Unread dot / Count */}
      {conversation.unread_count > 0 && !isActive && (
        <div className="shrink-0 flex items-center">
          <div className="w-5 h-5 rounded-full bg-[#E03E3E] text-white font-bold text-[10px] flex items-center justify-center shadow-sm">
            {conversation.unread_count}
          </div>
        </div>
      )}
    </button>
  );
}

export default ConversationCard;

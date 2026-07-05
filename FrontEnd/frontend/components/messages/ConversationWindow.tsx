import React, { useEffect, useRef, useState } from 'react';
import { Phone, Video, Lock, Info, Plus, MoreVertical } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Conversation, Message, InternalNote, ConversationActivity } from '@/services/messaging/messaging.types';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { ConversationStatusBadge } from './ConversationStatusBadge';
import { format, parseISO } from 'date-fns';

interface ConversationWindowProps {
  conversation: Conversation;
  messages: Message[];
  activities: ConversationActivity[];
  internalNotes: InternalNote[];
  onSendMessage: (content: string, attachmentUrl?: string) => void;
  onSendInternalNote: (content: string) => void;
  careTeamOnline: boolean;
  isTyping: boolean;
}

type TabMode = 'CHAT' | 'INTERNAL_NOTES';

export function ConversationWindow({
  conversation,
  messages,
  activities,
  internalNotes,
  onSendMessage,
  onSendInternalNote,
  careTeamOnline,
  isTyping
}: ConversationWindowProps) {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [tabMode, setTabMode] = useState<TabMode>('CHAT');
  
  const isStaff = !!user?.role && ['AGENT', 'DOCTOR', 'ADMIN'].includes(user.role);

  // Scroll to bottom on updates
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activities, internalNotes, tabMode]);

  // Merge messages, activities, and internal notes chronologically for display
  const getThreadItems = () => {
    const items: Array<{
      type: 'MESSAGE' | 'ACTIVITY' | 'NOTE';
      timestamp: string;
      data: any;
    }> = [];

    messages.forEach(m => {
      items.push({ type: 'MESSAGE', timestamp: m.created_at, data: m });
    });

    activities.forEach(a => {
      items.push({ type: 'ACTIVITY', timestamp: a.created_at, data: a });
    });

    if (isStaff) {
      internalNotes.forEach(n => {
        items.push({ type: 'NOTE', timestamp: n.created_at, data: n });
      });
    }

    return items.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  };

  const getTitle = () => {
    if (isStaff) {
      return `${conversation.patient.first_name} ${conversation.patient.last_name}`;
    }
    if (conversation.assigned_doctor) {
      return `Dr. ${conversation.assigned_doctor.first_name} ${conversation.assigned_doctor.last_name}`;
    }
    const categoryNames: Record<string, string> = {
      BILLING: 'Billing Support',
      INSURANCE: 'Insurance Support',
      APPOINTMENT: 'Appointment Desk',
      CONSULTATION: 'Eye Consultation Desk',
      TELEHEALTH: 'Telehealth Desk',
      PRESCRIPTION: 'Prescription Desk',
      MEDICAL_RECORDS: 'Medical Records Request',
      OTHER: 'Medical Care Team',
    };
    return categoryNames[conversation.category] || 'Medical Care Team';
  };

  const getSubtitle = () => {
    if (isStaff) {
      return `Patient ID: ${conversation.patient.id || 'NE-PENDING'}`;
    }
    const dept = conversation.department.charAt(0) + conversation.department.slice(1).toLowerCase().replace(/_/g, ' ');
    return `${dept} ${careTeamOnline ? 'Online' : 'Offline'}`;
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 font-bold text-xs text-gray-700">
              {isStaff ? (
                <span>{conversation.patient.first_name?.[0]}{conversation.patient.last_name?.[0]}</span>
              ) : conversation.assigned_doctor ? (
                <span>{conversation.assigned_doctor.first_name?.[0]}{conversation.assigned_doctor.last_name?.[0]}</span>
              ) : (
                <span className="text-[#E03E3E] font-bold">N</span>
              )}
            </div>
            {/* Online status indicator dot */}
            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
              isStaff || careTeamOnline ? 'bg-green-500' : 'bg-gray-400'
            }`} />
          </div>
          <div>
            <h3 className="font-bold text-gray-955 text-sm md:text-base leading-tight">
              {getTitle()}
            </h3>
            <p className={`text-xs font-bold mt-0.5 ${!isStaff && careTeamOnline ? 'text-green-600' : 'text-gray-400'}`}>
              {getSubtitle()}
            </p>
          </div>
        </div>

        {/* Action icons (Telehealth compatibility) */}
        <div className="flex items-center gap-2.5 text-gray-400">
          <button className="p-2 hover:bg-gray-50 hover:text-gray-900 rounded-full transition-colors focus:outline-none cursor-pointer">
            <Phone className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-gray-50 hover:text-gray-900 rounded-full transition-colors focus:outline-none cursor-pointer">
            <Video className="w-4 h-4" />
          </button>
          
          <div className="w-px h-5 bg-gray-200 mx-1" />
          
          <button className="p-2 hover:bg-gray-50 hover:text-gray-900 rounded-full transition-colors focus:outline-none cursor-pointer">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Staff Tab Switcher (Chat vs Private Notes) */}
      {isStaff && (
        <div className="flex border-b border-gray-100 text-xs font-semibold bg-gray-50/50 shrink-0">
          <button
            onClick={() => setTabMode('CHAT')}
            className={`flex-1 py-3 text-center border-b-2 cursor-pointer ${
              tabMode === 'CHAT' ? 'border-b-[#E03E3E] text-[#E03E3E]' : 'border-b-transparent text-gray-500'
            }`}
          >
            Chat with Patient
          </button>
          <button
            onClick={() => setTabMode('INTERNAL_NOTES')}
            className={`flex-1 py-3 text-center border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
              tabMode === 'INTERNAL_NOTES' ? 'border-b-[#E03E3E] text-[#E03E3E]' : 'border-b-transparent text-gray-500'
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> Staff Internal Notes
          </button>
        </div>
      )}

      {/* Messages Pane */}
      <div className="flex-grow overflow-y-auto p-6 bg-gray-50/30 flex flex-col">
        {(() => {
          let lastDateStr = '';
          return getThreadItems().map((item, idx) => {
            let dateSeparator: React.ReactNode = null;
            try {
              const currentMsgDate = format(parseISO(item.timestamp), 'yyyy-MM-dd');
              if (currentMsgDate !== lastDateStr) {
                lastDateStr = currentMsgDate;
                const displayDate = format(parseISO(item.timestamp), 'EEEE, MMM do');
                dateSeparator = (
                  <div className="flex justify-center my-4 w-full">
                    <span className="bg-red-50 text-[#E03E3E] text-xs px-4 py-1.5 rounded-full font-bold shadow-sm">
                      {displayDate}
                    </span>
                  </div>
                );
              }
            } catch (e) {
              console.error(e);
            }

            return (
              <React.Fragment key={`thread-wrapper-${idx}`}>
                {dateSeparator}
                {item.type === 'MESSAGE' && (
                  <MessageBubble message={item.data} />
                )}

                {item.type === 'NOTE' && (
                  <div className="flex justify-center mb-4">
                    <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 max-w-[85%] text-xs font-semibold text-yellow-800 shadow-sm flex flex-col gap-2 w-full md:w-auto">
                      <div className="flex items-center gap-1.5 text-[10px] text-yellow-600 font-bold uppercase tracking-wider">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>Internal Note by {item.data.author.first_name} {item.data.author.last_name}</span>
                      </div>
                      <p className="leading-relaxed whitespace-pre-wrap">{item.data.content}</p>
                      <span className="text-[9px] text-yellow-500 self-end mt-1">
                        {format(parseISO(item.data.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </div>
                )}

                {item.type === 'ACTIVITY' && (
                  <div className="flex justify-center my-4 animate-in fade-in duration-300 w-full">
                    <span className="bg-gray-100/60 border border-gray-100 rounded-full px-3 py-1 text-[10px] font-semibold text-gray-500 flex items-center gap-1.5 shadow-sm mx-auto">
                      <Info className="w-3.5 h-3.5 text-gray-400" />
                      {(() => {
                        const actorName = item.data.actor 
                          ? `${item.data.actor.first_name} ${item.data.actor.last_name}`
                          : 'System';
                          
                        switch (item.data.action) {
                          case 'CREATED':
                            return `${actorName} started the conversation.`;
                          case 'ASSIGNED_AGENT':
                            return `Assigned to agent ${item.data.metadata.agent_email}.`;
                          case 'ESCALATED_DOCTOR':
                            return `Escalated to specialist Dr. ${item.data.metadata.doctor_email}.`;
                          case 'DEPARTMENT_CHANGED':
                            return `Department routed to ${item.data.metadata.new_department.replace(/_/g, ' ')}.`;
                          case 'STATUS_CHANGED':
                            return `Status set to ${item.data.metadata.new_status.replace(/_/g, ' ')}.`;
                          case 'REOPENED':
                            return `Conversation reopened.`;
                          default:
                            return `${actorName} performed action: ${item.data.action}`;
                        }
                      })()}
                    </span>
                  </div>
                )}
              </React.Fragment>
            );
          });
        })()}

        {isTyping && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold px-2 animate-pulse mt-2">
            <span>Care Team is typing</span>
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-300"></span>
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer Container */}
      <div className="shrink-0">
        {tabMode === 'CHAT' ? (
          <MessageComposer onSend={onSendMessage} disabled={conversation.status === 'CLOSED'} />
        ) : (
          <div className="bg-yellow-50/30 border-t border-yellow-100 p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const input = form.elements.namedItem('note') as HTMLInputElement;
                if (input.value.trim()) {
                  onSendInternalNote(input.value);
                  input.value = '';
                }
              }}
              className="flex gap-3"
            >
              <input
                type="text"
                name="note"
                placeholder="Type a private staff note..."
                className="flex-grow bg-white border border-yellow-100 focus:border-yellow-400 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 h-12"
              />
              <button
                type="submit"
                className="w-12 h-12 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white flex items-center justify-center transition-colors shadow"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}
export default ConversationWindow;

import React, { useEffect, useRef, useState } from 'react';
import { Phone, Video, Lock, Info, Plus, MoreVertical, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
  /** Mobile only — returns to the conversation list. */
  onBack?: () => void;
  /** Mobile only — opens the details panel as a slide-over. */
  onOpenDetails?: () => void;
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
  isTyping,
  onBack,
  onOpenDetails,
}: ConversationWindowProps) {
  const { user } = useAuth();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [tabMode, setTabMode] = useState<TabMode>('CHAT');

  const isStaff = !!user?.role && ['AGENT', 'DOCTOR', 'ADMIN'].includes(user.role);

  // The call buttons were inert placeholders. A conversation only has a call to
  // join when it was spawned from (or linked to) a telehealth session, so gate
  // them on that rather than showing dead controls.
  const telehealthSessionId = conversation.related_telehealth_session;
  const telehealthBase = isStaff
    ? (user?.role === 'DOCTOR' ? '/doctor/telehealth' : '/agent/telehealth')
    : '/dashboard/telehealth';

  const joinCall = () => {
    if (!telehealthSessionId) return;
    router.push(`${telehealthBase}/${telehealthSessionId}`);
  };

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
      {/* Header — doubles as the mobile app bar (back arrow + who you're talking
          to + call actions), which is why it's sticky and compact on phones. */}
      <div className="px-2 md:px-5 h-14 md:h-auto md:py-3.5 border-b border-gray-100 flex items-center justify-between gap-2 bg-white shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back to conversations"
              className="md:hidden p-2 -ml-1 text-gray-600 hover:text-gray-900 rounded-md shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative shrink-0">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 font-bold text-xs text-gray-700">
              {isStaff ? (
                <span>{conversation.patient.first_name?.[0]}{conversation.patient.last_name?.[0]}</span>
              ) : conversation.assigned_doctor ? (
                <span>{conversation.assigned_doctor.first_name?.[0]}{conversation.assigned_doctor.last_name?.[0]}</span>
              ) : (
                <span className="text-[#E03E3E] font-bold">N</span>
              )}
            </div>
            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
              isStaff || careTeamOnline ? 'bg-green-500' : 'bg-gray-400'
            }`} />
          </div>

          {/* Tapping the name opens details, matching the pattern people expect
              from a mobile messaging app. */}
          <button
            onClick={onOpenDetails}
            className="min-w-0 text-left md:cursor-default"
          >
            <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">
              {getTitle()}
            </h3>
            <p className={`text-[11px] font-bold mt-0.5 truncate ${!isStaff && careTeamOnline ? 'text-green-600' : 'text-gray-400'}`}>
              {getSubtitle()}
            </p>
          </button>
        </div>

        <div className="flex items-center gap-0.5 md:gap-1.5 text-gray-400 shrink-0">
          {telehealthSessionId && (
            <>
              <button
                onClick={joinCall}
                aria-label="Join voice consultation"
                title="Join consultation"
                className="p-2 hover:bg-gray-50 hover:text-gray-900 rounded-full transition-colors"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={joinCall}
                aria-label="Join video consultation"
                title="Join video consultation"
                className="p-2 hover:bg-gray-50 hover:text-[#E03E3E] rounded-full transition-colors"
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}

          {onOpenDetails && (
            <button
              onClick={onOpenDetails}
              aria-label="Conversation details"
              className="md:hidden p-2 hover:bg-gray-50 hover:text-gray-900 rounded-full transition-colors"
            >
              <Info className="w-4 h-4" />
            </button>
          )}

          <button
            aria-label="More options"
            className="hidden md:block p-2 hover:bg-gray-50 hover:text-gray-900 rounded-full transition-colors"
          >
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
            Chat
          </button>
          <button
            onClick={() => setTabMode('INTERNAL_NOTES')}
            className={`flex-1 py-3 text-center border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
              tabMode === 'INTERNAL_NOTES' ? 'border-b-[#E03E3E] text-[#E03E3E]' : 'border-b-transparent text-gray-500'
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> <span className="truncate">Internal Notes</span>
          </button>
        </div>
      )}

      {/* Messages Pane */}
      <div className="flex-grow overflow-y-auto px-3 py-4 md:p-5 bg-gray-50/30 flex flex-col">
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
                    <span className="bg-red-50 text-[#E03E3E] text-[11px] px-3 py-1 rounded-full font-bold shadow-sm">
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
                    <div className="bg-yellow-50 border border-yellow-100 rounded-md p-3 max-w-[90%] md:max-w-[85%] text-xs font-semibold text-yellow-800 shadow-sm flex flex-col gap-2">
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
          <div className="bg-yellow-50/30 border-t border-yellow-100 p-3">
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
              className="flex gap-2"
            >
              <input
                type="text"
                name="note"
                placeholder="Type a private staff note..."
                className="flex-grow min-w-0 bg-white border border-yellow-100 focus:border-yellow-400 rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400 h-11"
              />
              <button
                type="submit"
                className="w-11 h-11 shrink-0 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white flex items-center justify-center transition-colors shadow"
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

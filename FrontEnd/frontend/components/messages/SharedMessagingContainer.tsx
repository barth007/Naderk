"use client";

import React, { useState, useEffect } from 'react';
import { 
  useConversations, 
  useConversationDetail, 
  useSendMessage, 
  useCreateInternalNote, 
  useAssignConversation,
  useDoctors
} from '@/services/messaging/messaging.hooks';
import { useWebSocket } from '@/hooks/useWebSocket';
import { 
  EmptyInbox, 
  ConversationList, 
  ConversationWindow, 
  ConversationDetailsSidebar, 
  NewConversationModal 
} from '@/components/messages';
import { 
  Loader2, MessageSquare, ShieldAlert, UserPlus, 
  Activity, ArrowRightLeft, CheckCircle2, RefreshCw 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function SharedMessagingContainer() {
  const { user } = useAuth();
  const { data: conversations = [], isLoading: isListLoading, isError, refetch } = useConversations();
  const { data: doctors = [] } = useDoctors();
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [closeReason, setCloseReason] = useState<string>('');
  const [isTriageExpanded, setIsTriageExpanded] = useState(false);

  const isPatient = user?.role === 'PATIENT';
  const isDoctor = user?.role === 'DOCTOR';
  const isAgent = user?.role === 'MEDICAL_AGENT' || user?.role === 'AGENT';
  const isStaff = isDoctor || isAgent || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  // WebSocket connection for real-time messages & updates
  const { 
    careTeamOnline, 
    typingUsers, 
    sendTypingStatus, 
    sendReadReceipt 
  } = useWebSocket(activeConversationId);

  const { data: detailData, isLoading: isDetailLoading, refetch: refetchDetail } = useConversationDetail(activeConversationId);
  const sendMutation = useSendMessage(activeConversationId);
  const noteMutation = useCreateInternalNote(activeConversationId);
  const assignMutation = useAssignConversation(activeConversationId);

  // Send read receipt when opening active conversation
  useEffect(() => {
    if (activeConversationId) {
      sendReadReceipt(activeConversationId);
    }
  }, [activeConversationId, detailData?.messages?.length]);

  const handleSendMessage = (content: string, attachmentUrl?: string) => {
    if (!activeConversationId) return;
    sendMutation.mutate({ content, attachment_url: attachmentUrl });
  };

  const handleSendInternalNote = (content: string) => {
    if (!activeConversationId) return;
    noteMutation.mutate(content);
  };

  const handleNewConversationSuccess = (newId: string) => {
    setActiveConversationId(newId);
  };

  // Agent coordination operations
  const handleAssignAgentSelf = () => {
    if (!activeConversationId) return;
    assignMutation.mutate({
      assigned_agent_id: user?.id,
      status: 'AGENT_ACTIVE',
      reason: 'Agent accepted queue task'
    }, {
      onSuccess: () => {
        toast.success("You have accepted and assigned this conversation to yourself.");
        refetchDetail();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.detail || "Failed to self-assign.");
      }
    });
  };

  const handleAssignDoctor = () => {
    if (!activeConversationId || !selectedDoctorId) {
      toast.error("Please select a doctor to assign.");
      return;
    }
    assignMutation.mutate({
      assigned_doctor_id: selectedDoctorId,
      status: 'WAITING_FOR_DOCTOR',
      reason: 'Escalated by Medical Agent to specialist doctor'
    }, {
      onSuccess: () => {
        toast.success("Specialist doctor assigned successfully.");
        setSelectedDoctorId('');
        refetchDetail();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.detail || "Selected doctor is not available or has exceeded workload limit.");
      }
    });
  };

  const handleUpdateTriage = () => {
    if (!activeConversationId) return;
    assignMutation.mutate({
      department: selectedDept || undefined,
      priority: selectedPriority || undefined,
      reason: 'Agent modified triage metadata'
    }, {
      onSuccess: () => {
        toast.success("Triage routing metadata updated.");
        refetchDetail();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.detail || "Failed to update triage details.");
      }
    });
  };

  const handleCloseConversation = () => {
    if (!activeConversationId || !closeReason) {
      toast.error("Please select a reason for closing the conversation.");
      return;
    }
    assignMutation.mutate({
      status: 'CLOSED',
      reason: `Closed reason: ${closeReason}`
    }, {
      onSuccess: () => {
        toast.success("Conversation closed and archived.");
        setCloseReason('');
        refetchDetail();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.detail || "Failed to close conversation.");
      }
    });
  };

  if (isListLoading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[450px]">
        <Loader2 className="w-8 h-8 text-[#E03E3E] animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-8 text-center text-[#E03E3E] max-w-lg mx-auto mt-10 border-red-100 rounded-2xl bg-red-50/10 shadow-sm flex flex-col items-center gap-3">
        <ShieldAlert className="w-10 h-10" />
        <span className="font-bold">Failed to load conversation history. Please try again.</span>
        <Button onClick={() => refetch()} variant="outline" className="mt-2 text-xs border-red-200 text-[#E03E3E] hover:bg-red-50">Retry</Button>
      </Card>
    );
  }

  // Doctor Empty Messaging State
  if (isDoctor && conversations.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white border border-gray-100 rounded-3xl">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-[#E03E3E] mb-4 border border-red-100/50">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-gray-900 text-lg">No patient conversations assigned yet</h3>
        <p className="text-gray-500 text-sm mt-1 max-w-sm font-semibold leading-relaxed">
          When a Medical Agent assigns patients to you, their conversations will appear here.
        </p>
        <Button 
          id="refresh_conversations"
          onClick={() => refetch()} 
          className="mt-5 bg-[#E03E3E] hover:bg-red-700 text-white font-bold px-6 py-2.5 h-11 rounded-xl flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Conversations
        </Button>
      </div>
    );
  }

  // Patient Empty State
  const showEmptyState = conversations.length === 0 && isPatient;

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col select-none">
      {showEmptyState ? (
        <EmptyInbox onStartConversation={() => setIsModalOpen(true)} />
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 items-stretch h-full overflow-hidden border border-gray-100 rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
          
          {/* Left Column: Conversation List */}
          <div className="md:col-span-3 h-full overflow-hidden border-r border-gray-100/80">
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={setActiveConversationId}
              onStartConversation={() => setIsModalOpen(true)}
            />
          </div>

          {/* Middle Column: Chat Window & Triage Manager */}
          <div className={`${activeConversationId && detailData ? 'md:col-span-6 border-r border-gray-100/80' : 'md:col-span-9'} h-full overflow-hidden flex flex-col bg-gray-50/20`}>
            
            {activeConversationId && detailData ? (
              <div className="flex-grow flex flex-col h-full overflow-hidden relative">
                
                {/* Agent Triage Control Panel (Agent/Admin Triage Workspace) */}
                {(isAgent || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                  <div className="border-b border-gray-100 bg-white px-5 py-3.5 flex flex-col gap-3 shadow-[0_2px_10px_rgba(0,0,0,0.01)] shrink-0 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4.5 h-4.5 text-[#E03E3E]" />
                        <span className="text-xs font-bold text-gray-800">Triage & Provider Assignment</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!detailData.conversation.assigned_agent && (
                          <Button 
                            id="btn_accept_chat"
                            size="sm" 
                            onClick={handleAssignAgentSelf} 
                            className="bg-green-600 hover:bg-green-700 text-white font-bold h-8 text-[11px] rounded-lg shadow-none"
                          >
                            <UserPlus className="w-3.5 h-3.5 mr-1" /> Accept Chat
                          </Button>
                        )}
                        <Button 
                          id="btn_toggle_triage"
                          size="sm" 
                          variant="ghost" 
                          onClick={() => setIsTriageExpanded(!isTriageExpanded)}
                          className="h-8 text-[11px] font-bold text-gray-500 hover:text-gray-900 border border-gray-150 hover:bg-gray-50 rounded-lg px-3 shadow-none"
                        >
                          {isTriageExpanded ? 'Hide Workspace' : 'Manage Case'}
                        </Button>
                      </div>
                    </div>

                    {isTriageExpanded && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-50 animate-in slide-in-from-top-2 duration-200">
                        {/* Assignment Column */}
                        <div className="space-y-3 p-3 bg-gray-50/50 border border-gray-100 rounded-xl">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Assign Doctor</label>
                          <div className="flex gap-2">
                            <select 
                              id="select_assign_doctor"
                              value={selectedDoctorId} 
                              onChange={(e) => setSelectedDoctorId(e.target.value)}
                              className="flex-grow bg-white border border-gray-250 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E]"
                            >
                              <option value="">Choose Specialist...</option>
                              {doctors.map(doc => (
                                <option key={doc.id} value={doc.id}>
                                  Dr. {doc.first_name} {doc.last_name} ({doc.specialization})
                                </option>
                              ))}
                            </select>
                            <Button 
                              id="btn_confirm_doctor_assign"
                              size="sm" 
                              onClick={handleAssignDoctor}
                              className="bg-[#E03E3E] hover:bg-red-700 text-white font-bold h-8 text-xs rounded-lg shadow-none shrink-0"
                            >
                              Assign
                            </Button>
                          </div>
                        </div>

                        {/* Queue routing Column */}
                        <div className="space-y-3 p-3 bg-gray-50/50 border border-gray-100 rounded-xl">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Triage Route & Priority</label>
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <select 
                                id="select_triage_dept"
                                value={selectedDept} 
                                onChange={(e) => setSelectedDept(e.target.value)}
                                className="flex-1 bg-white border border-gray-250 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E]"
                              >
                                <option value="">Dept Route...</option>
                                <option value="GENERAL">General</option>
                                <option value="APPOINTMENTS">Appointments</option>
                                <option value="OPHTHALMOLOGY">Ophthalmology</option>
                                <option value="OPTOMETRY">Optometry</option>
                                <option value="BILLING">Billing</option>
                                <option value="TELEHEALTH">Telehealth</option>
                                <option value="MEDICAL_RECORDS">Medical Records</option>
                                <option value="INSURANCE">Insurance</option>
                              </select>
                              <select 
                                id="select_triage_priority"
                                value={selectedPriority} 
                                onChange={(e) => setSelectedPriority(e.target.value)}
                                className="flex-1 bg-white border border-gray-250 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E]"
                              >
                                <option value="">Priority...</option>
                                <option value="LOW">Low</option>
                                <option value="NORMAL">Normal</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                              </select>
                            </div>
                            <Button 
                              id="btn_update_triage"
                              size="sm" 
                              onClick={handleUpdateTriage}
                              className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold h-8 text-xs rounded-lg shadow-none"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Route Ticket
                            </Button>
                          </div>
                        </div>

                        {/* Close Ticket Row */}
                        <div className="col-span-full space-y-2 p-3 bg-red-50/10 border border-red-100/30 rounded-xl">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Close & Archive Conversation</label>
                          <div className="flex gap-2">
                            <select
                              id="select_close_reason"
                              value={closeReason}
                              onChange={(e) => setCloseReason(e.target.value)}
                              className="flex-grow bg-white border border-gray-250 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E]"
                            >
                              <option value="">Reason for closure...</option>
                              <option value="RESOLVED">Resolved Case</option>
                              <option value="APPOINTMENT_BOOKED">Appointment Booked</option>
                              <option value="TELEHEALTH_COMPLETED">Telehealth Session Completed</option>
                              <option value="NO_RESPONSE">No Patient Response</option>
                              <option value="DUPLICATE">Duplicate Thread</option>
                              <option value="ESCALATED_ELSEWHERE">Escalated Externally</option>
                            </select>
                            <Button
                              id="btn_close_chat"
                              size="sm"
                              onClick={handleCloseConversation}
                              className="bg-gray-950 hover:bg-black text-white font-bold h-8 text-xs rounded-lg shadow-none shrink-0"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Close Case
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <ConversationWindow
                  conversation={detailData.conversation}
                  messages={detailData.messages}
                  activities={detailData.activities}
                  internalNotes={detailData.internal_notes || []}
                  onSendMessage={handleSendMessage}
                  onSendInternalNote={handleSendInternalNote}
                  careTeamOnline={careTeamOnline}
                  isTyping={typingUsers}
                />
              </div>
            ) : isDetailLoading ? (
              <div className="flex items-center justify-center flex-grow bg-white h-full">
                <Loader2 className="w-6 h-6 text-[#E03E3E] animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-grow bg-white h-full text-center p-8">
                <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-4 border border-gray-100">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm md:text-base">No conversation selected</h3>
                <p className="text-gray-400 text-xs mt-1.5 max-w-xs font-bold leading-relaxed">
                  Select a message thread from the sidebar or start a new conversation to get started.
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Participant Details Sidebar */}
          {activeConversationId && detailData && (
            <div className="md:col-span-3 h-full overflow-hidden hidden md:block">
              <ConversationDetailsSidebar conversation={detailData.conversation} />
            </div>
          )}
        </div>
      )}

      {/* Start Conversation Modal */}
      <NewConversationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleNewConversationSuccess}
      />
    </div>
  );
}

export default SharedMessagingContainer;

"use client";

import React, { useState, useEffect } from 'react';
import { 
  useConversations, 
  useConversationDetail, 
  useSendMessage, 
  useCreateInternalNote, 
  useAssignConversation 
} from '@/services/messaging/messaging.hooks';
import { useWebSocket } from '@/hooks/useWebSocket';
import { EmptyInbox, ConversationList, ConversationWindow, ConversationDetailsSidebar, NewConversationModal } from '@/components/messages';
import { Loader2, MessageSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

export default function MessagesPage() {
  const { user } = useAuth();
  const { data: conversations = [], isLoading: isListLoading, isError } = useConversations();
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const isStaff = !!user?.role && ['AGENT', 'DOCTOR', 'ADMIN'].includes(user.role);

  // WebSocket connection for real-time messages & updates
  const { 
    careTeamOnline, 
    typingUsers, 
    sendTypingStatus, 
    sendReadReceipt 
  } = useWebSocket(activeConversationId);

  const { data: detailData, isLoading: isDetailLoading } = useConversationDetail(activeConversationId);
  const sendMutation = useSendMessage(activeConversationId);
  const noteMutation = useCreateInternalNote(activeConversationId);

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

  // Loading state
  if (isListLoading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-[#E03E3E] animate-spin" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card className="p-8 text-center text-[#E03E3E] max-w-lg mx-auto mt-10">
        Failed to load messages. Please try again later.
      </Card>
    );
  }

  // Render Empty State if no conversations exist (patient only, staff should see list regardless)
  const showEmptyState = conversations.length === 0 && !isStaff;

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col">
      {showEmptyState ? (
        <EmptyInbox onStartConversation={() => setIsModalOpen(true)} />
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 items-stretch h-full overflow-hidden border border-gray-100 rounded-md bg-white">
          {/* Left Column: Conversation List */}
          <div className="md:col-span-3 h-full overflow-hidden border-r border-gray-100">
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={setActiveConversationId}
              onStartConversation={() => setIsModalOpen(true)}
            />
          </div>

          {/* Middle Column: Chat Window */}
          <div className={`${activeConversationId && detailData ? 'md:col-span-6 border-r border-gray-100' : 'md:col-span-9'} h-full overflow-hidden flex flex-col justify-center`}>
            {activeConversationId && detailData ? (
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
            ) : isDetailLoading ? (
              <div className="flex items-center justify-center flex-grow bg-white h-full">
                <Loader2 className="w-6 h-6 text-[#E03E3E] animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-grow bg-white h-full text-center p-8">
                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-4 border border-gray-100">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm md:text-base">No conversation selected</h3>
                <p className="text-gray-400 text-xs mt-1.5 max-w-xs font-semibold leading-relaxed">
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

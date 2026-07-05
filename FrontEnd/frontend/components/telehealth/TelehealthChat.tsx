import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useConversationDetail, useSendMessage } from '@/services/messaging/messaging.hooks';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Send, MessageSquare, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface TelehealthChatProps {
  conversationId: string;
}

export default function TelehealthChat({ conversationId }: TelehealthChatProps) {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');

  const { data: detailData, isLoading, refetch } = useConversationDetail(conversationId);
  const { mutateAsync: sendMessage } = useSendMessage(conversationId);

  // Establish WebSocket connection for real-time messaging
  const { careTeamOnline, sendReadReceipt } = useWebSocket(conversationId);

  const messages = detailData?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (conversationId && messages.length > 0) {
      sendReadReceipt(conversationId);
    }
  }, [messages.length, conversationId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await sendMessage({ content: text.trim() });
      setText('');
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = parseISO(isoString);
      return format(date, 'h:mm a');
    } catch {
      return '';
    }
  };

  const getInitials = (sender: any) => {
    if (sender?.first_name && sender?.last_name) {
      return `${sender.first_name[0]}${sender.last_name[0]}`;
    }
    return sender?.email?.[0].toUpperCase() || "U";
  };

  if (isLoading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-[#E03E3E]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Messages list pane */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg: any) => {
          const isMe = msg.sender.id === user?.id;

          if (isMe) {
            // Outgoing Message (Me) -> Right aligned
            return (
              <div key={msg.id} className="flex items-end justify-end gap-3.5 max-w-[90%] ml-auto">
                {/* Timestamp on left */}
                <span className="text-[10px] text-gray-400 font-semibold mb-1">
                  {formatTime(msg.created_at)}
                </span>
                
                {/* Message Bubble (Light Gray/Blue tint) */}
                <div className="bg-[#eef2f6] text-gray-900 text-[13px] font-medium px-4 py-3 rounded-2xl rounded-tr-sm leading-relaxed shadow-sm">
                  {msg.content}
                </div>

                {/* Avatar on right */}
                <div className="w-8 h-8 rounded-full bg-[#E03E3E]/10 border border-[#E03E3E]/20 flex items-center justify-center text-xs font-bold text-[#E03E3E] shrink-0 shadow-sm overflow-hidden">
                  {msg.sender.avatar ? (
                    <img src={msg.sender.avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(msg.sender)
                  )}
                </div>
              </div>
            );
          } else {
            // Incoming Message (Other) -> Left aligned (No bubble background)
            return (
              <div key={msg.id} className="flex items-start gap-3.5 max-w-[85%]">
                {/* Avatar on left */}
                <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-700 shrink-0 shadow-sm overflow-hidden">
                  {msg.sender.avatar ? (
                    <img src={msg.sender.avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(msg.sender)
                  )}
                </div>

                {/* Message text directly on panel background + Timestamp below */}
                <div className="flex flex-col">
                  <div className="text-gray-900 text-[13px] font-medium leading-relaxed">
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-gray-400 font-semibold mt-1">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              </div>
            );
          }
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input composer pane */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-100 shrink-0">
        <div className="relative flex items-center">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="w-full bg-[#F9FAFB] border border-gray-200 rounded-full py-3.5 pl-5 pr-14 text-[13px] font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-300 focus:ring-0 transition-colors"
          />
          <button
            type="submit"
            className="absolute right-2 p-2 bg-[#E03E3E] hover:bg-[#c93232] text-white rounded-full transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

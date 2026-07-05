import React from 'react';
import { format, parseISO } from 'date-fns';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { Message } from '@/services/messaging/messaging.types';
import { useAuth } from '@/hooks/useAuth';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { user } = useAuth();
  const isMine = message.sender.id === user?.id;

  const getFormattedTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'h:mm a');
    } catch {
      return '';
    }
  };

  const isImage = (url: string) => {
    return url.match(/\.(jpeg|jpg|gif|png)$/) != null || url.includes('image') || url.includes('png') || url.includes('jpg') || url.includes('jpeg');
  };

  return (
    <div className={`flex flex-col mb-4 max-w-[75%] ${isMine ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      
      {/* Sender details if not mine */}
      {!isMine && (
        <span className="text-[10px] text-gray-400 font-bold mb-1 ml-1.5 uppercase tracking-wide">
          {message.sender.role === 'PATIENT' 
            ? `${message.sender.first_name} ${message.sender.last_name}`
            : 'Medical Care Team'}
        </span>
      )}

      {/* Bubble Shell */}
      <div className={`rounded-md p-4 shadow-sm ${
        isMine 
          ? 'bg-[#E03E3E] text-white' 
          : 'bg-[#F3F4F6] text-gray-900'
      }`}>
        {/* Content text */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{message.content}</p>

        {/* Attachment rendering */}
        {message.attachment_url && (
          <div className="mt-3 border-t border-white/20 pt-3">
            {isImage(message.attachment_url) ? (
              <div className="rounded-md overflow-hidden border border-gray-100/10 max-w-full">
                <a 
                  href={message.attachment_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block relative group cursor-zoom-in"
                >
                  <img 
                    src={message.attachment_url} 
                    alt="Uploaded attachment" 
                    className="max-h-60 object-cover w-full transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ExternalLink className="w-5 h-5 text-white drop-shadow" />
                  </div>
                </a>
              </div>
            ) : (
              <a 
                href={message.attachment_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className={`flex items-center gap-3 p-3 rounded-md border text-xs font-semibold ${
                  isMine 
                    ? 'bg-red-700/30 border-red-700/20 text-white hover:bg-red-700/40' 
                    : 'bg-gray-50 border-gray-100 text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FileText className={`w-5 h-5 ${isMine ? 'text-white' : 'text-[#E03E3E]'}`} />
                <div className="flex-grow min-w-0">
                  <p className="truncate">Download Document</p>
                  <p className={`text-[10px] mt-0.5 ${isMine ? 'text-red-200' : 'text-gray-400'}`}>PDF Document</p>
                </div>
                <Download className="w-4 h-4 opacity-70 shrink-0" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-[9px] text-gray-400 font-semibold mt-1 px-1.5">
        {getFormattedTime(message.created_at)}
      </span>

    </div>
  );
}
export default MessageBubble;

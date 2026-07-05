import React from 'react';
import { MessageSquare, CheckCircle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface EmptyInboxProps {
  onStartConversation: () => void;
}

export function EmptyInbox({ onStartConversation }: EmptyInboxProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 w-full max-w-4xl mx-auto px-4">
      {/* Inbox Card */}
      <Card className="w-full bg-white p-8 md:p-12 text-center flex flex-col items-center shadow-sm border border-gray-100 mb-8 rounded-3xl">
        <div className="w-16 h-16 bg-[#FEF6F6] rounded-full flex items-center justify-center mb-6 text-[#E03E3E]">
          <MessageSquare className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Your inbox is empty</h2>
        <p className="text-gray-500 text-sm md:text-base mb-8 max-w-lg leading-relaxed">
          Have a question? Send a direct message to our care team anytime. We are here to help you with your eye care needs.
        </p>
        <Button 
          onClick={onStartConversation}
          variant="default"
          className="bg-[#E03E3E] hover:bg-red-700 text-white font-medium py-3 px-8 rounded-xl shadow h-12 transition-colors w-full sm:w-auto text-sm md:text-base"
        >
          Start a conversation
        </Button>
      </Card>

      {/* Messaging Tips */}
      <div className="w-full max-w-2xl px-4">
        <h3 className="font-bold text-gray-800 text-[15px] mb-5 uppercase tracking-wide text-center sm:text-left">
          Messaging Tips
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {/* Tip 1 */}
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-[#E03E3E] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-snug">24 Working Hours</p>
              <p className="text-xs text-gray-500 mt-0.5">Response time is usually within 24 working hours.</p>
            </div>
          </div>
          
          {/* Tip 2 */}
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-[#E03E3E] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-snug">Encrypted & Private</p>
              <p className="text-xs text-gray-500 mt-0.5">All messages are securely encrypted and private.</p>
            </div>
          </div>

          {/* Tip 3 */}
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-[#E03E3E] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-snug">Medical Documents</p>
              <p className="text-xs text-gray-500 mt-0.5">You can attach medical records or photos of your eyes.</p>
            </div>
          </div>

          {/* Tip 4 */}
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-[#E03E3E] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-snug">Emergencies</p>
              <p className="text-xs text-gray-500 mt-0.5">For emergencies, please call 911 immediately.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default EmptyInbox;

import React, { useState } from 'react';
import { Search, Plus, Pencil } from 'lucide-react';
import { Conversation } from '@/services/messaging/messaging.types';
import { ConversationCard } from './ConversationCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onStartConversation: () => void;
}

type FilterTab = 'ALL' | 'ACTIVE' | 'RESOLVED';

export function ConversationList({ 
  conversations, 
  activeConversationId, 
  onSelectConversation, 
  onStartConversation 
}: ConversationListProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  
  const isStaff = !!user?.role && ['AGENT', 'DOCTOR', 'ADMIN'].includes(user.role);

  // Apply search & tab filters
  const filteredConversations = conversations.filter(c => {
    const matchesSearch = 
      (c.subject && c.subject.toLowerCase().includes(search.toLowerCase())) ||
      c.category.toLowerCase().includes(search.toLowerCase()) ||
      (c.patient.first_name && c.patient.first_name.toLowerCase().includes(search.toLowerCase())) ||
      (c.patient.last_name && c.patient.last_name.toLowerCase().includes(search.toLowerCase())) ||
      (c.last_message && c.last_message.content.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === 'ACTIVE') {
      return !['RESOLVED', 'CLOSED'].includes(c.status);
    }
    if (activeTab === 'RESOLVED') {
      return ['RESOLVED', 'CLOSED'].includes(c.status);
    }
    return true;
  });

  return (
    <div className="w-full flex flex-col h-full bg-white overflow-hidden">
      {/* Top Section: Compose Message + Search */}
      <div className="p-5 border-b border-gray-100 flex flex-col gap-4">
        <h3 className="text-xl font-bold text-gray-950 leading-tight">Inbox</h3>
        
        {!isStaff && (
          <Button
            onClick={onStartConversation}
            variant="default"
            className="w-full bg-[#E03E3E] hover:bg-red-700 text-white font-bold h-11 rounded-md flex items-center justify-center gap-2 text-sm cursor-pointer shadow-sm border-none"
          >
            <Pencil className="w-4 h-4" /> Compose Message
          </Button>
        )}

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 focus:border-[#E03E3E] rounded-md pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#E03E3E] h-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 border-b border-gray-100 flex gap-4 text-xs font-semibold bg-gray-50/50">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`py-3 border-b-2 transition-all cursor-pointer ${
            activeTab === 'ALL' ? 'border-b-[#E03E3E] text-[#E03E3E]' : 'border-b-transparent text-gray-400'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab('ACTIVE')}
          className={`py-3 border-b-2 transition-all cursor-pointer ${
            activeTab === 'ACTIVE' ? 'border-b-[#E03E3E] text-[#E03E3E]' : 'border-b-transparent text-gray-400'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setActiveTab('RESOLVED')}
          className={`py-3 border-b-2 transition-all cursor-pointer ${
            activeTab === 'RESOLVED' ? 'border-b-[#E03E3E] text-[#E03E3E]' : 'border-b-transparent text-gray-400'
          }`}
        >
          Resolved
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-grow overflow-y-auto divide-y divide-gray-50">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs font-semibold">
            No conversations found.
          </div>
        ) : (
          filteredConversations.map(c => (
            <ConversationCard
              key={c.id}
              conversation={c}
              isActive={c.id === activeConversationId}
              onClick={() => onSelectConversation(c.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
export default ConversationList;

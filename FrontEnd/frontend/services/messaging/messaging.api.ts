import { apiClient } from '@/lib/api';
import { Conversation, Message, InternalNote, ConversationActivity } from './messaging.types';

export const messagingApi = {
  getConversations: async () => {
    const response = await apiClient.get('/messages/conversations/');
    return response.data.data.results as Conversation[];
  },

  createConversation: async (data: {
    category: string;
    subject?: string;
    message: string;
    attachment_url?: string;
    related_appointment_id?: string;
  }) => {
    const response = await apiClient.post('/messages/conversations/', data);
    return response.data.data as Conversation;
  },

  getConversationDetail: async (id: string) => {
    const response = await apiClient.get(`/messages/conversations/${id}/`);
    return response.data.data as {
      conversation: Conversation;
      messages: Message[];
      activities: ConversationActivity[];
      internal_notes: InternalNote[];
    };
  },

  sendMessage: async (id: string, data: { content: string; attachment_url?: string }) => {
    const response = await apiClient.post(`/messages/conversations/${id}/message/`, data);
    return response.data.data as Message;
  },

  assignConversation: async (id: string, data: {
    assigned_agent_id?: string | null;
    assigned_doctor_id?: string | null;
    department?: string;
    status?: string;
    priority?: string;
    reason?: string;
  }) => {
    const response = await apiClient.post(`/messages/conversations/${id}/assign/`, data);
    return response.data.data as Conversation;
  },

  getInternalNotes: async (id: string) => {
    const response = await apiClient.get(`/messages/conversations/${id}/notes/`);
    return response.data.data.results as InternalNote[];
  },

  createInternalNote: async (id: string, content: string) => {
    const response = await apiClient.post(`/messages/conversations/${id}/notes/`, { content });
    return response.data.data as InternalNote;
  },

  uploadAttachment: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/messages/upload/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data.url as string;
  },

  getDoctors: async () => {
    const response = await apiClient.get('/users/doctors/');
    return response.data.data.results as Array<{
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      specialization: string;
      full_name?: string;
    }>;
  },
};
export default messagingApi;

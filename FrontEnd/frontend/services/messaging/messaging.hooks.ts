import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagingApi } from './messaging.api';

export const useConversations = () => {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: messagingApi.getConversations,
  });
};

export const useConversationDetail = (id: string | undefined) => {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => messagingApi.getConversationDetail(id!),
    enabled: !!id,
  });
};

export const useCreateConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: messagingApi.createConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

export const useSendMessage = (conversationId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { content: string; attachment_url?: string }) => 
      messagingApi.sendMessage(conversationId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

export const useAssignConversation = (conversationId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      assigned_agent_id?: string | null;
      assigned_doctor_id?: string | null;
      department?: string;
      status?: string;
      priority?: string;
      reason?: string;
    }) => messagingApi.assignConversation(conversationId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

export const useCreateInternalNote = (conversationId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => messagingApi.createInternalNote(conversationId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
    },
  });
};

export const useUploadAttachment = () => {
  return useMutation({
    mutationFn: messagingApi.uploadAttachment,
  });
};

export const useDoctors = () => {
  return useQuery({
    queryKey: ['doctors'],
    queryFn: messagingApi.getDoctors,
  });
};

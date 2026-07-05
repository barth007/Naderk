import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from '@/lib/api';
import { 
  SessionsListResponse, 
  TelehealthSession, 
  TelehealthCredentials 
} from './telehealth.types';

export const useTelehealthSessions = () => {
  return useQuery({
    queryKey: ['telehealth-sessions'],
    queryFn: async () => {
      const response = await api.get('/telehealth/sessions/');
      return response.data.data as SessionsListResponse;
    }
  });
};

export const useTelehealthSessionDetail = (sessionId: string) => {
  return useQuery({
    queryKey: ['telehealth-session', sessionId],
    queryFn: async () => {
      const response = await api.get(`/telehealth/sessions/${sessionId}/`);
      return response.data.data as TelehealthSession;
    },
    enabled: !!sessionId
  });
};

export const useJoinTelehealthSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await api.post(`/telehealth/sessions/${sessionId}/join/`);
      return response.data.data as TelehealthCredentials;
    },
    onSuccess: (data, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['telehealth-session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['telehealth-sessions'] });
    }
  });
};

export const useEndTelehealthSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      sessionId: string;
      session_notes?: string;
      diagnosis?: string;
      recommendations?: string;
      follow_up_date?: string;
    }) => {
      const { sessionId, ...data } = payload;
      const response = await api.post(`/telehealth/session/${sessionId}/complete/`, data);
      return response.data.data as TelehealthSession;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['telehealth-session', variables.sessionId] });
      queryClient.invalidateQueries({ queryKey: ['telehealth-sessions'] });
    }
  });
};

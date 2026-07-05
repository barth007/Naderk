import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Message } from '@/services/messaging/messaging.types';

export const useWebSocket = (activeConversationId?: string) => {
  const queryClient = useQueryClient();
  const { accessToken, isAuthenticated } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [careTeamOnline, setCareTeamOnline] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(1000);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Prevents reconnect when we intentionally close (cleanup / token refresh)
  const intentionalCloseRef = useRef(false);
  const activeConversationIdRef = useRef(activeConversationId);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const sendJson = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const handleWebSocketMessage = useCallback((data: any) => {
    const { action } = data;

    switch (action) {
      case 'pong':
        break;

      case 'message': {
        const newMsg: Message = data.message;
        queryClient.setQueryData(
          ['conversation', newMsg.conversation],
          (oldData: any) => {
            if (!oldData) return oldData;
            const exists = oldData.messages.some((m: Message) => m.id === newMsg.id);
            if (exists) return oldData;
            return { ...oldData, messages: [...oldData.messages, newMsg] };
          }
        );
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        break;
      }

      case 'internal_note': {
        const newNote = data.note;
        queryClient.setQueryData(
          ['conversation', newNote.conversation_id],
          (oldData: any) => {
            if (!oldData) return oldData;
            const exists = oldData.internal_notes.some((n: any) => n.id === newNote.id);
            if (exists) return oldData;
            return { ...oldData, internal_notes: [...oldData.internal_notes, newNote] };
          }
        );
        break;
      }

      case 'conversation_update':
      case 'conversation_details_update':
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        if (activeConversationIdRef.current) {
          queryClient.invalidateQueries({ queryKey: ['conversation', activeConversationIdRef.current] });
        }
        break;

      case 'notification_received':
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        break;

      case 'typing': {
        const { conversation_id, is_typing } = data;
        setTypingUsers(prev => ({ ...prev, [conversation_id]: is_typing }));
        break;
      }

      case 'care_team_status':
        setCareTeamOnline(data.is_online);
        break;

      default:
        break;
    }
  }, [queryClient]);

  const connect = useCallback(() => {
    if (!isAuthenticated || !accessToken) return;

    // Null out onclose on the old socket before closing it so the close
    // doesn't trigger the reconnect handler.
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    intentionalCloseRef.current = false;

    const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000';
    const url = `${baseUrl}/ws/messaging/?token=${accessToken}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      setIsOnline(true);
      reconnectDelayRef.current = 1000;

      if (activeConversationIdRef.current) {
        ws.send(JSON.stringify({ action: 'subscribe', conversation_id: activeConversationIdRef.current }));
      }

      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (err) {
        console.warn('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setIsOnline(false);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

      // Only reconnect on unexpected disconnects
      if (!intentionalCloseRef.current) {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 1.5, 30000);
          connect();
        }, reconnectDelayRef.current);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [isAuthenticated, accessToken, handleWebSocketMessage]);

  // Subscribe / unsubscribe when active conversation changes without reconnecting
  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (activeConversationId) {
      sendJson({ action: 'subscribe', conversation_id: activeConversationId });
    }
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeConversationId) {
        sendJson({ action: 'unsubscribe', conversation_id: activeConversationId });
      }
    };
  }, [activeConversationId, sendJson]);

  // Connect on mount / when auth changes; cleanup on unmount
  useEffect(() => {
    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendTypingStatus = useCallback((conversationId: string, isTyping: boolean) => {
    sendJson({ action: 'typing', conversation_id: conversationId, is_typing: isTyping });
  }, [sendJson]);

  const sendReadReceipt = useCallback((conversationId: string) => {
    sendJson({ action: 'read', conversation_id: conversationId });
  }, [sendJson]);

  return {
    isOnline,
    careTeamOnline,
    typingUsers: typingUsers[activeConversationId || ''] || false,
    sendTypingStatus,
    sendReadReceipt,
  };
};

export default useWebSocket;

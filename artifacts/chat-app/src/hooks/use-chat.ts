import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '@/store';
import { useQueryClient } from '@tanstack/react-query';
import { getGetRoomMessagesQueryKey, type Message } from '@workspace/api-client-react';

export function useChat() {
  const socketRef = useRef<Socket | null>(null);
  const { token, activeRoom, setRoomUsers, matchState, setMatchState, addMatchMessage, clearMatch } = useStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;

    // Connect to same origin
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Emit initial room join
      socket.emit('join-room', { room: activeRoom, token });
    });

    socket.on('message', (msg: Message) => {
      // Update public room cache
      queryClient.setQueryData(getGetRoomMessagesQueryKey(msg.room), (old: Message[] | undefined) => {
        if (!old) return [msg];
        // Prevent duplicates
        if (old.some(m => m.id === msg.id)) return old;
        return [...old, msg];
      });
    });

    socket.on('room-users', ({ room, users }) => {
      setRoomUsers(room, users);
    });

    socket.on('waiting-for-match', () => {
      setMatchState('searching');
    });

    socket.on('match-found', ({ matchId, partner }) => {
      setMatchState('matched', matchId, partner);
    });

    socket.on('match-message', (msg: Message) => {
      addMatchMessage(msg);
    });

    socket.on('match-ended', () => {
      clearMatch();
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  // Handle room switching
  useEffect(() => {
    if (socketRef.current && token && matchState !== 'matched') {
      socketRef.current.emit('join-room', { room: activeRoom, token });
    }
  }, [activeRoom, token, matchState]);

  const sendMessage = (content: string, type: 'text' | 'audio' = 'text', audioUrl?: string) => {
    if (!socketRef.current) return;
    
    const payload = {
      content,
      messageType: type,
      audioUrl,
      room: matchState === 'matched' ? useStore.getState().matchId : activeRoom
    };

    if (matchState === 'matched') {
      // Send as match message
      socketRef.current.emit('chat-message', { ...payload, isMatch: true });
    } else {
      // Send as public room message
      socketRef.current.emit('chat-message', payload);
    }
  };

  const startMatch = () => socketRef.current?.emit('start-match', { token });
  const exitMatch = () => socketRef.current?.emit('exit-match');

  return { sendMessage, startMatch, exitMatch };
}

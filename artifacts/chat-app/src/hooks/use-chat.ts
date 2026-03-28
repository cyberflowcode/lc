import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '@/store';
import { useQueryClient } from '@tanstack/react-query';
import { getGetRoomMessagesQueryKey, type Message } from '@workspace/api-client-react';

export function useChat() {
  const socketRef = useRef<Socket | null>(null);
  const { token, activeRoom, setRoomUsers, setAllOnlineUsers, matchState, setMatchState, addMatchMessage, clearMatch } = useStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;

    // Connect to same origin — path must be under /api so the proxy routes it to the API server
    const socket = io({ path: '/api/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Emit initial room join
      socket.emit('join-room', { room: activeRoom, token });
    });

    socket.on('message', (msg: Message) => {
      // Use setQueriesData (prefix-match) so it catches any params variant e.g. { limit: 50 }
      queryClient.setQueriesData(
        { queryKey: getGetRoomMessagesQueryKey(msg.room) },
        (old: unknown) => {
          const msgs = old as Message[] | undefined;
          if (!msgs) return [msg];
          if (msgs.some(m => m.id === msg.id)) return msgs;
          return [...msgs, msg];
        }
      );
    });

    socket.on('room-users', ({ room, users }) => {
      setRoomUsers(room, users);
    });

    socket.on('all-users', ({ users, count }: { users: { username: string; avatar: string; status: string; room: string }[]; count: number }) => {
      setAllOnlineUsers(users, count);
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

    if (matchState === 'matched') {
      const matchId = useStore.getState().matchId;
      socketRef.current.emit('match-message', { matchId, content, messageType: type, audioUrl });
    } else {
      socketRef.current.emit('chat-message', { room: activeRoom, content, messageType: type, audioUrl });
    }
  };

  const startMatch = () => socketRef.current?.emit('start-match', { token });
  const exitMatch = () => {
    socketRef.current?.emit('exit-match');
    useStore.getState().clearMatch();
  };

  return { sendMessage, startMatch, exitMatch };
}

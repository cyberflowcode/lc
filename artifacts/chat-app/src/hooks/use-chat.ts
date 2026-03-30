import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore, type MessageWithReactions } from '@/store';
import { useQueryClient } from '@tanstack/react-query';
import { getGetRoomMessagesQueryKey } from '@workspace/api-client-react';

export function useChat() {
  const socketRef = useRef<Socket | null>(null);
  const {
    token, activeRoom, setRoomUsers, setAllOnlineUsers,
    matchState, setMatchState, addMatchMessage, clearMatch,
  } = useStore();
  const queryClient = useQueryClient();

  const updateMessageInCache = useCallback((msg: MessageWithReactions) => {
    queryClient.setQueriesData(
      { queryKey: getGetRoomMessagesQueryKey(msg.room) },
      (old: unknown) => {
        const msgs = old as MessageWithReactions[] | undefined;
        if (!msgs) return [msg];
        const idx = msgs.findIndex(m => m.id === msg.id);
        if (idx === -1) return msgs;
        const next = [...msgs];
        next[idx] = msg;
        return next;
      }
    );
  }, [queryClient]);

  useEffect(() => {
    if (!token) return;

    const socket = io({ path: '/api/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-room', { room: useStore.getState().activeRoom, token });
    });

    socket.on('message', (msg: MessageWithReactions) => {
      queryClient.setQueriesData(
        { queryKey: getGetRoomMessagesQueryKey(msg.room) },
        (old: unknown) => {
          const msgs = old as MessageWithReactions[] | undefined;
          if (!msgs) return [msg];
          if (msgs.some(m => m.id === msg.id)) return msgs;
          return [...msgs, msg];
        }
      );
    });

    socket.on('message-updated', (msg: MessageWithReactions) => {
      updateMessageInCache(msg);
    });

    socket.on('room-users', ({ room, users }: any) => {
      setRoomUsers(room, users);
    });

    socket.on('all-users', ({ users, count }: { users: { username: string; avatar: string; status: string; room: string }[]; count: number }) => {
      setAllOnlineUsers(users, count);
    });

    socket.on('waiting-for-match', () => {
      setMatchState('searching');
    });

    socket.on('match-found', ({ matchId, partner }: any) => {
      setMatchState('matched', matchId, partner);
    });

    socket.on('match-message', (msg: MessageWithReactions) => {
      addMatchMessage(msg);
    });

    socket.on('match-ended', () => {
      clearMatch();
    });

    socket.on('room-access-denied', ({ message }: { message: string }) => {
      window.dispatchEvent(new CustomEvent('room-access-denied', { detail: message }));
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (socketRef.current && token && matchState !== 'matched') {
      socketRef.current.emit('join-room', { room: activeRoom, token });
    }
  }, [activeRoom, token, matchState]);

  const sendMessage = (content: string, type: 'text' | 'audio' = 'text', audioUrl?: string, replyToId?: number) => {
    if (!socketRef.current) return;

    if (matchState === 'matched') {
      const matchId = useStore.getState().matchId;
      socketRef.current.emit('match-message', { matchId, content, messageType: type, audioUrl });
    } else {
      socketRef.current.emit('chat-message', { room: activeRoom, content, messageType: type, audioUrl, replyToId });
    }
  };

  const editMessage = (messageId: number, content: string) => {
    socketRef.current?.emit('edit-message', { messageId, content, room: useStore.getState().activeRoom });
  };

  const deleteMessage = (messageId: number) => {
    socketRef.current?.emit('delete-message', { messageId, room: useStore.getState().activeRoom });
  };

  const reactMessage = (messageId: number, emoji: string) => {
    socketRef.current?.emit('react-message', { messageId, emoji, room: useStore.getState().activeRoom });
  };

  const startMatch = () => socketRef.current?.emit('start-match', { token });
  const exitMatch = () => {
    socketRef.current?.emit('exit-match');
    useStore.getState().clearMatch();
  };

  return { sendMessage, editMessage, deleteMessage, reactMessage, startMatch, exitMatch };
}

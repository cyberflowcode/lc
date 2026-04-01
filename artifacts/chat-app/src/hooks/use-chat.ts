import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore, type MessageWithReactions } from '@/store';
import { useQueryClient } from '@tanstack/react-query';
import { getGetRoomMessagesQueryKey, getGetFriendsQueryKey, getGetFriendRequestsQueryKey } from '@workspace/api-client-react';

export function useChat() {
  const socketRef = useRef<Socket | null>(null);
  const {
    token, activeRoom, setRoomUsers, setAllOnlineUsers,
    matchState, setMatchState, addMatchMessage, clearMatch, setActiveRoom,
    addUnreadDmRoom, setPendingFriendRequestCount, pendingFriendRequestCount,
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

  const addMessageToCache = useCallback((msg: MessageWithReactions) => {
    queryClient.setQueriesData(
      { queryKey: getGetRoomMessagesQueryKey(msg.room) },
      (old: unknown) => {
        const msgs = old as MessageWithReactions[] | undefined;
        if (!msgs) return [msg];
        if (msgs.some(m => m.id === msg.id)) return msgs;
        return [...msgs, msg];
      }
    );
  }, [queryClient]);

  useEffect(() => {
    if (!token) return;

    const socket = io({ path: '/api/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Join personal inbox room for notifications
      socket.emit('setup-inbox', { token });
      socket.emit('join-room', { room: useStore.getState().activeRoom, token });
    });

    socket.on('message', (msg: MessageWithReactions) => {
      addMessageToCache(msg);
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

    socket.on('kicked-from-room', ({ roomKey }: { roomKey: string }) => {
      const { activeRoom: current } = useStore.getState();
      if (current === roomKey) {
        useStore.getState().setActiveRoom('Global');
      }
      window.dispatchEvent(new CustomEvent('kicked-from-room', { detail: 'You have been removed from this room.' }));
    });

    socket.on('room-deleted', ({ roomKey }: { roomKey: string }) => {
      const { activeRoom: current } = useStore.getState();
      if (current === roomKey) {
        useStore.getState().setActiveRoom('Global');
      }
      window.dispatchEvent(new CustomEvent('room-deleted', { detail: roomKey }));
    });

    // Real-time DM notification: message sent to a DM room you're not currently viewing
    socket.on('dm-notification', ({ room, message, fromUsername }: { room: string; message: MessageWithReactions; fromUsername: string }) => {
      // Add message to cache so it's ready when user opens the DM
      addMessageToCache(message);

      const { activeRoom: current, user } = useStore.getState();
      // Only mark unread if this DM is not the currently active room
      if (current !== room) {
        useStore.getState().addUnreadDmRoom(room);
      }

      // Extract other user's name from the DM room key and dispatch event for Dashboard
      const myUsername = user?.username;
      const parts = room.slice(3).split(':');
      const otherUsername = parts.find(n => n !== myUsername) || fromUsername;
      window.dispatchEvent(new CustomEvent('dm-notification', { detail: { room, fromUsername: otherUsername } }));
    });

    // Real-time friend request received
    socket.on('friend-request', (data: any) => {
      // Invalidate the friend requests query so it refetches
      queryClient.invalidateQueries({ queryKey: getGetFriendRequestsQueryKey() });
      // Bump pending count badge
      useStore.getState().setPendingFriendRequestCount(useStore.getState().pendingFriendRequestCount + 1);
      window.dispatchEvent(new CustomEvent('friend-request-received', { detail: data }));
    });

    // Real-time friend accepted
    socket.on('friend-accepted', (data: any) => {
      queryClient.invalidateQueries({ queryKey: getGetFriendsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetFriendRequestsQueryKey() });
      window.dispatchEvent(new CustomEvent('friend-accepted-received', { detail: data }));
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (socketRef.current && token && matchState !== 'matched') {
      socketRef.current.emit('join-room', { room: activeRoom, token });
      // Clear unread when switching to a DM room
      if (activeRoom.startsWith('dm:')) {
        useStore.getState().clearUnreadDmRoom(activeRoom);
      }
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

  const kickMember = (roomId: number, username: string) => {
    socketRef.current?.emit('kick-member', { roomId, username, token: useStore.getState().token });
  };

  const deleteRoom = (roomId: number) => {
    socketRef.current?.emit('delete-room', { roomId, token: useStore.getState().token });
  };

  const startMatch = () => socketRef.current?.emit('start-match', { token });
  const exitMatch = () => {
    socketRef.current?.emit('exit-match');
    useStore.getState().clearMatch();
  };

  return { sendMessage, editMessage, deleteMessage, reactMessage, kickMember, deleteRoom, startMatch, exitMatch };
}

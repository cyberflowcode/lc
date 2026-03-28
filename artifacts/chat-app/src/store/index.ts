import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Message } from '@workspace/api-client-react';

export type MatchState = 'idle' | 'searching' | 'matched';

interface AppState {
  token: string | null;
  user: User | null;
  setAuth: (token: string | null, user: User | null) => void;
  logout: () => void;

  activeRoom: string;
  setActiveRoom: (room: string) => void;

  matchState: MatchState;
  matchId: string | null;
  matchPartner: Partial<User> | null;
  matchMessages: Message[];
  setMatchState: (state: MatchState, id?: string, partner?: Partial<User>) => void;
  addMatchMessage: (msg: Message) => void;
  clearMatch: () => void;

  roomUsers: Record<string, Partial<User>[]>;
  setRoomUsers: (room: string, users: Partial<User>[]) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),

      activeRoom: 'Global',
      setActiveRoom: (room) => set({ activeRoom: room }),

      matchState: 'idle',
      matchId: null,
      matchPartner: null,
      matchMessages: [],
      setMatchState: (state, id, partner) => set({ matchState: state, matchId: id || null, matchPartner: partner || null }),
      addMatchMessage: (msg) => set((s) => ({ matchMessages: [...s.matchMessages, msg] })),
      clearMatch: () => set({ matchState: 'idle', matchId: null, matchPartner: null, matchMessages: [] }),

      roomUsers: {},
      setRoomUsers: (room, users) => set((s) => ({ roomUsers: { ...s.roomUsers, [room]: users } })),
    }),
    {
      name: 'litchat-storage',
      partialize: (state) => ({ token: state.token, user: state.user }), // only persist auth
    }
  )
);

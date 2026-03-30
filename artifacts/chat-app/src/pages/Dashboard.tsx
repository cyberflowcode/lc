import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useStore, type MessageWithReactions } from '@/store';
import { useGetMe, useGetRoomMessages } from '@workspace/api-client-react';
import { useChat } from '@/hooks/use-chat';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { ChatBubble } from '@/components/ChatBubble';
import { MatchOverlay } from '@/components/MatchOverlay';
import { FriendsPanel } from '@/components/FriendsPanel';
import { CreateRoomModal } from '@/components/CreateRoomModal';
import {
  LogOut, Hash, Send, Mic, Square, Loader2,
  Users, Zap, ChevronLeft, Globe, Gamepad2, X,
  MessageCircle, UserPlus, ArrowLeft, Lock, Plus, Bell, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

const ROOMS = ['Global', 'Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5'];

interface RoomItem {
  id: number;
  name: string;
  description?: string | null;
  createdBy: string;
  isPrivate: boolean;
  memberCount: number;
  pendingCount: number;
  isMember: boolean;
  isOwner: boolean;
  roomKey: string;
}

type MobilePanel = 'rooms' | 'friends' | 'people' | null;

function getDmRoom(me: string, other: string) {
  return `dm:${[me, other].sort().join(':')}`;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const {
    token, user, logout, activeRoom, setActiveRoom,
    matchState, matchPartner, matchMessages,
    roomUsers, allOnlineUsers, totalOnlineCount,
    replyTo, setReplyTo,
  } = useStore();
  const { toast } = useToast();

  const [sidebarTab, setSidebarTab] = useState<'rooms' | 'friends'>('rooms');
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [userRooms, setUserRooms] = useState<RoomItem[]>([]);
  const [joiningRoomId, setJoiningRoomId] = useState<number | null>(null);
  const [requestsRoomId, setRequestsRoomId] = useState<number | null>(null);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);

  useEffect(() => { if (!token) setLocation('/login'); }, [token, setLocation]);

  const fetchRooms = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/rooms', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUserRooms(await res.json());
    } catch {}
  }, [token]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  useEffect(() => {
    const handler = (e: Event) => toast({ variant: 'destructive', description: (e as CustomEvent).detail });
    window.addEventListener('room-access-denied', handler);
    return () => window.removeEventListener('room-access-denied', handler);
  }, [toast]);

  const openRequests = async (room: RoomItem) => {
    setRequestsRoomId(room.id);
    try {
      const res = await fetch(`/api/rooms/${room.id}/members`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const members = await res.json();
        setPendingMembers(members.filter((m: any) => m.status === 'pending'));
      }
    } catch {}
  };

  const handleAcceptMember = async (roomId: number, username: string) => {
    await fetch(`/api/rooms/${roomId}/accept/${username}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    setPendingMembers(prev => prev.filter(m => m.username !== username));
    fetchRooms();
    toast({ description: `${username} accepted!` });
  };

  const handleDeclineMember = async (roomId: number, username: string) => {
    await fetch(`/api/rooms/${roomId}/members/${username}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setPendingMembers(prev => prev.filter(m => m.username !== username));
    fetchRooms();
  };

  const handleJoinRoom = async (room: RoomItem) => {
    if (room.isMember) {
      handleRoomSelect(room.roomKey);
      return;
    }
    setJoiningRoomId(room.id);
    try {
      const res = await fetch(`/api/rooms/${room.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast({ description: data.message });
        fetchRooms();
        if (!room.isPrivate) handleRoomSelect(room.roomKey);
      } else {
        toast({ variant: 'destructive', description: data.error });
      }
    } catch {
      toast({ variant: 'destructive', description: 'Failed to join room' });
    } finally {
      setJoiningRoomId(null);
    }
  };

  useGetMe({
    request: { headers: { Authorization: `Bearer ${token}` } },
    query: { enabled: !!token, retry: false },
  });

  const { sendMessage, editMessage, deleteMessage, reactMessage, startMatch, exitMatch } = useChat();
  const { isRecording, duration, startRecording, stopRecording } = useAudioRecorder();

  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isDm = activeRoom.startsWith('dm:');

  const { data: rawMessages = [] } = useGetRoomMessages(
    activeRoom,
    { limit: 50 },
    {
      request: { headers: { Authorization: `Bearer ${token}` } },
      query: { enabled: !!token && matchState !== 'matched' },
    }
  );

  const publicMessages = rawMessages as unknown as MessageWithReactions[];
  const currentMessages = matchState === 'matched' ? matchMessages : publicMessages;
  const currentOnlineUsers = roomUsers[activeRoom] || [];

  const messagesById = Object.fromEntries(currentMessages.map(m => [m.id, m]));

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [currentMessages, isRecording]);

  useEffect(() => {
    const handleExit = () => exitMatch();
    window.addEventListener('exit-match-request', handleExit);
    return () => window.removeEventListener('exit-match-request', handleExit);
  }, [exitMatch]);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  const handleRoomSelect = (room: string) => {
    setActiveRoom(room);
    setReplyTo(null);
    setMobilePanel(null);
  };

  const handleDmUser = (username: string) => {
    if (!user) return;
    const dmRoom = getDmRoom(user.username, username);
    handleRoomSelect(dmRoom);
    setSidebarTab('rooms');
    setMobilePanel(null);
  };

  const toggleMobilePanel = (panel: MobilePanel) => {
    setMobilePanel(prev => prev === panel ? null : panel);
  };

  const handleSendText = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText.trim(), 'text', undefined, replyTo?.id);
    setInputText('');
    setReplyTo(null);
  };

  const handleMicClick = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob) uploadAndSendAudio(blob);
    } else {
      startRecording();
    }
  };

  const uploadAndSendAudio = async (blob: Blob) => {
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'audio.webm');
      const res = await fetch('/api/upload/audio', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { audioUrl } = await res.json();
      sendMessage('Audio message', 'audio', audioUrl, replyTo?.id);
      setReplyTo(null);
    } catch {
      toast({ variant: 'destructive', description: 'Failed to send voice message' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = () => {
    if (matchState !== 'idle') exitMatch();
    logout();
    setLocation('/login');
  };

  if (!token || !user) return <div className="min-h-screen bg-background" />;

  const dmOtherUser = isDm ? activeRoom.replace('dm:', '').split(':').find(n => n !== user.username) : null;
  const isUserRoom = activeRoom.startsWith('room:');
  const activeUserRoom = isUserRoom ? userRooms.find(r => r.roomKey === activeRoom) : null;

  const roomHeader = isDm
    ? <><ArrowLeft size={16} className="text-primary" /><span className="text-white">DM: {dmOtherUser}</span></>
    : isUserRoom
      ? <>{activeUserRoom?.isPrivate ? <Lock size={16} className="text-primary" /> : <Hash size={16} className="text-primary" />}<span className="text-white">{activeUserRoom?.name || activeRoom}</span></>
      : activeRoom === 'Global'
        ? <><Globe size={16} className="text-primary" /><span className="text-white">{activeRoom}</span></>
        : <><Hash size={16} className="text-primary" /><span className="text-white">{activeRoom}</span></>;

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background overflow-hidden text-foreground">
      <MatchOverlay />
      <CreateRoomModal open={createRoomOpen} onClose={() => setCreateRoomOpen(false)} onCreated={r => setUserRooms(prev => [...prev, r])} />

      {/* Join requests modal */}
      <AnimatePresence>
        {requestsRoomId !== null && (
          <>
            <motion.div key="req-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              onClick={() => setRequestsRoomId(null)} />
            <motion.div key="req-modal" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl pointer-events-auto">
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
                  <h2 className="font-bold text-white text-lg">Join Requests</h2>
                  <button onClick={() => setRequestsRoomId(null)} className="p-1.5 text-muted-foreground hover:text-white rounded-lg hover:bg-white/5">
                    <X size={18} />
                  </button>
                </div>
                <div className="px-5 py-4 space-y-2 max-h-80 overflow-y-auto">
                  {pendingMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No pending requests</p>
                  ) : pendingMembers.map(m => (
                    <div key={m.username} className="flex items-center gap-3 py-2">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                        {m.username[0].toUpperCase()}
                      </div>
                      <span className="text-sm text-white flex-1 font-medium">{m.username}</span>
                      <button onClick={() => handleDeclineMember(requestsRoomId, m.username)}
                        className="px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                        Decline
                      </button>
                      <button onClick={() => handleAcceptMember(requestsRoomId, m.username)}
                        className="px-2.5 py-1 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors">
                        Accept
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── MOBILE PANEL BACKDROP ── */}
      <AnimatePresence>
        {mobilePanel && (
          <motion.div
            key="mobile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobilePanel(null)}
          />
        )}
      </AnimatePresence>

      {/* ── MOBILE UNIFIED SLIDE-UP PANEL ── */}
      <AnimatePresence>
        {mobilePanel && (
          <motion.div
            key="mobile-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-[57px] left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border shadow-2xl lg:hidden flex flex-col h-[72vh]"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Panel header */}
            <div className="px-4 pb-2 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-white text-base capitalize">
                {mobilePanel === 'rooms' ? 'Chat Rooms' : mobilePanel === 'friends' ? 'Friends' : 'Online People'}
              </h3>
              <button onClick={() => setMobilePanel(null)} className="p-1.5 text-muted-foreground hover:text-white rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Rooms panel */}
            {mobilePanel === 'rooms' && (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1">
                  {ROOMS.map(room => (
                    <button
                      key={room}
                      onClick={() => handleRoomSelect(room)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all',
                        activeRoom === room
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {room === 'Global' ? <Globe size={18} /> : <Hash size={18} />}
                      <span className="flex-1 text-left">{room}</span>
                      {activeRoom === room && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </button>
                  ))}
                  {isDm && (
                    <div className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium bg-primary/15 text-primary">
                      <MessageCircle size={18} />
                      <span className="flex-1 text-left">DM: {dmOtherUser}</span>
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                  )}

                  {/* User-created rooms section */}
                  <div className="pt-3 mt-1 border-t border-border">
                    <div className="flex items-center justify-between px-1 mb-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">My Rooms</span>
                      <button onClick={() => { setMobilePanel(null); setCreateRoomOpen(true); }}
                        className="w-6 h-6 rounded-lg bg-white/5 hover:bg-primary/20 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors">
                        <Plus size={13} />
                      </button>
                    </div>
                    {userRooms.length === 0 ? (
                      <button onClick={() => { setMobilePanel(null); setCreateRoomOpen(true); }}
                        className="w-full text-xs text-muted-foreground text-center py-3 rounded-2xl hover:bg-white/5 transition-colors">
                        + Create your first room
                      </button>
                    ) : userRooms.map(room => (
                      <div key={room.id} className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all group',
                        activeRoom === room.roomKey ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-white/5 hover:text-white',
                      )}>
                        <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => handleJoinRoom(room)}>
                          {room.isPrivate ? <Lock size={16} className="flex-shrink-0" /> : <Hash size={16} className="flex-shrink-0" />}
                          <span className="flex-1 truncate">{room.name}</span>
                          {joiningRoomId === room.id && <Loader2 size={14} className="animate-spin flex-shrink-0" />}
                          {!room.isMember && room.isPrivate && <Clock size={13} className="text-yellow-500 flex-shrink-0" />}
                          {activeRoom === room.roomKey && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                        </button>
                        {room.isOwner && room.pendingCount > 0 && (
                          <button onClick={() => { setMobilePanel(null); openRequests(room); }}
                            className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-bold flex items-center justify-center">
                            {room.pendingCount}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="px-3 pt-2 pb-4 flex-shrink-0">
                  <button
                    onClick={() => { startMatch(); setMobilePanel(null); }}
                    className="w-full relative group overflow-hidden rounded-xl p-[1px]"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-80" />
                    <div className="relative flex items-center justify-center gap-2 bg-card py-3 px-4 rounded-[11px]">
                      <Zap className="w-4 h-4 text-accent" fill="currentColor" />
                      <span className="font-bold text-white text-sm">Start Random Match</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Friends panel */}
            {mobilePanel === 'friends' && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <FriendsPanel onDmUser={handleDmUser} />
              </div>
            )}

            {/* People / online users panel */}
            {mobilePanel === 'people' && (
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users size={14} className="text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Online now</span>
                  <span className="ml-auto text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">{totalOnlineCount}</span>
                </div>
                {allOnlineUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center mt-4">No one else online</p>
                ) : (
                  allOnlineUsers.map((u, i) => (
                    <div key={`${u.username}-${i}`} className="flex items-center gap-3 group">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-base border border-white/5">
                          {u.avatar}
                        </div>
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/90 truncate">{u.username}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{u.room || 'Online'}</p>
                      </div>
                      {u.username !== user.username && (
                        <button
                          onClick={() => handleDmUser(u.username)}
                          className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex-shrink-0"
                          title={`Message ${u.username}`}
                        >
                          <MessageCircle size={16} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN LAYOUT ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Desktop Left Sidebar */}
        <aside className={cn(
          'hidden lg:flex flex-col flex-shrink-0 w-72 bg-card border-r border-border transition-all duration-300',
          matchState === 'matched' ? '-ml-72 opacity-0 pointer-events-none' : '',
        )}>
          <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-black/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-xl shadow-inner border border-white/5">
                {user.avatar}
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">{user.username}</p>
                <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Online
                </p>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-white/5">
              <LogOut size={18} />
            </button>
          </div>

          <div className="flex border-b border-border flex-shrink-0">
            <button
              onClick={() => setSidebarTab('rooms')}
              className={cn(
                "flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors",
                sidebarTab === 'rooms' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"
              )}
            >
              <Hash size={13} /> Rooms
            </button>
            <button
              onClick={() => setSidebarTab('friends')}
              className={cn(
                "flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors",
                sidebarTab === 'friends' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"
              )}
            >
              <UserPlus size={13} /> Friends
            </button>
          </div>

          {sidebarTab === 'rooms' ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 ml-1">Chat Rooms</h3>
                {ROOMS.map(room => (
                  <button
                    key={room}
                    onClick={() => handleRoomSelect(room)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all',
                      activeRoom === room
                        ? 'bg-primary/15 text-primary shadow-[inset_4px_0_0_0_hsl(var(--primary))]'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {room === 'Global' ? <Globe size={18} /> : <Hash size={18} />}
                    {room}
                    {activeRoom === room && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                  </button>
                ))}
                {isDm && (
                  <div className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium bg-primary/15 text-primary shadow-[inset_4px_0_0_0_hsl(var(--primary))]">
                    <MessageCircle size={18} />
                    DM: {dmOtherUser}
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  </div>
                )}

                {/* User-created rooms */}
                <div className="pt-4 mt-2 border-t border-border">
                  <div className="flex items-center justify-between mb-2 ml-1">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">My Rooms</h3>
                    <button
                      onClick={() => setCreateRoomOpen(true)}
                      className="w-6 h-6 rounded-lg bg-white/5 hover:bg-primary/20 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors"
                      title="Create room"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  {userRooms.length === 0 ? (
                    <button
                      onClick={() => setCreateRoomOpen(true)}
                      className="w-full text-xs text-muted-foreground hover:text-white text-center py-3 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      + Create your first room
                    </button>
                  ) : userRooms.map(room => (
                    <div key={room.id} className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                      activeRoom === room.roomKey
                        ? 'bg-primary/15 text-primary shadow-[inset_4px_0_0_0_hsl(var(--primary))]'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-white',
                    )}>
                      <button className="flex items-center gap-2.5 flex-1 min-w-0 text-left" onClick={() => handleJoinRoom(room)}>
                        {room.isPrivate ? <Lock size={15} className="flex-shrink-0" /> : <Hash size={15} className="flex-shrink-0" />}
                        <span className="truncate flex-1">{room.name}</span>
                        {!room.isMember && (
                          room.isPrivate
                            ? <Clock size={12} className="flex-shrink-0 text-yellow-500" title="Request to join" />
                            : <Plus size={12} className="flex-shrink-0 opacity-0 group-hover:opacity-100" />
                        )}
                        {joiningRoomId === room.id && <Loader2 size={12} className="animate-spin flex-shrink-0" />}
                      </button>
                      {room.isOwner && room.pendingCount > 0 && (
                        <button
                          onClick={() => openRequests(room)}
                          className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-[10px] font-bold hover:bg-yellow-500/30 transition-colors"
                          title={`${room.pendingCount} join request(s)`}
                        >
                          {room.pendingCount}
                        </button>
                      )}
                      {activeRoom === room.roomKey && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-border bg-black/20 flex-shrink-0">
                <button
                  onClick={startMatch}
                  className="w-full relative group overflow-hidden rounded-xl p-[1px]"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center justify-center gap-2 bg-card py-3 px-4 rounded-[11px] group-hover:bg-card/80 transition-colors">
                    <Zap className="w-5 h-5 text-accent group-hover:text-white transition-colors" fill="currentColor" />
                    <span className="font-bold text-white tracking-wide">Start Random Match</span>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden">
              <FriendsPanel onDmUser={handleDmUser} />
            </div>
          )}
        </aside>

        {/* Main Column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-grid-pattern relative">

            {/* Header */}
            <header className="h-14 lg:h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center px-3 lg:px-6 flex-shrink-0 shadow-sm z-10">
              {matchState === 'matched' ? (
                <div className="flex items-center gap-2 lg:gap-4 w-full">
                  <button onClick={() => exitMatch()} className="p-2 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white transition-colors flex-shrink-0">
                    <ChevronLeft size={20} />
                  </button>
                  <div className="flex items-center gap-2 lg:gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-lg border border-primary/50 flex-shrink-0">
                      {matchPartner?.avatar}
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-base leading-tight text-white truncate">{matchPartner?.username}</h2>
                      <span className="text-xs text-primary font-medium">Private Match</span>
                    </div>
                  </div>
                  <button onClick={() => exitMatch()} className="px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white rounded-lg text-xs font-semibold transition-colors flex-shrink-0">
                    End
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 lg:gap-3 w-full">
                  {/* Mobile profile button */}
                  <div className="relative lg:hidden flex-shrink-0" ref={profileRef}>
                    <button
                      onClick={() => setProfileOpen(p => !p)}
                      className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-base border border-white/10 hover:border-primary/40 transition-colors"
                    >
                      {user.avatar}
                    </button>
                    <AnimatePresence>
                      {profileOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.95 }}
                          className="absolute top-full left-0 mt-2 w-48 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50"
                        >
                          <div className="px-4 py-3 border-b border-border">
                            <p className="font-bold text-white text-sm">{user.username}</p>
                            <p className="text-xs text-green-400 flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Online
                            </p>
                          </div>
                          <button
                            onClick={() => { setProfileOpen(false); handleLogout(); }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <LogOut size={15} /> Log out
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="p-1.5 lg:p-2 bg-secondary rounded-lg flex-shrink-0">
                    {isDm ? <MessageCircle size={18} className="text-primary" />
                      : isUserRoom ? (activeUserRoom?.isPrivate ? <Lock size={18} className="text-primary" /> : <Hash size={18} className="text-primary" />)
                      : activeRoom === 'Global' ? <Globe size={18} className="text-primary" />
                        : <Hash size={18} className="text-primary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-sm lg:text-lg leading-tight text-white truncate flex items-center gap-2">
                      {roomHeader}
                    </h2>
                    {!isDm && <span className="text-xs text-muted-foreground hidden lg:block">{currentOnlineUsers.length} online</span>}
                  </div>
                  {isDm && (
                    <button
                      onClick={() => handleRoomSelect('Global')}
                      className="flex-shrink-0 px-3 py-1.5 text-xs text-muted-foreground hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      ← Rooms
                    </button>
                  )}
                  {!isDm && (
                    <div className="flex items-center gap-1.5 lg:hidden flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs text-green-400 font-semibold">{totalOnlineCount}</span>
                    </div>
                  )}
                </div>
              )}
            </header>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 min-h-0 overflow-y-auto p-3 lg:p-6 space-y-3 lg:space-y-6 scroll-smooth"
            >
              {currentMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                  <Gamepad2 className="w-12 h-12 lg:w-16 lg:h-16 mb-3" />
                  <p className="text-base lg:text-lg font-medium">No messages yet.</p>
                  <p className="text-sm">Be the first to say hello!</p>
                </div>
              ) : (
                currentMessages.map(msg => (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    replySource={msg.replyToId ? messagesById[msg.replyToId] : null}
                    onReply={matchState !== 'matched' ? (m) => setReplyTo(m) : undefined}
                    onEdit={matchState !== 'matched' ? (id, content) => editMessage(id, content) : undefined}
                    onDelete={matchState !== 'matched' ? (id) => deleteMessage(id) : undefined}
                    onReact={matchState !== 'matched' ? (id, emoji) => reactMessage(id, emoji) : undefined}
                  />
                ))
              )}
            </div>

            {/* Reply-to bar */}
            <AnimatePresence>
              {replyTo && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="flex items-center gap-3 px-4 py-2 bg-primary/10 border-t border-primary/20 mx-2 rounded-t-xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-primary font-semibold">Replying to {replyTo.username}</p>
                    <p className="text-xs text-white/60 truncate">{replyTo.isDeleted ? 'Deleted message' : (replyTo.content || 'Audio message')}</p>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="flex-shrink-0 p-1 text-muted-foreground hover:text-white">
                    <X size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input bar */}
            <div className="flex-shrink-0 p-2 lg:p-4 bg-card/80 backdrop-blur-md border-t border-border">
              <form onSubmit={handleSendText} className="flex items-center gap-2 lg:gap-3 max-w-5xl mx-auto">
                <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-1 py-1 flex items-center gap-1 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder={isRecording ? '' : (replyTo ? `Reply to ${replyTo.username}...` : 'Message...')}
                    disabled={isRecording || isUploading}
                    className="flex-1 bg-transparent px-2 lg:px-3 py-2 text-white placeholder:text-white/30 focus:outline-none disabled:opacity-50 text-sm lg:text-base"
                  />
                  {isRecording && (
                    <div className="flex items-center gap-2 px-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                      <span className="text-destructive font-mono text-sm">
                        {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5 lg:gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleMicClick}
                    disabled={isUploading}
                    className={cn(
                      'w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center transition-all',
                      isRecording
                        ? 'bg-destructive text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse'
                        : 'bg-secondary text-white hover:bg-secondary/80',
                      isUploading && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    {isUploading ? <Loader2 size={18} className="animate-spin" />
                      : isRecording ? <Square size={16} fill="currentColor" />
                        : <Mic size={18} />}
                  </button>
                  <button
                    type="submit"
                    disabled={(!inputText.trim() && !isRecording) || isUploading}
                    className="h-10 lg:h-12 px-4 lg:px-6 bg-primary text-white rounded-xl font-semibold flex items-center gap-1.5 hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-[0.97]"
                  >
                    <span className="hidden sm:inline text-sm lg:text-base">Send</span>
                    <Send size={16} />
                  </button>
                </div>
              </form>
            </div>
          </main>

          {/* ── MOBILE BOTTOM NAV ── */}
          {matchState !== 'matched' && (
            <nav className="lg:hidden flex-shrink-0 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
              <div className="flex items-stretch">
                {/* Current room indicator (left) */}
                <div className="flex-1 flex items-center gap-1.5 px-3 py-2.5 min-w-0">
                  {isDm
                    ? <MessageCircle size={14} className="text-primary flex-shrink-0" />
                    : isUserRoom
                      ? (activeUserRoom?.isPrivate ? <Lock size={14} className="text-primary flex-shrink-0" /> : <Hash size={14} className="text-primary flex-shrink-0" />)
                      : activeRoom === 'Global'
                        ? <Globe size={14} className="text-primary flex-shrink-0" />
                        : <Hash size={14} className="text-primary flex-shrink-0" />}
                  <span className="text-xs font-semibold text-white truncate">
                    {isDm ? `DM: ${dmOtherUser}` : isUserRoom ? (activeUserRoom?.name || activeRoom) : activeRoom}
                  </span>
                </div>

                {/* Tab buttons (right) */}
                <div className="flex items-stretch border-l border-border">
                  <button
                    onClick={() => toggleMobilePanel('rooms')}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 px-4 py-2 transition-colors",
                      mobilePanel === 'rooms' ? "text-primary" : "text-muted-foreground hover:text-white"
                    )}
                  >
                    <Hash size={18} />
                    <span className="text-[10px] font-semibold">Rooms</span>
                  </button>
                  <button
                    onClick={() => toggleMobilePanel('friends')}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 px-4 py-2 transition-colors",
                      mobilePanel === 'friends' ? "text-primary" : "text-muted-foreground hover:text-white"
                    )}
                  >
                    <UserPlus size={18} />
                    <span className="text-[10px] font-semibold">Friends</span>
                  </button>
                  <button
                    onClick={() => toggleMobilePanel('people')}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 px-4 py-2 transition-colors relative",
                      mobilePanel === 'people' ? "text-primary" : "text-muted-foreground hover:text-white"
                    )}
                  >
                    <Users size={18} />
                    <span className="text-[10px] font-semibold">People</span>
                    {totalOnlineCount > 0 && (
                      <span className="absolute top-1.5 right-2.5 w-4 h-4 flex items-center justify-center bg-green-500 rounded-full text-[9px] font-bold text-white">
                        {totalOnlineCount > 9 ? '9+' : totalOnlineCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </nav>
          )}
        </div>

        {/* Desktop Right Sidebar */}
        {matchState !== 'matched' && !isDm && (
          <aside className="w-64 bg-card border-l border-border hidden lg:flex flex-col flex-shrink-0">
            <div className="p-5 border-b border-border flex-shrink-0">
              <h3 className="font-bold flex items-center gap-2 text-white">
                <Users size={18} className="text-primary" />
                Online
                <span className="ml-auto bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full border border-green-500/30">
                  {totalOnlineCount}
                </span>
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {allOnlineUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center mt-4">No one online yet</p>
              ) : (
                allOnlineUsers.map((u, i) => (
                  <div key={`${u.username}-${i}`} className="flex items-center gap-3 group">
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-base border border-white/5 group-hover:border-primary/50 transition-colors">
                        {u.avatar}
                      </div>
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-semibold text-white/90 truncate">{u.username}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{u.room || 'Online'}</span>
                    </div>
                    {u.username !== user.username && (
                      <button
                        onClick={() => handleDmUser(u.username)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all"
                        title={`Message ${u.username}`}
                      >
                        <MessageCircle size={14} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useStore } from '@/store';
import { useGetMe, useGetRoomMessages } from '@workspace/api-client-react';
import { useChat } from '@/hooks/use-chat';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { ChatBubble } from '@/components/ChatBubble';
import { MatchOverlay } from '@/components/MatchOverlay';
import {
  LogOut, Hash, Send, Mic, Square, Loader2,
  Users, Zap, ChevronLeft, Globe, Gamepad2, Menu, X, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

const ROOMS = ['Global', 'Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5'];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const {
    token, user, logout, activeRoom, setActiveRoom,
    matchState, matchPartner, matchMessages,
    roomUsers, allOnlineUsers, totalOnlineCount,
  } = useStore();
  const { toast } = useToast();

  // Desktop sidebar / mobile sheets
  const [sidebarOpen, setSidebarOpen] = useState(false);   // desktop + mobile rooms
  const [roomsSheetOpen, setRoomsSheetOpen] = useState(false); // mobile rooms bottom sheet
  const [settingsOpen, setSettingsOpen] = useState(false);     // mobile settings bottom sheet

  useEffect(() => { if (!token) setLocation('/login'); }, [token, setLocation]);

  useGetMe({
    request: { headers: { Authorization: `Bearer ${token}` } },
    query: { enabled: !!token, retry: false },
  });

  const { sendMessage, startMatch, exitMatch } = useChat();
  const { isRecording, duration, startRecording, stopRecording } = useAudioRecorder();

  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: publicMessages = [] } = useGetRoomMessages(activeRoom, { limit: 50 }, {
    request: { headers: { Authorization: `Bearer ${token}` } },
    query: { enabled: !!token && matchState !== 'matched' },
  });

  const currentMessages = matchState === 'matched' ? matchMessages : publicMessages;
  const currentOnlineUsers = roomUsers[activeRoom] || [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [currentMessages, isRecording]);

  useEffect(() => {
    const handleExit = () => exitMatch();
    window.addEventListener('exit-match-request', handleExit);
    return () => window.removeEventListener('exit-match-request', handleExit);
  }, [exitMatch]);

  const handleRoomSelect = (room: string) => {
    setActiveRoom(room);
    setSidebarOpen(false);
    setRoomsSheetOpen(false);
  };

  const handleSendText = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText.trim(), 'text');
    setInputText('');
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
      sendMessage('Audio message', 'audio', audioUrl);
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

  const anySheetOpen = roomsSheetOpen || settingsOpen;

  return (
    // Root: fixed height, no overflow
    <div className="h-[100dvh] w-full flex bg-background overflow-hidden text-foreground">
      <MatchOverlay />

      {/* ── Mobile Sheet Backdrop ── */}
      <AnimatePresence>
        {anySheetOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => { setRoomsSheetOpen(false); setSettingsOpen(false); }}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile Rooms Bottom Sheet ── */}
      <AnimatePresence>
        {roomsSheetOpen && (
          <motion.div
            key="rooms-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border shadow-2xl lg:hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-4 pb-2 flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Chat Rooms</h3>
              <button onClick={() => setRoomsSheetOpen(false)} className="p-1.5 text-muted-foreground hover:text-white rounded-lg">
                <X size={18} />
              </button>
            </div>
            {/* Room list */}
            <div className="px-3 pb-2 space-y-1 max-h-64 overflow-y-auto">
              {ROOMS.map(room => (
                <button
                  key={room}
                  onClick={() => handleRoomSelect(room)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium transition-all',
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
            </div>
            {/* Match button */}
            <div className="px-4 pt-2 pb-6">
              <button
                onClick={() => { startMatch(); setRoomsSheetOpen(false); }}
                className="w-full relative group overflow-hidden rounded-xl p-[1px]"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-80" />
                <div className="relative flex items-center justify-center gap-2 bg-card py-3 px-4 rounded-[11px]">
                  <Zap className="w-4 h-4 text-accent" fill="currentColor" />
                  <span className="font-bold text-white text-sm">Start Random Match</span>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile Settings Bottom Sheet ── */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            key="settings-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border shadow-2xl lg:hidden"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="px-4 pb-2 flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Settings</h3>
              <button onClick={() => setSettingsOpen(false)} className="p-1.5 text-muted-foreground hover:text-white rounded-lg">
                <X size={18} />
              </button>
            </div>
            {/* Profile card */}
            <div className="px-4 py-3 mx-4 mb-3 bg-secondary/40 rounded-2xl flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-2xl border border-white/10 flex-shrink-0">
                {user.avatar}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white">{user.username}</p>
                <p className="text-xs text-green-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  Online
                </p>
              </div>
            </div>
            {/* Online users section */}
            <div className="px-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Online now</span>
                <span className="ml-auto text-xs font-bold text-green-400">{totalOnlineCount}</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-2">
                {allOnlineUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No one online yet</p>
                ) : (
                  allOnlineUsers.slice(0, 10).map((u, i) => (
                    <div key={`${u.username}-${i}`} className="flex items-center gap-2">
                      <div className="relative flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm border border-white/5">
                          {u.avatar}
                        </div>
                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 border border-card rounded-full" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white/90 truncate">{u.username}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{u.room || 'Online'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            {/* Logout */}
            <div className="px-4 pb-8">
              <button
                onClick={() => { setSettingsOpen(false); handleLogout(); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors font-semibold text-sm"
              >
                <LogOut size={16} />
                Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Desktop Left Sidebar ── */}
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
      </aside>

      {/* ── Main Column — must constrain height for scroll to work ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">

        {/* ── Chat Main ── */}
        <main className={cn(
          'flex-1 flex flex-col min-h-0 overflow-hidden bg-grid-pattern relative',
          matchState === 'matched' ? '' : '',
        )}>
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
                {/* Settings hamburger — mobile only */}
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="p-2 text-muted-foreground hover:text-white transition-colors rounded-lg hover:bg-white/5 lg:hidden flex-shrink-0"
                >
                  <Menu size={20} />
                </button>
                <div className="p-1.5 lg:p-2 bg-secondary rounded-lg flex-shrink-0">
                  {activeRoom === 'Global' ? <Globe size={18} className="text-primary" /> : <Hash size={18} className="text-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-base lg:text-lg leading-tight text-white truncate">{activeRoom}</h2>
                  <span className="text-xs text-muted-foreground">{currentOnlineUsers.length} online</span>
                </div>
                {/* Online badge — mobile shortcut */}
                <div className="flex items-center gap-1.5 lg:hidden flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs text-green-400 font-semibold">{totalOnlineCount}</span>
                </div>
              </div>
            )}
          </header>

          {/* Messages — this is the scrollable area; flex-1 + min-h-0 = proper scroll */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto p-3 lg:p-6 space-y-4 lg:space-y-6 scroll-smooth"
          >
            {currentMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                <Gamepad2 className="w-12 h-12 lg:w-16 lg:h-16 mb-3" />
                <p className="text-base lg:text-lg font-medium">No messages yet.</p>
                <p className="text-sm">Be the first to say hello!</p>
              </div>
            ) : (
              currentMessages.map(msg => <ChatBubble key={msg.id} message={msg} />)
            )}
          </div>

          {/* Input bar */}
          <div className="flex-shrink-0 p-2 lg:p-4 bg-card/80 backdrop-blur-md border-t border-border">
            <form onSubmit={handleSendText} className="flex items-center gap-2 lg:gap-3 max-w-5xl mx-auto">
              <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-1 py-1 flex items-center gap-1 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder={isRecording ? '' : 'Message...'}
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

        {/* ── Mobile Bottom "Rooms" Bar ── */}
        {matchState !== 'matched' && (
          <div className="lg:hidden flex-shrink-0 border-t border-border bg-card/95 backdrop-blur-md">
            <button
              onClick={() => setRoomsSheetOpen(true)}
              className="w-full flex items-center justify-between px-5 py-3"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                {activeRoom === 'Global' ? <Globe size={16} className="text-primary" /> : <Hash size={16} className="text-primary" />}
                <span>{activeRoom}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-medium">Rooms</span>
                <ChevronUp size={16} className="text-muted-foreground" />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ── Desktop Right Sidebar ── */}
      {matchState !== 'matched' && (
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
                <div key={`${u.username}-${i}`} className="flex items-center gap-3 group cursor-default">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-base border border-white/5 group-hover:border-primary/50 transition-colors">
                      {u.avatar}
                    </div>
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-white/90 truncate">{u.username}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{u.room || 'Online'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

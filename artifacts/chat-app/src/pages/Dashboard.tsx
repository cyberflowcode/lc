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
  Users, Zap, ChevronLeft, Globe, Gamepad2, Menu, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const ROOMS = ['Global', 'Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5'];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const {
    token, user, logout, activeRoom, setActiveRoom,
    matchState, matchPartner, matchMessages,
    roomUsers, allOnlineUsers, totalOnlineCount,
  } = useStore();
  const { toast } = useToast();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'online'>('chat');

  useEffect(() => {
    if (!token) setLocation('/login');
  }, [token, setLocation]);

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, isRecording]);

  useEffect(() => {
    const handleExit = () => exitMatch();
    window.addEventListener('exit-match-request', handleExit);
    return () => window.removeEventListener('exit-match-request', handleExit);
  }, [exitMatch]);

  // Close sidebar on room change (mobile)
  const handleRoomSelect = (room: string) => {
    setActiveRoom(room);
    setSidebarOpen(false);
    setMobileTab('chat');
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

  return (
    <div className="h-[100dvh] w-full flex bg-background overflow-hidden text-foreground">
      <MatchOverlay />

      {/* ── Mobile Sidebar Backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Left Sidebar ── */}
      <aside className={cn(
        // Desktop: always visible, static
        'lg:static lg:translate-x-0 lg:w-72 lg:flex-shrink-0 lg:flex',
        // Mobile: fixed drawer sliding from left
        'fixed inset-y-0 left-0 z-40 w-72 flex flex-col transition-transform duration-300',
        'bg-card border-r border-border',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        // Slide out during match on desktop
        matchState === 'matched' ? 'lg:-ml-72 lg:opacity-0 lg:pointer-events-none' : '',
      )}>
        {/* Profile Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-black/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-xl shadow-inner border border-white/5">
              {user.avatar}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm leading-tight">{user.username}</span>
              <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Online
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleLogout} className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-white/5">
              <LogOut size={18} />
            </button>
            <button onClick={() => setSidebarOpen(false)} className="p-2 text-muted-foreground hover:text-white transition-colors rounded-lg hover:bg-white/5 lg:hidden">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Room List */}
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

        {/* Match Button */}
        <div className="p-4 border-t border-border bg-black/20 flex-shrink-0">
          <button
            onClick={() => { startMatch(); setSidebarOpen(false); }}
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

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile online panel (shown when mobileTab === 'online') */}
        {mobileTab === 'online' && (
          <div className="flex-1 flex flex-col overflow-hidden lg:hidden">
            <div className="p-4 border-b border-border bg-card/80 flex-shrink-0">
              <h3 className="font-bold flex items-center gap-2 text-white">
                <Users size={18} className="text-primary" />
                Online Users
                <span className="ml-auto bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full border border-green-500/30">
                  {totalOnlineCount}
                </span>
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {allOnlineUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center mt-8">No one online yet</p>
              ) : (
                allOnlineUsers.map((u, i) => (
                  <div key={`${u.username}-${i}`} className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-lg border border-white/5">
                        {u.avatar}
                      </div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-card rounded-full" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-white/90 truncate">{u.username}</span>
                      <span className="text-xs text-muted-foreground truncate">{u.room || 'Online'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Main Chat */}
        <main className={cn(
          'flex-1 flex flex-col min-w-0 bg-grid-pattern relative',
          mobileTab === 'online' ? 'hidden lg:flex' : 'flex',
        )}>
          {/* Chat Header */}
          <header className="h-14 lg:h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center px-3 lg:px-6 sticky top-0 z-10 shadow-sm flex-shrink-0">
            {matchState === 'matched' ? (
              <div className="flex items-center gap-2 lg:gap-4 w-full">
                <button onClick={() => exitMatch()} className="p-2 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white transition-colors flex-shrink-0">
                  <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-2 lg:gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg lg:text-xl border border-primary/50 flex-shrink-0">
                    {matchPartner?.avatar}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-base lg:text-lg leading-tight text-white truncate">{matchPartner?.username}</h2>
                    <span className="text-xs text-primary font-medium">Private Match</span>
                  </div>
                </div>
                <button onClick={() => exitMatch()} className="px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white rounded-lg text-xs lg:text-sm font-semibold transition-colors flex-shrink-0">
                  End
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 lg:gap-3 w-full">
                {/* Hamburger — mobile only */}
                <button
                  onClick={() => setSidebarOpen(true)}
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
                {/* Avatar on mobile header */}
                <div className="flex items-center gap-2 lg:hidden flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-base border border-white/10">
                    {user.avatar}
                  </div>
                </div>
              </div>
            )}
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 lg:p-6 space-y-4 lg:space-y-6 scroll-smooth">
            {currentMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                <Gamepad2 className="w-12 h-12 lg:w-16 lg:h-16 mb-3" />
                <p className="text-base lg:text-lg font-medium">No messages yet.</p>
                <p className="text-sm">Be the first to say hello!</p>
              </div>
            ) : (
              currentMessages.map(msg => (
                <ChatBubble key={msg.id} message={msg} />
              ))
            )}
          </div>

          {/* Input */}
          <div className="p-2 lg:p-4 bg-card/80 backdrop-blur-md border-t border-border flex-shrink-0">
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

              <div className="flex gap-1.5 lg:gap-2">
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={isUploading}
                  className={cn(
                    'w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center transition-all flex-shrink-0',
                    isRecording
                      ? 'bg-destructive text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse'
                      : 'bg-secondary text-white hover:bg-secondary/80',
                    isUploading && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {isUploading
                    ? <Loader2 size={18} className="animate-spin" />
                    : isRecording
                      ? <Square size={16} fill="currentColor" />
                      : <Mic size={18} />}
                </button>

                <button
                  type="submit"
                  disabled={(!inputText.trim() && !isRecording) || isUploading}
                  className="h-10 lg:h-12 px-4 lg:px-6 bg-primary text-white rounded-xl font-semibold flex items-center gap-1.5 hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-[0.97] flex-shrink-0"
                >
                  <span className="hidden sm:inline text-sm lg:text-base">Send</span>
                  <Send size={16} />
                </button>
              </div>
            </form>
          </div>
        </main>

        {/* ── Mobile Bottom Nav ── */}
        {matchState !== 'matched' && (
          <nav className="lg:hidden flex-shrink-0 flex border-t border-border bg-card/95 backdrop-blur-md">
            <button
              onClick={() => { setMobileTab('chat'); setSidebarOpen(true); }}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors',
                'text-muted-foreground hover:text-white',
              )}
            >
              <Hash size={20} />
              <span>Rooms</span>
            </button>

            <button
              onClick={() => { setMobileTab('chat'); }}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors',
                mobileTab === 'chat' ? 'text-primary' : 'text-muted-foreground hover:text-white',
              )}
            >
              <Gamepad2 size={20} />
              <span>Chat</span>
            </button>

            <button
              onClick={startMatch}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium text-accent hover:text-yellow-300 transition-colors"
            >
              <Zap size={20} fill="currentColor" />
              <span>Match</span>
            </button>

            <button
              onClick={() => setMobileTab('online')}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors relative',
                mobileTab === 'online' ? 'text-primary' : 'text-muted-foreground hover:text-white',
              )}
            >
              <Users size={20} />
              <span>Online</span>
              {totalOnlineCount > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-18px)] min-w-[16px] h-4 bg-green-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {totalOnlineCount}
                </span>
              )}
            </button>
          </nav>
        )}
      </div>

      {/* ── Right Sidebar — Desktop only ── */}
      {matchState !== 'matched' && (
        <aside className="w-64 bg-card border-l border-border hidden lg:flex flex-col flex-shrink-0">
          <div className="p-5 border-b border-border">
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

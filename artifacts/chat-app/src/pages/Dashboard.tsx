import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useStore } from '@/store';
import { useGetMe, useGetRoomMessages, type Message } from '@workspace/api-client-react';
import { useChat } from '@/hooks/use-chat';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { ChatBubble } from '@/components/ChatBubble';
import { MatchOverlay } from '@/components/MatchOverlay';
import { 
  LogOut, Hash, Send, Mic, Square, Loader2, 
  Users, Zap, ChevronLeft, Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const ROOMS = ['Global', 'Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5'];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { token, user, logout, activeRoom, setActiveRoom, matchState, matchPartner, matchMessages, roomUsers } = useStore();
  const { toast } = useToast();
  
  // Guard
  useEffect(() => {
    if (!token) setLocation('/login');
  }, [token, setLocation]);

  // Fetch me to ensure token is valid
  useGetMe({
    request: { headers: { Authorization: `Bearer ${token}` } },
    query: {
      enabled: !!token,
      retry: false,
      // Handle unauthorized
    }
  });

  const { sendMessage, startMatch, exitMatch } = useChat();
  const { isRecording, duration, startRecording, stopRecording } = useAudioRecorder();

  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch public room messages
  const { data: publicMessages = [] } = useGetRoomMessages(activeRoom, { limit: 50 }, {
    request: { headers: { Authorization: `Bearer ${token}` } },
    query: { enabled: !!token && matchState !== 'matched' }
  });

  const currentMessages = matchState === 'matched' ? matchMessages : publicMessages;
  const currentOnlineUsers = roomUsers[activeRoom] || [];

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, isRecording]);

  // Handle custom exit event from MatchOverlay
  useEffect(() => {
    const handleExit = () => exitMatch();
    window.addEventListener('exit-match-request', handleExit);
    return () => window.removeEventListener('exit-match-request', handleExit);
  }, [exitMatch]);


  const handleSendText = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText.trim(), 'text');
    setInputText('');
  };

  const handleMicClick = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob) {
        uploadAndSendAudio(blob);
      }
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
        body: fd
      });
      
      if (!res.ok) throw new Error('Upload failed');
      const { audioUrl } = await res.json();
      
      sendMessage('Audio message', 'audio', audioUrl);
    } catch (err) {
      toast({ variant: 'destructive', description: "Failed to send voice message" });
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
    <div className="h-screen w-full flex bg-background overflow-hidden text-foreground">
      <MatchOverlay />

      {/* Left Sidebar - Navigation & Rooms */}
      <aside className={cn(
        "w-72 flex-col bg-card border-r border-border transition-all duration-300 z-20 flex",
        matchState === 'matched' ? "-ml-72" : "" // Slide out when in private match
      )}>
        {/* User Profile Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-black/10">
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
          <button onClick={handleLogout} className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-white/5">
            <LogOut size={18} />
          </button>
        </div>

        {/* Room List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 ml-1">Chat Rooms</h3>
          {ROOMS.map(room => (
            <button
              key={room}
              onClick={() => setActiveRoom(room)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                activeRoom === room 
                  ? "bg-primary/15 text-primary shadow-[inset_4px_0_0_0_hsl(var(--primary))]" 
                  : "text-muted-foreground hover:bg-white/5 hover:text-white"
              )}
            >
              {room === 'Global' ? <Globe size={18} /> : <Hash size={18} />}
              {room}
              {activeRoom === room && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        {/* Random Match Button Area */}
        <div className="p-4 border-t border-border bg-black/20">
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

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-grid-pattern relative">
        
        {/* Chat Header */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center px-6 sticky top-0 z-10 shadow-sm">
          {matchState === 'matched' ? (
            <div className="flex items-center gap-4 w-full">
              <button onClick={() => exitMatch()} className="p-2 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-xl border border-primary/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                  {matchPartner?.avatar}
                </div>
                <div>
                  <h2 className="font-bold text-lg leading-tight text-white">{matchPartner?.username}</h2>
                  <span className="text-xs text-primary font-medium">Private Match</span>
                </div>
              </div>
              <button onClick={() => exitMatch()} className="px-4 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white rounded-lg text-sm font-semibold transition-colors">
                End Match
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <div className="p-2 bg-secondary rounded-lg">
                {activeRoom === 'Global' ? <Globe size={20} className="text-primary" /> : <Hash size={20} className="text-primary" />}
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight text-white">{activeRoom}</h2>
                <span className="text-xs text-muted-foreground">{currentOnlineUsers.length} users online</span>
              </div>
            </div>
          )}
        </header>

        {/* Messages List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          {currentMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <Gamepad2 className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium">No messages yet.</p>
              <p className="text-sm">Be the first to say hello!</p>
            </div>
          ) : (
            currentMessages.map(msg => (
              <ChatBubble key={msg.id} message={msg} />
            ))
          )}
        </div>

        {/* Chat Input Area */}
        <div className="p-4 bg-card/80 backdrop-blur-md border-t border-border">
          <form onSubmit={handleSendText} className="flex items-end gap-3 max-w-5xl mx-auto">
            
            {/* Input Container */}
            <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl p-2 flex items-center gap-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={isRecording ? "" : "Message the room..."}
                disabled={isRecording || isUploading}
                className="flex-1 bg-transparent px-3 py-2 text-white placeholder:text-white/30 focus:outline-none disabled:opacity-50"
              />
              
              {/* Recording Indicator inside input area */}
              {isRecording && (
                <div className="flex-1 flex items-center gap-3 px-3">
                  <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                  <span className="text-destructive font-mono font-medium">
                    {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                  </span>
                  <span className="text-sm text-muted-foreground animate-pulse ml-2">Recording audio...</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 h-[52px]">
              {/* Mic Button */}
              <button
                type="button"
                onClick={handleMicClick}
                disabled={isUploading}
                className={cn(
                  "h-full aspect-square rounded-2xl flex items-center justify-center transition-all",
                  isRecording 
                    ? "bg-destructive text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse" 
                    : "bg-secondary text-white hover:bg-secondary/80",
                  isUploading && "opacity-50 cursor-not-allowed"
                )}
              >
                {isUploading ? <Loader2 size={20} className="animate-spin" /> : isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={20} />}
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={(!inputText.trim() && !isRecording) || isUploading}
                className="h-full px-6 bg-primary text-white rounded-2xl font-semibold flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary transition-all active:scale-[0.97]"
              >
                <span className="hidden sm:inline">Send</span>
                <Send size={18} />
              </button>
            </div>

          </form>
        </div>
      </main>

      {/* Right Sidebar - Online Users (Hidden in private match) */}
      {matchState !== 'matched' && (
        <aside className="w-64 bg-card border-l border-border hidden lg:flex flex-col">
          <div className="p-5 border-b border-border">
            <h3 className="font-bold flex items-center gap-2 text-white">
              <Users size={18} className="text-primary" /> 
              Online - {currentOnlineUsers.length}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {currentOnlineUsers.map((u, i) => (
              <div key={i} className="flex items-center gap-3 group cursor-default">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-lg border border-white/5 group-hover:border-primary/50 transition-colors">
                    {u.avatar}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-card rounded-full" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white/90">{u.username}</span>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Online</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

    </div>
  );
}

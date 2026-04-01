import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { useGetFriends, useGetFriendRequests, useSendFriendRequest, useAcceptFriendRequest, useRemoveFriend } from '@workspace/api-client-react';
import { UserPlus, Check, X, MessageCircle, Users, Clock, Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AnimatePresence, motion } from 'framer-motion';

interface FriendsPanelProps {
  onDmUser: (username: string) => void;
}

interface UserResult {
  username: string;
  avatar: string;
}

export function FriendsPanel({ onDmUser }: FriendsPanelProps) {
  const { token, user, allOnlineUsers } = useStore();
  const onlineUsernames = new Set(allOnlineUsers.map(u => u.username));
  const { toast } = useToast();
  const [addUsername, setAddUsername] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: friends = [], refetch: refetchFriends } = useGetFriends({
    request: { headers: { Authorization: `Bearer ${token}` } },
    query: { enabled: !!token },
  });

  const { data: requests = [], refetch: refetchRequests } = useGetFriendRequests({
    request: { headers: { Authorization: `Bearer ${token}` } },
    query: { enabled: !!token },
  });

  const sendRequest = useSendFriendRequest({
    request: { headers: { Authorization: `Bearer ${token}` } },
    mutation: {
      onSuccess: () => {
        toast({ description: `Friend request sent to ${addUsername}` });
        setAddUsername('');
        setSearchResults([]);
        setShowDropdown(false);
        refetchFriends();
      },
      onError: (e: any) => {
        toast({ variant: 'destructive', description: e?.response?.data?.error || 'Failed to send request' });
      },
    },
  });

  const acceptRequest = useAcceptFriendRequest({
    request: { headers: { Authorization: `Bearer ${token}` } },
    mutation: {
      onSuccess: () => {
        refetchFriends();
        refetchRequests();
        toast({ description: 'Friend request accepted!' });
      },
    },
  });

  const removeOrDecline = useRemoveFriend({
    request: { headers: { Authorization: `Bearer ${token}` } },
    mutation: {
      onSuccess: () => {
        refetchFriends();
        refetchRequests();
      },
    },
  });

  // Real-time search with debounce
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!addUsername.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(addUsername.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowDropdown(true);
        }
      } catch {}
      setSearchLoading(false);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [addUsername, token]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleSendRequest = (username?: string) => {
    const target = username || addUsername.trim();
    if (!target) return;
    setAddUsername(target);
    sendRequest.mutate({ username: target });
    setShowDropdown(false);
  };

  const getFriendName = (friendship: any) =>
    friendship.requester === user?.username ? friendship.recipient : friendship.requester;

  const friendUsernames = new Set(friends.map((f: any) => getFriendName(f)));
  const pendingUsernames = new Set(requests.map((r: any) => r.requester));

  return (
    <div className="flex flex-col h-full">
      {/* Add friend search */}
      <div className="p-4 border-b border-border">
        <div ref={searchRef} className="relative">
          <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-3 py-2 focus-within:border-primary/50 transition-colors">
            {searchLoading
              ? <Loader2 size={14} className="text-muted-foreground flex-shrink-0 animate-spin" />
              : <Search size={14} className="text-muted-foreground flex-shrink-0" />
            }
            <input
              type="text"
              value={addUsername}
              onChange={e => setAddUsername(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSendRequest();
                if (e.key === 'Escape') setShowDropdown(false);
              }}
              placeholder="Search users to add..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none min-w-0"
            />
            {addUsername && (
              <button
                onClick={() => handleSendRequest()}
                disabled={!addUsername.trim() || sendRequest.isPending}
                className="flex-shrink-0 p-1 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary disabled:opacity-40 transition-colors"
                title="Send friend request"
              >
                <UserPlus size={14} />
              </button>
            )}
          </div>

          {/* Real-time dropdown */}
          <AnimatePresence>
            {showDropdown && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
              >
                {searchResults.map((u, i) => {
                  const isFriend = friendUsernames.has(u.username);
                  const isPending = pendingUsernames.has(u.username);
                  return (
                    <div
                      key={u.username}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 transition-colors",
                        i !== searchResults.length - 1 && "border-b border-border/50",
                        !isFriend && !isPending ? "hover:bg-white/5 cursor-pointer" : "opacity-60"
                      )}
                      onClick={() => !isFriend && !isPending && handleSendRequest(u.username)}
                    >
                      <div className="w-8 h-8 rounded-full bg-secondary border border-white/5 flex items-center justify-center text-base flex-shrink-0">
                        {u.avatar}
                      </div>
                      <span className="flex-1 text-sm font-medium text-white truncate">{u.username}</span>
                      {isFriend && (
                        <span className="text-[10px] text-green-400 font-semibold flex-shrink-0">Friends</span>
                      )}
                      {isPending && !isFriend && (
                        <span className="text-[10px] text-yellow-400 font-semibold flex-shrink-0">Pending</span>
                      )}
                      {!isFriend && !isPending && (
                        <UserPlus size={13} className="text-primary flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}

            {showDropdown && searchResults.length === 0 && !searchLoading && addUsername.trim() && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-border rounded-xl shadow-2xl px-4 py-4 text-center"
              >
                <p className="text-sm text-muted-foreground">No users found for "<span className="text-white">{addUsername}</span>"</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('friends')}
          className={cn(
            "flex-1 py-2.5 text-xs font-semibold transition-colors",
            activeTab === 'friends' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"
          )}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Users size={13} />
            Friends
            {friends.length > 0 && (
              <span className="bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{friends.length}</span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={cn(
            "flex-1 py-2.5 text-xs font-semibold transition-colors",
            activeTab === 'requests' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-white"
          )}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Clock size={13} />
            Requests
            {requests.length > 0 && (
              <span className="bg-destructive/20 text-destructive text-[10px] font-bold px-1.5 py-0.5 rounded-full">{requests.length}</span>
            )}
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTab === 'friends' && (
          friends.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Users size={32} className="mx-auto mb-2 opacity-30" />
              <p>No friends yet</p>
              <p className="text-xs mt-1 opacity-60">Search someone above!</p>
            </div>
          ) : (
            friends.map((f: any) => {
              const name = getFriendName(f);
              const isOnline = onlineUsernames.has(name);
              return (
                <div key={f.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 group">
                  <div className="relative w-8 h-8 rounded-full bg-secondary border border-white/5 flex items-center justify-center text-base flex-shrink-0">
                    {name[0].toUpperCase()}
                    <span className={cn(
                      'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card',
                      isOnline ? 'bg-green-500' : 'bg-gray-500'
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-white/90 truncate block">{name}</span>
                    <span className={cn('text-[10px]', isOnline ? 'text-green-400' : 'text-muted-foreground')}>{isOnline ? 'Online' : 'Offline'}</span>
                  </div>
                  <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onDmUser(name)}
                      className="p-1.5 rounded-lg hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                      title="Message"
                    >
                      <MessageCircle size={14} />
                    </button>
                    <button
                      onClick={() => removeOrDecline.mutate({ requestId: f.id })}
                      className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )
        )}

        {activeTab === 'requests' && (
          requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Clock size={32} className="mx-auto mb-2 opacity-30" />
              <p>No pending requests</p>
            </div>
          ) : (
            requests.map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 p-2 rounded-xl bg-white/3 border border-white/5">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-base flex-shrink-0">
                  👤
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90 truncate">{r.requester}</p>
                  <p className="text-[10px] text-muted-foreground">wants to be friends</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => acceptRequest.mutate({ requestId: r.id })}
                    className="p-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors"
                    title="Accept"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => removeOrDecline.mutate({ requestId: r.id })}
                    className="p-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive transition-colors"
                    title="Decline"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useStore } from '@/store';
import { useGetFriends, useGetFriendRequests, useSendFriendRequest, useAcceptFriendRequest, useRemoveFriend } from '@workspace/api-client-react';
import { UserPlus, Check, X, MessageCircle, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface FriendsPanelProps {
  onDmUser: (username: string) => void;
}

export function FriendsPanel({ onDmUser }: FriendsPanelProps) {
  const { token, user } = useStore();
  const { toast } = useToast();
  const [addUsername, setAddUsername] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

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

  const handleSendRequest = () => {
    if (!addUsername.trim()) return;
    sendRequest.mutate({ username: addUsername.trim() });
  };

  const getFriendName = (friendship: any) =>
    friendship.requester === user?.username ? friendship.recipient : friendship.requester;

  return (
    <div className="flex flex-col h-full">
      {/* Add friend input */}
      <div className="p-4 border-b border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={addUsername}
            onChange={e => setAddUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendRequest()}
            placeholder="Add friend..."
            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
          />
          <button
            onClick={handleSendRequest}
            disabled={!addUsername.trim() || sendRequest.isPending}
            className="p-2 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <UserPlus size={16} />
          </button>
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
              <p className="text-xs mt-1 opacity-60">Add someone above!</p>
            </div>
          ) : (
            friends.map((f: any) => {
              const name = getFriendName(f);
              return (
                <div key={f.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 group">
                  <div className="w-8 h-8 rounded-full bg-secondary border border-white/5 flex items-center justify-center text-base flex-shrink-0">
                    💬
                  </div>
                  <span className="flex-1 text-sm font-medium text-white/90 truncate">{name}</span>
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

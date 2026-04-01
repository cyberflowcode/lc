import { useState } from 'react';
import { X, Lock, Globe, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { useToast } from '@/hooks/use-toast';

interface CreateRoomModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (room: any) => void;
}

export function CreateRoomModal({ open, onClose, onCreated }: CreateRoomModalProps) {
  const { token } = useStore();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          isPrivate,
          password: isPrivate && password.trim() ? password.trim() : undefined,
        }),
      });
      const room = await res.json();
      if (!res.ok) throw new Error(room.error || 'Failed to create room');
      onCreated(room);
      setName('');
      setDescription('');
      setIsPrivate(false);
      setPassword('');
      onClose();
      toast({ description: `Room "${room.name}" created!` });
    } catch {
      toast({ variant: 'destructive', description: 'Failed to create room' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl pointer-events-auto">
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
                <h2 className="font-bold text-white text-lg">Create a Room</h2>
                <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="px-5 py-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Room Name *</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Gaming Zone"
                    maxLength={40}
                    required
                    autoFocus
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Description</label>
                  <input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="What's this room about?"
                    maxLength={100}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Privacy</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setIsPrivate(false); setPassword(''); }}
                      className={cn(
                        'flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm font-medium',
                        !isPrivate ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-white/20 hover:text-white'
                      )}
                    >
                      <Globe size={16} /> Public
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPrivate(true)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm font-medium',
                        isPrivate ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-white/20 hover:text-white'
                      )}
                    >
                      <Lock size={16} /> Private
                    </button>
                  </div>
                </div>

                {/* Password field — only shown for private rooms */}
                <AnimatePresence>
                  {isPrivate && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Room Password <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="Set a password so anyone can join instantly"
                          maxLength={50}
                          className="w-full bg-background border border-border rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {password.trim()
                          ? 'Anyone with the password can join instantly, even when you\'re offline.'
                          : 'Without a password, users must request to join and you approve them.'}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !name.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Creating…' : 'Create Room'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

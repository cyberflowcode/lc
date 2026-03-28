import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useRegister } from '@workspace/api-client-react';
import { useStore } from '@/store';
import { Loader2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AvatarPicker, EMOJI_AVATARS } from '@/components/AvatarPicker';

export default function Register() {
  const [, setLocation] = useLocation();
  const { setAuth } = useStore();
  const { toast } = useToast();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(EMOJI_AVATARS[0]);

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        setAuth(data.token, data.user);
        setLocation('/');
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Registration Failed",
          description: err?.error || "Username might be taken",
        });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) {
      toast({ variant: "destructive", description: "Username must be at least 3 characters" });
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", description: "Password must be at least 6 characters" });
      return;
    }
    registerMutation.mutate({ data: { username, password, avatar } });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden py-12">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Neon gaming background" 
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
      </div>

      <div className="relative z-10 w-full max-w-md p-8 glass-panel rounded-3xl mx-4">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center mb-4 shadow-lg shadow-accent/30 -rotate-3">
            <UserPlus className="w-8 h-8 text-white rotate-3" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">Join LitChat</h1>
          <p className="text-muted-foreground mt-2">Create your gaming persona.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-white/80 pl-1 text-center block">Choose Avatar</label>
            <AvatarPicker selected={avatar} onSelect={setAvatar} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-white/80 pl-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="CoolGamer99"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-white/80 pl-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="Min 6 characters"
            />
          </div>

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="neon-border w-full py-3.5 mt-2 bg-primary text-white font-semibold rounded-xl shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center"
          >
            {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Already a member? <Link href="/login" className="text-primary font-medium hover:underline hover:text-accent transition-colors">Login here</Link>
        </p>
      </div>
    </div>
  );
}

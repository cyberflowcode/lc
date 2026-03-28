import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useLogin } from '@workspace/api-client-react';
import { useStore } from '@/store';
import { Loader2, Gamepad2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const [, setLocation] = useLocation();
  const { setAuth } = useStore();
  const { toast } = useToast();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        setAuth(data.token, data.user);
        setLocation('/');
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: err?.error || "Invalid username or password",
        });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { username, password } });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden">
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
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center mb-4 shadow-lg shadow-primary/30 rotate-3">
            <Gamepad2 className="w-8 h-8 text-white -rotate-3" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight">LitChat</h1>
          <p className="text-muted-foreground mt-2">Welcome back, player.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-sm font-medium text-white/80 pl-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="Enter your username"
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
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="neon-border w-full py-3.5 mt-4 bg-primary text-white font-semibold rounded-xl shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center"
          >
            {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enter Match'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-8">
          New here? <Link href="/register" className="text-primary font-medium hover:underline hover:text-accent transition-colors">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

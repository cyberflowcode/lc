import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store';
import { X, User as UserIcon } from 'lucide-react';

export function MatchOverlay() {
  const { matchState, matchPartner, clearMatch } = useStore();
  const { exitMatch } = useChatMatchHooks();

  const handleCancel = () => {
    exitMatch();
    clearMatch();
  };

  if (matchState === 'idle') return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xl"
      >
        <div className="relative w-full max-w-md mx-auto flex flex-col items-center">
          
          {matchState === 'searching' && (
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32 flex items-center justify-center mb-8">
                {/* Radar pulse effect */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      scale: [1, 2.5], 
                      opacity: [0.8, 0] 
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 2, 
                      delay: i * 0.6,
                      ease: "easeOut"
                    }}
                    className="absolute inset-0 rounded-full border-2 border-primary"
                  />
                ))}
                <div className="w-16 h-16 bg-primary rounded-full shadow-[0_0_30px_rgba(168,85,247,0.8)] z-10 flex items-center justify-center">
                  <UserIcon className="text-white w-8 h-8 animate-pulse" />
                </div>
              </div>
              <h2 className="text-2xl font-display font-bold text-white mb-2">Searching for Match</h2>
              <p className="text-muted-foreground text-center mb-8 max-w-xs">
                Looking for someone to chat with in the global network...
              </p>
              
              <button 
                onClick={handleCancel}
                className="px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 text-white/70 transition-colors"
              >
                Cancel Search
              </button>
            </div>
          )}

          {matchState === 'matched' && matchPartner && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center glass-panel p-8 rounded-3xl w-full"
            >
              <div className="text-6xl mb-4 p-4 rounded-full bg-primary/20 border border-primary/30 shadow-[0_0_40px_rgba(168,85,247,0.3)]">
                {matchPartner.avatar}
              </div>
              <h2 className="text-3xl font-display font-bold text-white mb-1">Match Found!</h2>
              <p className="text-xl text-primary font-medium mb-8">You are chatting with {matchPartner.username}</p>
              
              <p className="text-sm text-muted-foreground mb-6">Redirecting to private chat...</p>
            </motion.div>
          )}

        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Small hook helper to avoid circular deps with useChat
function useChatMatchHooks() {
  const exitMatch = () => {
    // This is a slightly hacky way to call socket outside the main hook, 
    // but works well enough for this simple structure
    const event = new CustomEvent('exit-match-request');
    window.dispatchEvent(event);
  };
  return { exitMatch };
}

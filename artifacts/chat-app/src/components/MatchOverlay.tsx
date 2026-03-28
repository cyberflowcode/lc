import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store';
import { User as UserIcon, Zap } from 'lucide-react';

export function MatchOverlay() {
  const { matchState, matchPartner } = useStore();
  const { exitMatch } = useChatMatchHooks();

  // After a match is found, show a quick celebration then dismiss the overlay
  const [showFoundBanner, setShowFoundBanner] = useState(false);

  useEffect(() => {
    if (matchState === 'matched') {
      setShowFoundBanner(true);
      const t = setTimeout(() => setShowFoundBanner(false), 2200);
      return () => clearTimeout(t);
    } else {
      setShowFoundBanner(false);
    }
  }, [matchState]);

  const handleCancel = () => {
    exitMatch();
  };

  // Only show overlay when searching OR during the brief "match found" banner
  const visible = matchState === 'searching' || showFoundBanner;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xl"
        >
          <div className="relative w-full max-w-md mx-auto flex flex-col items-center">

            {matchState === 'searching' && (
              <motion.div
                key="searching"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center"
              >
                <div className="relative w-32 h-32 flex items-center justify-center mb-8">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
                      transition={{ repeat: Infinity, duration: 2, delay: i * 0.6, ease: 'easeOut' }}
                      className="absolute inset-0 rounded-full border-2 border-primary"
                    />
                  ))}
                  <div className="w-16 h-16 bg-primary rounded-full shadow-[0_0_30px_rgba(168,85,247,0.8)] z-10 flex items-center justify-center">
                    <UserIcon className="text-white w-8 h-8 animate-pulse" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Searching for Match</h2>
                <p className="text-muted-foreground text-center mb-8 max-w-xs">
                  Looking for someone to chat with in the global network...
                </p>
                <button
                  onClick={handleCancel}
                  className="px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 text-white/70 transition-colors"
                >
                  Cancel Search
                </button>
              </motion.div>
            )}

            {showFoundBanner && matchPartner && (
              <motion.div
                key="found"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.1, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="flex flex-col items-center bg-card/90 border border-primary/30 p-10 rounded-3xl shadow-[0_0_60px_rgba(168,85,247,0.25)] w-full"
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-7xl mb-4"
                >
                  {matchPartner.avatar}
                </motion.div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                  <h2 className="text-3xl font-bold text-white">Match Found!</h2>
                  <Zap className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                </div>
                <p className="text-lg text-primary font-semibold mb-1">
                  {matchPartner.username}
                </p>
                <p className="text-sm text-muted-foreground mt-2">Opening private chat...</p>
                <div className="mt-4 flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1, delay: i * 0.3 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function useChatMatchHooks() {
  const exitMatch = () => {
    const event = new CustomEvent('exit-match-request');
    window.dispatchEvent(event);
  };
  return { exitMatch };
}

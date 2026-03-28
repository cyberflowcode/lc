import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AudioPlayer({ src, className }: { src: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      const setAudioData = () => setDuration(audio.duration);
      const setAudioTime = () => setProgress((audio.currentTime / audio.duration) * 100);
      const onEnd = () => { setIsPlaying(false); setProgress(0); };

      audio.addEventListener('loadeddata', setAudioData);
      audio.addEventListener('timeupdate', setAudioTime);
      audio.addEventListener('ended', onEnd);

      return () => {
        audio.removeEventListener('loadeddata', setAudioData);
        audio.removeEventListener('timeupdate', setAudioTime);
        audio.removeEventListener('ended', onEnd);
      };
    }
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("flex items-center gap-3 bg-black/30 backdrop-blur-sm rounded-full p-2 w-56 border border-white/5 shadow-inner", className)}>
      <button 
        onClick={togglePlay} 
        className="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-tr from-primary to-accent text-white shadow-lg hover:scale-105 transition-transform"
      >
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
      </button>
      
      <div className="flex-1 flex flex-col justify-center gap-1.5">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden w-full cursor-pointer relative">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-75" 
            style={{ width: `${progress}%` }} 
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/50 font-medium">
          <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}

import { cn } from '@/lib/utils';

export const EMOJI_AVATARS = ['🦁', '🐯', '🦊', '🐺', '🐼', '🦝', '🐨', '🦄'];

interface AvatarPickerProps {
  selected: string;
  onSelect: (avatar: string) => void;
}

export function AvatarPicker({ selected, onSelect }: AvatarPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {EMOJI_AVATARS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className={cn(
            "text-4xl p-3 rounded-2xl transition-all duration-300 transform outline-none",
            "hover:scale-110 hover:bg-white/5",
            selected === emoji 
              ? "bg-primary/20 scale-110 shadow-[0_0_20px_rgba(168,85,247,0.4)] border border-primary/50" 
              : "bg-black/20 border border-transparent grayscale-[0.5] hover:grayscale-0"
          )}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

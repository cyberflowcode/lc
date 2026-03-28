import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { AudioPlayer } from './AudioPlayer';
import { cn } from '@/lib/utils';
import type { Message } from '@workspace/api-client-react';
import { useStore } from '@/store';

interface ChatBubbleProps {
  message: Message;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const currentUser = useStore(s => s.user);
  const isMe = currentUser?.username === message.username;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "flex w-full gap-3 max-w-[85%]",
        isMe ? "ml-auto flex-row-reverse" : ""
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary border border-white/5 flex items-center justify-center text-xl shadow-sm">
        {message.avatar}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
        <div className="flex items-baseline gap-2 px-1">
          <span className="text-sm font-semibold text-white/90">{message.username}</span>
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(message.createdAt), 'HH:mm')}
          </span>
        </div>

        <div className={cn(
          "px-4 py-2.5 rounded-2xl shadow-sm relative group",
          isMe 
            ? "bg-primary text-primary-foreground rounded-tr-sm" 
            : "bg-secondary text-secondary-foreground rounded-tl-sm border border-white/5"
        )}>
          {message.messageType === 'audio' && message.audioUrl ? (
            <AudioPlayer src={message.audioUrl} className={isMe ? "bg-black/20" : ""} />
          ) : (
            <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
              {message.content}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

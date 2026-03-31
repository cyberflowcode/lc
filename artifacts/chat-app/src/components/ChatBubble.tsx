import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { AudioPlayer } from './AudioPlayer';
import { cn } from '@/lib/utils';
import { useStore, type MessageWithReactions } from '@/store';
import { Edit2, Trash2, Reply, MoreVertical, Smile } from 'lucide-react';

interface ChatBubbleProps {
  message: MessageWithReactions;
  replySource?: MessageWithReactions | null;
  onReply?: (msg: MessageWithReactions) => void;
  onEdit?: (messageId: number, content: string) => void;
  onDelete?: (messageId: number) => void;
  onReact?: (messageId: number, emoji: string) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

export function ChatBubble({ message, replySource, onReply, onEdit, onDelete, onReact }: ChatBubbleProps) {
  const currentUser = useStore(s => s.user);
  const isMe = currentUser?.username === message.username;
  const [showDots, setShowDots] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const editInputRef = useRef<HTMLInputElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!showActions && !showEmojiPicker && !showDots) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setShowDots(false);
        setShowActions(false);
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [showActions, showEmojiPicker, showDots]);

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowActions(true);
      setShowDots(false);
    }, 450);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  const handleEditSubmit = () => {
    if (!editContent.trim() || !onEdit) return;
    onEdit(message.id, editContent.trim());
    setIsEditing(false);
  };

  const handleReact = (emoji: string) => {
    onReact?.(message.id, emoji);
    setShowEmojiPicker(false);
    setShowActions(false);
    setShowDots(false);
  };

  const handleDotsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(p => !p);
    setShowEmojiPicker(false);
    setShowDots(false);
  };

  const handleMouseEnter = () => {
    if (!showActions) setShowDots(true);
  };

  const handleMouseLeave = () => {
    if (!showActions && !showEmojiPicker) setShowDots(false);
  };

  const closeAll = () => {
    setShowActions(false);
    setShowDots(false);
    setShowEmojiPicker(false);
  };

  if (message.isDeleted) {
    return (
      <div className={cn("flex w-full gap-3 max-w-[85%]", isMe ? "ml-auto flex-row-reverse" : "")}>
        <div className="flex-shrink-0 w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-secondary border border-white/5 flex items-center justify-center text-lg lg:text-xl opacity-40">
          {message.avatar}
        </div>
        <div className={cn("flex flex-col gap-1", isMe ? "items-end" : "items-start")}>
          <div className="flex items-baseline gap-2 px-1">
            <span className="text-sm font-semibold text-white/40">{message.username}</span>
            <span className="text-[11px] text-muted-foreground/40">{format(new Date(message.createdAt), 'HH:mm')}</span>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-secondary/30 border border-white/5 italic text-muted-foreground text-sm">
            Message deleted
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      ref={bubbleRef}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn("flex w-full gap-2 lg:gap-3 max-w-[88%] lg:max-w-[85%] relative", isMe ? "ml-auto flex-row-reverse" : "")}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-secondary border border-white/5 flex items-center justify-center text-lg lg:text-xl shadow-sm self-end mb-1">
        {message.avatar}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-1 min-w-0 flex-1", isMe ? "items-end" : "items-start")}>
        <div className="flex items-baseline gap-2 px-1">
          <span className="text-sm font-semibold text-white/90">{message.username}</span>
          <span className="text-[11px] text-muted-foreground">{format(new Date(message.createdAt), 'HH:mm')}</span>
          {message.editedAt && (
            <span className="text-[10px] text-muted-foreground/60 italic">(edited)</span>
          )}
        </div>

        {/* Reply source preview */}
        {replySource && (
          <div className={cn(
            "px-3 py-1.5 rounded-xl text-xs border-l-2 border-primary/50 bg-white/5 mb-0.5 max-w-[220px] lg:max-w-xs truncate",
            isMe ? "mr-1" : "ml-1"
          )}>
            <span className="text-primary/80 font-semibold mr-1">{replySource.username}:</span>
            <span className="text-white/50">{replySource.isDeleted ? 'Deleted message' : (replySource.content || 'Audio message')}</span>
          </div>
        )}

        {/* Emoji picker — floats ABOVE the bubble */}
        <div className="relative w-full">
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                onClick={e => e.stopPropagation()}
                className={cn(
                  "absolute bottom-full mb-2 z-50 flex gap-1 bg-card border border-border rounded-2xl p-2 shadow-2xl",
                  isMe ? "right-0" : "left-0"
                )}
              >
                {QUICK_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => handleReact(e)}
                    className="text-lg hover:scale-125 transition-transform w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 active:scale-110"
                  >
                    {e}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* The bubble itself */}
          <div className={cn(
            "px-3 lg:px-4 py-2 lg:py-2.5 rounded-2xl shadow-sm",
            isMe
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-secondary text-secondary-foreground rounded-tl-sm border border-white/5"
          )}>
            {isEditing ? (
              <div className="flex items-center gap-2 min-w-[160px]">
                <input
                  ref={editInputRef}
                  autoFocus
                  className="bg-transparent text-[15px] leading-relaxed outline-none flex-1 min-w-0"
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleEditSubmit();
                    if (e.key === 'Escape') setIsEditing(false);
                  }}
                />
                <button
                  onClick={handleEditSubmit}
                  className="text-xs font-semibold opacity-80 hover:opacity-100 underline whitespace-nowrap"
                >Save</button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-xs opacity-60 hover:opacity-100"
                >✕</button>
              </div>
            ) : (
              message.messageType === 'audio' && message.audioUrl ? (
                <AudioPlayer src={message.audioUrl} className={isMe ? "bg-black/20" : ""} />
              ) : (
                <p className="text-[14px] lg:text-[15px] leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>
              )
            )}
          </div>
        </div>

        {/* Reactions display */}
        {Object.keys(message.reactions || {}).length > 0 && (
          <div className={cn("flex flex-wrap gap-1 px-1 mt-0.5", isMe ? "justify-end" : "justify-start")}>
            {Object.entries(message.reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all",
                  users.includes(currentUser?.username || '')
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                )}
              >
                <span>{emoji}</span>
                <span className="font-semibold">{users.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3-dots trigger + horizontal action bar */}
      {!isEditing && (
        <div className={cn(
          "flex-shrink-0 self-center relative",
          isMe ? "order-first" : ""
        )}>
          <AnimatePresence mode="wait">
            {/* 3-dots button (shows on hover, hidden when actions open) */}
            {showDots && !showActions && (
              <motion.button
                key="dots"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.1 }}
                onClick={handleDotsClick}
                className="p-1.5 rounded-lg bg-card/80 border border-border shadow-md text-muted-foreground hover:text-white hover:bg-card transition-colors"
              >
                <MoreVertical size={14} />
              </motion.button>
            )}

            {/* Horizontal action bar */}
            {showActions && (
              <motion.div
                key="actions"
                initial={{ opacity: 0, scale: 0.85, x: isMe ? 8 : -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.15, type: 'spring', damping: 20, stiffness: 300 }}
                className={cn(
                  "absolute z-30 flex flex-row items-center gap-0.5 bg-card border border-border rounded-2xl shadow-2xl p-1",
                  isMe ? "right-full mr-2" : "left-full ml-2",
                  "top-1/2 -translate-y-1/2"
                )}
                onClick={e => e.stopPropagation()}
              >
                {/* React */}
                <button
                  onClick={() => setShowEmojiPicker(p => !p)}
                  title="React"
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-xl transition-colors text-base",
                    showEmojiPicker
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-white hover:bg-white/10"
                  )}
                >
                  <Smile size={15} />
                </button>

                {/* Reply */}
                {onReply && (
                  <button
                    onClick={() => { onReply(message); closeAll(); }}
                    title="Reply"
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Reply size={15} />
                  </button>
                )}

                {/* Edit (own text messages only) */}
                {isMe && message.messageType === 'text' && onEdit && (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setEditContent(message.content || '');
                      closeAll();
                      setTimeout(() => editInputRef.current?.focus(), 50);
                    }}
                    title="Edit"
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Edit2 size={15} />
                  </button>
                )}

                {/* Delete (own messages only) */}
                {isMe && onDelete && (
                  <button
                    onClick={() => { onDelete(message.id); closeAll(); }}
                    title="Delete"
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-500/15 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

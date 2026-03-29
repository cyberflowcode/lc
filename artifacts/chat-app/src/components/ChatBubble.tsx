import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { AudioPlayer } from './AudioPlayer';
import { cn } from '@/lib/utils';
import { useStore, type MessageWithReactions } from '@/store';
import { Edit2, Trash2, Reply, Smile } from 'lucide-react';

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
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const editInputRef = useRef<HTMLInputElement>(null);

  const handleEditSubmit = () => {
    if (!editContent.trim() || !onEdit) return;
    onEdit(message.id, editContent.trim());
    setIsEditing(false);
  };

  const handleReact = (emoji: string) => {
    onReact?.(message.id, emoji);
    setShowEmojiPicker(false);
    setShowActions(false);
  };

  const myReactions = Object.entries(message.reactions || {}).filter(([, users]) => users.includes(currentUser?.username || ''));

  if (message.isDeleted) {
    return (
      <div className={cn("flex w-full gap-3 max-w-[85%]", isMe ? "ml-auto flex-row-reverse" : "")}>
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary border border-white/5 flex items-center justify-center text-xl opacity-40">
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
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn("flex w-full gap-3 max-w-[85%] group relative", isMe ? "ml-auto flex-row-reverse" : "")}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary border border-white/5 flex items-center justify-center text-xl shadow-sm">
        {message.avatar}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-1 min-w-0", isMe ? "items-end" : "items-start")}>
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
            "px-3 py-1.5 rounded-xl text-xs border-l-2 border-primary/50 bg-white/5 mb-0.5 max-w-xs truncate",
            isMe ? "mr-1" : "ml-1"
          )}>
            <span className="text-primary/80 font-semibold mr-1">{replySource.username}:</span>
            <span className="text-white/50">{replySource.isDeleted ? 'Deleted message' : (replySource.content || 'Audio message')}</span>
          </div>
        )}

        {/* Message bubble */}
        <div className={cn(
          "px-4 py-2.5 rounded-2xl shadow-sm relative",
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
              <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>
            )
          )}
        </div>

        {/* Reactions display */}
        {Object.keys(message.reactions || {}).length > 0 && (
          <div className={cn("flex flex-wrap gap-1 px-1", isMe ? "justify-end" : "justify-start")}>
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

      {/* Action buttons */}
      <AnimatePresence>
        {showActions && !isEditing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn(
              "absolute top-8 flex items-center gap-0.5 bg-card border border-border rounded-xl shadow-xl px-1 py-1 z-20",
              isMe ? "right-[52px]" : "left-[52px]"
            )}
          >
            {/* React */}
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(p => !p)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                title="React"
              >
                <Smile size={15} />
              </button>
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className={cn(
                      "absolute top-full mt-1 flex gap-1 bg-card border border-border rounded-xl p-2 shadow-xl z-30",
                      isMe ? "right-0" : "left-0"
                    )}
                  >
                    {QUICK_EMOJIS.map(e => (
                      <button
                        key={e}
                        onClick={() => handleReact(e)}
                        className="text-lg hover:scale-125 transition-transform w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10"
                      >
                        {e}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Reply */}
            {onReply && (
              <button
                onClick={() => { onReply(message); setShowActions(false); }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                title="Reply"
              >
                <Reply size={15} />
              </button>
            )}

            {/* Edit (own messages only) */}
            {isMe && message.messageType === 'text' && onEdit && (
              <button
                onClick={() => {
                  setIsEditing(true);
                  setEditContent(message.content || '');
                  setShowActions(false);
                  setTimeout(() => editInputRef.current?.focus(), 50);
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                title="Edit"
              >
                <Edit2 size={15} />
              </button>
            )}

            {/* Delete (own messages only) */}
            {isMe && onDelete && (
              <button
                onClick={() => { onDelete(message.id); setShowActions(false); }}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

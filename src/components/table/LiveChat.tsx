import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle,
  Send,
  ChevronUp,
  ChevronDown,
  ScrollText,
  Users,
  Mic,
  MicOff,
} from "lucide-react";
import type { ChatMessage, LogEntry } from "@/types/game";

// ============================================================
// Types
// ============================================================

type TabMode = "log" | "chat";

interface LiveChatProps {
  messages: ChatMessage[];
  logEntries: LogEntry[];
  onSendMessage: (content: string) => void;
  onJoinWaitlist?: () => void;
  waitlistCount?: number;
  isOnWaitlist?: boolean;
  myPlayerId?: string;
  playerCount?: number;
  maxPlayers?: number;
  isSpectator?: boolean;
}

// ============================================================
// Helpers
// ============================================================

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function sanitizeMessage(content: string): string {
  return content
    .replace(/[<>]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim()
    .slice(0, 200);
}

// ============================================================
// Sub-components
// ============================================================

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const iconMap: Record<string, string> = {
    player_joined: "🟢",
    player_left: "🔴",
    player_busted: "💥",
    hand_started: "🃏",
    hand_ended: "✅",
    blinds_posted: "💰",
    player_action: "▶️",
    community_cards: "🂠",
    showdown: "👀",
    pot_awarded: "🏆",
    stack_change: "📊",
    dealer_button: "🔘",
    tournament_update: "🏟️",
  };

  return (
    <div className="flex items-start gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors">
      <span className="text-[11px] flex-shrink-0 mt-0.5">
        {iconMap[entry.type] || "📝"}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] text-gray-300 leading-tight break-words">
          {entry.message}
        </span>
      </div>
      <span className="text-[9px] text-gray-500 flex-shrink-0 mt-0.5 tabular-nums">
        ⏱ {formatTime(entry.timestamp)}
      </span>
    </div>
  );
}

function ChatMessageRow({
  message,
  isMe,
}: {
  message: ChatMessage;
  isMe: boolean;
}) {
  if (message.type === "system" || message.type === "notification") {
    return (
      <div className="flex items-start gap-2 px-3 py-1 hover:bg-white/5 transition-colors">
        <span className="text-[10px] text-yellow-500 font-semibold flex-shrink-0 mt-0.5">
          {message.type === "system" ? "Poker Now" : "⚡"}
        </span>
        <span className="text-[11px] text-yellow-200/80 leading-tight break-words flex-1">
          {message.content}
        </span>
        <span className="text-[9px] text-gray-500 flex-shrink-0 mt-0.5 tabular-nums">
          ⏱ {formatTime(message.timestamp)}
        </span>
      </div>
    );
  }

  if (message.type === "dealer") {
    return (
      <div className="flex items-start gap-2 px-3 py-1 hover:bg-white/5 transition-colors">
        <span className="text-[10px] text-green-400 font-semibold flex-shrink-0 mt-0.5">
          Dealer
        </span>
        <span className="text-[11px] text-green-200/80 leading-tight break-words flex-1">
          {message.content}
        </span>
        <span className="text-[9px] text-gray-500 flex-shrink-0 mt-0.5 tabular-nums">
          ⏱ {formatTime(message.timestamp)}
        </span>
      </div>
    );
  }

  // Player chat message
  return (
    <div className="flex items-start gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors">
      <span
        className={`text-[10px] font-semibold flex-shrink-0 mt-0.5 ${
          isMe ? "text-blue-400" : "text-gray-400"
        }`}
      >
        {message.senderName || "Anonymous"}
      </span>
      <span className="text-[11px] text-gray-200 leading-tight break-words flex-1">
        {message.content}
      </span>
      <span className="text-[9px] text-gray-500 flex-shrink-0 mt-0.5 tabular-nums">
        {formatTime(message.timestamp)}
      </span>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function LiveChat({
  messages,
  logEntries,
  onSendMessage,
  onJoinWaitlist,
  waitlistCount = 0,
  isOnWaitlist = false,
  myPlayerId,
  playerCount = 0,
  maxPlayers = 8,
  isSpectator = false,
}: LiveChatProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabMode>("log");
  const [inputValue, setInputValue] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessageCount = useRef(messages.length);
  const prevLogCount = useRef(logEntries.length);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
      if (isNearBottom) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages.length, logEntries.length]);

  // Track unread messages when collapsed
  useEffect(() => {
    if (!isExpanded) {
      const newMessages = messages.length - prevMessageCount.current;
      const newLogs = logEntries.length - prevLogCount.current;
      if (newMessages > 0 || newLogs > 0) {
        setUnreadCount((prev) => prev + newMessages + newLogs);
      }
    } else {
      setUnreadCount(0);
    }
    prevMessageCount.current = messages.length;
    prevLogCount.current = logEntries.length;
  }, [messages.length, logEntries.length, isExpanded]);

  // Clear unread when expanding
  useEffect(() => {
    if (isExpanded) {
      setUnreadCount(0);
      // Focus input after expanding
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isExpanded]);

  const handleSend = useCallback(() => {
    const sanitized = sanitizeMessage(inputValue);
    if (!sanitized) return;
    onSendMessage(sanitized);
    setInputValue("");
    inputRef.current?.focus();
  }, [inputValue, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      // Prevent game shortcuts from firing while typing
      e.stopPropagation();
    },
    [handleSend],
  );

  // Combine and sort items for log view
  const combinedLogItems = [...logEntries].sort(
    (a, b) => a.timestamp - b.timestamp,
  );
  const chatItems = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  // Recent notifications for the collapsed bar
  const recentNotifications = [
    ...messages,
    ...logEntries.map((e) => ({
      id: e.id,
      tableId: e.tableId,
      type: "notification" as const,
      content: e.message,
      timestamp: e.timestamp,
    })),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 2);

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-40
        transition-all duration-300 ease-out
        ${isExpanded ? "h-[280px]" : "h-auto"}
      `}
    >
      {/* Expanded panel */}
      {isExpanded && (
        <div
          className="
            h-full flex flex-col
            bg-gray-900/95 backdrop-blur-md
            border-t border-gray-700/50
          "
        >
          {/* Tab bar */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-700/50 flex-shrink-0">
            <div className="flex items-center gap-1">
              {/* Log tab */}
              <button
                onClick={() => setActiveTab("log")}
                className={`
                  flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors
                  ${
                    activeTab === "log"
                      ? "bg-gray-700/80 text-white"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                  }
                `}
              >
                <ScrollText className="w-3.5 h-3.5" />
                LOG / LEDGER
              </button>

              {/* Chat tab */}
              <button
                onClick={() => setActiveTab("chat")}
                className={`
                  flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors relative
                  ${
                    activeTab === "chat"
                      ? "bg-gray-700/80 text-white"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                  }
                `}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                CHAT
                {activeTab !== "chat" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[9px] text-white rounded-full flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Mute toggle */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
                title={isMuted ? "Unmute notifications" : "Mute notifications"}
              >
                {isMuted ? (
                  <MicOff className="w-3.5 h-3.5" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Close button */}
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
                title="Collapse"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
          >
            {activeTab === "log" ? (
              combinedLogItems.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-gray-500 text-xs">
                    No activity yet. Hand log will appear here.
                  </span>
                </div>
              ) : (
                <div className="py-1">
                  {combinedLogItems.map((entry) => (
                    <LogEntryRow key={entry.id} entry={entry} />
                  ))}
                </div>
              )
            ) : chatItems.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-gray-500 text-xs">
                  No messages yet. Say hello! 👋
                </span>
              </div>
            ) : (
              <div className="py-1">
                {chatItems.map((msg) => (
                  <ChatMessageRow
                    key={msg.id}
                    message={msg}
                    isMe={msg.senderId === myPlayerId}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Input bar (chat mode only) */}
          {activeTab === "chat" && (
            <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-700/50 flex-shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.slice(0, 200))}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                maxLength={200}
                className="
                  flex-1 px-3 py-1.5 rounded-lg text-xs
                  bg-gray-800/80 border border-gray-600/50
                  text-gray-200 placeholder:text-gray-500
                  focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30
                  transition-colors
                "
                style={{ fontFamily: "inherit" }}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="
                  p-2 rounded-lg transition-colors
                  bg-blue-600 hover:bg-blue-500 text-white
                  disabled:opacity-30 disabled:cursor-not-allowed
                "
                title="Send message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Bottom info bar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-700/30 bg-gray-900/50 flex-shrink-0">
            {/* Waitlist section */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-gray-400">
                {waitlistCount} player(s) waiting
              </span>
              {isSpectator && !isOnWaitlist && onJoinWaitlist && (
                <button
                  onClick={onJoinWaitlist}
                  className="
                    px-3 py-1 rounded text-[10px] font-semibold
                    bg-green-600 hover:bg-green-500 text-white
                    transition-colors
                  "
                >
                  JOIN WAITLIST
                </button>
              )}
              {isOnWaitlist && (
                <span className="text-[10px] text-green-400 font-medium">
                  ✓ On waitlist
                </span>
              )}
            </div>

            {/* Player count */}
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <Users className="w-3 h-3" />
              {playerCount}/{maxPlayers}
            </div>
          </div>
        </div>
      )}

      {/* Collapsed bottom bar */}
      {!isExpanded && (
        <div
          className="
            flex items-center justify-between
            bg-gray-900/95 backdrop-blur-md
            border-t border-gray-700/50
            px-2 py-1.5
          "
        >
          {/* Left: Recent notifications preview */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => setIsExpanded(true)}
              className="
                flex items-center gap-1.5 px-2 py-1
                rounded text-[10px] font-semibold text-gray-300
                bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/40
                transition-colors flex-shrink-0
              "
            >
              <ScrollText className="w-3 h-3" />
              LOG / LEDGER
            </button>

            {/* Recent messages ticker */}
            <div className="flex-1 min-w-0 overflow-hidden">
              {recentNotifications.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {recentNotifications.slice(0, 1).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-1.5 min-w-0"
                    >
                      <span className="text-[10px] text-yellow-500/80 font-medium flex-shrink-0">
                        Table Notification:
                      </span>
                      <span className="text-[10px] text-gray-400 truncate">
                        {item.content}
                      </span>
                      <span className="text-[9px] text-gray-600 flex-shrink-0 tabular-nums">
                        ⏱ {formatTime(item.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[10px] text-gray-500">
                  No recent activity
                </span>
              )}
            </div>
          </div>

          {/* Center: Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0 mx-2">
            {/* Chat button */}
            <button
              onClick={() => {
                setActiveTab("chat");
                setIsExpanded(true);
              }}
              className="
                relative flex items-center gap-1 px-2 py-1.5
                rounded text-gray-400 hover:text-white
                hover:bg-gray-700/50 transition-colors
              "
              title="Open chat"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-[10px] font-medium hidden sm:inline">
                M
              </span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[8px] text-white rounded-full flex items-center justify-center font-bold animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Expand toggle */}
            <button
              onClick={() => setIsExpanded(true)}
              className="
                flex items-center p-1.5
                rounded text-gray-400 hover:text-white
                hover:bg-gray-700/50 transition-colors
              "
              title="Expand"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Waitlist / Join */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-[10px] text-gray-400 hidden sm:flex items-center gap-1.5">
              <span>{waitlistCount} player(s) waiting</span>
            </div>

            {isSpectator && !isOnWaitlist && onJoinWaitlist && (
              <button
                onClick={onJoinWaitlist}
                className="
                  px-3 py-1 rounded text-[10px] font-bold uppercase
                  bg-green-600 hover:bg-green-500 text-white
                  transition-colors tracking-wide
                "
              >
                JOIN WAITLIST
              </button>
            )}

            {isOnWaitlist && (
              <span className="text-[10px] text-green-400 font-medium px-2">
                ✓ Waitlist
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

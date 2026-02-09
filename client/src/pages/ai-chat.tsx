import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSelectedLeague } from "./league-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PremiumGate } from "@/components/premium-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  Bot,
  User,
  Loader2,
  Sparkles,
} from "lucide-react";

interface Message {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: number;
  userId: string | null;
  title: string;
  createdAt: string;
  messages?: Message[];
}

function MarkdownContent({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|^#{1,3}\s.+$|^[-*]\s.+$|^\d+\.\s.+$)/gm);

  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {content.split("\n").map((line, i) => {
        if (line.startsWith("### ")) {
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{renderInline(line.slice(4))}</h4>;
        }
        if (line.startsWith("## ")) {
          return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{renderInline(line.slice(3))}</h3>;
        }
        if (line.startsWith("# ")) {
          return <h2 key={i} className="font-bold text-base mt-3 mb-1">{renderInline(line.slice(2))}</h2>;
        }
        if (line.match(/^[-*]\s/)) {
          return (
            <div key={i} className="flex gap-2 ml-2">
              <span className="text-muted-foreground shrink-0">-</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        if (line.match(/^\d+\.\s/)) {
          const numMatch = line.match(/^(\d+)\.\s(.+)/);
          if (numMatch) {
            return (
              <div key={i} className="flex gap-2 ml-2">
                <span className="text-muted-foreground shrink-0">{numMatch[1]}.</span>
                <span>{renderInline(numMatch[2])}</span>
              </div>
            );
          }
        }
        if (line.trim() === "") {
          return <div key={i} className="h-2" />;
        }
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

const SUGGESTED_PROMPTS = [
  "Who should I start this week?",
  "Evaluate my roster strengths and weaknesses",
  "Best waiver wire targets right now",
  "Am I a contender or rebuilder?",
  "Top buy-low dynasty trade targets",
  "Which of my players should I sell high on?",
];

function ChatContent() {
  const { league } = useSelectedLeague();
  const leagueId = league?.league_id;
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/ai-chat/conversations"],
  });

  const { data: activeConversation, isLoading: loadingMessages } = useQuery<Conversation>({
    queryKey: ["/api/ai-chat/conversations", activeConversationId],
    enabled: !!activeConversationId,
  });

  const createConversation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-chat/conversations", { title: "New Chat" });
      return res.json();
    },
    onSuccess: (data: Conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-chat/conversations"] });
      setActiveConversationId(data.id);
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/ai-chat/conversations/${id}`);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-chat/conversations"] });
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
    },
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages, streamingContent, scrollToBottom]);

  const sendMessage = useCallback(async (messageText?: string) => {
    const text = messageText || inputMessage.trim();
    if (!text || isStreaming) return;

    let targetConversationId = activeConversationId;

    if (!targetConversationId) {
      try {
        const res = await apiRequest("POST", "/api/ai-chat/conversations", { title: "New Chat" });
        const newConvo: Conversation = await res.json();
        targetConversationId = newConvo.id;
        setActiveConversationId(newConvo.id);
        queryClient.invalidateQueries({ queryKey: ["/api/ai-chat/conversations"] });
      } catch {
        return;
      }
    }

    setInputMessage("");
    setIsStreaming(true);
    setStreamingContent("");

    // Optimistically add user message to the local cache
    queryClient.setQueryData<Conversation>(
      ["/api/ai-chat/conversations", targetConversationId],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: [
            ...(old.messages || []),
            { id: Date.now(), role: "user", content: text, createdAt: new Date().toISOString() },
          ],
        };
      }
    );

    try {
      const response = await fetch(`/api/ai-chat/conversations/${targetConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text, leagueId }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to send message");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === "content") {
                  fullContent += event.data;
                  setStreamingContent(fullContent);
                } else if (event.type === "title") {
                  queryClient.invalidateQueries({ queryKey: ["/api/ai-chat/conversations"] });
                } else if (event.type === "error") {
                  console.error("Stream error:", event.data);
                }
              } catch {
                // skip malformed SSE
              }
            }
          }
        }
      }

      // Refresh conversation data
      queryClient.invalidateQueries({ queryKey: ["/api/ai-chat/conversations", targetConversationId] });
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [inputMessage, isStreaming, activeConversationId, leagueId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const messages = activeConversation?.messages || [];

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 relative">
      {/* Mobile overlay backdrop */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Conversation List Sidebar */}
      <div className={`${
        showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      } fixed md:relative z-40 md:z-auto h-[calc(100vh-4rem)] w-72 md:w-64 bg-background border-r border-border transition-transform duration-200 flex flex-col shrink-0`}>
        <div className="p-3 border-b border-border flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm truncate">Conversations</h3>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setActiveConversationId(null);
                setShowSidebar(false);
              }}
              data-testid="button-new-chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingConversations ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-xs">
              No conversations yet. Start chatting!
            </div>
          ) : (
            conversations.map((convo) => (
              <div
                key={convo.id}
                className={`group flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer text-sm transition-colors ${
                  activeConversationId === convo.id
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover-elevate"
                }`}
                onClick={() => {
                  setActiveConversationId(convo.id);
                  setShowSidebar(false);
                }}
                data-testid={`conversation-item-${convo.id}`}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1">{convo.title}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 invisible group-hover:visible shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation.mutate(convo.id);
                  }}
                  data-testid={`button-delete-convo-${convo.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-0">
        {/* Header */}
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowSidebar(!showSidebar)}
            data-testid="button-toggle-sidebar"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-sm truncate" data-testid="text-chat-title">
            {activeConversation?.title || "AI Fantasy Assistant"}
          </h2>
          {leagueId && leagueId !== "all" && (
            <Badge variant="outline" className="text-xs ml-auto shrink-0" data-testid="badge-league-context">
              League context
            </Badge>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!activeConversationId && messages.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 md:gap-6 px-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
                <h3 className="text-base md:text-lg font-semibold" data-testid="text-welcome-title">AI Fantasy Assistant</h3>
                <p className="text-muted-foreground text-xs md:text-sm max-w-sm md:max-w-md">
                  Ask me anything about fantasy football — trades, start/sit, roster advice, dynasty strategy, and more.
                  {leagueId && leagueId !== "all" && " I have context about your current league and roster."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <Card
                    key={i}
                    className="hover-elevate cursor-pointer"
                    onClick={() => sendMessage(prompt)}
                    data-testid={`card-suggested-prompt-${i}`}
                  >
                    <CardContent className="p-3 text-sm text-muted-foreground">
                      {prompt}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <>
              {loadingMessages && activeConversationId ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-3/4" />
                  <Skeleton className="h-24 w-3/4 ml-auto" />
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${msg.role}-${msg.id}`}
                  >
                    {msg.role === "assistant" && (
                      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <MarkdownContent content={msg.content} />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                        <AvatarFallback className="bg-muted text-xs">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))
              )}

              {/* Streaming message */}
              {isStreaming && (
                <div className="flex gap-3 justify-start" data-testid="message-streaming">
                  <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted">
                    {streamingContent ? (
                      <MarkdownContent content={streamingContent} />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Thinking...
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-2 md:p-3 border-t border-border">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <Textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about trades, lineups, waivers, dynasty strategy..."
              className="resize-none min-h-[44px] max-h-[120px] text-sm"
              rows={1}
              disabled={isStreaming}
              data-testid="input-chat-message"
            />
            <Button
              size="icon"
              onClick={() => sendMessage()}
              disabled={!inputMessage.trim() || isStreaming}
              data-testid="button-send-message"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AIChatPage() {
  usePageTitle("AI Assistant");

  return (
    <PremiumGate featureName="AI Chat Assistant">
      <ChatContent />
    </PremiumGate>
  );
}

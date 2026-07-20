"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { History, PanelRightOpen, Plus, Sparkles } from "lucide-react";

import { storyAgentTurnAction } from "@/app/actions/story-agent";
import { submitChatFeedbackAction } from "@/app/actions/feedback";
import {
  archiveConversationAction,
  createConversationAction,
  ensureConversationAction,
  listConversationsAction,
  loadConversationAction,
  updateConversationStateAction,
} from "@/app/actions/conversations";
import { createStoryAction } from "@/app/actions/stories";
import { ChatComposer } from "@/components/app/chat/chat-composer";
import { ChatMessageList } from "@/components/app/chat/chat-message-list";
import { ChatSidebar } from "@/components/app/chat/chat-sidebar";
import type { ConversationHistoryItemData } from "@/components/app/chat/conversation-history-item";
import { StoryProgress } from "@/components/app/chat/story-progress";
import { StoryReviewDrawer } from "@/components/app/chat/story-review-drawer";
import { Button } from "@/components/ui/button";
import { CREATE_SUGGESTIONS, CHAT_SHELL_COPY } from "@/lib/chat/constants";
import {
  evaluateStoryCompleteness,
  normalizeChatStoryDraft,
  type NormalizedChatStoryDraft,
} from "@/lib/chat/create-story-extraction";
import {
  describeMemoryStatus,
  emptyStoryMemory,
  memoryToWizardCandidate,
  parseStoryMemory,
} from "@/lib/story-agent/memory-patch";
import type { StoryMemory } from "@/lib/story-agent/schema";
import type { ChatMessage, ChatSuggestion } from "@/lib/chat/types";
import { buildChatMessage, canSendMessage } from "@/lib/chat/utils";
import { cn } from "@/lib/utils";

/** Dedupes Strict Mode double-mount boot so we don't create two empty chats. */
let createStoryBootPromise: Promise<string | null> | null = null;

function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function memoryToDraft(memory: StoryMemory): NormalizedChatStoryDraft | null {
  if (
    !memory.storyMemory.title &&
    !memory.storyMemory.concept &&
    memory.characters.length === 0
  ) {
    return null;
  }
  const candidate = memoryToWizardCandidate(memory);
  return normalizeChatStoryDraft({
    title: candidate.title,
    description: candidate.description,
    genre: candidate.genre,
    language: candidate.language,
    tone: candidate.tone,
    setting: candidate.setting,
    pointOfView: candidate.pointOfView,
    pacing: candidate.pacing,
    writingStyle: candidate.writingStyle,
    plot: candidate.initialPlot,
    characters: candidate.characters,
    relationships: candidate.relationships,
    writingRules: candidate.writingRules,
  });
}

type CreateStoryChatProps = {
  className?: string;
  onClose?: () => void;
};

export function CreateStoryChat({ className, onClose }: CreateStoryChatProps) {
  const router = useRouter();
  const copy = CHAT_SHELL_COPY.create;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [memory, setMemory] = useState<StoryMemory | null>(null);
  const [storyDraft, setStoryDraft] = useState<NormalizedChatStoryDraft | null>(
    null
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<
    "ACTIVE" | "ARCHIVED"
  >("ACTIVE");
  const [linkedStoryId, setLinkedStoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<ConversationHistoryItemData[]>([]);
  const [restoring, setRestoring] = useState(true);
  const [persistHint, setPersistHint] = useState<string | null>(null);
  const [memoryStatus, setMemoryStatus] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ChatSuggestion[]>([]);
  const [episodePreview, setEpisodePreview] = useState<{
    title: string;
    content: string;
    wordCount: number;
    draftKind?: string;
  } | null>(null);
  const [lastOperation, setLastOperation] = useState<string>("conversational_chat");
  const [feedbackHint, setFeedbackHint] = useState<string | null>(null);
  const [contextHint, setContextHint] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const sendingLockRef = useRef(false);
  const createLockRef = useRef(false);
  const archiveLockRef = useRef(false);
  const lastFailedPromptRef = useRef<string | null>(null);
  /** Monotonic: bumps on each send; stale restores must not overwrite. */
  const turnSeqRef = useRef(0);
  /** Monotonic: bumps on each restore/open/boot; stale loads discarded. */
  const restoreSeqRef = useRef(0);
  const activeConversationIdRef = useRef<string | null>(null);

  const completeness = storyDraft
    ? evaluateStoryCompleteness(storyDraft)
    : null;
  const effectiveStatus = completeness?.status ?? "needs_more_info";
  const effectiveMissing = completeness?.missing ?? [];
  const createEnabled =
    effectiveStatus === "complete" && completeness?.wizardInput != null;
  const archivedConversation = conversationStatus === "ARCHIVED";
  const showReviewButton =
    Boolean(memory && (memory.characters.length > 0 || memory.storyMemory.title)) ||
    reviewOpen;

  const refreshHistory = useCallback(async () => {
    const listed = await listConversationsAction({
      mode: "CREATE",
      limit: 20,
    });
    if (listed.success) {
      setHistory(
        listed.data.conversations.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          storyTitle: c.storyTitle,
          lastMessageAt: c.lastMessageAt,
          lastMessagePreview: c.lastMessagePreview,
        }))
      );
    }
  }, []);

  const applyLoadedConversation = useCallback(
    (
      data: {
        conversationId: string;
        status: "ACTIVE" | "ARCHIVED";
        storyId?: string | null;
        messages: Array<{
          id: string;
          role: "user" | "assistant";
          content: string;
          status: "sent" | "error";
          createdAt: string;
        }>;
        state: unknown;
      },
      opts?: { restoreVersion: number; turnAtStart: number }
    ) => {
      // Ignore stale async restores after a newer restore or completed turn
      if (
        opts &&
        (opts.restoreVersion !== restoreSeqRef.current ||
          opts.turnAtStart !== turnSeqRef.current)
      ) {
        return false;
      }
      activeConversationIdRef.current = data.conversationId;
      setConversationId(data.conversationId);
      setConversationStatus(data.status);
      setLinkedStoryId(data.storyId ?? null);
      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          status: m.status,
        }))
      );
      const parsedMemory = parseStoryMemory(data.state);
      const hasMemory =
        parsedMemory.characters.length > 0 ||
        Boolean(parsedMemory.storyMemory.title) ||
        Boolean(parsedMemory.storyMemory.concept) ||
        (data.state &&
          typeof data.state === "object" &&
          ("storyMemory" in (data.state as object) ||
            "characters" in (data.state as object)));
      const nextMemory = hasMemory ? parsedMemory : emptyStoryMemory();
      setMemory(nextMemory);
      setStoryDraft(memoryToDraft(nextMemory));
      setMemoryStatus(describeMemoryStatus(nextMemory));
      setEpisodePreview(
        nextMemory.latestDraft?.content
          ? {
              title: nextMemory.latestDraft.title || "Draft",
              content: nextMemory.latestDraft.content,
              wordCount: nextMemory.latestDraft.wordCount || 0,
            }
          : null
      );
      setSuggestions([]);
      setPersistHint(hasMemory ? "Restored" : "Ready");
      setCreateError(null);
      lastFailedPromptRef.current = null;
      return true;
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const restoreVersion = ++restoreSeqRef.current;
      const turnAtStart = turnSeqRef.current;
      setRestoring(true);
      try {
        if (!createStoryBootPromise) {
          createStoryBootPromise = (async () => {
            await refreshHistory();
            const listed = await listConversationsAction({
              mode: "CREATE",
              limit: 1,
            });
            if (listed.success && listed.data.conversations.length > 0) {
              return listed.data.conversations[0].id;
            }
            const ensured = await ensureConversationAction({ mode: "CREATE" });
            if (!ensured.success) return null;
            return ensured.data.conversationId;
          })();
        }

        const conversationIdToLoad = await createStoryBootPromise;
        if (!conversationIdToLoad || cancelled) return;

        const loaded = await loadConversationAction({
          conversationId: conversationIdToLoad,
        });
        if (!loaded.success || cancelled) return;
        applyLoadedConversation(loaded.data, { restoreVersion, turnAtStart });
        await refreshHistory();
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [applyLoadedConversation, refreshHistory]);

  const openConversation = useCallback(
    async (id: string) => {
      const restoreVersion = ++restoreSeqRef.current;
      const turnAtStart = turnSeqRef.current;
      setRestoring(true);
      setBusy(true);
      try {
        const loaded = await loadConversationAction({ conversationId: id });
        if (!loaded.success) {
          setMessages((prev) => [
            ...prev,
            buildChatMessage("assistant", loaded.error.message, "error"),
          ]);
          return;
        }
        applyLoadedConversation(loaded.data, { restoreVersion, turnAtStart });
        setReviewOpen(false);
      } finally {
        setBusy(false);
        setRestoring(false);
      }
    },
    [applyLoadedConversation]
  );

  async function startNewConversation() {
    const restoreVersion = ++restoreSeqRef.current;
    turnSeqRef.current += 1; // invalidate in-flight restores
    setRestoring(true);
    setBusy(true);
    try {
      const created = await createConversationAction({ mode: "CREATE" });
      if (!created.success) {
        setMessages((prev) => [
          ...prev,
          buildChatMessage("assistant", created.error.message, "error"),
        ]);
        return;
      }
      await refreshHistory();
      const loaded = await loadConversationAction({
        conversationId: created.data.conversationId,
      });
      if (loaded.success) {
        applyLoadedConversation(loaded.data, {
          restoreVersion,
          turnAtStart: turnSeqRef.current,
        });
      }
      setMemory(emptyStoryMemory());
      setStoryDraft(null);
      setMessages([]);
      setReviewOpen(false);
      setEpisodePreview(null);
      setContextHint(null);
      setSuggestions([]);
      setMemoryStatus("Building your story world");
      setPersistHint("New chat");
    } finally {
      setBusy(false);
      setRestoring(false);
    }
  }

  async function archiveConversation(id: string) {
    if (archiveLockRef.current) return;
    archiveLockRef.current = true;
    setArchivingId(id);
    setArchiveError(null);
    const archiveVersion = ++restoreSeqRef.current;
    try {
      const result = await archiveConversationAction({ conversationId: id });
      if (!result.success) {
        setArchiveError(
          result.error.message ||
            "Couldn’t archive this conversation. Please try again."
        );
        return;
      }

      // Optimistic remove from ACTIVE history
      setHistory((prev) => prev.filter((c) => c.id !== id));

      if (conversationId === id) {
        const listed = await listConversationsAction({
          mode: "CREATE",
          limit: 20,
        });
        if (archiveVersion !== restoreSeqRef.current) return;
        if (listed.success && listed.data.conversations.length > 0) {
          const nextId = listed.data.conversations[0].id;
          await openConversation(nextId);
        } else {
          await startNewConversation();
        }
      } else {
        await refreshHistory();
      }
    } catch {
      setArchiveError("Couldn’t archive this conversation. Please try again.");
    } finally {
      archiveLockRef.current = false;
      setArchivingId(null);
    }
  }

  const sendPrompt = useCallback(
    async (raw: string, opts?: { isRetry?: boolean }) => {
      const content = raw.trim();
      if (
        sendingLockRef.current ||
        !canSendMessage(content, false) ||
        !conversationId ||
        archivedConversation
      ) {
        return;
      }

      sendingLockRef.current = true;
      const myTurn = ++turnSeqRef.current;
      const conversationAtSend = conversationId;
      activeConversationIdRef.current = conversationId;
      setBusy(true);
      setDraft("");
      setPersistHint("Thinking…");
      lastFailedPromptRef.current = content;

      const turnRequestId = newRequestId();
      const isRetry = Boolean(opts?.isRetry);

      if (isRetry) {
        setMessages((prev) => {
          const next = [...prev];
          while (
            next.length > 0 &&
            next[next.length - 1].role === "assistant" &&
            next[next.length - 1].status === "error"
          ) {
            next.pop();
          }
          const last = next[next.length - 1];
          if (last?.role === "user" && last.content === content) {
            return next;
          }
          return [...next, buildChatMessage("user", content, "sent")];
        });
      } else {
        setMessages((prev) => [
          ...prev,
          buildChatMessage("user", content, "sent"),
        ]);
      }

      try {
        const result = await storyAgentTurnAction({
          conversationId: conversationAtSend,
          message: content,
          turnRequestId,
          reuseLastUserMessage: isRetry,
        });

        // Stale turn or user switched conversation — do not clobber UI
        if (
          myTurn !== turnSeqRef.current ||
          activeConversationIdRef.current !== conversationAtSend
        ) {
          return;
        }

        if (!result.success) {
          const errMsg = result.error.message;
          setMessages((prev) => [
            ...prev,
            buildChatMessage("assistant", errMsg, "error"),
          ]);
          return;
        }

        lastFailedPromptRef.current = null;
        const isError = result.data.resultType === "error";
        setMessages((prev) => [
          ...prev,
          buildChatMessage(
            "assistant",
            result.data.assistantReply,
            isError ? "error" : "sent"
          ),
        ]);
        setMemory(result.data.memory);
        setStoryDraft(memoryToDraft(result.data.memory));
        setMemoryStatus(result.data.memoryStatus);
        setLinkedStoryId(result.data.storyId);
        setLastOperation(result.data.operation);
        setFeedbackHint(null);
        setSuggestions(
          result.data.suggestions.map((s, index) => ({
            id: `ctx-${index}-${s.label}`,
            label: s.label,
            prompt: s.prompt,
          }))
        );
        // Only replace draft panel when this turn produced a creative draft
        if (result.data.resultType === "creative_draft" && result.data.draft) {
          setEpisodePreview({
            title: result.data.draft.title,
            content: result.data.draft.content,
            wordCount: result.data.draft.wordCount,
            draftKind: result.data.draft.draftKind,
          });
          const names = (result.data.memory.characters ?? [])
            .map((c) => c.name)
            .filter(Boolean)
            .slice(0, 4);
          const lang =
            result.data.memory.userPreferences.dialogueLanguage ||
            result.data.memory.storyMemory.language ||
            "";
          setContextHint(
            [
              names.length ? names.join(", ") : null,
              result.data.operation === "write_scene"
                ? "Scene request"
                : null,
              lang || null,
            ]
              .filter(Boolean)
              .join(" · ") || null
          );
        } else if (result.data.resultType === "error") {
          // Keep prior draft visible; do not paint unrelated draft from chat turns
        }
        // conversational turns: do not echo stale latestDraft into the preview
        if (result.data.showReview) setReviewOpen(true);
        if (result.data.actionType === "create_story" && result.data.actionOk) {
          setReviewOpen(false);
        }
        await refreshHistory();
        if (
          myTurn !== turnSeqRef.current ||
          activeConversationIdRef.current !== conversationAtSend
        ) {
          return;
        }
        setPersistHint(
          result.data.resultType === "creative_draft" ? "Draft ready" : "Saved"
        );
      } catch {
        if (
          myTurn !== turnSeqRef.current ||
          activeConversationIdRef.current !== conversationAtSend
        ) {
          return;
        }
        const errMsg =
          "I couldn’t finish that reply. Please try once more. 🙂";
        setMessages((prev) => [
          ...prev,
          buildChatMessage("assistant", errMsg, "error"),
        ]);
      } finally {
        if (myTurn === turnSeqRef.current) {
          setBusy(false);
          sendingLockRef.current = false;
        }
      }
    },
    [archivedConversation, conversationId, refreshHistory]
  );

  function handleSend() {
    void sendPrompt(draft);
  }

  function handleSelectSuggestion(suggestion: ChatSuggestion) {
    void sendPrompt(suggestion.prompt);
  }

  function handleRetry() {
    const prompt = lastFailedPromptRef.current;
    if (!prompt || sendingLockRef.current) return;
    void sendPrompt(prompt, { isRetry: true });
  }

  async function handleCreate() {
    if (!storyDraft || createLockRef.current || creating || !conversationId) {
      return;
    }
    const evaluated = evaluateStoryCompleteness(storyDraft);
    if (evaluated.status !== "complete" || !evaluated.wizardInput) return;

    createLockRef.current = true;
    setCreating(true);
    setCreateError(null);

    try {
      const result = await createStoryAction(evaluated.wizardInput);
      if (!result.success) {
        setCreateError(result.error.message);
        createLockRef.current = false;
        return;
      }

      await updateConversationStateAction({
        conversationId,
        storyId: result.data.storyId,
        state: {
          ...(memory ?? emptyStoryMemory()),
          storyId: result.data.storyId,
          storyMemory: {
            ...(memory?.storyMemory ?? {}),
            storyStatus: "created",
            title: storyDraft.title,
          },
        },
      });

      router.push(`/stories/${result.data.storyId}`);
      router.refresh();
    } catch {
      setCreateError("Could not create the story. Please try again.");
      createLockRef.current = false;
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 overflow-hidden rounded-2xl border border-border bg-panel/80 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.85)]",
        className
      )}
    >
      <ChatSidebar
        items={history}
        activeId={conversationId}
        loading={restoring}
        archivingId={archivingId}
        onOpen={(id) => void openConversation(id)}
        onArchive={(id) => void archiveConversation(id)}
        onNew={() => void startNewConversation()}
        mobileOpen={historyOpen}
        onMobileClose={() => setHistoryOpen(false)}
      />

      <section
        aria-label={copy.title}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/80 px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-border p-2 text-ink-dim hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac lg:hidden"
                aria-label="Open conversation history"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="h-4 w-4" aria-hidden />
              </button>
              <span className="hidden h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet to-lilac text-white sm:flex">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-semibold tracking-tight text-ink">
                  {copy.title}
                </h2>
                <p className="truncate text-xs text-ink-dim">
                  Build your story through conversation.
                </p>
              </div>
            </div>
            {persistHint ? (
              <p className="mt-1 text-[11px] text-ink-faint">{persistHint}</p>
            ) : null}
            {archiveError ? (
              <p className="mt-1 text-[11px] text-danger" role="alert">
                {archiveError}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-border bg-charcoal/70 px-2.5 py-1 text-[11px] text-violet-soft">
              Live
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="rounded-xl"
              disabled={restoring}
              onClick={() => void startNewConversation()}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New Chat
            </Button>
            {showReviewButton ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="rounded-xl"
                disabled={!storyDraft || restoring}
                onClick={() => setReviewOpen(true)}
              >
                <PanelRightOpen className="h-3.5 w-3.5" aria-hidden />
                Story Details
              </Button>
            ) : null}
            {onClose ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="rounded-xl"
                onClick={onClose}
              >
                Close
              </Button>
            ) : null}
          </div>
        </header>

        <div className="shrink-0">
          <StoryProgress memory={memory} statusText={memoryStatus} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ChatMessageList
              messages={messages}
              emptyTitle={copy.emptyTitle}
              emptyDescription={copy.emptyDescription}
              suggestions={CREATE_SUGGESTIONS}
              onSelectSuggestion={handleSelectSuggestion}
              disabled={creating || restoring || archivedConversation}
              busy={busy && !restoring}
              onRetryError={handleRetry}
              className="h-auto min-h-0 overflow-visible"
            />

            {suggestions.length > 0 && !busy ? (
              <div className="flex flex-wrap gap-2 border-t border-border/50 px-3 py-2 sm:px-4">
                {suggestions.slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    disabled={creating || restoring || archivedConversation}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className="rounded-full border border-border bg-charcoal/50 px-3 py-1 text-xs text-ink-dim transition-colors hover:border-violet-soft/40 hover:text-ink disabled:opacity-50"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            ) : null}

            {episodePreview ? (
              <div className="border-t border-border/60 bg-charcoal/40 px-3 py-3 sm:px-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-violet-soft">
                    Unsaved{" "}
                    {episodePreview.draftKind === "scene" ? "scene" : "draft"}
                  </p>
                  <p className="text-[11px] text-ink-faint">
                    {episodePreview.wordCount} words
                  </p>
                </div>
                {contextHint ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] text-ink-faint hover:text-ink-dim">
                      Using: {contextHint}
                    </summary>
                  </details>
                ) : null}
                <p className="mt-0.5 truncate text-sm font-medium text-ink">
                  {episodePreview.title}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink-dim">
                  {episodePreview.content}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || creating || archivedConversation}
                    className="rounded-full border border-border px-3 py-1 text-[11px] text-ink-dim hover:border-violet-soft/40 hover:text-ink disabled:opacity-50"
                    onClick={() => void sendPrompt("Rewrite the previous scene.")}
                  >
                    Rewrite
                  </button>
                  <button
                    type="button"
                    disabled={busy || creating || archivedConversation}
                    className="rounded-full border border-border px-3 py-1 text-[11px] text-ink-dim hover:border-violet-soft/40 hover:text-ink disabled:opacity-50"
                    onClick={() =>
                      void sendPrompt(
                        "Make the previous scene slower and more emotional."
                      )
                    }
                  >
                    More emotional
                  </button>
                  <button
                    type="button"
                    disabled={busy || creating || archivedConversation}
                    className="rounded-full border border-border px-3 py-1 text-[11px] text-ink-dim hover:border-violet-soft/40 hover:text-ink disabled:opacity-50"
                    onClick={() => void sendPrompt("Continue from here.")}
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    disabled={busy || creating || archivedConversation}
                    className="rounded-full border border-border px-3 py-1 text-[11px] text-ink-dim hover:border-violet-soft/40 hover:text-ink disabled:opacity-50"
                    onClick={() => {
                      void navigator.clipboard?.writeText(episodePreview.content);
                    }}
                  >
                    Copy
                  </button>
                  {storyDraft && !linkedStoryId ? (
                    <button
                      type="button"
                      disabled={busy || creating || archivedConversation}
                      className="rounded-full border border-violet-soft/40 px-3 py-1 text-[11px] text-violet-soft hover:bg-violet/10 disabled:opacity-50"
                      onClick={() => setReviewOpen(true)}
                    >
                      Use in story
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/40 pt-2">
                  <span className="text-[10px] text-ink-faint">Feedback</span>
                  {(
                    [
                      ["helpful", "Helpful"],
                      ["not_helpful", "Not helpful"],
                      ["too_formal", "Too formal"],
                      ["not_natural_hinglish", "Not natural Hinglish"],
                    ] as const
                  ).map(([rating, label]) => (
                    <button
                      key={rating}
                      type="button"
                      disabled={!conversationId || busy}
                      className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-ink-faint hover:text-ink disabled:opacity-50"
                      onClick={() => {
                        if (!conversationId) return;
                        void (async () => {
                          const res = await submitChatFeedbackAction({
                            conversationId,
                            operation: lastOperation,
                            rating,
                            consentGranted: false,
                            tags: [rating],
                          });
                          setFeedbackHint(
                            res.success
                              ? res.data.stored
                                ? "Thanks — saved with consent."
                                : "Thanks — noted (not exported without consent)."
                              : "Could not save feedback."
                          );
                        })();
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  {feedbackHint ? (
                    <span className="text-[10px] text-violet-soft">{feedbackHint}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-border/80 pb-[max(0px,env(safe-area-inset-bottom))]">
            <ChatComposer
              value={draft}
              onChange={setDraft}
              onSend={handleSend}
              placeholder={copy.placeholder}
              disabled={creating || restoring || archivedConversation}
              busy={busy}
            />
          </div>
        </div>
      </section>

      {storyDraft ? (
        <StoryReviewDrawer
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          story={storyDraft}
          status={effectiveStatus}
          missing={effectiveMissing}
          creating={creating}
          createEnabled={createEnabled && !archivedConversation && !linkedStoryId}
          onChange={setStoryDraft}
          onCreate={() => void handleCreate()}
          error={createError}
        />
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { History, PanelRightOpen, Sparkles } from "lucide-react";

import { chatCreateStoryAction } from "@/app/actions/chat";
import {
  appendChatMessageAction,
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
  type NormalizedChatStoryDraft,
} from "@/lib/chat/create-story-extraction";
import { shouldAutoOpenReview } from "@/lib/chat/story-progress";
import type { ChatMessage, ChatSuggestion } from "@/lib/chat/types";
import { buildChatMessage, canSendMessage } from "@/lib/chat/utils";
import { cn } from "@/lib/utils";

function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
  const [story, setStory] = useState<NormalizedChatStoryDraft | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<
    "ACTIVE" | "ARCHIVED"
  >("ACTIVE");
  const [history, setHistory] = useState<ConversationHistoryItemData[]>([]);
  const [restoring, setRestoring] = useState(true);
  const [persistHint, setPersistHint] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const sendingLockRef = useRef(false);
  const createLockRef = useRef(false);
  const stateTimerRef = useRef<number | null>(null);
  const lastFailedPromptRef = useRef<string | null>(null);
  const previousStatusRef = useRef<"complete" | "needs_more_info" | null>(null);

  const completeness = story ? evaluateStoryCompleteness(story) : null;
  const effectiveStatus = completeness?.status ?? "needs_more_info";
  const effectiveMissing = completeness?.missing ?? [];
  const createEnabled =
    effectiveStatus === "complete" && completeness?.wizardInput != null;
  const archivedConversation = conversationStatus === "ARCHIVED";
  const showReviewButton = Boolean(story) || messages.length > 0;

  useEffect(() => {
    if (
      shouldAutoOpenReview({
        previousStatus: previousStatusRef.current,
        nextStatus: effectiveStatus,
      })
    ) {
      setReviewOpen(true);
    }
    previousStatusRef.current = effectiveStatus;
  }, [effectiveStatus]);

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
    (data: {
      conversationId: string;
      status: "ACTIVE" | "ARCHIVED";
      messages: Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        status: "sent" | "error";
        createdAt: string;
      }>;
      state: unknown;
    }) => {
      setConversationId(data.conversationId);
      setConversationStatus(data.status);
      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          status: m.status,
        }))
      );
      const state = (data.state ?? {}) as {
        draftForm?: NormalizedChatStoryDraft;
        extraction?: NormalizedChatStoryDraft;
      };
      const restored = state.draftForm ?? state.extraction ?? null;
      setStory(restored);
      previousStatusRef.current = restored
        ? evaluateStoryCompleteness(restored).status
        : null;
      setPersistHint(restored ? "Restored" : "Ready");
      setCreateError(null);
      lastFailedPromptRef.current = null;
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setRestoring(true);
      try {
        await refreshHistory();
        const ensured = await ensureConversationAction({ mode: "CREATE" });
        if (!ensured.success || cancelled) return;
        const loaded = await loadConversationAction({
          conversationId: ensured.data.conversationId,
        });
        if (!loaded.success || cancelled) return;
        applyLoadedConversation(loaded.data);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [applyLoadedConversation, refreshHistory]);

  useEffect(() => {
    if (!conversationId || restoring || archivedConversation) return;
    if (stateTimerRef.current) window.clearTimeout(stateTimerRef.current);
    const status = story
      ? evaluateStoryCompleteness(story).status
      : "needs_more_info";
    const missing = story ? evaluateStoryCompleteness(story).missing : [];
    stateTimerRef.current = window.setTimeout(() => {
      void updateConversationStateAction({
        conversationId,
        state: {
          extraction: story ?? undefined,
          draftForm: story ?? undefined,
          extractionStatus: status,
          missing,
        },
      }).then((result) => {
        if (result.success) setPersistHint("Saved");
      });
    }, 700);
    return () => {
      if (stateTimerRef.current) window.clearTimeout(stateTimerRef.current);
    };
  }, [archivedConversation, conversationId, restoring, story]);

  const openConversation = useCallback(
    async (id: string) => {
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
        applyLoadedConversation(loaded.data);
        setReviewOpen(false);
      } finally {
        setBusy(false);
        setRestoring(false);
      }
    },
    [applyLoadedConversation]
  );

  async function startNewConversation() {
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
      if (loaded.success) applyLoadedConversation(loaded.data);
      setStory(null);
      setMessages([]);
      setReviewOpen(false);
      previousStatusRef.current = null;
      setPersistHint("New chat");
    } finally {
      setBusy(false);
      setRestoring(false);
    }
  }

  async function archiveConversation(id: string) {
    const result = await archiveConversationAction({ conversationId: id });
    if (!result.success) {
      setMessages((prev) => [
        ...prev,
        buildChatMessage("assistant", result.error.message, "error"),
      ]);
      return;
    }
    await refreshHistory();
    if (conversationId === id) {
      await startNewConversation();
    }
  }

  const sendPrompt = useCallback(
    async (raw: string) => {
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
      setBusy(true);
      setDraft("");
      setPersistHint("Saving…");
      lastFailedPromptRef.current = content;

      const userRequestId = `u_${newRequestId()}`;
      const userMessage = buildChatMessage("user", content, "sent");
      setMessages((prev) => [...prev, userMessage]);

      const appendedUser = await appendChatMessageAction({
        conversationId,
        role: "USER",
        content,
        requestId: userRequestId,
      });
      if (!appendedUser.success) {
        setMessages((prev) => [
          ...prev,
          buildChatMessage("assistant", appendedUser.error.message, "error"),
        ]);
        setBusy(false);
        sendingLockRef.current = false;
        return;
      }

      try {
        const historyForAi = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const result = await chatCreateStoryAction({
          messages: historyForAi,
          currentStory: story ?? undefined,
        });

        if (!result.success) {
          const errMsg = result.error.message;
          setMessages((prev) => [
            ...prev,
            buildChatMessage("assistant", errMsg, "error"),
          ]);
          await appendChatMessageAction({
            conversationId,
            role: "ASSISTANT",
            content: errMsg,
            status: "ERROR",
            requestId: `a_${newRequestId()}`,
          });
          return;
        }

        lastFailedPromptRef.current = null;
        setMessages((prev) => [
          ...prev,
          buildChatMessage("assistant", result.data.assistantReply, "sent"),
        ]);
        setStory(result.data.story);

        await appendChatMessageAction({
          conversationId,
          role: "ASSISTANT",
          content: result.data.assistantReply,
          requestId: `a_${newRequestId()}`,
        });

        await updateConversationStateAction({
          conversationId,
          state: {
            extraction: result.data.story,
            draftForm: result.data.story,
            extractionStatus: result.data.status,
            missing: result.data.missing,
          },
        });
        await refreshHistory();
        setPersistHint("Saved");
      } catch {
        const errMsg =
          "Something went wrong reaching the story assistant. Please try again.";
        setMessages((prev) => [
          ...prev,
          buildChatMessage("assistant", errMsg, "error"),
        ]);
        await appendChatMessageAction({
          conversationId,
          role: "ASSISTANT",
          content: errMsg,
          status: "ERROR",
          requestId: `a_${newRequestId()}`,
        });
      } finally {
        setBusy(false);
        sendingLockRef.current = false;
      }
    },
    [archivedConversation, conversationId, messages, refreshHistory, story]
  );

  function handleSend() {
    void sendPrompt(draft);
  }

  function handleSelectSuggestion(suggestion: ChatSuggestion) {
    void sendPrompt(suggestion.prompt);
  }

  function handleRetry() {
    const prompt = lastFailedPromptRef.current;
    if (prompt) void sendPrompt(prompt);
  }

  async function handleCreate() {
    if (!story || createLockRef.current || creating || !conversationId) return;
    const evaluated = evaluateStoryCompleteness(story);
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
          extraction: story,
          draftForm: story,
          extractionStatus: "complete",
          missing: [],
          storyId: result.data.storyId,
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
        "flex h-full min-h-[520px] overflow-hidden rounded-2xl border border-border bg-panel/80 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.85)]",
        className
      )}
    >
      <ChatSidebar
        items={history}
        activeId={conversationId}
        loading={restoring}
        onOpen={(id) => void openConversation(id)}
        onArchive={(id) => void archiveConversation(id)}
        onNew={() => void startNewConversation()}
        mobileOpen={historyOpen}
        onMobileClose={() => setHistoryOpen(false)}
      />

      <section
        aria-label={copy.title}
        className="flex min-w-0 flex-1 flex-col"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border/80 px-3 py-3 sm:px-4">
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
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-border bg-charcoal/70 px-2.5 py-1 text-[11px] text-violet-soft">
              Live
            </span>
            {showReviewButton ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="rounded-xl"
                disabled={!story || restoring}
                onClick={() => setReviewOpen(true)}
              >
                <PanelRightOpen className="h-3.5 w-3.5" aria-hidden />
                Review Story
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

        <StoryProgress story={story} />

        <div className="min-h-0 flex-1">
          <ChatMessageList
            messages={messages}
            emptyTitle={copy.emptyTitle}
            emptyDescription={copy.emptyDescription}
            suggestions={CREATE_SUGGESTIONS}
            onSelectSuggestion={handleSelectSuggestion}
            disabled={creating || restoring || archivedConversation}
            busy={busy && !restoring}
            onRetryError={handleRetry}
          />
        </div>

        <div className="pb-[max(0px,env(safe-area-inset-bottom))]">
          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSend={handleSend}
            placeholder={copy.placeholder}
            disabled={creating || restoring || archivedConversation}
            busy={busy}
          />
        </div>
      </section>

      {story ? (
        <StoryReviewDrawer
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          story={story}
          status={effectiveStatus}
          missing={effectiveMissing}
          creating={creating}
          createEnabled={createEnabled && !archivedConversation}
          onChange={setStory}
          onCreate={() => void handleCreate()}
          error={createError}
        />
      ) : null}
    </div>
  );
}

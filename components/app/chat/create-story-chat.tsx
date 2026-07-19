"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
import { ChatShell } from "@/components/app/chat/chat-shell";
import { ConversationHistory } from "@/components/app/chat/conversation-history";
import type { ConversationHistoryItemData } from "@/components/app/chat/conversation-history-item";
import { StoryCreationPreview } from "@/components/app/chat/story-creation-preview";
import { CREATE_SUGGESTIONS } from "@/lib/chat/constants";
import {
  evaluateStoryCompleteness,
  type NormalizedChatStoryDraft,
} from "@/lib/chat/create-story-extraction";
import type { ChatMessage, ChatSuggestion } from "@/lib/chat/types";
import { buildChatMessage, canSendMessage } from "@/lib/chat/utils";

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [story, setStory] = useState<NormalizedChatStoryDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<
    "ACTIVE" | "ARCHIVED"
  >("ACTIVE");
  const [history, setHistory] = useState<ConversationHistoryItemData[]>([]);
  const [restoring, setRestoring] = useState(true);
  const [persistHint, setPersistHint] = useState<string | null>(null);
  const sendingLockRef = useRef(false);
  const createLockRef = useRef(false);
  const stateTimerRef = useRef<number | null>(null);

  const completeness = story ? evaluateStoryCompleteness(story) : null;
  const effectiveStatus = completeness?.status ?? "needs_more_info";
  const effectiveMissing = completeness?.missing ?? [];
  const createEnabled =
    effectiveStatus === "complete" && completeness?.wizardInput != null;
  const archivedConversation = conversationStatus === "ARCHIVED";

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
      setPersistHint(restored ? "Restored conversation" : "Conversation ready");
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
    const missing = story
      ? evaluateStoryCompleteness(story).missing
      : [];
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
          setError(loaded.error.message);
          return;
        }
        applyLoadedConversation(loaded.data);
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
        setError(created.error.message);
        return;
      }
      await refreshHistory();
      const loaded = await loadConversationAction({
        conversationId: created.data.conversationId,
      });
      if (loaded.success) applyLoadedConversation(loaded.data);
      setStory(null);
      setMessages([]);
      setPersistHint("New conversation");
    } finally {
      setBusy(false);
      setRestoring(false);
    }
  }

  async function archiveConversation(id: string) {
    const result = await archiveConversationAction({ conversationId: id });
    if (!result.success) {
      setError(result.error.message);
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
      setError(null);
      setDraft("");
      setPersistHint("Saving…");

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
        setError(appendedUser.error.message);
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
          setError(result.error.message);
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
        setError(errMsg);
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
    [
      archivedConversation,
      conversationId,
      messages,
      refreshHistory,
      story,
    ]
  );

  function handleSend() {
    void sendPrompt(draft);
  }

  function handleSelectSuggestion(suggestion: ChatSuggestion) {
    void sendPrompt(suggestion.prompt);
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
    <div className={className ? `space-y-4 ${className}` : "space-y-4"}>
      <ChatShell
        mode="create"
        messages={messages}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        suggestions={CREATE_SUGGESTIONS}
        onSelectSuggestion={handleSelectSuggestion}
        busy={busy || restoring}
        disabled={creating || restoring || archivedConversation}
        onClose={onClose}
        statusText="Gemini helps collect story details. Conversations resume after refresh."
        badgeLabel="Live"
        persistHint={persistHint}
        historySlot={
          <ConversationHistory
            items={history}
            activeId={conversationId}
            loading={restoring}
            onOpen={(id) => void openConversation(id)}
            onArchive={(id) => void archiveConversation(id)}
            onNew={() => void startNewConversation()}
          />
        }
      />

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {story ? (
        <StoryCreationPreview
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

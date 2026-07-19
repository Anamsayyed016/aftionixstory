"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { continueStoryChatAction } from "@/app/actions/chat-continue";
import {
  appendChatMessageAction,
  archiveConversationAction,
  createConversationAction,
  ensureConversationAction,
  listConversationsAction,
  loadConversationAction,
  updateConversationStateAction,
} from "@/app/actions/conversations";
import { saveEpisodeAction } from "@/app/actions/episodes";
import { ChatShell } from "@/components/app/chat/chat-shell";
import { ConversationHistory } from "@/components/app/chat/conversation-history";
import type { ConversationHistoryItemData } from "@/components/app/chat/conversation-history-item";
import { ContinueStoryDraft } from "@/components/app/chat/continue-story-draft";
import type { ContinueDraftState } from "@/components/app/chat/continue-story-toolbar";
import { Button } from "@/components/ui/button";
import { CONTINUE_SUGGESTIONS } from "@/lib/chat/constants";
import { clearContinueDraft } from "@/lib/chat/conversation-state";
import type { ChatMessage, ChatSuggestion } from "@/lib/chat/types";
import { buildChatMessage, canSendMessage } from "@/lib/chat/utils";

type GenerationAction =
  | "NEW_EPISODE"
  | "CONTINUE"
  | "REGENERATE"
  | "IMPROVE_WRITING"
  | "MORE_ROMANTIC"
  | "MORE_EMOTIONAL"
  | "ADD_COMEDY";

function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

type ContinueStoryChatProps = {
  storyId: string;
  storyTitle?: string;
  storyStatus?: string;
  latestEpisodeId?: string | null;
  className?: string;
  onClose?: () => void;
};

export function ContinueStoryChat({
  storyId,
  storyTitle,
  storyStatus = "ACTIVE",
  latestEpisodeId = null,
  className,
  onClose,
}: ContinueStoryChatProps) {
  const router = useRouter();
  const archived = storyStatus === "ARCHIVED";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [episodeDraft, setEpisodeDraft] = useState<ContinueDraftState | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingRegen, setPendingRegen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<
    "ACTIVE" | "ARCHIVED"
  >("ACTIVE");
  const [history, setHistory] = useState<ConversationHistoryItemData[]>([]);
  const [restoring, setRestoring] = useState(true);
  const [persistHint, setPersistHint] = useState<string | null>(null);
  const [restoredDraftBanner, setRestoredDraftBanner] = useState(false);

  const sendingLockRef = useRef(false);
  const saveLockRef = useRef(false);
  const stateTimerRef = useRef<number | null>(null);

  const conversationArchived = conversationStatus === "ARCHIVED";
  const composerDisabled =
    saving || archived || restoring || conversationArchived;

  const refreshHistory = useCallback(async () => {
    const listed = await listConversationsAction({
      mode: "CONTINUE",
      storyId,
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
  }, [storyId]);

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
        instruction?: string;
        draft?: {
          title: string;
          content: string;
          wordCount: number;
          episodeNumber?: number;
          clientRequestId: string;
          action?: string;
          replaceEpisodeId?: string;
          userInstruction?: string;
        } | null;
        draftDirty?: boolean;
        draftSavedEpisodeId?: string;
      };

      if (state.draft?.title && state.draft.content && state.draft.clientRequestId) {
        setEpisodeDraft({
          title: state.draft.title,
          content: state.draft.content,
          wordCount: state.draft.wordCount,
          clientRequestId: state.draft.clientRequestId,
          action: state.draft.action || "CONTINUE",
          proposedEpisodeNumber: state.draft.episodeNumber ?? 0,
          replaceEpisodeId: state.draft.replaceEpisodeId,
          userInstruction:
            state.draft.userInstruction || state.instruction || "",
          dirty: Boolean(state.draftDirty),
        });
        setRestoredDraftBanner(true);
        setPersistHint("Restored unsaved draft");
      } else {
        setEpisodeDraft(null);
        setRestoredDraftBanner(false);
        setPersistHint("Conversation ready");
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setRestoring(true);
      try {
        await refreshHistory();
        const ensured = await ensureConversationAction({
          mode: "CONTINUE",
          storyId,
        });
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
  }, [applyLoadedConversation, refreshHistory, storyId]);

  useEffect(() => {
    if (!conversationId || restoring || conversationArchived) return;
    if (stateTimerRef.current) window.clearTimeout(stateTimerRef.current);
    stateTimerRef.current = window.setTimeout(() => {
      void updateConversationStateAction({
        conversationId,
        state: {
          instruction: episodeDraft?.userInstruction,
          draft: episodeDraft
            ? {
                title: episodeDraft.title,
                content: episodeDraft.content,
                wordCount: episodeDraft.wordCount,
                episodeNumber: episodeDraft.proposedEpisodeNumber,
                clientRequestId: episodeDraft.clientRequestId,
                action: episodeDraft.action,
                replaceEpisodeId: episodeDraft.replaceEpisodeId,
                userInstruction: episodeDraft.userInstruction,
              }
            : null,
          draftDirty: episodeDraft?.dirty ?? false,
        },
      }).then((result) => {
        if (result.success) setPersistHint("Saved");
      });
    }, 700);
    return () => {
      if (stateTimerRef.current) window.clearTimeout(stateTimerRef.current);
    };
  }, [conversationArchived, conversationId, episodeDraft, restoring]);

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
      const created = await createConversationAction({
        mode: "CONTINUE",
        storyId,
      });
      if (!created.success) {
        setError(created.error.message);
        return;
      }
      await refreshHistory();
      const loaded = await loadConversationAction({
        conversationId: created.data.conversationId,
      });
      if (loaded.success) applyLoadedConversation(loaded.data);
      setEpisodeDraft(null);
      setMessages([]);
      setRestoredDraftBanner(false);
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

  const persistAssistant = useCallback(
    async (content: string, status: "SENT" | "ERROR" = "SENT") => {
      if (!conversationId) return;
      await appendChatMessageAction({
        conversationId,
        role: "ASSISTANT",
        content,
        status,
        requestId: `a_${newRequestId()}`,
      });
    },
    [conversationId]
  );

  const runGeneration = useCallback(
    async (params: {
      instruction: string;
      clientRequestId: string;
      forceAction?: GenerationAction;
      baseInstruction?: string;
      sourceEpisodeId?: string;
      userFacingMessage?: string;
    }) => {
      if (
        sendingLockRef.current ||
        archived ||
        !conversationId ||
        conversationArchived
      ) {
        return;
      }
      sendingLockRef.current = true;
      setBusy(true);
      setError(null);
      setSaveError(null);
      setPersistHint("Saving…");

      if (params.userFacingMessage) {
        setMessages((prev) => [
          ...prev,
          buildChatMessage("user", params.userFacingMessage!, "sent"),
        ]);
        await appendChatMessageAction({
          conversationId,
          role: "USER",
          content: params.userFacingMessage,
          requestId: `u_${params.clientRequestId}`,
        });
      }

      try {
        const result = await continueStoryChatAction({
          storyId,
          instruction: params.instruction,
          clientRequestId: params.clientRequestId,
          forceAction: params.forceAction,
          baseInstruction: params.baseInstruction,
          sourceEpisodeId: params.sourceEpisodeId,
        });

        if (!result.success) {
          setError(result.error.message);
          setMessages((prev) => [
            ...prev,
            buildChatMessage("assistant", result.error.message, "error"),
          ]);
          await persistAssistant(result.error.message, "ERROR");
          return;
        }

        if (result.data.status === "needs_more_info") {
          const reply = `${result.data.assistantReply}\n\n${result.data.followUpQuestion}`;
          setMessages((prev) => [
            ...prev,
            buildChatMessage("assistant", reply, "sent"),
          ]);
          await persistAssistant(reply);
          await refreshHistory();
          setPersistHint("Saved");
          return;
        }

        setMessages((prev) => [
          ...prev,
          buildChatMessage("assistant", result.data.assistantReply, "sent"),
        ]);
        await persistAssistant(result.data.assistantReply);

        const nextDraft: ContinueDraftState = {
          title: result.data.title,
          content: result.data.content,
          wordCount: result.data.wordCount,
          clientRequestId: result.data.clientRequestId,
          action: result.data.action,
          proposedEpisodeNumber: result.data.proposedEpisodeNumber,
          replaceEpisodeId: result.data.replaceEpisodeId,
          userInstruction: result.data.userInstruction,
          dirty: false,
        };
        setEpisodeDraft(nextDraft);
        setPendingRegen(false);
        setRestoredDraftBanner(false);

        await updateConversationStateAction({
          conversationId,
          state: {
            instruction: result.data.userInstruction,
            draft: {
              title: nextDraft.title,
              content: nextDraft.content,
              wordCount: nextDraft.wordCount,
              episodeNumber: nextDraft.proposedEpisodeNumber,
              clientRequestId: nextDraft.clientRequestId,
              action: nextDraft.action,
              replaceEpisodeId: nextDraft.replaceEpisodeId,
              userInstruction: nextDraft.userInstruction,
            },
            draftDirty: false,
          },
        });
        await refreshHistory();
        setPersistHint("Saved");
      } catch {
        const errMsg =
          "Something went wrong generating the episode. Please try again.";
        setError(errMsg);
        setMessages((prev) => [
          ...prev,
          buildChatMessage("assistant", errMsg, "error"),
        ]);
        await persistAssistant(errMsg, "ERROR");
      } finally {
        setBusy(false);
        sendingLockRef.current = false;
      }
    },
    [
      archived,
      conversationArchived,
      conversationId,
      persistAssistant,
      refreshHistory,
      storyId,
    ]
  );

  const sendPrompt = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!canSendMessage(content, false) || busy || saving || composerDisabled) {
        return;
      }

      setComposer("");
      const isRevision = Boolean(episodeDraft);
      await runGeneration({
        instruction: content,
        clientRequestId: newRequestId(),
        userFacingMessage: content,
        baseInstruction: isRevision
          ? episodeDraft?.userInstruction
          : undefined,
        forceAction: isRevision
          ? (episodeDraft?.action as GenerationAction | undefined)
          : undefined,
        sourceEpisodeId:
          episodeDraft?.replaceEpisodeId || latestEpisodeId || undefined,
      });
    },
    [
      busy,
      composerDisabled,
      episodeDraft,
      latestEpisodeId,
      runGeneration,
      saving,
    ]
  );

  function handleSend() {
    void sendPrompt(composer);
  }

  function handleSelectSuggestion(suggestion: ChatSuggestion) {
    void sendPrompt(suggestion.prompt);
  }

  function handleRegenerate() {
    if (!episodeDraft || busy || saving || archived || conversationArchived) {
      return;
    }
    if (episodeDraft.dirty && !pendingRegen) {
      setPendingRegen(true);
      return;
    }
    void runGeneration({
      instruction: episodeDraft.userInstruction,
      clientRequestId: newRequestId(),
      forceAction: episodeDraft.action as GenerationAction,
      sourceEpisodeId:
        episodeDraft.replaceEpisodeId || latestEpisodeId || undefined,
      userFacingMessage: "Regenerate this draft",
    });
  }

  async function handleSave() {
    if (
      !episodeDraft ||
      !conversationId ||
      saveLockRef.current ||
      saving ||
      busy ||
      archived
    ) {
      return;
    }
    saveLockRef.current = true;
    setSaving(true);
    setSaveError(null);

    try {
      const result = await saveEpisodeAction({
        storyId,
        title: episodeDraft.title,
        content: episodeDraft.content,
        userInstruction: episodeDraft.userInstruction,
        generationAction: episodeDraft.action as GenerationAction,
        clientRequestId: episodeDraft.clientRequestId,
        replaceEpisodeId: episodeDraft.replaceEpisodeId,
      });

      if (!result.success) {
        setSaveError(result.error.message);
        saveLockRef.current = false;
        return;
      }

      const savedMsg = `Episode ${result.data.episodeNumber} saved: “${result.data.title}”.`;
      setMessages((prev) => [
        ...prev,
        buildChatMessage("assistant", savedMsg, "sent"),
      ]);
      await persistAssistant(savedMsg);
      setEpisodeDraft(null);
      setRestoredDraftBanner(false);

      await updateConversationStateAction({
        conversationId,
        state: clearContinueDraft(
          { instruction: episodeDraft.userInstruction },
          result.data.episodeId
        ),
      });

      router.refresh();
      router.push(`/stories/${storyId}/episodes/${result.data.episodeId}`);
    } catch {
      setSaveError("Could not save the episode. Please try again.");
      saveLockRef.current = false;
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscard() {
    setEpisodeDraft(null);
    setPendingRegen(false);
    setSaveError(null);
    setRestoredDraftBanner(false);
    const msg =
      "Unsaved draft discarded. Nothing was deleted from the library.";
    setMessages((prev) => [...prev, buildChatMessage("assistant", msg, "sent")]);
    if (conversationId) {
      await persistAssistant(msg);
      await updateConversationStateAction({
        conversationId,
        state: clearContinueDraft({}),
      });
    }
  }

  return (
    <div className={className ? `space-y-4 ${className}` : "space-y-4"}>
      <ChatShell
        mode="continue"
        messages={messages}
        draft={composer}
        onDraftChange={setComposer}
        onSend={handleSend}
        suggestions={CONTINUE_SUGGESTIONS}
        onSelectSuggestion={handleSelectSuggestion}
        busy={busy || restoring}
        disabled={composerDisabled}
        storyTitle={storyTitle}
        onClose={onClose}
        statusText="Uses your story context and the existing episode pipeline. Conversations and unsaved drafts resume after refresh."
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

      {restoredDraftBanner && episodeDraft ? (
        <p className="rounded-xl border border-border bg-panel/70 px-3 py-2 text-sm text-ink-dim">
          Restored unsaved draft — nothing was saved automatically.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {pendingRegen && episodeDraft?.dirty ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-panel/70 px-3 py-3 text-sm text-ink-dim">
          <p>Replace your edited unsaved draft with a regenerated version?</p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setPendingRegen(false)}
            >
              Keep edits
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setPendingRegen(false);
                if (!episodeDraft) return;
                void runGeneration({
                  instruction: episodeDraft.userInstruction,
                  clientRequestId: newRequestId(),
                  forceAction: episodeDraft.action as GenerationAction,
                  sourceEpisodeId:
                    episodeDraft.replaceEpisodeId ||
                    latestEpisodeId ||
                    undefined,
                  userFacingMessage: "Regenerate this draft",
                });
              }}
            >
              Regenerate
            </Button>
          </div>
        </div>
      ) : null}

      {episodeDraft ? (
        <ContinueStoryDraft
          draft={episodeDraft}
          busy={busy}
          saving={saving}
          archived={archived || conversationArchived}
          error={saveError}
          onChange={setEpisodeDraft}
          onRegenerate={handleRegenerate}
          onSave={() => void handleSave()}
          onDiscard={() => void handleDiscard()}
        />
      ) : null}
    </div>
  );
}

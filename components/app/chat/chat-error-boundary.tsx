"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Optional label for logs / fallback copy. */
  label?: string;
};

type State = {
  error: Error | null;
};

/**
 * Catches render errors in the chat surface so a bug degrades to a visible
 * message instead of a silent blank panel.
 */
export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      JSON.stringify({
        event: "chat.error_boundary",
        label: this.props.label || "chat",
        message: error.message,
        stack: error.stack?.slice(0, 500),
        componentStack: info.componentStack?.slice(0, 500),
      })
    );
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center"
        >
          <p className="font-display text-lg font-semibold text-ink">
            Chat hit an unexpected error
          </p>
          <p className="max-w-md text-sm text-ink-dim">
            Something went wrong rendering this conversation. Try refreshing the
            page or starting a new chat.
          </p>
          <button
            type="button"
            className="rounded-xl border border-border bg-panel-raised px-4 py-2 text-sm text-ink hover:border-violet-soft/40"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Dev-only layout harness mirroring CreateStoryChat row structure
 * (sidebar | main) under the app shell height chain.
 */
export default function MobileChatPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <main className="p-8 text-sm text-ink-dim">
        Preview disabled in production.
      </main>
    );
  }

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-void text-ink">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <h1 className="font-display text-lg font-semibold">Chat</h1>
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] pt-4 md:pb-8">
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Same row layout as CreateStoryChat — NOT flex-col */}
            <div className="flex h-full min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-panel/80">
              <aside className="hidden h-full w-[280px] shrink-0 flex-col border-r border-border/80 bg-charcoal/50 lg:flex">
                <div className="border-b border-border/70 p-3 text-sm">New Story Chat</div>
                <p className="px-3 py-2 text-xs text-ink-faint">Recent</p>
              </aside>

              <section
                aria-label="Chat Assistant"
                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              >
                <header className="shrink-0 border-b border-border/80 px-3 py-3">
                  <h2 className="font-display text-lg font-semibold">Chat Assistant</h2>
                  <p className="text-xs text-ink-dim">Build your story through conversation.</p>
                </header>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8">
                    <div className="mx-auto max-w-md text-center">
                      <h3 className="font-display text-2xl font-semibold">Ask me anything</h3>
                      <p className="mt-2 text-sm text-ink-dim">
                        Story ideas, writing help, general questions — one chat.
                      </p>
                      <div className="mt-7 grid gap-2 sm:grid-cols-2">
                        {[
                          "I have a new story concept",
                          "Help me create a forbidden romance",
                          "I only have two characters",
                          "Suggest something unique",
                        ].map((label) => (
                          <div
                            key={label}
                            className="rounded-2xl border border-border bg-panel-raised/60 px-3.5 py-3 text-left text-sm text-ink-dim"
                          >
                            {label}
                          </div>
                        ))}
                      </div>
                      <p
                        data-testid="fake-message"
                        className="mt-6 rounded-xl border border-border bg-charcoal/40 px-3 py-2 text-left text-sm text-ink"
                      >
                        Prior message: once upon a time in Mumbai…
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-border/80 p-3">
                    <label className="sr-only" htmlFor="preview-composer">
                      Message
                    </label>
                    <div className="rounded-2xl border border-border bg-charcoal/70 p-2">
                      <textarea
                        id="preview-composer"
                        rows={2}
                        placeholder="Ask or describe your idea…"
                        className="w-full resize-none bg-transparent px-2 py-1 text-sm text-ink outline-none"
                        defaultValue=""
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
        <nav
          aria-label="Mobile tabs"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-charcoal/95 md:hidden"
        >
          <ul className="flex h-14 items-center justify-around text-[10px] uppercase tracking-wider text-ink-faint">
            <li className="text-lilac">Chat</li>
            <li>Stories</li>
            <li>Settings</li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

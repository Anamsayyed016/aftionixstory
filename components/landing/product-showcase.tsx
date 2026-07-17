"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Brain,
  Users,
  Sparkles,
  Archive,
  Pencil,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "workspace", label: "Story Workspace", icon: MessageSquare },
  { id: "memory", label: "Memory System", icon: Brain },
  { id: "characters", label: "Character Cards", icon: Users },
] as const;

type TabId = (typeof TABS)[number]["id"];

const MEMORIES = [
  {
    type: "Relationship Memory",
    text: "Azar confessed his feelings to Anaya",
    importance: "High",
    episode: "Ep. 14",
  },
  {
    type: "Plot Memory",
    text: "Anaya has not answered the confession yet",
    importance: "High",
    episode: "Ep. 14",
  },
  {
    type: "Relationship Memory",
    text: "Sameer now knows about Azar's feelings",
    importance: "Medium",
    episode: "Ep. 13",
  },
];

const CHARACTERS = [
  { name: "Azar", role: "Love interest", age: 34, mood: "Guarded", tag: "Slow to open up" },
  { name: "Anaya", role: "Protagonist", age: 22, mood: "Hopeful", tag: "Just found the photo" },
  { name: "Sameer", role: "Anaya's father", age: 51, mood: "Suspicious", tag: "Protective, funny" },
];

export function ProductShowcase() {
  const [active, setActive] = React.useState<TabId>("workspace");

  return (
    <section className="border-t border-border py-24 sm:py-32">
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <SectionEyebrow>Inside the Workspace</SectionEyebrow>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              One story, three layers underneath it
            </h2>
            <p className="mt-4 text-ink-dim">
              The writing happens in the center. Memory and characters live
              alongside it — always visible, always in sync.
            </p>
          </div>

          <div className="flex gap-1 rounded-md border border-border bg-panel p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-3 py-2 text-xs font-medium transition-colors",
                  active === tab.id
                    ? "bg-panel-raised text-ink"
                    : "text-ink-faint hover:text-ink-dim"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <AnimatePresence mode="wait">
            {active === "workspace" && (
              <motion.div
                key="workspace"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <GlassCard manuscript className="p-6 sm:p-8">
                  <div className="flex items-center gap-2">
                    <Badge variant="violet" dot>
                      Generating
                    </Badge>
                    <span className="font-mono text-[11px] text-ink-faint">
                      Episode 15 · Draft
                    </span>
                  </div>
                  <p className="mt-5 max-w-2xl font-display text-xl italic leading-relaxed text-ink">
                    &ldquo;Main tumhe bataana chahta tha,&rdquo; Azar began,
                    &ldquo;but every version of this conversation ends with
                    you looking at me the way you are right now.&rdquo;
                  </p>
                  <div className="mt-6 flex items-center gap-3 rounded-md border border-border bg-panel-raised/60 px-4 py-3">
                    <Sparkles className="h-4 w-4 shrink-0 text-violet-soft" />
                    <p className="text-sm text-ink-dim">
                      Describe what should happen in the next episode...
                    </p>
                  </div>
                </GlassCard>
              </motion.div>
            )}

            {active === "memory" && (
              <motion.div
                key="memory"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="grid gap-4 sm:grid-cols-3"
              >
                {MEMORIES.map((mem) => (
                  <GlassCard key={mem.text} className="p-5">
                    <Badge variant="rose">{mem.type}</Badge>
                    <p className="mt-4 text-sm leading-relaxed text-ink">
                      {mem.text}
                    </p>
                    <div className="mt-5 flex items-center justify-between text-xs text-ink-faint">
                      <span>{mem.episode}</span>
                      <span>{mem.importance} importance</span>
                    </div>
                    <div className="mt-4 flex gap-2 border-t border-border pt-4">
                      <button className="flex items-center gap-1 text-xs text-ink-dim hover:text-ink">
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button className="flex items-center gap-1 text-xs text-ink-dim hover:text-ink">
                        <Archive className="h-3 w-3" /> Archive
                      </button>
                    </div>
                  </GlassCard>
                ))}
              </motion.div>
            )}

            {active === "characters" && (
              <motion.div
                key="characters"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="grid gap-4 sm:grid-cols-3"
              >
                {CHARACTERS.map((char) => (
                  <GlassCard key={char.name} className="p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet/30 to-rose/30 font-display text-lg text-ink">
                        {char.name[0]}
                      </span>
                      <div>
                        <p className="font-display font-semibold text-ink">
                          {char.name}
                        </p>
                        <p className="text-xs text-ink-faint">
                          {char.role} · {char.age}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="violet">{char.mood}</Badge>
                      <Badge variant="outline">{char.tag}</Badge>
                    </div>
                  </GlassCard>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Container>
    </section>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { CreateCategoryFilters } from "@/components/app/create/create-category-filters";
import { CreatePromptComposer } from "@/components/app/create/create-prompt-composer";
import { StoryStarterCard } from "@/components/app/create/story-starter-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import {
  CREATE_MODE_SHORTCUTS,
  STORY_STARTERS,
  type CreateCategory,
  type StoryStarter,
  buildStoryAssistantHref,
  filterStoryStarters,
} from "@/lib/create/story-starters";
import { cn } from "@/lib/utils";

export type CreateHubRecentStory = {
  id: string;
  title: string;
  genre: string;
};

type CreateHubProps = {
  recentStories?: CreateHubRecentStory[];
};

export function CreateHub({ recentStories = [] }: CreateHubProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<CreateCategory>("All");

  const visibleStarters = useMemo(
    () => filterStoryStarters(STORY_STARTERS, category),
    [category]
  );

  const openAssistant = useCallback(
    (nextPrompt: string) => {
      router.push(buildStoryAssistantHref(nextPrompt));
    },
    [router]
  );

  const handleSubmit = useCallback(() => {
    openAssistant(prompt);
  }, [openAssistant, prompt]);

  const handleSelectStarter = useCallback((starter: StoryStarter) => {
    setPrompt(starter.prompt);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document
          .getElementById("create-prompt")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header className="mx-auto max-w-3xl text-center">
        <div className="flex justify-center">
          <Badge variant="violet" className="font-mono tracking-[0.18em]">
            CREATE
          </Badge>
        </div>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          What do you want to write today?
        </h1>
        <p className="mt-3 text-sm text-ink-dim sm:text-base">
          Start with one line, a character, a scene, or a complete story idea.
        </p>
        <p className="mt-2 text-sm text-ink-faint">
          Story Assistant will help you shape it through conversation.
        </p>
      </header>

      <section id="create-prompt" aria-label="Story prompt" className="scroll-mt-8">
        <CreatePromptComposer
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleSubmit}
        />
      </section>

      <section aria-label="Writing modes" className="space-y-4">
        <SectionEyebrow>Writing modes</SectionEyebrow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CREATE_MODE_SHORTCUTS.map((mode) => {
            const Icon = mode.icon;
            const content = (
              <>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet/12 text-violet-soft ring-1 ring-violet/20">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="mt-3 block font-display text-sm font-semibold text-ink">
                  {mode.title}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-ink-dim">
                  {mode.description}
                </span>
              </>
            );

            if (mode.href) {
              return (
                <Link key={mode.id} href={mode.href} className="block h-full">
                  <GlassCard
                    hover
                    className="h-full p-4 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    {content}
                  </GlassCard>
                </Link>
              );
            }

            return (
              <button
                key={mode.id}
                type="button"
                className="h-full text-left"
                onClick={() => {
                  if (mode.prompt) {
                    setPrompt(mode.prompt);
                    openAssistant(mode.prompt);
                  }
                }}
              >
                <GlassCard
                  hover
                  className="h-full p-4 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  {content}
                </GlassCard>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Story starters" className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionEyebrow>Story starters</SectionEyebrow>
            <h2 className="mt-2 font-display text-xl font-semibold text-ink">
              Templates for text storytelling
            </h2>
            <p className="mt-1 max-w-xl text-sm text-ink-dim">
              Choose a starter to prefill your prompt. Nothing is sent until you
              start Story Assistant.
            </p>
          </div>
        </div>

        <CreateCategoryFilters value={category} onChange={setCategory} />

        <div
          className={cn(
            "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
          )}
        >
          {visibleStarters.map((starter) => (
            <StoryStarterCard
              key={starter.id}
              starter={starter}
              onSelect={handleSelectStarter}
            />
          ))}
        </div>

        {visibleStarters.length === 0 ? (
          <p className="text-sm text-ink-dim">
            No starters in this category yet. Try All.
          </p>
        ) : null}
      </section>

      {recentStories.length > 0 ? (
        <section aria-label="Recent stories" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SectionEyebrow>Recent</SectionEyebrow>
              <h2 className="mt-2 font-display text-xl font-semibold text-ink">
                Continue a project
              </h2>
            </div>
            <Link href="/stories">
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {recentStories.map((story) => (
              <GlassCard key={story.id} className="flex flex-col gap-3 p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  {story.genre}
                </p>
                <p className="font-display text-lg text-ink">{story.title}</p>
                <Link href={`/stories/${story.id}`}>
                  <Button variant="secondary" size="sm" className="w-full">
                    Open story
                  </Button>
                </Link>
              </GlassCard>
            ))}
          </div>
        </section>
      ) : null}

      <GlassCard className="flex items-start gap-3 p-5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-lilac" aria-hidden />
        <div>
          <h2 className="font-display text-lg text-ink">Coming later</h2>
          <p className="mt-1 text-sm text-ink-dim">
            Character visuals and story videos are planned for a future phase.
            This hub stays focused on text storytelling.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}

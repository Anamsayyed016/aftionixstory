export const SITE = {
  name: "AFTIONIX Studio",
  tagline: "One assistant. Many things you can do.",
  description:
    "An AI platform for writing stories with memory, getting answers, and — soon — listing businesses and finding jobs.",
};

/** Flat top-level nav (Products is rendered separately as a dropdown). */
export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
] as const;

export const PRODUCT_LINKS = [
  {
    id: "story-studio",
    label: "Story Studio",
    description: "Write & continue stories with lasting memory",
    href: "#story-studio",
    status: "live" as const,
  },
  {
    id: "business-directory",
    label: "Business Directory",
    description: "List and discover local businesses",
    href: "#coming-soon",
    status: "coming_soon" as const,
  },
  {
    id: "jobs",
    label: "Jobs",
    description: "Find roles matched to your profile",
    href: "#coming-soon",
    status: "coming_soon" as const,
  },
] as const;

export const FEATURE_GROUPS = [
  {
    id: "story-studio",
    title: "Story Studio",
    eyebrow: "Available now",
    description:
      "Long-running fiction that stays coherent — characters, plot, and memory in one workspace.",
    status: "live" as const,
    features: [
      {
        id: "generation",
        title: "AI Episode Generation",
        description:
          "Describe what happens next in plain language. Get a full episode in your voice, ready to read or revise.",
      },
      {
        id: "memory",
        title: "Persistent Character Memory",
        description:
          "Confessions, secrets, and grudges carry forward — no re-explaining who knows what.",
      },
      {
        id: "language",
        title: "Hinglish & Multilingual Writing",
        description:
          "Dialogue the way your characters actually speak, including natural code-switched Hinglish.",
      },
      {
        id: "editable",
        title: "Editable AI Drafts",
        description:
          "Nothing is locked. Rewrite any line or take an episode in a new direction without losing continuity.",
      },
    ],
  },
  {
    id: "assistant",
    title: "Universal assistant",
    eyebrow: "Available now",
    description:
      "The same chat that writes stories also answers questions, helps with code, and looks up current info.",
    status: "live" as const,
    features: [
      {
        id: "chat",
        title: "Ask anything",
        description:
          "General questions, explanations, and brainstorming — without forcing every message into a story slot.",
      },
      {
        id: "coding",
        title: "Coding help",
        description:
          "Debug, explain, and sketch solutions when you need a technical hand mid-flow.",
      },
      {
        id: "current",
        title: "Current information",
        description:
          "Weather, news-style lookups, and other live questions via grounded search when you need it.",
      },
      {
        id: "images",
        title: "Image attach",
        description:
          "Share a photo in chat — the assistant acknowledges it and can help turn it into story fuel.",
      },
    ],
  },
  {
    id: "coming-soon",
    title: "Coming soon",
    eyebrow: "On the roadmap",
    description:
      "More of the platform is on the way. These are planned — not available to try yet.",
    status: "coming_soon" as const,
    features: [
      {
        id: "directory",
        title: "Business Directory",
        description:
          "List your business and help people discover local services — launching after Story Studio.",
      },
      {
        id: "jobs",
        title: "Jobs",
        description:
          "Browse and match to roles with the same assistant — coming after Directory.",
      },
    ],
  },
] as const;

/** @deprecated Prefer FEATURE_GROUPS — kept for any residual imports during transition. */
export const FEATURES = FEATURE_GROUPS.flatMap((g) =>
  g.features.map((f) => ({ ...f, group: g.id }))
);

export const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Open the assistant",
    description: "Sign up and land in one chat — no mode-switching required.",
  },
  {
    step: 2,
    title: "Ask or create",
    description:
      "Write a story beat, ask a question, or attach an image. Routing decides what happens next.",
  },
  {
    step: 3,
    title: "Keep going in Story Studio",
    description:
      "When you’re writing fiction, memory, characters, and episodes stay with the story.",
  },
  {
    step: 4,
    title: "Return anytime",
    description:
      "Pick up the same conversation or story later — context is where you left it.",
  },
] as const;

export const PRICING_TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try the assistant and Story Studio with light limits.",
    features: [
      "Universal chat access",
      "1 active story",
      "20 episodes / month",
      "Core memory system",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Writer",
    price: "$14",
    period: "/ month",
    description: "For serious, ongoing storytelling and daily assistant use.",
    features: [
      "Unlimited stories",
      "Unlimited episodes",
      "Full memory & plot tracking",
      "Hinglish & multilingual writing",
      "Priority generation",
    ],
    cta: "Get Started",
    highlighted: true,
  },
  {
    name: "Studio",
    price: "$39",
    period: "/ month",
    description: "For collaborative and long-running series.",
    features: [
      "Everything in Writer",
      "Shared story workspaces",
      "Advanced relationship maps",
      "Export to PDF & EPUB",
      "Early access to new models",
    ],
    cta: "Get Started",
    highlighted: false,
  },
] as const;

export const TESTIMONIALS = [
  {
    quote:
      "I've tried a dozen AI writing tools and every one of them forgot my characters by chapter three. AFTIONIX remembered a promise one of mine made forty episodes ago.",
    name: "Priya M.",
    role: "Slow-burn romance writer",
  },
  {
    quote:
      "The memory approval step is the difference. I get to decide what the story actually remembers instead of hoping the model got it right.",
    name: "Devon R.",
    role: "Serial fiction author",
  },
  {
    quote:
      "Writing Hinglish dialogue that actually sounds natural, not translated, was the thing that sold me.",
    name: "Ayesha K.",
    role: "Web novelist",
  },
] as const;

export const FAQS = [
  {
    question: "Is AFTIONIX only for writing stories?",
    answer:
      "Story Studio is the deepest product today — with persistent memory for long-running fiction. The same assistant also handles general questions, coding help, and current-info lookups. Business Directory and Jobs are coming soon.",
  },
  {
    question: "Does the AI really remember past episodes?",
    answer:
      "Yes. After every episode, Story Studio surfaces what changed — new facts, relationship shifts, unresolved threads — and you approve what gets saved. Future episodes use that memory.",
  },
  {
    question: "Can I edit what the AI writes?",
    answer:
      "Every generated episode is fully editable. You can rewrite lines, restructure scenes, or regenerate with different instructions at any time.",
  },
  {
    question: "What languages are supported?",
    answer:
      "Multilingual writing is supported, including Hinglish and other code-switched styles, with configurable formality and dialogue conventions.",
  },
  {
    question: "When will Business Directory and Jobs launch?",
    answer:
      "They're on the roadmap and shown as Coming soon on this site. Nothing to try yet — we'll open them when they're ready, not before.",
  },
] as const;

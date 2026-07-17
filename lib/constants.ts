export const SITE = {
  name: "StoryVerse AI",
  tagline: "Your stories remember everything.",
  description:
    "Create long-form, episodic AI stories with persistent character and plot memory.",
};

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

export const FEATURES = [
  {
    id: "generation",
    title: "AI Episode Generation",
    description:
      "Describe what happens next in plain language. StoryVerse drafts a full episode in your voice, ready to read, edit, or regenerate.",
  },
  {
    id: "memory",
    title: "Persistent Character Memory",
    description:
      "Every confession, secret, and grudge is saved as a memory the AI carries forward — no more re-explaining who knows what.",
  },
  {
    id: "plot",
    title: "Plot and Relationship Tracking",
    description:
      "Open threads stay open until you resolve them. Relationships shift episode to episode, and StoryVerse keeps score.",
  },
  {
    id: "management",
    title: "Story and Episode Management",
    description:
      "Every story lives in its own workspace — episodes, characters, and memories organized and searchable in one place.",
  },
  {
    id: "language",
    title: "Hinglish & Multilingual Writing",
    description:
      "Write dialogue the way your characters actually speak — including code-switched Hinglish — with tone and formality preserved.",
  },
  {
    id: "editable",
    title: "Editable AI-Generated Content",
    description:
      "Nothing is locked. Rewrite any line, adjust tone, or take an episode in a new direction without losing what came before.",
  },
] as const;

export const HOW_IT_WORKS = [
  { step: 1, title: "Create your story", description: "Set the genre, tone, and world your story lives in." },
  { step: 2, title: "Add characters", description: "Define personalities, histories, and how they speak." },
  { step: 3, title: "Write the next situation", description: "Tell StoryVerse what should happen next, in a sentence or a paragraph." },
  { step: 4, title: "Generate an episode", description: "Get a full episode, written in your story's established voice." },
  { step: 5, title: "Approve and save memories", description: "Review what changed and confirm what the story should remember." },
  { step: 6, title: "Continue anytime", description: "Pick up any story later — every detail is exactly where you left it." },
] as const;

export const PRICING_TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For trying StoryVerse with one story.",
    features: ["1 active story", "20 episodes / month", "Core memory system", "Community support"],
    cta: "Start Writing",
    highlighted: false,
  },
  {
    name: "Writer",
    price: "$14",
    period: "/ month",
    description: "For serious, ongoing storytelling.",
    features: [
      "Unlimited stories",
      "Unlimited episodes",
      "Full memory & plot tracking",
      "Hinglish & multilingual writing",
      "Priority generation",
    ],
    cta: "Start Your Story",
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
    cta: "Start Your Story",
    highlighted: false,
  },
] as const;

export const TESTIMONIALS = [
  {
    quote:
      "I've tried a dozen AI writing tools and every one of them forgot my characters by chapter three. StoryVerse remembered a promise one of mine made forty episodes ago.",
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
    question: "Does the AI really remember past episodes?",
    answer:
      "Yes. After every episode, StoryVerse surfaces what changed — new facts, relationship shifts, unresolved threads — and you approve what gets saved as a permanent memory. Future episodes are generated with that memory in context.",
  },
  {
    question: "Can I edit what the AI writes?",
    answer:
      "Every generated episode is fully editable. You can rewrite lines, restructure scenes, or regenerate with different instructions at any time.",
  },
  {
    question: "What languages does StoryVerse support?",
    answer:
      "StoryVerse supports multilingual writing, including Hinglish and other code-switched styles, with configurable formality and dialogue conventions per character.",
  },
  {
    question: "Can I control what content the AI generates?",
    answer:
      "Yes. Each story has configurable content boundaries and writing rules that apply to every generated episode.",
  },
  {
    question: "What happens if I cancel?",
    answer:
      "You keep read access to everything you've written. You can export your stories at any time from Settings.",
  },
] as const;

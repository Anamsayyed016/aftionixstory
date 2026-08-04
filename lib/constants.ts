export const SITE = {
  name: "AFTIONIX Studio",
  tagline: "One assistant. Many things you can do.",
  description:
    "An AI platform for writing stories with memory, getting answers, listing businesses, and connecting freelancers to gigs.",
};

/** Flat top-level nav (Products is rendered separately as a dropdown). */
export const NAV_LINKS = [
  { label: "Company", href: "/" },
  { label: "Features", href: "/studio#features" },
  { label: "Pricing", href: "/studio#pricing" },
] as const;

export const PRODUCT_LINKS = [
  {
    id: "story-studio",
    label: "Story Studio",
    description: "Write & continue stories with lasting memory",
    href: "/dashboard",
    status: "live" as const,
  },
  {
    id: "business-directory",
    label: "Business Directory",
    description: "List and discover local businesses",
    href: "/connect/business",
    status: "live" as const,
  },
  {
    id: "freelancer-connect",
    label: "Freelancer Connect",
    description: "Match businesses with freelancers for gigs",
    href: "/connect",
    status: "live" as const,
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
        href:
          "/dashboard?prompt=" +
          encodeURIComponent(
            "I want to start a new story. Help me shape the concept, then write the first episode."
          ),
      },
      {
        id: "memory",
        title: "Persistent Character Memory",
        description:
          "Confessions, secrets, and grudges carry forward — no re-explaining who knows what.",
        href:
          "/dashboard?prompt=" +
          encodeURIComponent(
            "Help me build the main characters for a new story — names, roles, and what they want."
          ),
      },
      {
        id: "language",
        title: "Hinglish & Multilingual Writing",
        description:
          "Dialogue the way your characters actually speak, including natural code-switched Hinglish.",
        href:
          "/dashboard?prompt=" +
          encodeURIComponent(
            "Write a short scene in natural Hinglish — everyday dialogue, not forced English."
          ),
      },
      {
        id: "editable",
        title: "Editable AI Drafts",
        description:
          "Nothing is locked. Rewrite any line or take an episode in a new direction without losing continuity.",
        href:
          "/dashboard?prompt=" +
          encodeURIComponent(
            "Help me rewrite a scene to improve pacing, dialogue, emotion, and clarity."
          ),
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
        href:
          "/dashboard?prompt=" +
          encodeURIComponent(
            "What are the key ideas behind good product onboarding for a new SaaS user?"
          ),
      },
      {
        id: "coding",
        title: "Coding help",
        description:
          "Debug, explain, and sketch solutions when you need a technical hand mid-flow.",
        href:
          "/dashboard?prompt=" +
          encodeURIComponent(
            "Help me debug this TypeScript error: Property 'x' does not exist on type 'y'. Explain and suggest a fix."
          ),
      },
      {
        id: "current",
        title: "Current information",
        description:
          "Weather, news-style lookups, and other live questions via grounded search when you need it.",
        href:
          "/dashboard?prompt=" +
          encodeURIComponent("What's the weather in Pune today?"),
      },
      {
        id: "images",
        title: "Image attach",
        description:
          "Share a photo in chat — the assistant acknowledges it and can help turn it into story fuel.",
        href: "/dashboard",
      },
    ],
  },
  {
    id: "business-directory",
    title: "Business Directory",
    eyebrow: "Available now",
    description:
      "List your business in chat and get a public shopfront page with the contact details you choose.",
    status: "live" as const,
    features: [
      {
        id: "directory",
        title: "List in chat",
        description:
          "Describe your business once — name, summary, location, and contact — and publish a /b/ page.",
        href:
          "/dashboard?prompt=" +
          encodeURIComponent(
            "List my business on the directory. I'll share the name, what we do, location, and contact email."
          ),
      },
      {
        id: "shopfront",
        title: "Public shopfront",
        description:
          "Owner-chosen email and phone appear on your listing so customers can reach you.",
        /** Demo listing from seed-marketplace-demo; Features can override with a live slug. */
        href: "/b/bright-print-co",
      },
    ],
  },
  {
    id: "freelancer-connect",
    title: "Freelancer Connect",
    eyebrow: "Available now",
    description:
      "Businesses post gigs; freelancers list skills. Mutual interest unlocks contact — connect-only, no payments in v1.",
    status: "live" as const,
    features: [
      {
        id: "gigs",
        title: "Post a gig",
        description:
          "Need a logo or a day of deliveries? Describe the task in chat and match to freelancers.",
        href:
          "/dashboard?prompt=" +
          encodeURIComponent("I need someone for a logo design gig"),
      },
      {
        id: "freelancer",
        title: "Freelancer profiles",
        description:
          "Skills, availability, and portfolio on a public /f/ page — contact stays private until matched.",
        href:
          "/dashboard?prompt=" +
          encodeURIComponent(
            "I'm looking for gig work. Help me set up my freelancer profile with skills and availability."
          ),
      },
      {
        id: "connect",
        title: "Mutual connect",
        description:
          "Express interest, accept on both sides, then see contact info. No escrow or payments yet.",
        href: "/connect",
      },
    ],
  },
] as const;

/**
 * Simplified /studio product pitch — one card per product (no nested feature grids).
 * Keep FEATURE_GROUPS for any residual detail links; Features UI uses this list.
 */
export const STUDIO_PRODUCT_CARDS = [
  {
    id: "story-studio",
    title: "Story Studio",
    benefit:
      "Long-running fiction with memory — characters and plot that stay coherent episode after episode.",
    href:
      "/dashboard?prompt=" +
      encodeURIComponent(
        "I want to start a new story. Help me shape the concept, then write the first episode."
      ),
    cta: "Try Story Studio",
    status: "live" as const,
  },
  {
    id: "assistant",
    title: "Ask anything",
    benefit:
      "The same chat answers questions, helps with code, and looks up current info — not everything has to be a story.",
    href:
      "/dashboard?prompt=" +
      encodeURIComponent(
        "What are the key ideas behind good product onboarding for a new SaaS user?"
      ),
    cta: "Ask the assistant",
    status: "live" as const,
  },
  {
    id: "business-directory",
    title: "Business Directory",
    benefit:
      "List your business in chat and get a public /b shopfront with the contact details you choose.",
    href:
      "/dashboard?prompt=" +
      encodeURIComponent(
        "List my business on the directory. I'll share the name, what we do, location, and contact email."
      ),
    cta: "List a business",
    status: "live" as const,
  },
  {
    id: "freelancer-connect",
    title: "Freelancer Connect",
    benefit:
      "Post gigs or list skills — mutual interest unlocks contact. Connect-only; no payments in v1.",
    href: "/connect",
    cta: "Open Connect",
    status: "live" as const,
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
      "Write a story, list a business, post a gig, or set up freelancer skills. Routing decides what happens next.",
  },
  {
    step: 3,
    title: "Keep going",
    description:
      "Story memory stays with your fiction; Connect keeps match history until both sides accept.",
  },
  {
    step: 4,
    title: "Return anytime",
    description:
      "Pick up the same conversation, story, or match later — context is where you left it.",
  },
] as const;

export const PRICING_TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try the assistant, Story Studio, and Connect with light limits.",
    features: [
      "Universal chat access",
      "1 active story",
      "20 episodes / month",
      "Business + freelancer profiles",
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
      "No. Story Studio is deepest for long-running fiction, but the same assistant also answers questions, lists businesses on the Directory, and matches gigs via Freelancer Connect (connect-only — no payments in v1).",
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
    question: "How does Freelancer Connect share contact info?",
    answer:
      "Public freelancer pages never show email or phone. After both sides express mutual interest on a gig (accept the match), contact is revealed to each other. Payments and escrow are not included yet.",
  },
] as const;

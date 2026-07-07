/**
 * AI Product Builder Bootcamp — single source of truth for all copy + data.
 * Section components import the slice they render so wording stays consistent
 * and editable in one place. Placeholder names are clearly fictional.
 */

export const meta = {
  name: "AI Product Builder Bootcamp",
  short: "AIPB",
  promise: "Build your first AI-powered product in 5 days.",
  price: "₹25,000",
  seats: 25,
  durationDays: 5,
  format: "Live Online Cohort",
} as const;

export const nav = {
  brand: meta.name,
  links: [
    { label: "Outcomes", href: "#outcomes" },
    { label: "Curriculum", href: "#curriculum" },
    { label: "Instructor", href: "#instructor" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ],
  cta: { label: "Apply Now", href: "#apply" },
} as const;

export const hero = {
  eyebrow: "5-Day Live Cohort · Limited to 25 Seats",
  titleLead: "Build your first",
  titleGradient: "AI product",
  titleTail: "in 5 days.",
  sub: "Go from raw idea to a working AI prototype, a live landing page, and an investor-ready pitch deck — in 5 live days, building with modern AI tools like Emergent and Claude Code. No coding required.",
  primaryCta: { label: "Apply Now", href: "#apply" },
  secondaryCta: { label: "See the 5-day plan", href: "#curriculum" },
  trust: "Only 25 seats · No coding required · Rolling admissions",
  socialProof: "Loved by students & builders from",
  logos: ["IIT", "NIT", "BITS", "IIM", "VIT", "SRM"],
  stats: [
    { value: "5", label: "Days, live" },
    { value: "25", label: "Seats only" },
    { value: "6", label: "Deliverables" },
    { value: "0", label: "Lines of code" },
  ],
} as const;

export const audience = {
  eyebrow: "Who It's For",
  title: "Built for recent grads ready to stand out.",
  sub: "Fresh out of college and staring down an AI-first job market? This is your unfair advantage — a portfolio that proves you can build, not just talk.",
  groups: [
    { icon: "GraduationCap", title: "Recent graduates", body: "Turn your degree into a shipped product and a story recruiters actually remember.", featured: true },
    { icon: "Users", title: "College & engineering students", body: "Graduate already ahead — with a real AI product in your portfolio." },
    { icon: "TrendingUp", title: "MBA students", body: "Pair your business edge with the power to actually build the thing." },
    { icon: "Rocket", title: "Aspiring founders", body: "Validate and prototype your startup idea in five focused days." },
    { icon: "Presentation", title: "Future product managers", body: "Ship AI products end-to-end — the exact skill PM interviews now test." },
  ],
} as const;

export const problem = {
  eyebrow: "The Reality",
  title: "A degree alone won't make you AI-ready.",
  sub: "The economy stopped rewarding what you memorized. It now rewards what you can build. Here's the gap most students don't see coming.",
  cards: [
    {
      icon: "TrendingUp",
      title: "The goalposts moved",
      body: "Companies now hire for what you can build with AI — not for the syllabus you finished. The market re-priced skills overnight.",
    },
    {
      icon: "GraduationCap",
      title: "Theory isn't proof",
      body: "Lectures, notes, and certificates don't show you can turn an idea into a product. Recruiters want a demo, not a transcript.",
    },
    {
      icon: "Lightbulb",
      title: "Everyone has ideas",
      body: "The distance between “I have an idea” and “here's my working demo” is exactly where opportunities — and offers — are won.",
    },
    {
      icon: "Timer",
      title: "AI moves monthly",
      body: "Without hands-on reps, you're always a step behind the people actually shipping. Watching tutorials isn't the same as building.",
    },
  ],
} as const;

export const transformation = {
  eyebrow: "The Shift",
  title: "Five days changes the story you tell.",
  sub: "You walk in with an idea. You walk out with proof.",
  before: {
    label: "Before the bootcamp",
    items: [
      "An idea buried in your notes app",
      "Frozen by AI tools and “where do I even start”",
      "A résumé that reads like everyone else's",
      "Can explain concepts — can't show one",
      "Waiting for permission to build",
    ],
  },
  after: {
    label: "After the bootcamp",
    items: [
      "A live, working AI product you built yourself",
      "Fluent in the modern AI build stack",
      "A portfolio project that makes recruiters stop scrolling",
      "A pitch deck and GTM plan ready to send",
      "The confidence — and proof — to ship anything",
    ],
  },
} as const;

export const outcomes = {
  eyebrow: "What You Leave With",
  title: "Six tangible assets. Not a certificate you forget.",
  sub: "By Day 5 you don't just “understand” AI products. You own a complete, shippable body of work.",
  items: [
    { icon: "Lightbulb", title: "AI Product Idea", body: "A validated, scoped idea worth building — not a vague hunch." },
    { icon: "Layers", title: "Product Blueprint", body: "A clear spec: who it's for, the problem, the features, the flows." },
    { icon: "Rocket", title: "Working Prototype", body: "A real, clickable, AI-powered prototype you can demo live." },
    { icon: "Globe", title: "Landing Page", body: "A live page that explains your product and converts visitors." },
    { icon: "Presentation", title: "Pitch Deck", body: "An investor-ready story in ten tight, persuasive slides." },
    { icon: "Trophy", title: "Portfolio Project", body: "Proof of work for jobs, internships, and founder applications." },
  ],
} as const;

export const curriculum = {
  eyebrow: "The 5-Day Arc",
  title: "From blank page to demo day.",
  sub: "Every day is live, hands-on, and ends with you further than you started. No filler, no passive lectures.",
  days: [
    {
      day: "Day 1",
      title: "Idea → Validated Concept",
      body: "Find a real problem, pressure-test demand with AI research, and scope an AI product you can actually build in five days.",
      tags: ["Ideation", "Validation", "Scoping"],
    },
    {
      day: "Day 2",
      title: "Blueprint → Design",
      body: "Turn the idea into a product spec, user flows, and a clean UI using modern AI design tools. Decide exactly what to build.",
      tags: ["Spec", "User flows", "UI"],
    },
    {
      day: "Day 3",
      title: "Build → Prototype",
      body: "Ship a working, AI-powered prototype using Emergent and Claude Code — describe what you want in plain English and let the AI build it. No coding needed; your idea becomes a clickable product.",
      tags: ["Emergent", "Claude Code", "No-code MVP"],
    },
    {
      day: "Day 4",
      title: "Launch → Page & GTM",
      body: "Publish a live landing page and craft a go-to-market plan: who you reach, the message, and the first 100 users.",
      tags: ["Landing page", "GTM", "Positioning"],
    },
    {
      day: "Day 5",
      title: "Pitch → Demo Day",
      body: "Build your pitch deck, rehearse the story, and present your product live to the cohort. Walk away with a portfolio piece.",
      tags: ["Pitch deck", "Storytelling", "Demo"],
    },
  ],
} as const;

export const instructor = {
  eyebrow: "Who You Learn From",
  title: "Taught by a practitioner, not a lecturer.",
  name: "[Instructor Name]",
  roles: ["AI Product Builder", "Founder", "AI Strategist", "Industry Practitioner"],
  bio: "Has shipped AI products used by thousands, advised early-stage startups on AI strategy, and mentored builders from first idea to launch. In five days you'll learn the exact field playbook — the version that ships, not the version in a textbook.",
  stats: [
    { value: "12+", label: "AI products shipped" },
    { value: "300+", label: "builders mentored" },
    { value: "8 yrs", label: "building & advising" },
  ],
  highlights: [
    "Built and launched real AI products end-to-end",
    "Advised founders on AI product & GTM strategy",
    "Mentors live — feedback on your actual project",
  ],
} as const;

export const framework = {
  eyebrow: "The Method",
  title: "The B.U.I.L.D. Framework",
  sub: "A repeatable loop you'll use long after the cohort ends. Five steps, one per day, that take any idea to a shipped product.",
  steps: [
    { letter: "B", name: "Brainstorm with AI", body: "Generate, validate, and sharpen an idea worth building." },
    { letter: "U", name: "Understand the user", body: "Define the user, the problem, and the spec before you build." },
    { letter: "I", name: "Iterate a prototype", body: "Ship a working MVP fast using AI and no-code tools." },
    { letter: "L", name: "Launch it", body: "Put up a landing page and a real go-to-market plan." },
    { letter: "D", name: "Demo & pitch", body: "Tell the story, present the deck, and close the room." },
  ],
} as const;

export const testimonials = {
  eyebrow: "From The Cohort",
  title: "Real outcomes, in their words.",
  sub: "Placeholder testimonials — swap with your own cohort's once you run it.",
  items: [
    { quote: "I came in with a vague idea and left with a working AI app and a pitch deck I actually sent to an incubator.", name: "Ananya R.", role: "Engineering Student · NIT", rating: 5 },
    { quote: "“No coding required” was real. I built and launched a landing page that pulled 200 signups in a week.", name: "Rohan M.", role: "MBA Student", rating: 5 },
    { quote: "Best five days of my college life. My portfolio project got me an internship interview the next month.", name: "Karthik S.", role: "CS Student", rating: 5 },
    { quote: "I finally understand how to build with AI instead of just talking about it on LinkedIn.", name: "Sneha P.", role: "Aspiring Founder", rating: 5 },
    { quote: "The framework is gold. I now ship a side project almost every month.", name: "Aditya V.", role: "Future Product Manager", rating: 5 },
    { quote: "Worth every rupee. It felt like a startup accelerator compressed into one intense week.", name: "Meera K.", role: "Student · BITS", rating: 5 },
  ],
} as const;

export const pricing = {
  eyebrow: "Enrol",
  title: "One cohort. Twenty-five seats.",
  sub: "An all-inclusive 5-day live program. Apply now — seats are reviewed on a rolling basis and they go fast.",
  price: meta.price,
  priceNote: "One-time · all-inclusive",
  priceAnchor: "≈ ₹5,000 / day · about ₹4,200 per deliverable",
  priceContext: "Less than a month of most upskilling subscriptions — for a finished product you actually ship.",
  seatsLabel: "Only 25 seats per cohort",
  seatsRemaining: 7,
  guarantee: "Apply free — you only pay once you're accepted and confirm your seat.",
  cta: { label: "Apply Now", href: "#apply" },
  urgency: "Applications close the moment all 25 seats fill.",
  includes: [
    "5 days of live, hands-on coaching",
    "All six deliverables, built with you",
    "The AI tools playbook & templates",
    "Lifetime access to recordings",
    "1:1 feedback on demo day",
    "Private builder community",
    "Certificate of completion",
    "No coding experience required",
  ],
} as const;

export const faqs = {
  eyebrow: "Questions",
  title: "Everything you're wondering.",
  items: [
    { q: "Do I need any coding experience?", a: "None. The entire bootcamp uses modern AI and no-code tools. If you can use a browser and write a prompt, you can build here." },
    { q: "Who is this actually for?", a: "College and engineering students, recent graduates, MBA students, aspiring entrepreneurs, and future product managers — anyone who wants to build with AI instead of just reading about it." },
    { q: "Is it really live?", a: "Yes. Every session is live online with the instructor and your cohort. You build in real time and get feedback as you go." },
    { q: "How much time per day should I expect?", a: "Plan for roughly 4–6 hours per day across live sessions and hands-on building. You leave each day with real progress." },
    { q: "What if I miss a session?", a: "Recordings are provided so you never fall behind, though live attendance is strongly recommended — that's where the feedback happens." },
    { q: "Will I genuinely build something real?", a: "Yes. You finish with a working prototype, a live landing page, a pitch deck, and a portfolio project — not just notes." },
    { q: "What do I need to join?", a: "A laptop, a stable internet connection, and the willingness to build. We handle the tools and the roadmap." },
    { q: "What about refunds?", a: "Applications are reviewed for fit before you pay. Refund terms are shared at confirmation — we only want builders who'll show up." },
  ],
} as const;

export const finalCta = {
  eyebrow: "Last Call",
  title: "Your AI product is five days away.",
  sub: "Twenty-five seats. One cohort. Apply now and finally build the thing you've been putting off.",
  primaryCta: { label: "Apply Now", href: "#apply" },
  secondaryCta: { label: "Read the FAQ", href: "#faq" },
  note: "No coding required · Limited to 25 students",
} as const;

export const footer = {
  brand: meta.name,
  tagline: "A 5-day live cohort that takes you from idea to shipped AI product.",
  columns: [
    { title: "Program", links: [
      { label: "Outcomes", href: "#outcomes" },
      { label: "Curriculum", href: "#curriculum" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ]},
    { title: "Apply", links: [
      { label: "Apply Now", href: "#apply" },
      { label: "Reserve a seat", href: "#pricing" },
    ]},
  ],
  legal: "This is a placeholder landing page. Replace copy, instructor details, and testimonials before going live.",
} as const;

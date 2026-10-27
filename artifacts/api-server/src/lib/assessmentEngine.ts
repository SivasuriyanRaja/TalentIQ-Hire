/**
 * assessmentEngine.ts
 *
 * Professional AI Assessment & Evaluation Engine for TalentIQ.
 * Powers dynamic question generation, proctoring evaluation,
 * skill-gap analysis, and intelligent fallback when cloud LLMs
 * are unconfigured or experiencing latency.
 */

import type {
  AssessmentGenerationRequestAssessmentType,
  AssessmentGenerationResponse,
  AssessmentQuestion,
  MatchAnalysisRequest,
  MatchAnalysisResponse,
} from "@workspace/api-zod";

interface QuestionTemplate {
  skills: string[];
  prompt: string;
  options: [string, string, string, string];
  correctAnswer: string;
  explanation: string;
  difficulty: "Easy" | "Medium" | "Hard";
}

// ── Curated Real-World Question Bank ──────────────────────────────────────────

const TECHNICAL_QUESTION_BANK: QuestionTemplate[] = [
  // React & React Native
  {
    skills: ["react", "react native", "frontend", "mobile", "javascript", "typescript"],
    prompt:
      "When optimizing a list with 5,000+ items in a React Native app to eliminate scroll lag, which combination of practices yields the best performance?",
    options: [
      "Use FlashList or FlatList with getItemLayout, removeClippedSubviews, and memoized renderItem",
      "Render all items in a single ScrollView wrapped in React.memo",
      "Map items inside a View with inline key functions and flexWrap: 'wrap'",
      "Increase initialNumToRender to 5,000 so all items pre-render in memory",
    ],
    correctAnswer:
      "Use FlashList or FlatList with getItemLayout, removeClippedSubviews, and memoized renderItem",
    explanation:
      "Virtualization tools recycle cell views and unmount offscreen components. Providing getItemLayout skips dynamic measurements, keeping frame rates at 60 FPS.",
    difficulty: "Medium",
  },
  {
    skills: ["react", "frontend", "typescript", "hooks"],
    prompt:
      "In a React application, you notice an infinite re-render loop inside a component using useEffect. What is the most probable cause?",
    options: [
      "Passing a newly instantiated object or array in the dependency array without useMemo",
      "Calling useState updater function inside an event handler",
      "Using React.StrictMode in production builds",
      "Importing components using React.lazy without Suspense",
    ],
    correctAnswer:
      "Passing a newly instantiated object or array in the dependency array without useMemo",
    explanation:
      "React checks dependency arrays using Object.is. Creating a new object/array literal on each render breaks referential equality, re-triggering useEffect continuously.",
    difficulty: "Easy",
  },
  {
    skills: ["typescript", "javascript", "frontend", "backend"],
    prompt:
      "Which TypeScript utility type allows you to construct a type by picking all properties from Type and then removing Keys?",
    options: [
      "Omit<Type, Keys>",
      "Exclude<Type, Keys>",
      "Pick<Type, Keys>",
      "Extract<Type, Keys>",
    ],
    correctAnswer: "Omit<Type, Keys>",
    explanation:
      "Omit<Type, Keys> constructs a type with all properties of Type except Keys. Exclude is used on union types, while Pick retains only the specified keys.",
    difficulty: "Easy",
  },
  {
    skills: ["react", "react native", "mobile", "state"],
    prompt:
      "When persisting application state in React Native that must survive app termination and work offline, what is the recommended architecture?",
    options: [
      "Zustand or Redux Toolkit paired with AsyncStorage / MMKV with hydration guards",
      "Storing state in global window variables and restoring from document.cookie",
      "Writing raw files synchronously to the app bundle directory on each action",
      "Relying solely on in-memory React Context without storage drivers",
    ],
    correctAnswer:
      "Zustand or Redux Toolkit paired with AsyncStorage / MMKV with hydration guards",
    explanation:
      "Lightweight key-value storage (like MMKV or AsyncStorage) combined with atomic state managers and hydration guards provides instant offline state restoration without blocking the UI thread.",
    difficulty: "Medium",
  },

  // Backend & APIs
  {
    skills: ["node.js", "backend", "express", "apis", "rest", "architecture"],
    prompt:
      "To prevent Node.js Event Loop starvation when handling high volumes of CPU-intensive image or PDF processing, what should you do?",
    options: [
      "Offload CPU-bound processing to Worker Threads or a background task queue (e.g. BullMQ)",
      "Increase the process.maxTickDepth setting in the main thread",
      "Wrap the synchronous calculation in a standard Promise.resolve()",
      "Run the Express listener inside an async while(true) loop",
    ],
    correctAnswer:
      "Offload CPU-bound processing to Worker Threads or a background task queue (e.g. BullMQ)",
    explanation:
      "Node.js runs single-threaded JavaScript execution on its event loop. Wrapping CPU work in a Promise does not make it non-blocking; worker threads or external worker queues prevent loop starvation.",
    difficulty: "Hard",
  },
  {
    skills: ["database", "mongodb", "sql", "backend", "postgresql"],
    prompt:
      "A database query filtering by { status: 'active', createdAt: -1 } is experiencing slow performance as records grow to 2M rows. What index should be created?",
    options: [
      "A compound index on { status: 1, createdAt: -1 }",
      "Two separate single-field indexes on status and createdAt",
      "A sparse unique index on createdAt only",
      "A text search index covering the whole collection",
    ],
    correctAnswer: "A compound index on { status: 1, createdAt: -1 }",
    explanation:
      "Compound indexes following the Equality, Sort, Range (ESR) rule allow the database engine to satisfy both equality filtering and sorted retrieval without in-memory sorting.",
    difficulty: "Medium",
  },
  {
    skills: ["rest", "graphql", "apis", "backend", "architecture"],
    prompt:
      "Which HTTP status code is most appropriate when a client sends a syntactically valid JSON payload, but the business validation fails (e.g., negative salary amount)?",
    options: [
      "422 Unprocessable Entity (or 400 Bad Request with field errors)",
      "404 Not Found",
      "502 Bad Gateway",
      "401 Unauthorized",
    ],
    correctAnswer:
      "422 Unprocessable Entity (or 400 Bad Request with field errors)",
    explanation:
      "422 Unprocessable Entity indicates that the server understands the content type and syntax, but was unable to process the contained semantic instructions.",
    difficulty: "Easy",
  },

  // DevOps & Cloud
  {
    skills: ["docker", "devops", "cloud", "kubernetes", "aws", "ci/cd"],
    prompt:
      "What is the primary benefit of using Multi-Stage Builds in Docker for a production Node.js or Next.js container image?",
    options: [
      "Drastically reduces final image size by discarding build tools and devDependencies",
      "Automatically scales containers across multiple AWS regions",
      "Enables running multiple operating system kernels within a single container",
      "Guarantees 100% zero-downtime rolling deployments without a load balancer",
    ],
    correctAnswer:
      "Drastically reduces final image size by discarding build tools and devDependencies",
    explanation:
      "Multi-stage builds separate the build environment (compilers, devDependencies, test runners) from the runtime environment, resulting in lean, secure production images.",
    difficulty: "Medium",
  },

  // UI/UX & Product Design
  {
    skills: ["product design", "figma", "ui/ux", "design", "prototyping", "research"],
    prompt:
      "According to Nielsen's Usability Heuristics, which principle is violated when a form submits silently without displaying a loading indicator or confirmation feedback?",
    options: [
      "Visibility of system status",
      "Consistency and standards",
      "Match between system and the real world",
      "Flexibility and efficiency of use",
    ],
    correctAnswer: "Visibility of system status",
    explanation:
      "The system should always keep users informed about what is going on, through appropriate feedback within a reasonable time.",
    difficulty: "Easy",
  },
  {
    skills: ["design", "ui/ux", "figma", "product design", "accessibility"],
    prompt:
      "Under WCAG 2.1 AA standards, what is the minimum required color contrast ratio for regular body text (under 18pt)?",
    options: [
      "4.5:1",
      "3.0:1",
      "7.0:1",
      "2.0:1",
    ],
    correctAnswer: "4.5:1",
    explanation:
      "WCAG 2.1 Level AA requires a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text (18pt or 14pt bold).",
    difficulty: "Medium",
  },

  // AI & Machine Learning
  {
    skills: ["python", "machine learning", "ai", "llm", "data"],
    prompt:
      "When building a Retrieval-Augmented Generation (RAG) system, why are document embeddings typically chunked with overlapping windows rather than splitting strictly by character count?",
    options: [
      "To preserve semantic context across sentence and paragraph boundaries",
      "To compress floating-point numbers into 8-bit integers",
      "To circumvent OpenAI API rate limits",
      "To avoid storing vectors in a vector database",
    ],
    correctAnswer:
      "To preserve semantic context across sentence and paragraph boundaries",
    explanation:
      "Chunk overlap prevents sentences or key conceptual transitions from being bisected across chunks, ensuring vector similarity search retrieves complete context.",
    difficulty: "Medium",
  },
];

const APTITUDE_QUESTION_BANK: QuestionTemplate[] = [
  {
    skills: ["aptitude", "logic", "reasoning"],
    prompt:
      "A software service processes requests in batches. Server A processes a batch in 4 hours, and Server B processes the same batch in 6 hours. If both servers work in parallel, how long will it take them to process one batch?",
    options: ["2.4 hours", "2.5 hours", "3.0 hours", "5.0 hours"],
    correctAnswer: "2.4 hours",
    explanation:
      "Combined rate = 1/4 + 1/6 = 5/12 batches per hour. Time required = 1 / (5/12) = 12/5 = 2.4 hours (2 hours 24 minutes).",
    difficulty: "Easy",
  },
  {
    skills: ["aptitude", "logic", "algorithms", "data"],
    prompt:
      "You have an array of 1,000,000 sorted numbers. What is the maximum number of comparisons required to find a target value using Binary Search?",
    options: ["20 comparisons", "1,000 comparisons", "500,000 comparisons", "10 comparisons"],
    correctAnswer: "20 comparisons",
    explanation:
      "Binary search operates in O(log2 N) time. Since 2^19 = 524,288 and 2^20 = 1,048,576, at most 20 comparisons are required.",
    difficulty: "Medium",
  },
  {
    skills: ["aptitude", "problem solving", "critical thinking"],
    prompt:
      "A distributed system requires at least 3 out of 5 cluster nodes to agree to achieve quorum. If each node has an independent 90% availability, what is the primary architectural trade-off of this quorum size?",
    options: [
      "Prevents split-brain partitions while allowing up to 2 node failures",
      "Increases write throughput by 500% compared to a single master",
      "Completely eliminates network latency across data centers",
      "Guarantees zero storage overhead across all replicas",
    ],
    correctAnswer:
      "Prevents split-brain partitions while allowing up to 2 node failures",
    explanation:
      "A majority quorum (3 of 5) ensures that no two independent network partitions can both achieve majority agreement, eliminating split-brain data corruption.",
    difficulty: "Hard",
  },
  {
    skills: ["aptitude", "logic", "probability"],
    prompt:
      "A code review pipeline has two automated linters: Linter X flags 80% of syntax errors, and Linter Y flags 70%. If their detection is independent, what is the probability that an error is caught by at least one linter?",
    options: ["94%", "85%", "75%", "90%"],
    correctAnswer: "94%",
    explanation:
      "P(Missed by both) = (1 - 0.80) * (1 - 0.70) = 0.20 * 0.30 = 0.06 (6%). Therefore, P(Caught by at least one) = 1 - 0.06 = 0.94 (94%).",
    difficulty: "Medium",
  },
  {
    skills: ["aptitude", "logic", "systems"],
    prompt:
      "In an asynchronous messaging queue, the producer generates messages at 150 msgs/sec and a consumer processes 40 msgs/sec. How many consumer instances are required to handle peak load with at least 20% safety margin?",
    options: ["5 consumer instances", "4 consumer instances", "3 consumer instances", "6 consumer instances"],
    correctAnswer: "5 consumer instances",
    explanation:
      "Target capacity with 20% margin = 150 * 1.20 = 180 msgs/sec. Consumers needed = 180 / 40 = 4.5. Rounding up to whole instances gives 5 consumers (providing 200 msgs/sec capacity).",
    difficulty: "Medium",
  },
];

// ── Smart Question Generator ──────────────────────────────────────────────────

function buildCustomQuestion(
  roleTitle: string,
  skill: string,
  difficulty: "Easy" | "Medium" | "Hard",
  index: number,
): AssessmentQuestion {
  const cleanSkill = skill.trim();
  const templates = [
    {
      prompt: `In a production ${roleTitle} role, what is the most effective approach to test and maintain code quality when working with ${cleanSkill}?`,
      options: [
        `Automated unit and integration tests with CI pipeline checks for ${cleanSkill}`,
        `Manual end-to-end testing performed directly in production environments`,
        `Writing code without type checks to maximize rapid feature delivery`,
        `Relying exclusively on customer bug reports before refactoring`,
      ] as [string, string, string, string],
      correctAnswer: `Automated unit and integration tests with CI pipeline checks for ${cleanSkill}`,
      explanation: `Establishing automated test suites and continuous integration checks prevents regressions and ensures robust delivery for ${cleanSkill}.`,
    },
    {
      prompt: `Which principle is critical when designing scalable architecture involving ${cleanSkill} for high availability?`,
      options: [
        `Decoupled modular components with clear error boundaries and observability`,
        `Bundling all business logic into a single monolithic script file`,
        `Disabling logging and monitoring to minimize overhead`,
        `Hardcoding configuration parameters into source files`,
      ] as [string, string, string, string],
      correctAnswer: `Decoupled modular components with clear error boundaries and observability`,
      explanation: `Modularity and observability allow services to scale independently and facilitate rapid debugging under load.`,
    },
    {
      prompt: `When encountering unexpected performance bottlenecks in a service utilizing ${cleanSkill}, what is the recommended diagnostic first step?`,
      options: [
        `Profile execution metrics and query timings using telemetry tools`,
        `Immediately restart the production cluster without investigation`,
        `Disable security and authentication middleware`,
        `Rewrite the entire codebase in a different language without benchmarking`,
      ] as [string, string, string, string],
      correctAnswer: `Profile execution metrics and query timings using telemetry tools`,
      explanation: `Data-driven profiling identifies true bottlenecks (CPU, memory, I/O) before making speculative architectural changes.`,
    },
  ];

  const chosen = templates[index % templates.length];
  return {
    prompt: chosen.prompt,
    options: chosen.options,
    correctAnswer: chosen.correctAnswer,
    explanation: chosen.explanation,
    difficulty,
  };
}

export function generateDynamicAssessment(
  jobTitle: string,
  requiredSkills: string[] = [],
  assessmentType: AssessmentGenerationRequestAssessmentType = "MCQ",
  questionCount: number = 5,
): AssessmentGenerationResponse {
  const safeSkills = Array.isArray(requiredSkills) ? requiredSkills : [];
  const normalizedSkills = safeSkills.map((s) => String(s).toLowerCase().trim());
  const normalizedTitle = String(jobTitle || "").toLowerCase().trim();

  const isAptitude = assessmentType === "APTITUDE";
  const bank = isAptitude ? APTITUDE_QUESTION_BANK : TECHNICAL_QUESTION_BANK;

  // Score questions in bank based on skill/role match
  const scored = bank.map((q) => {
    let score = 0;
    if (isAptitude) return { q, score: 1 };
    for (const skill of q.skills) {
      if (normalizedSkills.some((s) => s.includes(skill) || skill.includes(s))) {
        score += 3;
      }
      if (normalizedTitle.includes(skill)) {
        score += 2;
      }
    }
    return { q, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const selectedQuestions: AssessmentQuestion[] = [];
  const usedPrompts = new Set<string>();

  for (const item of scored) {
    if (selectedQuestions.length >= questionCount) break;
    if (!usedPrompts.has(item.q.prompt)) {
      usedPrompts.add(item.q.prompt);
      selectedQuestions.push({
        prompt: item.q.prompt,
        options: [...item.q.options],
        correctAnswer: item.q.correctAnswer,
        explanation: item.q.explanation,
        difficulty: item.q.difficulty,
      });
    }
  }

  // If still need more questions, synthesize using the role skills
  let skillIdx = 0;
  while (selectedQuestions.length < questionCount) {
    const skill = requiredSkills[skillIdx % Math.max(1, requiredSkills.length)] || "Software Engineering";
    const difficulties: ("Easy" | "Medium" | "Hard")[] = ["Easy", "Medium", "Hard"];
    const diff = difficulties[selectedQuestions.length % 3];
    const custom = buildCustomQuestion(jobTitle, skill, diff, selectedQuestions.length);
    if (!usedPrompts.has(custom.prompt)) {
      usedPrompts.add(custom.prompt);
      selectedQuestions.push(custom);
    }
    skillIdx++;
  }

  const durationMinutes = Math.max(5, Math.min(30, questionCount * 2));
  const title = isAptitude
    ? `${jobTitle} · Problem Solving & Aptitude`
    : `${jobTitle} · Role Skill Assessment`;

  return {
    title,
    durationMinutes,
    questions: selectedQuestions.slice(0, questionCount),
  };
}

// ── Smart Match Analysis Fallback ─────────────────────────────────────────────

export function generateDynamicMatchAnalysis(
  request: MatchAnalysisRequest,
): MatchAnalysisResponse {
  const candidateSkills = new Set(
    request.candidateSkills.map((s) => s.toLowerCase().trim()),
  );
  const requiredSkills = request.requiredSkills.map((s) => s.trim());

  const matched = requiredSkills.filter((req) =>
    candidateSkills.has(req.toLowerCase()),
  );
  const missing = requiredSkills.filter(
    (req) => !candidateSkills.has(req.toLowerCase()),
  );

  const skillMatch = Math.round(
    Math.min(100, Math.max(40, (matched.length / Math.max(1, requiredSkills.length)) * 100)),
  );

  const expTarget = 4; // baseline expected experience
  const expRatio = Math.min(1.2, request.yearsExperience / expTarget);
  const experienceMatch = Math.round(Math.min(100, Math.max(45, expRatio * 85)));

  const roleFit = Math.round((skillMatch * 0.6) + (experienceMatch * 0.4));
  const overallMatch = Math.round((skillMatch * 0.5) + (experienceMatch * 0.3) + (roleFit * 0.2));

  const strengths = [
    matched.length > 0
      ? `Strong foundation in core skills: ${matched.slice(0, 3).join(", ")}`
      : "Solid transferable software problem-solving foundation",
    request.yearsExperience >= 3
      ? `${request.yearsExperience} years of proven hands-on experience`
      : "High learning agility and modern tech stack alignment",
    `Well-suited for the pace and culture at ${request.company}`,
  ];

  const recommendation =
    overallMatch >= 80
      ? `${request.candidateName} exhibits strong technical alignment with the ${request.jobTitle} position at ${request.company}. Demonstrated mastery in ${matched.slice(0, 2).join(" and ") || "key tools"} makes them an immediate high-confidence candidate.`
      : overallMatch >= 65
        ? `${request.candidateName} brings strong core competencies for ${request.jobTitle}. Completing the practice assessment and highlighting recent projects with ${missing[0] || "relevant frameworks"} will solidify their fit.`
        : `${request.candidateName} has relevant transferable experience. We recommend bridging the gap in ${missing.slice(0, 2).join(" & ") || "specialized skills"} to maximize hiring confidence.`;

  return {
    matchScore: overallMatch,
    skillMatch,
    experienceMatch,
    roleFit,
    strengths,
    missingSkills: missing.slice(0, 5),
    recommendation,
  };
}

// ── Assessment Evaluator ──────────────────────────────────────────────────────

export interface EvaluationResult {
  score: number;
  total: number;
  percentage: number;
  readinessRating: "Strong Hire" | "Solid Contender" | "Needs Practice";
  integrityStatus: "Verified Authentic" | "Monitored (Minor Focus Changes)" | "Flagged Review";
  skillsBreakdown: Array<{ skill: string; score: number }>;
  feedback: string;
  strengths: string[];
  growthAreas: string[];
}

export function evaluateAssessment(
  questions: AssessmentQuestion[],
  userAnswers: Record<number, string>,
  focusLosses: number,
  timeSpentSeconds: number,
  jobTitle: string,
): EvaluationResult {
  const total = questions.length;
  let correctCount = 0;
  const incorrectTopics: string[] = [];
  const correctTopics: string[] = [];

  questions.forEach((q, idx) => {
    const isCorrect = userAnswers[idx] === q.correctAnswer;
    if (isCorrect) {
      correctCount++;
      correctTopics.push(q.difficulty);
    } else {
      incorrectTopics.push(q.difficulty);
    }
  });

  const percentage = Math.round((correctCount / Math.max(1, total)) * 100);

  const readinessRating =
    percentage >= 80
      ? "Strong Hire"
      : percentage >= 60
        ? "Solid Contender"
        : "Needs Practice";

  const integrityStatus =
    focusLosses === 0
      ? "Verified Authentic"
      : focusLosses <= 2
        ? "Monitored (Minor Focus Changes)"
        : "Flagged Review";

  const strengths = [
    `Scored ${percentage}% on role-specific competency questions`,
    correctCount > 0 ? "Demonstrated clear grasp of architectural trade-offs" : "Completed the assessment within the designated time limit",
    focusLosses === 0 ? "Zero focus changes during assessment — 100% focused session" : "High perseverance across difficult questions",
  ];

  const growthAreas =
    percentage < 100
      ? [
          "Review question explanations for missed architectural questions",
          "Deepen understanding of edge cases in production scaling",
        ]
      : ["Ready for live technical interview discussions"];

  const feedback =
    percentage >= 80
      ? `Excellent demonstration of domain mastery for ${jobTitle}. The candidate exhibited comprehensive knowledge of best practices and system performance.`
      : percentage >= 60
        ? `Solid foundational grasp of key concepts for ${jobTitle}. With targeted practice on edge cases, this candidate will be well-prepared for technical interviews.`
        : `Demonstrates potential but needs reinforcement in core ${jobTitle} architectural principles. Review the detailed explanations provided below to accelerate growth.`;

  const skillsBreakdown = [
    { skill: "Domain Knowledge", score: percentage },
    { skill: "Problem Solving", score: Math.min(100, percentage + (focusLosses === 0 ? 5 : -5)) },
    { skill: "Focus & Integrity", score: Math.max(40, 100 - focusLosses * 15) },
  ];

  return {
    score: correctCount,
    total,
    percentage,
    readinessRating,
    integrityStatus,
    skillsBreakdown,
    feedback,
    strengths,
    growthAreas,
  };
}

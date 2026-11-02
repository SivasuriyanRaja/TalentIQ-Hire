export type UserRole = 'candidate' | 'recruiter';
export type ApplicationStatus =
  | 'Applied'
  | 'Shortlisted'
  | 'Interview'
  | 'Offer'
  | 'Rejected';

export type WorldRegion = 'India' | 'US' | 'Europe' | 'Global';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  country: 'India' | 'US' | 'UK' | 'Germany' | 'Singapore' | 'Global';
  region: WorldRegion;
  workMode: 'Remote' | 'Hybrid' | 'On-site';
  employment: 'Full-time' | 'Contract';
  salary: string; // Default display
  salaryINR: string; // Formatted in INR (e.g. ₹28 – ₹42 LPA)
  salaryUSD: string; // Formatted in USD (e.g. $140k – $190k)
  posted: string;
  description: string;
  skills: string[];
  color: string;
  department?: string;
  experienceLevel?: 'Entry-level' | 'Mid-level' | 'Senior' | 'Lead / Staff';
  assessmentRequired?: boolean;
  assessmentMinScore?: number;
}

export interface Application {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  appliedAt: string;
  matchScore: number;
}

export interface CandidateProfile {
  name: string;
  headline: string;
  location: string;
  yearsExperience: number;
  skills: string[];
  education: string;
  /** External portfolio or resume URL (backward-compatible) */
  resumeLink: string;
  /** Name of the uploaded resume file (from cloud) */
  resumeFileName?: string;
  /** Size in bytes of the uploaded resume file */
  resumeFileSizeBytes?: number;
  /** AI-extracted skills from the uploaded resume */
  extractedSkills?: string[];
}

export interface AssessmentAttempt {
  id: string;
  jobId: string;
  jobTitle?: string;
  company?: string;
  assessmentTitle?: string;
  score: number;
  total: number;
  percentage?: number;
  focusLosses: number;
  speedAnomalies?: number;
  clipboardViolations?: number;
  proxyRiskScore?: number;
  proxyRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  identityPledgeSigned?: boolean;
  watermarkToken?: string;
  timeSpentSeconds?: number;
  readinessRating?: string;
  integrityStatus?: string;
  feedback?: string;
  skillsBreakdown?: Array<{ skill: string; score: number }>;
  completedAt: string;
}

export const initialProfile: CandidateProfile = {
  name: 'Alex Morgan',
  headline: 'Full Stack & AI Systems Engineer',
  location: 'Bengaluru, India',
  yearsExperience: 4,
  skills: ['React', 'TypeScript', 'Node.js', 'Python', 'PostgreSQL', 'Docker'],
  education: 'B.Tech in Computer Science & Engineering',
  resumeLink: '',
  resumeFileName: undefined,
  resumeFileSizeBytes: undefined,
  extractedSkills: [],
};

export const sampleJobs: Job[] = [
  // ── INDIA TECH COMPANIES & HUBS ──────────────────────────────────────────
  {
    id: 'job-in-razorpay',
    title: 'Senior Full Stack Engineer',
    company: 'Razorpay',
    location: 'Bengaluru, Karnataka',
    country: 'India',
    region: 'India',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '₹28 – ₹42 LPA',
    salaryINR: '₹28 – ₹42 LPA',
    salaryUSD: '$120k – $155k',
    posted: 'Today',
    department: 'Payment Gateway Core',
    experienceLevel: 'Senior',
    description:
      'Architect robust, high-throughput payment checkout infrastructure processing over 10,000 transactions per second. Collaborate with product and risk teams to deliver frictionless checkout experiences across web and mobile platforms.',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'Kafka'],
    color: '#DCEBE3',
    assessmentRequired: true,
    assessmentMinScore: 80,
  },
  {
    id: 'job-in-swiggy',
    title: 'Machine Learning & LLM Systems Engineer',
    company: 'Swiggy',
    location: 'Bengaluru, Karnataka',
    country: 'India',
    region: 'India',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '₹34 – ₹52 LPA',
    salaryINR: '₹34 – ₹52 LPA',
    salaryUSD: '$135k – $170k',
    posted: '1 day ago',
    department: 'AI & Recommendation Labs',
    experienceLevel: 'Senior',
    description:
      'Develop real-time semantic search, automated dish tagging, and GenAI chatbot agents utilizing Retrieval-Augmented Generation (RAG) and open-weights models to supercharge food delivery search and customer care.',
    skills: ['Python', 'PyTorch', 'LLMs', 'RAG', 'Vector DB', 'FastAPI', 'LangChain'],
    color: '#F0E0DF',
    assessmentRequired: true,
    assessmentMinScore: 85,
  },
  {
    id: 'job-in-cred',
    title: 'Senior Backend Engineer (Distributed Systems)',
    company: 'CRED',
    location: 'Bengaluru, Karnataka',
    country: 'India',
    region: 'India',
    workMode: 'On-site',
    employment: 'Full-time',
    salary: '₹38 – ₹58 LPA',
    salaryINR: '₹38 – ₹58 LPA',
    salaryUSD: '$145k – $185k',
    posted: '2 days ago',
    department: 'Financial Platform Core',
    experienceLevel: 'Lead / Staff',
    description:
      'Design mission-critical credit ledger mechanisms and event-driven financial microservices in Go. Solve hard distributed systems problems, including event sourcing, zero-data-loss guarantees, and sub-millisecond p99 latencies.',
    skills: ['Go', 'Distributed Systems', 'Kafka', 'Redis', 'Docker', 'Kubernetes'],
    color: '#E8E3F0',
    assessmentRequired: true,
    assessmentMinScore: 82,
  },
  {
    id: 'job-in-zomato',
    title: 'Lead DevOps & Cloud Platform Architect',
    company: 'Zomato',
    location: 'Gurugram, Delhi NCR',
    country: 'India',
    region: 'India',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '₹36 – ₹55 LPA',
    salaryINR: '₹36 – ₹55 LPA',
    salaryUSD: '$130k – $165k',
    posted: '3 days ago',
    department: 'Infrastructure & SRE',
    experienceLevel: 'Lead / Staff',
    description:
      'Lead our multi-cloud AWS and GCP infrastructure scaling seamlessly for million-order New Year surges. Implement GitOps, Kubernetes clusters, zero-trust IAM, and automated observability pipelines.',
    skills: ['AWS', 'Kubernetes', 'Terraform', 'Docker', 'Prometheus', 'CI/CD'],
    color: '#F3E6DA',
    assessmentRequired: true,
    assessmentMinScore: 78,
  },
  {
    id: 'job-in-phonepe',
    title: 'Senior Mobile Engineer (React Native & Performance)',
    company: 'PhonePe',
    location: 'Bengaluru, Karnataka',
    country: 'India',
    region: 'India',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '₹26 – ₹40 LPA',
    salaryINR: '₹26 – ₹40 LPA',
    salaryUSD: '$110k – $140k',
    posted: 'Today',
    department: 'Consumer Apps',
    experienceLevel: 'Senior',
    description:
      'Craft lightning-fast, secure UPI payment workflows and merchant interactions used daily by over 500 million Indian users. Focus on 60 FPS animations, offline-first caching, and low memory footprint across Android and iOS.',
    skills: ['React Native', 'Expo', 'TypeScript', 'Redux Toolkit', 'Mobile Security'],
    color: '#E7EBDD',
    assessmentRequired: true,
    assessmentMinScore: 80,
  },
  {
    id: 'job-in-flipkart',
    title: 'Data Engineer & Real-Time Streaming',
    company: 'Flipkart',
    location: 'Bengaluru, Karnataka',
    country: 'India',
    region: 'India',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '₹24 – ₹38 LPA',
    salaryINR: '₹24 – ₹38 LPA',
    salaryUSD: '$105k – $135k',
    posted: '4 days ago',
    department: 'Supply Chain Analytics',
    experienceLevel: 'Mid-level',
    description:
      'Construct scalable batch and streaming pipelines tracking tens of millions of package shipments and warehouse routes across India. Model petabyte-scale data lakes with Apache Spark, dbt, and Delta Lake.',
    skills: ['Python', 'SQL', 'PySpark', 'Kafka', 'dbt', 'PostgreSQL', 'Airflow'],
    color: '#F0E7D4',
  },
  {
    id: 'job-in-zoho',
    title: 'Principal Cloud Security & SOC Lead',
    company: 'Zoho',
    location: 'Chennai, Tamil Nadu',
    country: 'India',
    region: 'India',
    workMode: 'On-site',
    employment: 'Full-time',
    salary: '₹28 – ₹45 LPA',
    salaryINR: '₹28 – ₹45 LPA',
    salaryUSD: '$115k – $150k',
    posted: '5 days ago',
    department: 'Information Security',
    experienceLevel: 'Lead / Staff',
    description:
      'Secure global cloud suite operations serving 100M+ corporate accounts. Design intrusion detection systems, perform automated vulnerability assessments, and lead incident response forensics.',
    skills: ['Cybersecurity', 'Linux', 'Network Security', 'IAM', 'SOC', 'Python'],
    color: '#DCEBE3',
  },
  {
    id: 'job-in-freshworks',
    title: 'Senior Frontend Architect (Next.js & Design Systems)',
    company: 'Freshworks',
    location: 'Chennai / Remote · India',
    country: 'India',
    region: 'India',
    workMode: 'Remote',
    employment: 'Full-time',
    salary: '₹25 – ₹38 LPA',
    salaryINR: '₹25 – ₹38 LPA',
    salaryUSD: '$110k – $135k',
    posted: '2 days ago',
    department: 'Freshdesk Product Engineering',
    experienceLevel: 'Senior',
    description:
      'Own the frontend architecture for omnichannel customer ticketing suites. Standardize reusable micro-frontends, accessibility (a11y), and state management across global engineering chapters.',
    skills: ['Next.js', 'React', 'TypeScript', 'TailwindCSS', 'Jest', 'GraphQL'],
    color: '#E8E3F0',
  },
  {
    id: 'job-in-microsoft-india',
    title: 'Software Development Engineer II (SDE-2)',
    company: 'Microsoft India',
    location: 'Hyderabad, Telangana',
    country: 'India',
    region: 'India',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '₹35 – ₹50 LPA',
    salaryINR: '₹35 – ₹50 LPA',
    salaryUSD: '$135k – $165k',
    posted: 'Yesterday',
    department: 'Azure Cloud Platform',
    experienceLevel: 'Mid-level',
    description:
      'Engineer foundational cloud storage, compute management APIs, and resilient telemetry tools powering Microsoft Azure services globally. Collaborate with Redmond and global developer teams.',
    skills: ['C#', '.NET Core', 'Azure', 'Distributed Systems', 'C++', 'Algorithms'],
    color: '#F3E6DA',
    assessmentRequired: true,
    assessmentMinScore: 84,
  },
  {
    id: 'job-in-google-india',
    title: 'Site Reliability & Performance Engineer',
    company: 'Google India',
    location: 'Bengaluru, Karnataka',
    country: 'India',
    region: 'India',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '₹48 – ₹75 LPA',
    salaryINR: '₹48 – ₹75 LPA',
    salaryUSD: '$160k – $210k',
    posted: '3 days ago',
    department: 'Google Cloud SRE',
    experienceLevel: 'Senior',
    description:
      'Ensure high availability and fault-tolerant operation of planet-scale distributed infrastructure. Write software to automate system recovery, manage capacity, and diagnose deep Linux kernel and network bottlenecks.',
    skills: ['Go', 'Python', 'Linux Kernel', 'Kubernetes', 'Networking', 'SRE'],
    color: '#DCEBE3',
    assessmentRequired: true,
    assessmentMinScore: 88,
  },
  {
    id: 'job-in-jio',
    title: 'AI Computer Vision & Multimodal Lead',
    company: 'Jio AI Labs',
    location: 'Mumbai, Maharashtra',
    country: 'India',
    region: 'India',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '₹30 – ₹48 LPA',
    salaryINR: '₹30 – ₹48 LPA',
    salaryUSD: '$120k – $155k',
    posted: '1 week ago',
    department: 'Jio Intelligent Edge',
    experienceLevel: 'Senior',
    description:
      'Deliver cutting-edge edge AI models for real-time video analytics, smart retail checkout, and 5G network telemetry. Optimize transformer vision architectures for on-device NPU acceleration.',
    skills: ['PyTorch', 'Computer Vision', 'OpenCV', 'TensorRT', 'C++', 'Python'],
    color: '#F0E0DF',
  },
  {
    id: 'job-in-postman',
    title: 'Developer Experience & API Tooling Engineer',
    company: 'Postman',
    location: 'Bengaluru / Remote · India',
    country: 'India',
    region: 'India',
    workMode: 'Remote',
    employment: 'Full-time',
    salary: '₹32 – ₹46 LPA',
    salaryINR: '₹32 – ₹46 LPA',
    salaryUSD: '$125k – $155k',
    posted: '4 days ago',
    department: 'Core Postman Client',
    experienceLevel: 'Senior',
    description:
      'Empower 30 million software engineers worldwide. Build intuitive API workspaces, mock servers, automated testing suites, and WebAssembly protocol parsers inside Postman.',
    skills: ['TypeScript', 'Node.js', 'React', 'WebAssembly', 'OpenAPI', 'gRPC'],
    color: '#E7EBDD',
  },

  // ── UNITED STATES TECH GIANTS ─────────────────────────────────────────────
  {
    id: 'job-us-openai',
    title: 'AI Alignment & Reasoning Systems Engineer',
    company: 'OpenAI',
    location: 'San Francisco, CA',
    country: 'US',
    region: 'US',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '$240k – $350k',
    salaryINR: '₹1.9 – ₹2.8 Cr / yr',
    salaryUSD: '$240k – $350k',
    posted: 'Yesterday',
    department: 'Safety & System Alignment',
    experienceLevel: 'Senior',
    description:
      'Research, train, and benchmark steerable AI models and reinforcement learning from human feedback (RLHF) pipelines. Ensure high alignment, honesty, and safety across frontier reasoning systems.',
    skills: ['Python', 'PyTorch', 'RLHF', 'Transformers', 'CUDA', 'Distributed Training'],
    color: '#DCEBE3',
    assessmentRequired: true,
    assessmentMinScore: 90,
  },
  {
    id: 'job-us-stripe',
    title: 'Staff Infrastructure Platform Engineer',
    company: 'Stripe',
    location: 'Seattle, WA / Remote · US',
    country: 'US',
    region: 'US',
    workMode: 'Remote',
    employment: 'Full-time',
    salary: '$210k – $290k',
    salaryINR: '₹1.6 – ₹2.3 Cr / yr',
    salaryUSD: '$210k – $290k',
    posted: 'Today',
    department: 'Developer Infrastructure',
    experienceLevel: 'Lead / Staff',
    description:
      'Build internal developer tools, ephemeral testing sandboxes, and zero-downtime deployment pipelines supporting thousands of daily deploys across Stripe’s global engineering team.',
    skills: ['Go', 'Kubernetes', 'AWS', 'Terraform', 'Observability', 'CI/CD'],
    color: '#E8E3F0',
  },
  {
    id: 'job-us-figma',
    title: 'Lead Design Technologist & Canvas Architect',
    company: 'Figma',
    location: 'San Francisco, CA',
    country: 'US',
    region: 'US',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '$180k – $240k',
    salaryINR: '₹1.4 – ₹1.9 Cr / yr',
    salaryUSD: '$180k – $240k',
    posted: '2 days ago',
    department: 'Web Canvas & Rendering',
    experienceLevel: 'Senior',
    description:
      'Push the boundaries of collaborative web design. Craft ultra-responsive vector graphics rendering using WebAssembly, WebGL, TypeScript, and modern browser standards.',
    skills: ['TypeScript', 'WebGL', 'WebAssembly', 'C++', 'Product Design', 'Figma'],
    color: '#F0E7D4',
  },
  {
    id: 'job-us-databricks',
    title: 'Senior Distributed Database Core Engineer',
    company: 'Databricks',
    location: 'San Francisco, CA / Remote',
    country: 'US',
    region: 'US',
    workMode: 'Remote',
    employment: 'Full-time',
    salary: '$220k – $300k',
    salaryINR: '₹1.7 – ₹2.4 Cr / yr',
    salaryUSD: '$220k – $300k',
    posted: '3 days ago',
    department: 'Lakehouse Engine',
    experienceLevel: 'Senior',
    description:
      'Optimize query execution engines and vectorized data parsers for the Databricks Lakehouse platform. Write clean, concurrent C++ and Scala to process petabytes with minimal memory overhead.',
    skills: ['C++', 'Scala', 'Apache Spark', 'Database Internals', 'SQL', 'Algorithms'],
    color: '#F3E6DA',
  },
  {
    id: 'job-us-vercel',
    title: 'Full Stack Web Performance Specialist',
    company: 'Vercel',
    location: 'Remote · US / Global',
    country: 'US',
    region: 'US',
    workMode: 'Remote',
    employment: 'Full-time',
    salary: '$170k – $230k',
    salaryINR: '₹1.3 – ₹1.8 Cr / yr',
    salaryUSD: '$170k – $230k',
    posted: '4 days ago',
    department: 'Next.js Core',
    experienceLevel: 'Senior',
    description:
      'Work on the edge runtime, server components, and streaming SSR optimizations in Next.js. Build tools that make the entire web faster for millions of developers.',
    skills: ['Next.js', 'React', 'TypeScript', 'Node.js', 'Rust', 'Edge Computing'],
    color: '#E7EBDD',
  },

  // ── EUROPE & UK TECH HUBS ─────────────────────────────────────────────────
  {
    id: 'job-eu-revolut',
    title: 'Senior Core Banking Systems Engineer',
    company: 'Revolut',
    location: 'London, United Kingdom',
    country: 'UK',
    region: 'Europe',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '£95k – £140k',
    salaryINR: '₹1.0 – ₹1.5 Cr / yr',
    salaryUSD: '$125k – $180k',
    posted: 'Today',
    department: 'Payments Core',
    experienceLevel: 'Senior',
    description:
      'Scale Europe’s fastest-growing fintech banking backbone. Build real-time FX currency exchange algorithms, automated fraud monitoring, and SEPA/SWIFT clearing integration.',
    skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Kafka', 'GCP', 'Docker'],
    color: '#DCEBE3',
  },
  {
    id: 'job-eu-spotify',
    title: 'Applied Audio Intelligence & Music Recommendation',
    company: 'Spotify',
    location: 'Stockholm, Sweden / Berlin',
    country: 'Germany',
    region: 'Europe',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '€105k – €150k',
    salaryINR: '₹95L – ₹1.3 Cr / yr',
    salaryUSD: '$115k – $165k',
    posted: '2 days ago',
    department: 'Personalization & AI',
    experienceLevel: 'Senior',
    description:
      'Refine the algorithms that curate Discover Weekly and personalized AI DJ playlists for over 600 million active listeners across the globe.',
    skills: ['Python', 'Machine Learning', 'PyTorch', 'Data Modeling', 'GCP', 'Java'],
    color: '#E8E3F0',
  },
  {
    id: 'job-eu-deepmind',
    title: 'Deep Reinforcement Learning Research Engineer',
    company: 'Google DeepMind',
    location: 'London, United Kingdom',
    country: 'UK',
    region: 'Europe',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '£130k – £195k',
    salaryINR: '₹1.4 – ₹2.1 Cr / yr',
    salaryUSD: '$170k – $250k',
    posted: '3 days ago',
    department: 'Frontier AI Research',
    experienceLevel: 'Senior',
    description:
      'Collaborate with world-leading scientists to invent next-generation reinforcement learning algorithms, tree-search reasoning engines, and autonomous scientific discovery agents.',
    skills: ['Python', 'JAX', 'Reinforcement Learning', 'Algorithms', 'Distributed Compute'],
    color: '#F0E0DF',
  },
  {
    id: 'job-eu-mistral',
    title: 'Open Foundation Model Training Engineer',
    company: 'Mistral AI',
    location: 'Paris, France / Remote · EU',
    country: 'Germany',
    region: 'Europe',
    workMode: 'Remote',
    employment: 'Full-time',
    salary: '€110k – €165k',
    salaryINR: '₹1.0 – ₹1.5 Cr / yr',
    salaryUSD: '$120k – $180k',
    posted: '1 week ago',
    department: 'Pre-training Systems',
    experienceLevel: 'Senior',
    description:
      'Train high-efficiency open and commercial mixture-of-experts (MoE) foundation models. Implement low-level CUDA kernels and distributed cluster parallelisms.',
    skills: ['Python', 'PyTorch', 'CUDA', 'Distributed Systems', 'Transformers'],
    color: '#F3E6DA',
  },
];

export const sampleCandidates = [
  {
    name: 'Jordan Lee',
    title: 'Senior Full Stack Engineer',
    experience: '6 years',
    score: 96,
    skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
    initials: 'JL',
  },
  {
    name: 'Rohan Sharma',
    title: 'Backend Systems & Go Specialist',
    experience: '5 years',
    score: 94,
    skills: ['Go', 'Kafka', 'Redis', 'Kubernetes'],
    initials: 'RS',
  },
  {
    name: 'Priya Patel',
    title: 'Machine Learning & LLM Engineer',
    experience: '4 years',
    score: 91,
    skills: ['Python', 'PyTorch', 'RAG', 'Vector DB'],
    initials: 'PP',
  },
  {
    name: 'Sam Rivera',
    title: 'Lead Mobile Architect',
    experience: '7 years',
    score: 89,
    skills: ['React Native', 'Expo', 'Mobile Security'],
    initials: 'SR',
  },
  {
    name: 'Ananya Verma',
    title: 'Lead Product Designer',
    experience: '8 years',
    score: 88,
    skills: ['Figma', 'Design Systems', 'UI/UX'],
    initials: 'AV',
  },
];

export function estimateMatch(job: Job, skills: string[]): number {
  if (!skills || skills.length === 0) return 60;
  const normalized = new Set(skills.map((skill) => skill.trim().toLowerCase()));
  const overlap = job.skills.filter((skill) =>
    normalized.has(skill.toLowerCase()),
  ).length;
  const base = Math.round((overlap / Math.max(job.skills.length, 1)) * 60);
  return Math.min(98, Math.max(55, 50 + base));
}

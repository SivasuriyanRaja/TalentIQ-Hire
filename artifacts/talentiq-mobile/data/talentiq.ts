export type UserRole = 'candidate' | 'recruiter';
export type ApplicationStatus =
  | 'Applied'
  | 'Shortlisted'
  | 'Interview'
  | 'Offer'
  | 'Rejected';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: 'Remote' | 'Hybrid' | 'On-site';
  employment: 'Full-time' | 'Contract';
  salary: string;
  posted: string;
  description: string;
  skills: string[];
  color: string;
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
  score: number;
  total: number;
  focusLosses: number;
  completedAt: string;
}

export const initialProfile: CandidateProfile = {
  name: 'Alex Morgan',
  headline: 'Product-minded software engineer',
  location: 'San Francisco, CA',
  yearsExperience: 4,
  skills: ['React', 'TypeScript', 'Product Design', 'Node.js'],
  education: 'B.S. Computer Science',
  resumeLink: '',
  resumeFileName: undefined,
  resumeFileSizeBytes: undefined,
  extractedSkills: [],
};

export const sampleJobs: Job[] = [
  {
    id: 'job-aurora',
    title: 'Senior Product Designer',
    company: 'Aurora Labs',
    location: 'San Francisco, CA',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '$145k – $185k',
    posted: '2 days ago',
    description:
      'Shape the next generation of collaboration tools. Partner with product and engineering to take thoughtful, high-craft experiences from early research through launch.',
    skills: ['Product Design', 'Figma', 'Prototyping', 'Research'],
    color: '#DCEBE3',
  },
  {
    id: 'job-northstar',
    title: 'Mobile Engineer',
    company: 'Northstar',
    location: 'Remote · US',
    workMode: 'Remote',
    employment: 'Full-time',
    salary: '$160k – $205k',
    posted: 'Today',
    description:
      'Build polished iOS and Android experiences for a product used by millions. Work in a small, high-trust team with ownership across the stack.',
    skills: ['React Native', 'TypeScript', 'Expo', 'GraphQL'],
    color: '#E8E3F0',
  },
  {
    id: 'job-morrow',
    title: 'Frontend Engineer',
    company: 'Morrow',
    location: 'New York, NY',
    workMode: 'Hybrid',
    employment: 'Full-time',
    salary: '$140k – $180k',
    posted: '3 days ago',
    description:
      'Create fast, accessible interfaces for a modern financial platform. Bring strong product instincts and a love of building for real people.',
    skills: ['React', 'TypeScript', 'Accessibility', 'CSS'],
    color: '#F3E6DA',
  },
  {
    id: 'job-atlas',
    title: 'Full-stack Developer',
    company: 'Atlas Health',
    location: 'Remote · US',
    workMode: 'Remote',
    employment: 'Full-time',
    salary: '$150k – $195k',
    posted: '1 week ago',
    description:
      'Help make healthcare easier to navigate. Ship end-to-end product improvements across our TypeScript and Node platform.',
    skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'React'],
    color: '#E7EBDD',
  },
  {
    id: 'job-summit',
    title: 'Product Designer',
    company: 'Summit Studio',
    location: 'Austin, TX',
    workMode: 'On-site',
    employment: 'Full-time',
    salary: '$125k – $160k',
    posted: '4 days ago',
    description:
      'Join a close-knit team designing tools that help independent businesses grow. Turn customer insight into clear, inviting product experiences.',
    skills: ['Product Design', 'Figma', 'Design Systems', 'Research'],
    color: '#F0E7D4',
  },
  {
    id: 'job-kinetic',
    title: 'AI Product Engineer',
    company: 'Kinetic',
    location: 'Remote · US',
    workMode: 'Remote',
    employment: 'Full-time',
    salary: '$170k – $220k',
    posted: 'Yesterday',
    description:
      'Build useful AI workflows that feel natural inside everyday products. Collaborate closely with design, research, and infrastructure.',
    skills: ['React', 'TypeScript', 'Python', 'LLM APIs'],
    color: '#F0E0DF',
  },
];

export const sampleCandidates = [
  {
    name: 'Jordan Lee',
    title: 'Product Designer',
    experience: '6 years',
    score: 96,
    skills: ['Figma', 'Prototyping', 'Design systems'],
    initials: 'JL',
  },
  {
    name: 'Sam Rivera',
    title: 'UX Engineer',
    experience: '4 years',
    score: 91,
    skills: ['React', 'TypeScript', 'Accessibility'],
    initials: 'SR',
  },
  {
    name: 'Mina Chen',
    title: 'Senior Product Designer',
    experience: '8 years',
    score: 88,
    skills: ['Research', 'Figma', 'Product strategy'],
    initials: 'MC',
  },
];

export function estimateMatch(job: Job, skills: string[]): number {
  const normalized = new Set(skills.map((skill) => skill.trim().toLowerCase()));
  const overlap = job.skills.filter((skill) =>
    normalized.has(skill.toLowerCase()),
  ).length;
  const base = Math.round((overlap / Math.max(job.skills.length, 1)) * 70);
  return Math.min(98, Math.max(54, 54 + base));
}

import { getAuth } from "@clerk/express";
import OpenAI from "openai";
import { Router, type NextFunction, type Request, type Response } from "express";
import type {
  AssessmentGenerationRequest,
  AssessmentGenerationRequestAssessmentType,
  AssessmentGenerationResponse,
  AssessmentQuestion,
  MatchAnalysisRequest,
  MatchAnalysisResponse,
} from "@workspace/api-zod";

const router = Router();
const requestWindowMs = 60_000;
const requestLimit = 15;
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const xkiroBaseUrl = "https://api.xkiro.com/v1";
const xkiroModel = "mistralai/mistral-large-4-0";

function sendError(res: Response, status: number, message: string) {
  return res.status(status).json({ message });
}

function requireSignedIn(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    sendError(res, 401, "Sign in to use TalentIQ AI.");
    return;
  }

  const now = Date.now();
  const current = requestCounts.get(userId);
  if (!current || current.resetAt <= now) {
    requestCounts.set(userId, { count: 1, resetAt: now + requestWindowMs });
    next();
    return;
  }
  if (current.count >= requestLimit) {
    sendError(res, 429, "You’ve reached the short-term AI request limit. Try again in a minute.");
    return;
  }
  current.count += 1;
  next();
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey, baseURL: xkiroBaseUrl }) : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 12);
}

function boundedScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseMatchResult(value: unknown): MatchAnalysisResponse | null {
  if (!isObject(value)) return null;
  const matchScore = boundedScore(value.matchScore);
  const skillMatch = boundedScore(value.skillMatch);
  const experienceMatch = boundedScore(value.experienceMatch);
  const roleFit = boundedScore(value.roleFit);
  if (
    matchScore === null ||
    skillMatch === null ||
    experienceMatch === null ||
    roleFit === null ||
    typeof value.recommendation !== "string"
  ) {
    return null;
  }
  const strengths = readTextList(value.strengths);
  const missingSkills = readTextList(value.missingSkills);
  if (!strengths.length || !value.recommendation.trim()) return null;
  return {
    matchScore,
    skillMatch,
    experienceMatch,
    roleFit,
    strengths,
    missingSkills,
    recommendation: value.recommendation.trim().slice(0, 600),
  };
}

function isQuestionDifficulty(value: unknown): value is AssessmentQuestion["difficulty"] {
  return value === "Easy" || value === "Medium" || value === "Hard";
}

function parseAssessment(
  value: unknown,
  questionCount: number,
): AssessmentGenerationResponse | null {
  if (!isObject(value) || !Array.isArray(value.questions)) return null;
  if (value.questions.length !== questionCount) return null;
  const questions: AssessmentQuestion[] = [];

  for (const question of value.questions) {
    if (
      !isObject(question) ||
      typeof question.prompt !== "string" ||
      typeof question.correctAnswer !== "string" ||
      typeof question.explanation !== "string" ||
      !isQuestionDifficulty(question.difficulty)
    ) {
      return null;
    }
    const options = readTextList(question.options);
    if (
      options.length !== 4 ||
      new Set(options).size !== 4 ||
      !question.prompt.trim() ||
      !options.includes(question.correctAnswer)
    ) {
      return null;
    }
    questions.push({
      prompt: question.prompt.trim().slice(0, 700),
      options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation.trim().slice(0, 500),
      difficulty: question.difficulty,
    });
  }

  const title = typeof value.title === "string" ? value.title.trim().slice(0, 100) : "";
  if (!title) return null;
  const durationMinutes =
    typeof value.durationMinutes === "number" && Number.isFinite(value.durationMinutes)
      ? Math.max(5, Math.min(60, Math.round(value.durationMinutes)))
      : 15;

  return { title, durationMinutes, questions };
}

function parseMatchRequest(body: unknown): MatchAnalysisRequest | null {
  if (!isObject(body)) return null;
  if (
    typeof body.candidateName !== "string" ||
    typeof body.yearsExperience !== "number" ||
    !Number.isFinite(body.yearsExperience) ||
    body.yearsExperience < 0 ||
    body.yearsExperience > 60 ||
    typeof body.jobTitle !== "string" ||
    typeof body.company !== "string" ||
    typeof body.description !== "string" ||
    !Array.isArray(body.candidateSkills) ||
    !Array.isArray(body.requiredSkills) ||
    body.candidateSkills.length > 50 ||
    body.requiredSkills.length > 50 ||
    body.description.length > 6000
  ) {
    return null;
  }
  const candidateSkills = body.candidateSkills.filter(
    (skill): skill is string => typeof skill === "string",
  );
  const requiredSkills = body.requiredSkills.filter(
    (skill): skill is string => typeof skill === "string",
  );
  if (
    candidateSkills.length !== body.candidateSkills.length ||
    requiredSkills.length !== body.requiredSkills.length
  ) {
    return null;
  }
  return {
    candidateName: body.candidateName.trim().slice(0, 120),
    yearsExperience: body.yearsExperience,
    candidateSkills: candidateSkills.map((skill) => skill.trim().slice(0, 100)),
    jobTitle: body.jobTitle.trim().slice(0, 160),
    company: body.company.trim().slice(0, 160),
    description: body.description.trim(),
    requiredSkills: requiredSkills.map((skill) => skill.trim().slice(0, 100)),
  };
}

function isAssessmentType(value: unknown): value is AssessmentGenerationRequestAssessmentType {
  return value === "MCQ" || value === "APTITUDE";
}

function parseAssessmentRequest(body: unknown): AssessmentGenerationRequest | null {
  if (!isObject(body) || !Array.isArray(body.requiredSkills)) return null;
  if (
    typeof body.jobTitle !== "string" ||
    body.jobTitle.trim().length === 0 ||
    body.jobTitle.length > 160 ||
    !isAssessmentType(body.assessmentType) ||
    typeof body.questionCount !== "number" ||
    !Number.isInteger(body.questionCount) ||
    body.questionCount < 3 ||
    body.questionCount > 10 ||
    body.requiredSkills.length > 50
  ) {
    return null;
  }
  const requiredSkills = body.requiredSkills.filter(
    (skill): skill is string => typeof skill === "string",
  );
  if (requiredSkills.length !== body.requiredSkills.length) return null;
  return {
    jobTitle: body.jobTitle.trim(),
    requiredSkills: requiredSkills.map((skill) => skill.trim().slice(0, 100)),
    assessmentType: body.assessmentType,
    questionCount: body.questionCount,
  };
}

async function requestJson(
  client: OpenAI,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  maxTokens: number,
): Promise<unknown> {
  const completion = await client.chat.completions.create({
    model: xkiroModel,
    messages,
    response_format: { type: "json_object" },
    temperature: 0.25,
    max_tokens: maxTokens,
  });
  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("The AI response was empty.");
  return JSON.parse(content) as unknown;
}

router.post("/talentiq/match-analysis", requireSignedIn, async (req, res) => {
  const request = parseMatchRequest(req.body);
  if (!request) {
    sendError(res, 400, "Enter a valid role and candidate skills to analyze.");
    return;
  }
  const client = getOpenAI();
  if (!client) {
    sendError(res, 503, "AI matching is not configured on this server.");
    return;
  }

  try {
    const result = await requestJson(
      client,
      [
        {
          role: "system",
          content:
            "You help candidates understand job fit. Evaluate only evidence in the supplied skills, experience, and role description. Never infer or use protected personal traits. Be candid and specific, avoid guarantees, and provide practical strengths and skill gaps. Return one JSON object with matchScore, skillMatch, experienceMatch, roleFit (integers 0-100), strengths (3 short strings), missingSkills (0-6 strings), and recommendation (one short paragraph).",
        },
        {
          role: "user",
          content: JSON.stringify({
            yearsExperience: request.yearsExperience,
            candidateSkills: request.candidateSkills,
            role: {
              title: request.jobTitle,
              company: request.company,
              description: request.description,
              requiredSkills: request.requiredSkills,
            },
          }),
        },
      ],
      800,
    );
    const response = parseMatchResult(result);
    if (!response) {
      sendError(res, 502, "TalentIQ could not validate the match response. Please try again.");
      return;
    }
    res.json(response);
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: unknown }).status
        : undefined;
    req.log.error({ status }, "TalentIQ match analysis failed");
    sendError(res, 502, "TalentIQ could not complete this analysis. Please try again.");
  }
});

router.post("/talentiq/assessments/generate", requireSignedIn, async (req, res) => {
  const request = parseAssessmentRequest(req.body);
  if (!request) {
    sendError(res, 400, "Choose a role, assessment type, and a question count from 3 to 10.");
    return;
  }
  const client = getOpenAI();
  if (!client) {
    sendError(res, 503, "Assessment generation is not configured on this server.");
    return;
  }

  try {
    const result = await requestJson(
      client,
      [
        {
          role: "system",
          content:
            "Write fair, role-relevant learning assessments. Do not ask trivia or use protected characteristics. Return valid JSON with title, durationMinutes, and a questions array with exactly the requested number of items. Each item must include prompt, exactly four distinct options, correctAnswer (an exact option string), explanation, and difficulty (Easy, Medium, or Hard). Make questions clear and answerable from professional knowledge.",
        },
        {
          role: "user",
          content: JSON.stringify({
            jobTitle: request.jobTitle,
            relevantSkills: request.requiredSkills,
            assessmentType: request.assessmentType,
            questionCount: request.questionCount,
          }),
        },
      ],
      Math.min(3000, request.questionCount * 220),
    );
    const response = parseAssessment(result, request.questionCount);
    if (!response) {
      sendError(res, 502, "TalentIQ could not validate the assessment. Please generate a new one.");
      return;
    }
    res.json(response);
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: unknown }).status
        : undefined;
    req.log.error({ status }, "TalentIQ assessment generation failed");
    sendError(res, 502, "TalentIQ could not generate this assessment. Please try again.");
  }
});

export default router;

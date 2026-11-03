import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z
    .string()
    .regex(/^\d+$/, "PORT must be a number")
    .default("10000")
    .transform((v) => Number(v)),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "CLERK_PUBLISHABLE_KEY is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CORS_ORIGINS: z.string().min(1, "CORS_ORIGINS is required"),
  ALLOW_DEV_AUTH: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

  const problems: string[] = [];
  if (!result.success) {
    for (const issue of result.error.issues) {
      const name = issue.path[0];
      if (typeof name === "string" && !problems.includes(name)) {
        problems.push(name);
      }
    }
  }

  const env = result.success ? result.data : ({} as Env);

  // Production: reject ALLOW_DEV_AUTH even if set
  if (env.NODE_ENV === "production" && env.ALLOW_DEV_AUTH === "true") {
    if (!problems.includes("ALLOW_DEV_AUTH")) problems.push("ALLOW_DEV_AUTH");
  }

  if (problems.length > 0) {
    console.error(
      `Invalid or missing environment variables: ${problems.join(", ")}`,
    );
    process.exit(1);
  }

  return env as Env;
}

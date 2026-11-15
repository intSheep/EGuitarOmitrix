import { z } from "zod";

export const entrySchema = z
  .object({
    id: z.string(),
    page: z.number(),
    title: z.string(),
    durationSeconds: z.number(),
    stage: z.number(),
    kind: z.enum([
      "lesson",
      "backing",
      "demo",
      "followAlong",
      "intro",
      "outro",
      "preparation",
      "outlook",
    ]),
    legacy: z.boolean(),
    exercises: z.array(z.number()),
  })
  .passthrough();
export const courseSchema = z
  .object({
    schemaVersion: z.literal(1),
    bvid: z.literal("BV1FT411Z7iu"),
    entries: z.array(entrySchema),
  })
  .passthrough();
export type Course = z.infer<typeof courseSchema>;
export type Entry = z.infer<typeof entrySchema>;
export const assignmentSchema = z
  .object({
    entryId: z.string(),
    version: z.string(),
    summary: z.string(),
    dailyMinutes: z.number().nullable(),
    tempo: z.string().nullable(),
    evidence: z
      .object({ sha256: z.string(), from: z.number(), to: z.number() })
      .passthrough()
      .optional(),
  })
  .passthrough();
export const assignmentsSchema = z
  .object({
    schemaVersion: z.literal(1),
    version: z.string(),
    items: z.array(assignmentSchema),
  })
  .passthrough();
export type Assignment = z.infer<typeof assignmentSchema>;
export type Assignments = z.infer<typeof assignmentsSchema>;
export const goalSchema = z
  .object({ minutes: z.number().nullable(), bpm: z.number().nullable() })
  .passthrough();
export const goalsSchema = z
  .object({
    weeklySessions: z.number().nullable(),
    lessons: z.record(z.string(), goalSchema),
  })
  .passthrough();
export type Goal = z.infer<typeof goalSchema>;
export type Goals = z.infer<typeof goalsSchema>;
export const outcomeSchema = z.enum([
  "learning",
  "slow",
  "steady",
  "mastered",
  "review",
]);
export type Outcome = z.infer<typeof outcomeSchema>;
export const intervalSchema = z.object({ start: z.number(), end: z.number() });
export const tempoSchema = z.object({ bpm: z.number(), seconds: z.number() });
export const logSchema = z
  .object({
    id: z.string(),
    entryId: z.string(),
    assignmentVersion: z.string(),
    minutes: z.number(),
    practicedAt: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    outcome: outcomeSchema.nullable(),
    bpm: z.number().nullable(),
    note: z.string(),
    nextFocus: z.string(),
    deletedAt: z.string().nullable(),
    source: z.string().optional(),
    seconds: z.number().optional(),
    intervals: z.array(intervalSchema).optional(),
    bpmBasis: z.literal("self-reported-stable").optional(),
    tempoUsage: z.array(tempoSchema).optional(),
    goal: goalSchema.nullable().optional(),
  })
  .passthrough();
export type PracticeLog = z.infer<typeof logSchema>;
export interface SessionDraft {
  id: string;
  entryId: string;
  assignmentVersion: string;
  createdAt: string;
  running: boolean;
  elapsedMs: number;
  intervals: z.infer<typeof intervalSchema>[];
  lastWall: number | null;
  lastMono: number | null;
  reason: string;
  tempoUsage?: z.infer<typeof tempoSchema>[];
  goal?: Goal | null;
  finishing?: boolean;
  review?: { bpm: string | number | null; outcome: Outcome | null };
}
export interface WatchDraft {
  id: string;
  entryId: string;
  startedAt: number;
  endedAt: number | null;
  interrupted?: boolean;
}
export const watchSchema = z
  .object({
    id: z.string(),
    entryId: z.string(),
    startedAt: z.number(),
    endedAt: z.number(),
    seconds: z.number(),
    confirmedAt: z.string(),
    deletedAt: z.string().nullable(),
    interrupted: z.boolean().optional(),
  })
  .passthrough();
export type WatchRecord = z.infer<typeof watchSchema>;
export interface Backup {
  schemaVersion: 1 | 2 | 3;
  app: "EGuitarOmitrix";
  exportedAt?: string;
  logs: PracticeLog[];
  goals?: Goals;
  watches?: WatchRecord[];
}
export type DurationRecord = Pick<
  PracticeLog,
  "minutes" | "practicedAt" | "source" | "intervals" | "deletedAt"
>;
export const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

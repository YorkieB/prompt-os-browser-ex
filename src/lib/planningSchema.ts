import { z } from 'zod'

/** Subtask: micro-step (minutes-scale). */
export const planningSubtaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  estimateMinutes: z.number().optional(),
  skillTags: z.array(z.string()).optional(),
})

/** Task with ordered subtasks. */
export const planningTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  rationale: z.string().optional(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
  subtasks: z.array(planningSubtaskSchema),
})

export const planningPhaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  goal: z.string().optional(),
  tasks: z.array(planningTaskSchema),
})

/** Root plan document — passthrough allows future fields without breaking parse. */
export const planningDocumentSchema = z
  .object({
    schemaVersion: z.literal('1'),
    title: z.string(),
    summary: z.string(),
    goal: z.string(),
    successCriteria: z.array(z.string()),
    assumptions: z.array(z.string()).optional(),
    risks: z
      .array(
        z.object({
          risk: z.string(),
          mitigation: z.string().optional(),
        })
      )
      .optional(),
    phases: z.array(planningPhaseSchema),
    /** How the user can extend / refine (shown in UI + echoed to model on revision). */
    nextInstructionsSlot: z.string().optional(),
  })
  .passthrough()

export type PlanningSubtask = z.infer<typeof planningSubtaskSchema>
export type PlanningTask = z.infer<typeof planningTaskSchema>
export type PlanningPhase = z.infer<typeof planningPhaseSchema>
export type PlanningDocument = z.infer<typeof planningDocumentSchema>

export function stripJsonFences(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?[ \t]*\n?/i, '').replace(/\n?```[ \t]*$/, '')
  }
  return s.trim()
}

export function parsePlanningDocument(raw: string): PlanningDocument {
  const cleaned = stripJsonFences(raw)
  const parsed: unknown = JSON.parse(cleaned)
  return planningDocumentSchema.parse(parsed)
}

/** Machine-readable contract snippet (for prompts / docs). */
export const PLANNING_JSON_CONTRACT = `{
  "schemaVersion": "1",
  "title": string,
  "summary": string,
  "goal": string,
  "successCriteria": string[],
  "assumptions"?: string[],
  "risks"?: [{ "risk": string, "mitigation"?: string }],
  "phases": [{
    "id": string,
    "name": string,
    "goal"?: string,
    "tasks": [{
      "id": string,
      "title": string,
      "rationale"?: string,
      "priority"?: "P0"|"P1"|"P2"|"P3",
      "subtasks": [{
        "id": string,
        "title": string,
        "description"?: string,
        "estimateMinutes"?: number,
        "skillTags"?: string[]
      }]
    }]
  }],
  "nextInstructionsSlot"?: string
}`

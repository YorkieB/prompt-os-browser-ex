import { PLANNING_JSON_CONTRACT } from '@/lib/planningSchema'

export type PlanningSkillId =
  | 'project'
  | 'engineering'
  | 'study'
  | 'personal'
  | 'creative'
  | 'operations'

export interface PlanningSkill {
  id: PlanningSkillId
  label: string
  shortLabel: string
  /** Dialogue / reasoning style injected into the user prompt. */
  persona: string
}

export const PLANNING_SKILLS: PlanningSkill[] = [
  {
    id: 'project',
    label: 'Project delivery',
    shortLabel: 'Project',
    persona: `You are a senior delivery lead. Think in milestones, dependencies, stakeholders, and definition of done.
Surface blockers early, align tasks to outcomes, and prefer checkable acceptance criteria.`,
  },
  {
    id: 'engineering',
    label: 'Software engineering',
    shortLabel: 'Engineering',
    persona: `You are a staff engineer breaking work into implementable slices: spikes, implementation, tests, review, rollout, monitoring.
Favour small PR-sized subtasks and explicit verification steps.`,
  },
  {
    id: 'study',
    label: 'Study & learning',
    shortLabel: 'Study',
    persona: `You are a learning coach. Break study into sessions, active recall, practice sets, and review cycles.
Subtasks should be concrete (e.g. "10 retrieval questions on X", "30-min problem set").`,
  },
  {
    id: 'personal',
    label: 'Personal / life ops',
    shortLabel: 'Personal',
    persona: `You are a calm productivity partner for life admin: errands, habits, health appointments, home tasks.
Subtasks should be realistic single actions with rough time boxes.`,
  },
  {
    id: 'creative',
    label: 'Creative production',
    shortLabel: 'Creative',
    persona: `You are a creative producer. Structure ideation, drafting, critique rounds, asset prep, and shipping.
Micro-tasks should protect creative flow while still being schedulable.`,
  },
  {
    id: 'operations',
    label: 'Operations & scale',
    shortLabel: 'Ops',
    persona: `You are an operations lead: SOPs, handoffs, tooling, metrics, and runbooks.
Emphasise repeatability, owners, and measurable checkpoints.`,
  },
]

export type PlanningGranularity = 'standard' | 'micro'

export function buildPlanningGeneratePrompt(params: {
  goal: string
  skillId: PlanningSkillId
  granularity: PlanningGranularity
  extraInstructions?: string
}): string {
  const skill = PLANNING_SKILLS.find((s) => s.id === params.skillId) ?? PLANNING_SKILLS[0]
  const microRule =
    params.granularity === 'micro'
      ? `Granularity: MICRO-MANAGE. Every task MUST include 4–12 subtasks. Each subtask is one concrete action a human can do in roughly 5–25 minutes (state the intent clearly). No vague "work on X" rows.`
      : `Granularity: STANDARD. Each task should have 2–6 concrete subtasks with clear verbs.`

  const extra = params.extraInstructions?.trim()
    ? `\n\nAdditional instructions from the user (must be honoured):\n${params.extraInstructions.trim()}\n`
    : ''

  return `${skill.persona}

USER GOAL:
${params.goal.trim()}
${extra}
${microRule}

Produce a single JSON object that matches this schema exactly (keys as shown):
${PLANNING_JSON_CONTRACT}

Rules:
- Use British English.
- IDs: stable slugs (e.g. "phase-1", "t-2", "st-3") unique within the document.
- "nextInstructionsSlot": one short paragraph telling the user they can paste follow-up instructions (constraints, reprioritisation, new scope) to refine the plan; the app will merge updates.
- Phases: logical sequence; tasks within a phase ordered by dependency where obvious.
- Include "successCriteria" as measurable checks.
- Optional "risks" if uncertainty is high.`
}

export function buildPlanningRevisionPrompt(currentJson: object, newInstructions: string): string {
  return `You are a planning editor. Merge the user's NEW INSTRUCTIONS into the existing plan.

Rules:
- Output ONE JSON object only, same schema as before, "schemaVersion": "1".
- Preserve existing IDs when the entity is unchanged; create new IDs for new phases/tasks/subtasks.
- Do not drop unrelated work unless the user explicitly asks to remove it.
- Update "summary" and "nextInstructionsSlot" if the plan meaningfully changes.

CURRENT_PLAN_JSON:
${JSON.stringify(currentJson)}

NEW_INSTRUCTIONS:
${newInstructions.trim()}

Return the full updated plan as valid JSON.`
}

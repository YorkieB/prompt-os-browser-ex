import type { PromptOsSchemaCategory } from '@/lib/promptOs/types'

/**
 * Sample `userInputs` + `userRequest` pairs to verify schemas, rendering, and Cursor behaviour.
 * Use with {@link buildInstructionalContract} or load manually in the **Contract** tab.
 */
export interface PromptOsTestFixture {
  readonly id: string
  readonly category: PromptOsSchemaCategory
  /** Short label for UI / docs */
  readonly label: string
  /** Maps `schema.inputs.required` / `optional` string keys */
  readonly userInputs: Record<string, string>
  /** Appended after the rendered contract as `# USER REQUEST` */
  readonly userRequest: string
}

/**
 * One fixture per domain schema, aligned with Nexus spec examples.
 */
export const PROMPT_OS_TEST_FIXTURES: readonly PromptOsTestFixture[] = [
  {
    id: 'research-quantum-networking',
    category: 'research',
    label: 'Research — quantum networking',
    userInputs: {
      topic: 'quantum networking',
      goal: 'explain current limitations',
    },
    userRequest:
      'Summarise the current limitations of quantum networking for an informed non-expert. Cite sources where possible.',
  },
  {
    id: 'coding-python-cli-click',
    category: 'coding',
    label: 'Coding — Python CLI (Click)',
    userInputs: {
      language: 'Python',
      goal: 'build a CLI tool',
      framework: 'Click',
    },
    userRequest:
      'Design a small Python CLI using Click with one subcommand that reads a file path and prints a line count. Include runnable code and brief explanation of design choices.',
  },
  {
    id: 'image-cyberpunk-street',
    category: 'image',
    label: 'Image — cyberpunk street',
    userInputs: {
      subject: 'a cyberpunk street at night',
      style: 'neon noir',
      lighting: 'volumetric fog',
      camera: '35mm lens',
    },
    userRequest:
      'Produce a detailed image-generation prompt (main + negative) suitable for an image model, following the contract structure.',
  },
  {
    id: 'planning-saas-launch',
    category: 'planning',
    label: 'Planning — SaaS launch',
    userInputs: {
      goal: 'launch a new SaaS product',
      timeline: '6 months',
      resources: '3 engineers, 1 designer',
    },
    userRequest:
      'Break the goal into ordered steps with clear tasks. Call out major risks and dependencies.',
  },
  {
    id: 'agents-research-synthesis',
    category: 'agents',
    label: 'Agents — research synthesis',
    userInputs: {
      overall_goal: 'automate research synthesis',
      environment: 'browser + local filesystem',
      tools_available: 'search, summarizer, classifier',
    },
    userRequest:
      'Define a small multi-agent system: system overview, agent list (JSON) with single mandate per agent, and coordination protocols.',
  },
] as const

const fixtureById = new Map<string, PromptOsTestFixture>(
  PROMPT_OS_TEST_FIXTURES.map((f) => [f.id, f])
)

export function getPromptOsTestFixture(id: string): PromptOsTestFixture | undefined {
  return fixtureById.get(id)
}

/** Fixtures for a single category (stable order). */
export function listPromptOsTestFixturesForCategory(
  category: PromptOsSchemaCategory
): readonly PromptOsTestFixture[] {
  return PROMPT_OS_TEST_FIXTURES.filter((f) => f.category === category)
}

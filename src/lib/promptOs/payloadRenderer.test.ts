import { describe, expect, test } from 'vitest'

import { loadSchema } from '@/lib/promptOs/schemaLoader'
import { renderPayload } from '@/lib/promptOs/payloadRenderer'

describe('Nexus payloads', () => {
  test('research payload contains required blocks', () => {
    const schema = loadSchema('research')
    const userRequest = 'Summarize current limitations of quantum networking.'
    const userInputs = {
      topic: 'quantum networking',
      goal: 'Summarize limitations for an informed non-expert.',
    }
    const payload = renderPayload(schema, userRequest, userInputs)

    expect(payload).toContain('INSTRUCTIONAL CONTRACT PAYLOAD')
    expect(payload).toContain('schema_active: true')
    expect(payload).toContain('schema_type: research.schema.v1')
    expect(payload).toContain('# USER REQUEST')
    expect(payload).toContain(userRequest)
    expect(payload).toContain('values:')
    expect(payload).toContain('topic:')
    expect(payload).toContain('quantum networking')
    expect(payload).toContain('goal:')
    expect(payload).toContain('Summarize limitations')
  })

  test('coding payload uses code field', () => {
    const schema = loadSchema('coding')
    const payload = renderPayload(schema, 'Write a CLI tool in Python.')

    expect(payload).toContain('Solution')
    expect(payload).toContain('code')
  })
})

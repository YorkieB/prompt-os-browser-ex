# INSTRUCTIONAL CONTRACT PAYLOAD
schema_active: true
schema_type: {{schema_id}}

thinking:
  role: {{role}}
  tone: {{tone}}
  audience: {{audience}}
  reasoning_style:
{{#each reasoning_style}}
    - {{this}}
{{/each}}

inputs:
  required:
{{#with inputs}}
{{#each required}}
    - {{this}}
{{/each}}
  optional:
{{#each optional}}
    - {{this}}
{{/each}}
{{/with}}
{{#if input_values}}
  values:
{{#each input_values}}
    {{this.key}}: {{{this.yaml}}}
{{/each}}
{{/if}}

structure:
  sections:
{{#each structure.sections}}
    - id: {{id}}
      label: {{label}}
      required: {{required}}
      fields:
{{#each fields}}
        - id: {{id}}
          type: {{type}}
          required: {{required}}
{{/each}}
{{/each}}

rules:
  must_do:
{{#with rules}}
{{#each must_do}}
    - {{this}}
{{/each}}
  must_not_do:
{{#each must_not_do}}
    - {{this}}
{{/each}}
{{/with}}

avoid:
{{#each avoid}}
  - {{this}}
{{/each}}

output_format:
{{#with output_format}}
  type: {{type}}
  enforce_headings: {{enforce_headings}}
  enforce_order: {{enforce_order}}
  enforce_field_labels: {{enforce_field_labels}}
{{/with}}

# USER REQUEST
{{{user_request}}}

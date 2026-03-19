#!/usr/bin/env node
/* eslint-disable sonarjs/cors --
   Local dev server bound to 127.0.0.1. permissive CORS lets the extension side panel POST from a chrome-extension:// origin.
   Do not expose this process on a public interface without restricting Access-Control-Allow-Origin. */
/**
 * Dev-only mock Cursor bridge for Nexus.
 * - POST /v1/send { "message": string } → { "response": string }
 * - First message containing "# USER REQUEST" or "schema_id" → handshake line
 * - Second message → stub execution reply
 *
 * Run: node scripts/prompt-os-cursor-bridge.mjs
 * Configure extension: VITE_PROMPT_OS_CURSOR_BRIDGE_URL=http://127.0.0.1:17373
 */
import http from 'node:http'

const PORT = Number(process.env.PROMPT_OS_BRIDGE_PORT || 17373)
const HOST = process.env.PROMPT_OS_BRIDGE_HOST || '127.0.0.1'

function isLikelyInstructionalContract(message) {
  return (
    message.includes('# USER REQUEST') ||
    (message.includes('schema_id') && message.includes('thinking'))
  )
}

function json(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
  })
  res.end(data)
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    })
    res.end()
    return
  }

  if (req.method !== 'POST' || !req.url?.startsWith('/v1/send')) {
    json(res, 404, { error: 'Not found' })
    return
  }

  const chunks = []
  for await (const c of req) {
    chunks.push(c)
  }
  let body
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    json(res, 400, { error: 'Invalid JSON' })
    return
  }

  if (typeof body?.message !== 'string') {
    json(res, 400, { error: 'Expected { "message": string }' })
    return
  }

  const message = body.message

  if (isLikelyInstructionalContract(message)) {
    json(res, 200, { response: 'Instructional contract loaded.' })
    return
  }

  json(res, 200, {
    response:
      '[mock bridge] Execution step received. Replace this server with your real Cursor bridge.\n\n' +
      'User follow-up was:\n' +
      message.slice(0, 500) +
      (message.length > 500 ? '…' : ''),
  })
})

server.listen(PORT, HOST, () => {
  console.error(`Nexus mock Cursor bridge listening on http://${HOST}:${PORT}/v1/send`)
})

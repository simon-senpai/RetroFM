const { getClient } = require('./client')
const { readTaste } = require('../taste/generate')
const path = require('path')
const fs = require('fs-extra')

const HISTORY_FILE = path.join(__dirname, '../../data/chat-history.json')
const MAX_HISTORY = 20

async function loadHistory() {
  if (await fs.pathExists(HISTORY_FILE)) return fs.readJson(HISTORY_FILE)
  return []
}

async function saveHistory(history) {
  await fs.outputJson(HISTORY_FILE, history.slice(-MAX_HISTORY))
}

async function chat(userMessage, currentQueue) {
  const taste   = await readTaste()
  const history = await loadHistory()
  const ai = await getClient()

  const queueStr = currentQueue?.map(s => `${s.name} — ${s.artist}`).join('\n') || 'nothing queued'

  const messages = [
    {
      role: 'system',
      content: `You are Sine, a female AI radio DJ on RetroFM — the listener's personal radio station. You communicate only in text when chatting (you speak aloud only when introducing new program blocks). Be warm, perceptive, and musically knowledgeable. Keep replies to 2-3 sentences. If the listener asks for a song or mood change, acknowledge it warmly and suggest you'll adjust the queue — respond with a JSON object: { "reply": "...", "queueRequest": { "mood": "...", "count": 5 } }. For general conversation, return { "reply": "..." }. Always return valid JSON.`
    },
    {
      role: 'user',
      content: `Current queue:\n${queueStr}\n\nTaste profile summary:\n${taste?.slice(0,400)}`
    },
    ...history.flatMap(h => [
      { role: 'user', content: h.user },
      { role: 'assistant', content: h.assistant }
    ]),
    { role: 'user', content: userMessage }
  ]

  const res = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.8,
    response_format: { type: 'json_object' },
  })

  const parsed = JSON.parse(res.choices[0].message.content)
  await saveHistory([...history, { user: userMessage, assistant: parsed.reply }])
  return parsed
}

module.exports = { chat, loadHistory }

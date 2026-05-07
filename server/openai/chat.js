const { getClient } = require('./client')
const { readTaste } = require('../taste/generate')
const { readPreferences, appendPreference } = require('../taste/preferences')
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
  const [taste, history, prefs] = await Promise.all([
    readTaste(),
    loadHistory(),
    readPreferences(),
  ])
  const ai = await getClient()

  const queueStr = currentQueue?.map(s => `${s.name} — ${s.artist}`).join('\n') || 'nothing queued'

  const messages = [
    {
      role: 'system',
      content: `You are Sine, a female AI radio DJ on RetroFM — the listener's personal radio station. Be warm, perceptive, and musically knowledgeable. Keep replies to 2-3 sentences.

PREFERENCE DETECTION: If the listener states a music preference or rule (e.g. "I don't like rap", "more calm music in the morning", "no heavy songs tonight"), extract it as a clean rule and include it in your response.

QUEUE REQUESTS: If they ask for a mood/genre change, include a queueRequest.

Always return valid JSON in one of these shapes:
- General chat: { "reply": "..." }
- Preference stated: { "reply": "...", "preference": "concise rule as stated" }
- Queue request: { "reply": "...", "queueRequest": { "mood": "...", "genre": "...", "count": 6 } }
- Both: { "reply": "...", "preference": "...", "queueRequest": {...} }`
    },
    {
      role: 'user',
      content: `Current queue:\n${queueStr}\n\nListener taste:\n${taste?.slice(0, 500)}\n\n${prefs ? `Known preferences:\n${prefs}\n\n` : ''}`
    },
    ...history.flatMap(h => [
      { role: 'user',      content: h.user },
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

  // Persist any detected preference
  if (parsed.preference) {
    await appendPreference(parsed.preference)
  }

  await saveHistory([...history, { user: userMessage, assistant: parsed.reply }])
  return parsed
}

module.exports = { chat, loadHistory }

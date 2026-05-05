const router = require('express').Router()
const { chat } = require('../openai/chat')
const { buildPool } = require('../netease/library')
const { getClient } = require('../openai/client')

router.post('/', async (req, res) => {
  try {
    const { message, currentQueue } = req.body
    const result = await chat(message, currentQueue)
    if (result.queueRequest) {
      const pool = await buildPool()
      result.suggestedSongs = await curateForMood(result.queueRequest, pool)
    }
    res.json(result)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

async function curateForMood({ mood, count }, pool) {
  const ai = await getClient()
  const sample = pool.slice(0, 300).map(s => `${s.id}|${s.name}|${s.artist}`).join('\n')
  const res = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: `Pick ${count} song IDs from the list that match the mood. Return JSON: { "songIds": [...] }`
    }, {
      role: 'user',
      content: `Mood: ${mood}\n\nSongs:\n${sample}`
    }],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  })
  const { songIds } = JSON.parse(res.choices[0].message.content)
  const byId = new Map(pool.map(s => [s.id, s]))
  return songIds.map(id => byId.get(id)).filter(Boolean)
}

module.exports = router

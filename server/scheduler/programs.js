const { getClient } = require('../openai/client')
const { readTaste } = require('../taste/generate')
const { buildPool } = require('../netease/library')
const path = require('path')
const fs = require('fs-extra')

const PROGRAMS_CACHE = path.join(__dirname, '../../data/programs.json')

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

async function generatePrograms() {
  const taste = await readTaste()
  const pool  = await buildPool()

  const sample = pool.slice(0, 400).map(s => `${s.id}|${s.name}|${s.artist}`).join('\n')
  const now = new Date()
  const hour = now.getHours()
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()]

  const ai = await getClient()
  const res = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You are Sine, a female AI radio DJ with a thoughtful, slightly melancholy personality. You know this listener deeply through their taste profile. Generate today's radio program as a JSON object with a "blocks" array. Each block has: name (evocative title, 2-4 words), mood (one short phrase), songIds (array of song IDs from the pool, 5-8 per block). Generate 3-4 blocks appropriate for the current time of day. Return ONLY valid JSON: { "blocks": [...] }`
    }, {
      role: 'user',
      content: `Today is ${dayName}. Current hour: ${hour}:00.\n\nTaste profile:\n${taste}\n\nAvailable songs (id|name|artist):\n${sample}`
    }],
    temperature: 0.8,
    response_format: { type: 'json_object' },
  })

  let blocks
  try {
    const parsed = JSON.parse(res.choices[0].message.content)
    blocks = parsed.blocks || parsed.programs || parsed
    if (!Array.isArray(blocks)) throw new Error('not array')
  } catch(e) {
    throw new Error(`Program JSON parse failed: ${e.message}`)
  }

  const poolById = new Map(pool.map(s => [s.id, s]))
  const hydrated = blocks.map(block => ({
    name: block.name,
    mood: block.mood,
    songs: (block.songIds || []).map(id => poolById.get(id)).filter(Boolean)
  })).filter(b => b.songs.length > 0)

  await fs.outputJson(PROGRAMS_CACHE, { date: todayKey(), blocks: hydrated })
  return hydrated
}

async function getTodayPrograms() {
  if (await fs.pathExists(PROGRAMS_CACHE)) {
    const data = await fs.readJson(PROGRAMS_CACHE)
    if (data.date === todayKey()) return data.blocks
  }
  return generatePrograms()
}

module.exports = { getTodayPrograms, generatePrograms }

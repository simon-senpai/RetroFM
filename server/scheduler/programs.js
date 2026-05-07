const { getClient } = require('../openai/client')
const { readTaste } = require('../taste/generate')
const { readPreferences } = require('../taste/preferences')
const { buildPool } = require('../netease/library')
const path = require('path')
const fs = require('fs-extra')

const PROGRAMS_CACHE = path.join(__dirname, '../../data/programs.json')

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildSample(pool) {
  const played   = pool.filter(s => s.playCount > 0)
  const unplayed = pool.filter(s => s.playCount === 0)
    .sort((a, b) => (b.pop || 0) - (a.pop || 0))

  const anchors     = played.slice(0, 80)
  const rediscovery = shuffle(played.slice(80)).slice(0, 150)
  const exploration = shuffle(unplayed).slice(0, 120)

  return shuffle([...anchors, ...rediscovery, ...exploration])
}

async function _generateOneBlock({ pool, taste, prefs, excludeIds = [] }) {
  const now     = new Date()
  const hour    = now.getHours()
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()]

  const excludeSet = new Set(excludeIds.map(String))
  const filtered   = pool.filter(s => !excludeSet.has(String(s.id)))

  const sample = buildSample(filtered).map(s =>
    `${s.id}|${s.name}|${s.artist}|${s.genre}|${(s.moods||[]).join(',')}|nrg:${s.energy}|${s.language}|${s.year||'?'}|pop:${s.pop||0}|plays:${s.playCount||0}`
  ).join('\n')

  const ai = await getClient()
  const res = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You are Sine, a female AI radio DJ curating a personal radio station. Create one tightly sequenced program block.

Return JSON: { "name": "evocative 2-4 word title", "mood": "one short phrase", "songIds": ["id1","id2",...] }

Rules:
- Exactly one block of 10-15 songs with a coherent emotional arc
- Mood and energy should flow naturally — not jump around
- Use the full metadata: genre, moods, energy (1-5), language, year, pop score, play count

DISCOVERY BALANCE — critical:
  • 4-5 songs with high play counts (plays:50+) — proven favourites, emotional anchors
  • 4-5 songs with low play counts (plays:1-20) — rarely heard; rediscovery
  • 2-3 songs with plays:0 — never heard; judge by pop score and genre fit

The plays:0 songs with high pop scores are prime discovery candidates.
Do NOT default to always high-play-count songs — that makes the station boring.
- Strictly respect the taste profile and explicit user rules
- Opening song sets the emotional tone — choose it deliberately`
    }, {
      role: 'user',
      content: `Today: ${dayName}, ${hour}:00\n\nTaste profile:\n${taste}\n\n${prefs ? `User's explicit rules:\n${prefs}\n\n` : ''}Available songs (id|name|artist|genre|moods|energy|language|year|pop|plays):\n${sample}`
    }],
    temperature: 0.85,
    response_format: { type: 'json_object' },
  })

  let blockData
  try {
    const parsed = JSON.parse(res.choices[0].message.content)
    blockData = parsed.name ? parsed : (parsed.block || parsed.blocks?.[0])
    if (!blockData?.songIds?.length) throw new Error('empty songIds')
  } catch(e) {
    throw new Error(`Block JSON parse failed: ${e.message}`)
  }

  const poolById = new Map(pool.map(s => [String(s.id), s]))
  return {
    name:  blockData.name,
    mood:  blockData.mood,
    songs: (blockData.songIds || []).map(id => poolById.get(String(id))).filter(Boolean)
  }
}

async function generatePrograms() {
  const [taste, pool, prefs] = await Promise.all([readTaste(), buildPool(), readPreferences()])
  const block = await _generateOneBlock({ pool, taste, prefs })
  await fs.outputJson(PROGRAMS_CACHE, { date: todayKey(), blocks: [block] })
  return [block]
}

async function generateNextBlock(excludeIds = []) {
  const [taste, pool, prefs] = await Promise.all([readTaste(), buildPool(), readPreferences()])
  return _generateOneBlock({ pool, taste, prefs, excludeIds })
}

async function getTodayPrograms() {
  if (await fs.pathExists(PROGRAMS_CACHE)) {
    const data = await fs.readJson(PROGRAMS_CACHE)
    if (data.date === todayKey()) return data.blocks
  }
  return generatePrograms()
}

module.exports = { getTodayPrograms, generatePrograms, generateNextBlock }

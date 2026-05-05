const { getClient } = require('../openai/client')
const { getPlayRecord } = require('../netease/library')
const path = require('path')
const fs = require('fs-extra')

const TASTE_FILE = path.join(__dirname, '../../data/taste.md')

async function generateTaste() {
  const { weekly, allTime } = await getPlayRecord()

  const topAll = allTime.slice(0, 80).map(({ song, playCount }) =>
    `${song.name} — ${song.ar?.map(a=>a.name).join(', ')} (played ${playCount}×)`
  ).join('\n')

  const topWeek = weekly.slice(0, 30).map(({ song, playCount }) =>
    `${song.name} — ${song.ar?.map(a=>a.name).join(', ')} (${playCount}× this week)`
  ).join('\n')

  const ai = await getClient()
  const res = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You are a music analyst. Analyse the user's listening history and write a detailed taste profile in markdown. Cover: genres, sub-genres, moods, recurring themes, time-of-day patterns you can infer, decades of music preferred, emotional register, artists that define their taste, what they return to vs what they explore. Write in second person ("You tend to..."). Be specific and evocative, not generic. 400-600 words.`
    }, {
      role: 'user',
      content: `All-time most played:\n${topAll}\n\nThis week:\n${topWeek}`
    }],
    temperature: 0.7,
  })

  const taste = `# taste.md — RetroFM Taste Profile\n_Generated ${new Date().toISOString()}_\n\n${res.choices[0].message.content}`
  await fs.outputFile(TASTE_FILE, taste)
  return taste
}

async function readTaste() {
  if (await fs.pathExists(TASTE_FILE)) return fs.readFile(TASTE_FILE, 'utf8')
  return null
}

module.exports = { generateTaste, readTaste, TASTE_FILE }

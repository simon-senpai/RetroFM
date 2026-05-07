const { getClient } = require('../openai/client')
const { getPlayRecord, buildPool } = require('../netease/library')
const path = require('path')
const fs = require('fs-extra')

const TASTE_FILE = path.join(__dirname, '../../data/taste.md')

async function generateTaste() {
  const [{ weekly, allTime }, pool] = await Promise.all([
    getPlayRecord(),
    buildPool(),
  ])

  const topAll = allTime.slice(0, 100).map(({ song, playCount }) =>
    `${song.name} — ${(song.ar || song.artists || []).map(a => a.name).join(', ')} (×${playCount})`
  ).join('\n')

  const topWeek = weekly.slice(0, 30).map(({ song, playCount }) =>
    `${song.name} — ${(song.ar || song.artists || []).map(a => a.name).join(', ')} (×${playCount} this week)`
  ).join('\n')

  // Genre distribution weighted by play count
  const genreCounts = {}
  pool.slice(0, 400).forEach(s => {
    if (s.genre && s.genre !== 'Unknown') {
      genreCounts[s.genre] = (genreCounts[s.genre] || 0) + Math.max(1, s.playCount || 1)
    }
  })
  const genreLines = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([g, w]) => `  ${g}: ${w} weighted plays`)
    .join('\n')

  // Mood distribution
  const moodCounts = {}
  pool.slice(0, 400).forEach(s => {
    (s.moods || []).forEach(m => {
      moodCounts[m] = (moodCounts[m] || 0) + Math.max(1, s.playCount || 1)
    })
  })
  const moodLines = Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([m, w]) => `  ${m}: ${w}`).join('\n')

  // Year / decade distribution
  const decadeCounts = {}
  pool.slice(0, 400).forEach(s => {
    if (s.year) {
      const decade = `${Math.floor(s.year / 10) * 10}s`
      decadeCounts[decade] = (decadeCounts[decade] || 0) + Math.max(1, s.playCount || 1)
    }
  })
  const decadeLines = Object.entries(decadeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([d, w]) => `  ${d}: ${w}`).join('\n')

  const ai = await getClient()
  const today = new Date().toISOString().slice(0, 10)

  const res = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You are a music analyst. Write a structured taste profile using ONLY the real data provided. Be specific — name actual artists and genres from the data. Do not be generic or make things up. Write in second person ("You…").

Output EXACTLY this markdown structure (fill in each section with real analysis):

# RetroFM Taste Profile
_Generated ${today}_

## Musical Identity
[2-3 sentences capturing the essence of their taste. Reference specific artists or genres from the data. Make it feel personal and accurate.]

## Core Genres
[List 3-6 genres in order of dominance, one per line as "1. GenreName — brief note on how they engage with it"]

## Avoided / Rare Genres
[Bullet list of genres absent or very rare in their library. Be specific — if Hip-hop is genuinely absent, say so.]

## Mood Palette
**Dominant**: [2-4 moods they clearly gravitate toward]
**Occasional**: [1-3 moods that appear sometimes]
**Absent**: [moods/vibes clearly not in their library]

## Energy Profile
[One sentence: do they prefer calm, medium, or high energy? Note any exceptions.]

## Time-of-Day Fit
- **Morning**: [what genre/energy/mood suits their taste for mornings]
- **Afternoon**: [smooth? focused? specific genres that fit]
- **Evening**: [emotional? wind-down? what fits]
- **Late night**: [introspective? melancholic?]

## Defining Artists
[List 8-12 actual artists from the data, one per line as "- ArtistName (pinyin if Chinese) — genre, typical mood"]

## Language Mix
[What proportion is Chinese vs English vs other languages. Note if they strongly prefer one.]

## Explicit Rules
[Leave this section with just the header — rules will be added during sessions]`
    }, {
      role: 'user',
      content: `All-time most played (top 100):\n${topAll || '(no data)'}\n\nThis week (top 30):\n${topWeek || '(no data)'}\n\nGenre distribution (weighted by plays):\n${genreLines || '(no data)'}\n\nMood distribution:\n${moodLines || '(no data)'}\n\nDecade distribution:\n${decadeLines || '(no data)'}`
    }],
    temperature: 0.5,
  })

  const taste = res.choices[0].message.content
  await fs.outputFile(TASTE_FILE, taste)
  return taste
}

async function readTaste() {
  if (await fs.pathExists(TASTE_FILE)) return fs.readFile(TASTE_FILE, 'utf8')
  return null
}

module.exports = { generateTaste, readTaste, TASTE_FILE }

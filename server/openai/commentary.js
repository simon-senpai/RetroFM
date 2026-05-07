const { getClient } = require('./client')
const { readTaste } = require('../taste/generate')

async function generateCommentary(block, song) {
  const taste = await readTaste()
  const ai    = await getClient()
  const now   = new Date()
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()]

  // Give Sine the full block tracklist so she actually knows what she's introducing
  const tracklist = (block.songs || []).slice(0, 8)
    .map((s, i) => `${i+1}. ${s.name} — ${s.artist}${s.genre ? ` [${s.genre}]` : ''}`)
    .join('\n')

  const res = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You are Sine, a female AI radio DJ. Thoughtful, slightly melancholy, knowledgeable about music. Introduce this program block to the listener. Speak directly in second person. Reference the time, the mood of the block, and what the music will feel like. Be evocative and specific — you know exactly what songs are coming. 60-90 words for the spoken intro. Also generate a poetic episode title (3-5 words) that captures this musical moment.

CRITICAL: The script will be read aloud by a TTS engine. Write entirely in English. For any Chinese song or artist names, use pinyin romanization (e.g. 薛之谦 → Xue Zhiqian). Never include Chinese characters or non-Latin script.

Return JSON: { "episodeTitle": "...", "script": "..." }`
    }, {
      role: 'user',
      content: `Time: ${timeStr} on ${dayName}
Block: "${block.name}" — ${block.mood}
Opening song: "${song.name}" by ${song.artist}

Full tracklist:
${tracklist}

Listener taste (brief):
${taste?.slice(0, 600)}`
    }],
    temperature: 0.85,
    response_format: { type: 'json_object' },
  })

  return JSON.parse(res.choices[0].message.content)
}

module.exports = { generateCommentary }

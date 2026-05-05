const { getClient } = require('./client')
const { readTaste } = require('../taste/generate')

async function generateCommentary(block, song) {
  const taste = await readTaste()
  const ai = await getClient()
  const now = new Date()
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()]

  const res = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You are Sine, a female AI radio DJ. Thoughtful, slightly melancholy, knowledgeable about music. You are introducing a new program block on RetroFM — the listener's personal radio station. Speak directly to them in second person. Reference the time and mood. Be evocative, not generic. 60-90 words for the spoken intro. Also generate a poetic episode title (3-5 words) that names this musical moment — not the song title, but what this moment feels like. Return JSON: { "episodeTitle": "...", "script": "..." }`
    }, {
      role: 'user',
      content: `Time: ${timeStr} on ${dayName}.\nProgram block: "${block.name}" — ${block.mood}\nOpening song: "${song.name}" by ${song.artist}\n\nListener taste:\n${taste?.slice(0, 800)}`
    }],
    temperature: 0.85,
    response_format: { type: 'json_object' },
  })

  return JSON.parse(res.choices[0].message.content)
}

module.exports = { generateCommentary }

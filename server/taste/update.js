const { getClient } = require('../openai/client')
const { readTaste, TASTE_FILE } = require('./generate')
const { getPlayRecord } = require('../netease/library')
const path = require('path')
const fs = require('fs-extra')

const UPDATE_LOG = path.join(__dirname, '../../data/taste-updates.json')

async function applySessionSignals(signals) {
  const current = await readTaste()
  if (!current) return

  const ai = await getClient()
  const res = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You maintain a music taste profile. Given session signals, write a brief (1-2 sentence) addendum to append to the profile. Focus only on what's new or surprising — don't repeat existing content. Return JSON: { "addendum": "..." }`
    }, {
      role: 'user',
      content: `Current profile:\n${current.slice(0,600)}\n\nSession signals:\nLiked: ${JSON.stringify(signals.liked)}\nSkipped: ${JSON.stringify(signals.skipped)}\nChat topics: ${JSON.stringify(signals.chatTopics)}`
    }],
    temperature: 0.6,
    response_format: { type: 'json_object' },
  })

  const { addendum } = JSON.parse(res.choices[0].message.content)
  if (!addendum) return

  const updated = current + `\n\n## ${new Date().toISOString().slice(0,10)} update\n${addendum}`
  await fs.outputFile(TASTE_FILE, updated)

  const log = await fs.pathExists(UPDATE_LOG) ? await fs.readJson(UPDATE_LOG) : []
  log.push({ date: new Date().toISOString(), addendum })
  await fs.outputJson(UPDATE_LOG, log.slice(-50))
}

async function weeklyRefresh() {
  const { weekly } = await getPlayRecord()
  const current = await readTaste()

  const weekStr = weekly.slice(0, 30).map(({ song, playCount }) =>
    `${song.name} — ${song.ar?.map(a=>a.name).join(', ')} (${playCount}×)`
  ).join('\n')

  const ai = await getClient()
  const res = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You maintain a music taste profile. Given this week's listening vs the existing profile, identify any drift or evolution. Add a dated section noting what shifted. 2-3 sentences max. Return JSON: { "weekNote": "..." }`
    }, {
      role: 'user',
      content: `Existing profile:\n${current?.slice(0,600)}\n\nThis week's top plays:\n${weekStr}`
    }],
    temperature: 0.6,
    response_format: { type: 'json_object' },
  })

  const { weekNote } = JSON.parse(res.choices[0].message.content)
  if (!weekNote) return

  const updated = (current || '') + `\n\n## Week of ${new Date().toISOString().slice(0,10)}\n${weekNote}`
  await fs.outputFile(TASTE_FILE, updated)
}

module.exports = { applySessionSignals, weeklyRefresh }

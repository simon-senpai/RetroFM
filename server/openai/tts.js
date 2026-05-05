const { getClient } = require('./client')
const path = require('path')
const fs = require('fs-extra')

const TTS_DIR = path.join(__dirname, '../../data/tts')

async function synthesise(text, filename) {
  await fs.ensureDir(TTS_DIR)
  const outPath = path.join(TTS_DIR, filename)

  const ai = await getClient()
  const mp3 = await ai.audio.speech.create({
    model: 'tts-1-hd',
    voice: 'shimmer',
    input: text,
  })

  const buffer = Buffer.from(await mp3.arrayBuffer())
  await fs.outputFile(outPath, buffer)
  return `/api/tts/${filename}`
}

module.exports = { synthesise }

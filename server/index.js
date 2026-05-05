const express = require('express')
const path = require('path')
const fs = require('fs-extra')

const DATA_DIR = path.join(__dirname, '../data')

async function startServer() {
  await fs.ensureDir(DATA_DIR)

  const app = express()
  app.use(express.json())

  // Serve renderer static files
  app.use(express.static(path.join(__dirname, '../renderer')))

  // Serve TTS audio files
  app.use('/api/tts', express.static(path.join(DATA_DIR, 'tts')))

  // Health check
  app.get('/api/health', (req, res) => res.json({ ok: true }))

  // Routes
  app.use('/api/auth',       require('./routes/auth'))
  app.use('/api/config',     require('./routes/config'))
  app.use('/api/library',    require('./routes/library'))
  app.use('/api/player',     require('./routes/player'))
  app.use('/api/programs',   require('./routes/programs'))
  app.use('/api/commentary', require('./routes/commentary'))
  app.use('/api/chat',       require('./routes/chat'))
  app.use('/api/taste',      require('./routes/taste'))

  // Weekly taste refresh — runs at server start if >7 days since last update
  scheduleWeeklyTaste()

  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      console.log(`RetroFM server on port ${port}`)
      resolve(port)
    })
  })
}

async function scheduleWeeklyTaste() {
  try {
    const { readTaste } = require('./taste/generate')
    const { weeklyRefresh } = require('./taste/update')
    const taste = await readTaste()
    if (!taste) return
    const match = taste.match(/## Week of (\d{4}-\d{2}-\d{2})/)
    const lastWeek = match ? new Date(match[1]) : new Date(0)
    const daysSince = (Date.now() - lastWeek) / 86400000
    if (daysSince >= 7) weeklyRefresh().catch(e => console.warn('Weekly taste refresh failed:', e.message))
  } catch(e) {
    // taste.md not ready yet — skip
  }
}

module.exports = { startServer }

const express = require('express')
const path = require('path')
const fs = require('fs-extra')

const DATA_DIR = path.join(__dirname, '../data')

async function startServer() {
  await fs.ensureDir(DATA_DIR)

  const app = express()
  app.use(express.json())

  // Serve renderer
  app.use(express.static(path.join(__dirname, '../renderer')))

  // Health check
  app.get('/api/health', (req, res) => res.json({ ok: true }))

  app.use('/api/auth',       require('./routes/auth'))
  app.use('/api/library',    require('./routes/library'))
  app.use('/api/player',     require('./routes/player'))
  app.use('/api/programs',   require('./routes/programs'))
  app.use('/api/commentary', require('./routes/commentary'))
  app.use('/api/chat',       require('./routes/chat'))

  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      console.log(`RetroFM server on port ${port}`)
      resolve(port)
    })
  })
}

module.exports = { startServer }

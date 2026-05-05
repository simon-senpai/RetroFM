const router = require('express').Router()
const { loadConfig, saveConfig } = require('../netease/client')
const { resetClient } = require('../openai/client')

router.get('/', async (req, res) => {
  const config = await loadConfig()
  res.json({ openaiKey: !!config.openaiKey }) // never send key to renderer
})

router.post('/', async (req, res) => {
  const { openaiKey } = req.body
  if (openaiKey) {
    await saveConfig({ openaiKey })
    resetClient() // invalidate cached OpenAI client when key changes
  }
  res.json({ ok: true })
})

module.exports = router

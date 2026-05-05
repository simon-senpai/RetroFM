const router = require('express').Router()
const { generateTaste, readTaste } = require('../taste/generate')
const { applySessionSignals } = require('../taste/update')

router.get('/', async (req, res) => {
  const taste = await readTaste()
  res.json({ exists: !!taste, taste })
})

router.post('/generate', async (req, res) => {
  try {
    const taste = await generateTaste()
    res.json({ ok: true, taste })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/session', require('express').raw({ type: '*/*' }), async (req, res) => {
  try {
    const signals = JSON.parse(req.body.toString())
    await applySessionSignals(signals)
    res.json({ ok: true })
  } catch(e) {
    res.json({ ok: false })
  }
})

module.exports = router

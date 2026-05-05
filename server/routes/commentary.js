const router = require('express').Router()
const { generateCommentary } = require('../openai/commentary')
const { synthesise } = require('../openai/tts')

router.post('/generate', async (req, res) => {
  try {
    const { block, song } = req.body
    const { episodeTitle, script } = await generateCommentary(block, song)
    const filename = `commentary-${Date.now()}.mp3`
    const audioUrl = await synthesise(script, filename)
    res.json({ episodeTitle, script, audioUrl })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router

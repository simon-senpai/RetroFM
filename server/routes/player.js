const router = require('express').Router()
const { song_url, like } = require('NeteaseCloudMusicApi')
const { getCookie } = require('../netease/client')

router.get('/url/:id', async (req, res) => {
  try {
    const cookie = getCookie()
    const { data } = await song_url({ id: req.params.id, cookie })
    const url = data?.[0]?.url
    if (!url) return res.status(404).json({ error: 'No URL for this track' })
    res.json({ url })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/like', async (req, res) => {
  try {
    const { id, liked } = req.body
    const cookie = getCookie()
    await like({ id, like: liked, cookie })
    res.json({ ok: true })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router

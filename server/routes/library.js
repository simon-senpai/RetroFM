const router = require('express').Router()
const { buildPool, getPlayRecord } = require('../netease/library')

router.get('/pool', async (req, res) => {
  try {
    const songs = await buildPool()
    res.json({ count: songs.length, songs })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/record', async (req, res) => {
  try {
    const record = await getPlayRecord()
    res.json(record)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router

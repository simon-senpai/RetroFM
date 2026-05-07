const router = require('express').Router()
const { getTodayPrograms, generatePrograms, generateNextBlock } = require('../scheduler/programs')

router.get('/today', async (req, res) => {
  try {
    const blocks = await getTodayPrograms()
    res.json({ blocks })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/refresh', async (req, res) => {
  try {
    const blocks = await generatePrograms()
    res.json({ blocks })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/next', async (req, res) => {
  try {
    const { excludeIds = [] } = req.body
    const block = await generateNextBlock(excludeIds)
    res.json({ block })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router

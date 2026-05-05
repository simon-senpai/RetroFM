const router = require('express').Router()
const { getQrKey, getQrImage, checkQr } = require('../netease/auth')
const { isLoggedIn, getUid, loadSession } = require('../netease/client')

router.get('/status', async (req, res) => {
  await loadSession()
  res.json({ loggedIn: isLoggedIn(), uid: getUid() })
})

router.get('/qr-key', async (req, res) => {
  try {
    const key = await getQrKey()
    const img = await getQrImage(key)
    res.json({ key, img })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/qr-check/:key', async (req, res) => {
  try {
    const result = await checkQr(req.params.key)
    res.json(result)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router

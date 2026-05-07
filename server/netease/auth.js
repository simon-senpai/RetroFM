const {
  login_qr_key,
  login_qr_create,
  login_qr_check,
  login_status,
} = require('NeteaseCloudMusicApi')
const { saveSession } = require('./client')

async function getQrKey() {
  const res = await login_qr_key({ timestamp: Date.now() })
  return res.body.data.unikey
}

async function getQrImage(key) {
  const res = await login_qr_create({ key, qrimg: true, timestamp: Date.now() })
  return res.body.data.qrimg
}

// Returns: { status: 'pending' | 'scanned' | 'confirmed' | 'expired' }
async function checkQr(key) {
  const res = await login_qr_check({ key, timestamp: Date.now() })
  // 800 = expired, 801 = waiting, 802 = scanned, 803 = confirmed
  const code = res.body.code
  if (code === 803) {
    const cookie = res.body.cookie || res.cookie
    const statusRes = await login_status({ cookie })
    const uid = statusRes.body?.data?.profile?.userId ?? statusRes.body?.profile?.userId
    await saveSession(cookie, uid)
    return { status: 'confirmed', uid }
  }
  if (code === 802) return { status: 'scanned' }
  if (code === 800) return { status: 'expired' }
  return { status: 'pending' }
}

module.exports = { getQrKey, getQrImage, checkQr }

const {
  login_qr_key,
  login_qr_create,
  login_qr_check,
  login_status,
} = require('NeteaseCloudMusicApi')
const { saveSession } = require('./client')

async function getQrKey() {
  const { data } = await login_qr_key({ timestamp: Date.now() })
  return data.unikey
}

async function getQrImage(key) {
  const { data } = await login_qr_create({ key, qrimg: true, timestamp: Date.now() })
  return data.qrimg
}

// Returns: { status: 'pending' | 'scanned' | 'confirmed' | 'expired' }
async function checkQr(key) {
  const res = await login_qr_check({ key, timestamp: Date.now() })
  // 800 = expired, 801 = waiting, 802 = scanned, 803 = confirmed
  if (res.code === 803) {
    const cookie = res.cookie
    const statusRes = await login_status({ cookie })
    const uid = statusRes.data?.profile?.userId
    await saveSession(cookie, uid)
    return { status: 'confirmed', uid }
  }
  if (res.code === 802) return { status: 'scanned' }
  if (res.code === 800) return { status: 'expired' }
  return { status: 'pending' }
}

module.exports = { getQrKey, getQrImage, checkQr }

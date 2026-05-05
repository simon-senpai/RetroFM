const path = require('path')
const fs = require('fs-extra')

const SESSION_FILE = path.join(__dirname, '../../data/.session')
const CONFIG_FILE  = path.join(__dirname, '../../data/config.json')

let _cookie = ''
let _uid = null

async function loadSession() {
  if (await fs.pathExists(SESSION_FILE)) {
    const s = await fs.readJson(SESSION_FILE)
    _cookie = s.cookie || ''
    _uid    = s.uid    || null
  }
}

async function saveSession(cookie, uid) {
  _cookie = cookie
  _uid    = uid
  await fs.outputJson(SESSION_FILE, { cookie, uid })
}

function getCookie() { return _cookie }
function getUid()    { return _uid }
function isLoggedIn() { return !!_uid }

async function loadConfig() {
  if (await fs.pathExists(CONFIG_FILE)) return fs.readJson(CONFIG_FILE)
  return {}
}

async function saveConfig(data) {
  const existing = await loadConfig()
  await fs.outputJson(CONFIG_FILE, { ...existing, ...data })
}

module.exports = { loadSession, saveSession, getCookie, getUid, isLoggedIn, loadConfig, saveConfig }

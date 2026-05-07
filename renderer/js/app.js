document.addEventListener('DOMContentLoaded', async () => {
  Clock.init()
  Waveform.build('dj-waveform', 90)
  Waveform.buildStatic('song-waveform', 100)

  try {
    const [authRes, configRes] = await Promise.all([
      API.get('/api/auth/status'),
      API.get('/api/config')
    ])

    if (!configRes.openaiKey) {
      showApiKeyStep()
    } else if (!authRes.loggedIn) {
      showQrStep()
    } else {
      startStation()
    }
  } catch(e) {
    showApiKeyStep()
  }
})

function showView(id) {
  ['view-onboarding','view-station','view-speaking'].forEach(v => {
    document.getElementById(v).classList.remove('active')
  })
  document.getElementById(id).classList.add('active')
}

function showApiKeyStep() {
  showView('view-onboarding')
  document.getElementById('onboarding-content').innerHTML = `
    <div class="onboard-step">
      <div class="onboard-title">Welcome to RetroFM</div>
      <div class="onboard-sub">Enter your OpenAI API key. It's stored locally and never leaves your machine.</div>
      <input class="onboard-input" id="api-key-input" type="password" placeholder="sk-...">
      <button class="onboard-btn" id="api-key-save">Continue →</button>
    </div>
  `
  document.getElementById('api-key-save').onclick = async () => {
    const key = document.getElementById('api-key-input').value.trim()
    if (!key.startsWith('sk-')) return
    await API.post('/api/config', { openaiKey: key })
    showQrStep()
  }
}

let _qrPollInterval = null

function showQrStep() {
  showView('view-onboarding')
  document.getElementById('onboarding-content').innerHTML = `
    <div class="onboard-step">
      <div class="onboard-title">Connect NetEase Music</div>
      <div class="onboard-sub">Scan with the NetEase Music app on your phone.</div>
      <img id="qr-image" src="" alt="QR Code">
      <div id="qr-status">Waiting for scan...</div>
    </div>
  `
  loadQr()
}

async function loadQr() {
  try {
    const { key, img } = await API.get('/api/auth/qr-key')
    document.getElementById('qr-image').src = img
    clearInterval(_qrPollInterval)
    _qrPollInterval = setInterval(async () => {
      const { status } = await API.get(`/api/auth/qr-check/${key}`)
      const statusEl = document.getElementById('qr-status')
      if (!statusEl) { clearInterval(_qrPollInterval); return }
      if (status === 'scanned') statusEl.textContent = 'Scanned — confirm in app...'
      if (status === 'expired') { statusEl.textContent = 'Expired — reloading...'; loadQr() }
      if (status === 'confirmed') {
        clearInterval(_qrPollInterval)
        statusEl.textContent = '✓ Connected!'
        statusEl.className = 'qr-status confirmed'
        setTimeout(startStation, 1200)
      }
    }, 2000)
  } catch(e) {
    console.error('QR load failed:', e.message)
  }
}

async function startStation() {
  showView('view-station')
  document.getElementById('btn-login').textContent = '✓ NetEase'
  document.getElementById('btn-login').classList.add('logged-in')
  document.getElementById('btn-refresh').addEventListener('click', () => Station.refresh())
  await Station.init()
}

window.addEventListener('beforeunload', () => {
  const signals = Player._getSignals()
  if (signals.liked.length || signals.skipped.length) {
    navigator.sendBeacon('/api/taste/session', JSON.stringify(signals))
  }
})

window.App = { showView, startStation }

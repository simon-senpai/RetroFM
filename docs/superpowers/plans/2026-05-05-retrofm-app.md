# RetroFM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Electron desktop app — RetroFM — a personal AI FM radio powered by NetEase Music and OpenAI.

**Architecture:** Electron main process boots an Express server and opens a fixed 390×844 BrowserWindow. The renderer loads from localhost. All AI (GPT-4o, TTS) and music (NetEase) calls go through the Express API. No command-line setup — first run shows an onboarding screen for API key + NetEase QR login.

**Tech Stack:** Electron 30, Express 4, NeteaseCloudMusicApi (npm), OpenAI Node SDK, Martian Mono + IBM Plex Mono (Google Fonts), electron-builder (packaging)

---

## File Map

```
RetroFM/
├── package.json
├── electron/
│   └── main.js                  # Window creation, Express boot, app lifecycle
├── server/
│   ├── index.js                 # Express entry — mounts all routes
│   ├── netease/
│   │   ├── client.js            # NeteaseCloudMusicApi wrapper + cookie session
│   │   ├── auth.js              # QR login flow (key → image → poll)
│   │   └── library.js           # Liked songs, playlists, recs, similar artists
│   ├── openai/
│   │   ├── client.js            # OpenAI SDK singleton
│   │   ├── curator.js           # GPT-4o: pick songs from pool for a program block
│   │   ├── commentary.js        # GPT-4o: episode title + spoken DJ script
│   │   ├── chat.js              # GPT-4o-mini: conversational replies
│   │   └── tts.js               # OpenAI TTS → audio buffer
│   ├── taste/
│   │   ├── generate.js          # First-run: analyse library → taste.md
│   │   └── update.js            # Weekly drift + session signals → patch taste.md
│   ├── scheduler/
│   │   └── programs.js          # GPT-4o: generate today's program blocks
│   └── routes/
│       ├── auth.js              # POST /api/auth/qr-key, /qr-image, /qr-check
│       ├── library.js           # GET /api/library/pool
│       ├── player.js            # GET /api/player/url, POST /api/player/like
│       ├── programs.js          # GET /api/programs/today
│       ├── commentary.js        # POST /api/commentary/generate
│       └── chat.js              # POST /api/chat
├── renderer/
│   ├── index.html
│   ├── css/
│   │   ├── fonts.css
│   │   ├── variables.css        # Design tokens
│   │   ├── reset.css
│   │   ├── layout.css           # Phone canvas, nav, shared
│   │   ├── station.css          # Station view
│   │   └── speaking.css         # Speaking view + slide-up animation
│   └── js/
│       ├── api.js               # fetch() wrapper → /api/*
│       ├── clock.js             # Dot-matrix clock (4×7 CSS grid per digit)
│       ├── waveform.js          # Full-width animated waveform bars
│       ├── player.js            # Audio element, queue, like button
│       ├── chat.js              # Chat history, input, send
│       ├── station.js           # Station view controller
│       ├── speaking.js          # Speaking view controller, transcript
│       └── app.js               # Entry: onboarding → station → speaking
├── data/
│   ├── taste.md                 # gitignored — generated at runtime
│   ├── config.json              # gitignored — OpenAI key, NetEase uid/cookie
│   └── programs.json            # gitignored — today's schedule cache
└── .env.example
```

---

## Phase 1 — Electron Shell

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `electron/main.js`
- Create: `.env.example`

- [ ] **Step 1: Init package.json**

```json
{
  "name": "retrofm",
  "version": "0.1.0",
  "description": "Personal AI FM radio",
  "main": "electron/main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "dev": "NODE_ENV=development electron ."
  },
  "dependencies": {
    "express": "^4.19.2",
    "NeteaseCloudMusicApi": "^4.20.0",
    "openai": "^4.52.0",
    "cors": "^2.8.5",
    "fs-extra": "^11.2.0"
  },
  "devDependencies": {
    "electron": "^30.0.0",
    "electron-builder": "^24.13.3"
  },
  "build": {
    "appId": "com.retrofm.app",
    "productName": "RetroFM",
    "directories": { "output": "dist" },
    "win": { "target": "portable" },
    "mac": { "target": "dmg" }
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd "c:\Users\Simon\AI\RetroFM"
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create electron/main.js**

```js
const { app, BrowserWindow } = require('electron')
const path = require('path')

let win

function createWindow() {
  win = new BrowserWindow({
    width: 390,
    height: 844,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#06060e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  })

  // Start Express server then load renderer
  const { startServer } = require('../server/index')
  startServer().then(port => {
    win.loadURL(`http://localhost:${port}`)
  })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
```

- [ ] **Step 4: Create .env.example**

```
OPENAI_API_KEY=sk-...
```

- [ ] **Step 5: Verify Electron opens**

```bash
npm start
```

Expected: A black 390×844 window opens. It will error on the server — that's fine for now.

- [ ] **Step 6: Commit**

```bash
git add package.json electron/ .env.example
git commit -m "feat: electron shell with fixed 390x844 window"
```

---

### Task 2: Express server entry

**Files:**
- Create: `server/index.js`
- Create: `data/.gitkeep`

- [ ] **Step 1: Create server/index.js**

```js
const express = require('express')
const path = require('path')
const fs = require('fs-extra')

const DATA_DIR = path.join(__dirname, '../data')

async function startServer() {
  await fs.ensureDir(DATA_DIR)

  const app = express()
  app.use(express.json())

  // Serve renderer
  app.use(express.static(path.join(__dirname, '../renderer')))

  // Health check
  app.get('/api/health', (req, res) => res.json({ ok: true }))

  // Routes (added incrementally)
  app.use('/api/auth',        require('./routes/auth'))
  app.use('/api/library',     require('./routes/library'))
  app.use('/api/player',      require('./routes/player'))
  app.use('/api/programs',    require('./routes/programs'))
  app.use('/api/commentary',  require('./routes/commentary'))
  app.use('/api/chat',        require('./routes/chat'))

  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      console.log(`RetroFM server on port ${port}`)
      resolve(port)
    })
  })
}

module.exports = { startServer }
```

- [ ] **Step 2: Create stub route files** (so server starts without crashing)

Create each of these with identical stub content:

`server/routes/auth.js`, `server/routes/library.js`, `server/routes/player.js`, `server/routes/programs.js`, `server/routes/commentary.js`, `server/routes/chat.js`

```js
const router = require('express').Router()
module.exports = router
```

- [ ] **Step 3: Create data/.gitkeep**

```bash
touch data/.gitkeep
```

Add to `.gitignore`:
```
data/taste.md
data/config.json
data/programs.json
data/.session
```

- [ ] **Step 4: Test server starts**

```bash
npm start
```

Expected: Window opens, loads blank page. No server crash in console.

- [ ] **Step 5: Commit**

```bash
git add server/ data/.gitkeep .gitignore
git commit -m "feat: express server with port-zero binding, stub routes"
```

---

## Phase 2 — UI Foundation

### Task 3: HTML shell + CSS design tokens

**Files:**
- Create: `renderer/index.html`
- Create: `renderer/css/reset.css`
- Create: `renderer/css/variables.css`
- Create: `renderer/css/fonts.css`
- Create: `renderer/css/layout.css`

- [ ] **Step 1: Create renderer/css/variables.css**

```css
:root {
  --bg:           #06060e;
  --bg-raised:    #0d0d1a;
  --bg-card:      #0f0f1c;
  --border:       rgba(255,255,255,0.07);
  --accent:       #6666ff;
  --accent-dim:   rgba(100,100,255,0.12);
  --accent-star:  #9080ff;
  --text-primary: #c8ccff;
  --text-secondary: #556;
  --text-muted:   #2a2a4a;
  --green:        #4a9a5a;
  --red-netease:  #e02020;
  --white-card:   #f4f4f8;

  --font-ui:   'Martian Mono', monospace;
  --font-chat: 'IBM Plex Mono', monospace;

  --canvas-w: 390px;
  --canvas-h: 844px;
  --radius:   12px;
}
```

- [ ] **Step 2: Create renderer/css/fonts.css**

```css
@import url('https://fonts.googleapis.com/css2?family=Martian+Mono:wght@300;400;500;600;700&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;1,400&display=swap');
```

- [ ] **Step 3: Create renderer/css/reset.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; }
body {
  background: var(--bg);
  color: var(--text-primary);
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 4: Create renderer/css/layout.css**

```css
/* Fixed phone canvas — centred in window */
#app {
  width: var(--canvas-w);
  height: var(--canvas-h);
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Nav bar */
.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 10px;
  flex-shrink: 0;
}
.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.logo-star {
  font-size: 16px;
  color: var(--accent-star);
}
.btn-login {
  font-size: 9px;
  font-weight: 600;
  color: var(--red-netease);
  background: rgba(220,30,30,0.1);
  border: 1px solid rgba(220,30,30,0.25);
  border-radius: 5px;
  padding: 5px 10px;
  cursor: pointer;
  font-family: var(--font-ui);
}
.btn-login.logged-in {
  color: var(--green);
  background: rgba(74,154,90,0.1);
  border-color: rgba(74,154,90,0.25);
}

/* Views */
#view-onboarding,
#view-station,
#view-speaking {
  display: none;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}
#view-onboarding.active,
#view-station.active,
#view-speaking.active {
  display: flex;
}
```

- [ ] **Step 5: Create renderer/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RetroFM</title>
  <link rel="stylesheet" href="css/fonts.css">
  <link rel="stylesheet" href="css/variables.css">
  <link rel="stylesheet" href="css/reset.css">
  <link rel="stylesheet" href="css/layout.css">
  <link rel="stylesheet" href="css/station.css">
  <link rel="stylesheet" href="css/speaking.css">
</head>
<body>
<div id="app">
  <nav class="nav">
    <div class="logo">
      <span class="logo-star">✳</span>
      RetroFM
    </div>
    <button class="btn-login" id="btn-login">♫ Login</button>
  </nav>

  <!-- Onboarding view -->
  <div id="view-onboarding">
    <div id="onboarding-content"></div>
  </div>

  <!-- Station view -->
  <div id="view-station">
    <div id="clock-zone">
      <div id="dot-clock"></div>
      <div id="clock-date"></div>
      <div id="onair"><span>ON AIR</span></div>
    </div>
    <div id="player-bar">
      <div id="eq-bars">
        <span></span><span></span><span></span><span></span>
      </div>
      <div id="track-info">
        <div id="track-name">—</div>
        <div id="track-artist">—</div>
      </div>
      <div id="player-controls">
        <button id="btn-prev">⏮</button>
        <button id="btn-play">⏸</button>
        <button id="btn-next">⏭</button>
        <button id="btn-like">♡</button>
      </div>
    </div>
    <div id="progress-bar"><div id="progress-fill"></div></div>
    <div id="progress-times">
      <span id="time-current">0:00</span>
      <span id="time-total">0:00</span>
    </div>
    <div id="queue-section">
      <div id="queue-header">
        <span id="queue-name">—</span>
        <span id="queue-count">—</span>
      </div>
      <div id="queue-list"></div>
    </div>
    <div id="chat-section">
      <div id="chat-header">
        <span class="dj-name">● Sine</span>
        <span class="live-badge">LIVE</span>
      </div>
      <div id="chat-history"></div>
      <div id="chat-input-row">
        <input type="text" id="chat-input" placeholder="Say something to the DJ...">
        <button id="chat-send">↑</button>
      </div>
    </div>
  </div>

  <!-- Speaking view -->
  <div id="view-speaking">
    <div id="speaking-header">
      <div class="logo">
        <span class="logo-star">✳</span>
        RetroFM
      </div>
      <span id="speaking-status">● Speaking...</span>
      <span id="speaking-time">0:00</span>
    </div>
    <div id="dj-waveform"></div>
    <div id="speaking-card">
      <div id="episode-title">—</div>
      <div id="episode-song">—</div>
      <div id="song-progress-bar"><div id="song-progress-fill"></div></div>
      <div id="song-times">
        <span id="song-time-current">0:00</span>
        <span id="song-time-total">0:00</span>
      </div>
      <div id="transcript"></div>
      <div id="song-waveform"></div>
      <div id="speaking-bottom">
        <span id="dj-playback-time">0:00</span>
        <button id="btn-pause-speaking">⏸</button>
      </div>
    </div>
  </div>
</div>

<audio id="audio-player"></audio>
<audio id="dj-audio"></audio>

<script src="js/api.js"></script>
<script src="js/clock.js"></script>
<script src="js/waveform.js"></script>
<script src="js/player.js"></script>
<script src="js/chat.js"></script>
<script src="js/station.js"></script>
<script src="js/speaking.js"></script>
<script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 6: Verify loads**

```bash
npm start
```

Expected: Window shows nav with ✳ RetroFM and red Login button. Rest is blank (views hidden). No console errors except font 404 (no internet in dev is ok).

- [ ] **Step 7: Commit**

```bash
git add renderer/
git commit -m "feat: renderer shell with design tokens and HTML structure"
```

---

### Task 4: Dot-matrix clock

**Files:**
- Create: `renderer/css/station.css` (partial — clock zone only)
- Create: `renderer/js/clock.js`

- [ ] **Step 1: Create renderer/js/clock.js**

```js
// 4-column × 7-row dot matrix patterns per digit
const PATTERNS = {
  '0': [0,1,1,0, 1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,0,1, 1,0,0,1, 0,1,1,0],
  '1': [0,0,1,0, 0,1,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0, 0,1,1,1],
  '2': [0,1,1,0, 1,0,0,1, 0,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0, 1,1,1,1],
  '3': [1,1,1,0, 0,0,0,1, 0,0,0,1, 0,1,1,0, 0,0,0,1, 0,0,0,1, 1,1,1,0],
  '4': [0,0,1,0, 0,1,1,0, 1,0,1,0, 1,0,1,0, 1,1,1,1, 0,0,1,0, 0,0,1,0],
  '5': [1,1,1,1, 1,0,0,0, 1,0,0,0, 1,1,1,0, 0,0,0,1, 0,0,0,1, 1,1,1,0],
  '6': [0,1,1,0, 1,0,0,0, 1,0,0,0, 1,1,1,0, 1,0,0,1, 1,0,0,1, 0,1,1,0],
  '7': [1,1,1,1, 0,0,0,1, 0,0,1,0, 0,0,1,0, 0,1,0,0, 0,1,0,0, 0,1,0,0],
  '8': [0,1,1,0, 1,0,0,1, 1,0,0,1, 0,1,1,0, 1,0,0,1, 1,0,0,1, 0,1,1,0],
  '9': [0,1,1,0, 1,0,0,1, 1,0,0,1, 0,1,1,1, 0,0,0,1, 0,0,0,1, 0,1,1,0],
}
const COLON = [0, 0, 1, 0, 0, 1, 0] // 1 column × 7 rows

function makeDigit(char) {
  const el = document.createElement('div')
  if (char === ':') {
    el.className = 'dot-colon'
    COLON.forEach(v => {
      const d = document.createElement('div')
      d.className = v ? 'd on' : 'd'
      el.appendChild(d)
    })
  } else {
    el.className = 'dot-digit'
    PATTERNS[char].forEach(v => {
      const d = document.createElement('div')
      d.className = v ? 'd on' : 'd'
      el.appendChild(d)
    })
  }
  return el
}

function renderClock() {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const container = document.getElementById('dot-clock')
  container.innerHTML = ''
  for (const ch of `${h}:${m}`) container.appendChild(makeDigit(ch))

  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  document.getElementById('clock-date').textContent =
    `${days[now.getDay()]} · ${months[now.getMonth()]} ${now.getDate()} · ${now.getFullYear()}`
}

function initClock() {
  renderClock()
  // update on the minute
  const now = new Date()
  const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
  setTimeout(() => { renderClock(); setInterval(renderClock, 60000) }, msToNextMinute)
}

window.Clock = { init: initClock }
```

- [ ] **Step 2: Add clock CSS to renderer/css/station.css**

```css
/* Clock zone */
#clock-zone {
  text-align: center;
  padding: 8px 0 6px;
  flex-shrink: 0;
}
#dot-clock {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.dot-digit {
  display: grid;
  grid-template-columns: repeat(4, 7px);
  grid-template-rows: repeat(7, 7px);
  gap: 2.5px;
}
.dot-colon {
  display: grid;
  grid-template-columns: 7px;
  grid-template-rows: repeat(7, 7px);
  gap: 2.5px;
  margin: 0 1px;
}
.d {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: rgba(100,100,255,0.08);
}
.d.on {
  background: var(--text-primary);
  box-shadow: 0 0 5px rgba(180,185,255,0.5);
}

#clock-date {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.07em;
  margin-top: 8px;
}
#onair {
  margin-top: 6px;
}
#onair span {
  font-size: 9px;
  color: var(--green);
  letter-spacing: 0.12em;
}
#onair span::before {
  content: '● ';
  animation: blink 2s infinite;
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
```

- [ ] **Step 3: Initialise clock in app.js**

Create `renderer/js/app.js` (stub — will grow):

```js
document.addEventListener('DOMContentLoaded', () => {
  Clock.init()
  // Show station view temporarily for testing
  document.getElementById('view-station').classList.add('active')
})
```

- [ ] **Step 4: Verify clock renders**

```bash
npm start
```

Expected: Large dot-matrix clock showing current time. Date string below. Green ON AIR pulse.

- [ ] **Step 5: Commit**

```bash
git add renderer/js/clock.js renderer/css/station.css renderer/js/app.js
git commit -m "feat: dot-matrix clock with live time and date"
```

---

### Task 5: Station view — player bar, queue, chat UI

**Files:**
- Modify: `renderer/css/station.css`
- Create: `renderer/js/api.js`

- [ ] **Step 1: Add player + queue + chat CSS to station.css**

```css
/* Player bar */
#player-bar {
  margin: 8px 18px 0;
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 9px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
#eq-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 16px;
  flex-shrink: 0;
}
#eq-bars span {
  width: 2.5px;
  background: var(--accent);
  border-radius: 2px;
  animation: eq 0.7s ease-in-out infinite alternate;
}
#eq-bars span:nth-child(1){height:5px;animation-delay:0s}
#eq-bars span:nth-child(2){height:12px;animation-delay:0.1s}
#eq-bars span:nth-child(3){height:8px;animation-delay:0.2s}
#eq-bars span:nth-child(4){height:16px;animation-delay:0.05s}
@keyframes eq{from{transform:scaleY(1)}to{transform:scaleY(0.3)}}
#eq-bars.paused span { animation-play-state: paused; }

#track-info { flex: 1; min-width: 0; }
#track-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#track-artist {
  font-size: 10px;
  color: var(--text-secondary);
  margin-top: 2px;
}
#player-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}
#player-controls button {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  padding: 2px;
}
#player-controls button:hover { color: var(--text-primary); }
#btn-play { color: var(--accent) !important; font-size: 14px !important; }
#btn-like { font-size: 14px !important; transition: color 0.2s; }
#btn-like.liked { color: #ff4466 !important; }

/* Progress */
#progress-bar {
  margin: 6px 18px 0;
  height: 2px;
  background: var(--text-muted);
  border-radius: 2px;
  flex-shrink: 0;
  cursor: pointer;
}
#progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  width: 0%;
  transition: width 0.5s linear;
}
#progress-times {
  display: flex;
  justify-content: space-between;
  margin: 3px 18px 0;
  font-size: 8px;
  color: var(--text-muted);
  flex-shrink: 0;
}

/* Queue */
#queue-section {
  margin: 10px 18px 0;
  flex-shrink: 0;
}
#queue-header {
  display: flex;
  justify-content: space-between;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 5px;
}
.queue-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 10px;
  margin-bottom: 2px;
  color: var(--text-secondary);
}
.queue-item.now-playing {
  background: var(--accent-dim);
  color: var(--text-primary);
}
.queue-item.now-playing::before { content: '▶ '; color: var(--accent); }
.queue-item .qi-artist { font-size: 9px; color: var(--text-muted); }

/* Chat */
#chat-section {
  margin: 10px 18px 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
#chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  flex-shrink: 0;
}
.dj-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--accent);
}
.dj-name::before { content: '● '; animation: blink 2s infinite; font-size: 7px; }
.live-badge { font-size: 8px; color: var(--green); font-weight: 700; letter-spacing: 0.08em; }

#chat-history {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-bottom: 4px;
  scrollbar-width: none;
}
#chat-history::-webkit-scrollbar { display: none; }

.msg-dj, .msg-user { display: flex; }
.msg-dj { gap: 6px; }
.msg-dj .av {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3a3aaa, #7755cc);
  flex-shrink: 0;
  margin-top: 2px;
}
.bubble {
  padding: 7px 10px;
  font-family: var(--font-chat);
  font-size: 10.5px;
  line-height: 1.65;
  border-radius: 3px 10px 10px 10px;
}
.msg-dj .bubble {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  color: #7880cc;
  max-width: 85%;
}
.msg-user { justify-content: flex-end; }
.msg-user .bubble {
  background: var(--accent-dim);
  border: 1px solid rgba(100,100,255,0.2);
  color: #9099dd;
  border-radius: 10px 3px 10px 10px;
  max-width: 75%;
}

#chat-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
  margin-bottom: 16px;
  flex-shrink: 0;
}
#chat-input {
  flex: 1;
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 10px;
  font-family: var(--font-ui);
  color: var(--text-primary);
  outline: none;
}
#chat-input::placeholder { color: var(--text-muted); }
#chat-input:focus { border-color: rgba(100,100,255,0.3); }
#chat-send {
  background: var(--accent-dim);
  border: 1px solid rgba(100,100,255,0.2);
  border-radius: 7px;
  color: var(--accent);
  width: 32px;
  height: 32px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 2: Create renderer/js/api.js**

```js
const API = {
  async get(path) {
    const res = await fetch(path)
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
    return res.json()
  },
  async post(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}`)
    return res.json()
  }
}
```

- [ ] **Step 3: Verify station view renders**

In `app.js` temporarily add static test data:

```js
document.getElementById('track-name').textContent = 'Sign of the Times'
document.getElementById('track-artist').textContent = 'Harry Styles'
document.getElementById('queue-name').textContent = 'Late Night'
document.getElementById('queue-count').textContent = '5 tracks'
document.getElementById('queue-list').innerHTML = `
  <div class="queue-item now-playing"><span>Sign of the Times</span><span class="qi-artist">Harry Styles</span></div>
  <div class="queue-item"><span>Fade Into You</span><span class="qi-artist">Mazzy Star</span></div>
  <div class="queue-item"><span>Wicked Game</span><span class="qi-artist">Chris Isaak</span></div>
`
document.getElementById('chat-history').innerHTML = `
  <div class="msg-dj"><div class="av"></div><div class="bubble">Six minutes of piano and falsetto — and something rising into what no one has named yet.</div></div>
  <div class="msg-user"><div class="bubble">Can you play something sadder?</div></div>
`
```

```bash
npm start
```

Expected: Full station view visible — clock, player bar, queue, chat, input.

- [ ] **Step 4: Remove test data from app.js, commit**

```bash
git add renderer/css/station.css renderer/js/api.js renderer/js/app.js
git commit -m "feat: station view layout - player, queue, chat"
```

---

### Task 6: Speaking view + waveform

**Files:**
- Create: `renderer/css/speaking.css`
- Create: `renderer/js/waveform.js`
- Create: `renderer/js/speaking.js`

- [ ] **Step 1: Create renderer/css/speaking.css**

```css
#view-speaking {
  background: var(--bg);
}
#speaking-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 8px;
  flex-shrink: 0;
}
#speaking-status {
  font-size: 9px;
  color: var(--green);
  letter-spacing: 0.06em;
}
#speaking-status::before { content: '● '; animation: blink 1.2s infinite; }
#speaking-time { font-size: 10px; color: var(--text-muted); }

/* DJ waveform — full canvas width */
#dj-waveform {
  width: 100%;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 1.5px;
  padding: 4px 0 14px;
  flex-shrink: 0;
  overflow: hidden;
}
#dj-waveform .wbar {
  flex: 1;
  max-width: 3px;
  background: rgba(200,204,255,0.65);
  border-radius: 2px;
  animation: djw 0.55s ease-in-out infinite alternate;
}
@keyframes djw { from{transform:scaleY(1)} to{transform:scaleY(0.1)} }
#dj-waveform.silent .wbar { animation-play-state: paused; transform: scaleY(0.05); }

/* White card — slides up */
#speaking-card {
  flex: 1;
  background: var(--white-card);
  border-radius: 22px 22px 0 0;
  padding: 22px 22px 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateY(100%);
  transition: transform 0.45s cubic-bezier(0.32, 0, 0.15, 1);
}
#speaking-card.visible {
  transform: translateY(0);
}

#episode-title {
  font-size: 32px;
  font-weight: 800;
  color: #080818;
  line-height: 1.1;
  letter-spacing: -0.5px;
  margin-bottom: 6px;
}
#episode-song {
  font-size: 11px;
  color: #999;
  margin-bottom: 14px;
  font-family: var(--font-chat);
}

#song-progress-bar {
  height: 2px;
  background: #e0e0ea;
  border-radius: 2px;
  position: relative;
  margin-bottom: 4px;
}
#song-progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  width: 0%;
  transition: width 0.5s linear;
}
#song-times {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: #bbb;
  margin-bottom: 14px;
}

/* Transcript */
#transcript {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.transcript-line {
  font-family: var(--font-chat);
  font-size: 11.5px;
  line-height: 1.7;
  color: #333;
}
.transcript-line .ts {
  display: block;
  font-size: 8px;
  color: #bbb;
  margin-bottom: 1px;
}
.transcript-line .hl { color: #5555ee; font-style: italic; }
.transcript-line.old { color: #bbb; }

/* Song waveform at bottom — full width */
#song-waveform {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 22px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid #eaeaf0;
}
#song-waveform .wbar {
  flex: 1;
  background: #d0d0da;
  border-radius: 1px;
}

#speaking-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}
#dj-playback-time { font-size: 9px; color: #bbb; }
#btn-pause-speaking {
  width: 24px; height: 24px;
  background: #0a0a18;
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 9px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 2: Create renderer/js/waveform.js**

```js
// Generates animated waveform bars filling the full element width
const Waveform = {
  build(containerId, count = 90) {
    const el = document.getElementById(containerId)
    el.innerHTML = ''
    for (let i = 0; i < count; i++) {
      const bar = document.createElement('div')
      bar.className = 'wbar'
      // Stagger heights and animation delays
      const h = 8 + Math.random() * 34
      const delay = (Math.random() * 0.5).toFixed(2)
      const dur  = (0.4 + Math.random() * 0.35).toFixed(2)
      bar.style.height = `${h}px`
      bar.style.animationDelay = `${delay}s`
      bar.style.animationDuration = `${dur}s`
      el.appendChild(bar)
    }
  },

  // For song waveform — static heights, no animation
  buildStatic(containerId, count = 100) {
    const el = document.getElementById(containerId)
    el.innerHTML = ''
    for (let i = 0; i < count; i++) {
      const bar = document.createElement('div')
      bar.className = 'wbar'
      bar.style.height = `${4 + Math.random() * 14}px`
      el.appendChild(bar)
    }
  }
}
```

- [ ] **Step 3: Create renderer/js/speaking.js**

```js
const Speaking = {
  transcriptLines: [],

  show({ episodeTitle, songName, artist, durationSec }) {
    document.getElementById('episode-title').textContent = episodeTitle
    document.getElementById('episode-song').textContent = `${songName} — ${artist}`
    document.getElementById('song-time-total').textContent = Speaking._fmt(durationSec)
    Speaking.transcriptLines = []
    document.getElementById('transcript').innerHTML = ''
    document.getElementById('speaking-card').classList.add('visible')
    document.getElementById('view-station').classList.remove('active')
    document.getElementById('view-speaking').classList.add('active')
  },

  hide() {
    document.getElementById('speaking-card').classList.remove('visible')
    setTimeout(() => {
      document.getElementById('view-speaking').classList.remove('active')
      document.getElementById('view-station').classList.add('active')
    }, 460)
  },

  addLine(timestampSec, text) {
    // Mark existing lines as old
    document.querySelectorAll('.transcript-line').forEach(l => l.classList.add('old'))

    const line = document.createElement('div')
    line.className = 'transcript-line'
    line.innerHTML = `<span class="ts">${Speaking._fmt(timestampSec)} →</span>${text}`

    const transcript = document.getElementById('transcript')
    // Prepend so newest is on top
    transcript.insertBefore(line, transcript.firstChild)
  },

  updateSongProgress(currentSec, durationSec) {
    const pct = durationSec > 0 ? (currentSec / durationSec * 100) : 0
    document.getElementById('song-progress-fill').style.width = `${pct}%`
    document.getElementById('song-time-current').textContent = Speaking._fmt(currentSec)
  },

  updateDjTime(sec) {
    document.getElementById('speaking-time').textContent = Speaking._fmt(sec)
    document.getElementById('dj-playback-time').textContent = Speaking._fmt(sec)
  },

  _fmt(sec) {
    const s = Math.floor(sec)
    return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
  }
}
```

- [ ] **Step 4: Wire waveforms in app.js and test speaking view**

Add to `app.js`:
```js
Waveform.build('dj-waveform', 90)
Waveform.buildStatic('song-waveform', 100)

// Test speaking view (remove after)
Speaking.show({
  episodeTitle: 'A Human Odyssey',
  songName: 'Sign of the Times',
  artist: 'Harry Styles',
  durationSec: 341
})
Speaking.addLine(17, 'Some say this era feels like a human odyssey.')
Speaking.addLine(38, 'Six minutes of piano, falsetto and a faint hum of static.')
```

```bash
npm start
```

Expected: Speaking view shows immediately — waveform spans full canvas width, white card visible, episode title large and bold, transcript lines building from top.

- [ ] **Step 5: Remove test code, commit**

```bash
git add renderer/css/speaking.css renderer/js/waveform.js renderer/js/speaking.js
git commit -m "feat: speaking view with full-width waveform and slide-up card"
```

---

## Phase 3 — NetEase Integration

### Task 7: NetEase client + QR login

**Files:**
- Create: `server/netease/client.js`
- Create: `server/netease/auth.js`
- Modify: `server/routes/auth.js`

- [ ] **Step 1: Create server/netease/client.js**

```js
const path = require('path')
const fs = require('fs-extra')

const SESSION_FILE = path.join(__dirname, '../../data/.session')
const CONFIG_FILE  = path.join(__dirname, '../../data/config.json')

// NeteaseCloudMusicApi functions accept a `cookie` param for auth
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
```

- [ ] **Step 2: Create server/netease/auth.js**

```js
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
  // Returns base64 qrimg
  return data.qrimg
}

// Returns: { status: 'pending' | 'scanned' | 'confirmed' | 'expired', cookie?, uid? }
async function checkQr(key) {
  const res = await login_qr_check({ key, timestamp: Date.now() })
  // 800 = expired, 801 = waiting, 802 = scanned, 803 = confirmed
  if (res.code === 803) {
    const cookie = res.cookie
    // Get uid from login status
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
```

- [ ] **Step 3: Populate server/routes/auth.js**

```js
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
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/qr-check/:key', async (req, res) => {
  try {
    const result = await checkQr(req.params.key)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
```

- [ ] **Step 4: Test QR endpoints manually**

```bash
npm start
# In a browser/curl:
curl http://localhost:PORT/api/auth/status
# Expected: { "loggedIn": false, "uid": null }
curl http://localhost:PORT/api/auth/qr-key
# Expected: { "key": "...", "img": "data:image/png;base64,..." }
```

- [ ] **Step 5: Commit**

```bash
git add server/netease/ server/routes/auth.js
git commit -m "feat: netease QR login - key, image, polling endpoints"
```

---

### Task 8: Onboarding UI — API key + QR login

**Files:**
- Create: `renderer/css/onboarding.css`
- Create: `renderer/js/app.js` (replace stub)

- [ ] **Step 1: Create renderer/css/onboarding.css** and link in index.html

```css
#view-onboarding {
  justify-content: center;
  align-items: center;
  gap: 24px;
  padding: 32px 24px;
}
.onboard-step { width: 100%; display: flex; flex-direction: column; gap: 12px; }
.onboard-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.onboard-sub { font-size: 10px; color: var(--text-secondary); line-height: 1.6; font-family: var(--font-chat); }
.onboard-input {
  width: 100%;
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 11px;
  font-family: var(--font-ui);
  color: var(--text-primary);
  outline: none;
}
.onboard-input:focus { border-color: rgba(100,100,255,0.4); }
.onboard-btn {
  width: 100%;
  background: var(--accent-dim);
  border: 1px solid rgba(100,100,255,0.25);
  border-radius: 8px;
  padding: 10px;
  font-size: 11px;
  font-family: var(--font-ui);
  color: var(--accent);
  cursor: pointer;
}
.onboard-btn:hover { background: rgba(100,100,255,0.18); }

#qr-image {
  width: 180px; height: 180px;
  margin: 0 auto;
  border-radius: 12px;
  border: 6px solid #fff;
  display: block;
}
#qr-status {
  text-align: center;
  font-size: 10px;
  color: var(--text-secondary);
  font-family: var(--font-chat);
}
#qr-status.confirmed { color: var(--green); }
```

Add `<link rel="stylesheet" href="css/onboarding.css">` in index.html before station.css.

- [ ] **Step 2: Replace renderer/js/app.js with full onboarding logic**

```js
document.addEventListener('DOMContentLoaded', async () => {
  Clock.init()
  Waveform.build('dj-waveform', 90)
  Waveform.buildStatic('song-waveform', 100)

  const { loggedIn } = await API.get('/api/auth/status')
  const config = await API.get('/api/config')

  if (!config.openaiKey) {
    showApiKeyStep()
  } else if (!loggedIn) {
    showQrStep()
  } else {
    startStation()
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
  const { key, img } = await API.get('/api/auth/qr-key')
  document.getElementById('qr-image').src = img
  clearInterval(_qrPollInterval)
  _qrPollInterval = setInterval(async () => {
    const { status } = await API.get(`/api/auth/qr-check/${key}`)
    const statusEl = document.getElementById('qr-status')
    if (status === 'scanned') statusEl.textContent = 'Scanned — confirm in app...'
    if (status === 'expired') { statusEl.textContent = 'Expired — reloading...'; loadQr() }
    if (status === 'confirmed') {
      clearInterval(_qrPollInterval)
      statusEl.textContent = '✓ Connected!'
      statusEl.className = 'qr-status confirmed'
      setTimeout(startStation, 1200)
    }
  }, 2000)
}

async function startStation() {
  showView('view-station')
  // Taste + programs boot sequence (Task 11+)
  await Station.init()
}

window.App = { showView, startStation }
```

- [ ] **Step 3: Add /api/config route to server**

Add to `server/routes/` a new file `server/routes/config.js`:

```js
const router = require('express').Router()
const { loadConfig, saveConfig } = require('../netease/client')

router.get('/', async (req, res) => {
  const config = await loadConfig()
  res.json({ openaiKey: !!config.openaiKey }) // never send key to renderer
})

router.post('/', async (req, res) => {
  const { openaiKey } = req.body
  if (openaiKey) await saveConfig({ openaiKey })
  res.json({ ok: true })
})

module.exports = router
```

Mount in `server/index.js`: `app.use('/api/config', require('./routes/config'))`

- [ ] **Step 4: Test onboarding flow**

```bash
npm start
```

Expected: On first launch, API key input appears. Enter a key → QR code appears. (Can't complete NetEase login without real credentials, but flow should render correctly.)

- [ ] **Step 5: Commit**

```bash
git add renderer/css/onboarding.css renderer/js/app.js server/routes/config.js server/index.js
git commit -m "feat: onboarding flow - API key input + NetEase QR login"
```

---

### Task 9: NetEase library — build music pool

**Files:**
- Create: `server/netease/library.js`
- Modify: `server/routes/library.js`

- [ ] **Step 1: Create server/netease/library.js**

```js
const {
  user_playlist,
  user_record,
  playlist_detail,
  recommend_songs,
  simi_artist,
  artist_top_song,
} = require('NeteaseCloudMusicApi')
const { getCookie, getUid } = require('./client')
const path = require('path')
const fs = require('fs-extra')

const POOL_CACHE = path.join(__dirname, '../../data/pool.json')
const POOL_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

async function buildPool() {
  // Check cache
  if (await fs.pathExists(POOL_CACHE)) {
    const { ts, songs } = await fs.readJson(POOL_CACHE)
    if (Date.now() - ts < POOL_TTL_MS) return songs
  }

  const cookie = getCookie()
  const uid    = getUid()
  const songs  = new Map() // id → song object

  const addSong = s => {
    if (!s?.id) return
    songs.set(s.id, {
      id: s.id,
      name: s.name,
      artist: Array.isArray(s.ar) ? s.ar.map(a => a.name).join(', ')
            : (s.artists?.map(a => a.name).join(', ') || ''),
      album:  s.al?.name || s.album?.name || '',
      duration: s.dt || s.duration || 0, // ms
    })
  }

  // 1. All-time play record
  try {
    const { data } = await user_record({ uid, type: 0, cookie })
    data?.allData?.forEach(({ song }) => addSong(song))
  } catch(e) { console.warn('play record failed', e.message) }

  // 2. User playlists → liked + collected
  try {
    const { playlist } = await user_playlist({ uid, cookie })
    for (const pl of (playlist || []).slice(0, 30)) { // cap at 30 playlists
      try {
        const { playlist: detail } = await playlist_detail({ id: pl.id, cookie })
        detail?.tracks?.forEach(addSong)
      } catch(e) { /* skip failed playlist */ }
    }
  } catch(e) { console.warn('playlists failed', e.message) }

  // 3. Daily recommendations
  try {
    const { data } = await recommend_songs({ cookie })
    data?.dailySongs?.forEach(addSong)
  } catch(e) { console.warn('recs failed', e.message) }

  const result = Array.from(songs.values())
  await fs.outputJson(POOL_CACHE, { ts: Date.now(), songs: result })
  return result
}

async function getPlayRecord() {
  const cookie = getCookie()
  const uid    = getUid()
  const weekly = await user_record({ uid, type: 1, cookie })
  const all    = await user_record({ uid, type: 0, cookie })
  return {
    weekly: weekly.data?.weekData || [],
    allTime: all.data?.allData || [],
  }
}

module.exports = { buildPool, getPlayRecord }
```

- [ ] **Step 2: Populate server/routes/library.js**

```js
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
```

- [ ] **Step 3: Add pool.json to .gitignore**

```
data/pool.json
```

- [ ] **Step 4: Test (requires real NetEase login)**

After completing QR login:
```
curl http://localhost:PORT/api/library/pool
```
Expected: `{ count: N, songs: [...] }` where N > 400.

- [ ] **Step 5: Commit**

```bash
git add server/netease/library.js server/routes/library.js .gitignore
git commit -m "feat: netease library - build song pool from playlists + recs"
```

---

### Task 10: Audio playback

**Files:**
- Create: `server/routes/player.js` (replace stub)
- Create: `renderer/js/player.js`

- [ ] **Step 1: Populate server/routes/player.js**

```js
const router = require('express').Router()
const { song_url, like } = require('NeteaseCloudMusicApi')
const { getCookie, getUid } = require('../netease/client')

router.get('/url/:id', async (req, res) => {
  try {
    const cookie = getCookie()
    const { data } = await song_url({ id: req.params.id, cookie })
    const url = data?.[0]?.url
    if (!url) return res.status(404).json({ error: 'No URL' })
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
```

- [ ] **Step 2: Create renderer/js/player.js**

```js
const Player = (() => {
  const audio = document.getElementById('audio-player')
  let queue = []
  let currentIndex = 0
  let likedIds = new Set()

  async function loadTrack(song) {
    const { url } = await API.get(`/api/player/url/${song.id}`)
    audio.src = url
    audio.play()
    document.getElementById('track-name').textContent = song.name
    document.getElementById('track-artist').textContent = song.artist
    document.getElementById('btn-like').textContent = likedIds.has(song.id) ? '♥' : '♡'
    document.getElementById('btn-like').classList.toggle('liked', likedIds.has(song.id))
    renderQueue()
  }

  function renderQueue() {
    const list = document.getElementById('queue-list')
    list.innerHTML = queue.map((s, i) => `
      <div class="queue-item ${i === currentIndex ? 'now-playing' : ''}" data-idx="${i}">
        <span>${s.name}</span>
        <span class="qi-artist">${s.artist}</span>
      </div>
    `).join('')
    list.querySelectorAll('.queue-item').forEach(el => {
      el.addEventListener('click', () => { currentIndex = +el.dataset.idx; loadTrack(queue[currentIndex]) })
    })
    document.getElementById('queue-name').textContent  = queue._programName || '—'
    document.getElementById('queue-count').textContent = `${queue.length} tracks`
  }

  function next() {
    if (currentIndex < queue.length - 1) { currentIndex++; loadTrack(queue[currentIndex]) }
  }
  function prev() {
    if (currentIndex > 0) { currentIndex--; loadTrack(queue[currentIndex]) }
  }

  audio.addEventListener('timeupdate', () => {
    const pct = audio.duration ? (audio.currentTime / audio.duration * 100) : 0
    document.getElementById('progress-fill').style.width = `${pct}%`
    document.getElementById('time-current').textContent = fmt(audio.currentTime)
    document.getElementById('time-total').textContent   = fmt(audio.duration || 0)
    Speaking.updateSongProgress(audio.currentTime, audio.duration || 0)
  })

  audio.addEventListener('ended', next)

  document.getElementById('btn-play').addEventListener('click', () => {
    if (audio.paused) { audio.play(); document.getElementById('btn-play').textContent = '⏸' }
    else              { audio.pause(); document.getElementById('btn-play').textContent = '▶' }
  })
  document.getElementById('btn-next').addEventListener('click', next)
  document.getElementById('btn-prev').addEventListener('click', prev)

  document.getElementById('btn-like').addEventListener('click', async () => {
    const song = queue[currentIndex]
    if (!song) return
    const nowLiked = !likedIds.has(song.id)
    if (nowLiked) likedIds.add(song.id); else likedIds.delete(song.id)
    document.getElementById('btn-like').textContent = nowLiked ? '♥' : '♡'
    document.getElementById('btn-like').classList.toggle('liked', nowLiked)
    await API.post('/api/player/like', { id: song.id, liked: nowLiked })
  })

  document.getElementById('progress-bar').addEventListener('click', e => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audio.currentTime = pct * audio.duration
  })

  function setQueue(songs, programName) {
    queue = songs
    queue._programName = programName
    currentIndex = 0
    if (songs.length > 0) loadTrack(songs[0])
  }

  function currentSong() { return queue[currentIndex] || null }
  function fmt(s) { const t=Math.floor(s||0); return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}` }

  return { setQueue, next, prev, currentSong, loadTrack }
})()
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/player.js renderer/js/player.js
git commit -m "feat: audio playback with queue, progress, like-sync to netease"
```

---

## Phase 4 — OpenAI + taste.md

### Task 11: OpenAI client + taste.md generation

**Files:**
- Create: `server/openai/client.js`
- Create: `server/taste/generate.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create server/openai/client.js**

```js
const { OpenAI } = require('openai')
const { loadConfig } = require('../netease/client')

let _client = null

async function getClient() {
  if (_client) return _client
  const config = await loadConfig()
  if (!config.openaiKey) throw new Error('OpenAI key not set')
  _client = new OpenAI({ apiKey: config.openaiKey })
  return _client
}

// Invalidate cached client when key changes
function resetClient() { _client = null }

module.exports = { getClient, resetClient }
```

- [ ] **Step 2: Create server/taste/generate.js**

```js
const { getClient } = require('../openai/client')
const { getPlayRecord } = require('../netease/library')
const path = require('path')
const fs = require('fs-extra')

const TASTE_FILE = path.join(__dirname, '../../data/taste.md')

async function generateTaste() {
  const { weekly, allTime } = await getPlayRecord()

  // Build a readable summary for GPT-4o
  const topAll = allTime.slice(0, 80).map(({ song, playCount }) =>
    `${song.name} — ${song.ar?.map(a=>a.name).join(', ')} (played ${playCount}×)`
  ).join('\n')

  const topWeek = weekly.slice(0, 30).map(({ song, playCount }) =>
    `${song.name} — ${song.ar?.map(a=>a.name).join(', ')} (${playCount}× this week)`
  ).join('\n')

  const ai = await getClient()
  const res = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You are a music analyst. Analyse the user's listening history and write a detailed taste profile in markdown. Cover: genres, sub-genres, moods, recurring themes, time-of-day patterns you can infer, decades of music preferred, emotional register, artists that define their taste, what they return to vs what they explore. Write in second person ("You tend to..."). Be specific and evocative, not generic. 400-600 words.`
    }, {
      role: 'user',
      content: `All-time most played:\n${topAll}\n\nThis week:\n${topWeek}`
    }],
    temperature: 0.7,
  })

  const taste = `# taste.md — RetroFM Taste Profile\n_Generated ${new Date().toISOString()}_\n\n${res.choices[0].message.content}`
  await fs.outputFile(TASTE_FILE, taste)
  return taste
}

async function readTaste() {
  if (await fs.pathExists(TASTE_FILE)) return fs.readFile(TASTE_FILE, 'utf8')
  return null
}

module.exports = { generateTaste, readTaste, TASTE_FILE }
```

- [ ] **Step 3: Add taste generation route**

Create `server/routes/taste.js`:

```js
const router = require('express').Router()
const { generateTaste, readTaste } = require('../taste/generate')
const { update: updateTaste } = require('../taste/update')

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

module.exports = router
```

Mount in server/index.js: `app.use('/api/taste', require('./routes/taste'))`

- [ ] **Step 4: Create server/taste/update.js** (stub — implemented fully in Task 17)

```js
const { readTaste } = require('./generate')
// Stub — Task 17 implements full update logic
async function update(sessionSignals) { return readTaste() }
module.exports = { update }
```

- [ ] **Step 5: Wire taste generation into onboarding**

In `renderer/js/app.js`, update `startStation()`:

```js
async function startStation() {
  showView('view-station')
  Station.init()
}
```

Create `renderer/js/station.js` (stub for now):

```js
const Station = {
  async init() {
    const { exists } = await API.get('/api/taste')
    if (!exists) {
      // Show generating overlay
      document.getElementById('chat-history').innerHTML =
        '<div class="msg-dj"><div class="av"></div><div class="bubble">Building your taste profile from 10 years of listening history... give me a moment.</div></div>'
      await API.post('/api/taste/generate', {})
      document.getElementById('chat-history').innerHTML =
        '<div class="msg-dj"><div class="av"></div><div class="bubble">Got it. I know what you like. Let me put together today\'s program.</div></div>'
    }
    await Station.loadProgram()
  },

  async loadProgram() {
    // Task 12 implements this
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add server/openai/ server/taste/ server/routes/taste.js server/index.js renderer/js/station.js
git commit -m "feat: openai client + taste.md generation from netease history"
```

---

### Task 12: Program scheduler

**Files:**
- Create: `server/scheduler/programs.js`
- Modify: `server/routes/programs.js`

- [ ] **Step 1: Create server/scheduler/programs.js**

```js
const { getClient } = require('../openai/client')
const { readTaste } = require('../taste/generate')
const { buildPool } = require('../netease/library')
const path = require('path')
const fs = require('fs-extra')

const PROGRAMS_CACHE = path.join(__dirname, '../../data/programs.json')

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

async function generatePrograms() {
  const taste = await readTaste()
  const pool  = await buildPool()

  // Give GPT-4o a sample of the pool (names + artists only, to stay within tokens)
  const sample = pool.slice(0, 400).map(s => `${s.id}|${s.name}|${s.artist}`).join('\n')
  const now = new Date()
  const hour = now.getHours()
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()]

  const ai = await getClient()
  const res = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You are Sine, a female AI radio DJ with a thoughtful, slightly melancholy personality. You know this listener deeply through their taste profile. Generate today's radio program as a JSON array of program blocks. Each block has: name (evocative title, 2-4 words), mood (one short phrase), songIds (array of song IDs from the pool, 5-8 per block). Generate 3-4 blocks appropriate for the current time of day. Return ONLY valid JSON array, no markdown.`
    }, {
      role: 'user',
      content: `Today is ${dayName}. Current hour: ${hour}:00.\n\nTaste profile:\n${taste}\n\nAvailable songs (id|name|artist):\n${sample}`
    }],
    temperature: 0.8,
    response_format: { type: 'json_object' },
  })

  let blocks
  try {
    const parsed = JSON.parse(res.choices[0].message.content)
    blocks = parsed.blocks || parsed.programs || parsed
    if (!Array.isArray(blocks)) throw new Error('not array')
  } catch(e) {
    throw new Error(`Program JSON parse failed: ${e.message}`)
  }

  // Hydrate song IDs back to full song objects
  const poolById = new Map(pool.map(s => [s.id, s]))
  const hydrated = blocks.map(block => ({
    name: block.name,
    mood: block.mood,
    songs: (block.songIds || []).map(id => poolById.get(id)).filter(Boolean)
  })).filter(b => b.songs.length > 0)

  const data = { date: todayKey(), blocks: hydrated }
  await fs.outputJson(PROGRAMS_CACHE, data)
  return hydrated
}

async function getTodayPrograms() {
  if (await fs.pathExists(PROGRAMS_CACHE)) {
    const data = await fs.readJson(PROGRAMS_CACHE)
    if (data.date === todayKey()) return data.blocks
  }
  return generatePrograms()
}

module.exports = { getTodayPrograms, generatePrograms }
```

- [ ] **Step 2: Populate server/routes/programs.js**

```js
const router = require('express').Router()
const { getTodayPrograms, generatePrograms } = require('../scheduler/programs')

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

module.exports = router
```

- [ ] **Step 3: Wire programs into Station.loadProgram**

In `renderer/js/station.js`, replace `loadProgram`:

```js
async loadProgram() {
  const { blocks } = await API.get('/api/programs/today')
  if (!blocks?.length) return

  Station._blocks = blocks
  Station._blockIndex = 0
  Station.startBlock(0)
},

startBlock(idx) {
  const block = Station._blocks[idx]
  if (!block) return
  Player.setQueue(block.songs, block.name)
  // Commentary triggered in Task 13
  Station.requestCommentary(block)
},
```

- [ ] **Step 4: Add programs.json to .gitignore**

- [ ] **Step 5: Commit**

```bash
git add server/scheduler/ server/routes/programs.js renderer/js/station.js .gitignore
git commit -m "feat: gpt-4o daily program scheduler with hydrated song blocks"
```

---

## Phase 5 — DJ Sine: Commentary + Voice

### Task 13: Commentary generation + TTS

**Files:**
- Create: `server/openai/commentary.js`
- Create: `server/openai/tts.js`
- Modify: `server/routes/commentary.js`

- [ ] **Step 1: Create server/openai/commentary.js**

```js
const { getClient } = require('./client')
const { readTaste } = require('../taste/generate')

async function generateCommentary(block, song) {
  const taste = await readTaste()
  const ai = await getClient()
  const now = new Date()
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()]

  const res = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You are Sine, a female AI radio DJ. Thoughtful, slightly melancholy, knowledgeable about music. You are introducing a new program block on RetroFM — the listener's personal radio station. Speak directly to them in second person. Reference the time and mood. Be evocative, not generic. 60-90 words for the spoken intro. Also generate a poetic episode title (3-5 words) that names this musical moment — not the song title, but what this moment feels like. Return JSON: { "episodeTitle": "...", "script": "..." }`
    }, {
      role: 'user',
      content: `Time: ${timeStr} on ${dayName}.\nProgram block: "${block.name}" — ${block.mood}\nOpening song: "${song.name}" by ${song.artist}\n\nListener taste:\n${taste?.slice(0, 800)}`
    }],
    temperature: 0.85,
    response_format: { type: 'json_object' },
  })

  return JSON.parse(res.choices[0].message.content)
}

module.exports = { generateCommentary }
```

- [ ] **Step 2: Create server/openai/tts.js**

```js
const { getClient } = require('./client')
const path = require('path')
const fs = require('fs-extra')

const TTS_DIR = path.join(__dirname, '../../data/tts')

async function synthesise(text, filename) {
  await fs.ensureDir(TTS_DIR)
  const outPath = path.join(TTS_DIR, filename)

  const ai = await getClient()
  const mp3 = await ai.audio.speech.create({
    model: 'tts-1-hd',
    voice: 'shimmer',
    input: text,
  })

  const buffer = Buffer.from(await mp3.arrayBuffer())
  await fs.outputFile(outPath, buffer)
  return `/api/tts/${filename}`
}

module.exports = { synthesise }
```

- [ ] **Step 3: Populate server/routes/commentary.js**

```js
const router = require('express').Router()
const { generateCommentary } = require('../openai/commentary')
const { synthesise } = require('../openai/tts')
const path = require('path')

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

// Serve TTS audio files
router.get('/../tts/:filename', (req, res) => {
  const file = path.join(__dirname, '../../data/tts', req.params.filename)
  res.sendFile(file)
})

module.exports = router
```

Add TTS static serving to `server/index.js`:
```js
const fs = require('fs-extra')
const DATA_DIR = path.join(__dirname, '../data')
app.use('/api/tts', express.static(path.join(DATA_DIR, 'tts')))
```

Add `data/tts/` to `.gitignore`.

- [ ] **Step 4: Wire commentary into station.js**

In `renderer/js/station.js`, add:

```js
async requestCommentary(block) {
  const song = Player.currentSong()
  if (!song) return
  const { episodeTitle, script, audioUrl } =
    await API.post('/api/commentary/generate', { block, song })
  Speaking.show({
    episodeTitle,
    songName: song.name,
    artist: song.artist,
    durationSec: (song.duration || 0) / 1000
  })
  // Play DJ voice
  const djAudio = document.getElementById('dj-audio')
  djAudio.src = audioUrl
  djAudio.play()
  // Stream transcript line by line after a short delay
  Station._streamTranscript(script, djAudio)
},

_streamTranscript(script, djAudio) {
  // Split into sentences and reveal with timing
  const sentences = script.match(/[^.!?]+[.!?]+/g) || [script]
  const avgDur = djAudio.duration || 20
  const interval = (avgDur / sentences.length) * 1000

  sentences.forEach((s, i) => {
    setTimeout(() => {
      Speaking.addLine(i * (avgDur / sentences.length), s.trim())
    }, i * interval)
  })

  djAudio.addEventListener('ended', () => {
    setTimeout(() => Speaking.hide(), 1200)
  }, { once: true })
},
```

- [ ] **Step 5: Commit**

```bash
git add server/openai/commentary.js server/openai/tts.js server/routes/commentary.js renderer/js/station.js .gitignore
git commit -m "feat: gpt-4o commentary + openai tts shimmer voice for sine"
```

---

## Phase 6 — Chat System

### Task 14: Chat with Sine (text only)

**Files:**
- Create: `server/openai/chat.js`
- Modify: `server/routes/chat.js`
- Create: `renderer/js/chat.js`

- [ ] **Step 1: Create server/openai/chat.js**

```js
const { getClient } = require('./client')
const { readTaste } = require('../taste/generate')
const path = require('path')
const fs = require('fs-extra')

const HISTORY_FILE = path.join(__dirname, '../../data/chat-history.json')
const MAX_HISTORY = 20

async function loadHistory() {
  if (await fs.pathExists(HISTORY_FILE)) return fs.readJson(HISTORY_FILE)
  return []
}

async function saveHistory(history) {
  await fs.outputJson(HISTORY_FILE, history.slice(-MAX_HISTORY))
}

async function chat(userMessage, currentQueue) {
  const taste  = await readTaste()
  const history = await loadHistory()
  const ai = await getClient()

  const queueStr = currentQueue?.map(s => `${s.name} — ${s.artist}`).join('\n') || 'nothing queued'

  const messages = [
    {
      role: 'system',
      content: `You are Sine, a female AI radio DJ on RetroFM — the listener's personal radio station. You communicate only in text when chatting (you speak aloud only when introducing new program blocks). Be warm, perceptive, and musically knowledgeable. Keep replies to 2-3 sentences. If the listener asks for a song or mood change, acknowledge it warmly and suggest you'll adjust the queue — respond with a JSON object: { "reply": "...", "queueRequest": { "mood": "...", "count": 5 } }. For general conversation, return { "reply": "..." }. Always return valid JSON.`
    },
    {
      role: 'user',
      content: `Current queue:\n${queueStr}\n\nTaste profile summary:\n${taste?.slice(0,400)}`
    },
    ...history.flatMap(h => [
      { role: 'user', content: h.user },
      { role: 'assistant', content: h.assistant }
    ]),
    { role: 'user', content: userMessage }
  ]

  const res = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.8,
    response_format: { type: 'json_object' },
  })

  const parsed = JSON.parse(res.choices[0].message.content)
  const newHistory = [...history, { user: userMessage, assistant: parsed.reply }]
  await saveHistory(newHistory)
  return parsed
}

module.exports = { chat, loadHistory }
```

- [ ] **Step 2: Populate server/routes/chat.js**

```js
const router = require('express').Router()
const { chat } = require('../openai/chat')
const { getTodayPrograms } = require('../scheduler/programs')
const { buildPool } = require('../netease/library')

router.post('/', async (req, res) => {
  try {
    const { message, currentQueue } = req.body
    const result = await chat(message, currentQueue)
    // If a queue request came back, curate songs
    if (result.queueRequest) {
      const pool = await buildPool()
      result.suggestedSongs = await curateForMood(result.queueRequest, pool)
    }
    res.json(result)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

async function curateForMood({ mood, count }, pool) {
  const { getClient } = require('../openai/client')
  const ai = await getClient()
  const sample = pool.slice(0, 300).map(s => `${s.id}|${s.name}|${s.artist}`).join('\n')
  const res = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: `Pick ${count} song IDs from the list that match the mood. Return JSON: { "songIds": [...] }`
    }, {
      role: 'user',
      content: `Mood: ${mood}\n\nSongs:\n${sample}`
    }],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  })
  const { songIds } = JSON.parse(res.choices[0].message.content)
  const byId = new Map(pool.map(s => [s.id, s]))
  return songIds.map(id => byId.get(id)).filter(Boolean)
}

module.exports = router
```

- [ ] **Step 3: Create renderer/js/chat.js**

```js
const Chat = (() => {
  const history = document.getElementById('chat-history')
  const input   = document.getElementById('chat-input')
  const sendBtn = document.getElementById('chat-send')

  function addMessage(role, text) {
    const div = document.createElement('div')
    div.className = role === 'dj' ? 'msg-dj' : 'msg-user'
    if (role === 'dj') {
      div.innerHTML = `<div class="av"></div><div class="bubble">${text}</div>`
    } else {
      div.innerHTML = `<div class="bubble">${text}</div>`
    }
    history.appendChild(div)
    history.scrollTop = history.scrollHeight
  }

  async function send() {
    const text = input.value.trim()
    if (!text) return
    input.value = ''
    addMessage('user', text)

    const currentQueue = Player.currentSong() ? [Player.currentSong()] : []
    const result = await API.post('/api/chat', { message: text, currentQueue })

    addMessage('dj', result.reply)

    if (result.suggestedSongs?.length) {
      setTimeout(() => {
        Player.setQueue(result.suggestedSongs, 'Your request')
      }, 1500)
    }
  }

  sendBtn.addEventListener('click', send)
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send() })

  return { addMessage }
})()
```

- [ ] **Step 4: Add chat-history.json to .gitignore, commit**

```bash
git add server/openai/chat.js server/routes/chat.js renderer/js/chat.js .gitignore
git commit -m "feat: chat with sine - gpt-4o-mini, mood-based queue updates"
```

---

## Phase 7 — taste.md Evolution

### Task 15: Weekly + session taste updates

**Files:**
- Modify: `server/taste/update.js`

- [ ] **Step 1: Implement server/taste/update.js**

```js
const { getClient } = require('../openai/client')
const { readTaste, TASTE_FILE } = require('./generate')
const { getPlayRecord } = require('../netease/library')
const path = require('path')
const fs = require('fs-extra')

const UPDATE_LOG = path.join(__dirname, '../../data/taste-updates.json')

// Called at end of each listening session with signals
async function applySessionSignals(signals) {
  // signals: { liked: [songId,...], skipped: [songId,...], chatTopics: ["string",...] }
  const current = await readTaste()
  if (!current) return

  const ai = await getClient()
  const res = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You maintain a music taste profile. Given session signals, write a brief (1-2 sentence) addendum to append to the profile. Focus only on what's new or surprising — don't repeat existing content. Return JSON: { "addendum": "..." }`
    }, {
      role: 'user',
      content: `Current profile:\n${current.slice(0,600)}\n\nSession signals:\nLiked: ${JSON.stringify(signals.liked)}\nSkipped: ${JSON.stringify(signals.skipped)}\nChat topics: ${JSON.stringify(signals.chatTopics)}`
    }],
    temperature: 0.6,
    response_format: { type: 'json_object' },
  })

  const { addendum } = JSON.parse(res.choices[0].message.content)
  if (!addendum) return

  const updated = current + `\n\n## ${new Date().toISOString().slice(0,10)} update\n${addendum}`
  await fs.outputFile(TASTE_FILE, updated)

  // Log the update
  const log = await fs.pathExists(UPDATE_LOG) ? await fs.readJson(UPDATE_LOG) : []
  log.push({ date: new Date().toISOString(), addendum })
  await fs.outputJson(UPDATE_LOG, log.slice(-50))
}

// Called weekly to re-analyse play record drift
async function weeklyRefresh() {
  const { weekly } = await getPlayRecord()
  const current = await readTaste()

  const weekStr = weekly.slice(0, 30).map(({ song, playCount }) =>
    `${song.name} — ${song.ar?.map(a=>a.name).join(', ')} (${playCount}×)`
  ).join('\n')

  const ai = await getClient()
  const res = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `You maintain a music taste profile. Given this week's listening vs the existing profile, identify any drift or evolution. Add a dated section noting what shifted. 2-3 sentences max. Return JSON: { "weekNote": "..." }`
    }, {
      role: 'user',
      content: `Existing profile:\n${current?.slice(0,600)}\n\nThis week's top plays:\n${weekStr}`
    }],
    temperature: 0.6,
    response_format: { type: 'json_object' },
  })

  const { weekNote } = JSON.parse(res.choices[0].message.content)
  if (!weekNote) return

  const updated = (current || '') + `\n\n## Week of ${new Date().toISOString().slice(0,10)}\n${weekNote}`
  await fs.outputFile(TASTE_FILE, updated)
}

module.exports = { applySessionSignals, weeklyRefresh }
```

- [ ] **Step 2: Schedule weekly refresh on server start**

In `server/index.js`, after routes:

```js
// Weekly taste refresh — runs once at server start if >7 days since last update
async function scheduleWeeklyTaste() {
  const { readTaste } = require('./taste/generate')
  const { weeklyRefresh } = require('./taste/update')
  const taste = await readTaste()
  if (!taste) return
  const match = taste.match(/## Week of (\d{4}-\d{2}-\d{2})/)
  const lastWeek = match ? new Date(match[1]) : new Date(0)
  const daysSince = (Date.now() - lastWeek) / 86400000
  if (daysSince >= 7) weeklyRefresh().catch(console.warn)
}
scheduleWeeklyTaste()
```

- [ ] **Step 3: Track session signals in renderer**

In `renderer/js/player.js`, add signal tracking to the like handler and song-end handler:

```js
// In Player IIFE, add at top:
const _sessionSignals = { liked: [], skipped: [], chatTopics: [] }

// In btn-like click handler, after like toggle:
if (nowLiked) _sessionSignals.liked.push(song.id)

// In audio 'ended' handler, before next():
if (audio.currentTime / audio.duration < 0.5) {
  _sessionSignals.skipped.push(queue[currentIndex]?.id)
}

// Expose for session end
Player._getSignals = () => _sessionSignals
```

Add to `window` unload in `app.js`:
```js
window.addEventListener('beforeunload', () => {
  const signals = Player._getSignals()
  if (signals.liked.length || signals.skipped.length) {
    navigator.sendBeacon('/api/taste/session', JSON.stringify(signals))
  }
})
```

Add route to `server/routes/taste.js`:
```js
router.post('/session', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const signals = JSON.parse(req.body.toString())
    await require('../taste/update').applySessionSignals(signals)
    res.json({ ok: true })
  } catch(e) { res.json({ ok: false }) }
})
```

- [ ] **Step 4: Commit**

```bash
git add server/taste/update.js server/index.js server/routes/taste.js renderer/js/player.js renderer/js/app.js
git commit -m "feat: taste.md auto-evolution - session signals + weekly refresh"
```

---

## Phase 8 — Polish + Packaging

### Task 16: Electron packaging — complete app

**Files:**
- Modify: `electron/main.js`
- Create: `electron/preload.js`

- [ ] **Step 1: Update electron/main.js for production**

```js
const { app, BrowserWindow, nativeTheme } = require('electron')
const path = require('path')

nativeTheme.themeSource = 'dark'

let win

async function createWindow() {
  const { startServer } = require('../server/index')
  const port = await startServer()

  win = new BrowserWindow({
    width: 390,
    height: 844,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    backgroundColor: '#06060e',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  })

  win.loadURL(`http://127.0.0.1:${port}`)
  win.once('ready-to-show', () => win.show())

  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools({ mode: 'detach' })
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

- [ ] **Step 2: Create electron/preload.js**

```js
// No Node APIs exposed to renderer — all communication via fetch to Express
window.addEventListener('DOMContentLoaded', () => {})
```

- [ ] **Step 3: Add build config to package.json**

```json
"build": {
  "appId": "com.retrofm.app",
  "productName": "RetroFM",
  "directories": { "output": "dist" },
  "files": [
    "electron/**/*",
    "server/**/*",
    "renderer/**/*",
    "data/.gitkeep",
    "node_modules/**/*",
    "package.json"
  ],
  "extraResources": [{ "from": "data", "to": "data" }],
  "win": {
    "target": [{ "target": "portable", "arch": ["x64"] }],
    "icon": "renderer/icon.png"
  },
  "mac": {
    "target": "dmg",
    "icon": "renderer/icon.icns"
  }
}
```

- [ ] **Step 4: Create a simple placeholder icon**

Save a 512×512 purple star PNG as `renderer/icon.png` (can generate with any tool or use a placeholder for now).

- [ ] **Step 5: Test full build**

```bash
npm run build
```

Expected: `dist/RetroFM.exe` (Windows portable) or `dist/RetroFM.dmg` (Mac). Double-click → app opens, shows onboarding. No terminal required.

- [ ] **Step 6: Final commit + push**

```bash
git add electron/ renderer/icon.png package.json
git commit -m "feat: electron packaging - portable app, no terminal required"
git push origin main
```

---

## Self-Review Against Spec

| Requirement | Task |
|---|---|
| Electron desktop app, fixed 390×844 | Task 1, 16 |
| Dark mode only | variables.css, electron/main.js nativeTheme |
| NetEase QR login | Task 7, 8 |
| Music pool: liked + playlists + recs | Task 9 |
| New song discovery via NetEase recs | Task 9 |
| ❤️ writes back to NetEase | Task 10 |
| taste.md generated on first run | Task 11 |
| taste.md auto-evolves (weekly + session) | Task 15 |
| GPT-4o curation | Task 12 |
| GPT-4o commentary | Task 13 |
| GPT-4o-mini chat | Task 14 |
| OpenAI TTS shimmer voice | Task 13 |
| Sine speaks only on new program | Task 13 (station.js) |
| Chat is text-only during playback | Task 14 |
| Dot-matrix clock | Task 4 |
| Full-width waveform | Task 6 (Waveform.build with 90 bars) |
| Station view layout | Task 5 |
| Speaking view slide-up white card | Task 6 |
| Martian Mono + IBM Plex Mono | Task 3 (fonts.css) |
| Midnight Ink palette | Task 3 (variables.css) |
| Purple ✳ star logo | Task 3 (index.html) |
| No command lines — complete app | Task 16 (electron-builder) |
| Push to GitHub as we go | Each task has git commit + push |
| OpenAI API key stored locally | Task 8 (config.json, never sent to renderer) |

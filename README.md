# RetroFM

A personal AI FM radio station. Distils your music taste into a living radio experience — curated by an AI DJ named **Sine**, powered by your NetEase Music listening history.

Inspired by [Claudio FM](https://mmguo.dev/claudio-fm/) by mmguo.

---

## What it is

RetroFM is a desktop app that runs a private radio station tuned entirely to you. It learns your taste from years of NetEase listening history, generates program blocks of 10-15 songs, and has Sine — your AI DJ — introduce each block with spoken commentary. Between programs you can chat with Sine in text and she'll remember your preferences for future sessions.

It's not an algorithm. It has taste.

---

## How it works

### The AI DJ — Sine

Sine is a female AI DJ with a thoughtful, slightly melancholy personality. She speaks when a new program starts — introducing the block with a short audio commentary (GPT-4o script, OpenAI TTS `nova` voice). She speaks only in English; Chinese artist and song names are rendered in pinyin.

Between songs she's available to chat. Tell her to shift the mood, find something slower, or explain a pick. If you state a rule ("no rap", "more 90s stuff"), she saves it to `preferences.md` and applies it to every future program.

### The taste profile — `taste.md`

On first run, RetroFM pulls your full NetEase Music listening history (play counts, liked songs, playlists) and feeds it to GPT-4o to generate `taste.md` — a rich markdown document describing your musical personality: core genres, mood palette, time-of-day patterns, defining artists, explicit rules.

`taste.md` refreshes weekly and accumulates signal from each listening session.

### The music pool

RetroFM builds a pool from your liked songs and playlists, then enriches every song with GPT-4o-mini to add genre, mood tags, energy level, and language (NetEase provides none of this natively). The pool is sampled in three tiers every scheduling run:

| Tier | Source | Count | Purpose |
|------|--------|-------|---------|
| Anchors | Top 80 most-played | 80 | Emotional anchors — proven favourites |
| Rediscovery | Random draw from remaining played | 150 | Forgotten gems |
| Exploration | Never-played, ranked by NetEase pop score | 120 | Genuine discovery |

Each block of 10-15 songs contains a mix of all three tiers.

### Continuous playback

When 3 songs remain in the queue, the next block is prefetched silently in the background. When the last song ends, the new block starts immediately — Sine introduces it, and the station keeps rolling.

### Two-way NetEase sync

When you ❤️ a song in RetroFM, it writes back to your NetEase liked list.

---

## The interface

RetroFM runs as a fixed 375×667px phone-size window (iPhone 6/7/8 form factor). Dark mode only. No resize.

**Station View** (default):
- Dot-matrix clock — 4×7 grid per digit, colon flashes every second, purple glow
- Minimal player bar with SVG controls (prev/play/pause/next/like)
- Scrolling marquee for long track names
- Named program queue — scrollable, auto-scrolls to now-playing after 10s idle
- Refresh button — generates a fresh program on demand
- Chat history — full text conversation with Sine

**Speaking View** (when Sine starts a new block):
- Full-width animated voice waveform
- White card slides up with episode title, song name, song progress bar
- Timestamped transcript builds as she speaks
- Music auto-ducks to 12% while Sine talks, fades back up over 2.5s as she finishes

---

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 30 |
| Backend | Node.js + Express |
| Music source | NeteaseCloudMusicApi (unofficial npm) |
| AI — curation, commentary, taste | OpenAI GPT-4o |
| AI — chat replies, pool enrichment | OpenAI GPT-4o-mini |
| DJ voice | OpenAI TTS `tts-1-hd`, voice `nova` |
| Frontend | Vanilla JS + HTML/CSS (no framework) |
| Fonts | Martian Mono (UI) · IBM Plex Mono (chat) |

---

## Design

- **Palette**: Midnight Ink — deep blue-black (`#06060e`), indigo accents (`#6666ff`), zone tinting per section
- **Logo**: ✳ purple eight-point star
- **Canvas**: 375×667px fixed, phone portrait
- **Clock**: 7×7px dots, 2px gap, 4 cols × 7 rows per digit

---

## Project structure

```
RetroFM/
├── electron/
│   ├── main.js             # BrowserWindow (375×667, hidden titlebar)
│   └── preload.js
├── server/
│   ├── index.js            # Express entry, mounts all routes
│   ├── netease/
│   │   ├── client.js       # NeteaseCloudMusicApi singleton + cookie session
│   │   ├── auth.js         # QR login flow
│   │   └── library.js      # Pool build, play record, GPT-4o-mini enrichment
│   ├── openai/
│   │   ├── client.js       # OpenAI SDK singleton
│   │   ├── commentary.js   # Episode title + DJ script
│   │   ├── chat.js         # Conversational replies + preference detection
│   │   └── tts.js          # Text → audio buffer (nova voice)
│   ├── taste/
│   │   ├── generate.js     # taste.md from play history
│   │   └── preferences.js  # Read/write preferences.md
│   ├── scheduler/
│   │   └── programs.js     # One block (10-15 songs) per call, excludeIds support
│   └── routes/
│       ├── auth.js
│       ├── library.js
│       ├── player.js       # /url/:id, /like
│       ├── programs.js     # /today, /refresh, /next
│       ├── commentary.js
│       ├── chat.js
│       └── taste.js
├── renderer/
│   ├── index.html
│   ├── css/
│   │   ├── variables.css   # Design tokens + canvas dimensions
│   │   ├── layout.css      # Phone canvas, nav, view switching
│   │   ├── station.css     # Clock, player, queue, chat
│   │   ├── speaking.css    # Speaking view
│   │   └── onboarding.css
│   └── js/
│       ├── api.js          # Fetch wrapper
│       ├── app.js          # Bootstrap, view switching, onboarding
│       ├── clock.js        # Dot-matrix clock renderer
│       ├── player.js       # Audio, queue, controls, near-end/queue-end callbacks
│       ├── station.js      # Program loading, auto-advance, commentary
│       ├── speaking.js     # Speaking view controller
│       ├── waveform.js     # Canvas waveform animation
│       └── chat.js         # Chat UI + API calls
├── data/
│   ├── taste.md            # Generated taste profile (git-ignored)
│   ├── preferences.md      # User rules captured from chat (git-ignored)
│   ├── pool.json           # Enriched song pool cache (git-ignored)
│   └── programs.json       # Today's program cache (git-ignored)
├── RetroFM.bat             # One-click launcher (clears ELECTRON_RUN_AS_NODE)
└── README.md
```

---

## Setup

You will need:
- Node.js 20+
- An OpenAI API key
- A NetEase Music account

```bash
git clone https://github.com/simon-senpai/RetroFM.git
cd RetroFM
npm install
```

Launch by double-clicking **RetroFM.bat** (Windows). On first run:
1. Enter your OpenAI API key on the onboarding screen
2. Scan the NetEase QR code to log in
3. RetroFM builds your taste profile and starts playing

Do not launch via `npm start` from a Claude Code / VS Code terminal — the `ELECTRON_RUN_AS_NODE` environment variable those shells set will prevent Electron from opening a window. Use `RetroFM.bat` instead.

---

## Status

✅ Working — May 2026.

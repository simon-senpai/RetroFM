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
    document.querySelectorAll('.transcript-line').forEach(l => l.classList.add('old'))

    const line = document.createElement('div')
    line.className = 'transcript-line'
    line.innerHTML = `<span class="ts">${Speaking._fmt(timestampSec)} →</span>${text}`

    const transcript = document.getElementById('transcript')
    transcript.appendChild(line)
    transcript.scrollTop = transcript.scrollHeight
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

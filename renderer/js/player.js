const Player = (() => {
  const audio = document.getElementById('audio-player')
  let queue = []
  let currentIndex = 0
  let likedIds = new Set()
  const _sessionSignals = { liked: [], skipped: [], chatTopics: [] }

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

  audio.addEventListener('ended', () => {
    if (audio.currentTime / audio.duration < 0.5) {
      _sessionSignals.skipped.push(queue[currentIndex]?.id)
    }
    next()
  })

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
    if (nowLiked) _sessionSignals.liked.push(song.id)
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

  return { setQueue, next, prev, currentSong, loadTrack, _getSignals: () => _sessionSignals }
})()

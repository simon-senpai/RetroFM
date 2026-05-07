const Player = (() => {
  const audio = document.getElementById('audio-player')
  let queue = []
  let currentIndex = 0
  let likedIds = new Set()
  const _sessionSignals = { liked: [], skipped: [], chatTopics: [] }
  let _fadeTimer = null

  let _nearEndCb = null
  let _queueEndCb = null
  let _nearEndFired = false
  const NEAR_END_THRESHOLD = 3

  function _fadeTo(target, durationMs) {
    if (_fadeTimer) clearInterval(_fadeTimer)
    const steps = 40
    const stepMs = durationMs / steps
    const start = audio.volume
    const delta = (target - start) / steps
    let i = 0
    _fadeTimer = setInterval(() => {
      i++
      audio.volume = Math.min(1, Math.max(0, start + delta * i))
      if (i >= steps) { clearInterval(_fadeTimer); _fadeTimer = null }
    }, stepMs)
  }

  function duck()   { _fadeTo(0.12, 600) }
  function unduck() { _fadeTo(1.0, 2500) }

  function _checkNearEnd() {
    const remaining = queue.length - currentIndex
    if (remaining <= NEAR_END_THRESHOLD && _nearEndCb && !_nearEndFired) {
      _nearEndFired = true
      _nearEndCb()
    }
  }

  async function loadTrack(song) {
    try {
      const { url } = await API.get(`/api/player/url/${song.id}`)
      if (!url) {
        console.warn(`No URL for "${song.name}" — skipping`)
        setTimeout(next, 200)
        return
      }
      audio.src = url
      audio.play()
    } catch(e) {
      console.warn(`Failed to load "${song.name}":`, e.message)
      setTimeout(next, 200)
      return
    }
    setScrollText('track-name', song.name)
    setScrollText('track-artist', song.artist)
    document.getElementById('btn-like').innerHTML = likedIds.has(song.id) ? SVG_HEART_FILLED : SVG_HEART_EMPTY
    document.getElementById('btn-like').classList.toggle('liked', likedIds.has(song.id))
    renderQueue()
  }

  function renderQueue() {
    const list = document.getElementById('queue-list')
    list.innerHTML = queue.map((s, i) => `
      <div class="queue-item ${i === currentIndex ? 'now-playing' : ''}" data-idx="${i}">
        <span class="qi-dot">${i === currentIndex ? '▶' : ''}</span>
        <span class="qi-name">${s.name}</span>
        <span class="qi-artist">${s.artist}</span>
      </div>
    `).join('')
    list.querySelectorAll('.queue-item').forEach(el => {
      el.addEventListener('click', () => { currentIndex = +el.dataset.idx; loadTrack(queue[currentIndex]) })
    })
    document.getElementById('queue-name').textContent  = queue._programName || '—'
    document.getElementById('queue-count').textContent = `${queue.length} tracks`
    scheduleQueueAutoScroll()
  }

  let _queueScrollTimer = null
  function scheduleQueueAutoScroll() {
    clearTimeout(_queueScrollTimer)
    _queueScrollTimer = setTimeout(() => {
      const el = document.querySelector('#queue-list .queue-item.now-playing')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 10000)
  }

  function next() {
    if (currentIndex < queue.length - 1) {
      currentIndex++
      loadTrack(queue[currentIndex])
      _checkNearEnd()
    } else {
      if (_queueEndCb) _queueEndCb()
    }
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

  const SVG_PAUSE        = `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="0" width="4" height="12"/><rect x="7" y="0" width="4" height="12"/></svg>`
  const SVG_PLAY         = `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><polygon points="0,0 0,12 12,6"/></svg>`
  const SVG_HEART_EMPTY  = `<svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M6,10.3 C5.2,9.6 1,6.6 1,4 C1,2.3 2.3,1 4,1 C5,1 5.7,1.6 6,2.1 C6.3,1.6 7,1 8,1 C9.7,1 11,2.3 11,4 C11,6.6 6.8,9.6 6,10.3Z"/></svg>`
  const SVG_HEART_FILLED = `<svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><path d="M6,10.3 C5.2,9.6 1,6.6 1,4 C1,2.3 2.3,1 4,1 C5,1 5.7,1.6 6,2.1 C6.3,1.6 7,1 8,1 C9.7,1 11,2.3 11,4 C11,6.6 6.8,9.6 6,10.3Z"/></svg>`

  document.getElementById('btn-play').addEventListener('click', () => {
    const btn = document.getElementById('btn-play')
    if (audio.paused) { audio.play();  btn.innerHTML = SVG_PAUSE }
    else              { audio.pause(); btn.innerHTML = SVG_PLAY  }
  })
  document.getElementById('btn-next').addEventListener('click', next)
  document.getElementById('btn-prev').addEventListener('click', prev)

  document.getElementById('btn-like').addEventListener('click', async () => {
    const song = queue[currentIndex]
    if (!song) return
    const nowLiked = !likedIds.has(song.id)
    if (nowLiked) likedIds.add(song.id); else likedIds.delete(song.id)
    document.getElementById('btn-like').innerHTML = nowLiked ? SVG_HEART_FILLED : SVG_HEART_EMPTY
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
    _nearEndFired = false
    if (songs.length > 0) {
      loadTrack(songs[0])
      _checkNearEnd()
    }
  }

  function setScrollText(id, text) {
    const el = document.getElementById(id)
    el.classList.remove('scrolling')
    el.innerHTML = `<span>${text}</span>`
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const span = el.querySelector('span')
      if (!span) return
      const overflow = span.scrollWidth - el.clientWidth
      if (overflow > 4) {
        el.style.setProperty('--marquee-x', `-${overflow + 8}px`)
        el.classList.add('scrolling')
      }
    }))
  }

  document.getElementById('queue-list').addEventListener('scroll', scheduleQueueAutoScroll)

  function onNearEnd(cb) { _nearEndCb = cb; _nearEndFired = false }
  function onQueueEnd(cb) { _queueEndCb = cb }
  function getQueueIds() { return queue.map(s => s.id) }

  function currentSong() { return queue[currentIndex] || null }
  function fmt(s) { const t=Math.floor(s||0); return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}` }

  return { setQueue, next, prev, currentSong, loadTrack, duck, unduck, onNearEnd, onQueueEnd, getQueueIds, _getSignals: () => _sessionSignals }
})()

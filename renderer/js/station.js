const Station = {
  _nextBlock: null,
  _nextBlockFetching: false,

  async init() {
    const { exists } = await API.get('/api/taste')
    if (!exists) {
      Chat.addMessage('dj', 'Building your taste profile from 10 years of listening history… give me a moment.')
      await API.post('/api/taste/generate', {})
      Chat.addMessage('dj', 'Got it. I know what you like. Let me put together today\'s program.')
    }
    await Station.loadProgram()
  },

  async loadProgram() {
    try {
      const { blocks } = await API.get('/api/programs/today')
      if (!blocks?.length) {
        Chat.addMessage('dj', 'Having trouble scheduling today\'s program — try restarting.')
        return
      }
      Station.startBlock(blocks[0])
    } catch(e) {
      Chat.addMessage('dj', 'Could not load today\'s programs. Check your connection.')
    }
  },

  async refresh() {
    const btn = document.getElementById('btn-refresh')
    btn.classList.add('spinning')
    btn.disabled = true
    Chat.addMessage('dj', 'Give me a moment — putting together a fresh program for you.')
    try {
      const { blocks } = await API.post('/api/programs/refresh', {})
      if (!blocks?.length) throw new Error('empty')
      Station.startBlock(blocks[0])
    } catch(e) {
      Chat.addMessage('dj', 'Could not refresh the program — try again in a moment.')
    } finally {
      btn.classList.remove('spinning')
      btn.disabled = false
    }
  },

  startBlock(block) {
    Station._nextBlock = null
    Station._nextBlockFetching = false
    Player.setQueue(block.songs, block.name)
    Player.onNearEnd(() => Station._prefetchNext())
    Player.onQueueEnd(() => Station._advanceNext())
    Station.requestCommentary(block)
  },

  async _prefetchNext() {
    if (Station._nextBlockFetching || Station._nextBlock) return
    Station._nextBlockFetching = true
    try {
      const excludeIds = Player.getQueueIds()
      const { block } = await API.post('/api/programs/next', { excludeIds })
      Station._nextBlock = block
    } catch(e) {
      console.warn('Next block prefetch failed:', e.message)
    } finally {
      Station._nextBlockFetching = false
    }
  },

  async _advanceNext() {
    // Wait for in-flight prefetch to finish
    if (Station._nextBlockFetching) {
      await new Promise(resolve => {
        const iv = setInterval(() => {
          if (!Station._nextBlockFetching) { clearInterval(iv); resolve() }
        }, 300)
      })
    }
    if (Station._nextBlock) {
      Station.startBlock(Station._nextBlock)
    } else {
      try {
        const { block } = await API.post('/api/programs/next', {})
        Station.startBlock(block)
      } catch(e) {
        Chat.addMessage('dj', 'That\'s all for now — tap refresh for a fresh program.')
      }
    }
  },

  async requestCommentary(block) {
    const song = Player.currentSong()
    if (!song) return
    try {
      const { episodeTitle, script, audioUrl } =
        await API.post('/api/commentary/generate', { block, song })

      Speaking.show({
        episodeTitle,
        songName: song.name,
        artist: song.artist,
        durationSec: (song.duration || 0) / 1000
      })

      const djAudio = document.getElementById('dj-audio')
      djAudio.src = audioUrl
      djAudio.play()
      Player.duck()
      Station._streamTranscript(script, djAudio)
    } catch(e) {
      console.warn('Commentary failed:', e.message)
    }
  },

  _streamTranscript(script, djAudio) {
    const sentences = script.match(/[^.!?]+[.!?]+/g) || [script]

    let _unduckFired = false
    function _maybeUnduck() {
      if (_unduckFired) return
      if (djAudio.duration && djAudio.duration - djAudio.currentTime <= 3) {
        _unduckFired = true
        Player.unduck()
      }
    }
    djAudio.addEventListener('timeupdate', _maybeUnduck)

    djAudio.addEventListener('loadedmetadata', () => {
      const avgDur = djAudio.duration || 20
      const interval = (avgDur / sentences.length) * 1000
      sentences.forEach((s, i) => {
        setTimeout(() => {
          Speaking.addLine(i * (avgDur / sentences.length), s.trim())
          Speaking.updateDjTime(i * (avgDur / sentences.length))
        }, i * interval)
      })
    }, { once: true })

    djAudio.addEventListener('ended', () => {
      djAudio.removeEventListener('timeupdate', _maybeUnduck)
      if (!_unduckFired) Player.unduck()
      setTimeout(() => {
        Speaking.hide()
        Chat.addMessage('dj', script)
      }, 1200)
    }, { once: true })
  }
}

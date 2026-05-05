const Station = {
  _blocks: [],
  _blockIndex: 0,

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
      Station._blocks = blocks
      Station._blockIndex = 0
      Station.startBlock(0)
    } catch(e) {
      Chat.addMessage('dj', 'Could not load today\'s programs. Check your connection.')
    }
  },

  startBlock(idx) {
    const block = Station._blocks[idx]
    if (!block) return
    Player.setQueue(block.songs, block.name)
    Station.requestCommentary(block)
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
      Station._streamTranscript(script, djAudio)
    } catch(e) {
      console.warn('Commentary failed:', e.message)
    }
  },

  _streamTranscript(script, djAudio) {
    const sentences = script.match(/[^.!?]+[.!?]+/g) || [script]

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
      setTimeout(() => Speaking.hide(), 1200)
    }, { once: true })
  }
}

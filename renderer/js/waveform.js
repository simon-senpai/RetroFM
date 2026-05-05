const Waveform = {
  build(containerId, count = 90) {
    const el = document.getElementById(containerId)
    el.innerHTML = ''
    for (let i = 0; i < count; i++) {
      const bar = document.createElement('div')
      bar.className = 'wbar'
      const h = 8 + Math.random() * 34
      const delay = (Math.random() * 0.5).toFixed(2)
      const dur  = (0.4 + Math.random() * 0.35).toFixed(2)
      bar.style.height = `${h}px`
      bar.style.animationDelay = `${delay}s`
      bar.style.animationDuration = `${dur}s`
      el.appendChild(bar)
    }
  },

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

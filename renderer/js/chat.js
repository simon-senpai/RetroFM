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
    try {
      const result = await API.post('/api/chat', { message: text, currentQueue })
      addMessage('dj', result.reply)
      if (result.suggestedSongs?.length) {
        setTimeout(() => {
          Player.setQueue(result.suggestedSongs, 'Your request')
        }, 1500)
      }
    } catch(e) {
      addMessage('dj', 'Something went wrong — try again in a moment.')
    }
  }

  sendBtn.addEventListener('click', send)
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send() })

  return { addMessage }
})()

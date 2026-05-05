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
  const now = new Date()
  const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
  setTimeout(() => { renderClock(); setInterval(renderClock, 60000) }, msToNextMinute)
}

window.Clock = { init: initClock }

const { app, BrowserWindow, nativeTheme } = require('electron')
const path = require('path')

nativeTheme.themeSource = 'dark'

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
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  })

  const { startServer } = require('../server/index')
  startServer().then(port => {
    win.loadURL(`http://127.0.0.1:${port}`)
    win.once('ready-to-show', () => win.show())
  })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())

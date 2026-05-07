const { app, BrowserWindow, nativeTheme } = require('electron')
const path = require('path')

nativeTheme.themeSource = 'dark'

let win

async function createWindow() {
  const { startServer } = require('../server/index')
  const port = await startServer()

  win = new BrowserWindow({
    width: 375,
    height: 667,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    backgroundColor: '#06060e',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  })

  win.loadURL(`http://127.0.0.1:${port}`)
  win.once('ready-to-show', () => win.show())

  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools({ mode: 'detach' })
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

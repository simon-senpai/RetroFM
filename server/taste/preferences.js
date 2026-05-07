const path = require('path')
const fs = require('fs-extra')

const PREFS_FILE = path.join(__dirname, '../../data/preferences.md')

async function readPreferences() {
  if (await fs.pathExists(PREFS_FILE)) return fs.readFile(PREFS_FILE, 'utf8')
  return ''
}

async function appendPreference(rule) {
  const date = new Date().toISOString().slice(0, 10)
  const line = `- ${rule} (added ${date})\n`
  const existing = await readPreferences()
  if (!existing) {
    await fs.outputFile(PREFS_FILE,
      `# User Preferences\n_Explicit rules stated during sessions._\n\n## Rules\n${line}`)
  } else {
    const updated = existing.includes('## Rules\n')
      ? existing.replace('## Rules\n', `## Rules\n${line}`)
      : existing + line
    await fs.outputFile(PREFS_FILE, updated)
  }
}

module.exports = { readPreferences, appendPreference }

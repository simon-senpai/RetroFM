const { OpenAI } = require('openai')
const { loadConfig } = require('../netease/client')

let _client = null

async function getClient() {
  if (_client) return _client
  const config = await loadConfig()
  if (!config.openaiKey) throw new Error('OpenAI key not set')
  _client = new OpenAI({ apiKey: config.openaiKey })
  return _client
}

function resetClient() { _client = null }

module.exports = { getClient, resetClient }

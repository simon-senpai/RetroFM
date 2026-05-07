const {
  user_playlist,
  user_record,
  playlist_detail,
  recommend_songs,
} = require('NeteaseCloudMusicApi')
const { getCookie, getUid } = require('./client')
const { getClient } = require('../openai/client')
const path = require('path')
const fs = require('fs-extra')

const POOL_CACHE = path.join(__dirname, '../../data/pool.json')
const POOL_TTL_MS = 6 * 60 * 60 * 1000

async function buildPool() {
  if (await fs.pathExists(POOL_CACHE)) {
    const { ts, songs } = await fs.readJson(POOL_CACHE)
    if (Date.now() - ts < POOL_TTL_MS) return songs
  }

  const cookie = getCookie()
  const uid    = getUid()
  const songs  = new Map()
  const playCountMap = new Map()

  const addSong = s => {
    if (!s?.id || songs.has(s.id)) return
    songs.set(s.id, {
      id: s.id,
      name: s.name,
      artist: Array.isArray(s.ar) ? s.ar.map(a => a.name).join(', ')
            : (s.artists?.map(a => a.name).join(', ') || ''),
      album:    s.al?.name || s.album?.name || '',
      duration: s.dt       || s.duration   || 0,
      year:     s.publishTime ? new Date(s.publishTime).getFullYear() : null,
      pop:      s.pop         || 0,   // NetEase popularity 0-100
    })
  }

  // 1. All-time play record — capture play counts
  try {
    const res = await user_record({ uid, type: 0, cookie })
    res.body?.allData?.forEach(({ song, playCount }) => {
      addSong(song)
      playCountMap.set(String(song.id), playCount || 0)
    })
  } catch(e) { console.warn('play record failed', e.message) }

  // 2. User playlists
  try {
    const res = await user_playlist({ uid, cookie })
    for (const pl of (res.body?.playlist || []).slice(0, 30)) {
      try {
        const det = await playlist_detail({ id: pl.id, cookie })
        det.body?.playlist?.tracks?.forEach(addSong)
      } catch(e) { /* skip */ }
    }
  } catch(e) { console.warn('playlists failed', e.message) }

  // 3. Daily recommendations
  try {
    const res = await recommend_songs({ cookie })
    res.body?.data?.dailySongs?.forEach(addSong)
  } catch(e) { console.warn('recs failed', e.message) }

  // Attach play counts; sort by play count first, break ties by NetEase popularity
  let result = Array.from(songs.values())
    .map(s => ({ ...s, playCount: playCountMap.get(String(s.id)) || 0 }))
    .sort((a, b) => (b.playCount - a.playCount) || (b.pop - a.pop))

  // Enrich with genre/mood/energy tags via GPT
  result = await enrichPool(result)

  await fs.outputJson(POOL_CACHE, { ts: Date.now(), songs: result })
  return result
}

async function enrichPool(songs) {
  const needsEnrichment = songs.filter(s => !s.genre)
  if (!needsEnrichment.length) return songs

  console.log(`Enriching ${needsEnrichment.length} songs with genre/mood tags…`)
  const ai = await getClient()
  const BATCH = 50
  const enrichMap = new Map()

  const batches = []
  for (let i = 0; i < needsEnrichment.length; i += BATCH) {
    batches.push(needsEnrichment.slice(i, i + BATCH))
  }

  await Promise.all(batches.map(async (batch) => {
    const list = batch.map(s => `${s.id}|${s.name}|${s.artist}`).join('\n')
    try {
      const res = await ai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: `Given songs as "id|name|artist", return {"songs":[...]} where each item has:
- id (string, same as input)
- genre: one of [Mandopop, Cantopop, C-Rock, C-Folk, C-Electronic, J-Pop, K-Pop, Pop, Rock, Jazz, Electronic, Hip-hop, R&B, Classical, Folk, Other]
- moods: array of 2-3 from [emotional, melancholic, upbeat, energetic, calm, romantic, nostalgic, intense, playful, dark, hopeful, raw, dreamy, powerful]
- energy: integer 1-5 (1=very calm, 5=very high energy)
- language: "zh", "en", "ko", "ja", or "other"
Use your knowledge of the artists. For unknown songs, infer from the artist's typical style.`
        }, {
          role: 'user', content: list
        }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      })
      const parsed = JSON.parse(res.choices[0].message.content)
      const arr = parsed.songs || parsed.data || Object.values(parsed)[0]
      if (Array.isArray(arr)) arr.forEach(item => enrichMap.set(String(item.id), item))
    } catch(e) {
      console.warn('Enrichment batch failed:', e.message)
    }
  }))

  return songs.map(s => {
    const tags = enrichMap.get(String(s.id))
    return {
      ...s,
      genre:    tags?.genre    || 'Unknown',
      moods:    tags?.moods    || [],
      energy:   tags?.energy   || 3,
      language: tags?.language || 'zh',
    }
  })
}

async function getPlayRecord() {
  const cookie = getCookie()
  const uid    = getUid()
  const [weekly, all] = await Promise.all([
    user_record({ uid, type: 1, cookie }),
    user_record({ uid, type: 0, cookie }),
  ])
  return {
    weekly:  weekly.body?.weekData || [],
    allTime: all.body?.allData    || [],
  }
}

module.exports = { buildPool, getPlayRecord }

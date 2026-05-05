const {
  user_playlist,
  user_record,
  playlist_detail,
  recommend_songs,
} = require('NeteaseCloudMusicApi')
const { getCookie, getUid } = require('./client')
const path = require('path')
const fs = require('fs-extra')

const POOL_CACHE = path.join(__dirname, '../../data/pool.json')
const POOL_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

async function buildPool() {
  if (await fs.pathExists(POOL_CACHE)) {
    const { ts, songs } = await fs.readJson(POOL_CACHE)
    if (Date.now() - ts < POOL_TTL_MS) return songs
  }

  const cookie = getCookie()
  const uid    = getUid()
  const songs  = new Map() // id → song object

  const addSong = s => {
    if (!s?.id) return
    songs.set(s.id, {
      id: s.id,
      name: s.name,
      artist: Array.isArray(s.ar) ? s.ar.map(a => a.name).join(', ')
            : (s.artists?.map(a => a.name).join(', ') || ''),
      album:  s.al?.name || s.album?.name || '',
      duration: s.dt || s.duration || 0, // ms
    })
  }

  // 1. All-time play record
  try {
    const { data } = await user_record({ uid, type: 0, cookie })
    data?.allData?.forEach(({ song }) => addSong(song))
  } catch(e) { console.warn('play record failed', e.message) }

  // 2. User playlists → liked + collected (cap at 30)
  try {
    const { playlist } = await user_playlist({ uid, cookie })
    for (const pl of (playlist || []).slice(0, 30)) {
      try {
        const { playlist: detail } = await playlist_detail({ id: pl.id, cookie })
        detail?.tracks?.forEach(addSong)
      } catch(e) { /* skip failed playlist */ }
    }
  } catch(e) { console.warn('playlists failed', e.message) }

  // 3. Daily recommendations
  try {
    const { data } = await recommend_songs({ cookie })
    data?.dailySongs?.forEach(addSong)
  } catch(e) { console.warn('recs failed', e.message) }

  const result = Array.from(songs.values())
  await fs.outputJson(POOL_CACHE, { ts: Date.now(), songs: result })
  return result
}

async function getPlayRecord() {
  const cookie = getCookie()
  const uid    = getUid()
  const [weekly, all] = await Promise.all([
    user_record({ uid, type: 1, cookie }),
    user_record({ uid, type: 0, cookie }),
  ])
  return {
    weekly:  weekly.data?.weekData  || [],
    allTime: all.data?.allData || [],
  }
}

module.exports = { buildPool, getPlayRecord }

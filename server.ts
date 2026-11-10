import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { ControlEvent, TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import type {
  FeedEntry,
  GiftTier,
  InteractionType,
  SceneStats,
  ServerMessage,
  TikTokStatus,
  Vec3,
  Visitor,
} from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MAX_ACTIVE_VISITORS = 120;
const MAX_FEED_ITEMS = 40;

const OUTFIT_PALETTE = [
  '#2c3e50',
  '#34495e',
  '#5d4037',
  '#37474f',
  '#455a64',
  '#6d4c41',
  '#8d6e63',
  '#78909c',
  '#b71c1c',
  '#1e3a5f',
  '#2e4a3e',
  '#4a3b52',
];

const HAIR_PALETTE = ['#1b1b1b', '#2c1e16', '#4a3222', '#6b4c35', '#8c8c8c'];
const SKIN_PALETTE = ['#f2cbb0', '#e8ba98', '#d9a47e', '#c68d65', '#f6d7c1'];

// Coordinate system aligned with 3D Anitkabir layout:
// Mozole (Hall of Honor) sits at negative Z: front colonnade faces +Z (towards Toren Meydani)
// Ceremonial stairs descend from y=3.6 (Mozole terrace, z=-22) down to y=0.2 (Toren Meydani, z=-10)
// Aslanli Yol runs along +X axis or +Z axis? Let's make Aslanli Yol run along +X from (x=115, z=12) to Toren Meydani (x=28, z=12),
// or along +Z? Looking at the aerial photo (images__10__841efa4b.jpeg):
// Toren Meydani is a grand plaza in front of the Mozole, and Aslanli Yol enters perpendicular on the side!
// Specifically, looking at the Mozole from Toren Meydani:
// - Mozole is at x = 0, z = -34 (elevated on y = 3.8 terrace, stairs from z = -22 to z = -12)
// - Toren Meydani spans x in [-26, 26], z in [-12, 30]
// - Aslanli Yol approaches Toren Meydani from the right (+X side, or -X side): in the aerial photo, when facing the Mozole, Aslanli Yol approaches from the left/front-right!
// Let's place Aslanli Yol along +X from x = 110 down to x = 28 at z = 6, entering Toren Meydani cleanly!
// And standing slots in front of the Mozole:
// - VIP / Gift slots on the upper Mozole terrace (y = 3.8, z in [-27, -23.5], x in [-16, 16])
// - General visitor slots in front of the stairs on Toren Meydani (y = 0.2, z in [-11, 8], x in [-20, 20])
const STANDING_SLOTS: Vec3[] = [];
// Neat center-outward rows in the middle of Toren Meydani (y = 0.2), facing the Mozole & Ataturk Bust
const COL_COUNT = 13;
const ROW_COUNT = 10;
const COL_SPACING = 1.65;
const ROW_SPACING = 1.65;

// Build center-out column order: 0, -1, +1, -2, +2, ...
const centerOutCols: number[] = [0];
for (let k = 1; k <= Math.floor(COL_COUNT / 2); k++) {
  centerOutCols.push(-k, k);
}

for (let row = 0; row < ROW_COUNT; row++) {
  for (const colOffset of centerOutCols) {
    STANDING_SLOTS.push({
      x: colOffset * COL_SPACING,
      y: 0.2,
      z: -9.5 + row * ROW_SPACING,
    });
  }
}

let slotCursor = 0;
let flowerCursor = 0;

function allocateFlowerSpot(): Vec3 {
  // Accumulate flowers in a semicircular ceremonial bed right at the base of the Ataturk Bust (0, 3.8, -25.8)
  const ring = Math.floor(flowerCursor / 10);
  const idxInRing = flowerCursor % 10;
  flowerCursor++;
  const angle = -Math.PI * 0.42 + (idxInRing / 9) * (Math.PI * 0.84);
  const radius = 1.05 + (ring % 4) * 0.36;
  const jitter = ((flowerCursor * 13) % 7) * 0.03 - 0.1;
  return {
    x: Math.sin(angle) * radius + jitter,
    y: 3.8,
    z: -25.6 + Math.cos(angle) * radius * 0.72,
  };
}

function allocateSlot(_giftTier: GiftTier): Vec3 {
  const idx = slotCursor % STANDING_SLOTS.length;
  slotCursor++;
  return { ...STANDING_SLOTS[idx] };
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const visitors = new Map<string, Visitor>();
const feed: FeedEntry[] = [];
const stats: SceneStats = {
  totalVisitors: 0,
  totalLikes: 0,
  totalComments: 0,
  totalGifts: 0,
  totalFlowers: 0,
  activeCount: 0,
};

let tiktokStatus: TikTokStatus = {
  connected: false,
  connecting: false,
  username: null,
  error: null,
  viewerCount: 0,
};

let activeTikTokConnection: TikTokLiveConnection | null = null;

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(msg: ServerMessage) {
  const payload = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function inferGiftTier(giftName?: string, diamondCount = 0): GiftTier {
  if (diamondCount >= 100) return 3;
  if (diamondCount >= 10) return 2;
  if (giftName) {
    const lower = giftName.toLowerCase();
    if (lower.includes('çelenk') || lower.includes('wreath') || lower.includes('lion') || lower.includes('aslan')) return 3;
    if (lower.includes('meşale') || lower.includes('torch') || lower.includes('bayrak') || lower.includes('flag')) return 2;
    return 1;
  }
  return 0;
}

function handleVisitorInteraction(params: {
  username: string;
  interactionType: InteractionType;
  message?: string;
  giftName?: string;
  giftTier?: GiftTier;
  diamondCount?: number;
  likeDelta?: number;
  outfitColor?: string;
  hairColor?: string;
  hairStyle?: 'short' | 'long' | 'bun' | 'cap' | 'kalpak';
  skinTone?: string;
}) {
  const cleanUser = params.username.trim().replace(/^@+/, '') || 'Ziyaretci';
  const key = cleanUser.toLowerCase();
  const now = Date.now();

  const resolvedTier: GiftTier =
    params.giftTier !== undefined
      ? params.giftTier
      : params.interactionType === 'gift'
        ? inferGiftTier(params.giftName, params.diamondCount)
        : 0;

  if (params.interactionType === 'like') {
    stats.totalLikes += params.likeDelta ?? 1;
  } else if (params.interactionType === 'comment') {
    stats.totalComments += 1;
  } else if (params.interactionType === 'gift') {
    stats.totalGifts += 1;
  }

  let feedText = '';
  if (params.interactionType === 'like') {
    feedText = 'Beğeni ile Anıtkabir ziyaretine katıldı';
  } else if (params.interactionType === 'follow') {
    feedText = 'Takip ederek Aslanlı Yol’a adım attı';
  } else if (params.interactionType === 'comment') {
    feedText = params.message ? `“${params.message.slice(0, 72)}”` : 'Yorum bıraktı';
  } else if (params.interactionType === 'gift') {
    feedText = `${params.giftName || 'Gül'} hediyesi ile mozoleye yürüyor`;
  }

  const existing = visitors.get(key);
  if (existing) {
    existing.interactionType = params.interactionType;
    if (params.message) existing.message = params.message.slice(0, 80);
    if (params.giftName) existing.giftName = params.giftName;
    if (params.outfitColor) existing.outfitColor = params.outfitColor;
    if (params.hairColor) existing.hairColor = params.hairColor;
    if (params.hairStyle) existing.hairStyle = params.hairStyle;
    if (params.skinTone) existing.skinTone = params.skinTone;
    if (resolvedTier > existing.giftTier) {
      existing.giftTier = resolvedTier;
    }
    if (params.interactionType === 'like') {
      existing.likeCount += params.likeDelta ?? 1;
    }
    existing.flowerSpot = allocateFlowerSpot();
    existing.joinedAt = now;
    stats.totalFlowers += 1;

    const feedEntry: FeedEntry = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      visitorId: existing.id,
      username: existing.username,
      interactionType: params.interactionType,
      text: feedText,
      giftTier: existing.giftTier,
      timestamp: now,
    };
    feed.unshift(feedEntry);
    if (feed.length > MAX_FEED_ITEMS) feed.pop();

    broadcast({
      type: 'visitor:updated',
      visitor: existing,
      feedEntry,
      stats: { ...stats },
    });
    return existing;
  }

  // Evict oldest non-VIP visitor if at capacity
  if (visitors.size >= MAX_ACTIVE_VISITORS) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of visitors.entries()) {
      const weight = v.giftTier > 0 ? 60_000 : 0;
      if (v.joinedAt + weight < oldestTime) {
        oldestTime = v.joinedAt + weight;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      const removed = visitors.get(oldestKey);
      visitors.delete(oldestKey);
      if (removed) {
        broadcast({
          type: 'visitor:removed',
          visitorId: removed.id,
          stats: { ...stats, activeCount: visitors.size },
        });
      }
    }
  }

  const visitor: Visitor = {
    id: `v-${now}-${Math.random().toString(36).slice(2, 7)}`,
    username: `@${cleanUser}`,
    interactionType: params.interactionType,
    message: params.message?.slice(0, 80),
    giftName: params.giftName,
    giftTier: resolvedTier,
    outfitColor: params.outfitColor || pickRandom(OUTFIT_PALETTE),
    hairColor: params.hairColor || pickRandom(HAIR_PALETTE),
    hairStyle: params.hairStyle || 'short',
    skinTone: params.skinTone || pickRandom(SKIN_PALETTE),
    spawnRoute: Math.random() < 0.85 ? 'aslanli' : 'plaza',
    targetSlot: allocateSlot(resolvedTier),
    flowerSpot: allocateFlowerSpot(),
    joinedAt: now,
    likeCount: params.interactionType === 'like' ? (params.likeDelta ?? 1) : 0,
  };

  visitors.set(key, visitor);
  stats.totalVisitors += 1;
  stats.totalFlowers += 1;
  stats.activeCount = visitors.size;

  const feedEntry: FeedEntry = {
    id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
    visitorId: visitor.id,
    username: visitor.username,
    interactionType: params.interactionType,
    text: feedText,
    giftTier: resolvedTier,
    timestamp: now,
  };
  feed.unshift(feedEntry);
  if (feed.length > MAX_FEED_ITEMS) feed.pop();

  broadcast({
    type: 'visitor:joined',
    visitor,
    feedEntry,
    stats: { ...stats },
  });

  if (params.interactionType === 'gift' || resolvedTier >= 1) {
    broadcast({ type: 'ceremony:start', triggeredBy: visitor.username });
  }

  return visitor;
}

async function disconnectTikTok() {
  if (activeTikTokConnection) {
    try {
      activeTikTokConnection.disconnect();
    } catch {
      // ignore disconnect errors
    }
    activeTikTokConnection = null;
  }
  tiktokStatus = {
    connected: false,
    connecting: false,
    username: null,
    error: null,
    viewerCount: 0,
  };
  broadcast({ type: 'tiktok:status', tiktok: { ...tiktokStatus } });
}

async function connectTikTok(rawUsername: string) {
  const username = rawUsername.trim().replace(/^@+/, '');
  if (!username) {
    tiktokStatus = {
      connected: false,
      connecting: false,
      username: null,
      error: 'Geçerli bir TikTok kullanıcı adı girin.',
      viewerCount: 0,
    };
    broadcast({ type: 'tiktok:status', tiktok: { ...tiktokStatus } });
    return;
  }

  await disconnectTikTok();

  tiktokStatus = {
    connected: false,
    connecting: true,
    username,
    error: null,
    viewerCount: 0,
  };
  broadcast({ type: 'tiktok:status', tiktok: { ...tiktokStatus } });

  const conn = new TikTokLiveConnection(username, {
    processInitialData: false,
    enableExtendedGiftInfo: true,
  });
  activeTikTokConnection = conn;

  conn.on(WebcastEvent.CHAT, (data) => {
    const raw = data as unknown as Record<string, any>;
    const user = raw.user?.uniqueId || raw.user?.displayId || raw.user?.nickname || 'Ziyaretci';
    handleVisitorInteraction({
      username: String(user),
      interactionType: 'comment',
      message: String(raw.comment || raw.content || ''),
    });
  });

  conn.on(WebcastEvent.LIKE, (data) => {
    const raw = data as unknown as Record<string, any>;
    const user = raw.user?.uniqueId || raw.user?.displayId || raw.user?.nickname || 'Ziyaretci';
    handleVisitorInteraction({
      username: String(user),
      interactionType: 'like',
      likeDelta: Number(raw.likeCount || raw.count || 1),
    });
  });

  conn.on(WebcastEvent.GIFT, (data) => {
    const raw = data as unknown as Record<string, any>;
    const user = raw.user?.uniqueId || raw.user?.displayId || raw.user?.nickname || 'Ziyaretci';
    if (raw.giftType === 1 && !raw.repeatEnd) return;
    handleVisitorInteraction({
      username: String(user),
      interactionType: 'gift',
      giftName: String(raw.giftDetails?.giftName || raw.gift?.name || 'Hediye'),
      diamondCount: Number(raw.giftDetails?.diamondCount || raw.gift?.diamondCount || 1),
    });
  });

  conn.on(WebcastEvent.FOLLOW, (data) => {
    const raw = data as unknown as Record<string, any>;
    const user = raw.user?.uniqueId || raw.user?.displayId || raw.user?.nickname || 'Ziyaretci';
    handleVisitorInteraction({
      username: String(user),
      interactionType: 'follow',
    });
  });

  conn.on(WebcastEvent.ROOM_USER, (data) => {
    const raw = data as unknown as Record<string, any>;
    tiktokStatus.viewerCount = Number(raw.viewerCount || raw.total || 0);
    broadcast({ type: 'tiktok:status', tiktok: { ...tiktokStatus } });
  });

  conn.on(ControlEvent.DISCONNECTED, () => {
    if (activeTikTokConnection === conn) {
      tiktokStatus = {
        ...tiktokStatus,
        connected: false,
        connecting: false,
      };
      broadcast({ type: 'tiktok:status', tiktok: { ...tiktokStatus } });
    }
  });

  try {
    await conn.connect();
    if (activeTikTokConnection === conn) {
      tiktokStatus = {
        connected: true,
        connecting: false,
        username,
        error: null,
        viewerCount: tiktokStatus.viewerCount,
      };
      broadcast({ type: 'tiktok:status', tiktok: { ...tiktokStatus } });
    }
  } catch (err) {
    if (activeTikTokConnection === conn) {
      activeTikTokConnection = null;
      const msg =
        err instanceof Error
          ? err.message
          : 'TikTok Live yayınına bağlanılamadı.';
      tiktokStatus = {
        connected: false,
        connecting: false,
        username,
        error: msg.includes('offline') || msg.includes('LIVE')
          ? `@${username} şu anda canlı yayında değil.`
          : `Bağlantı hatası: ${msg}`,
        viewerCount: 0,
      };
      broadcast({ type: 'tiktok:status', tiktok: { ...tiktokStatus } });
    }
  }
}

// REST endpoints for external TikTok webhooks (e.g. TikFinity) or health checks
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, activeVisitors: visitors.size, tiktok: tiktokStatus });
});

app.get('/api/hi3d/status', (_req, res) => {
  res.json({
    configured: Boolean(process.env.HI3D_ACCESS_KEY && process.env.HI3D_SECRET_KEY),
  });
});

async function fallbackYouTubeSearch(q: string) {
  const r = await fetch(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    },
  );
  if (!r.ok) return [];
  const html = await r.text();
  const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
  if (!match) return [];
  const data = JSON.parse(match[1]) as {
    contents?: {
      twoColumnSearchResultsRenderer?: {
        primaryContents?: {
          sectionListRenderer?: {
            contents?: Array<{
              itemSectionRenderer?: {
                contents?: Array<{
                  videoRenderer?: {
                    videoId?: string;
                    title?: { runs?: Array<{ text?: string }> };
                    ownerText?: { runs?: Array<{ text?: string }> };
                  };
                }>;
              };
            }>;
          };
        };
      };
    };
  };
  const contents =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
  return contents
    .filter((c) => c.videoRenderer?.videoId)
    .slice(0, 6)
    .map((c) => ({
      videoId: c.videoRenderer!.videoId!,
      title: c.videoRenderer?.title?.runs?.[0]?.text || q,
      subtitle: c.videoRenderer?.ownerText?.runs?.[0]?.text || 'YouTube',
    }));
}

app.get('/api/youtube/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.status(400).json({ error: 'q parameter is required' });
    return;
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  try {
    if (apiKey) {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('type', 'video');
      url.searchParams.set('videoEmbeddable', 'true');
      url.searchParams.set('maxResults', '6');
      url.searchParams.set('q', q);
      url.searchParams.set('key', apiKey);
      const resp = await fetch(url.toString());
      if (resp.ok) {
        const data = (await resp.json()) as {
          items?: Array<{
            id?: { videoId?: string };
            snippet?: { title?: string; channelTitle?: string };
          }>;
        };
        const results = (data.items || [])
          .filter((item) => item.id?.videoId)
          .map((item) => ({
            videoId: item.id!.videoId!,
            title: item.snippet?.title || q,
            subtitle: item.snippet?.channelTitle || 'YouTube',
          }));
        if (results.length > 0) {
          res.json({ ok: true, results });
          return;
        }
      }
    }

    const fallbackResults = await fallbackYouTubeSearch(q);
    res.json({ ok: true, results: fallbackResults });
  } catch {
    res.status(500).json({ error: 'YouTube search error' });
  }
});

app.post('/api/tiktok/event', (req, res) => {
  const { username, interactionType, message, giftName, giftTier, diamondCount } =
    req.body || {};
  if (!username || !interactionType) {
    res.status(400).json({ error: 'username and interactionType are required' });
    return;
  }
  const visitor = handleVisitorInteraction({
    username: String(username),
    interactionType,
    message,
    giftName,
    giftTier,
    diamondCount,
  });
  res.json({ ok: true, visitor });
});

app.post('/api/tiktok/connect', async (req, res) => {
  const { username } = req.body || {};
  await connectTikTok(String(username || ''));
  res.json({ ok: true, tiktok: tiktokStatus });
});

app.post('/api/tiktok/disconnect', async (_req, res) => {
  await disconnectTikTok();
  res.json({ ok: true, tiktok: tiktokStatus });
});

wss.on('connection', (ws) => {
  const initMsg: ServerMessage = {
    type: 'state:init',
    visitors: Array.from(visitors.values()),
    feed: [...feed],
    stats: { ...stats, activeCount: visitors.size },
    tiktok: { ...tiktokStatus },
  };
  ws.send(JSON.stringify(initMsg));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'event:send') {
        handleVisitorInteraction({
          username: String(msg.username || 'Ziyaretci'),
          interactionType: msg.interactionType || 'like',
          message: msg.message,
          giftName: msg.giftName,
          giftTier: msg.giftTier,
          outfitColor: msg.outfitColor,
          hairColor: msg.hairColor,
          hairStyle: msg.hairStyle,
          skinTone: msg.skinTone,
        });
      } else if (msg.type === 'tiktok:connect') {
        void connectTikTok(String(msg.username || ''));
      } else if (msg.type === 'tiktok:disconnect') {
        void disconnectTikTok();
      } else if (msg.type === 'ceremony:start') {
        broadcast({
          type: 'ceremony:start',
          triggeredBy: String(msg.triggeredBy || 'Tören Kıta Komutanlığı'),
        });
      } else if (msg.type === 'ceremony:salute') {
        broadcast({ type: 'ceremony:salute' });
      } else if (msg.type === 'scene:clear') {
        visitors.clear();
        feed.length = 0;
        slotCursor = 0;
        flowerCursor = 0;
        stats.activeCount = 0;
        stats.totalFlowers = 0;
        broadcast({ type: 'scene:cleared', stats: { ...stats } });
      }
    } catch {
      // ignore malformed messages
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Anitkabir 3D server running on http://localhost:${PORT}`);
  });
}

void startServer();

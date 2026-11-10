import { useCallback, useEffect, useRef, useState } from 'react';
import { AnitkabirViewport } from './components/AnitkabirViewport';
import { ControlDock } from './components/ControlDock';
import { PWAInstallButton } from './components/PWAInstallButton';
import { AtaturkQuoteBanner } from './components/AtaturkQuoteBanner';
import type {
  CameraPreset,
  FeedEntry,
  GiftTier,
  HairStyle,
  InteractionType,
  SceneStats,
  ServerMessage,
  TimeOfDay,
  TikTokStatus,
  Visitor,
} from './types';

export default function App() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [stats, setStats] = useState<SceneStats>({
    totalVisitors: 0,
    totalLikes: 0,
    totalComments: 0,
    totalGifts: 0,
    totalFlowers: 0,
    activeCount: 0,
  });
  const [tiktokStatus, setTiktokStatus] = useState<TikTokStatus>({
    connected: false,
    connecting: false,
    username: null,
    error: null,
    viewerCount: 0,
  });
  const [wsConnected, setWsConnected] = useState(false);

  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');
  const [showLabels, setShowLabels] = useState(true);
  const [autoRotate360, setAutoRotate360] = useState(false);
  const [autoFollowNew, setAutoFollowNew] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [ceremonyEvent, setCeremonyEvent] = useState<{ id: number; triggeredBy: string } | null>(null);
  const [saluteSignal, setSaluteSignal] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let active = true;
    let reconnectTimer = 0;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!active) return;
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        if (!active) return;
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          if (msg.type === 'state:init') {
            setVisitors(msg.visitors);
            setFeed(msg.feed);
            setStats(msg.stats);
            setTiktokStatus(msg.tiktok);
          } else if (msg.type === 'visitor:joined') {
            setVisitors((prev) =>
              prev.some((v) => v.id === msg.visitor.id) ? prev : [...prev, msg.visitor],
            );
            setFeed((prev) => [msg.feedEntry, ...prev].slice(0, 40));
            setStats(msg.stats);
          } else if (msg.type === 'visitor:updated') {
            setVisitors((prev) =>
              prev.map((v) => (v.id === msg.visitor.id ? msg.visitor : v)),
            );
            setFeed((prev) => [msg.feedEntry, ...prev].slice(0, 40));
            setStats(msg.stats);
          } else if (msg.type === 'visitor:removed') {
            setVisitors((prev) => prev.filter((v) => v.id !== msg.visitorId));
            setStats(msg.stats);
          } else if (msg.type === 'tiktok:status') {
            setTiktokStatus(msg.tiktok);
          } else if (msg.type === 'scene:cleared') {
            setVisitors([]);
            setFeed([]);
            setStats(msg.stats);
          } else if (msg.type === 'ceremony:start') {
            setCeremonyEvent({ id: Date.now() + Math.random(), triggeredBy: msg.triggeredBy });
            setCameraPreset('mozole');
          } else if (msg.type === 'ceremony:salute') {
            setSaluteSignal((n) => n + 1);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!active) return;
        setWsConnected(false);
        reconnectTimer = window.setTimeout(connect, 2000);
      };
    }

    connect();

    return () => {
      active = false;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const sendWs = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  // Keyboard shortcuts 'H' (toggle dock) and 'S' (Asker Selami)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((c) => !c);
      } else if (e.key === 's' || e.key === 'S') {
        sendWs({ type: 'ceremony:salute' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sendWs]);

  const handleSendEvent = useCallback(
    (payload: {
      username: string;
      interactionType: InteractionType;
      message?: string;
      giftName?: string;
      giftTier?: GiftTier;
      outfitColor?: string;
      hairColor?: string;
      hairStyle?: HairStyle;
      skinTone?: string;
    }) => {
      sendWs({ type: 'event:send', ...payload });
    },
    [sendWs],
  );

  const handleConnectTikTok = useCallback(
    (username: string) => {
      sendWs({ type: 'tiktok:connect', username });
    },
    [sendWs],
  );

  const handleDisconnectTikTok = useCallback(() => {
    sendWs({ type: 'tiktok:disconnect' });
  }, [sendWs]);

  const handleClearScene = useCallback(() => {
    sendWs({ type: 'scene:clear' });
  }, [sendWs]);

  const handleUserOrbitStart = useCallback(() => {
    // Allow smooth manual inspection without fighting presets
  }, []);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0e1116]">
      {/* 100% Unobstructed 3D Viewport */}
      <AnitkabirViewport
        visitors={visitors}
        cameraPreset={cameraPreset}
        timeOfDay={timeOfDay}
        showLabels={showLabels}
        autoRotate360={autoRotate360}
        autoFollowNew={autoFollowNew}
        ceremonyEvent={ceremonyEvent}
        saluteSignal={saluteSignal}
        onUserOrbitStart={handleUserOrbitStart}
        onAutoFollowTriggered={() => setCameraPreset('follow')}
      />

      {/* Top-Left Minimal Title & Live Metrics (No backdrop-blur, no pulsing dots, no pills) */}
      <header className="pointer-events-none fixed top-2.5 left-2.5 z-20 flex flex-col gap-0.5 px-3 py-1.5 rounded-lg bg-[#12161f]/90 border border-white/15">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-sm font-semibold tracking-wide text-amber-200 whitespace-nowrap">
            Anıtkabir 3D
          </h1>
          <span className="text-[11px] text-stone-400 whitespace-nowrap">
            {tiktokStatus.connected
              ? `Canlı: @${tiktokStatus.username}`
              : wsConnected
                ? 'Canlı Akış'
                : 'Bağlanıyor'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-stone-300 font-mono-num whitespace-nowrap">
          <span>Ziyaretçi {stats.activeCount}</span>
          <span aria-hidden="true">·</span>
          <span>Çiçek {stats.totalFlowers}</span>
          <span aria-hidden="true">·</span>
          <span>Beğeni {stats.totalLikes}</span>
          <span aria-hidden="true">·</span>
          <span>Hediye {stats.totalGifts}</span>
        </div>
      </header>

      <PWAInstallButton />
      <AtaturkQuoteBanner />

      {/* Collapsible Bottom Control Dock */}
      <ControlDock
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((c) => !c)}
        cameraPreset={cameraPreset}
        onSelectCamera={(preset) => {
          setCameraPreset(preset);
          if (preset !== 'follow') setAutoRotate360(false);
        }}
        timeOfDay={timeOfDay}
        onSelectTime={setTimeOfDay}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((s) => !s)}
        autoRotate360={autoRotate360}
        onToggleAutoRotate360={() => {
          setAutoRotate360((r) => {
            if (!r && cameraPreset === 'follow') setCameraPreset('overview');
            return !r;
          });
        }}
        autoFollowNew={autoFollowNew}
        onToggleAutoFollowNew={() => setAutoFollowNew((f) => !f)}
        tiktokStatus={tiktokStatus}
        recentFeed={feed}
        onSendEvent={handleSendEvent}
        onConnectTikTok={handleConnectTikTok}
        onDisconnectTikTok={handleDisconnectTikTok}
        onStartCeremony={() => sendWs({ type: 'ceremony:start' })}
        onTriggerSalute={() => sendWs({ type: 'ceremony:salute' })}
        onClearScene={handleClearScene}
      />
    </main>
  );
}

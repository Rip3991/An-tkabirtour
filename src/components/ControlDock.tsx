import { useState } from 'react';
import {
  Award,
  Camera,
  ChevronDown,
  ChevronUp,
  Flame,
  Flower2,
  Heart,
  MessageSquare,
  Moon,
  Music,
  Pause,
  Play,
  Radio,
  RotateCw,
  Search,
  Send,
  Shield,
  Sun,
  Sunset,
  Tag,
  Trash2,
  Trophy,
  UserPlus,
  Video,
  Volume2,
} from 'lucide-react';
import {
  CEREMONIAL_PLAYLIST,
  type MusicTrack,
  synthPlayer,
} from '../audio/ceremonialMusic';
import type {
  CameraPreset,
  FeedEntry,
  GiftTier,
  HairStyle,
  InteractionType,
  TimeOfDay,
  TikTokStatus,
} from '../types';

interface ControlDockProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  cameraPreset: CameraPreset;
  onSelectCamera: (preset: CameraPreset) => void;
  timeOfDay: TimeOfDay;
  onSelectTime: (t: TimeOfDay) => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  autoRotate360: boolean;
  onToggleAutoRotate360: () => void;
  autoFollowNew: boolean;
  onToggleAutoFollowNew: () => void;
  tiktokStatus: TikTokStatus;
  recentFeed: FeedEntry[];
  onSendEvent: (payload: {
    username: string;
    interactionType: InteractionType;
    message?: string;
    giftName?: string;
    giftTier?: GiftTier;
    outfitColor?: string;
    hairColor?: string;
    hairStyle?: HairStyle;
    skinTone?: string;
  }) => void;
  onConnectTikTok: (username: string) => void;
  onDisconnectTikTok: () => void;
  onStartCeremony: () => void;
  onTriggerSalute: () => void;
  onClearScene: () => void;
}

type DockTab = 'join' | 'creator' | 'tiktok' | 'music' | 'camera' | 'feed';

export function ControlDock({
  collapsed,
  onToggleCollapse,
  cameraPreset,
  onSelectCamera,
  timeOfDay,
  onSelectTime,
  showLabels,
  onToggleLabels,
  autoRotate360,
  onToggleAutoRotate360,
  autoFollowNew,
  onToggleAutoFollowNew,
  tiktokStatus,
  recentFeed,
  onSendEvent,
  onConnectTikTok,
  onDisconnectTikTok,
  onStartCeremony,
  onTriggerSalute,
  onClearScene,
}: ControlDockProps) {
  const [activeTab, setActiveTab] = useState<DockTab>('join');
  const [username, setUsername] = useState('ziyaretci_tr');
  const [commentText, setCommentText] = useState('');
  const [tiktokUser, setTiktokUser] = useState(tiktokStatus.username || '');
  const [tracks, setTracks] = useState<MusicTrack[]>(CEREMONIAL_PLAYLIST);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<'youtube' | 'synth'>('youtube');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  // Custom 3D Character Creator state
  const [charName, setCharName] = useState('atam_izindeyiz');
  const [charOutfit, setCharOutfit] = useState('#1e3a5f');
  const [charHairStyle, setCharHairStyle] = useState<HairStyle>('kalpak');
  const [charHairColor, setCharHairColor] = useState('#2c1e16');
  const [charSkin, setCharSkin] = useState('#e8ba98');
  const [charGiftTier, setCharGiftTier] = useState<GiftTier>(1);
  const [charMsg, setCharMsg] = useState('Saygı ve minnetle anıyoruz.');

  const handleSpawnCustomCharacter = (e: React.FormEvent) => {
    e.preventDefault();
    const giftNames: Record<GiftTier, string | undefined> = {
      0: undefined,
      1: 'Karanfil',
      2: 'Meşale',
      3: 'Altın Çelenk',
    };
    onSendEvent({
      username: charName.trim() || 'ziyaretci_tr',
      interactionType: charGiftTier > 0 ? 'gift' : 'comment',
      message: charMsg.trim() || undefined,
      giftName: giftNames[charGiftTier],
      giftTier: charGiftTier,
      outfitColor: charOutfit,
      hairColor: charHairColor,
      hairStyle: charHairStyle,
      skinTone: charSkin,
    });
  };

  const playTrack = (track: MusicTrack, mode: 'youtube' | 'synth' = playMode) => {
    synthPlayer.stop();
    setCurrentTrack(track);
    setPlayMode(mode);
    setIsPlaying(true);
    if (track.isAnthem) {
      onTriggerSalute();
    }
    if (mode === 'synth' && track.synthNotes) {
      synthPlayer.play(track.synthNotes, () => setIsPlaying(false));
    } else if (mode === 'synth' && !track.synthNotes) {
      // Fallback to YouTube if track has no synth notes
      setPlayMode('youtube');
    }
  };

  const stopPlayback = () => {
    synthPlayer.stop();
    setIsPlaying(false);
  };

  const handleMusicSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchMsg(null);

    // Direct YouTube URL / ID support
    const ytMatch = q.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
    if (ytMatch) {
      const custom: MusicTrack = {
        id: `yt-${ytMatch[1]}`,
        title: 'Özel YouTube Parçası',
        subtitle: ytMatch[1],
        youtubeId: ytMatch[1],
      };
      setTracks((prev) => [custom, ...prev]);
      playTrack(custom, 'youtube');
      setSearchQuery('');
      return;
    }

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        setSearchMsg('YouTube araması şu an yanıt vermiyor; hazır liste veya video linki kullanabilirsiniz.');
        return;
      }
      const data = (await res.json()) as {
        results?: Array<{ videoId: string; title: string; subtitle: string }>;
      };
      if (data.results && data.results.length > 0) {
        const mapped: MusicTrack[] = data.results.map((r) => ({
          id: `yt-${r.videoId}`,
          title: r.title,
          subtitle: r.subtitle,
          youtubeId: r.videoId,
        }));
        setTracks((prev) => [...mapped, ...prev]);
        playTrack(mapped[0], 'youtube');
        setSearchQuery('');
      } else {
        setSearchMsg('Sonuç bulunamadı.');
      }
    } catch {
      setSearchMsg('Arama sırasında bağlantı hatası oluştu.');
    }
  };

  const handleLike = () => {
    onSendEvent({
      username: username.trim() || 'ziyaretci_tr',
      interactionType: 'like',
    });
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onSendEvent({
      username: username.trim() || 'ziyaretci_tr',
      interactionType: 'comment',
      message: commentText.trim(),
    });
    setCommentText('');
  };

  const handleGift = (giftName: string, giftTier: GiftTier) => {
    onSendEvent({
      username: username.trim() || 'ziyaretci_tr',
      interactionType: 'gift',
      giftName,
      giftTier,
    });
  };

  const handleTikTokSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tiktokStatus.connected) {
      onDisconnectTikTok();
    } else if (tiktokUser.trim()) {
      onConnectTikTok(tiktokUser.trim());
    }
  };

  return (
    <div
      className="fixed bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center transition-transform duration-300 ease-out"
      style={{
        width: 'min(760px, 96vw)',
        transform: collapsed ? 'translate(-50%, calc(100% - 28px))' : 'translate(-50%, 0)',
      }}
    >
      {/* Collapse / Expand Toggle Handle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex items-center gap-1 px-3 py-1 rounded-t-lg bg-[#12161f]/95 border border-b-0 border-white/15 text-[11px] font-medium text-stone-200 hover:text-white transition-colors whitespace-nowrap"
      >
        {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        <span>{collapsed ? 'Kontrolleri Göster (H)' : 'Kontrolleri Gizle (H)'}</span>
      </button>

      {/* Main Dock Container (no backdrop-blur over WebGL) */}
      <div className="w-full rounded-xl bg-[#12161f]/95 border border-white/15 shadow-2xl p-2 sm:p-2.5 text-stone-100">
        {/* Top Row: Compact Tabs + Quick Camera/Time (fits cleanly on one row) */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 mb-2 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-0.5 p-0.5 rounded-lg bg-black/35">
            <button
              type="button"
              onClick={() => setActiveTab('join')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'join'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              Katılım
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('creator')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'creator'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <UserPlus className="w-3 h-3" />
              <span>Karakter</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tiktok')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'tiktok'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              TikTok
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('music')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'music'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Music className="w-3 h-3" />
              <span>Müzik</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'camera'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              Kamera
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('feed')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'feed'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              Akış ({recentFeed.length})
            </button>
          </div>

          {/* Quick Time-of-Day & Label Toggles */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelectTime('morning')}
              title="Sabah Işığı"
              className={`p-1.5 rounded-md border text-[11px] transition-colors ${
                timeOfDay === 'morning'
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                  : 'bg-black/30 border-white/10 text-stone-400 hover:text-white'
              }`}
            >
              <Sun className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onSelectTime('golden')}
              title="Gün Batımı"
              className={`p-1.5 rounded-md border text-[11px] transition-colors ${
                timeOfDay === 'golden'
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                  : 'bg-black/30 border-white/10 text-stone-400 hover:text-white'
              }`}
            >
              <Sunset className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onSelectTime('night')}
              title="Gece Aydınlatması"
              className={`p-1.5 rounded-md border text-[11px] transition-colors ${
                timeOfDay === 'night'
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                  : 'bg-black/30 border-white/10 text-stone-400 hover:text-white'
              }`}
            >
              <Moon className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onToggleAutoRotate360}
              title="360° Çevre Turu"
              className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap ${
                autoRotate360
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                  : 'bg-black/30 border-white/10 text-stone-400 hover:text-white'
              }`}
            >
              <RotateCw className="w-3 h-3" />
              <span>360°</span>
            </button>
            <button
              type="button"
              onClick={onToggleAutoFollowNew}
              title="Yeni Ziyaretçiyi Otomatik Takip Et"
              className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap ${
                autoFollowNew
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                  : 'bg-black/30 border-white/10 text-stone-400 hover:text-white'
              }`}
            >
              <Video className="w-3 h-3" />
              <span>Takip</span>
            </button>
            <button
              type="button"
              onClick={onToggleLabels}
              title="Ziyaretçi İsimlerini Göster/Gizle"
              className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap ${
                showLabels
                  ? 'bg-white/15 border-white/25 text-white'
                  : 'bg-black/30 border-white/10 text-stone-400 hover:text-white'
              }`}
            >
              <Tag className="w-3 h-3" />
              <span>İsim</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Join / Like / Comment / Gift */}
        {activeTab === 'join' && (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-black/40 border border-white/15 rounded-lg px-2.5 py-1.5 min-w-[160px]">
                <span className="text-stone-400 text-xs mr-1">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="kullanici_adi"
                  maxLength={24}
                  className="bg-transparent text-xs text-white focus:outline-none w-28 sm:w-36"
                />
              </div>

              <button
                type="button"
                onClick={handleLike}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Beğeniyle Katıl</span>
              </button>

              <form onSubmit={handleComment} className="flex flex-1 items-center gap-1.5 min-w-[200px]">
                <div className="flex flex-1 items-center bg-black/40 border border-white/15 rounded-lg px-2.5 py-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-stone-400 mr-1.5 shrink-0" />
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Mozoleye mesaj bırak..."
                    maxLength={72}
                    className="bg-transparent text-xs text-white focus:outline-none w-full"
                  />
                </div>
                <button
                  type="submit"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Yorum</span>
                </button>
              </form>
            </div>

            {/* Gift Tier & Ceremony Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onStartCeremony}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/40 text-xs font-semibold text-amber-200 transition-colors whitespace-nowrap"
                >
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Çelenk Töreni</span>
                </button>
                <button
                  type="button"
                  onClick={onTriggerSalute}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/40 text-xs font-semibold text-emerald-200 transition-colors whitespace-nowrap"
                >
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Asker Selamı (S)</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleGift('Gül', 1)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-rose-950/60 border border-rose-500/30 text-xs font-medium text-rose-200 transition-colors whitespace-nowrap"
                >
                  <Flower2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Gül</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleGift('Meşale', 2)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-orange-950/60 border border-orange-500/30 text-xs font-medium text-orange-200 transition-colors whitespace-nowrap"
                >
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span>Meşale</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleGift('Altın Çelenk', 3)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-xs font-semibold text-amber-200 transition-colors whitespace-nowrap"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Altın Çelenk</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: 3D Character Creator */}
        {activeTab === 'creator' && (
          <form onSubmit={handleSpawnCustomCharacter} className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-black/40 border border-white/15 rounded-lg px-2.5 py-1.5">
                <span className="text-stone-400 text-xs mr-1">@</span>
                <input
                  type="text"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  placeholder="karakter_adi"
                  maxLength={24}
                  className="bg-transparent text-xs text-white focus:outline-none w-28"
                />
              </div>

              <select
                value={charHairStyle}
                onChange={(e) => setCharHairStyle(e.target.value as HairStyle)}
                className="bg-black/50 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-stone-100 focus:outline-none"
              >
                <option value="kalpak">Kalpak</option>
                <option value="short">Klasik Kısa Saç</option>
                <option value="long">Uzun Saç</option>
                <option value="bun">Topuz</option>
                <option value="cap">Şapka</option>
              </select>

              <select
                value={charGiftTier}
                onChange={(e) => setCharGiftTier(Number(e.target.value) as GiftTier)}
                className="bg-black/50 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-stone-100 focus:outline-none"
              >
                <option value={1}>Karanfil Buketi</option>
                <option value={2}>Meşale & Çiçek</option>
                <option value={3}>Altın Çelenk (Tören)</option>
              </select>

              <input
                type="text"
                value={charMsg}
                onChange={(e) => setCharMsg(e.target.value)}
                placeholder="Ziyaret mesajı..."
                maxLength={72}
                className="flex-1 min-w-[160px] bg-black/40 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-stone-400 mr-1">Kıyafet:</span>
                  {['#1e3a5f', '#2c3e50', '#b71c1c', '#2e4a3e', '#5d4037', '#d4d4d8'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCharOutfit(c)}
                      style={{ backgroundColor: c }}
                      className={`w-4 h-4 rounded-full border ${
                        charOutfit === c ? 'border-amber-400 scale-110' : 'border-white/25'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-stone-400 mr-1">Saç:</span>
                  {['#1b1b1b', '#2c1e16', '#6b4c35', '#8c8c8c'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCharHairColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-4 h-4 rounded-full border ${
                        charHairColor === c ? 'border-amber-400 scale-110' : 'border-white/25'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-stone-400 mr-1">Ten:</span>
                  {['#f6d7c1', '#e8ba98', '#d9a47e', '#c68d65'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCharSkin(c)}
                      style={{ backgroundColor: c }}
                      className={`w-4 h-4 rounded-full border ${
                        charSkin === c ? 'border-amber-400 scale-110' : 'border-white/25'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>3D Karakteri Sahneye Gönder</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: TikTok Live Connection */}
        {activeTab === 'tiktok' && (
          <div className="flex flex-col gap-2">
            <form onSubmit={handleTikTokSubmit} className="flex flex-wrap items-center gap-2">
              <div className="flex flex-1 items-center bg-black/40 border border-white/15 rounded-lg px-3 py-1.5 min-w-[220px]">
                <Radio className="w-4 h-4 text-stone-400 mr-2 shrink-0" />
                <span className="text-stone-400 text-xs mr-1">@</span>
                <input
                  type="text"
                  value={tiktokUser}
                  onChange={(e) => setTiktokUser(e.target.value)}
                  disabled={tiktokStatus.connected || tiktokStatus.connecting}
                  placeholder="TikTok canlı yayın kullanıcı adı"
                  className="bg-transparent text-xs text-white focus:outline-none w-full disabled:opacity-60"
                />
              </div>
              <button
                type="submit"
                disabled={tiktokStatus.connecting}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  tiktokStatus.connected
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-stone-950 disabled:opacity-50'
                }`}
              >
                {tiktokStatus.connecting
                  ? 'Bağlanıyor...'
                  : tiktokStatus.connected
                    ? 'Bağlantıyı Kes'
                    : 'Canlı Yayına Bağlan'}
              </button>
            </form>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
              <span>
                {tiktokStatus.connected
                  ? `Bağlı: @${tiktokStatus.username} · İzleyici: ${tiktokStatus.viewerCount}`
                  : tiktokStatus.error
                    ? tiktokStatus.error
                    : 'Canlı yayındaki beğeni, yorum, takip ve hediyeler anlık olarak ziyaretçi oluşturur.'}
              </span>
              <span className="font-mono-num text-[11px] text-stone-500">
                Webhook: POST /api/tiktok/event
              </span>
            </div>
          </div>
        )}

        {/* Tab 3: Mars & Muzik (YouTube + Web Audio Synth) */}
        {activeTab === 'music' && (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <form onSubmit={handleMusicSearch} className="flex flex-1 items-center gap-1.5 min-w-[220px]">
                <div className="flex flex-1 items-center bg-black/40 border border-white/15 rounded-lg px-2.5 py-1.5">
                  <Search className="w-3.5 h-3.5 text-stone-400 mr-1.5 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="YouTube ara veya video linki yapıştır..."
                    className="bg-transparent text-xs text-white focus:outline-none w-full"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-600 text-xs font-medium text-white whitespace-nowrap"
                >
                  Ara / Aç
                </button>
              </form>

              <div className="flex items-center gap-1.5">
                {currentTrack && (
                  <button
                    type="button"
                    onClick={() => (isPlaying ? stopPlayback() : playTrack(currentTrack))}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-stone-950 text-xs font-semibold whitespace-nowrap"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? 'Durdur' : 'Devam Et'}</span>
                  </button>
                )}
                {currentTrack?.synthNotes && (
                  <button
                    type="button"
                    onClick={() =>
                      playTrack(currentTrack, playMode === 'youtube' ? 'synth' : 'youtube')
                    }
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/15 text-xs text-stone-200 hover:text-white whitespace-nowrap"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{playMode === 'youtube' ? 'Orkestra Sentezi' : 'YouTube'}</span>
                  </button>
                )}
              </div>
            </div>

            {searchMsg && <p className="text-[11px] text-amber-300">{searchMsg}</p>}

            <div className="flex items-start gap-2.5">
              <div className="grid flex-1 grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-28 overflow-y-auto pr-1">
                {tracks.map((t) => {
                  const active = currentTrack?.id === t.id && isPlaying;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => playTrack(t)}
                      className={`flex flex-col items-start text-left px-2.5 py-1.5 rounded-lg border transition-colors ${
                        active
                          ? 'bg-amber-500/20 border-amber-400/60 text-amber-100'
                          : 'bg-black/35 border-white/10 text-stone-300 hover:text-white hover:border-white/25'
                      }`}
                    >
                      <span className="text-xs font-semibold truncate w-full">{t.title}</span>
                      <span className="text-[10px] text-stone-400 truncate w-full">{t.subtitle}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Off-screen Background YouTube Player (non-zero size so playback works without visible UI) */}
        {isPlaying && playMode === 'youtube' && currentTrack && (
          <div className="fixed -left-[9999px] -top-[9999px] w-60 h-36 pointer-events-none overflow-hidden" aria-hidden="true">
            <iframe
              key={currentTrack.youtubeId}
              title={currentTrack.title}
              src={`https://www.youtube.com/embed/${currentTrack.youtubeId}?autoplay=1&playsinline=1&rel=0`}
              allow="autoplay; encrypted-media"
              className="w-60 h-36 border-0"
            />
          </div>
        )}

        {/* Tab 4: Camera Presets & Scene Actions */}
        {activeTab === 'camera' && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['overview', 'Genel Bakış'],
                  ['mozole', 'Mozole Önü'],
                  ['aslanli', 'Aslanlı Yol'],
                  ['plaza', 'Tören Meydanı'],
                  ['bayrak', 'Bayrak'],
                  ['follow', 'Ziyaretçi Takip'],
                ] as Array<[CameraPreset, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectCamera(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    cameraPreset === key
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-black/35 border border-white/10 text-stone-300 hover:text-white'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClearScene}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/35 hover:bg-rose-950/60 border border-white/10 text-xs font-medium text-stone-300 hover:text-rose-200 transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Meydanı Temizle</span>
            </button>
          </div>
        )}

        {/* Tab 4: Live Activity Feed */}
        {activeTab === 'feed' && (
          <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
            {recentFeed.length === 0 ? (
              <p className="text-xs text-stone-400 py-2">
                Henüz ziyaretçi akışı yok. Beğeni, yorum veya hediye göndererek ilk ziyaretçiyi başlatın.
              </p>
            ) : (
              recentFeed.slice(0, 12).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 text-xs py-1 border-b border-white/5 last:border-b-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-amber-300 shrink-0">{item.username}</span>
                    <span className="text-stone-300 truncate">{item.text}</span>
                  </div>
                  <span className="font-mono-num text-[11px] text-stone-500 shrink-0">
                    {new Date(item.timestamp).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

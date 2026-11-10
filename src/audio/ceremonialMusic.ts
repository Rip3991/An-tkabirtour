export interface MusicTrack {
  id: string;
  title: string;
  subtitle: string;
  youtubeId: string;
  isAnthem?: boolean;
  synthNotes?: Array<{ freq: number; dur: number }>;
}

// Note frequencies (Hz)
const N = {
  R: 0,
  C4: 261.63,
  D4: 293.66,
  Eb4: 311.13,
  E4: 329.63,
  F4: 349.23,
  Fs4: 369.99,
  G4: 392.0,
  Ab4: 415.3,
  A4: 440.0,
  Bb4: 466.16,
  B4: 493.88,
  C5: 523.25,
  Db5: 554.37,
  D5: 587.33,
  Eb5: 622.25,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
};

export const CEREMONIAL_PLAYLIST: MusicTrack[] = [
  {
    id: 'istiklal-marsi',
    title: 'İstiklal Marşı',
    subtitle: 'Resmi Tören Orkestrası',
    youtubeId: 'Y75Km7dlt94',
    isAnthem: true,
    synthNotes: [
      { freq: N.C4, dur: 0.45 },
      { freq: N.E4, dur: 0.45 },
      { freq: N.G4, dur: 0.45 },
      { freq: N.B4, dur: 0.7 },
      { freq: N.A4, dur: 0.3 },
      { freq: N.G4, dur: 0.45 },
      { freq: N.F4, dur: 0.45 },
      { freq: N.E4, dur: 0.9 },
      { freq: N.E4, dur: 0.45 },
      { freq: N.G4, dur: 0.45 },
      { freq: N.C5, dur: 0.7 },
      { freq: N.B4, dur: 0.3 },
      { freq: N.A4, dur: 0.45 },
      { freq: N.G4, dur: 0.45 },
      { freq: N.Fs4, dur: 0.9 },
      { freq: N.G4, dur: 0.45 },
      { freq: N.A4, dur: 0.45 },
      { freq: N.B4, dur: 0.45 },
      { freq: N.C5, dur: 0.7 },
      { freq: N.D5, dur: 0.3 },
      { freq: N.C5, dur: 0.45 },
      { freq: N.B4, dur: 0.45 },
      { freq: N.A4, dur: 0.9 },
      { freq: N.G4, dur: 0.45 },
      { freq: N.F4, dur: 0.45 },
      { freq: N.E4, dur: 0.45 },
      { freq: N.D4, dur: 0.45 },
      { freq: N.C4, dur: 1.1 },
    ],
  },
  {
    id: 'onuncu-yil-marsi',
    title: '10. Yıl Marşı',
    subtitle: 'Cumhuriyet Marşı',
    youtubeId: 'x8TbtZb-7sw',
    synthNotes: [
      { freq: N.C4, dur: 0.35 },
      { freq: N.E4, dur: 0.35 },
      { freq: N.G4, dur: 0.35 },
      { freq: N.C5, dur: 0.6 },
      { freq: N.C5, dur: 0.35 },
      { freq: N.B4, dur: 0.35 },
      { freq: N.A4, dur: 0.35 },
      { freq: N.G4, dur: 0.7 },
      { freq: N.F4, dur: 0.35 },
      { freq: N.A4, dur: 0.35 },
      { freq: N.G4, dur: 0.35 },
      { freq: N.E4, dur: 0.7 },
      { freq: N.D4, dur: 0.35 },
      { freq: N.F4, dur: 0.35 },
      { freq: N.E4, dur: 0.35 },
      { freq: N.C4, dur: 0.9 },
    ],
  },
  {
    id: 'sari-zeybek',
    title: 'Sarı Zeybek',
    subtitle: "Atatürk'ün Sevdiği Türkü",
    youtubeId: '-73jXTEW8_c',
    synthNotes: [
      { freq: N.A4, dur: 0.5 },
      { freq: N.B4, dur: 0.4 },
      { freq: N.C5, dur: 0.6 },
      { freq: N.B4, dur: 0.4 },
      { freq: N.A4, dur: 0.5 },
      { freq: N.G4, dur: 0.5 },
      { freq: N.A4, dur: 0.9 },
      { freq: N.E4, dur: 0.5 },
      { freq: N.G4, dur: 0.4 },
      { freq: N.F4, dur: 0.5 },
      { freq: N.E4, dur: 0.9 },
    ],
  },
  {
    id: 'vardar-ovasi',
    title: 'Vardar Ovası',
    subtitle: "Atatürk'ün Sevdiği Rumeli Türküsü",
    youtubeId: 'me4l4hk5-uc',
  },
  {
    id: 'fikrimin-ince-gulu',
    title: 'Fikrimin İnce Gülü',
    subtitle: "Atatürk'ün Sevdiği Şarkı",
    youtubeId: 'b0CQkKl5uYI',
  },
  {
    id: 'bulbulum-altin-kafeste',
    title: 'Bülbülüm Altın Kafeste',
    subtitle: "Atatürk'ün Sevdiği Türkü",
    youtubeId: 'pThuxkPZB8U',
  },
  {
    id: 'izmir-marsi',
    title: 'İzmir Marşı',
    subtitle: 'Tarihi Marş',
    youtubeId: '7jxuiDKBxg4',
  },
];

class CeremonialSynthPlayer {
  private ctx: AudioContext | null = null;
  private timerId = 0;
  private playing = false;

  public play(notes: Array<{ freq: number; dur: number }>, onEnded?: () => void) {
    this.stop();
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    this.playing = true;
    let idx = 0;

    const scheduleNext = () => {
      if (!this.playing || !this.ctx) return;
      if (idx >= notes.length) {
        this.playing = false;
        onEnded?.();
        return;
      }
      const note = notes[idx++];
      if (note.freq > 0) {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.freq, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.14, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.dur * 0.92);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + note.dur);
      }
      this.timerId = window.setTimeout(scheduleNext, note.dur * 1000);
    };

    scheduleNext();
  }

  public stop() {
    this.playing = false;
    clearTimeout(this.timerId);
  }
}

export const synthPlayer = new CeremonialSynthPlayer();

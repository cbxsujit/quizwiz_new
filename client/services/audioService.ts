
// Simple Synthesized Audio Service
// This generates retro-style game sounds using the Web Audio API
// No external assets required.

interface MusicTrack {
  id: string;
  name: string;
  melody: number[];
  tempo: number; // seconds per beat
  oscType: OscillatorType;
  gain: number; // Volume compensation for different wave types
}

const TRACKS: MusicTrack[] = [
  { 
    id: 'zen', 
    name: 'Zen Garden', 
    melody: [261.63, 329.63, 392.00, 493.88], // C E G B
    tempo: 0.6,
    oscType: 'sine',
    gain: 1.0
  },
  { 
    id: 'retro', 
    name: '8-Bit Rush', 
    melody: [440, 523.25, 659.25, 783.99, 523.25, 659.25], // A C E G C E
    tempo: 0.25,
    oscType: 'square',
    gain: 0.25
  },
  { 
    id: 'tension', 
    name: 'Deep Space', 
    melody: [146.83, 155.56, 146.83, 196.00], // D D# D G (Low)
    tempo: 1.0,
    oscType: 'triangle',
    gain: 0.6
  },
   { 
    id: 'cyber', 
    name: 'Neon Drive', 
    melody: [220, 277.18, 329.63, 277.18, 440, 329.63], // A C# E C# A E
    tempo: 0.2,
    oscType: 'sawtooth',
    gain: 0.25
  },
  {
    id: 'funky',
    name: 'Funky Town',
    melody: [392.00, 392.00, 440.00, 392.00, 523.25, 493.88], // G G A G C B
    tempo: 0.3,
    oscType: 'square',
    gain: 0.25
  },
  {
    id: 'mystery',
    name: 'Mystery Solver',
    melody: [440.00, 466.16, 587.33, 466.16], // A Bb D Bb
    tempo: 0.7,
    oscType: 'triangle',
    gain: 0.6
  },
  {
    id: 'happy',
    name: 'Happy Vibes',
    melody: [523.25, 587.33, 659.25, 523.25, 659.25, 783.99], // C D E C E G
    tempo: 0.3,
    oscType: 'sine',
    gain: 1.0
  },
  {
    id: 'action',
    name: 'Action Hero',
    melody: [110.00, 110.00, 146.83, 110.00, 164.81, 146.83], // A A D A E D (Low)
    tempo: 0.15,
    oscType: 'sawtooth',
    gain: 0.25
  },
  {
    id: 'digital',
    name: 'Digital Rain',
    melody: [659.25, 587.33, 523.25, 493.88, 440.00, 392.00], // E D C B A G
    tempo: 0.12,
    oscType: 'sine',
    gain: 0.9
  }
];

class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.5;
  
  // Music State
  private isPlayingMusic: boolean = false;
  private nextNoteTime: number = 0;
  private timerID: number | null = null;
  private melodyIndex: number = 0;
  
  private currentTrack: MusicTrack = TRACKS[0];

  public init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.updateGain();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.error("Audio resume failed", e));
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    this.updateGain();
  }

  public getVolume(): number {
      return this.volume;
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    this.updateGain();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    return this.isMuted;
  }

  private updateGain() {
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0 : this.volume;
      // Smooth transition
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    }
  }

  // --- Music Scheduler ---
  
  public getTracks() {
      return TRACKS.map(t => ({ id: t.id, name: t.name }));
  }

  public getCurrentTrackId() {
      return this.currentTrack.id;
  }

  public setTrack(id: string) {
      const track = TRACKS.find(t => t.id === id);
      if (track) {
          this.currentTrack = track;
          this.melodyIndex = 0; // Reset melody to start
      }
  }

  public startMusic() {
      if (this.isPlayingMusic) return;
      this.init();
      this.isPlayingMusic = true;
      this.melodyIndex = 0;
      if (this.ctx) {
          this.nextNoteTime = this.ctx.currentTime + 0.1;
          this.scheduleNote();
      }
  }

  public stopMusic() {
      this.isPlayingMusic = false;
      if (this.timerID) window.clearTimeout(this.timerID);
  }

  private scheduleNote() {
      if (!this.ctx || !this.masterGain || !this.isPlayingMusic) return;

      const secondsPerBeat = this.currentTrack.tempo;
      const lookahead = 25.0; // ms
      const scheduleAheadTime = 0.1; // s

      while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
          this.playMusicNote(this.nextNoteTime);
          this.nextNoteTime += secondsPerBeat;
      }
      
      this.timerID = window.setTimeout(() => this.scheduleNote(), lookahead);
  }

  private playMusicNote(time: number) {
      if (!this.ctx || !this.masterGain) return;

      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc.connect(noteGain);
      noteGain.connect(this.masterGain);

      // Pick note from current track
      const melody = this.currentTrack.melody;
      const freq = melody[this.melodyIndex % melody.length];
      
      // Randomize octave occasionally for variation
      const octave = Math.random() > 0.8 ? 2 : 1; 
      
      osc.frequency.value = freq / octave; 
      osc.type = this.currentTrack.oscType;

      // Duration relative to tempo
      const duration = this.currentTrack.tempo * 0.8;

      osc.start(time);
      osc.stop(time + duration);

      // Envelope
      // Increased the base volume multiplier from 0.1 to 0.4 to significantly boost volume
      const maxVol = 0.4 * this.currentTrack.gain;

      noteGain.gain.setValueAtTime(0, time);
      noteGain.gain.linearRampToValueAtTime(maxVol, time + (duration * 0.1));
      noteGain.gain.linearRampToValueAtTime(0, time + duration);

      this.melodyIndex++;
  }

  // --- Sound Effects ---

  playJoin() {
    this.playTone(600, 'sine', 0.1);
    setTimeout(() => this.playTone(800, 'sine', 0.2), 100);
  }

  playStart() {
    this.playTone(400, 'square', 0.1);
    setTimeout(() => this.playTone(600, 'square', 0.1), 100);
    setTimeout(() => this.playTone(1000, 'square', 0.4), 200);
  }

  playTick() {
    this.playTone(800, 'triangle', 0.05, 0.2); // Louder tick
  }

  playTickUrgent() {
    this.playTone(1200, 'sawtooth', 0.05, 0.2);
  }

  playCorrect() {
    this.playTone(600, 'sine', 0.1);
    setTimeout(() => this.playTone(1200, 'sine', 0.1), 100);
    setTimeout(() => this.playTone(1800, 'sine', 0.4), 200);
  }

  playWrong() {
    this.playTone(200, 'sawtooth', 0.2);
    setTimeout(() => this.playTone(150, 'sawtooth', 0.4), 150);
  }

  playGameOver() {
    this.playTone(500, 'sine', 0.2);
    setTimeout(() => this.playTone(400, 'sine', 0.2), 200);
    setTimeout(() => this.playTone(300, 'sine', 0.2), 400);
    setTimeout(() => this.playTone(600, 'square', 0.8), 600);
  }

  private playTone(freq: number, type: OscillatorType, duration: number, relVolume: number = 0.3) {
    // relVolume is relative to Master Volume. Default raised to 0.3 for audibility
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    osc.connect(gain);
    gain.connect(this.masterGain);

    gain.gain.setValueAtTime(relVolume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}

export const audio = new AudioService();

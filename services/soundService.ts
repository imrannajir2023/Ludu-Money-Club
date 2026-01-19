
const SOUND_URLS = {
  // Classic board game dice shake sound
  dice: 'https://cdn.pixabay.com/audio/2022/03/15/audio_7314732688.mp3', 
  // Solid landing sound
  dice_stop: 'https://assets.mixkit.co/active_storage/sfx/2567/2567-preview.mp3', 
  // Pop/Step sound for moving pieces
  move: 'https://cdn.pixabay.com/audio/2021/08/04/audio_06d6a2f92d.mp3',
  // Aggressive capture/knockout sound
  kill: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c983a54721.mp3',
  // Grand victory fanfare
  win: 'https://cdn.pixabay.com/audio/2021/08/04/audio_5eb103437a.mp3',
  // UI Button click
  click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  // Special chime for rolling a six
  six: 'https://cdn.pixabay.com/audio/2021/08/04/audio_c340d85915.mp3'
};

class SoundService {
  private sounds: Record<string, HTMLAudioElement> = {};
  private muted: boolean = false;

  constructor() {
    Object.entries(SOUND_URLS).forEach(([key, url]) => {
      this.sounds[key] = new Audio(url);
      this.sounds[key].preload = 'auto';
    });
  }

  play(name: keyof typeof SOUND_URLS) {
    if (this.muted) return;
    const sound = this.sounds[name];
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(e => console.warn(`Sound ${name} play failed:`, e));
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }
}

export const soundManager = new SoundService();

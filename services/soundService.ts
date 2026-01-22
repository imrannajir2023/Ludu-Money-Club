
const SOUND_URLS = {
  // Snappy rattling dice
  dice: 'https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3', 
  // Landing sound
  dice_stop: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', 
  // "Tok" sound for movement
  move: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  // Impact sound for capture
  kill: 'https://assets.mixkit.co/active_storage/sfx/1110/1110-preview.mp3',
  // Finish/Home chime
  win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  // Button click
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  // Success chime for six
  six: 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3'
};

class SoundService {
  private sounds: Record<string, HTMLAudioElement> = {};
  private muted: boolean = false;
  private unlocked: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      Object.entries(SOUND_URLS).forEach(([key, url]) => {
        const audio = new Audio(url);
        audio.preload = 'auto';
        this.sounds[key] = audio;
      });
    }
  }

  // This should be called on the first user interaction
  unlock() {
    if (this.unlocked) return;
    Object.values(this.sounds).forEach(sound => {
      sound.play().then(() => {
        sound.pause();
        sound.currentTime = 0;
      }).catch(() => {
        // Still locked or failed, that's fine
      });
    });
    this.unlocked = true;
    console.log("Audio Unlocked");
  }

  play(name: keyof typeof SOUND_URLS) {
    if (this.muted) return;
    const sound = this.sounds[name];
    if (sound) {
      sound.currentTime = 0;
      if (name === 'move') sound.playbackRate = 2.0; // Fast tok-tok
      
      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn(`Playback failed for ${name}:`, error);
          // If playback fails, it's usually because user hasn't interacted yet
          this.unlocked = false;
        });
      }
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

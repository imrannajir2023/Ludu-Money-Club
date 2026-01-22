
const SOUND_URLS = {
  // Shaking dice in a cup sound
  dice: 'https://www.soundjay.com/misc/sounds/dice-shake-1.mp3', 
  // Clean dice stop click
  dice_stop: 'https://www.soundjay.com/buttons/sounds/button-16.mp3', 
  // Sharp pop sound (the iconic Tok-Tok)
  move: 'https://www.soundjay.com/communication/sounds/pop-1.mp3',
  // Impact/Crash for killing a piece
  kill: 'https://assets.mixkit.co/active_storage/sfx/1110/1110-preview.mp3',
  // Home/Win chime
  win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  // Simple UI click
  click: 'https://www.soundjay.com/buttons/sounds/button-20.mp3',
  // Success chime for a six
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

  unlock() {
    if (this.unlocked) return;
    Object.values(this.sounds).forEach(sound => {
      sound.play().then(() => {
        sound.pause();
        sound.currentTime = 0;
      }).catch(() => {});
    });
    this.unlocked = true;
  }

  play(name: keyof typeof SOUND_URLS) {
    if (this.muted) return;
    const sound = this.sounds[name];
    if (sound) {
      sound.currentTime = 0;
      
      // Speed up the "Tok" sound slightly to make it snappier
      if (name === 'move') {
        sound.playbackRate = 2.5; 
      } else {
        sound.playbackRate = 1.0;
      }
      
      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn(`Playback failed for ${name}:`, error);
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

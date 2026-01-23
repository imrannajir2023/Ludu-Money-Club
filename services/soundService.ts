
const SOUND_URLS = {
  // Dice rolling sound (rattling in a cup)
  dice: 'https://assets.mixkit.co/active_storage/sfx/2004/2004-preview.mp3', 
  // Dice landing/stop sound
  dice_stop: 'https://assets.mixkit.co/active_storage/sfx/2001/2001-preview.mp3', 
  // Short snappy movement sound for each step
  move: 'https://www.soundjay.com/communication/sounds/pop-1.mp3',
  // Crunchy impact sound for capturing an opponent
  kill: 'https://assets.mixkit.co/active_storage/sfx/1110/1110-preview.mp3',
  // Triumphant sound when reaching home or winning
  win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  // General UI interaction sound
  click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  // Celebratory sound for rolling a six
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

  // Critical for mobile browsers: Must be called on first user interaction
  unlock() {
    if (this.unlocked) return;
    Object.values(this.sounds).forEach(sound => {
      sound.play().then(() => {
        sound.pause();
        sound.currentTime = 0;
      }).catch(() => {});
    });
    this.unlocked = true;
    console.log("Audio Engine Unlocked");
  }

  play(name: keyof typeof SOUND_URLS) {
    if (this.muted) return;
    const sound = this.sounds[name];
    if (sound) {
      sound.currentTime = 0;
      
      // Adjust playback rate to get that perfect "Tok" sound for movement
      if (name === 'move') {
        sound.playbackRate = 3.5; 
      } else {
        sound.playbackRate = 1.0;
      }
      
      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // Silent catch for interaction rules
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

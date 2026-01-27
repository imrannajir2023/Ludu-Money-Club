
const SOUND_URLS = {
  dice: 'https://assets.mixkit.co/active_storage/sfx/2004/2004-preview.mp3', 
  dice_stop: 'https://assets.mixkit.co/active_storage/sfx/2001/2001-preview.mp3', 
  move: 'https://www.soundjay.com/communication/sounds/pop-1.mp3',
  kill: 'https://assets.mixkit.co/active_storage/sfx/1110/1110-preview.mp3',
  win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
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

  // Mobile/Web browser unlock sequence
  unlock() {
    if (this.unlocked) return;
    
    const silentPlay = async (audio: HTMLAudioElement) => {
      try {
        audio.muted = true;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      } catch (e) {
        // Silently ignore
      }
    };

    Object.values(this.sounds).forEach(silentPlay);
    this.unlocked = true;
    console.log("🔊 Audio System Unlocked Successfully");
  }

  play(name: keyof typeof SOUND_URLS) {
    if (this.muted) return;
    
    const sound = this.sounds[name];
    if (sound) {
      sound.currentTime = 0;
      
      // Fine-tune specific sounds
      if (name === 'move') {
        sound.playbackRate = 3.0; 
      } else {
        sound.playbackRate = 1.0;
      }
      
      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // If play fails, it usually means interaction hasn't happened yet
          console.warn(`Audio play failed for ${name}:`, error);
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

export class SoundManager {
    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.25;
        this.masterGain.connect(this.ctx.destination);
        
        // Ambient nodes
        this.ambientGain = null;
        this.ambientOsc = null;
        this.ambientOsc2 = null;
        this.ambientNoise = null;
        this.ambientPlaying = false;
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type, duration, vol = 1, slide = 0) {
        if (this.ctx.state === 'suspended') return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slide !== 0) {
            osc.frequency.exponentialRampToValueAtTime(
                Math.max(freq * slide, 20), this.ctx.currentTime + duration
            );
        }
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playNoise(duration, vol = 1, lowpassFreq = 0) {
        if (this.ctx.state === 'suspended') return;

        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        if (bufferSize <= 0) return;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        
        if (lowpassFreq > 0) {
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(lowpassFreq, this.ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(
                Math.max(lowpassFreq * 0.1, 20), this.ctx.currentTime + duration
            );
            
            noiseSource.connect(filter);
            filter.connect(gain);
        } else {
            noiseSource.connect(gain);
        }
        
        gain.connect(this.masterGain);
        noiseSource.start();
    }

    playShoot() {
        // Layered cyberpunk gunshot
        this.playNoise(0.1, 0.4, 4000);
        this.playTone(400, 'square', 0.08, 0.2, 0.1);
        this.playTone(800, 'sine', 0.05, 0.1, 0.3);
    }

    playJump() {
        this.playTone(200, 'sine', 0.25, 0.2, 2.5);
        this.playTone(300, 'triangle', 0.15, 0.1, 1.5);
    }

    playDash() {
        this.playNoise(0.15, 0.3, 2000);
        this.playTone(120, 'triangle', 0.2, 0.3, 0.4);
        this.playTone(600, 'sine', 0.08, 0.15, 0.1);
    }

    playReload() {
        this.playTone(900, 'square', 0.04, 0.08);
        setTimeout(() => this.playTone(1400, 'square', 0.04, 0.08), 150);
        setTimeout(() => this.playTone(1100, 'square', 0.04, 0.08), 800);
        setTimeout(() => {
            this.playTone(600, 'sine', 0.08, 0.1, 2.0);
            this.playNoise(0.05, 0.1, 5000);
        }, 1200);
    }

    playExplosion() {
        this.playNoise(0.5, 0.8, 800);
        this.playTone(80, 'sawtooth', 0.5, 0.6, 0.1);
        this.playTone(150, 'square', 0.3, 0.3, 0.2);
    }

    playEnemyHit() {
        this.playTone(700, 'square', 0.08, 0.15, 0.5);
        this.playTone(1200, 'sine', 0.04, 0.1, 0.3);
    }

    playEnemyDeath() {
        this.playNoise(0.25, 0.3, 2500);
        this.playTone(200, 'sawtooth', 0.3, 0.25, 0.1);
        this.playTone(400, 'square', 0.15, 0.15, 0.2);
    }

    playPlayerHit() {
        this.playNoise(0.3, 0.6, 600);
        this.playTone(120, 'sawtooth', 0.35, 0.6, 0.2);
        this.playTone(300, 'square', 0.1, 0.2, 0.5);
    }

    playLaser() {
        this.playTone(900, 'sine', 0.15, 0.2, 0.2);
        this.playTone(1200, 'triangle', 0.1, 0.1, 0.3);
    }
    
    playTeleport() {
        this.playTone(300, 'sine', 0.3, 0.25, 4.0);
        this.playTone(600, 'triangle', 0.2, 0.15, 3.0);
        this.playNoise(0.15, 0.15, 4000);
    }

    playPickup() {
        this.playTone(600, 'sine', 0.1, 0.15, 2.0);
        setTimeout(() => this.playTone(900, 'sine', 0.1, 0.15, 2.0), 80);
        setTimeout(() => this.playTone(1200, 'sine', 0.08, 0.1, 1.5), 160);
    }

    playShield() {
        this.playTone(800, 'sine', 0.2, 0.25, 1.5);
        this.playTone(1200, 'triangle', 0.15, 0.15, 2.0);
        this.playNoise(0.1, 0.2, 6000);
    }

    // Ambient drone
    startAmbient() {
        if (this.ambientPlaying || this.ctx.state === 'suspended') return;
        this.ambientPlaying = true;
        
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.ambientGain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 3);
        this.ambientGain.connect(this.masterGain);
        
        // Low drone
        this.ambientOsc = this.ctx.createOscillator();
        this.ambientOsc.type = 'sine';
        this.ambientOsc.frequency.setValueAtTime(55, this.ctx.currentTime);
        this.ambientOsc.connect(this.ambientGain);
        this.ambientOsc.start();
        
        // Higher harmonic
        this.ambientOsc2 = this.ctx.createOscillator();
        this.ambientOsc2.type = 'triangle';
        this.ambientOsc2.frequency.setValueAtTime(110, this.ctx.currentTime);
        
        const ambientGain2 = this.ctx.createGain();
        ambientGain2.gain.value = 0.3;
        this.ambientOsc2.connect(ambientGain2);
        ambientGain2.connect(this.ambientGain);
        this.ambientOsc2.start();
        
        // Filtered noise pad
        const bufferSize = this.ctx.sampleRate * 4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        this.ambientNoise = this.ctx.createBufferSource();
        this.ambientNoise.buffer = buffer;
        this.ambientNoise.loop = true;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.value = 0.15;
        
        this.ambientNoise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ambientGain);
        this.ambientNoise.start();
    }

    stopAmbient() {
        if (!this.ambientPlaying) return;
        this.ambientPlaying = false;
        
        try {
            if (this.ambientGain) {
                this.ambientGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
            }
            setTimeout(() => {
                try {
                    if (this.ambientOsc) { this.ambientOsc.stop(); this.ambientOsc = null; }
                    if (this.ambientOsc2) { this.ambientOsc2.stop(); this.ambientOsc2 = null; }
                    if (this.ambientNoise) { this.ambientNoise.stop(); this.ambientNoise = null; }
                } catch(e) { /* already stopped */ }
            }, 1100);
        } catch(e) { /* ignore */ }
    }
}

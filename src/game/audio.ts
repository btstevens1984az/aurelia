/**
 * Procedural soundtrack + SFX for AURELIA (Web Audio, no external files).
 * Music bed, engine roar, guns, missiles, and absurd booms.
 */
export class GameAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicBus: GainNode | null = null
  private sfxBus: GainNode | null = null
  private windGain: GainNode | null = null
  private engineGain: GainNode | null = null
  private engineOsc: OscillatorNode | null = null
  private musicNodes: AudioNode[] = []
  private musicTimer: number | null = null
  private started = false
  private musicOn = false
  private step = 0
  muted = false

  private readonly masterVol = 0.42
  private readonly musicVol = 0.22
  private readonly sfxVol = 0.85

  async ensure() {
    if (this.started && this.ctx?.state === 'running') return
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return

    if (!this.ctx) {
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : this.masterVol
      this.master.connect(this.ctx.destination)

      this.musicBus = this.ctx.createGain()
      this.musicBus.gain.value = this.musicVol
      this.musicBus.connect(this.master)

      this.sfxBus = this.ctx.createGain()
      this.sfxBus.gain.value = this.sfxVol
      this.sfxBus.connect(this.master)

      this.started = true
      this.startAtmosphere()
      this.startEngine()
    }

    await this.ctx.resume()
    if (!this.musicOn) this.startMusic()
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master) {
      this.master.gain.setTargetAtTime(
        muted ? 0 : this.masterVol,
        this.ctx?.currentTime ?? 0,
        0.05,
      )
    }
  }

  toggleMute() {
    this.setMuted(!this.muted)
    return this.muted
  }

  private startAtmosphere() {
    if (!this.ctx || !this.sfxBus) return

    // Soft wind / cabin noise via filtered noise buffer
    const bufferSize = this.ctx.sampleRate * 2
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer
    noise.loop = true
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 280
    filter.Q.value = 0.6
    const gain = this.ctx.createGain()
    gain.gain.value = 0.035
    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxBus)
    noise.start()
    this.windGain = gain
  }

  private startEngine() {
    if (!this.ctx || !this.sfxBus) return
    const osc = this.ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 68
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 220
    const gain = this.ctx.createGain()
    gain.gain.value = 0.04
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxBus)
    osc.start()
    this.engineOsc = osc
    this.engineGain = gain
  }

  setWindIntensity(t: number) {
    if (!this.windGain || !this.ctx) return
    this.windGain.gain.setTargetAtTime(0.025 + t * 0.05, this.ctx.currentTime, 0.1)
  }

  setEngine(thrust: number, boosting: boolean) {
    if (!this.ctx || !this.engineGain || !this.engineOsc) return
    const t = this.ctx.currentTime
    const target = 0.03 + thrust * 0.07 + (boosting ? 0.06 : 0)
    this.engineGain.gain.setTargetAtTime(target, t, 0.08)
    this.engineOsc.frequency.setTargetAtTime(62 + thrust * 55 + (boosting ? 40 : 0), t, 0.1)
  }

  /** Looping dusk combat bed — pulsing bass + airy fifths. */
  private startMusic() {
    if (!this.ctx || !this.musicBus || this.musicOn) return
    this.musicOn = true
    this.step = 0

    // Drone pad
    for (const [freq, type, vol] of [
      [55, 'sine', 0.12],
      [82.5, 'triangle', 0.06],
      [110, 'sine', 0.05],
    ] as const) {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = type
      osc.frequency.value = freq
      gain.gain.value = vol
      osc.connect(gain)
      gain.connect(this.musicBus)
      osc.start()
      this.musicNodes.push(osc, gain)
    }

    // Melodic pulse on a timer
    const bpm = 96
    const interval = (60 / bpm) * 1000
    const scale = [0, 3, 5, 7, 10, 12, 15, 17] // minor-ish dusk scale from A2
    const root = 110

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicBus || this.muted) {
        this.step++
        return
      }
      const t = this.ctx.currentTime
      const degree = scale[this.step % scale.length]
      const octave = this.step % 16 < 8 ? 1 : 2
      const freq = root * octave * Math.pow(2, degree / 12)

      // Bass stab every 4
      if (this.step % 4 === 0) {
        this.tone(this.musicBus, root / 2, 0.28, 'sawtooth', 0.09, t)
      }
      // Lead pluck
      if (this.step % 2 === 0) {
        this.tone(this.musicBus, freq, 0.18, 'triangle', 0.055, t)
      }
      // High shimmer every 8
      if (this.step % 8 === 0) {
        this.tone(this.musicBus, freq * 2, 0.4, 'sine', 0.03, t)
      }
      // Combat snare-ish noise tick
      if (this.step % 4 === 2) {
        this.noiseBurst(this.musicBus, 0.04, 0.045, 1800, t)
      }

      this.step++
    }, interval / 2)
  }

  collect() {
    this.chime(740, 0.1, 'triangle', 0.16)
    this.chime(1110, 0.14, 'sine', 0.12)
  }

  thermal() {
    this.chime(280, 0.22, 'sine', 0.08)
  }

  boost() {
    this.noiseBurst(this.sfxBus, 0.08, 0.07, 900)
    this.chime(140, 0.1, 'sawtooth', 0.06)
  }

  nearMiss() {
    this.chime(980, 0.06, 'sine', 0.1)
    this.chime(1240, 0.05, 'triangle', 0.06)
  }

  gun() {
    if (!this.ctx || !this.sfxBus || this.muted) return
    const t = this.ctx.currentTime
    this.noiseBurst(this.sfxBus, 0.045, 0.09, 4200, t)
    this.tone(this.sfxBus, 280 + Math.random() * 40, 0.05, 'square', 0.07, t)
    this.tone(this.sfxBus, 120, 0.04, 'sawtooth', 0.05, t)
  }

  missile() {
    if (!this.ctx || !this.sfxBus || this.muted) return
    const t = this.ctx.currentTime
    this.tone(this.sfxBus, 220, 0.16, 'sawtooth', 0.12, t)
    this.tone(this.sfxBus, 90, 0.28, 'sine', 0.1, t)
    this.noiseBurst(this.sfxBus, 0.2, 0.1, 1200, t)
    // Rising whoosh
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.35)
    gain.gain.setValueAtTime(0.08, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc.connect(gain)
    gain.connect(this.sfxBus)
    osc.start(t)
    osc.stop(t + 0.38)
  }

  explosion() {
    this.megaBoom(0.7)
  }

  megaBoom(power = 1) {
    if (!this.ctx || !this.sfxBus || this.muted) return
    const t = this.ctx.currentTime
    const p = Math.max(0.6, power)

    this.noiseBurst(this.sfxBus, 0.35 * p, 0.28 * p, 800, t)
    this.noiseBurst(this.sfxBus, 0.45 * p, 0.2 * p, 300, t)

    for (const [freq, dur, vol, type] of [
      [70, 0.7 * p, 0.28 * p, 'sawtooth'],
      [42, 0.9 * p, 0.24 * p, 'square'],
      [160, 0.4 * p, 0.12 * p, 'triangle'],
      [28, 1.1 * p, 0.18 * p, 'sine'],
    ] as const) {
      this.tone(this.sfxBus, freq, dur, type, vol, t)
    }
  }

  pickup() {
    this.chime(480, 0.1, 'triangle', 0.14)
    this.chime(720, 0.14, 'sine', 0.12)
    this.chime(960, 0.18, 'sine', 0.08)
  }

  levelUp() {
    const notes = [392, 494, 587, 784]
    notes.forEach((f, i) => {
      window.setTimeout(() => this.chime(f, 0.22, i % 2 ? 'triangle' : 'sine', 0.12), i * 90)
    })
  }

  damage() {
    this.noiseBurst(this.sfxBus, 0.12, 0.12, 600)
    this.chime(140, 0.12, 'square', 0.12)
    this.chime(90, 0.18, 'sawtooth', 0.08)
  }

  hit() {
    this.megaBoom(1.1)
    this.chime(60, 0.4, 'sawtooth', 0.15)
  }

  startTone() {
    this.chime(330, 0.25, 'sine', 0.12)
    this.chime(415, 0.3, 'triangle', 0.1)
    this.chime(554, 0.4, 'sine', 0.09)
    this.chime(659, 0.5, 'sine', 0.07)
  }

  bossStinger() {
    this.chime(110, 0.4, 'sawtooth', 0.14)
    this.chime(98, 0.55, 'square', 0.1)
    this.noiseBurst(this.sfxBus, 0.3, 0.15, 400)
  }

  private chime(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ) {
    if (!this.ctx || !this.sfxBus || this.muted) return
    this.tone(this.sfxBus, freq, duration, type, volume, this.ctx.currentTime)
  }

  private tone(
    bus: GainNode | null,
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    when?: number,
  ) {
    if (!this.ctx || !bus || this.muted) return
    const t = when ?? this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(Math.max(20, freq), t)
    gain.gain.setValueAtTime(Math.max(0.0001, volume), t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
    osc.connect(gain)
    gain.connect(bus)
    osc.start(t)
    osc.stop(t + duration + 0.03)
  }

  private noiseBurst(
    bus: GainNode | null,
    duration: number,
    volume: number,
    cutoff: number,
    when?: number,
  ) {
    if (!this.ctx || !bus || this.muted) return
    const t = when ?? this.ctx.currentTime
    const size = Math.floor(this.ctx.sampleRate * Math.min(duration, 0.6))
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < size; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / size)
    }
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = cutoff
    filter.Q.value = 0.8
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(bus)
    src.start(t)
  }

  dispose() {
    if (this.musicTimer != null) window.clearInterval(this.musicTimer)
    this.engineOsc?.stop()
    for (const n of this.musicNodes) {
      try {
        if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') {
          ;(n as OscillatorNode).stop()
        }
      } catch {
        /* already stopped */
      }
    }
    void this.ctx?.close()
    this.ctx = null
    this.started = false
    this.musicOn = false
  }
}

/** Lightweight procedural audio — no external assets. */
export class GameAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private wind: OscillatorNode | null = null
  private windGain: GainNode | null = null
  private started = false
  muted = false

  async ensure() {
    if (this.started) return
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.22
    this.master.connect(this.ctx.destination)
    this.started = true
    await this.ctx.resume()
    this.startWind()
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : 0.22
  }

  private startWind() {
    if (!this.ctx || !this.master) return
    const noise = this.ctx.createOscillator()
    noise.type = 'sine'
    noise.frequency.value = 55
    const gain = this.ctx.createGain()
    gain.gain.value = 0.04
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 180
    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    noise.start()
    this.wind = noise
    this.windGain = gain
  }

  setWindIntensity(t: number) {
    if (!this.windGain || !this.ctx) return
    const v = 0.02 + t * 0.07
    this.windGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08)
  }

  collect() {
    this.chime(660, 0.09, 'triangle', 0.12)
    this.chime(990, 0.12, 'sine', 0.08)
  }

  thermal() {
    this.chime(320, 0.18, 'sine', 0.05)
  }

  boost() {
    this.chime(180, 0.08, 'sawtooth', 0.03)
  }

  nearMiss() {
    this.chime(880, 0.05, 'sine', 0.06)
  }

  hit() {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(140, t)
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.35)
    gain.gain.setValueAtTime(0.16, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.4)
  }

  startTone() {
    this.chime(392, 0.2, 'sine', 0.1)
    this.chime(523, 0.28, 'triangle', 0.08)
    this.chime(784, 0.4, 'sine', 0.06)
  }

  private chime(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ) {
    if (!this.ctx || !this.master || this.muted) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + duration + 0.02)
  }

  dispose() {
    this.wind?.stop()
    void this.ctx?.close()
    this.ctx = null
    this.started = false
  }
}

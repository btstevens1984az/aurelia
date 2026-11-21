import { Input } from './input'
import { GameAudio } from './audio'
import { ParticleSystem } from './particles'
import { Player } from './player'
import { World } from './world'
import { clamp, lerp, easeOutCubic } from './math'

export type GameMode = 'title' | 'playing' | 'paused' | 'over'

const HS_KEY = 'aurelia-best-score'

export class Game {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  input: Input
  audio = new GameAudio()
  particles = new ParticleSystem()
  player = new Player()
  world = new World()

  mode: GameMode = 'title'
  width = 0
  height = 0
  dpr = 1
  time = 0
  score = 0
  distance = 0
  combo = 1
  comboTimer = 0
  best = 0
  camX = 0
  camY = 0
  shake = 0
  flash = 0
  thermalScoreTick = 0
  nearMissCooldown = 0
  boostSoundCooldown = 0
  startOriginX = 0

  private raf = 0
  private last = 0
  private running = false

  private el = {
    hud: document.getElementById('hud')!,
    score: document.getElementById('score')!,
    distance: document.getElementById('distance')!,
    combo: document.getElementById('combo')!,
    boostBar: document.getElementById('boost-bar')!,
    boostFill: document.getElementById('boost-fill')!,
    overlay: document.getElementById('overlay')!,
    pause: document.getElementById('pause')!,
    tagline: document.getElementById('tagline')!,
    startBtn: document.getElementById('start-btn') as HTMLButtonElement,
    resumeBtn: document.getElementById('resume-btn') as HTMLButtonElement,
    menuStats: document.getElementById('menu-stats')!,
    finalScore: document.getElementById('final-score')!,
    bestScore: document.getElementById('best-score')!,
    finalDistance: document.getElementById('final-distance')!,
    touchHint: document.getElementById('touch-hint')!,
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas 2D unavailable')
    this.ctx = ctx
    this.input = new Input(canvas)
    this.best = Number(localStorage.getItem(HS_KEY) || 0)

    this.el.startBtn.addEventListener('click', () => void this.begin())
    this.el.resumeBtn.addEventListener('click', () => this.resume())
    window.addEventListener('keydown', this.onGlobalKey)
    window.addEventListener('resize', this.resize)
    this.resize()
    this.showTitle()
  }

  startLoop() {
    if (this.running) return
    this.running = true
    this.input.bind()
    this.last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - this.last) / 1000)
      this.last = now
      this.update(dt)
      this.draw()
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  stopLoop() {
    this.running = false
    cancelAnimationFrame(this.raf)
    this.input.unbind()
  }

  private resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = Math.floor(this.width * this.dpr)
    this.canvas.height = Math.floor(this.height * this.dpr)
    this.canvas.style.width = `${this.width}px`
    this.canvas.style.height = `${this.height}px`
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  private onGlobalKey = (e: KeyboardEvent) => {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (this.mode === 'playing') this.pause()
      else if (this.mode === 'paused') this.resume()
    }
    if ((e.key === 'Enter' || e.key === ' ') && (this.mode === 'title' || this.mode === 'over')) {
      e.preventDefault()
      void this.begin()
    }
  }

  private showTitle() {
    this.mode = 'title'
    this.el.overlay.classList.remove('hidden')
    this.el.pause.classList.add('hidden')
    this.el.hud.classList.add('hidden')
    this.el.boostBar.classList.add('hidden')
    this.el.menuStats.classList.add('hidden')
    this.el.tagline.textContent = 'Ride the dusk winds. Gather the lanterns.'
    this.el.startBtn.textContent = 'Begin Flight'
    this.el.touchHint.classList.add('hidden')
    this.seedTitleScene()
  }

  private seedTitleScene() {
    this.world.reset(this.width, this.height)
    this.particles.clear()
    this.player.reset(this.width * 0.35, this.height * 0.48)
    this.camX = 0
    this.camY = 0
    this.time = 0
  }

  async begin() {
    await this.audio.ensure()
    this.audio.startTone()
    this.mode = 'playing'
    this.score = 0
    this.distance = 0
    this.combo = 1
    this.comboTimer = 0
    this.shake = 0
    this.flash = 0
    this.thermalScoreTick = 0
    this.nearMissCooldown = 0
    this.boostSoundCooldown = 0
    this.particles.clear()
    this.world.reset(this.width, this.height)
    this.player.reset(this.width * 0.32, this.height * 0.5)
    this.startOriginX = this.player.x
    this.camX = this.player.x - this.width * 0.32
    this.camY = 0

    this.el.overlay.classList.add('hidden')
    this.el.pause.classList.add('hidden')
    this.el.hud.classList.remove('hidden')
    this.el.boostBar.classList.remove('hidden')
    this.el.touchHint.classList.remove('hidden')
    this.syncHud()
  }

  pause() {
    if (this.mode !== 'playing') return
    this.mode = 'paused'
    this.el.pause.classList.remove('hidden')
  }

  resume() {
    if (this.mode !== 'paused') return
    this.mode = 'playing'
    this.el.pause.classList.add('hidden')
    this.last = performance.now()
  }

  private gameOver() {
    this.mode = 'over'
    this.player.alive = false
    this.audio.hit()
    this.shake = 14
    this.flash = 0.55
    this.particles.burst(this.player.x, this.player.y, 42, {
      speed: 260,
      hue: 30,
      kind: 'ember',
      size: 3.5,
    })
    this.particles.burst(this.player.x, this.player.y, 8, {
      speed: 80,
      kind: 'shock',
      size: 28,
      hue: 25,
    })

    if (this.score > this.best) {
      this.best = this.score
      localStorage.setItem(HS_KEY, String(this.best))
    }

    this.el.hud.classList.add('hidden')
    this.el.boostBar.classList.add('hidden')
    this.el.menuStats.classList.remove('hidden')
    this.el.finalScore.textContent = String(Math.floor(this.score))
    this.el.bestScore.textContent = String(Math.floor(this.best))
    this.el.finalDistance.textContent = `${Math.floor(this.distance)}m`
    this.el.tagline.textContent =
      this.score >= this.best && this.score > 0
        ? 'A new horizon. The dusk remembers you.'
        : 'The wind takes you. Rise again.'
    this.el.startBtn.textContent = 'Fly Again'
    this.el.overlay.classList.remove('hidden')
  }

  private update(dt: number) {
    this.time += dt
    this.shake = Math.max(0, this.shake - dt * 28)
    this.flash = Math.max(0, this.flash - dt * 1.4)

    if (this.mode === 'title' || this.mode === 'over') {
      this.camX += 28 * dt
      this.world.update(dt, this.camX, this.width, this.height, 0)
      this.player.y = this.height * 0.48 + Math.sin(this.time * 1.2) * 18
      this.player.x = this.camX + this.width * 0.35
      this.player.angle = Math.sin(this.time * 0.9) * 0.15
      this.particles.trail(this.player.x - 8, this.player.y, 120, 0, false)
      this.particles.update(dt)
      return
    }

    if (this.mode === 'paused') return

    const difficulty = clamp(this.distance / 1800, 0, 4)
    const inThermal = this.world.inThermal(this.player.x, this.player.y)
    this.player.update(dt, this.input, this.particles, this.width, this.height, inThermal)

    // Camera with soft lag and look-ahead
    const targetCamX = this.player.x - this.width * 0.32
    const targetCamY = (this.player.y - this.height * 0.5) * 0.15
    this.camX = lerp(this.camX, targetCamX, 1 - Math.pow(0.0008, dt))
    this.camY = lerp(this.camY, targetCamY, 1 - Math.pow(0.01, dt))

    this.world.update(dt, this.camX, this.width, this.height, difficulty)
    this.particles.update(dt)

    this.distance = Math.max(0, (this.player.x - this.startOriginX) / 10)
    this.score += dt * (4 + this.combo * 1.5) * (1 + difficulty * 0.15)

    if (inThermal) {
      this.thermalScoreTick += dt
      if (this.thermalScoreTick > 0.35) {
        this.thermalScoreTick = 0
        this.score += 5 * this.combo
        this.audio.thermal()
      }
      if (Math.random() < dt * 8) {
        this.particles.burst(this.player.x, this.player.y + randOffset(), 1, {
          speed: 40,
          hue: 170,
          kind: 'dust',
          size: 2,
        })
      }
    }

    const collected = this.world.collectLanterns(
      this.player.x,
      this.player.y,
      this.player.radius,
    )
    for (const l of collected) {
      this.combo = Math.min(8, this.combo + 1)
      this.comboTimer = 2.4
      this.score += l.worth * this.combo
      this.audio.collect()
      this.particles.burst(l.x, l.y, 16, { speed: 140, hue: 42, kind: 'spark' })
      this.flash = Math.max(this.flash, 0.12)
    }

    this.comboTimer -= dt
    if (this.comboTimer <= 0) this.combo = 1

    this.nearMissCooldown -= dt
    if (
      this.nearMissCooldown <= 0 &&
      this.world.nearMiss(this.player.x, this.player.y, this.player.radius)
    ) {
      this.nearMissCooldown = 0.55
      this.combo = Math.min(8, this.combo + 1)
      this.comboTimer = 2.2
      this.score += 20 * this.combo
      this.audio.nearMiss()
      this.particles.burst(this.player.x, this.player.y, 6, {
        speed: 90,
        hue: 45,
        kind: 'spark',
      })
    }

    this.boostSoundCooldown -= dt
    if (
      this.input.boostHeld &&
      this.player.boost > 0.05 &&
      this.boostSoundCooldown <= 0
    ) {
      this.boostSoundCooldown = 0.18
      this.audio.boost()
    }

    this.audio.setWindIntensity(
      clamp(Math.hypot(this.player.vx, this.player.vy) / 480, 0, 1),
    )

    if (
      this.player.invuln <= 0 &&
      this.world.hitObstacle(this.player.x, this.player.y, this.player.radius)
    ) {
      this.gameOver()
    }

    this.syncHud()
  }

  private syncHud() {
    this.el.score.textContent = String(Math.floor(this.score))
    this.el.distance.textContent = `${Math.floor(this.distance)}m`
    this.el.boostFill.style.width = `${Math.floor(this.player.boost * 100)}%`
    if (this.combo > 1) {
      this.el.combo.textContent = `×${this.combo}`
      this.el.combo.classList.remove('hidden')
    } else {
      this.el.combo.classList.add('hidden')
    }
  }

  private draw() {
    const ctx = this.ctx
    const w = this.width
    const h = this.height
    const shakeX = this.shake ? (Math.random() - 0.5) * this.shake : 0
    const shakeY = this.shake ? (Math.random() - 0.5) * this.shake : 0
    const camX = this.camX + shakeX
    const camY = this.camY + shakeY

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#070e1a')
    sky.addColorStop(0.35, '#122038')
    sky.addColorStop(0.62, '#3a2a38')
    sky.addColorStop(0.82, '#c45c26')
    sky.addColorStop(1, '#e8a87c')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // Soft sun / afterglow
    const sunX = w * 0.72
    const sunY = h * 0.72
    const sun = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, h * 0.55)
    sun.addColorStop(0, 'rgba(255, 214, 150, 0.55)')
    sun.addColorStop(0.25, 'rgba(232, 138, 74, 0.22)')
    sun.addColorStop(1, 'rgba(232, 138, 74, 0)')
    ctx.fillStyle = sun
    ctx.fillRect(0, 0, w, h)

    // Far mountains
    this.drawMountains(ctx, this.world.mountainsFar, camX * 0.25, h, '#141e30', 0.9)
    this.drawMountains(ctx, this.world.mountainsNear, camX * 0.45, h, '#0d1524', 1)

    // Floating motes / dust
    for (const m of this.world.motes) {
      const x = m.x - camX * m.z
      const y = m.y - camY * m.z * 0.4 + Math.sin(this.time + m.phase) * 3
      ctx.globalAlpha = 0.15 + m.z * 0.35
      ctx.fillStyle = '#fff4e0'
      ctx.beginPath()
      ctx.arc(x, y, m.s, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Thermals
    for (const t of this.world.thermals) {
      const x = t.x - camX
      const y = t.y - camY
      const g = ctx.createLinearGradient(x, y + t.h, x, y)
      g.addColorStop(0, 'rgba(94, 200, 192, 0)')
      g.addColorStop(0.5, 'rgba(94, 200, 192, 0.14)')
      g.addColorStop(1, 'rgba(94, 200, 192, 0.02)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(x, y + t.h)
      for (let i = 0; i <= 8; i++) {
        const py = y + t.h - (t.h * i) / 8
        const wave = Math.sin(this.time * 2 + t.phase + i * 0.7) * 10
        ctx.lineTo(x + t.w * 0.5 + wave, py)
      }
      for (let i = 8; i >= 0; i--) {
        const py = y + t.h - (t.h * i) / 8
        const wave = Math.sin(this.time * 2 + t.phase + i * 0.7 + 2) * 10
        ctx.lineTo(x + t.w * 0.5 + wave, py)
      }
      ctx.closePath()
      ctx.fill()

      ctx.strokeStyle = 'rgba(94, 200, 192, 0.18)'
      ctx.lineWidth = 1
      for (let i = 0; i < 3; i++) {
        const ox = x + t.w * (0.25 + i * 0.25)
        ctx.beginPath()
        for (let s = 0; s <= 12; s++) {
          const py = y + t.h - (t.h * s) / 12
          const px = ox + Math.sin(this.time * 2.4 + i + s * 0.45 + t.phase) * 7
          if (s === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
    }

    // Spires
    for (const s of this.world.spires) {
      const x = s.x - camX
      const y = s.y - camY
      const grad = ctx.createLinearGradient(x, y, x + s.w, y)
      grad.addColorStop(0, '#1a2438')
      grad.addColorStop(0.5, '#2a3348')
      grad.addColorStop(1, '#121a28')
      ctx.fillStyle = grad
      ctx.beginPath()
      if (s.tip > 0) {
        ctx.moveTo(x, y)
        ctx.lineTo(x + s.w, y)
        ctx.lineTo(x + s.w * 0.72, y + s.h)
        ctx.lineTo(x + s.w * 0.28, y + s.h)
      } else {
        ctx.moveTo(x + s.w * 0.28, y)
        ctx.lineTo(x + s.w * 0.72, y)
        ctx.lineTo(x + s.w, y + s.h)
        ctx.lineTo(x, y + s.h)
      }
      ctx.closePath()
      ctx.fill()

      ctx.strokeStyle = 'rgba(232, 93, 76, 0.35)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Birds
    for (const b of this.world.birds) {
      const x = b.x - camX
      const y = b.y - camY
      const flap = Math.sin(b.phase * 2) * 0.5
      ctx.save()
      ctx.translate(x, y)
      ctx.fillStyle = '#0a101c'
      ctx.beginPath()
      ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-2, 0)
      ctx.quadraticCurveTo(-8, -14 - flap * 8, -20, -2)
      ctx.quadraticCurveTo(-10, -2, -2, 0)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-2, 0)
      ctx.quadraticCurveTo(-8, 14 + flap * 8, -20, 2)
      ctx.quadraticCurveTo(-10, 2, -2, 0)
      ctx.fill()
      ctx.restore()
    }

    // Lanterns
    for (const l of this.world.lanterns) {
      if (l.collected) continue
      const x = l.x - camX
      const y = l.y - camY + Math.sin(this.time * 2 + l.phase) * 5
      const glow = ctx.createRadialGradient(x, y, 2, x, y, l.r * 3.2)
      glow.addColorStop(0, 'rgba(255, 220, 140, 0.55)')
      glow.addColorStop(0.4, 'rgba(244, 193, 93, 0.18)')
      glow.addColorStop(1, 'rgba(244, 193, 93, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, l.r * 3.2, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#fff4e0'
      ctx.beginPath()
      ctx.arc(x, y, l.r * 0.55, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = 'rgba(244, 193, 93, 0.9)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, l.r, 0, Math.PI * 2)
      ctx.stroke()

      // Tiny hanging cord
      ctx.strokeStyle = 'rgba(255, 244, 224, 0.35)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y + l.r)
      ctx.lineTo(x, y + l.r + 8)
      ctx.stroke()
    }

    this.particles.draw(ctx, camX, camY)
    this.player.draw(ctx, camX, camY, this.time)

    // Vignette
    const vig = ctx.createRadialGradient(
      w * 0.5,
      h * 0.45,
      h * 0.2,
      w * 0.5,
      h * 0.5,
      h * 0.85,
    )
    vig.addColorStop(0, 'rgba(0,0,0,0)')
    vig.addColorStop(1, 'rgba(4, 8, 16, 0.45)')
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, w, h)

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 244, 224, ${this.flash * 0.35})`
      ctx.fillRect(0, 0, w, h)
    }

    // Title idle caption
    if (this.mode === 'title') {
      const t = easeOutCubic(clamp((this.time % 6) / 2, 0, 1))
      ctx.globalAlpha = 0.15 + t * 0.1
      ctx.fillStyle = '#fff4e0'
      ctx.beginPath()
      ctx.arc(w * 0.72, h * 0.72, 40 + t * 20, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  private drawMountains(
    ctx: CanvasRenderingContext2D,
    peaks: { x: number; h: number }[],
    scroll: number,
    h: number,
    color: string,
    alpha: number,
  ) {
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(-20, h)
    for (const p of peaks) {
      const x = p.x - scroll
      ctx.lineTo(x, h - p.h)
      ctx.lineTo(x + 90, h - p.h * 0.55)
    }
    ctx.lineTo(this.width + 40, h)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

function randOffset() {
  return (Math.random() - 0.5) * 40
}

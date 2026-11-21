import { rand } from './math'

export type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  hue: number
  kind: 'spark' | 'dust' | 'ember' | 'shock' | 'flare' | 'chunk'
}

export class ParticleSystem {
  particles: Particle[] = []

  clear() {
    this.particles.length = 0
  }

  burst(
    x: number,
    y: number,
    count: number,
    opts: Partial<Particle> & { spread?: number; speed?: number } = {},
  ) {
    const spread = opts.spread ?? Math.PI * 2
    const speed = opts.speed ?? 120
    for (let i = 0; i < count; i++) {
      const a =
        rand(-spread / 2, spread / 2) +
        (opts.vx ? Math.atan2(opts.vy ?? 0, opts.vx) : rand(0, Math.PI * 2))
      const s = rand(speed * 0.3, speed)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 1,
        maxLife: rand(0.35, 0.9),
        size: opts.size ?? rand(1.5, 4),
        hue: opts.hue ?? rand(30, 50),
        kind: opts.kind ?? 'spark',
      })
    }
  }

  /** Ridiculous multi-wave destruction fireworks. */
  megaExplosion(x: number, y: number, power = 1) {
    const p = Math.max(0.8, power)
    this.burst(x, y, Math.floor(55 * p), {
      speed: 420 * p,
      hue: 25,
      kind: 'ember',
      size: 5,
    })
    this.burst(x, y, Math.floor(40 * p), {
      speed: 280 * p,
      hue: 45,
      kind: 'spark',
      size: 3.5,
    })
    this.burst(x, y, Math.floor(18 * p), {
      speed: 160 * p,
      hue: 15,
      kind: 'chunk',
      size: 8,
    })
    this.burst(x, y, Math.floor(10 * p), {
      speed: 60,
      kind: 'shock',
      size: 36 * p,
      hue: 35,
    })
    this.burst(x, y, Math.floor(8 * p), {
      speed: 40,
      kind: 'flare',
      size: 55 * p,
      hue: 28,
    })
    // Delayed-feel secondary rings via longer-lived shocks
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        life: 1,
        maxLife: 0.45 + i * 0.18,
        size: (50 + i * 35) * p,
        hue: 30 + i * 12,
        kind: 'shock',
      })
    }
  }

  trail(x: number, y: number, vx: number, vy: number, boosting: boolean) {
    this.particles.push({
      x: x + rand(-4, 4),
      y: y + rand(-4, 4),
      vx: -vx * 0.15 + rand(-12, 12),
      vy: -vy * 0.15 + rand(-12, 12),
      life: 1,
      maxLife: boosting ? rand(0.35, 0.6) : rand(0.2, 0.4),
      size: boosting ? rand(2, 4.5) : rand(1.2, 2.8),
      hue: boosting ? rand(28, 42) : rand(35, 55),
      kind: boosting ? 'ember' : 'dust',
    })
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt / p.maxLife
      if (p.kind === 'shock' || p.kind === 'flare') {
        p.size += dt * (p.kind === 'flare' ? 140 : 90)
      } else {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx *= 0.98
        p.vy *= 0.98
        if (p.kind === 'dust') p.vy -= 8 * dt
        if (p.kind === 'chunk') p.vy += 40 * dt
      }
      if (p.life <= 0) this.particles.splice(i, 1)
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life)
      const x = p.x - camX
      const y = p.y - camY
      if (p.kind === 'shock') {
        ctx.beginPath()
        ctx.arc(x, y, p.size * (1.15 - alpha * 0.25), 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${p.hue}, 90%, 70%, ${alpha * 0.85})`
        ctx.lineWidth = 3 + (1 - alpha) * 6
        ctx.stroke()
        continue
      }
      if (p.kind === 'flare') {
        const g = ctx.createRadialGradient(x, y, 2, x, y, p.size)
        g.addColorStop(0, `hsla(${p.hue}, 100%, 75%, ${alpha * 0.7})`)
        g.addColorStop(0.4, `hsla(${p.hue + 20}, 90%, 55%, ${alpha * 0.25})`)
        g.addColorStop(1, `hsla(${p.hue}, 80%, 50%, 0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      ctx.beginPath()
      ctx.arc(x, y, p.size * Math.max(0.2, alpha), 0, Math.PI * 2)
      if (p.kind === 'ember') {
        ctx.fillStyle = `hsla(${p.hue}, 95%, 62%, ${alpha})`
      } else if (p.kind === 'dust') {
        ctx.fillStyle = `hsla(${p.hue}, 70%, 80%, ${alpha * 0.55})`
      } else if (p.kind === 'chunk') {
        ctx.fillStyle = `hsla(${p.hue}, 70%, 45%, ${alpha})`
      } else {
        ctx.fillStyle = `hsla(${p.hue}, 85%, 70%, ${alpha})`
      }
      ctx.fill()
    }
  }
}

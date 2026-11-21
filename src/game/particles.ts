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
  kind: 'spark' | 'dust' | 'ember' | 'shock'
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
      const a = rand(-spread / 2, spread / 2) + (opts.vx ? Math.atan2(opts.vy ?? 0, opts.vx) : rand(0, Math.PI * 2))
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
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 0.98
      p.vy *= 0.98
      if (p.kind === 'dust') p.vy -= 8 * dt
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
        ctx.arc(x, y, p.size * (1.2 - alpha * 0.4), 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${p.hue}, 80%, 70%, ${alpha * 0.7})`
        ctx.lineWidth = 2
        ctx.stroke()
        continue
      }
      ctx.beginPath()
      ctx.arc(x, y, p.size * alpha, 0, Math.PI * 2)
      if (p.kind === 'ember') {
        ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${alpha})`
      } else if (p.kind === 'dust') {
        ctx.fillStyle = `hsla(${p.hue}, 70%, 80%, ${alpha * 0.55})`
      } else {
        ctx.fillStyle = `hsla(${p.hue}, 85%, 70%, ${alpha})`
      }
      ctx.fill()
    }
  }
}

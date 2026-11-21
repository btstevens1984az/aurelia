import { clamp, lerp } from './math'
import type { Input } from './input'
import type { ParticleSystem } from './particles'

export class Player {
  x = 0
  y = 0
  vx = 0
  vy = 0
  angle = 0
  boost = 1
  alive = true
  invuln = 0
  private trailTimer = 0
  readonly radius = 14

  reset(x: number, y: number) {
    this.x = x
    this.y = y
    this.vx = 220
    this.vy = 0
    this.angle = 0
    this.boost = 1
    this.alive = true
    this.invuln = 1.2
    this.trailTimer = 0
  }

  update(
    dt: number,
    input: Input,
    particles: ParticleSystem,
    worldW: number,
    worldH: number,
    inThermal: boolean,
  ) {
    if (!this.alive) return

    this.invuln = Math.max(0, this.invuln - dt)

    let ax = 0
    let ay = 0
    const { x: kx, y: ky } = input.axis

    if (input.pointerActive) {
      const dx = input.pointerX - worldW * 0.38
      const dy = input.pointerY - this.y
      ax += clamp(dx / 140, -1.2, 1.2)
      ay += clamp(dy / 100, -1.2, 1.2)
    }

    ax += kx
    ay += ky

    const boosting = input.boostHeld && this.boost > 0.05
    const accel = boosting ? 980 : 620
    const maxSpeed = boosting ? 520 : 360

    this.vx += ax * accel * dt
    this.vy += ay * accel * dt

    // Gentle forward drift so the flight always feels alive
    this.vx += 40 * dt
    // Gravity / float balance
    this.vy += (inThermal ? -220 : 55) * dt

    if (boosting) {
      this.boost = Math.max(0, this.boost - dt * 0.35)
      this.vx += Math.cos(this.angle) * 180 * dt
      this.vy += Math.sin(this.angle) * 80 * dt
    } else {
      this.boost = Math.min(1, this.boost + dt * (inThermal ? 0.45 : 0.18))
    }

    const speed = Math.hypot(this.vx, this.vy)
    if (speed > maxSpeed) {
      const s = maxSpeed / speed
      this.vx *= s
      this.vy *= s
    }

    this.vx *= 1 - 0.55 * dt
    this.vy *= 1 - 0.7 * dt

    this.x += this.vx * dt
    this.y += this.vy * dt

    const margin = 36
    this.y = clamp(this.y, margin, worldH - margin)
    if (this.y <= margin || this.y >= worldH - margin) this.vy *= 0.4

    const targetAngle = Math.atan2(this.vy, Math.max(80, this.vx))
    this.angle = lerp(this.angle, targetAngle, 1 - Math.pow(0.001, dt))

    this.trailTimer -= dt
    if (this.trailTimer <= 0) {
      particles.trail(this.x - 10, this.y, this.vx, this.vy, boosting)
      this.trailTimer = boosting ? 0.012 : 0.028
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, time: number) {
    const x = this.x - camX
    const y = this.y - camY
    const flicker = this.invuln > 0 ? 0.45 + 0.55 * Math.abs(Math.sin(time * 18)) : 1

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(this.angle)
    ctx.globalAlpha = flicker

    // Soft glow
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 42)
    glow.addColorStop(0, 'rgba(255, 244, 224, 0.55)')
    glow.addColorStop(0.35, 'rgba(244, 193, 93, 0.22)')
    glow.addColorStop(1, 'rgba(244, 193, 93, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(0, 0, 42, 0, Math.PI * 2)
    ctx.fill()

    // Wings
    const wingPulse = 1 + Math.sin(time * 10) * 0.06
    ctx.fillStyle = 'rgba(255, 244, 224, 0.9)'
    ctx.beginPath()
    ctx.moveTo(-6, 0)
    ctx.quadraticCurveTo(-18, -22 * wingPulse, -40, -8)
    ctx.quadraticCurveTo(-22, -2, -8, 2)
    ctx.closePath()
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(-6, 0)
    ctx.quadraticCurveTo(-18, 22 * wingPulse, -40, 8)
    ctx.quadraticCurveTo(-22, 2, -8, -2)
    ctx.closePath()
    ctx.fill()

    // Body
    ctx.fillStyle = '#fff4e0'
    ctx.beginPath()
    ctx.ellipse(2, 0, 16, 7, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#f4c15d'
    ctx.beginPath()
    ctx.ellipse(10, 0, 6, 3.2, 0, 0, Math.PI * 2)
    ctx.fill()

    // Ribbon
    ctx.strokeStyle = 'rgba(224, 138, 74, 0.85)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-14, 0)
    ctx.quadraticCurveTo(
      -28,
      Math.sin(time * 6) * 8,
      -46,
      Math.sin(time * 5 + 1) * 12,
    )
    ctx.stroke()

    ctx.restore()
  }
}

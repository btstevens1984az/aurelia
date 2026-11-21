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
  hp = 100
  maxHp = 100
  missiles = 6
  maxMissiles = 8
  alive = true
  invuln = 0
  gunCd = 0
  missileCd = 0
  private trailTimer = 0
  readonly radius = 15

  reset(x: number, y: number) {
    this.x = x
    this.y = y
    this.vx = 240
    this.vy = 0
    this.angle = 0
    this.boost = 1
    this.hp = this.maxHp
    this.missiles = 6
    this.alive = true
    this.invuln = 1.4
    this.gunCd = 0
    this.missileCd = 0
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
    this.gunCd = Math.max(0, this.gunCd - dt)
    this.missileCd = Math.max(0, this.missileCd - dt)

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
    const accel = boosting ? 1040 : 680
    const maxSpeed = boosting ? 560 : 390

    this.vx += ax * accel * dt
    this.vy += ay * accel * dt

    this.vx += 48 * dt
    this.vy += (inThermal ? -200 : 40) * dt

    if (boosting) {
      this.boost = Math.max(0, this.boost - dt * 0.32)
      this.vx += Math.cos(this.angle) * 200 * dt
      this.vy += Math.sin(this.angle) * 90 * dt
    } else {
      this.boost = Math.min(1, this.boost + dt * (inThermal ? 0.48 : 0.2))
    }

    const speed = Math.hypot(this.vx, this.vy)
    if (speed > maxSpeed) {
      const s = maxSpeed / speed
      this.vx *= s
      this.vy *= s
    }

    this.vx *= 1 - 0.5 * dt
    this.vy *= 1 - 0.65 * dt

    this.x += this.vx * dt
    this.y += this.vy * dt

    // Soft screen edges only — never lethal, never hard walls
    const margin = 28
    if (this.y < margin) {
      this.y = margin
      this.vy *= 0.35
    } else if (this.y > worldH - margin) {
      this.y = worldH - margin
      this.vy *= 0.35
    }

    const targetAngle = Math.atan2(this.vy, Math.max(90, this.vx))
    this.angle = lerp(this.angle, targetAngle, 1 - Math.pow(0.001, dt))

    this.trailTimer -= dt
    if (this.trailTimer <= 0) {
      particles.trail(this.x - 14, this.y, this.vx, this.vy, boosting)
      this.trailTimer = boosting ? 0.01 : 0.024
    }
  }

  takeDamage(amount: number) {
    if (!this.alive || this.invuln > 0) return false
    this.hp -= amount
    this.invuln = 0.75
    if (this.hp <= 0) {
      this.hp = 0
      this.alive = false
      return true
    }
    return false
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, time: number) {
    const x = this.x - camX
    const y = this.y - camY
    const flicker = this.invuln > 0 ? 0.45 + 0.55 * Math.abs(Math.sin(time * 18)) : 1

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(this.angle)
    ctx.globalAlpha = flicker

    // Afterburner / dream glow
    const glow = ctx.createRadialGradient(-12, 0, 2, -12, 0, 46)
    glow.addColorStop(0, 'rgba(255, 200, 120, 0.7)')
    glow.addColorStop(0.35, 'rgba(244, 193, 93, 0.25)')
    glow.addColorStop(1, 'rgba(244, 193, 93, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(-10, 0, 46, 0, Math.PI * 2)
    ctx.fill()

    // Twin engine plumes
    const plume = 10 + Math.sin(time * 28) * 3
    ctx.fillStyle = 'rgba(232, 138, 74, 0.85)'
    ctx.beginPath()
    ctx.moveTo(-16, -4)
    ctx.lineTo(-16 - plume, -1)
    ctx.lineTo(-16, 1)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-16, 4)
    ctx.lineTo(-16 - plume, 1)
    ctx.lineTo(-16, -1)
    ctx.closePath()
    ctx.fill()

    // Swept wings
    ctx.fillStyle = 'rgba(255, 244, 224, 0.92)'
    ctx.beginPath()
    ctx.moveTo(4, 0)
    ctx.lineTo(-12, -22)
    ctx.lineTo(-2, -3)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(4, 0)
    ctx.lineTo(-12, 22)
    ctx.lineTo(-2, 3)
    ctx.closePath()
    ctx.fill()

    // Gold wing edges
    ctx.strokeStyle = '#f4c15d'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(4, 0)
    ctx.lineTo(-12, -22)
    ctx.lineTo(-2, -3)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(4, 0)
    ctx.lineTo(-12, 22)
    ctx.lineTo(-2, 3)
    ctx.stroke()

    // Fuselage
    ctx.fillStyle = '#fff4e0'
    ctx.beginPath()
    ctx.moveTo(22, 0)
    ctx.lineTo(-14, -6)
    ctx.lineTo(-18, 0)
    ctx.lineTo(-14, 6)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#e08a4a'
    ctx.beginPath()
    ctx.moveTo(22, 0)
    ctx.lineTo(8, -3)
    ctx.lineTo(8, 3)
    ctx.closePath()
    ctx.fill()

    // Canopy
    ctx.fillStyle = '#5ec8c0'
    ctx.beginPath()
    ctx.ellipse(6, 0, 5, 2.6, 0, 0, Math.PI * 2)
    ctx.fill()

    // Twin cannons
    ctx.fillStyle = '#d8c4a0'
    ctx.fillRect(12, -5.5, 10, 2)
    ctx.fillRect(12, 3.5, 10, 2)

    ctx.restore()
  }
}

import { clamp, lerp } from './math'
import type { Input } from './input'
import type { ParticleSystem } from './particles'
import { WEAPONS, type WeaponId } from './weapons'
import type { UpgradeId } from './progression'

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
  weapon: WeaponId = 'twin'
  ownedWeapons: WeaponId[] = ['twin']
  upgrades: Partial<Record<UpgradeId, number>> = {}
  overcharge = 0
  private trailTimer = 0
  readonly radius = 15

  reset(x: number, y: number) {
    this.x = x
    this.y = y
    this.vx = 240
    this.vy = 0
    this.angle = 0
    this.boost = 1
    this.upgrades = {}
    this.maxHp = 100
    this.hp = this.maxHp
    this.maxMissiles = 8
    this.missiles = 6
    this.alive = true
    this.invuln = 1.4
    this.gunCd = 0
    this.missileCd = 0
    this.weapon = 'twin'
    this.ownedWeapons = ['twin']
    this.overcharge = 0
    this.trailTimer = 0
  }

  get fireRateMult() {
    return 1 + (this.upgrades.fireRate ?? 0) * 0.18 + (this.overcharge > 0 ? 0.55 : 0)
  }

  get damageMult() {
    return 1 + (this.upgrades.warhead ?? 0) * 0.22 + (this.overcharge > 0 ? 0.4 : 0)
  }

  get speedMult() {
    return 1 + (this.upgrades.thrust ?? 0) * 0.12
  }

  get magnetRange() {
    return 40 + (this.upgrades.magnet ?? 0) * 36
  }

  get boomPower() {
    return 1 + (this.upgrades.warhead ?? 0) * 0.35
  }

  applyUpgrade(id: UpgradeId) {
    this.upgrades[id] = (this.upgrades[id] ?? 0) + 1
    if (id === 'hull') {
      this.maxHp += 28
      this.hp = Math.min(this.maxHp, this.hp + 40)
    }
    if (id === 'missileBay') {
      this.maxMissiles += 3
      this.missiles = Math.min(this.maxMissiles, this.missiles + 3)
    }
  }

  unlockWeapon(id: WeaponId) {
    if (!this.ownedWeapons.includes(id)) this.ownedWeapons.push(id)
    this.weapon = id
  }

  cycleWeapon() {
    if (this.ownedWeapons.length < 2) return
    const i = this.ownedWeapons.indexOf(this.weapon)
    this.weapon = this.ownedWeapons[(i + 1) % this.ownedWeapons.length]
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
    this.overcharge = Math.max(0, this.overcharge - dt)

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
    const sm = this.speedMult
    const accel = (boosting ? 1040 : 700) * sm
    const maxSpeed = (boosting ? 580 : 400) * sm

    this.vx += ax * accel * dt
    this.vy += ay * accel * dt
    this.vx += 52 * dt
    this.vy += (inThermal ? -210 : 38) * dt

    if (boosting) {
      this.boost = Math.max(0, this.boost - dt * 0.3)
      this.vx += Math.cos(this.angle) * 210 * dt
      this.vy += Math.sin(this.angle) * 95 * dt
    } else {
      this.boost = Math.min(1, this.boost + dt * (inThermal ? 0.5 : 0.22))
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
      particles.trail(this.x - 14, this.y, this.vx, this.vy, boosting || this.overcharge > 0)
      this.trailTimer = boosting ? 0.01 : 0.024
    }
  }

  takeDamage(amount: number) {
    if (!this.alive || this.invuln > 0) return false
    this.hp -= amount
    this.invuln = 0.7
    if (this.hp <= 0) {
      this.hp = 0
      this.alive = false
      return true
    }
    return false
  }

  weaponInterval() {
    return WEAPONS[this.weapon].fireInterval / this.fireRateMult
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, time: number) {
    const x = this.x - camX
    const y = this.y - camY
    const flicker = this.invuln > 0 ? 0.45 + 0.55 * Math.abs(Math.sin(time * 18)) : 1
    const accent = WEAPONS[this.weapon].color

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(this.angle)
    ctx.globalAlpha = flicker

    const glow = ctx.createRadialGradient(-12, 0, 2, -12, 0, 50)
    glow.addColorStop(0, this.overcharge > 0 ? 'rgba(255,107,157,0.75)' : 'rgba(255,200,120,0.7)')
    glow.addColorStop(0.35, `${accent}55`)
    glow.addColorStop(1, 'rgba(244, 193, 93, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(-10, 0, 50, 0, Math.PI * 2)
    ctx.fill()

    const plume = 10 + Math.sin(time * 28) * 3 + (this.upgrades.thrust ?? 0) * 2
    ctx.fillStyle = accent
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

    ctx.strokeStyle = accent
    ctx.lineWidth = 1.5
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

    ctx.fillStyle = '#fff4e0'
    ctx.beginPath()
    ctx.moveTo(22, 0)
    ctx.lineTo(-14, -6)
    ctx.lineTo(-18, 0)
    ctx.lineTo(-14, 6)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.moveTo(22, 0)
    ctx.lineTo(8, -3)
    ctx.lineTo(8, 3)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#5ec8c0'
    ctx.beginPath()
    ctx.ellipse(6, 0, 5, 2.6, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#d8c4a0'
    ctx.fillRect(12, -5.5, 10, 2)
    ctx.fillRect(12, 3.5, 10, 2)

    // Upgrade fins
    const fins = Math.min(3, Object.values(this.upgrades).reduce((a, b) => a + (b ?? 0), 0))
    if (fins > 0) {
      ctx.strokeStyle = accent
      ctx.lineWidth = 2
      for (let i = 0; i < fins; i++) {
        ctx.beginPath()
        ctx.moveTo(-6 - i * 3, -10 - i * 2)
        ctx.lineTo(-14 - i * 3, -16 - i * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(-6 - i * 3, 10 + i * 2)
        ctx.lineTo(-14 - i * 3, 16 + i * 2)
        ctx.stroke()
      }
    }

    ctx.restore()
  }
}

import { dist } from './math'
import type { WeaponId } from './weapons'
import type { BossId, PackageKind } from './progression'

export type ProjectileKind =
  | 'gun'
  | 'spread'
  | 'plasma'
  | 'rail'
  | 'nova'
  | 'missile'
  | 'enemyGun'
  | 'enemyMissile'

export type Projectile = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  damage: number
  radius: number
  kind: ProjectileKind
  friendly: boolean
  targetId?: number
  turnRate?: number
  pierce?: number
  explode?: boolean
  hitIds?: Set<number>
}

export type EnemyKind = 'wraith' | 'mirage' | 'titan' | 'boss'

export type Enemy = {
  id: number
  kind: EnemyKind
  bossId?: BossId
  name?: string
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  r: number
  phase: number
  fireCd: number
  score: number
  angle: number
  isBoss?: boolean
}

export type AirPackage = {
  x: number
  y: number
  vx: number
  vy: number
  kind: PackageKind
  r: number
  phase: number
  life: number
}

let nextEnemyId = 1

export function createEnemy(
  kind: Exclude<EnemyKind, 'boss'>,
  x: number,
  y: number,
  difficulty: number,
): Enemy {
  const id = nextEnemyId++
  if (kind === 'wraith') {
    return {
      id,
      kind,
      x,
      y,
      vx: -randRange(70, 120 + difficulty * 12),
      vy: randRange(-30, 30),
      hp: 28 + difficulty * 4,
      maxHp: 28 + difficulty * 4,
      r: 16,
      phase: Math.random() * Math.PI * 2,
      fireCd: 0.5 + Math.random() * 0.7,
      score: 80,
      angle: Math.PI,
    }
  }
  if (kind === 'mirage') {
    return {
      id,
      kind,
      x,
      y,
      vx: -randRange(110, 170 + difficulty * 15),
      vy: randRange(-50, 50),
      hp: 18 + difficulty * 3,
      maxHp: 18 + difficulty * 3,
      r: 13,
      phase: Math.random() * Math.PI * 2,
      fireCd: 0.28 + Math.random() * 0.35,
      score: 120,
      angle: Math.PI,
    }
  }
  return {
    id,
    kind,
    x,
    y,
    vx: -randRange(45, 80 + difficulty * 8),
    vy: randRange(-20, 20),
    hp: 70 + difficulty * 10,
    maxHp: 70 + difficulty * 10,
    r: 24,
    phase: Math.random() * Math.PI * 2,
    fireCd: 0.9 + Math.random() * 0.5,
    score: 220,
    angle: Math.PI,
  }
}

export function createBoss(
  bossId: BossId,
  name: string,
  x: number,
  y: number,
  level: number,
): Enemy {
  const id = nextEnemyId++
  const scale = 1 + (level - 1) * 0.35
  const stats: Record<BossId, { hp: number; r: number; score: number }> = {
    sol: { hp: 520, r: 42, score: 1200 },
    eclipse: { hp: 680, r: 38, score: 1600 },
    leviathan: { hp: 980, r: 56, score: 2400 },
    null: { hp: 1400, r: 50, score: 4000 },
  }
  const s = stats[bossId]
  return {
    id,
    kind: 'boss',
    bossId,
    name,
    isBoss: true,
    x,
    y,
    vx: -35,
    vy: 0,
    hp: s.hp * scale,
    maxHp: s.hp * scale,
    r: s.r,
    phase: 0,
    fireCd: 1.2,
    score: Math.floor(s.score * scale),
    angle: Math.PI,
  }
}

export class CombatSystem {
  projectiles: Projectile[] = []

  clear() {
    this.projectiles.length = 0
  }

  firePlayerWeapon(
    weapon: WeaponId,
    x: number,
    y: number,
    angle: number,
    dmgMult: number,
  ) {
    const d = dmgMult
    if (weapon === 'twin') {
      this.pushShot(x, y - 5, angle, 720, 10 * d, 3.5, 'gun')
      this.pushShot(x, y + 5, angle, 720, 10 * d, 3.5, 'gun')
    } else if (weapon === 'spread') {
      for (let i = -2; i <= 2; i++) {
        this.pushShot(x, y, angle + i * 0.16, 640, 7 * d, 3, 'spread')
      }
    } else if (weapon === 'plasma') {
      this.projectiles.push({
        x,
        y,
        vx: Math.cos(angle) * 380,
        vy: Math.sin(angle) * 380,
        life: 1.6,
        damage: 28 * d,
        radius: 11,
        kind: 'plasma',
        friendly: true,
        explode: true,
      })
    } else if (weapon === 'rail') {
      this.projectiles.push({
        x,
        y,
        vx: Math.cos(angle) * 1100,
        vy: Math.sin(angle) * 1100,
        life: 0.55,
        damage: 55 * d,
        radius: 5,
        kind: 'rail',
        friendly: true,
        pierce: 4,
        hitIds: new Set(),
      })
    } else {
      for (let i = 0; i < 5; i++) {
        const a = angle + (i - 2) * 0.22 + Math.sin(performance.now() / 80 + i) * 0.05
        this.pushShot(x, y, a, 700, 12 * d, 3.2, 'nova')
      }
    }
  }

  private pushShot(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    radius: number,
    kind: ProjectileKind,
  ) {
    this.projectiles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.15,
      damage,
      radius,
      kind,
      friendly: true,
    })
  }

  fireGun(x: number, y: number, angle: number, friendly: boolean) {
    const speed = friendly ? 720 : 420
    const a = angle + (Math.random() - 0.5) * (friendly ? 0.04 : 0.08)
    this.projectiles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: friendly ? 1.1 : 1.6,
      damage: friendly ? 10 : 8,
      radius: friendly ? 3.5 : 3,
      kind: friendly ? 'gun' : 'enemyGun',
      friendly,
    })
  }

  fireMissile(
    x: number,
    y: number,
    angle: number,
    friendly: boolean,
    damageMult = 1,
  ) {
    const speed = friendly ? 400 : 300
    this.projectiles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: friendly ? 2.5 : 2.8,
      damage: (friendly ? 45 : 22) * damageMult,
      radius: friendly ? 7 : 5,
      kind: friendly ? 'missile' : 'enemyMissile',
      friendly,
      turnRate: friendly ? 6 : 3.2,
      explode: true,
    })
  }

  update(dt: number, enemies: Enemy[]) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      if ((p.kind === 'missile' || p.kind === 'enemyMissile') && p.friendly && p.turnRate) {
        const target = findNearestEnemy(enemies, p.x, p.y, p.targetId)
        if (target) {
          steerToward(p, target.x, target.y, dt)
          p.targetId = target.id
        }
      }

      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
      if (p.life <= 0) this.projectiles.splice(i, 1)
    }
  }

  guideEnemyMissiles(tx: number, ty: number, dt: number) {
    for (const p of this.projectiles) {
      if (p.kind !== 'enemyMissile' || !p.turnRate) continue
      steerToward(p, tx, ty, dt)
    }
  }

  hitEnemies(enemies: Enemy[]) {
    const hits: {
      enemy: Enemy
      damage: number
      x: number
      y: number
      kind: ProjectileKind
      explode?: boolean
    }[] = []

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      if (!p.friendly) continue
      let consumed = false
      for (const e of enemies) {
        if (e.hp <= 0) continue
        if (p.hitIds?.has(e.id)) continue
        if (dist(p.x, p.y, e.x, e.y) < p.radius + e.r) {
          hits.push({
            enemy: e,
            damage: p.damage,
            x: p.x,
            y: p.y,
            kind: p.kind,
            explode: p.explode,
          })
          if (p.pierce && p.pierce > 1) {
            p.pierce -= 1
            p.hitIds = p.hitIds ?? new Set()
            p.hitIds.add(e.id)
          } else {
            consumed = true
            break
          }
        }
      }
      if (consumed) this.projectiles.splice(i, 1)
    }
    return hits
  }

  hitPlayer(px: number, py: number, pr: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      if (p.friendly) continue
      if (dist(p.x, p.y, px, py) < p.radius + pr) {
        const damage = p.damage
        this.projectiles.splice(i, 1)
        return { damage, explode: !!p.explode, x: p.x, y: p.y }
      }
    }
    return null
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const p of this.projectiles) {
      const x = p.x - camX
      const y = p.y - camY
      const angle = Math.atan2(p.vy, p.vx)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)

      if (p.kind === 'plasma') {
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16)
        g.addColorStop(0, '#fff4e0')
        g.addColorStop(0.4, '#5ec8c0')
        g.addColorStop(1, 'rgba(94,200,192,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, 16, 0, Math.PI * 2)
        ctx.fill()
      } else if (p.kind === 'rail') {
        ctx.strokeStyle = '#c4a8ff'
        ctx.shadowColor = '#c4a8ff'
        ctx.shadowBlur = 12
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(-18, 0)
        ctx.lineTo(18, 0)
        ctx.stroke()
      } else if (p.kind === 'missile' || p.kind === 'enemyMissile') {
        ctx.fillStyle = p.kind === 'missile' ? '#f4c15d' : '#c45cff'
        ctx.shadowColor = p.kind === 'missile' ? 'rgba(244,193,93,0.8)' : 'rgba(180,100,255,0.7)'
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.moveTo(10, 0)
        ctx.lineTo(-8, -3.5)
        ctx.lineTo(-8, 3.5)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#e85d4c'
        ctx.fillRect(-10, -1.5, 4, 3)
      } else if (p.kind === 'enemyGun') {
        ctx.fillStyle = '#ff7a6a'
        ctx.shadowColor = 'rgba(232, 93, 76, 0.85)'
        ctx.shadowBlur = 8
        ctx.fillRect(-5, -1.2, 10, 2.4)
      } else {
        const color =
          p.kind === 'spread' ? '#ff9a5c' : p.kind === 'nova' ? '#ff6b9d' : '#fff4e0'
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = 8
        ctx.fillRect(-6, -1.5, 12, 3)
      }

      ctx.restore()
    }
    ctx.shadowBlur = 0
  }
}

function steerToward(p: Projectile, tx: number, ty: number, dt: number) {
  if (!p.turnRate) return
  const desired = Math.atan2(ty - p.y, tx - p.x)
  const current = Math.atan2(p.vy, p.vx)
  let diff = desired - current
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  const turn = Math.max(-p.turnRate * dt, Math.min(p.turnRate * dt, diff))
  const next = current + turn
  const speed = Math.hypot(p.vx, p.vy)
  p.vx = Math.cos(next) * speed
  p.vy = Math.sin(next) * speed
}

function findNearestEnemy(
  enemies: Enemy[],
  x: number,
  y: number,
  preferId?: number,
) {
  if (preferId != null) {
    const preferred = enemies.find((e) => e.id === preferId && e.hp > 0)
    if (preferred) return preferred
  }
  let best: Enemy | null = null
  let bestD = Infinity
  for (const e of enemies) {
    if (e.hp <= 0) continue
    const d = dist(x, y, e.x, e.y)
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best
}

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min)
}

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  e: Enemy,
  camX: number,
  camY: number,
  time: number,
) {
  const x = e.x - camX
  const y = e.y - camY
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(e.angle)

  if (e.isBoss) {
    drawBossShip(ctx, e, time)
  } else {
    const accent =
      e.kind === 'titan' ? '#e85d4c' : e.kind === 'mirage' ? '#5ec8c0' : '#c4a8ff'
    const body = e.kind === 'titan' ? '#1a1528' : '#12182a'

    const glow = ctx.createRadialGradient(-18, 0, 1, -18, 0, 22)
    glow.addColorStop(0, accent)
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.globalAlpha = 0.55 + Math.sin(time * 12 + e.phase) * 0.15
    ctx.beginPath()
    ctx.arc(-16, 0, e.kind === 'titan' ? 18 : 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    ctx.fillStyle = accent
    ctx.globalAlpha = 0.85
    const wing = e.kind === 'titan' ? 28 : e.kind === 'mirage' ? 18 : 20
    ctx.beginPath()
    ctx.moveTo(2, 0)
    ctx.lineTo(-10, -wing)
    ctx.lineTo(-4, 0)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(2, 0)
    ctx.lineTo(-10, wing)
    ctx.lineTo(-4, 0)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1

    ctx.fillStyle = body
    ctx.beginPath()
    ctx.moveTo(e.kind === 'titan' ? 26 : 20, 0)
    ctx.lineTo(-14, e.kind === 'titan' ? -8 : -5)
    ctx.lineTo(-18, 0)
    ctx.lineTo(-14, e.kind === 'titan' ? 8 : 5)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.fillStyle = '#fff4e0'
    ctx.beginPath()
    ctx.ellipse(6, 0, 4, 2.2, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()

  const bw = Math.max(40, e.r * 2.4)
  const bx = x - bw / 2
  const by = y - e.r - (e.isBoss ? 22 : 10)
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.fillRect(bx, by, bw, e.isBoss ? 5 : 3)
  ctx.fillStyle = e.isBoss ? '#ff6b9d' : '#f4c15d'
  ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), e.isBoss ? 5 : 3)

  if (e.isBoss && e.name) {
    ctx.fillStyle = 'rgba(255,244,224,0.9)'
    ctx.font = '600 13px Sora, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(e.name, x, by - 6)
  }
}

function drawBossShip(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  const accent =
    e.bossId === 'sol'
      ? '#f4c15d'
      : e.bossId === 'eclipse'
        ? '#5ec8c0'
        : e.bossId === 'leviathan'
          ? '#e85d4c'
          : '#ff6b9d'

  const pulse = 1 + Math.sin(time * 6) * 0.08
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, e.r * 1.8)
  g.addColorStop(0, accent)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalAlpha = 0.35
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, e.r * 1.8 * pulse, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.fillStyle = '#0c101c'
  ctx.beginPath()
  ctx.moveTo(e.r * 1.1, 0)
  ctx.lineTo(-e.r * 0.7, -e.r * 0.7)
  ctx.lineTo(-e.r * 0.95, 0)
  ctx.lineTo(-e.r * 0.7, e.r * 0.7)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = accent
  ctx.lineWidth = 2.5
  ctx.stroke()

  // Wing fins
  ctx.fillStyle = accent
  ctx.globalAlpha = 0.8
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-e.r * 0.4, -e.r * 1.15)
  ctx.lineTo(-e.r * 0.1, -e.r * 0.2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-e.r * 0.4, e.r * 1.15)
  ctx.lineTo(-e.r * 0.1, e.r * 0.2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.fillStyle = '#fff4e0'
  ctx.beginPath()
  ctx.ellipse(e.r * 0.25, 0, e.r * 0.22, e.r * 0.12, 0, 0, Math.PI * 2)
  ctx.fill()
}

export function drawPackage(
  ctx: CanvasRenderingContext2D,
  p: AirPackage,
  camX: number,
  camY: number,
  time: number,
) {
  const x = p.x - camX
  const y = p.y - camY + Math.sin(time * 3 + p.phase) * 4
  const colors: Record<PackageKind, string> = {
    weapon: '#ff6b9d',
    missiles: '#f4c15d',
    heal: '#5ec8c0',
    upgrade: '#c4a8ff',
    overcharge: '#ff9a5c',
  }
  const c = colors[p.kind]
  const g = ctx.createRadialGradient(x, y, 2, x, y, 28)
  g.addColorStop(0, c)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.globalAlpha = 0.55
  ctx.beginPath()
  ctx.arc(x, y, 28, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.fillStyle = 'rgba(10,22,40,0.85)'
  ctx.strokeStyle = c
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.rect(x - 12, y - 10, 24, 20)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = c
  ctx.font = '700 10px Sora, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const label =
    p.kind === 'weapon'
      ? 'WPN'
      : p.kind === 'missiles'
        ? 'MSL'
        : p.kind === 'heal'
          ? 'HP'
          : p.kind === 'upgrade'
            ? 'UP'
            : 'OVR'
  ctx.fillText(label, x, y)

  // Parachute
  ctx.strokeStyle = 'rgba(255,244,224,0.45)'
  ctx.beginPath()
  ctx.moveTo(x - 8, y - 10)
  ctx.quadraticCurveTo(x, y - 28, x + 8, y - 10)
  ctx.stroke()
}

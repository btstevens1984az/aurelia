import { dist } from './math'

export type ProjectileKind = 'gun' | 'missile' | 'enemyGun' | 'enemyMissile'

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
}

export type EnemyKind = 'wraith' | 'mirage' | 'titan'

export type Enemy = {
  id: number
  kind: EnemyKind
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
}

let nextEnemyId = 1

export function createEnemy(
  kind: EnemyKind,
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
      fireCd: 0.6 + Math.random() * 0.8,
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
      fireCd: 0.35 + Math.random() * 0.4,
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
    fireCd: 1.1 + Math.random() * 0.6,
    score: 220,
    angle: Math.PI,
  }
}

export class CombatSystem {
  projectiles: Projectile[] = []

  clear() {
    this.projectiles.length = 0
  }

  fireGun(x: number, y: number, angle: number, friendly: boolean) {
    const speed = friendly ? 720 : 420
    const spread = friendly ? 0.04 : 0.08
    const a = angle + (Math.random() - 0.5) * spread
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
    targetId?: number,
  ) {
    const speed = friendly ? 380 : 300
    this.projectiles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: friendly ? 2.4 : 2.8,
      damage: friendly ? 45 : 22,
      radius: friendly ? 6 : 5,
      kind: friendly ? 'missile' : 'enemyMissile',
      friendly,
      targetId,
      turnRate: friendly ? 5.5 : 3.2,
    })
  }

  update(dt: number, enemies: Enemy[]) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      if (p.kind === 'missile' || p.kind === 'enemyMissile') {
        const target = p.friendly
          ? findNearestEnemy(enemies, p.x, p.y, p.targetId)
          : null
        if (target && p.turnRate) {
          const desired = Math.atan2(target.y - p.y, target.x - p.x)
          const current = Math.atan2(p.vy, p.vx)
          let diff = desired - current
          while (diff > Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          const turn = Math.max(-p.turnRate * dt, Math.min(p.turnRate * dt, diff))
          const next = current + turn
          const speed = Math.hypot(p.vx, p.vy)
          p.vx = Math.cos(next) * speed
          p.vy = Math.sin(next) * speed
          if (p.friendly) p.targetId = target.id
        } else if (!p.friendly && p.turnRate) {
          // Enemy missiles gently track player via targetId encoded as -1 and external aim;
          // vy/vx already set; mild gravity-like pull handled by caller updating angle before fire.
        }
      }

      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
      if (p.life <= 0) this.projectiles.splice(i, 1)
    }
  }

  /** Steer enemy missiles toward a point each frame. */
  guideEnemyMissiles(tx: number, ty: number, dt: number) {
    for (const p of this.projectiles) {
      if (p.kind !== 'enemyMissile' || !p.turnRate) continue
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
  }

  hitEnemies(enemies: Enemy[]) {
    const hits: { enemy: Enemy; damage: number; x: number; y: number; kind: ProjectileKind }[] = []
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      if (!p.friendly) continue
      for (const e of enemies) {
        if (e.hp <= 0) continue
        if (dist(p.x, p.y, e.x, e.y) < p.radius + e.r) {
          hits.push({ enemy: e, damage: p.damage, x: p.x, y: p.y, kind: p.kind })
          this.projectiles.splice(i, 1)
          break
        }
      }
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
        return damage
      }
    }
    return 0
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    for (const p of this.projectiles) {
      const x = p.x - camX
      const y = p.y - camY
      const angle = Math.atan2(p.vy, p.vx)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)

      if (p.kind === 'gun') {
        ctx.fillStyle = '#fff4e0'
        ctx.shadowColor = 'rgba(244, 193, 93, 0.9)'
        ctx.shadowBlur = 8
        ctx.fillRect(-6, -1.5, 12, 3)
      } else if (p.kind === 'enemyGun') {
        ctx.fillStyle = '#ff7a6a'
        ctx.shadowColor = 'rgba(232, 93, 76, 0.85)'
        ctx.shadowBlur = 8
        ctx.fillRect(-5, -1.2, 10, 2.4)
      } else if (p.kind === 'missile') {
        ctx.fillStyle = '#f4c15d'
        ctx.shadowColor = 'rgba(244, 193, 93, 0.7)'
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.moveTo(10, 0)
        ctx.lineTo(-8, -3.5)
        ctx.lineTo(-8, 3.5)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#e85d4c'
        ctx.fillRect(-10, -1.5, 4, 3)
      } else {
        ctx.fillStyle = '#c45cff'
        ctx.shadowColor = 'rgba(180, 100, 255, 0.7)'
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.moveTo(9, 0)
        ctx.lineTo(-7, -3)
        ctx.lineTo(-7, 3)
        ctx.closePath()
        ctx.fill()
      }

      ctx.restore()
    }
    ctx.shadowBlur = 0
  }
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

  const accent =
    e.kind === 'titan' ? '#e85d4c' : e.kind === 'mirage' ? '#5ec8c0' : '#c4a8ff'
  const body = e.kind === 'titan' ? '#1a1528' : '#12182a'

  // Engine glow
  const glow = ctx.createRadialGradient(-18, 0, 1, -18, 0, 22)
  glow.addColorStop(0, accent)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.globalAlpha = 0.55 + Math.sin(time * 12 + e.phase) * 0.15
  ctx.beginPath()
  ctx.arc(-16, 0, e.kind === 'titan' ? 18 : 12, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // Wings
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

  // Fuselage
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

  // Cockpit
  ctx.fillStyle = '#fff4e0'
  ctx.beginPath()
  ctx.ellipse(6, 0, 4, 2.2, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()

  // HP bar
  if (e.hp < e.maxHp) {
    const bw = e.r * 2.2
    const bx = x - bw / 2
    const by = y - e.r - 10
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(bx, by, bw, 3)
    ctx.fillStyle = accent
    ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 3)
  }
}

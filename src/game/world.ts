import { dist, rand, randInt } from './math'
import {
  createEnemy,
  type AirPackage,
  type Enemy,
  type EnemyKind,
} from './combat'
import { randomPackageKind } from './progression'

export type Lantern = {
  x: number
  y: number
  r: number
  collected: boolean
  phase: number
  worth: number
}

export type Thermal = {
  x: number
  y: number
  w: number
  h: number
  phase: number
}

export type Mote = {
  x: number
  y: number
  z: number
  s: number
  phase: number
}

export class World {
  lanterns: Lantern[] = []
  thermals: Thermal[] = []
  enemies: Enemy[] = []
  packages: AirPackage[] = []
  motes: Mote[] = []
  mountainsFar: { x: number; h: number }[] = []
  mountainsNear: { x: number; h: number }[] = []

  bossActive = false
  spawnMult = 1.2

  private nextLanternX = 0
  private nextThermalX = 0
  private nextEnemyX = 0
  private nextPackageX = 0
  private scrollMax = 0

  reset(viewW: number, viewH: number) {
    this.lanterns = []
    this.thermals = []
    this.enemies = []
    this.packages = []
    this.motes = []
    this.mountainsFar = []
    this.mountainsNear = []
    this.bossActive = false
    this.spawnMult = 1.2
    this.nextLanternX = viewW * 0.7
    this.nextThermalX = viewW * 0.9
    this.nextEnemyX = viewW * 1.15
    this.nextPackageX = viewW * 1.8
    this.scrollMax = 0

    for (let i = 0; i < 28; i++) {
      this.mountainsFar.push({ x: i * 180 - 100, h: rand(80, 180) })
      this.mountainsNear.push({ x: i * 140 - 80, h: rand(60, 140) })
    }

    for (let i = 0; i < 90; i++) {
      this.motes.push({
        x: rand(0, viewW * 3),
        y: rand(0, viewH),
        z: rand(0.2, 1),
        s: rand(0.8, 2.4),
        phase: rand(0, Math.PI * 2),
      })
    }

    for (let i = 0; i < 5; i++) {
      this.spawnLantern(viewW * 0.55 + i * 140, viewH)
    }
  }

  update(dt: number, camX: number, viewW: number, viewH: number, difficulty: number) {
    this.scrollMax = Math.max(this.scrollMax, camX + viewW)

    while (this.nextLanternX < this.scrollMax + viewW) {
      this.spawnLantern(this.nextLanternX, viewH)
      this.nextLanternX += rand(120, 210) / (1 + difficulty * 0.05)
    }

    while (this.nextThermalX < this.scrollMax + viewW) {
      this.spawnThermal(this.nextThermalX, viewH)
      this.nextThermalX += rand(400, 680)
    }

    if (!this.bossActive) {
      while (this.nextEnemyX < this.scrollMax + viewW) {
        this.spawnEnemyWave(this.nextEnemyX, viewH, difficulty)
        this.nextEnemyX +=
          rand(200, 380) / (this.spawnMult * (1 + difficulty * 0.12))
      }
    }

    while (this.nextPackageX < this.scrollMax + viewW) {
      if (Math.random() < 0.72) this.spawnPackage(this.nextPackageX, viewH)
      this.nextPackageX += rand(480, 900) / (1 + difficulty * 0.05)
    }

    for (const e of this.enemies) {
      if (e.hp <= 0) continue
      e.phase += dt * (e.kind === 'mirage' ? 4.2 : e.isBoss ? 1.6 : 2.4)
      if (e.isBoss) {
        // Hold roughly in front of camera, weave vertically
        const holdX = camX + viewW * 0.72
        e.vx += (holdX - e.x) * 0.9 * dt
        e.vy = Math.sin(e.phase) * (70 + difficulty * 8)
        e.x += e.vx * dt
        e.y += e.vy * dt
        e.y = Math.max(70, Math.min(viewH - 70, e.y))
        e.vx *= 0.92
      } else {
        if (e.kind === 'mirage') {
          e.vy = Math.sin(e.phase) * (90 + difficulty * 10)
        } else if (e.kind === 'titan') {
          e.vy += Math.sin(e.phase * 0.6) * 20 * dt
        } else {
          e.vy += Math.sin(e.phase) * 28 * dt
        }
        e.x += e.vx * dt
        e.y += e.vy * dt
        e.y = Math.max(40, Math.min(viewH - 40, e.y))
      }
      e.angle = Math.atan2(e.vy, Math.min(-40, e.vx))
      e.fireCd = Math.max(0, e.fireCd - dt)
    }

    for (const p of this.packages) {
      p.phase += dt * 2
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += Math.sin(p.phase) * 10 * dt
      p.life -= dt
    }

    for (const m of this.motes) {
      m.phase += dt * (0.4 + m.z)
      m.y += Math.sin(m.phase) * 6 * dt
      if (m.x < camX - 40) {
        m.x = camX + viewW + rand(0, viewW)
        m.y = rand(0, viewH)
      }
    }

    for (const chain of [this.mountainsFar, this.mountainsNear]) {
      for (const m of chain) {
        if (m.x < camX - 400) {
          const maxX = Math.max(...chain.map((c) => c.x))
          m.x = maxX + (chain === this.mountainsFar ? 180 : 140)
          m.h = rand(
            chain === this.mountainsFar ? 80 : 60,
            chain === this.mountainsFar ? 180 : 140,
          )
        }
      }
    }

    const cullLeft = camX - 220
    this.lanterns = this.lanterns.filter((l) => !l.collected && l.x > cullLeft)
    this.thermals = this.thermals.filter((t) => t.x + t.w > cullLeft)
    this.enemies = this.enemies.filter((e) => e.hp > 0 && (e.isBoss || e.x > cullLeft - 120))
    this.packages = this.packages.filter((p) => p.life > 0 && p.x > cullLeft)
  }

  private spawnLantern(x: number, viewH: number) {
    const cluster = Math.random() < 0.22 ? randInt(2, 4) : 1
    for (let i = 0; i < cluster; i++) {
      this.lanterns.push({
        x: x + i * rand(36, 54),
        y: rand(viewH * 0.18, viewH * 0.82),
        r: rand(10, 15),
        collected: false,
        phase: rand(0, Math.PI * 2),
        worth: cluster > 1 ? 15 : 10,
      })
    }
  }

  private spawnThermal(x: number, viewH: number) {
    const h = rand(viewH * 0.35, viewH * 0.7)
    this.thermals.push({
      x,
      y: rand(40, viewH - h - 40),
      w: rand(70, 120),
      h,
      phase: rand(0, Math.PI * 2),
    })
  }

  private spawnEnemyWave(x: number, viewH: number, difficulty: number) {
    const roll = Math.random()
    let kind: Exclude<EnemyKind, 'boss'> = 'wraith'
    if (roll > 0.78 - difficulty * 0.04) kind = 'titan'
    else if (roll > 0.4) kind = 'mirage'

    const count =
      kind === 'titan'
        ? randInt(1, 2)
        : kind === 'mirage'
          ? randInt(2, 3 + Math.floor(difficulty * 0.5))
          : randInt(2, 3 + Math.floor(difficulty * 0.6))

    const baseY = rand(viewH * 0.18, viewH * 0.82)
    for (let i = 0; i < count; i++) {
      this.enemies.push(
        createEnemy(kind, x + i * 48, baseY + i * rand(-40, 40), difficulty),
      )
    }
  }

  spawnPackage(x: number, viewH: number, kind = randomPackageKind()) {
    this.packages.push({
      x,
      y: rand(viewH * 0.2, viewH * 0.75),
      vx: -rand(20, 45),
      vy: rand(-15, 15),
      kind,
      r: 18,
      phase: rand(0, Math.PI * 2),
      life: 18,
    })
  }

  /** Drop a crate from a destroyed jet. */
  dropFromKill(x: number, y: number) {
    if (Math.random() < 0.38) {
      this.packages.push({
        x,
        y,
        vx: rand(-30, 10),
        vy: rand(-40, 20),
        kind: randomPackageKind(),
        r: 18,
        phase: rand(0, Math.PI * 2),
        life: 14,
      })
    }
  }

  inThermal(px: number, py: number) {
    for (const t of this.thermals) {
      if (px > t.x && px < t.x + t.w && py > t.y && py < t.y + t.h) return true
    }
    return false
  }

  collectLanterns(px: number, py: number, pr: number, magnet = 0) {
    const got: Lantern[] = []
    for (const l of this.lanterns) {
      if (l.collected) continue
      const d = dist(px, py, l.x, l.y)
      if (magnet > 0 && d < magnet) {
        l.x += (px - l.x) * 0.08
        l.y += (py - l.y) * 0.08
      }
      if (dist(px, py, l.x, l.y) < pr + l.r) {
        l.collected = true
        got.push(l)
      }
    }
    return got
  }

  collectPackages(px: number, py: number, pr: number, magnet = 0) {
    const got: AirPackage[] = []
    for (let i = this.packages.length - 1; i >= 0; i--) {
      const p = this.packages[i]
      let d = dist(px, py, p.x, p.y)
      if (magnet > 0 && d < magnet + 30) {
        p.x += (px - p.x) * 0.1
        p.y += (py - p.y) * 0.1
        d = dist(px, py, p.x, p.y)
      }
      if (d < pr + p.r) {
        got.push(p)
        this.packages.splice(i, 1)
      }
    }
    return got
  }

  enemyCollision(px: number, py: number, pr: number) {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue
      if (dist(px, py, e.x, e.y) < pr + e.r * 0.75) return e
    }
    return null
  }

  nearMissEnemy(px: number, py: number, pr: number) {
    let closest = Infinity
    for (const e of this.enemies) {
      if (e.hp <= 0) continue
      closest = Math.min(closest, dist(px, py, e.x, e.y) - pr - e.r)
    }
    return closest > 0 && closest < 30
  }
}

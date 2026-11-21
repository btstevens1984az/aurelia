import { clamp, dist, rand, randInt } from './math'

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

export type Spire = {
  x: number
  y: number
  w: number
  h: number
  tip: number
}

export type Bird = {
  x: number
  y: number
  vx: number
  vy: number
  phase: number
  r: number
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
  spires: Spire[] = []
  birds: Bird[] = []
  motes: Mote[] = []
  mountainsFar: { x: number; h: number }[] = []
  mountainsNear: { x: number; h: number }[] = []

  private nextLanternX = 0
  private nextThermalX = 0
  private nextSpireX = 0
  private nextBirdX = 0
  private scrollMax = 0

  reset(viewW: number, viewH: number) {
    this.lanterns = []
    this.thermals = []
    this.spires = []
    this.birds = []
    this.motes = []
    this.mountainsFar = []
    this.mountainsNear = []
    this.nextLanternX = viewW * 0.7
    this.nextThermalX = viewW * 0.9
    this.nextSpireX = viewW * 1.4
    this.nextBirdX = viewW * 2.2
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

    // Opening breath of lanterns
    for (let i = 0; i < 5; i++) {
      this.spawnLantern(viewW * 0.55 + i * 140, viewH)
    }
  }

  update(dt: number, camX: number, viewW: number, viewH: number, difficulty: number) {
    this.scrollMax = Math.max(this.scrollMax, camX + viewW)

    while (this.nextLanternX < this.scrollMax + viewW) {
      this.spawnLantern(this.nextLanternX, viewH)
      this.nextLanternX += rand(110, 200) / (1 + difficulty * 0.08)
    }

    while (this.nextThermalX < this.scrollMax + viewW) {
      this.spawnThermal(this.nextThermalX, viewH)
      this.nextThermalX += rand(420, 720)
    }

    while (this.nextSpireX < this.scrollMax + viewW) {
      this.spawnSpire(this.nextSpireX, viewH, difficulty)
      this.nextSpireX += rand(260, 480) / (1 + difficulty * 0.05)
    }

    while (this.nextBirdX < this.scrollMax + viewW) {
      this.spawnBird(this.nextBirdX, viewH, difficulty)
      this.nextBirdX += rand(380, 700) / (1 + difficulty * 0.12)
    }

    for (const b of this.birds) {
      b.x += b.vx * dt
      b.y += b.vy * dt + Math.sin(b.phase) * 18 * dt
      b.phase += dt * 3
    }

    for (const m of this.motes) {
      m.phase += dt * (0.4 + m.z)
      m.y += Math.sin(m.phase) * 6 * dt
      if (m.x < camX - 40) {
        m.x = camX + viewW + rand(0, viewW)
        m.y = rand(0, viewH)
      }
    }

    // Recycle mountain segments
    for (const chain of [this.mountainsFar, this.mountainsNear]) {
      for (const m of chain) {
        if (m.x < camX - 400) {
          const maxX = Math.max(...chain.map((c) => c.x))
          m.x = maxX + (chain === this.mountainsFar ? 180 : 140)
          m.h = rand(chain === this.mountainsFar ? 80 : 60, chain === this.mountainsFar ? 180 : 140)
        }
      }
    }

    const cullLeft = camX - 200
    this.lanterns = this.lanterns.filter((l) => !l.collected && l.x > cullLeft)
    this.thermals = this.thermals.filter((t) => t.x + t.w > cullLeft)
    this.spires = this.spires.filter((s) => s.x + s.w > cullLeft)
    this.birds = this.birds.filter((b) => b.x > cullLeft - 100)
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

  private spawnSpire(x: number, viewH: number, difficulty: number) {
    const fromTop = Math.random() < 0.5
    const h = rand(viewH * 0.22, viewH * (0.38 + difficulty * 0.03))
    this.spires.push({
      x,
      y: fromTop ? 0 : viewH - h,
      w: rand(28, 48),
      h,
      tip: fromTop ? 1 : -1,
    })
  }

  private spawnBird(x: number, viewH: number, difficulty: number) {
    const count = Math.random() < 0.35 + difficulty * 0.04 ? randInt(2, 4) : 1
    const baseY = rand(viewH * 0.2, viewH * 0.8)
    for (let i = 0; i < count; i++) {
      this.birds.push({
        x: x + i * 34,
        y: baseY + i * rand(-18, 18),
        vx: -rand(40, 90 + difficulty * 10),
        vy: rand(-20, 20),
        phase: rand(0, Math.PI * 2),
        r: 12,
      })
    }
  }

  inThermal(px: number, py: number) {
    for (const t of this.thermals) {
      if (px > t.x && px < t.x + t.w && py > t.y && py < t.y + t.h) return true
    }
    return false
  }

  collectLanterns(px: number, py: number, pr: number) {
    const got: Lantern[] = []
    for (const l of this.lanterns) {
      if (l.collected) continue
      if (dist(px, py, l.x, l.y) < pr + l.r) {
        l.collected = true
        got.push(l)
      }
    }
    return got
  }

  hitObstacle(px: number, py: number, pr: number) {
    for (const s of this.spires) {
      const cx = clamp(px, s.x, s.x + s.w)
      const cy = clamp(py, s.y, s.y + s.h)
      if (dist(px, py, cx, cy) < pr * 0.85) return true
    }
    for (const b of this.birds) {
      if (dist(px, py, b.x, b.y) < pr + b.r * 0.7) return true
    }
    return false
  }

  nearMiss(px: number, py: number, pr: number) {
    let closest = Infinity
    for (const s of this.spires) {
      const cx = clamp(px, s.x, s.x + s.w)
      const cy = clamp(py, s.y, s.y + s.h)
      closest = Math.min(closest, dist(px, py, cx, cy) - pr)
    }
    for (const b of this.birds) {
      closest = Math.min(closest, dist(px, py, b.x, b.y) - pr - b.r)
    }
    return closest > 0 && closest < 28
  }
}

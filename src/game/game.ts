import { Input } from './input'
import { GameAudio } from './audio'
import { ParticleSystem } from './particles'
import { Player } from './player'
import { World } from './world'
import { CombatSystem, createBoss, drawEnemy, drawPackage } from './combat'
import {
  LEVELS,
  UPGRADES,
  UPGRADE_ORDER,
  type UpgradeId,
} from './progression'
import { WEAPONS, nextWeaponAfter, randomWeapon } from './weapons'
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
  combat = new CombatSystem()

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
  gunSoundCooldown = 0
  startOriginX = 0

  levelIndex = 0
  levelKills = 0
  totalKills = 0
  bossSpawned = false
  toastTimer = 0
  announceTimer = 0

  private last = 0
  private running = false

  private el = {
    hud: document.getElementById('hud')!,
    score: document.getElementById('score')!,
    distance: document.getElementById('distance')!,
    kills: document.getElementById('kills')!,
    weapon: document.getElementById('weapon')!,
    combo: document.getElementById('combo')!,
    levelBanner: document.getElementById('level-banner')!,
    bossWrap: document.getElementById('boss-bar-wrap')!,
    bossName: document.getElementById('boss-name')!,
    bossFill: document.getElementById('boss-fill')!,
    boostBar: document.getElementById('boost-bar')!,
    boostFill: document.getElementById('boost-fill')!,
    hpFill: document.getElementById('hp-fill')!,
    missiles: document.getElementById('missiles')!,
    toast: document.getElementById('toast')!,
    overlay: document.getElementById('overlay')!,
    pause: document.getElementById('pause')!,
    tagline: document.getElementById('tagline')!,
    startBtn: document.getElementById('start-btn') as HTMLButtonElement,
    resumeBtn: document.getElementById('resume-btn') as HTMLButtonElement,
    menuStats: document.getElementById('menu-stats')!,
    finalScore: document.getElementById('final-score')!,
    bestScore: document.getElementById('best-score')!,
    finalLevel: document.getElementById('final-level')!,
    touchHint: document.getElementById('touch-hint')!,
    touchControls: document.getElementById('touch-controls')!,
    btnGun: document.getElementById('btn-gun') as HTMLButtonElement,
    btnMissile: document.getElementById('btn-missile') as HTMLButtonElement,
    btnWeapon: document.getElementById('btn-weapon') as HTMLButtonElement,
    btnBoost: document.getElementById('btn-boost') as HTMLButtonElement,
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
    this.bindTouchWeapons()
    window.addEventListener('keydown', this.onGlobalKey)
    window.addEventListener('resize', this.resize)
    this.resize()
    this.showTitle()
  }

  private bindTouchWeapons() {
    const hold = (
      btn: HTMLButtonElement,
      on: () => void,
      off: () => void,
    ) => {
      const start = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        on()
      }
      const end = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        off()
      }
      btn.addEventListener('pointerdown', start)
      btn.addEventListener('pointerup', end)
      btn.addEventListener('pointerleave', end)
      btn.addEventListener('pointercancel', end)
    }

    hold(
      this.el.btnGun,
      () => this.input.setTouchGun(true),
      () => this.input.setTouchGun(false),
    )
    hold(
      this.el.btnBoost,
      () => this.input.setTouchBoost(true),
      () => this.input.setTouchBoost(false),
    )
    this.el.btnMissile.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.input.setTouchMissile(true)
    })
    this.el.btnMissile.addEventListener('pointerup', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.input.clearTouchMissile()
    })
    this.el.btnWeapon.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.player.cycleWeapon()
      this.toast(`Weapon: ${WEAPONS[this.player.weapon].name}`, 1.6)
      this.syncHud()
    })
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
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
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
    if (e.key === 'Enter' && (this.mode === 'title' || this.mode === 'over')) {
      e.preventDefault()
      void this.begin()
    }
  }

  private level() {
    return LEVELS[Math.min(this.levelIndex, LEVELS.length - 1)]
  }

  private showTitle() {
    this.mode = 'title'
    this.el.overlay.classList.remove('hidden')
    this.el.pause.classList.add('hidden')
    this.el.hud.classList.add('hidden')
    this.el.boostBar.classList.add('hidden')
    this.el.touchControls.classList.add('hidden')
    this.el.menuStats.classList.add('hidden')
    this.el.bossWrap.classList.add('hidden')
    this.el.tagline.textContent =
      'Levels. Bosses. Absurd explosions. Air packages raining firepower.'
    this.el.startBtn.textContent = 'Begin Sortie'
    this.el.touchHint.classList.add('hidden')
    this.hideToast()
    this.seedTitleScene()
  }

  private seedTitleScene() {
    this.world.reset(this.width, this.height)
    this.particles.clear()
    this.combat.clear()
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
    this.gunSoundCooldown = 0
    this.levelIndex = 0
    this.levelKills = 0
    this.totalKills = 0
    this.bossSpawned = false
    this.particles.clear()
    this.combat.clear()
    this.world.reset(this.width, this.height)
    this.applyLevelSettings()
    this.player.reset(this.width * 0.32, this.height * 0.5)
    this.startOriginX = this.player.x
    this.camX = this.player.x - this.width * 0.32
    this.camY = 0

    this.el.overlay.classList.add('hidden')
    this.el.pause.classList.add('hidden')
    this.el.hud.classList.remove('hidden')
    this.el.boostBar.classList.remove('hidden')
    this.el.touchControls.classList.remove('hidden')
    this.el.touchHint.classList.remove('hidden')
    this.el.bossWrap.classList.add('hidden')
    this.announceLevel()
    this.syncHud()
  }

  private applyLevelSettings() {
    const lv = this.level()
    this.world.spawnMult = lv.spawnMult
    this.world.bossActive = false
    this.bossSpawned = false
  }

  private announceLevel() {
    const lv = this.level()
    this.toast(`Level ${lv.level}: ${lv.name} — ${lv.blurb}`, 3.2)
    this.audio.levelUp()
    this.announceTimer = 3.2
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

  private toast(msg: string, duration = 2.2) {
    this.el.toast.textContent = msg
    this.el.toast.classList.remove('hidden')
    this.toastTimer = duration
  }

  private hideToast() {
    this.el.toast.classList.add('hidden')
    this.toastTimer = 0
  }

  private gameOver() {
    this.mode = 'over'
    this.player.alive = false
    this.audio.hit()
    this.absurdExplosion(this.player.x, this.player.y, 1.4)
    if (this.score > this.best) {
      this.best = this.score
      localStorage.setItem(HS_KEY, String(this.best))
    }
    this.el.hud.classList.add('hidden')
    this.el.boostBar.classList.add('hidden')
    this.el.touchControls.classList.add('hidden')
    this.el.bossWrap.classList.add('hidden')
    this.el.menuStats.classList.remove('hidden')
    this.el.finalScore.textContent = String(Math.floor(this.score))
    this.el.bestScore.textContent = String(Math.floor(this.best))
    this.el.finalLevel.textContent = String(this.level().level)
    this.el.tagline.textContent =
      this.score >= this.best && this.score > 0
        ? 'Cataclysm complete. The dusk crowns you.'
        : 'Hull breached. Climb again.'
    this.el.startBtn.textContent = 'Fly Again'
    this.el.overlay.classList.remove('hidden')
  }

  private absurdExplosion(x: number, y: number, power = 1) {
    const p = power * this.player.boomPower
    this.particles.megaExplosion(x, y, p)
    this.shake = Math.max(this.shake, 18 + p * 10)
    this.flash = Math.max(this.flash, 0.55 + p * 0.15)
    this.audio.megaBoom()
  }

  private update(dt: number) {
    this.time += dt
    this.shake = Math.max(0, this.shake - dt * 22)
    this.flash = Math.max(0, this.flash - dt * 1.1)
    if (this.toastTimer > 0) {
      this.toastTimer -= dt
      if (this.toastTimer <= 0) this.hideToast()
    }
    this.announceTimer = Math.max(0, this.announceTimer - dt)

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

    const lv = this.level()
    const difficulty = clamp(
      this.distance / 1800 + lv.difficultyBias,
      0,
      6,
    )
    const inThermal = this.world.inThermal(this.player.x, this.player.y)
    this.player.update(dt, this.input, this.particles, this.width, this.height, inThermal)

    if (this.input.consumeWeaponCycle()) {
      this.player.cycleWeapon()
      this.toast(`Weapon: ${WEAPONS[this.player.weapon].name}`, 1.4)
    }

    const targetCamX = this.player.x - this.width * 0.32
    const targetCamY = (this.player.y - this.height * 0.5) * 0.15
    this.camX = lerp(this.camX, targetCamX, 1 - Math.pow(0.0008, dt))
    this.camY = lerp(this.camY, targetCamY, 1 - Math.pow(0.01, dt))

    this.world.update(dt, this.camX, this.width, this.height, difficulty)
    this.updateCombat(dt, difficulty)
    this.particles.update(dt)

    this.distance = Math.max(0, (this.player.x - this.startOriginX) / 10)
    this.score += dt * (5 + this.combo * 2) * (1 + difficulty * 0.2)

    if (inThermal) {
      this.thermalScoreTick += dt
      if (this.thermalScoreTick > 0.35) {
        this.thermalScoreTick = 0
        this.score += 5 * this.combo
        this.audio.thermal()
      }
    }

    const collected = this.world.collectLanterns(
      this.player.x,
      this.player.y,
      this.player.radius,
      this.player.magnetRange,
    )
    for (const l of collected) {
      this.combo = Math.min(12, this.combo + 1)
      this.comboTimer = 2.4
      this.score += l.worth * this.combo
      this.player.missiles = Math.min(
        this.player.maxMissiles,
        this.player.missiles + 1,
      )
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 4)
      this.audio.collect()
      this.particles.burst(l.x, l.y, 16, { speed: 140, hue: 42, kind: 'spark' })
    }

    const packs = this.world.collectPackages(
      this.player.x,
      this.player.y,
      this.player.radius,
      this.player.magnetRange,
    )
    for (const p of packs) this.applyPackage(p.kind)

    this.comboTimer -= dt
    if (this.comboTimer <= 0) this.combo = 1

    this.nearMissCooldown -= dt
    if (
      this.nearMissCooldown <= 0 &&
      this.world.nearMissEnemy(this.player.x, this.player.y, this.player.radius)
    ) {
      this.nearMissCooldown = 0.5
      this.combo = Math.min(12, this.combo + 1)
      this.comboTimer = 2.2
      this.score += 25 * this.combo
      this.audio.nearMiss()
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

    const ram = this.world.enemyCollision(
      this.player.x,
      this.player.y,
      this.player.radius,
    )
    if (ram && this.player.invuln <= 0) {
      const dead = this.player.takeDamage(ram.isBoss ? 28 : 16)
      this.audio.damage()
      this.shake = Math.max(this.shake, 10)
      this.flash = Math.max(this.flash, 0.3)
      ram.hp -= 30 * this.player.damageMult
      this.particles.burst(this.player.x, this.player.y, 14, {
        speed: 180,
        hue: 15,
        kind: 'ember',
      })
      if (ram.hp <= 0) this.destroyEnemy(ram)
      if (dead) this.gameOver()
    }

    this.maybeSpawnBoss()
    this.syncHud()
  }

  private applyPackage(kind: import('./progression').PackageKind) {
    this.audio.pickup()
    this.flash = Math.max(this.flash, 0.18)
    if (kind === 'weapon') {
      const w = randomWeapon(this.player.weapon)
      this.player.unlockWeapon(w)
      this.toast(`Air package: ${WEAPONS[w].name}!`, 2.2)
    } else if (kind === 'missiles') {
      this.player.missiles = Math.min(
        this.player.maxMissiles,
        this.player.missiles + 4,
      )
      this.toast('Air package: Missile reload!', 1.8)
    } else if (kind === 'heal') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 45)
      this.toast('Air package: Hull repair!', 1.8)
    } else if (kind === 'upgrade') {
      const id = this.pickUpgrade()
      this.player.applyUpgrade(id)
      this.toast(`Jet upgrade: ${UPGRADES[id].name}!`, 2.4)
    } else {
      this.player.overcharge = Math.max(this.player.overcharge, 8)
      this.toast('OVERCHARGE — guns gone wild!', 2.2)
    }
  }

  private pickUpgrade(): UpgradeId {
    const unused = UPGRADE_ORDER.filter((id) => !(this.player.upgrades[id] ?? 0))
    if (unused.length) return unused[Math.floor(Math.random() * unused.length)]
    return UPGRADE_ORDER[Math.floor(Math.random() * UPGRADE_ORDER.length)]
  }

  private maybeSpawnBoss() {
    const lv = this.level()
    if (this.bossSpawned || this.levelKills < lv.killsToBoss) return
    this.bossSpawned = true
    this.world.bossActive = true
    // Clear small fry for drama
    for (const e of this.world.enemies) {
      if (!e.isBoss) e.hp = 0
    }
    const boss = createBoss(
      lv.boss,
      lv.bossName,
      this.camX + this.width * 0.78,
      this.height * 0.5,
      lv.level,
    )
    this.world.enemies.push(boss)
    this.toast(`BOSS — ${lv.bossName}`, 3)
    this.audio.levelUp()
    this.el.bossWrap.classList.remove('hidden')
    this.shake = Math.max(this.shake, 12)
  }

  private updateCombat(dt: number, difficulty: number) {
    if (this.input.gunHeld && this.player.gunCd <= 0 && this.player.alive) {
      this.player.gunCd = this.player.weaponInterval()
      const noseX = this.player.x + Math.cos(this.player.angle) * 22
      const noseY = this.player.y + Math.sin(this.player.angle) * 22
      this.combat.firePlayerWeapon(
        this.player.weapon,
        noseX,
        noseY,
        this.player.angle,
        this.player.damageMult,
      )
      if (this.gunSoundCooldown <= 0) {
        this.gunSoundCooldown = 0.06
        this.audio.gun()
      }
    }
    this.gunSoundCooldown = Math.max(0, this.gunSoundCooldown - dt)

    if (
      this.player.alive &&
      this.player.missileCd <= 0 &&
      this.player.missiles > 0 &&
      this.input.missileHeld
    ) {
      this.player.missileCd = 0.48
      this.player.missiles -= 1
      const noseX = this.player.x + Math.cos(this.player.angle) * 18
      const noseY = this.player.y + Math.sin(this.player.angle) * 18
      this.combat.fireMissile(
        noseX,
        noseY,
        this.player.angle,
        true,
        this.player.damageMult,
      )
      this.input.clearTouchMissile()
      this.audio.missile()
    }

    for (const e of this.world.enemies) {
      if (e.hp <= 0 || e.fireCd > 0) continue
      const dx = this.player.x - e.x
      if (!e.isBoss && (dx > 40 || dx < -560)) continue
      const aim = Math.atan2(this.player.y - e.y, this.player.x - e.x)

      if (e.isBoss) {
        this.bossAttack(e, aim, difficulty)
        continue
      }

      if (e.kind === 'titan') {
        e.fireCd = Math.max(0.55, 1.2 - difficulty * 0.1)
        this.combat.fireMissile(e.x, e.y, aim, false)
        this.combat.fireGun(e.x, e.y, aim + 0.12, false)
        this.combat.fireGun(e.x, e.y, aim - 0.12, false)
      } else if (e.kind === 'mirage') {
        e.fireCd = Math.max(0.22, 0.48 - difficulty * 0.04)
        this.combat.fireGun(e.x, e.y, aim, false)
        this.combat.fireGun(e.x, e.y, aim + 0.14, false)
      } else {
        e.fireCd = Math.max(0.35, 0.8 - difficulty * 0.07)
        this.combat.fireGun(e.x, e.y, aim, false)
      }
    }

    this.combat.update(dt, this.world.enemies)
    this.combat.guideEnemyMissiles(this.player.x, this.player.y, dt)

    const hits = this.combat.hitEnemies(this.world.enemies)
    for (const h of hits) {
      h.enemy.hp -= h.damage
      const sparks = h.kind === 'missile' || h.explode ? 22 : 8
      this.particles.burst(h.x, h.y, sparks, {
        speed: h.explode ? 240 : 120,
        hue: h.kind === 'plasma' ? 170 : 35,
        kind: 'spark',
      })
      if (h.explode) {
        this.particles.burst(h.x, h.y, 3, {
          speed: 40,
          kind: 'shock',
          size: 20,
          hue: 40,
        })
      }
      if (h.enemy.hp <= 0) this.destroyEnemy(h.enemy)
    }

    const dmg = this.combat.hitPlayer(
      this.player.x,
      this.player.y,
      this.player.radius,
    )
    if (dmg) {
      const dead = this.player.takeDamage(dmg.damage)
      this.audio.damage()
      this.shake = Math.max(this.shake, 7)
      this.flash = Math.max(this.flash, 0.22)
      this.particles.burst(this.player.x, this.player.y, 12, {
        speed: 150,
        hue: 10,
        kind: 'ember',
      })
      if (dead) this.gameOver()
    }
  }

  private bossAttack(
    e: import('./combat').Enemy,
    aim: number,
    difficulty: number,
  ) {
    const id = e.bossId
    if (id === 'sol') {
      e.fireCd = Math.max(0.35, 0.7 - difficulty * 0.04)
      for (let i = -2; i <= 2; i++) this.combat.fireGun(e.x, e.y, aim + i * 0.12, false)
      if (Math.random() < 0.35) this.combat.fireMissile(e.x, e.y, aim, false)
    } else if (id === 'eclipse') {
      e.fireCd = Math.max(0.28, 0.55 - difficulty * 0.04)
      this.combat.fireGun(e.x, e.y - 18, aim, false)
      this.combat.fireGun(e.x, e.y + 18, aim, false)
      this.combat.fireMissile(e.x, e.y, aim + 0.2, false)
      this.combat.fireMissile(e.x, e.y, aim - 0.2, false)
    } else if (id === 'leviathan') {
      e.fireCd = Math.max(0.4, 0.85 - difficulty * 0.05)
      for (let i = -3; i <= 3; i++) this.combat.fireGun(e.x, e.y, aim + i * 0.1, false)
      this.combat.fireMissile(e.x, e.y, aim, false)
      this.combat.fireMissile(e.x, e.y, aim + 0.35, false)
      this.combat.fireMissile(e.x, e.y, aim - 0.35, false)
    } else {
      e.fireCd = Math.max(0.22, 0.45 - difficulty * 0.03)
      for (let i = 0; i < 8; i++) {
        const a = aim + (i / 8) * Math.PI * 2 + e.phase
        this.combat.fireGun(e.x, e.y, a, false)
      }
      this.combat.fireMissile(e.x, e.y, aim, false)
    }
  }

  private destroyEnemy(e: import('./combat').Enemy) {
    const wasBoss = !!e.isBoss
    e.hp = 0
    this.totalKills += 1
    if (!wasBoss) this.levelKills += 1

    this.combo = Math.min(12, this.combo + (wasBoss ? 3 : 1))
    this.comboTimer = 3
    this.score += e.score * this.combo

    // ABSURD boom
    this.absurdExplosion(e.x, e.y, wasBoss ? 2.4 : 1.15 + Math.random() * 0.4)

    // Chain sparkles for action feel
    for (let i = 0; i < 3; i++) {
      this.particles.burst(
        e.x + (Math.random() - 0.5) * 40,
        e.y + (Math.random() - 0.5) * 40,
        10,
        { speed: 200, hue: 20 + i * 15, kind: 'ember', size: 4 },
      )
    }

    this.world.dropFromKill(e.x, e.y)

    // Every 5 plane kills → new weapon
    if (!wasBoss) {
      const unlock = nextWeaponAfter(this.player.ownedWeapons, this.totalKills)
      if (this.totalKills % 5 === 0) {
        const w = unlock ?? randomWeapon(this.player.weapon)
        this.player.unlockWeapon(w)
        this.toast(`Kill streak armory: ${WEAPONS[w].name} unlocked!`, 2.6)
        this.audio.levelUp()
      }
    }

    if (wasBoss) this.onBossDefeated()
  }

  private onBossDefeated() {
    const lv = this.level()
    this.el.bossWrap.classList.add('hidden')
    this.world.bossActive = false
    this.player.applyUpgrade(lv.rewardUpgrade)
    this.player.hp = this.player.maxHp
    this.player.missiles = this.player.maxMissiles
    this.toast(
      `${lv.bossName} down! Upgrade: ${UPGRADES[lv.rewardUpgrade].name}`,
      3.4,
    )
    this.audio.levelUp()

    if (this.levelIndex >= LEVELS.length - 1) {
      // Endless amp after final boss
      this.levelIndex = LEVELS.length - 1
      this.levelKills = 0
      this.bossSpawned = false
      this.world.spawnMult = 2.1
      this.toast('Nightfall endless — survive the storm!', 3)
      return
    }

    this.levelIndex += 1
    this.levelKills = 0
    this.bossSpawned = false
    this.applyLevelSettings()
    this.announceLevel()
  }

  private syncHud() {
    const lv = this.level()
    this.el.score.textContent = String(Math.floor(this.score))
    this.el.distance.textContent = `${Math.floor(this.distance)}m`
    this.el.kills.textContent = this.bossSpawned
      ? 'BOSS'
      : `${this.levelKills}/${lv.killsToBoss}`
    this.el.boostFill.style.width = `${Math.floor(this.player.boost * 100)}%`
    this.el.hpFill.style.width = `${Math.floor((this.player.hp / this.player.maxHp) * 100)}%`
    this.el.missiles.textContent = String(this.player.missiles)
    this.el.weapon.textContent = WEAPONS[this.player.weapon].name
    this.el.weapon.style.color = WEAPONS[this.player.weapon].color
    this.el.levelBanner.textContent = `Lv ${lv.level} · ${lv.name}`

    const boss = this.world.enemies.find((e) => e.isBoss && e.hp > 0)
    if (boss) {
      this.el.bossWrap.classList.remove('hidden')
      this.el.bossName.textContent = boss.name ?? 'Boss'
      this.el.bossFill.style.width = `${Math.floor((boss.hp / boss.maxHp) * 100)}%`
    } else if (!this.bossSpawned) {
      this.el.bossWrap.classList.add('hidden')
    }

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

    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#070e1a')
    sky.addColorStop(0.35, '#122038')
    sky.addColorStop(0.62, '#3a2a38')
    sky.addColorStop(0.82, '#c45c26')
    sky.addColorStop(1, '#e8a87c')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    const sunX = w * 0.72
    const sunY = h * 0.72
    const sun = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, h * 0.55)
    sun.addColorStop(0, 'rgba(255, 214, 150, 0.55)')
    sun.addColorStop(0.25, 'rgba(232, 138, 74, 0.22)')
    sun.addColorStop(1, 'rgba(232, 138, 74, 0)')
    ctx.fillStyle = sun
    ctx.fillRect(0, 0, w, h)

    this.drawMountains(ctx, this.world.mountainsFar, camX * 0.25, h, '#141e30', 0.9)
    this.drawMountains(ctx, this.world.mountainsNear, camX * 0.45, h, '#0d1524', 1)

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

    for (const t of this.world.thermals) {
      const x = t.x - camX
      const y = t.y - camY
      const g = ctx.createLinearGradient(x, y + t.h, x, y)
      g.addColorStop(0, 'rgba(94, 200, 192, 0)')
      g.addColorStop(0.5, 'rgba(94, 200, 192, 0.14)')
      g.addColorStop(1, 'rgba(94, 200, 192, 0.02)')
      ctx.fillStyle = g
      ctx.fillRect(x, y, t.w, t.h)
    }

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
    }

    for (const p of this.world.packages) {
      drawPackage(ctx, p, camX, camY, this.time)
    }

    for (const e of this.world.enemies) {
      if (e.hp <= 0) continue
      drawEnemy(ctx, e, camX, camY, this.time)
    }

    this.combat.draw(ctx, camX, camY)
    this.particles.draw(ctx, camX, camY)
    this.player.draw(ctx, camX, camY, this.time)

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
      ctx.fillStyle = `rgba(255, 220, 160, ${this.flash * 0.45})`
      ctx.fillRect(0, 0, w, h)
    }

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

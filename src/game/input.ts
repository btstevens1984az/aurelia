export class Input {
  readonly keys = new Set<string>()
  pointerActive = false
  pointerBoost = false
  pointerGun = false
  pointerMissile = false
  pointerX = 0
  pointerY = 0
  private canvas: HTMLCanvasElement
  private bound = false
  private missilePulse = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  bind() {
    if (this.bound) return
    this.bound = true

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)

    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    this.canvas.addEventListener('contextmenu', this.onContextMenu)
  }

  unbind() {
    if (!this.bound) return
    this.bound = false
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    this.canvas.removeEventListener('contextmenu', this.onContextMenu)
  }

  get axis() {
    let x = 0
    let y = 0
    if (this.keys.has('ArrowLeft') || this.keys.has('a') || this.keys.has('A')) x -= 1
    if (this.keys.has('ArrowRight') || this.keys.has('d') || this.keys.has('D')) x += 1
    if (this.keys.has('ArrowUp') || this.keys.has('w') || this.keys.has('W')) y -= 1
    if (this.keys.has('ArrowDown') || this.keys.has('s') || this.keys.has('S')) y += 1
    return { x, y }
  }

  get boostHeld() {
    return this.keys.has('Shift') || this.pointerBoost
  }

  get gunHeld() {
    return (
      this.keys.has(' ') ||
      this.keys.has('j') ||
      this.keys.has('J') ||
      this.keys.has('z') ||
      this.keys.has('Z') ||
      this.pointerGun
    )
  }

  /** One-shot missile request; cleared when consumed. */
  consumeMissile(): boolean {
    const keyed =
      this.keys.has('k') ||
      this.keys.has('K') ||
      this.keys.has('f') ||
      this.keys.has('F') ||
      this.keys.has('x') ||
      this.keys.has('X')
    if (this.missilePulse || this.pointerMissile || keyed) {
      this.missilePulse = false
      this.pointerMissile = false
      // Allow hold-to-repeat via key still being down handled by gunCd style in game
      return true
    }
    return false
  }

  get missileHeld() {
    return (
      this.keys.has('k') ||
      this.keys.has('K') ||
      this.keys.has('f') ||
      this.keys.has('F') ||
      this.keys.has('x') ||
      this.keys.has('X') ||
      this.pointerMissile
    )
  }

  setTouchGun(active: boolean) {
    this.pointerGun = active
  }

  setTouchMissile(active: boolean) {
    if (active) this.pointerMissile = true
  }

  clearTouchMissile() {
    this.pointerMissile = false
  }

  setTouchBoost(active: boolean) {
    this.pointerBoost = active
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault()
    }
    if (e.key === 'k' || e.key === 'K' || e.key === 'f' || e.key === 'F' || e.key === 'x' || e.key === 'X') {
      if (!this.keys.has(e.key)) this.missilePulse = true
    }
    this.keys.add(e.key)
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key)
  }

  private onBlur = () => {
    this.keys.clear()
    this.pointerActive = false
    this.pointerBoost = false
    this.pointerGun = false
    this.pointerMissile = false
  }

  private onContextMenu = (e: Event) => {
    e.preventDefault()
  }

  private onPointerDown = (e: PointerEvent) => {
    // Touch UI buttons handle weapons; canvas drag steers + auto-guns
    if ((e.target as HTMLElement)?.closest?.('.touch-btn')) return
    this.canvas.setPointerCapture(e.pointerId)
    this.pointerActive = true
    if (e.button === 2) {
      this.pointerMissile = true
    } else {
      this.pointerGun = true
    }
    this.updatePointer(e)
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerActive) return
    this.updatePointer(e)
  }

  private onPointerUp = (e: PointerEvent) => {
    this.pointerActive = false
    if (e.button === 2) this.pointerMissile = false
    else this.pointerGun = false
    // Safety clear
    if (e.type === 'pointercancel') {
      this.pointerGun = false
      this.pointerMissile = false
    }
  }

  private updatePointer(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect()
    const scaleX = this.canvas.width / rect.width
    const scaleY = this.canvas.height / rect.height
    this.pointerX = (e.clientX - rect.left) * scaleX
    this.pointerY = (e.clientY - rect.top) * scaleY
  }
}

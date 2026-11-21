export class Input {
  readonly keys = new Set<string>()
  pointerActive = false
  pointerBoost = false
  pointerX = 0
  pointerY = 0
  private canvas: HTMLCanvasElement
  private bound = false

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
    return (
      this.keys.has(' ') ||
      this.keys.has('Shift') ||
      this.pointerBoost
    )
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault()
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
  }

  private onPointerDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture(e.pointerId)
    this.pointerActive = true
    this.pointerBoost = true
    this.updatePointer(e)
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerActive) return
    this.updatePointer(e)
  }

  private onPointerUp = () => {
    this.pointerActive = false
    this.pointerBoost = false
  }

  private updatePointer(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect()
    const scaleX = this.canvas.width / rect.width
    const scaleY = this.canvas.height / rect.height
    this.pointerX = (e.clientX - rect.left) * scaleX
    this.pointerY = (e.clientY - rect.top) * scaleY
  }
}

import './style.css'
import { Game } from './game/game'

const canvas = document.getElementById('game')
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing #game canvas')
}

const game = new Game(canvas)
game.startLoop()

// Reveal cursor on overlay interactions
const overlays = [document.getElementById('overlay'), document.getElementById('pause')]
for (const el of overlays) {
  el?.addEventListener('mouseenter', () => {
    canvas.style.cursor = 'default'
  })
  el?.addEventListener('mouseleave', () => {
    if (game.mode === 'playing') canvas.style.cursor = 'none'
  })
}

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v))

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

export const rand = (min: number, max: number) => min + Math.random() * (max - min)

export const randInt = (min: number, max: number) =>
  Math.floor(rand(min, max + 1))

export const dist = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx
  const dy = ay - by
  return Math.hypot(dx, dy)
}

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

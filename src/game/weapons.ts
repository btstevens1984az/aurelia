export type WeaponId = 'twin' | 'spread' | 'plasma' | 'rail' | 'nova'

export type WeaponDef = {
  id: WeaponId
  name: string
  blurb: string
  color: string
  fireInterval: number
  damage: number
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  twin: {
    id: 'twin',
    name: 'Twin Cannons',
    blurb: 'Reliable dual stream',
    color: '#f4c15d',
    fireInterval: 0.09,
    damage: 10,
  },
  spread: {
    id: 'spread',
    name: 'Scatter Flare',
    blurb: 'Wide dream shotgun',
    color: '#ff9a5c',
    fireInterval: 0.16,
    damage: 7,
  },
  plasma: {
    id: 'plasma',
    name: 'Plasma Bloom',
    blurb: 'Fat orbs that detonate',
    color: '#5ec8c0',
    fireInterval: 0.28,
    damage: 28,
  },
  rail: {
    id: 'rail',
    name: 'Rail Lance',
    blurb: 'Piercing dusk beam-shot',
    color: '#c4a8ff',
    fireInterval: 0.38,
    damage: 55,
  },
  nova: {
    id: 'nova',
    name: 'Nova Cascade',
    blurb: 'Absurd spiral barrage',
    color: '#ff6b9d',
    fireInterval: 0.12,
    damage: 12,
  },
}

export const WEAPON_ORDER: WeaponId[] = ['twin', 'spread', 'plasma', 'rail', 'nova']

export function nextWeaponAfter(owned: WeaponId[], kills: number): WeaponId | null {
  if (kills <= 0 || kills % 5 !== 0) return null
  const locked = WEAPON_ORDER.filter((id) => !owned.includes(id))
  if (locked.length === 0) {
    // Already own all — rotate a powered refresh of a random advanced gun
    const pool = WEAPON_ORDER.filter((id) => id !== 'twin')
    return pool[Math.floor(Math.random() * pool.length)]
  }
  return locked[0]
}

export function randomWeapon(exclude?: WeaponId): WeaponId {
  const pool = WEAPON_ORDER.filter((id) => id !== exclude)
  return pool[Math.floor(Math.random() * pool.length)]
}

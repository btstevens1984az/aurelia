export type UpgradeId =
  | 'hull'
  | 'fireRate'
  | 'thrust'
  | 'missileBay'
  | 'warhead'
  | 'magnet'

export type UpgradeDef = {
  id: UpgradeId
  name: string
  blurb: string
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  hull: { id: 'hull', name: 'Titanium Skin', blurb: '+max hull & repair' },
  fireRate: { id: 'fireRate', name: 'Overclocked Guns', blurb: 'Faster primary fire' },
  thrust: { id: 'thrust', name: 'Dawn Thrusters', blurb: 'Higher speed & boost' },
  missileBay: { id: 'missileBay', name: 'Deep Magazines', blurb: '+missile capacity' },
  warhead: { id: 'warhead', name: 'Cataclysm Tips', blurb: 'Bigger boom damage' },
  magnet: { id: 'magnet', name: 'Lantern Magnet', blurb: 'Pull pickups closer' },
}

export const UPGRADE_ORDER: UpgradeId[] = [
  'hull',
  'fireRate',
  'thrust',
  'missileBay',
  'warhead',
  'magnet',
]

export type BossId = 'sol' | 'eclipse' | 'leviathan' | 'null'

export type LevelDef = {
  level: number
  name: string
  blurb: string
  killsToBoss: number
  spawnMult: number
  difficultyBias: number
  boss: BossId
  bossName: string
  rewardUpgrade: UpgradeId
}

export const LEVELS: LevelDef[] = [
  {
    level: 1,
    name: 'Ember Gate',
    blurb: 'First blood over the lantern fields',
    killsToBoss: 12,
    spawnMult: 1.15,
    difficultyBias: 0,
    boss: 'sol',
    bossName: 'Sol Sovereign',
    rewardUpgrade: 'hull',
  },
  {
    level: 2,
    name: 'Mirage Run',
    blurb: 'Swarm dancers cut the dusk',
    killsToBoss: 16,
    spawnMult: 1.35,
    difficultyBias: 0.8,
    boss: 'eclipse',
    bossName: 'Twin Eclipse',
    rewardUpgrade: 'fireRate',
  },
  {
    level: 3,
    name: 'Titan Wake',
    blurb: 'Heavy silhouettes blot the sun',
    killsToBoss: 18,
    spawnMult: 1.5,
    difficultyBias: 1.6,
    boss: 'leviathan',
    bossName: 'Obsidian Leviathan',
    rewardUpgrade: 'warhead',
  },
  {
    level: 4,
    name: 'Nightfall',
    blurb: 'Everything burns. Everything answers.',
    killsToBoss: 22,
    spawnMult: 1.75,
    difficultyBias: 2.4,
    boss: 'null',
    bossName: 'Aurelia Null',
    rewardUpgrade: 'thrust',
  },
]

export type PackageKind = 'weapon' | 'missiles' | 'heal' | 'upgrade' | 'overcharge'

export function randomPackageKind(): PackageKind {
  const roll = Math.random()
  if (roll < 0.28) return 'weapon'
  if (roll < 0.5) return 'missiles'
  if (roll < 0.72) return 'heal'
  if (roll < 0.88) return 'upgrade'
  return 'overcharge'
}

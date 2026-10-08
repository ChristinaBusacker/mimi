export const STAGE_WORLDS = ['music', 'community', 'gaming'] as const;

export type StageWorld = (typeof STAGE_WORLDS)[number];

export const STAGE_STEP = (Math.PI * 2) / STAGE_WORLDS.length;

export function wrapStageIndex(index: number): number {
  return ((index % STAGE_WORLDS.length) + STAGE_WORLDS.length) % STAGE_WORLDS.length;
}

export function nearestStageStop(rotation: number, world: StageWorld): number {
  const baseAngle = STAGE_WORLDS.indexOf(world) * STAGE_STEP;
  const turns = Math.round((rotation - baseAngle) / (Math.PI * 2));
  let target = baseAngle + turns * Math.PI * 2;

  if (target - rotation > Math.PI) {
    target -= Math.PI * 2;
  } else if (rotation - target > Math.PI) {
    target += Math.PI * 2;
  }

  return target;
}

export function nearestStageIndex(rotation: number): number {
  return wrapStageIndex(Math.round(rotation / STAGE_STEP));
}

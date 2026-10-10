export interface StageVector {
  x: number;
  y: number;
}

/** Integrates a damped spring in seconds; mutates only its two explicit state objects. */
export function advanceStageParallax(
  position: StageVector,
  velocity: StageVector,
  target: Readonly<StageVector>,
  dt: number,
): boolean {
  const step = Math.max(0, Math.min(dt, 0.04));
  const damping = Math.exp(-16 * step);
  for (const axis of ['x', 'y'] as const) {
    velocity[axis] = (velocity[axis] + (target[axis] - position[axis]) * 70 * step) * damping;
    position[axis] += velocity[axis] * step;
    if (Math.abs(target[axis] - position[axis]) < 0.00005 && Math.abs(velocity[axis]) < 0.0001) {
      position[axis] = target[axis];
      velocity[axis] = 0;
    }
  }
  return position.x !== target.x || position.y !== target.y || velocity.x !== 0 || velocity.y !== 0;
}

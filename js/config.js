// Global tuning values. Keep gameplay numbers here so they're easy to tweak.
export const CONFIG = {
  player: {
    radius: 0.35,
    height: 1.75,
    eyeHeight: 1.6,
    speed: 4.2,
    step: 0.45,
    gravity: 22,
    maxHp: 100,
  },
  look: {
    mouse: 0.0022,      // radians per pixel
    touch: 0.0065,      // radians per CSS pixel (scaled by screen size)
    gamepad: 2.6,       // radians per second at full deflection
    pitchLimit: 1.45,
  },
  clock: {
    phaseLength: 300,   // seconds of dungeon time per day/night flip
  },
  camera: { fov: 70, near: 0.08, far: 220 },
  saveKey: 'dungenkiller.save.v1',
  settingsKey: 'dungenkiller.settings.v1',
};

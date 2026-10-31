// Global tuning values. Keep gameplay numbers here so they're easy to tweak.
export const CONFIG = {
  player: {
    radius: 0.35,
    height: 1.75,
    eyeHeight: 1.6,
    speed: 7.2,         // Doom-style: always running, instant acceleration
    step: 0.45,
    gravity: 24,
    jump: 7.6,          // ~1.2 m jump
    airAccel: 10,       // Quake-style air acceleration (full air control + strafe-jumping)
    maxAirSpeed: 15,
    dashSpeed: 24, dashTime: 0.17, dashRecharge: 1.4, dashIframes: 0.22,
    mantleReach: 1.45,  // ledge height above the feet you can pull yourself onto while airborne
    fallSafe: 6,        // metres of free fall before fall damage
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

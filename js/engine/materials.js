// Material factory. Every lit material is patched so the optional PS1 mode
// can snap vertices to the low-res pixel grid (vertex jitter).
import * as THREE from '../../lib/three.module.min.js';
import { getTexture } from './textures.js';

export const ps1Uniforms = {
  uJitter: { value: 0 },
  uRes: { value: new THREE.Vector2(400, 225) },
};

function ps1Hook(shader) {
  shader.uniforms.uJitter = ps1Uniforms.uJitter;
  shader.uniforms.uRes = ps1Uniforms.uRes;
  shader.vertexShader = 'uniform float uJitter;\nuniform vec2 uRes;\n' +
    shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      if (uJitter > 0.5) {
        vec2 grid = uRes * 0.5;
        vec4 p = gl_Position;
        p.xy = floor(p.xy / p.w * grid + 0.5) / grid * p.w;
        gl_Position = p;
      }`);
}

export function patchPS1(mat) {
  mat.onBeforeCompile = ps1Hook;
  return mat;
}

const matCache = new Map();

/**
 * Lit, textured material. Uses Lambert (cheap, era-appropriate shading).
 * opts: color (tint), vertexColors, emissive, side, transparent
 */
export function litMaterial(texName, opts = {}) {
  const key = texName + JSON.stringify(opts);
  if (matCache.has(key) && !opts.unique) return matCache.get(key);
  const m = new THREE.MeshLambertMaterial({
    map: texName ? getTexture(texName) : null,
    color: opts.color !== undefined ? opts.color : 0xffffff,
    vertexColors: !!opts.vertexColors,
    side: opts.side || THREE.FrontSide,
    emissive: opts.emissive !== undefined ? opts.emissive : 0x000000,
    transparent: !!opts.transparent,
    flatShading: opts.flat !== undefined ? opts.flat : false,
  });
  patchPS1(m);
  if (!opts.unique) matCache.set(key, m);
  return m;
}

/** Unlit additive material for flames, glows and magic. */
export function glowMaterial(texName, color = 0xffffff, opts = {}) {
  const m = new THREE.MeshBasicMaterial({
    map: getTexture(texName),
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: opts.side || THREE.DoubleSide,
    fog: opts.fog !== undefined ? opts.fog : true,
  });
  patchPS1(m);
  return m;
}

export function spriteMaterial(texName, color = 0xffffff, opts = {}) {
  return new THREE.SpriteMaterial({
    map: getTexture(texName),
    color,
    transparent: true,
    blending: opts.normal ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: false,
    fog: opts.fog !== undefined ? opts.fog : true,
  });
}

export function basicMaterial(color, opts = {}) {
  const m = new THREE.MeshBasicMaterial({ color, ...opts });
  patchPS1(m);
  return m;
}

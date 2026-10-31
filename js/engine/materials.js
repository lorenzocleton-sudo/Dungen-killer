// Material factory: cached lit (Lambert) materials, additive glows, sprites.
import * as THREE from '../../lib/three.module.min.js';
import { getTexture } from './textures.js';

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
  return m;
}

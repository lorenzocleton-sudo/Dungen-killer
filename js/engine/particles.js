// CPU particle pool rendered as square GL points (chunky pixels at low res).
import * as THREE from '../../lib/three.module.min.js';

const VS = `
attribute vec4 aColor;
attribute float aSize;
uniform float uScale;
uniform float uFogNear;
uniform float uFogFar;
varying vec4 vColor;
varying float vFog;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, aSize * uScale / max(0.1, -mv.z));
  vColor = aColor;
  vFog = smoothstep(uFogNear, uFogFar, -mv.z);
}`;
const FS = `
uniform vec3 uFogColor;
uniform float uAdditive;
varying vec4 vColor;
varying float vFog;
void main(){
  if (vColor.a < 0.01) discard;
  vec2 pc = gl_PointCoord - 0.5;
  float d = dot(pc, pc) * 4.0;
  if (d > 1.0) discard;
  if (uAdditive > 0.5) gl_FragColor = vec4(vColor.rgb * vColor.a * (1.0 - vFog), 1.0);
  else gl_FragColor = vec4(mix(vColor.rgb, uFogColor, vFog), vColor.a * (1.0 - d * 0.5));
}`;

export class ParticleSystem {
  constructor(scene, max = 500, additive = true) {
    this.max = max;
    this.additive = additive;
    this.p = [];
    for (let i = 0; i < max; i++) this.p.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 1, g: 1, b: 1, a: 1, size: 1, grav: 0, drag: 0 });
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = {
      uScale: { value: 225 }, uFogNear: { value: 5 }, uFogFar: { value: 30 },
      uFogColor: { value: new THREE.Color(0) }, uAdditive: { value: additive ? 1 : 0 },
    };
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, uniforms: this.uniforms,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
  }

  emit(x, y, z, vx, vy, vz, life, color, size = 0.08, grav = 0, drag = 0, alpha = 1) {
    for (let n = 0; n < this.max; n++) {
      const i = (this.cursor + n) % this.max;
      const q = this.p[i];
      if (q.alive) continue;
      this.cursor = (i + 1) % this.max;
      q.alive = true; q.x = x; q.y = y; q.z = z; q.vx = vx; q.vy = vy; q.vz = vz;
      q.life = life; q.max = life; q.r = color[0]; q.g = color[1]; q.b = color[2];
      q.size = size; q.grav = grav; q.drag = drag; q.a = alpha;
      return q;
    }
    return null;
  }

  /** Radial burst helper. */
  burst(x, y, z, count, speed, life, color, size, grav = -6, up = 1) {
    count = Math.max(1, Math.round(count * ParticleSystem.density));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * up;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.emit(x, y, z, Math.cos(a) * s, e * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), color, size, grav, 1.5);
    }
  }

  update(dt, scene, renderHeight) {
    if (scene.fog) {
      this.uniforms.uFogNear.value = scene.fog.near; this.uniforms.uFogFar.value = scene.fog.far;
      this.uniforms.uFogColor.value.copy(scene.fog.color);
    }
    this.uniforms.uScale.value = renderHeight * 1.2;
    for (let i = 0; i < this.max; i++) {
      const q = this.p[i];
      if (q.alive) {
        q.life -= dt;
        if (q.life <= 0) q.alive = false;
        q.vy += q.grav * dt;
        const dr = Math.max(0, 1 - q.drag * dt);
        q.vx *= dr; q.vy *= dr; q.vz *= dr;
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      }
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      const t = q.alive ? q.life / q.max : 0;
      const a = q.alive ? Math.min(1, t * 2.5, (1 - t) * 6) * q.a : 0;
      this.col[i * 4] = q.r; this.col[i * 4 + 1] = q.g; this.col[i * 4 + 2] = q.b; this.col[i * 4 + 3] = a;
      this.size[i] = q.size;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}

/** Graphics preset: fraction of burst particles actually spawned. */
ParticleSystem.density = 1;

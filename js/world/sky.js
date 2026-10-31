// Gradient sky dome + drifting cloud layer + stars + moon, recoloured per
// day/night phase. Follows the camera so it never gets closer.
import * as THREE from '../../lib/three.module.min.js';
import { getTexture } from '../engine/textures.js';
import { spriteMaterial } from '../engine/materials.js';

export class Sky {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const R = 180;
    this.domeGeo = new THREE.SphereGeometry(R, 16, 10);
    this.domeGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.domeGeo.attributes.position.count * 3), 3));
    this.dome = new THREE.Mesh(this.domeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.dome.renderOrder = -10;
    this.group.add(this.dome);

    // stars
    const starPos = [];
    let s = 7;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 350; i++) {
      const a = r() * Math.PI * 2, e = Math.asin(0.08 + r() * 0.92);
      starPos.push(Math.cos(a) * Math.cos(e) * 170, Math.sin(e) * 170, Math.sin(a) * Math.cos(e) * 170);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9aa4b8, size: 1, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true }));
    this.stars.renderOrder = -9;
    this.group.add(this.stars);

    // moon / veiled sun
    this.orb = new THREE.Sprite(spriteMaterial('glow', 0xffffff, { fog: false }));
    this.orb.material.blending = THREE.AdditiveBlending;
    this.orb.position.set(-60, 90, -90);
    this.orb.scale.set(30, 30, 1);
    this.orb.renderOrder = -8;
    this.group.add(this.orb);
    this.moonDisc = new THREE.Mesh(new THREE.CircleGeometry(4.5, 10), new THREE.MeshBasicMaterial({ color: 0xc8ccd0, fog: false, depthWrite: false }));
    this.moonDisc.position.copy(this.orb.position).multiplyScalar(0.99);
    this.moonDisc.lookAt(0, 0, 0);
    this.moonDisc.renderOrder = -8;
    this.group.add(this.moonDisc);

    // cloud layer
    const ct = getTexture('clouds').clone();
    ct.repeat.set(3, 2); ct.needsUpdate = true;
    this.cloudTex = ct;
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(160, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshBasicMaterial({ map: ct, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false, opacity: 0.8 }));
    this.clouds.renderOrder = -7;
    this.group.add(this.clouds);
  }

  /** p: { top, horizon, bottom, clouds, cloudOpacity, stars, orbColor, orbOpacity, moon } */
  setPalette(p) {
    const top = new THREE.Color(p.top), hor = new THREE.Color(p.horizon), bot = new THREE.Color(p.bottom ?? p.horizon);
    const pos = this.domeGeo.attributes.position, col = this.domeGeo.attributes.color;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 180;
      if (y >= 0) c.copy(hor).lerp(top, Math.pow(y, 0.6)); else c.copy(hor).lerp(bot, Math.min(1, -y * 4));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    this.clouds.material.color.set(p.clouds);
    this.clouds.material.opacity = p.cloudOpacity;
    this.stars.visible = !!p.stars;
    this.orb.material.color.set(p.orbColor);
    this.orb.material.opacity = p.orbOpacity;
    this.moonDisc.visible = !!p.moon;
  }

  update(dt, camera) {
    this.group.position.copy(camera.position);
    this.cloudTex.offset.x += dt * 0.004;
  }
}

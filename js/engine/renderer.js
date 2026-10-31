// Low-resolution renderer. The scene is drawn into a ~400x225 render target,
// then a post pass (vignette, grading, optional PS1 dither) draws it to a
// canvas of the same size, which CSS upscales with pixelated sampling.
import * as THREE from '../../lib/three.module.min.js';
import { ps1Uniforms } from './materials.js';

export const RENDER_HEIGHT = 225;

const POST_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FS = `
precision highp float;
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uDither;
uniform float uFlash;      // red damage flash 0..1
uniform float uFade;       // black fade 0..1
uniform float uDesat;      // extra desaturation (death)
varying vec2 vUv;
float bayer(vec2 p){
  int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0));
  int i = x + y * 4;
  float m[16];
  m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
  m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
  for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.0;
  return 0.0;
}
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec3 c = texture2D(tScene, vUv).rgb;
  c = toSRGB(max(c, 0.0));
  // grade: crush blacks slightly, mute saturation
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 0.82 - uDesat * 0.8);
  c = pow(c, vec3(1.06));
  // vignette
  vec2 d = vUv - 0.5;
  c *= 1.0 - dot(d, d) * 0.9;
  c = mix(c, vec3(0.45, 0.02, 0.0), uFlash * 0.45);
  if (uDither > 0.5) {
    float b = bayer(gl_FragCoord.xy) - 0.5;
    c = floor(c * 31.0 + 0.5 + b) / 31.0; // 15-bit colour with ordered dither
  }
  c *= 1.0 - uFade;
  gl_FragColor = vec4(c, 1.0);
}`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    this.gl.setPixelRatio(1);
    this.gl.autoClear = false;
    this.target = new THREE.WebGLRenderTarget(400, 225, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true,
    });
    this.target.texture.colorSpace = THREE.SRGBColorSpace; // 8-bit sRGB storage: no banding in shadows

    this.postUniforms = {
      tScene: { value: this.target.texture },
      uRes: { value: new THREE.Vector2(400, 225) },
      uDither: { value: 0 },
      uFlash: { value: 0 },
      uFade: { value: 0 },
      uDesat: { value: 0 },
    };
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: POST_VS, fragmentShader: POST_FS, uniforms: this.postUniforms, depthTest: false, depthWrite: false }));
    quad.frustumCulled = false;
    this.postScene.add(quad);

    this.width = 400; this.height = RENDER_HEIGHT;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setPS1(on) {
    ps1Uniforms.uJitter.value = on ? 1 : 0;
    this.postUniforms.uDither.value = on ? 1 : 0;
  }

  resize() {
    const aspect = Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight);
    this.height = RENDER_HEIGHT;
    this.width = Math.max(160, Math.min(560, Math.round(RENDER_HEIGHT * aspect)));
    this.aspect = this.width / this.height;
    this.gl.setSize(this.width, this.height, false);
    this.target.setSize(this.width, this.height);
    this.postUniforms.uRes.value.set(this.width, this.height);
    ps1Uniforms.uRes.value.set(this.width, this.height);
    if (this.onResize) this.onResize(this.aspect);
  }

  /** Render world scene, then the overlay (view-model) scene on top. */
  render(scene, camera, overlayScene) {
    const gl = this.gl;
    gl.setRenderTarget(this.target);
    gl.setClearColor(scene.background && scene.background.isColor ? scene.background : 0x000000, 1);
    gl.clear(true, true, true);
    gl.render(scene, camera);
    if (overlayScene) { gl.clearDepth(); gl.render(overlayScene, camera); }
    gl.setRenderTarget(null);
    gl.clear(true, true, true);
    gl.render(this.postScene, this.postCam);
  }
}

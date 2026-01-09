// Body Renderer - Silhouette with internal energy
import * as THREE from 'three';
import { CONFIG, COLORS, ChargeState, hexToRgb } from '../config.js';

export class BodyRenderer {
  constructor(sceneSetup) {
    this.scene = sceneSetup;
    this.maskTexture = null;
    this.bodyMesh = null;
    this.glowMesh = null;
    this.maskCanvas = null;
    this.maskCtx = null;
    this.currentElement = 'fire';
    this.chargeLevel = ChargeState.NONE;
  }

  initialize(width, height) {
    this.createMaskCanvas(width, height);
    this.createBodyMesh();
    this.createGlowMesh();
  }

  createMaskCanvas(width, height) {
    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = width;
    this.maskCanvas.height = height;
    this.maskCtx = this.maskCanvas.getContext('2d');

    // Create Three.js texture from canvas
    this.maskTexture = new THREE.CanvasTexture(this.maskCanvas);
    this.maskTexture.minFilter = THREE.LinearFilter;
    this.maskTexture.magFilter = THREE.LinearFilter;
  }

  createBodyMesh() {
    // Full-screen plane for body silhouette
    const geometry = new THREE.PlaneGeometry(
      this.scene.getWidth(),
      this.scene.getHeight()
    );

    // Custom shader for silhouette with energy inside
    const material = new THREE.ShaderMaterial({
      uniforms: {
        maskTexture: { value: this.maskTexture },
        silhouetteColor: { value: new THREE.Color(COLORS.silhouette) },
        elementColor: { value: new THREE.Color(COLORS.fire.primary) },
        glowColor: { value: new THREE.Color(COLORS.fire.glow) },
        opacity: { value: CONFIG.SILHOUETTE_OPACITY },
        chargeLevel: { value: 0.0 },
        time: { value: 0.0 },
        energyDirection: { value: new THREE.Vector2(0, 1) } // Up for fire
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D maskTexture;
        uniform vec3 silhouetteColor;
        uniform vec3 elementColor;
        uniform vec3 glowColor;
        uniform float opacity;
        uniform float chargeLevel;
        uniform float time;
        uniform vec2 energyDirection;

        varying vec2 vUv;

        // Improved noise functions for dramatic effects
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        // Caustic light pattern for water
        float caustic(vec2 uv, float t) {
          vec2 p = uv * 8.0;
          float c = 0.0;
          for (float i = 1.0; i < 4.0; i++) {
            float scale = pow(2.0, i);
            vec2 offset = vec2(
              sin(t * 0.5 + i) * 0.5,
              cos(t * 0.3 + i * 1.3) * 0.5
            );
            c += sin(p.x * scale + t + offset.x) * sin(p.y * scale + t * 0.7 + offset.y) / scale;
          }
          return 0.5 + 0.5 * c;
        }

        // Flowing energy pattern
        float flowingEnergy(vec2 uv, vec2 dir, float t) {
          vec2 flowUv = uv + dir * t * 0.8;
          float energy = noise(flowUv * 12.0 + t);
          energy *= noise(flowUv * 20.0 - t * 0.7);
          energy += noise(flowUv * 6.0 + t * 1.5) * 0.5;
          return energy;
        }

        void main() {
          float mask = texture2D(maskTexture, vUv).r;

          if (mask < 0.1) {
            discard;
          }

          // Base silhouette - slightly transparent
          vec3 color = silhouetteColor;
          float alpha = opacity * mask;

          // DRAMATIC energy effect inside body
          // Always show some energy even at low charge
          float baseEnergy = 0.15;
          float energyIntensity = baseEnergy + chargeLevel * 0.7;

          // Animated flowing energy based on element direction
          float energy = flowingEnergy(vUv, energyDirection, time);
          energy *= energyIntensity;

          // Caustic light effect (dramatic for water, subtle for others)
          float causticEffect = caustic(vUv, time);
          // Boost caustic for water (when direction is down)
          float isWater = step(-0.5, -energyDirection.y);
          causticEffect = mix(causticEffect * 0.3, causticEffect * 0.8, isWater);
          energy = mix(energy, energy * causticEffect, 0.5);

          // Pulsing energy waves
          float pulse = sin(time * 3.0 + vUv.y * 10.0) * 0.5 + 0.5;
          energy += pulse * energyIntensity * 0.2;

          // Strong edge glow effect
          float edgeOuter = smoothstep(0.2, 0.5, mask);
          float edgeInner = smoothstep(0.5, 0.8, mask);
          float edge = edgeOuter - edgeInner;
          edge = max(edge, 0.0) * (0.3 + chargeLevel * 0.7);

          // Inner core glow
          float core = smoothstep(0.6, 0.9, mask) * energyIntensity * 0.5;

          // Mix in element color - MORE visible
          color = mix(color, elementColor, energy * 0.5);
          color = mix(color, glowColor, edge * 0.7);
          color += elementColor * core;

          // Add vibrant internal glow
          color += elementColor * energy * 0.4;
          color += glowColor * edge * 0.3;

          // Boost brightness at high charge
          if (chargeLevel > 0.5) {
            float boost = (chargeLevel - 0.5) * 0.4;
            color += glowColor * boost * pulse;
          }

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false
    });

    this.bodyMesh = new THREE.Mesh(geometry, material);
    this.bodyMesh.position.set(
      this.scene.getWidth() / 2,
      this.scene.getHeight() / 2,
      0
    );

    this.scene.add(this.bodyMesh);
  }

  createGlowMesh() {
    // Outer glow layer
    const geometry = new THREE.PlaneGeometry(
      this.scene.getWidth(),
      this.scene.getHeight()
    );

    const material = new THREE.ShaderMaterial({
      uniforms: {
        maskTexture: { value: this.maskTexture },
        glowColor: { value: new THREE.Color(COLORS.fire.glow) },
        glowIntensity: { value: 0.0 },
        time: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D maskTexture;
        uniform vec3 glowColor;
        uniform float glowIntensity;
        uniform float time;

        varying vec2 vUv;

        void main() {
          float mask = texture2D(maskTexture, vUv).r;

          // Create glow from mask edges
          float glow = 0.0;

          // Sample nearby pixels for blur/glow effect
          float blurSize = 0.01;
          for (float x = -2.0; x <= 2.0; x += 1.0) {
            for (float y = -2.0; y <= 2.0; y += 1.0) {
              vec2 offset = vec2(x, y) * blurSize;
              glow += texture2D(maskTexture, vUv + offset).r;
            }
          }
          glow /= 25.0;

          // Subtract inner mask to get edge
          float edge = glow - mask;
          edge = max(edge, 0.0) * 2.0;

          // Animate glow
          float pulse = sin(time * 3.0) * 0.2 + 0.8;

          float alpha = edge * glowIntensity * pulse;

          if (alpha < 0.01) {
            discard;
          }

          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.glowMesh = new THREE.Mesh(geometry, material);
    this.glowMesh.position.set(
      this.scene.getWidth() / 2,
      this.scene.getHeight() / 2,
      -1 // Behind body
    );

    this.scene.add(this.glowMesh);
  }

  updateMask(maskData, width, height) {
    if (!maskData || !this.maskCtx) return;

    // Clear canvas
    this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);

    // Draw mask to canvas
    const imageData = this.maskCtx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < maskData.length; i++) {
      const value = Math.floor(maskData[i] * 255);
      const pixelIndex = i * 4;
      data[pixelIndex] = value;     // R
      data[pixelIndex + 1] = value; // G
      data[pixelIndex + 2] = value; // B
      data[pixelIndex + 3] = 255;   // A
    }

    // Scale to canvas if needed
    if (width !== this.maskCanvas.width || height !== this.maskCanvas.height) {
      // Create temporary canvas at mask resolution
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(imageData, 0, 0);

      // Draw scaled to mask canvas
      this.maskCtx.drawImage(
        tempCanvas,
        0, 0, width, height,
        0, 0, this.maskCanvas.width, this.maskCanvas.height
      );
    } else {
      this.maskCtx.putImageData(imageData, 0, 0);
    }

    // Update texture
    this.maskTexture.needsUpdate = true;
  }

  setElement(elementType) {
    this.currentElement = elementType;
    const colors = COLORS[elementType];

    if (this.bodyMesh?.material?.uniforms) {
      this.bodyMesh.material.uniforms.elementColor.value.set(colors.primary);
      this.bodyMesh.material.uniforms.glowColor.value.set(colors.glow);

      // Set energy direction based on element
      const directions = {
        fire: new THREE.Vector2(0, 1),    // Up
        water: new THREE.Vector2(0, -1),  // Down
        earth: new THREE.Vector2(0, 0),   // Center (handled differently)
        air: new THREE.Vector2(1, 0)      // Swirl (animated in shader)
      };
      this.bodyMesh.material.uniforms.energyDirection.value.copy(directions[elementType]);
    }

    if (this.glowMesh?.material?.uniforms) {
      this.glowMesh.material.uniforms.glowColor.value.set(colors.glow);
    }
  }

  setChargeLevel(level) {
    this.chargeLevel = level;

    // Normalize charge level to 0-1
    const normalizedCharge = level / ChargeState.AVATAR;

    if (this.bodyMesh?.material?.uniforms) {
      this.bodyMesh.material.uniforms.chargeLevel.value = normalizedCharge;
    }

    if (this.glowMesh?.material?.uniforms) {
      this.glowMesh.material.uniforms.glowIntensity.value = normalizedCharge * CONFIG.GLOW_INTENSITY;
    }
  }

  update(time) {
    if (this.bodyMesh?.material?.uniforms) {
      this.bodyMesh.material.uniforms.time.value = time;
    }

    if (this.glowMesh?.material?.uniforms) {
      this.glowMesh.material.uniforms.time.value = time;
    }
  }

  onResize(width, height) {
    // Resize mask canvas
    this.maskCanvas.width = width;
    this.maskCanvas.height = height;

    // Update mesh geometry
    if (this.bodyMesh) {
      this.bodyMesh.geometry.dispose();
      this.bodyMesh.geometry = new THREE.PlaneGeometry(width, height);
      this.bodyMesh.position.set(width / 2, height / 2, 0);
    }

    if (this.glowMesh) {
      this.glowMesh.geometry.dispose();
      this.glowMesh.geometry = new THREE.PlaneGeometry(width, height);
      this.glowMesh.position.set(width / 2, height / 2, -1);
    }
  }

  dispose() {
    if (this.bodyMesh) {
      this.bodyMesh.geometry.dispose();
      this.bodyMesh.material.dispose();
      this.scene.remove(this.bodyMesh);
    }

    if (this.glowMesh) {
      this.glowMesh.geometry.dispose();
      this.glowMesh.material.dispose();
      this.scene.remove(this.glowMesh);
    }

    if (this.maskTexture) {
      this.maskTexture.dispose();
    }
  }
}

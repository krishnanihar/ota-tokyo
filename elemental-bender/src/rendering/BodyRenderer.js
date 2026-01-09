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

        // Simple noise function for energy effect
        float noise(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
          float mask = texture2D(maskTexture, vUv).r;

          if (mask < 0.1) {
            discard;
          }

          // Base silhouette
          vec3 color = silhouetteColor;
          float alpha = opacity * mask;

          // Energy effect inside body (stronger at higher charge)
          if (chargeLevel > 0.0) {
            // Animated energy based on direction
            vec2 energyUv = vUv + energyDirection * time * 0.5;
            float energy = noise(energyUv * 10.0 + time);
            energy *= noise(energyUv * 20.0 - time * 0.7);

            // Modulate by charge level
            energy *= chargeLevel * 0.5;

            // Edge glow effect
            float edge = smoothstep(0.3, 0.5, mask) - smoothstep(0.5, 0.7, mask);
            edge = max(edge, 0.0) * chargeLevel;

            // Mix in element color
            color = mix(color, elementColor, energy * 0.3);
            color = mix(color, glowColor, edge * 0.5);

            // Add subtle internal glow
            color += elementColor * energy * 0.2 * chargeLevel;
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

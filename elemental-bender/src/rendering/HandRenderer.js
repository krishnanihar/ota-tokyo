// Hand Renderer - Element forms at palm positions
import * as THREE from 'three';
import { COLORS, ChargeState, ELEMENT_BEHAVIORS } from '../config.js';

export class HandRenderer {
  constructor(sceneSetup) {
    this.scene = sceneSetup;
    this.leftHandMesh = null;
    this.rightHandMesh = null;
    this.glowMeshes = [];

    this.currentElement = 'fire';
    this.chargeLevel = ChargeState.NONE;
    this.time = 0;
  }

  initialize() {
    // Create hand glow meshes
    this.leftHandMesh = this.createHandMesh();
    this.rightHandMesh = this.createHandMesh();

    this.scene.add(this.leftHandMesh);
    this.scene.add(this.rightHandMesh);

    // Create outer glow layers
    for (let i = 0; i < 2; i++) {
      const glow = this.createGlowMesh();
      this.glowMeshes.push(glow);
      this.scene.add(glow);
    }

    this.setElement(this.currentElement);
  }

  createHandMesh() {
    // Circular gradient mesh for hand element form
    const geometry = new THREE.CircleGeometry(60, 32);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        primaryColor: { value: new THREE.Color(COLORS.fire.primary) },
        secondaryColor: { value: new THREE.Color(COLORS.fire.secondary) },
        glowColor: { value: new THREE.Color(COLORS.fire.glow) },
        intensity: { value: 0.0 },
        time: { value: 0.0 },
        elementType: { value: 0 } // 0=fire, 1=water, 2=earth, 3=air
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 primaryColor;
        uniform vec3 secondaryColor;
        uniform vec3 glowColor;
        uniform float intensity;
        uniform float time;
        uniform float elementType;

        varying vec2 vUv;

        // Noise function
        float noise(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        float fbm(vec2 st) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < 4; i++) {
            value += amplitude * noise(st);
            st *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }

        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center) * 2.0;

          if (dist > 1.0 || intensity < 0.01) {
            discard;
          }

          float angle = atan(center.y, center.x);

          // Element-specific patterns
          float pattern = 0.0;

          if (elementType < 0.5) {
            // Fire: flickering flames
            float flame = fbm(vec2(angle * 3.0, dist * 5.0 - time * 3.0));
            flame += fbm(vec2(angle * 5.0 + time, dist * 3.0)) * 0.5;
            pattern = flame;
          } else if (elementType < 1.5) {
            // Water: swirling waves
            float wave = sin(angle * 6.0 + dist * 10.0 - time * 2.0) * 0.5 + 0.5;
            wave *= sin(dist * 8.0 - time * 1.5) * 0.5 + 0.5;
            pattern = wave;
          } else if (elementType < 2.5) {
            // Earth: crystalline facets
            float facets = abs(sin(angle * 8.0)) * abs(cos(angle * 6.0));
            facets *= 1.0 - dist;
            pattern = facets + noise(center * 20.0 + time * 0.1) * 0.3;
          } else {
            // Air: spiral vortex
            float spiral = sin(angle * 4.0 + dist * 15.0 - time * 4.0);
            spiral = spiral * 0.5 + 0.5;
            spiral *= 1.0 - dist;
            pattern = spiral;
          }

          // Core glow
          float core = 1.0 - smoothstep(0.0, 0.5, dist);

          // Edge glow
          float edge = smoothstep(0.7, 0.9, dist) * (1.0 - smoothstep(0.9, 1.0, dist));

          // Mix colors
          vec3 color = mix(primaryColor, secondaryColor, pattern);
          color = mix(color, glowColor, core * 0.5);

          // Alpha: stronger in center, with pattern
          float alpha = (1.0 - dist) * intensity;
          alpha *= (0.5 + pattern * 0.5);
          alpha = max(alpha, edge * intensity * 0.5);

          // Pulsing effect
          float pulse = sin(time * 3.0) * 0.1 + 0.9;
          alpha *= pulse;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = 15; // In front of body
    mesh.visible = false;

    return mesh;
  }

  createGlowMesh() {
    // Larger outer glow
    const geometry = new THREE.CircleGeometry(100, 32);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(COLORS.fire.glow) },
        intensity: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float intensity;
        varying vec2 vUv;

        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center) * 2.0;

          if (dist > 1.0 || intensity < 0.01) {
            discard;
          }

          // Soft glow falloff
          float alpha = (1.0 - dist * dist) * intensity * 0.3;

          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = 14;
    mesh.visible = false;

    return mesh;
  }

  setElement(elementType) {
    this.currentElement = elementType;
    const colors = COLORS[elementType];

    const elementTypeIndex = {
      fire: 0,
      water: 1,
      earth: 2,
      air: 3
    }[elementType];

    // Update hand mesh materials
    [this.leftHandMesh, this.rightHandMesh].forEach(mesh => {
      if (mesh?.material?.uniforms) {
        mesh.material.uniforms.primaryColor.value.set(colors.primary);
        mesh.material.uniforms.secondaryColor.value.set(colors.secondary);
        mesh.material.uniforms.glowColor.value.set(colors.glow);
        mesh.material.uniforms.elementType.value = elementTypeIndex;
      }
    });

    // Update glow meshes
    this.glowMeshes.forEach(mesh => {
      if (mesh?.material?.uniforms) {
        mesh.material.uniforms.glowColor.value.set(colors.glow);
      }
    });
  }

  setChargeLevel(level) {
    this.chargeLevel = level;

    const intensity = level / ChargeState.AVATAR;

    [this.leftHandMesh, this.rightHandMesh].forEach(mesh => {
      if (mesh?.material?.uniforms) {
        mesh.material.uniforms.intensity.value = intensity;
      }
    });

    this.glowMeshes.forEach(mesh => {
      if (mesh?.material?.uniforms) {
        mesh.material.uniforms.intensity.value = intensity;
      }
    });
  }

  update(time, hands, mirrorMode = true) {
    this.time = time;

    // Update time uniform
    [this.leftHandMesh, this.rightHandMesh].forEach(mesh => {
      if (mesh?.material?.uniforms) {
        mesh.material.uniforms.time.value = time;
      }
    });

    // Position hands
    this.updateHandPosition(this.leftHandMesh, this.glowMeshes[0], hands?.left, mirrorMode);
    this.updateHandPosition(this.rightHandMesh, this.glowMeshes[1], hands?.right, mirrorMode);
  }

  updateHandPosition(handMesh, glowMesh, handData, mirrorMode) {
    // Lower visibility threshold, show hands even at no charge (just dimmer)
    if (!handData?.palm || handData.palm.visibility < 0.3) {
      handMesh.visible = false;
      glowMesh.visible = false;
      return;
    }

    // Convert normalized coordinates to screen
    let screenX = handData.palm.x * this.scene.getWidth();
    const screenY = (1 - handData.palm.y) * this.scene.getHeight();

    if (mirrorMode) {
      screenX = this.scene.getWidth() - screenX;
    }

    // Position meshes
    handMesh.position.set(screenX, screenY, 15);
    handMesh.visible = true;

    glowMesh.position.set(screenX, screenY, 14);
    glowMesh.visible = true;

    // Scale based on charge level - always show some glow, bigger with charge
    // Base intensity even at no charge (0.3) up to full at avatar
    const baseIntensity = 0.3;
    const chargeBonus = (this.chargeLevel / ChargeState.AVATAR) * 0.7;
    const intensity = baseIntensity + chargeBonus;

    // Update intensity uniforms
    if (handMesh.material?.uniforms) {
      handMesh.material.uniforms.intensity.value = intensity;
    }
    if (glowMesh.material?.uniforms) {
      glowMesh.material.uniforms.intensity.value = intensity * 0.5;
    }

    // Scale based on charge level - always visible, grows with charge
    const baseScale = 0.6 + (this.chargeLevel / ChargeState.AVATAR) * 0.8;
    handMesh.scale.setScalar(baseScale);
    glowMesh.scale.setScalar(baseScale * 1.8);
  }

  dispose() {
    [this.leftHandMesh, this.rightHandMesh, ...this.glowMeshes].forEach(mesh => {
      if (mesh) {
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.scene.remove(mesh);
      }
    });
  }
}

// Hand Orb Renderer - Dramatic element-specific orbs at each hand
// One cohesive effect per hand: giant flame, water ball, floating rocks, air vortex
import * as THREE from 'three';
import { COLORS, ChargeState } from '../config.js';

export class HandOrbRenderer {
  constructor(sceneSetup) {
    this.scene = sceneSetup;

    // Orb containers for each element (left and right hand each)
    this.fireOrbs = { left: null, right: null };
    this.waterOrbs = { left: null, right: null };
    this.earthOrbs = { left: null, right: null };
    this.airOrbs = { left: null, right: null };

    this.currentElement = 'fire';
    this.chargeLevel = 0;
    this.time = 0;
  }

  initialize() {
    // Create orbs for each element (two per element - left and right hand)
    this.fireOrbs.left = this.createFireOrb();
    this.fireOrbs.right = this.createFireOrb();

    this.waterOrbs.left = this.createWaterOrb();
    this.waterOrbs.right = this.createWaterOrb();

    this.earthOrbs.left = this.createEarthOrb();
    this.earthOrbs.right = this.createEarthOrb();

    this.airOrbs.left = this.createAirOrb();
    this.airOrbs.right = this.createAirOrb();

    // Add all to scene
    [this.fireOrbs, this.waterOrbs, this.earthOrbs, this.airOrbs].forEach(orbSet => {
      this.scene.add(orbSet.left);
      this.scene.add(orbSet.right);
    });

    // Set initial element
    this.setElement(this.currentElement);
  }

  // ===========================================
  // FIRE ORB - Volumetric ray-marched flame
  // ===========================================
  createFireOrb() {
    const geometry = new THREE.SphereGeometry(1, 32, 32);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0 },
        primaryColor: { value: new THREE.Color(COLORS.fire.primary) },
        secondaryColor: { value: new THREE.Color(COLORS.fire.secondary) },
        glowColor: { value: new THREE.Color(COLORS.fire.glow) }
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;

        void main() {
          vPosition = position;
          vNormal = normal;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float intensity;
        uniform vec3 primaryColor;
        uniform vec3 secondaryColor;
        uniform vec3 glowColor;

        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;

        // Improved noise functions for volumetric fire
        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);

          return mix(
            mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        float fbm(vec3 p) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;

          for (int i = 0; i < 5; i++) {
            value += amplitude * noise(p * frequency);
            amplitude *= 0.5;
            frequency *= 2.0;
          }
          return value;
        }

        void main() {
          if (intensity < 0.01) discard;

          // Spherical coordinates for fire flow
          float dist = length(vPosition);
          vec3 dir = normalize(vPosition);

          // Upward fire flow with turbulence
          vec3 flowPos = vPosition;
          flowPos.y -= time * 2.0; // Fire flows upward
          flowPos.x += sin(time * 3.0 + vPosition.y * 5.0) * 0.2;

          // Multi-octave fire turbulence
          float fire = fbm(flowPos * 3.0);
          fire += fbm(flowPos * 6.0 - vec3(0, time * 3.0, 0)) * 0.5;
          fire += fbm(flowPos * 12.0 + vec3(time, 0, time)) * 0.25;

          // Flame shape - stronger at bottom, fading at top
          float flameShape = 1.0 - smoothstep(0.0, 1.0, vPosition.y * 0.5 + 0.5);
          flameShape *= 1.0 - dist * 0.5;

          // Edge flames flicker
          float edgeFire = smoothstep(0.6, 1.0, dist) * fire * 2.0;

          // Combine fire layers
          float finalFire = fire * flameShape + edgeFire;
          finalFire = clamp(finalFire, 0.0, 1.0);

          // Color gradient: core (yellow-white) to edge (red-orange)
          vec3 coreColor = vec3(1.0, 0.9, 0.6);
          vec3 color = mix(coreColor, primaryColor, dist * 0.8);
          color = mix(color, secondaryColor, fire * 0.5);

          // Intensity and alpha
          float alpha = finalFire * intensity * (1.0 - dist * 0.3);
          alpha *= 1.0 + sin(time * 8.0 + vPosition.x * 10.0) * 0.15; // Flicker

          // Add hot core glow
          float coreGlow = (1.0 - smoothstep(0.0, 0.4, dist)) * intensity;
          color += glowColor * coreGlow * 0.5;
          alpha += coreGlow * 0.3;

          gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.scale.setScalar(80);
    return mesh;
  }

  // ===========================================
  // WATER ORB - Flowing water ball with caustics
  // ===========================================
  createWaterOrb() {
    const geometry = new THREE.IcosahedronGeometry(1, 4);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0 },
        primaryColor: { value: new THREE.Color(COLORS.water.primary) },
        secondaryColor: { value: new THREE.Color(COLORS.water.secondary) },
        foamColor: { value: new THREE.Color(COLORS.water.accent) }
      },
      vertexShader: `
        uniform float time;
        uniform float intensity;

        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vDisplacement;

        // Simplex noise for wave displacement
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = inversesqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        void main() {
          vUv = uv;
          vNormal = normal;

          // Wave displacement on surface
          vec3 pos = position;
          float wave1 = snoise(pos * 3.0 + time * 1.5) * 0.15;
          float wave2 = snoise(pos * 5.0 - time * 2.0) * 0.08;
          float wave3 = snoise(pos * 8.0 + time * 0.8) * 0.04;

          vDisplacement = wave1 + wave2 + wave3;
          pos += normal * vDisplacement * intensity;

          vPosition = pos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float intensity;
        uniform vec3 primaryColor;
        uniform vec3 secondaryColor;
        uniform vec3 foamColor;

        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying float vDisplacement;

        // Caustic pattern
        float caustic(vec2 uv, float t) {
          vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
          float c = 0.0;
          for (int i = 0; i < 3; i++) {
            p = abs(p) / dot(p, p) - 0.7;
            p *= 1.5;
            c += abs(p.x + p.y) * (1.0 / (float(i + 1) * 5.0));
          }
          return c;
        }

        void main() {
          if (intensity < 0.01) discard;

          float dist = length(vPosition);
          vec3 dir = normalize(vPosition);

          // Fresnel for edge glow
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);

          // Swirling internal motion
          float swirl = sin(atan(vPosition.z, vPosition.x) * 4.0 + time * 2.0 + vPosition.y * 3.0);
          swirl = swirl * 0.5 + 0.5;

          // Caustic light patterns inside
          float caustics = caustic(vPosition.xy + time * 0.3, time);
          caustics += caustic(vPosition.yz - time * 0.2, time) * 0.5;
          caustics = clamp(caustics * 0.3, 0.0, 1.0);

          // Foam at peaks
          float foam = smoothstep(0.1, 0.2, vDisplacement);

          // Color mixing
          vec3 color = mix(primaryColor, secondaryColor, swirl * 0.5 + caustics * 0.3);
          color = mix(color, foamColor, foam * 0.6);
          color += caustics * 0.2;

          // Alpha with fresnel edge
          float alpha = (0.6 + fresnel * 0.4) * intensity;
          alpha *= 0.8 + swirl * 0.2;

          // Inner glow
          float innerGlow = (1.0 - dist * 0.5) * 0.3;
          color += secondaryColor * innerGlow;

          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.95));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.scale.setScalar(70);
    return mesh;
  }

  // ===========================================
  // EARTH ORB - Floating rocks orbiting hand
  // ===========================================
  createEarthOrb() {
    const group = new THREE.Group();

    // Create several rock chunks with procedural geometry
    const rockCount = 5;

    for (let i = 0; i < rockCount; i++) {
      const geometry = new THREE.IcosahedronGeometry(1, 1);

      // Distort vertices to make rocky
      const positions = geometry.attributes.position.array;
      for (let j = 0; j < positions.length; j += 3) {
        const noise = (Math.random() - 0.5) * 0.4;
        positions[j] += noise;
        positions[j + 1] += noise;
        positions[j + 2] += noise;
      }
      geometry.computeVertexNormals();

      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          intensity: { value: 0 },
          rockIndex: { value: i },
          primaryColor: { value: new THREE.Color(COLORS.earth.primary) },
          secondaryColor: { value: new THREE.Color(COLORS.earth.secondary) },
          accentColor: { value: new THREE.Color(COLORS.earth.accent) }
        },
        vertexShader: `
          varying vec3 vPosition;
          varying vec3 vNormal;
          varying vec3 vWorldPosition;

          void main() {
            vPosition = position;
            vNormal = normalMatrix * normal;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float time;
          uniform float intensity;
          uniform float rockIndex;
          uniform vec3 primaryColor;
          uniform vec3 secondaryColor;
          uniform vec3 accentColor;

          varying vec3 vPosition;
          varying vec3 vNormal;
          varying vec3 vWorldPosition;

          float noise(vec3 p) {
            return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          }

          void main() {
            if (intensity < 0.01) discard;

            // Rocky texture
            float rock = noise(vPosition * 10.0 + rockIndex);
            rock += noise(vPosition * 20.0) * 0.5;
            rock += noise(vPosition * 40.0) * 0.25;
            rock = rock / 1.75;

            // Faceted lighting
            vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
            float diffuse = max(dot(vNormal, lightDir), 0.0);
            diffuse = diffuse * 0.6 + 0.4;

            // Color variation
            vec3 color = mix(primaryColor, secondaryColor, rock);

            // Moss/mineral streaks
            float streak = sin(vPosition.y * 15.0 + rockIndex * 2.0) * 0.5 + 0.5;
            streak *= noise(vPosition * 8.0);
            color = mix(color, accentColor, streak * 0.3);

            // Apply lighting
            color *= diffuse;

            // Energy glow at higher intensity
            float glow = smoothstep(0.5, 1.0, intensity) * 0.3;
            color += primaryColor * glow * (0.5 + sin(time * 2.0 + rockIndex) * 0.5);

            gl_FragColor = vec4(color, intensity);
          }
        `,
        transparent: true,
        depthWrite: true,
        side: THREE.DoubleSide
      });

      const rock = new THREE.Mesh(geometry, material);

      // Position rocks in orbit
      const angle = (i / rockCount) * Math.PI * 2;
      const radius = 0.6 + Math.random() * 0.3;
      rock.position.set(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * 0.4,
        Math.sin(angle) * radius
      );

      // Random rotation
      rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      // Varied sizes
      const scale = 0.15 + Math.random() * 0.2;
      rock.scale.setScalar(scale);

      // Store orbit data
      rock.userData = {
        orbitAngle: angle,
        orbitRadius: radius,
        orbitSpeed: 0.5 + Math.random() * 0.5,
        bobPhase: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 2
      };

      group.add(rock);
    }

    group.visible = false;
    group.scale.setScalar(100);
    return group;
  }

  // ===========================================
  // AIR ORB - Swirling vortex
  // ===========================================
  createAirOrb() {
    const geometry = new THREE.SphereGeometry(1, 48, 48);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: 0 },
        primaryColor: { value: new THREE.Color(COLORS.air.primary) },
        secondaryColor: { value: new THREE.Color(COLORS.air.secondary) },
        accentColor: { value: new THREE.Color(COLORS.air.accent) }
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;

        void main() {
          vPosition = position;
          vNormal = normal;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float intensity;
        uniform vec3 primaryColor;
        uniform vec3 secondaryColor;
        uniform vec3 accentColor;

        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;

        #define PI 3.14159265359

        float noise(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          if (intensity < 0.01) discard;

          float dist = length(vPosition);
          vec3 dir = normalize(vPosition);

          // Spherical coordinates
          float theta = atan(vPosition.z, vPosition.x);
          float phi = acos(vPosition.y / max(dist, 0.001));

          // Multiple spiral layers rotating at different speeds
          float spiral1 = sin(theta * 8.0 + phi * 4.0 - time * 6.0);
          float spiral2 = sin(theta * 12.0 - phi * 6.0 + time * 4.0);
          float spiral3 = sin(theta * 4.0 + phi * 8.0 - time * 8.0);

          // Combine spirals
          float spirals = spiral1 * 0.4 + spiral2 * 0.35 + spiral3 * 0.25;
          spirals = spirals * 0.5 + 0.5;

          // Wispy turbulence
          float wisp = noise(vec2(theta * 5.0 + time, phi * 5.0));
          wisp += noise(vec2(theta * 10.0 - time * 2.0, phi * 8.0)) * 0.5;
          wisp = wisp / 1.5;

          // Edge vortex intensity
          float edgeVortex = smoothstep(0.5, 1.0, dist) * spirals;

          // Central calm eye
          float eye = 1.0 - smoothstep(0.0, 0.3, dist);

          // Color
          vec3 color = mix(secondaryColor, primaryColor, spirals);
          color = mix(color, accentColor, wisp * 0.3);

          // Fresnel edge
          float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 1.5);

          // Alpha - ethereal, mostly transparent
          float alpha = (spirals * 0.4 + wisp * 0.3 + fresnel * 0.3) * intensity;
          alpha *= (1.0 - eye * 0.5); // Calmer in center
          alpha *= 0.7; // Overall more transparent

          // Add streaky highlights
          float streak = smoothstep(0.7, 1.0, spirals) * 0.4;
          color += secondaryColor * streak;

          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.85));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.scale.setScalar(75);
    return mesh;
  }

  setElement(elementType) {
    this.currentElement = elementType;

    // Hide all orbs
    [this.fireOrbs, this.waterOrbs, this.earthOrbs, this.airOrbs].forEach(orbSet => {
      orbSet.left.visible = false;
      orbSet.right.visible = false;
    });
  }

  setChargeLevel(level) {
    this.chargeLevel = level;
  }

  update(time, hands, chargeLevel, mirrorMode = true) {
    this.time = time;
    this.chargeLevel = chargeLevel;

    if (chargeLevel <= 0) {
      // Hide all when not charging
      this.hideAllOrbs();
      return;
    }

    // Get current element's orb set
    const orbSet = this.getOrbSet(this.currentElement);
    if (!orbSet) return;

    // Update each hand
    this.updateHandOrb(orbSet.left, hands?.left, chargeLevel, mirrorMode, time, 'left');
    this.updateHandOrb(orbSet.right, hands?.right, chargeLevel, mirrorMode, time, 'right');
  }

  getOrbSet(elementType) {
    switch (elementType) {
      case 'fire': return this.fireOrbs;
      case 'water': return this.waterOrbs;
      case 'earth': return this.earthOrbs;
      case 'air': return this.airOrbs;
      default: return this.fireOrbs;
    }
  }

  updateHandOrb(orb, handData, chargeLevel, mirrorMode, time, side) {
    if (!handData?.palm || handData.palm.visibility < 0.3) {
      orb.visible = false;
      return;
    }

    // Calculate screen position
    let screenX = handData.palm.x * this.scene.getWidth();
    const screenY = (1 - handData.palm.y) * this.scene.getHeight();

    if (mirrorMode) {
      screenX = this.scene.getWidth() - screenX;
    }

    // Position orb
    orb.position.set(screenX, screenY, 20);
    orb.visible = true;

    // Scale based on charge level (60px at SPARK → 150px at AVATAR)
    const baseScale = 60;
    const maxScale = 150;
    const chargeRatio = chargeLevel / ChargeState.AVATAR;
    const targetScale = baseScale + (maxScale - baseScale) * chargeRatio;
    orb.scale.setScalar(targetScale);

    // Calculate intensity for shaders
    const intensity = 0.3 + chargeRatio * 0.7;

    // Update shader uniforms based on element type
    if (this.currentElement === 'earth') {
      // Earth orb is a group - update each rock
      orb.children.forEach((rock, i) => {
        if (rock.material?.uniforms) {
          rock.material.uniforms.time.value = time;
          rock.material.uniforms.intensity.value = intensity;
        }

        // Orbit animation
        const data = rock.userData;
        if (data) {
          data.orbitAngle += data.orbitSpeed * 0.02;
          rock.position.x = Math.cos(data.orbitAngle) * data.orbitRadius;
          rock.position.z = Math.sin(data.orbitAngle) * data.orbitRadius;
          rock.position.y = Math.sin(time * 2 + data.bobPhase) * 0.1;
          rock.rotation.x += data.spinSpeed * 0.01;
          rock.rotation.y += data.spinSpeed * 0.015;
        }
      });
    } else {
      // Other elements are single meshes
      if (orb.material?.uniforms) {
        orb.material.uniforms.time.value = time;
        orb.material.uniforms.intensity.value = intensity;
      }
    }

    // Add subtle rotation for visual interest
    if (this.currentElement !== 'earth') {
      orb.rotation.y = time * 0.5;
      orb.rotation.z = Math.sin(time * 0.3) * 0.1;
    }
  }

  hideAllOrbs() {
    [this.fireOrbs, this.waterOrbs, this.earthOrbs, this.airOrbs].forEach(orbSet => {
      orbSet.left.visible = false;
      orbSet.right.visible = false;
    });
  }

  triggerAvatarBurst() {
    // Called when reaching AVATAR state - trigger dramatic effect
    // Could add particle burst, flash, etc.
    console.log('AVATAR burst triggered for', this.currentElement);
  }

  // Called when hands collide - trigger mixing visual effect
  onHandsCollide(midX, midY, chargeLevel) {
    console.log('Hand orbs collision at:', midX, midY, 'charge:', chargeLevel);

    const orbs = this.getActiveOrbs();

    // Pulse both orbs
    [orbs.left, orbs.right].forEach(orb => {
      if (orb && orb.material && orb.material.uniforms) {
        // Boost intensity briefly
        const originalIntensity = orb.material.uniforms.intensity?.value || 1;
        orb.material.uniforms.intensity.value = Math.min(originalIntensity * 2, 3.0);

        // Return to normal after brief pulse
        setTimeout(() => {
          if (orb.material && orb.material.uniforms && orb.material.uniforms.intensity) {
            orb.material.uniforms.intensity.value = originalIntensity;
          }
        }, 150);
      }
    });
  }

  // Get current active orbs based on element
  getActiveOrbs() {
    const orbMap = {
      fire: this.fireOrbs,
      water: this.waterOrbs,
      earth: this.earthOrbs,
      air: this.airOrbs
    };
    return orbMap[this.currentElement] || this.fireOrbs;
  }

  dispose() {
    const disposeOrb = (orb) => {
      if (orb.geometry) orb.geometry.dispose();
      if (orb.material) orb.material.dispose();
      if (orb.children) {
        orb.children.forEach(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
      this.scene.remove(orb);
    };

    [this.fireOrbs, this.waterOrbs, this.earthOrbs, this.airOrbs].forEach(orbSet => {
      disposeOrb(orbSet.left);
      disposeOrb(orbSet.right);
    });
  }
}

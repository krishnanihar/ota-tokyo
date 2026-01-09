// The Elemental Bender - Configuration
// All constants, colors, timings from the spec

export const CONFIG = {
  // Screen
  TARGET_FPS: 60,
  MIN_RESOLUTION: { width: 1920, height: 1080 },

  // Movement Velocity Thresholds
  STILLNESS_THRESHOLD: 0.005,    // Below this = charging
  SLOW_MOVE_THRESHOLD: 0.03,    // Below this = flowing trails
  FAST_MOVE_THRESHOLD: 0.08,    // Above this = projectile release

  // Key joints for velocity calculation (MediaPipe landmark indices)
  KEY_JOINTS: [0, 11, 12, 15, 16, 23, 24], // nose, shoulders, wrists, hips

  // Charge System Timings (seconds)
  CHARGE_LEVELS: {
    NONE: { min: 0, max: 0 },
    SPARK: { min: 0, max: 2 },    // Level 1
    FORM: { min: 2, max: 5 },     // Level 2
    POWER: { min: 5, max: 8 },    // Level 3
    AVATAR: { min: 8, max: Infinity } // Level 4
  },

  // Element Cycle
  ELEMENT_DURATION: 10000,      // 10 seconds per element (faster for testing)
  TRANSITION_DURATION: 2000,    // 2 second blend between elements
  ELEMENT_ORDER: ['fire', 'water', 'earth', 'air'],

  // Particles - FEWER but LARGER for cohesive energy look
  MAX_PARTICLES: 5000,
  INITIAL_PARTICLES: 2000,
  PARTICLE_POOL_SIZE: 8000,

  // Body Rendering
  SILHOUETTE_OPACITY: 0.85,     // 85% opacity - solid but allows particle bleed-through
  GLOW_INTENSITY: 1.0,          // Full glow intensity
  MASK_THRESHOLD: 0.5,          // Segmentation mask cutoff

  // Performance
  MEDIAPIPE_FPS: 30,            // Can throttle detection if needed
  LATENCY_TARGET_MS: 100,

  // Mirror mode (for installation facing user)
  MIRROR_MODE: true
};

// Charge State Enum
export const ChargeState = {
  NONE: 0,
  SPARK: 1,
  FORM: 2,
  POWER: 3,
  AVATAR: 4
};

// Element Types
export const ElementType = {
  FIRE: 'fire',
  WATER: 'water',
  EARTH: 'earth',
  AIR: 'air'
};

// Color Palettes from Ukiyo-e art references - BOOSTED SATURATION
export const COLORS = {
  // Fire - Edo Fire Scroll Style - VIBRANT
  fire: {
    primary: '#FF4422',       // Bright Vermillion
    secondary: '#FFD700',     // Vivid Gold
    accent: '#FF8844',        // Orange flame tips
    glow: '#FF6633'           // Hot orange glow
  },

  // Water - Hokusai Great Wave Style - DEEP & VIVID
  water: {
    primary: '#0066CC',       // Vivid Prussian Blue
    secondary: '#0099FF',     // Bright wave blue
    accent: '#FFFFFF',        // Pure white foam
    glow: '#66CCFF'           // Bright cyan glow
  },

  // Earth - Sumi-e Ink Wash Style - RICHER
  earth: {
    primary: '#996622',       // Rich amber/umber
    secondary: '#CCAA66',     // Warm sand
    accent: '#669944',        // Vivid moss green
    glow: '#CC8844'           // Warm amber glow
  },

  // Air - Rinpa Cloud Style - MORE VISIBLE
  air: {
    primary: '#DDDDFF',       // Pale blue-white
    secondary: '#FFFFFF',     // Pure white
    accent: '#FFEEAA',        // Warm gold accent
    glow: '#EEEEFF'           // Soft white-blue glow
  },

  // Universal
  background: '#0A0A0A',      // Near black
  energyWhite: '#FFFEF0',     // Warm white for glows
  silhouette: '#000000'       // Pure black for body
};

// Element Behaviors - LARGER PARTICLES, FEWER COUNT for cohesive energy
export const ELEMENT_BEHAVIORS = {
  fire: {
    particleDirection: 'up',      // Flows upward inside body
    speed: 1.8,                   // Fast, volatile
    decay: 0.92,                  // Quick burn-out
    trailLength: 1.2,
    releaseForce: 2.0,
    particleSize: { min: 15, max: 40 },  // LARGER soft glowing particles
    spawnRate: 8,                 // Fewer particles
    description: 'Fire flows UPWARD inside silhouette'
  },

  water: {
    particleDirection: 'down',    // Flows downward inside body
    speed: 1.2,                   // Medium, fluid
    decay: 0.96,                  // Flowing dissipation
    trailLength: 2.0,             // Long silk ribbon trails
    releaseForce: 1.8,
    particleSize: { min: 20, max: 50 },  // LARGER flowing particles
    spawnRate: 10,                // Moderate count for flow
    ribbonEffect: true,
    waveAmplitude: 25,
    foamDensity: 0.5,
    description: 'Water flows DOWNWARD inside silhouette - Hokusai style'
  },

  earth: {
    particleDirection: 'center',  // Settles toward core
    speed: 0.7,                   // Slow, deliberate
    decay: 0.98,                  // Lingers longest
    trailLength: 0.8,
    releaseForce: 1.5,
    particleSize: { min: 25, max: 60 },  // LARGE dense chunks
    spawnRate: 5,                 // Few heavy particles
    description: 'Dense particles settle toward body core'
  },

  air: {
    particleDirection: 'swirl',   // Constantly in motion
    speed: 2.5,                   // Instant, weightless
    decay: 0.88,                  // Quick scatter
    trailLength: 2.5,
    releaseForce: 2.5,
    particleSize: { min: 10, max: 30 },  // Medium soft particles
    spawnRate: 12,                // Moderate swirling particles
    description: 'Swirling energy, never settles'
  }
};

// Charge Level Visual Properties
export const CHARGE_VISUALS = {
  [ChargeState.NONE]: {
    handGlow: 0,
    bodyTint: 0,
    auraIntensity: 0,
    environmentIntensity: 0,
    screenEffects: false
  },
  [ChargeState.SPARK]: {
    handGlow: 0.3,
    bodyTint: 0.1,
    auraIntensity: 0,
    environmentIntensity: 0,
    screenEffects: false
  },
  [ChargeState.FORM]: {
    handGlow: 0.6,
    bodyTint: 0.3,
    auraIntensity: 0.3,
    environmentIntensity: 0.3,
    screenEffects: false
  },
  [ChargeState.POWER]: {
    handGlow: 0.9,
    bodyTint: 0.6,
    auraIntensity: 0.7,
    environmentIntensity: 0.7,
    screenEffects: false
  },
  [ChargeState.AVATAR]: {
    handGlow: 1.0,
    bodyTint: 1.0,
    auraIntensity: 1.0,
    environmentIntensity: 1.0,
    screenEffects: true,
    eyeGlow: true,
    screenShake: 0.02,
    chromaticAberration: 0.005
  }
};

// Training Mode Lessons
export const TRAINING_LESSONS = [
  {
    id: 1,
    title: 'Gather Energy',
    instruction: 'Stand still to gather energy',
    successCondition: 'chargeLevel >= 2',
    duration: null // Until success
  },
  {
    id: 2,
    title: 'Release Power',
    instruction: 'Move to release your power',
    successCondition: 'released',
    duration: null
  },
  {
    id: 3,
    title: 'Flow',
    instruction: 'Move slowly — energy flows with you',
    successCondition: 'trailCreated',
    duration: null
  },
  {
    id: 4,
    title: 'Launch',
    instruction: 'Move fast — launch your element',
    successCondition: 'projectileLaunched',
    duration: null
  },
  {
    id: 5,
    title: 'Elements',
    instruction: 'Experience all four elements',
    successCondition: 'allElementsExperienced',
    duration: 40000, // 10 sec per element
    quickCycle: true
  }
];

// Audio Configuration
export const AUDIO_CONFIG = {
  masterVolume: 0.7,
  ambientVolume: 0.4,
  sfxVolume: 0.6,
  crossfadeDuration: 3000, // Match element transition

  // Frequency ranges for procedural audio
  frequencies: {
    fire: { base: 180, range: 100 },
    water: { base: 220, range: 80 },
    earth: { base: 80, range: 40 },
    air: { base: 400, range: 200 }
  }
};

// Keyboard Controls
export const KEYBOARD_CONTROLS = {
  '1': 'setMode:training',
  '2': 'setMode:sandbox',
  'd': 'toggleDebug',
  'f': 'toggleFullscreen',
  'm': 'toggleMirror',
  'Escape': 'exitFullscreen'
};

// MediaPipe Landmark Indices
export const LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32
};

// Helper to convert hex to RGB
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : null;
}

// Helper to interpolate between colors
export function lerpColor(color1, color2, t) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  return {
    r: rgb1.r + (rgb2.r - rgb1.r) * t,
    g: rgb1.g + (rgb2.g - rgb1.g) * t,
    b: rgb1.b + (rgb2.b - rgb1.b) * t
  };
}

# Elemental Bender - Black Screen Debug Analysis

## Executive Summary
The black screen is caused by multiple issues working together. The primary causes are:
1. **Inverted Y-axis in camera setup** - Objects render off-screen
2. **No fallback visuals** - Nothing shows without MediaPipe detection
3. **Mask dimensions mismatch** - Segmentation mask may be different size than expected

---

## Critical Issues Found

### 1. Orthographic Camera Y-Axis Inverted (HIGH PRIORITY)
**File:** `src/rendering/SceneSetup.js:27-31`

```javascript
// CURRENT (WRONG):
this.camera = new THREE.OrthographicCamera(
  0, this.width,    // left, right
  0, this.height,   // top, bottom ← INVERTED!
  -1000, 1000
);

// CORRECT:
this.camera = new THREE.OrthographicCamera(
  0, this.width,    // left, right
  this.height, 0,   // top, bottom (top should be > bottom for Y-up)
  -1000, 1000
);
```

**Impact:** All meshes positioned with Y coordinates render at wrong positions.

---

### 2. No Fallback Visuals When No Detection
**File:** `src/rendering/BodyRenderer.js:81`

```javascript
if (mask < 0.1) {
  discard;  // Discards ALL pixels when no mask data
}
```

**Impact:** Screen is completely black when:
- MediaPipe hasn't loaded yet
- No person detected in camera
- Camera permissions pending

---

### 3. MediaPipe Mask Dimensions Unknown
**File:** `src/detection/SegmentationMask.js`

The mask from `getAsFloat32Array()` may be 256x256 (model output size) not video resolution (1280x720).

**Impact:** Mask data gets incorrectly mapped to screen coordinates.

---

### 4. Hand Meshes Hidden by Default
**File:** `src/rendering/HandRenderer.js:146`

```javascript
mesh.visible = false; // Starts hidden
```

And only shows when:
- `handData?.palm` exists
- `visibility > 0.5`
- `chargeLevel > NONE`

**Impact:** Nothing visible at hands until user stands still to charge.

---

### 5. Particles Only Spawn With Pose Data
**File:** `src/core/App.js:239`

```javascript
this.activeElement?.update(deltaTime, this.lastPoseData);
```

Elements only spawn particles when they receive pose data.

**Impact:** No particles without detection.

---

## Secondary Issues

### 6. PoseProcessor Landmark Access
**File:** `src/detection/PoseProcessor.js:18`

```javascript
const pose = landmarks[0]; // First detected pose
```

Should verify `landmarks[0]` exists and has the expected structure.

### 7. Clock.getDelta() Called Multiple Times
**File:** `src/core/App.js:170`

```javascript
const deltaTime = this.scene.getDeltaTime();
```

`Clock.getDelta()` should only be called once per frame. Multiple calls return 0.

### 8. Missing Error Boundaries
No try-catch around:
- MediaPipe detection calls
- Segmentation mask processing
- WebGL shader compilation

---

## Recommended Fixes

### Fix 1: Camera Setup
```javascript
// SceneSetup.js - createCamera
this.camera = new THREE.OrthographicCamera(
  0, this.width,     // left, right
  this.height, 0,    // top, bottom (FIXED)
  -1000, 1000
);
```

### Fix 2: Add Debug Background/Test Objects
```javascript
// Add visible test elements to verify rendering
const testGeometry = new THREE.CircleGeometry(100, 32);
const testMaterial = new THREE.MeshBasicMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.5
});
const testCircle = new THREE.Mesh(testGeometry, testMaterial);
testCircle.position.set(width/2, height/2, 50);
this.scene.add(testCircle);
```

### Fix 3: Fallback Body Shader
```glsl
// BodyRenderer fragmentShader
if (mask < 0.1) {
  // Instead of discard, show subtle grid/background
  float grid = step(0.98, fract(vUv.x * 50.0)) + step(0.98, fract(vUv.y * 50.0));
  gl_FragColor = vec4(vec3(0.05), grid * 0.1);
  return;
}
```

### Fix 4: Add Console Logging
```javascript
// MediaPipeSetup.js - detect()
console.log('Detection result:', {
  hasLandmarks: this.results?.landmarks?.length > 0,
  hasMask: this.results?.segmentationMasks?.length > 0,
  maskSize: this.results?.segmentationMasks?.[0]?.width
});
```

### Fix 5: Handle Mask Size
```javascript
// SegmentationMask.js - update()
const mask = segmentationMask.getAsFloat32Array();
const maskWidth = segmentationMask.width;
const maskHeight = segmentationMask.height;
console.log(`Mask dimensions: ${maskWidth}x${maskHeight}`);
```

---

## Test Checklist

1. [ ] Camera renders test circle at screen center
2. [ ] Console shows MediaPipe initialization success
3. [ ] Console shows detection results (landmarks, mask)
4. [ ] Body silhouette appears when person detected
5. [ ] Particles spawn when charging
6. [ ] Debug overlay shows FPS > 0

---

## Quick Debug Steps

1. Open browser DevTools Console
2. Look for errors (red messages)
3. Press 'D' to show debug overlay
4. Check FPS, Velocity, Particle count values
5. If FPS=0, rendering loop not running
6. If FPS>0 but black, camera/mesh positioning issue


// Pose Processor - Velocity calculation and movement detection
import { CONFIG, LANDMARKS } from '../config.js';

export class PoseProcessor {
  constructor() {
    this.previousLandmarks = null;
    this.velocityHistory = [];
    this.historyLength = 5; // Smooth over 5 frames
    this.stillTime = 0;
    this.lastTimestamp = 0;

    // Charge accumulation rates
    this.stillChargeRate = 1.0;       // Full rate when still
    this.slowMoveChargeRate = 0.6;    // 60% rate when moving slowly

    // Multi-person tracking - track primary person by position continuity
    this.trackedBodyCenter = null;    // Last known body center position
    this.trackedPoseIndex = 0;        // Which pose index we're tracking
  }

  process(landmarks, timestamp, worldLandmarks = null) {
    if (!landmarks || landmarks.length === 0) {
      return null;
    }

    // Find the best matching pose (closest to our previously tracked position)
    const poseIndex = this.findBestMatchingPose(landmarks);
    const pose = landmarks[poseIndex];
    const deltaTime = this.lastTimestamp > 0 ? (timestamp - this.lastTimestamp) / 1000 : 0.016;
    this.lastTimestamp = timestamp;

    // Calculate movement velocity
    let velocity = this.calculateVelocity(pose, deltaTime);

    // SANITY CHECK: If velocity is extremely high (> 0.15), it's likely a tracking switch
    // between people, not actual movement. Ignore this frame's velocity.
    const maxReasonableVelocity = 0.15;
    const isTrackingJump = velocity > maxReasonableVelocity;
    if (isTrackingJump) {
      velocity = 0; // Treat as no movement - don't disrupt charge
    }

    // Update still time - accumulates on stillness AND slow movement
    // Still = full rate, Slow move = 60% rate, Fast move = reset
    if (velocity < CONFIG.STILLNESS_THRESHOLD) {
      // Completely still - full charge rate
      this.stillTime += deltaTime * this.stillChargeRate;
    } else if (velocity < CONFIG.SLOW_MOVE_THRESHOLD) {
      // Slow movement - reduced charge rate (still accumulating!)
      this.stillTime += deltaTime * this.slowMoveChargeRate;
    } else if (!isTrackingJump) {
      // Fast movement - reset charge (but NOT if it was a tracking jump)
      this.stillTime = 0;
    }

    // Get movement direction (for projectile release)
    const movementDirection = this.calculateMovementDirection(pose);

    // Get hand positions for element rendering
    const hands = this.getHandPositions(pose);

    // Get body center for various effects
    const bodyCenter = this.getBodyCenter(pose);

    // Update tracked body center for next frame's matching
    if (bodyCenter) {
      this.trackedBodyCenter = { x: bodyCenter.x, y: bodyCenter.y };
    }
    this.trackedPoseIndex = poseIndex;

    // Extract 3D world landmarks for point cloud Z-interpolation (use matching index)
    const worldLandmarks3D = this.extractWorldLandmarks3D(worldLandmarks, poseIndex);

    // Store for next frame
    this.previousLandmarks = pose;

    return {
      landmarks: pose,
      poseIndex,  // Which person we're tracking (for matching mask)
      worldLandmarks3D,  // 3D coordinates for depth interpolation
      velocity,
      smoothedVelocity: this.getSmoothedVelocity(velocity),
      stillTime: this.stillTime,
      movementDirection,
      hands,
      bodyCenter,
      isStill: velocity < CONFIG.STILLNESS_THRESHOLD,
      isSlowMove: velocity >= CONFIG.STILLNESS_THRESHOLD && velocity < CONFIG.SLOW_MOVE_THRESHOLD,
      // isFastMove is false during tracking jumps (velocity was set to 0)
      isFastMove: !isTrackingJump && velocity >= CONFIG.FAST_MOVE_THRESHOLD
    };
  }

  calculateVelocity(currentPose, deltaTime) {
    if (!this.previousLandmarks || deltaTime === 0) {
      return 0;
    }

    let totalVelocity = 0;
    let validJoints = 0;

    CONFIG.KEY_JOINTS.forEach(i => {
      const current = currentPose[i];
      const previous = this.previousLandmarks[i];

      if (current && previous && current.visibility > 0.5 && previous.visibility > 0.5) {
        const dx = current.x - previous.x;
        const dy = current.y - previous.y;
        totalVelocity += Math.sqrt(dx * dx + dy * dy);
        validJoints++;
      }
    });

    return validJoints > 0 ? totalVelocity / validJoints : 0;
  }

  getSmoothedVelocity(currentVelocity) {
    this.velocityHistory.push(currentVelocity);

    if (this.velocityHistory.length > this.historyLength) {
      this.velocityHistory.shift();
    }

    const sum = this.velocityHistory.reduce((a, b) => a + b, 0);
    return sum / this.velocityHistory.length;
  }

  calculateMovementDirection(pose) {
    if (!this.previousLandmarks) {
      return { x: 0, y: 0 };
    }

    // Calculate average movement direction from key joints
    let dx = 0;
    let dy = 0;
    let count = 0;

    // Focus on hands for release direction
    [LANDMARKS.LEFT_WRIST, LANDMARKS.RIGHT_WRIST].forEach(i => {
      const current = pose[i];
      const previous = this.previousLandmarks[i];

      if (current && previous && current.visibility > 0.5) {
        dx += current.x - previous.x;
        dy += current.y - previous.y;
        count++;
      }
    });

    if (count === 0) return { x: 0, y: 0 };

    dx /= count;
    dy /= count;

    // Normalize
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    if (magnitude > 0.001) {
      return { x: dx / magnitude, y: dy / magnitude };
    }

    return { x: 0, y: 0 };
  }

  getHandPositions(pose) {
    const leftWrist = pose[LANDMARKS.LEFT_WRIST];
    const rightWrist = pose[LANDMARKS.RIGHT_WRIST];
    const leftIndex = pose[LANDMARKS.LEFT_INDEX];
    const rightIndex = pose[LANDMARKS.RIGHT_INDEX];

    return {
      left: {
        wrist: leftWrist ? { x: leftWrist.x, y: leftWrist.y, z: leftWrist.z, visibility: leftWrist.visibility } : null,
        index: leftIndex ? { x: leftIndex.x, y: leftIndex.y, z: leftIndex.z, visibility: leftIndex.visibility } : null,
        // Palm center is estimated between wrist and index base
        palm: leftWrist && leftIndex ? {
          x: (leftWrist.x + leftIndex.x) / 2,
          y: (leftWrist.y + leftIndex.y) / 2,
          visibility: Math.min(leftWrist.visibility, leftIndex.visibility)
        } : null
      },
      right: {
        wrist: rightWrist ? { x: rightWrist.x, y: rightWrist.y, z: rightWrist.z, visibility: rightWrist.visibility } : null,
        index: rightIndex ? { x: rightIndex.x, y: rightIndex.y, z: rightIndex.z, visibility: rightIndex.visibility } : null,
        palm: rightWrist && rightIndex ? {
          x: (rightWrist.x + rightIndex.x) / 2,
          y: (rightWrist.y + rightIndex.y) / 2,
          visibility: Math.min(rightWrist.visibility, rightIndex.visibility)
        } : null
      }
    };
  }

  getBodyCenter(pose) {
    // Use hips and shoulders to find body center
    const leftShoulder = pose[LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = pose[LANDMARKS.RIGHT_SHOULDER];
    const leftHip = pose[LANDMARKS.LEFT_HIP];
    const rightHip = pose[LANDMARKS.RIGHT_HIP];

    if (leftShoulder && rightShoulder && leftHip && rightHip) {
      return {
        x: (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4,
        y: (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4,
        // Torso width/height for sizing effects
        width: Math.abs(leftShoulder.x - rightShoulder.x),
        height: Math.abs((leftShoulder.y + rightShoulder.y) / 2 - (leftHip.y + rightHip.y) / 2)
      };
    }

    return null;
  }

  getEyePositions(pose) {
    const leftEye = pose[LANDMARKS.LEFT_EYE];
    const rightEye = pose[LANDMARKS.RIGHT_EYE];

    return {
      left: leftEye ? { x: leftEye.x, y: leftEye.y, visibility: leftEye.visibility } : null,
      right: rightEye ? { x: rightEye.x, y: rightEye.y, visibility: rightEye.visibility } : null
    };
  }

  reset() {
    this.previousLandmarks = null;
    this.velocityHistory = [];
    this.stillTime = 0;
    this.trackedBodyCenter = null;
    this.trackedPoseIndex = 0;
  }

  // Find the pose closest to our previously tracked position
  // This prevents flickering when MediaPipe returns people in different order
  findBestMatchingPose(landmarks) {
    // If only one person or no previous tracking, use first
    if (landmarks.length === 1 || !this.trackedBodyCenter) {
      return 0;
    }

    let bestIndex = 0;
    let bestDistance = Infinity;

    for (let i = 0; i < landmarks.length; i++) {
      const pose = landmarks[i];
      const center = this.getBodyCenter(pose);

      if (center) {
        const dx = center.x - this.trackedBodyCenter.x;
        const dy = center.y - this.trackedBodyCenter.y;
        const dist = dx * dx + dy * dy;

        if (dist < bestDistance) {
          bestDistance = dist;
          bestIndex = i;
        }
      }
    }

    return bestIndex;
  }

  // Extract 3D world landmarks for depth interpolation in point cloud
  extractWorldLandmarks3D(worldLandmarks, poseIndex = 0) {
    if (!worldLandmarks || worldLandmarks.length === 0) {
      return null;
    }

    const world = worldLandmarks[poseIndex] || worldLandmarks[0];
    if (!world || world.length === 0) {
      return null;
    }

    // Return all 33 landmarks with normalized x,y and world z
    // MediaPipe world landmarks are in meters with origin at hip center
    return world.map((landmark, index) => ({
      index,
      // Normalized coordinates (0-1) for matching with mask
      x: landmark.x !== undefined ? landmark.x : 0,
      y: landmark.y !== undefined ? landmark.y : 0,
      // World Z in meters (depth from camera) - normalized for rendering
      // Typical range is about -0.5 to 0.5 meters from hip center
      z: landmark.z !== undefined ? landmark.z : 0,
      visibility: landmark.visibility !== undefined ? landmark.visibility : 0
    }));
  }
}

// Charge System - 4-level charge state machine
import { CONFIG, ChargeState, CHARGE_VISUALS } from '../config.js';

export class ChargeSystem {
  constructor() {
    this.currentLevel = ChargeState.NONE;
    this.previousLevel = ChargeState.NONE;
    this.stillTime = 0;
    this.chargeProgress = 0; // 0-1 progress within current level
    this.onLevelChange = null;
    this.onRelease = null;
  }

  update(poseData, deltaTime) {
    if (!poseData) {
      this.reset();
      // Return valid data even when no pose
      return {
        level: this.currentLevel,
        progress: 0,
        visuals: CHARGE_VISUALS[ChargeState.NONE],
        stillTime: 0
      };
    }

    this.stillTime = poseData.stillTime;
    this.previousLevel = this.currentLevel;

    // Determine charge level from still time
    if (this.stillTime >= CONFIG.CHARGE_LEVELS.AVATAR.min) {
      this.currentLevel = ChargeState.AVATAR;
    } else if (this.stillTime >= CONFIG.CHARGE_LEVELS.POWER.min) {
      this.currentLevel = ChargeState.POWER;
    } else if (this.stillTime >= CONFIG.CHARGE_LEVELS.FORM.min) {
      this.currentLevel = ChargeState.FORM;
    } else if (this.stillTime > 0) {
      this.currentLevel = ChargeState.SPARK;
    } else {
      this.currentLevel = ChargeState.NONE;
    }

    // Calculate progress within current level
    this.chargeProgress = this.calculateProgress();

    // Notify on level change
    if (this.currentLevel !== this.previousLevel) {
      if (this.onLevelChange) {
        this.onLevelChange(this.currentLevel, this.previousLevel);
      }
    }

    // Check for release - only on FAST movement (not slow movement)
    // Slow movement still accumulates charge at 60% rate
    if (this.previousLevel > ChargeState.NONE && poseData.isFastMove) {
      this.triggerRelease(poseData);
    }

    return {
      level: this.currentLevel,
      progress: this.chargeProgress,
      visuals: CHARGE_VISUALS[this.currentLevel],
      stillTime: this.stillTime
    };
  }

  calculateProgress() {
    const levels = CONFIG.CHARGE_LEVELS;

    switch (this.currentLevel) {
      case ChargeState.SPARK:
        return (this.stillTime - levels.SPARK.min) / (levels.SPARK.max - levels.SPARK.min);
      case ChargeState.FORM:
        return (this.stillTime - levels.FORM.min) / (levels.FORM.max - levels.FORM.min);
      case ChargeState.POWER:
        return (this.stillTime - levels.POWER.min) / (levels.POWER.max - levels.POWER.min);
      case ChargeState.AVATAR:
        // Avatar level maxes out at 12 seconds
        return Math.min(1, (this.stillTime - levels.AVATAR.min) / 4);
      default:
        return 0;
    }
  }

  triggerRelease(poseData) {
    if (this.onRelease) {
      const releaseData = {
        level: this.previousLevel,
        direction: poseData.movementDirection,
        velocity: poseData.velocity,
        isFastMove: poseData.isFastMove,
        isSlowMove: poseData.isSlowMove,
        hands: poseData.hands
      };
      this.onRelease(releaseData);
    }

    this.reset();
  }

  reset() {
    this.stillTime = 0;
    this.currentLevel = ChargeState.NONE;
    this.chargeProgress = 0;
  }

  getLevel() {
    return this.currentLevel;
  }

  getProgress() {
    return this.chargeProgress;
  }

  getVisuals() {
    return CHARGE_VISUALS[this.currentLevel];
  }

  isCharging() {
    return this.currentLevel > ChargeState.NONE;
  }

  isMaxCharge() {
    return this.currentLevel === ChargeState.AVATAR;
  }

  // Get normalized charge value (0-1 across all levels)
  getNormalizedCharge() {
    const base = (this.currentLevel - 1) / (ChargeState.AVATAR - 1);
    const inLevel = this.chargeProgress / (ChargeState.AVATAR);
    return Math.max(0, Math.min(1, base + inLevel));
  }
}

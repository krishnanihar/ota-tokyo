// MediaPipe Pose Landmarker Setup - Multi-person support
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { CONFIG } from '../config.js';

export class MediaPipeSetup {
  constructor() {
    this.poseLandmarker = null;
    this.video = null;
    this.isReady = false;
    this.lastVideoTime = -1;
    this.results = null;
    this.detectionCount = 0;
    this.lastDetectionLog = 0;
    this.maxPoses = CONFIG.MAX_PEOPLE || 4; // Support up to 4 people

    // Video preprocessing for camera orientation
    this.preprocessCanvas = null;
    this.preprocessCtx = null;
    this.cameraOrientation = CONFIG.CAMERA_ORIENTATION || 'normal';
  }

  async initialize(videoElement) {
    this.video = videoElement;

    console.log('MediaPipe: Loading vision tasks...');

    try {
      // Load MediaPipe vision tasks - use local files for offline support
      const vision = await FilesetResolver.forVisionTasks(
        '/mediapipe'  // Local path in public folder
      );
      console.log('MediaPipe: Vision WASM loaded (offline)');

      // Create pose landmarker with segmentation - MULTI-PERSON SUPPORT
      // Using FULL model for better accuracy with back-facing/side-view detection
      console.log(`MediaPipe: Creating pose landmarker for ${this.maxPoses} people...`);
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/mediapipe/pose_landmarker_full.task',  // Full model for better back-view detection
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: this.maxPoses, // Track multiple people
        // Lower thresholds for better detection from all angles (front, back, side)
        minPoseDetectionConfidence: 0.3,
        minPosePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
        outputSegmentationMasks: true
      });
      console.log(`MediaPipe: Pose landmarker created for ${this.maxPoses} people`);

      // Setup webcam
      await this.setupCamera();

      // Setup preprocessing canvas for camera orientation
      this.setupPreprocessCanvas();

      this.isReady = true;
      console.log(`MediaPipe: Initialization complete! Camera orientation: ${this.cameraOrientation}`);
      return true;
    } catch (error) {
      console.error('MediaPipe initialization failed:', error);
      throw error;
    }
  }

  async setupCamera() {
    // Camera constraints - no facingMode restriction for installation flexibility
    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
        // No facingMode - allows any camera (front, back, external)
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = stream;

      return new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve();
        };
      });
    } catch (error) {
      console.error('Camera access denied:', error);
      throw new Error('Camera access is required for this application');
    }
  }

  setupPreprocessCanvas() {
    // Create offscreen canvas for video preprocessing
    // This handles camera orientation transforms before MediaPipe detection
    this.preprocessCanvas = document.createElement('canvas');
    this.preprocessCanvas.width = this.video.videoWidth || 1280;
    this.preprocessCanvas.height = this.video.videoHeight || 720;
    this.preprocessCtx = this.preprocessCanvas.getContext('2d', { willReadFrequently: true });

    console.log(`MediaPipe: Preprocess canvas created ${this.preprocessCanvas.width}x${this.preprocessCanvas.height}`);
  }

  preprocessVideoFrame() {
    // Resize canvas if video dimensions changed
    if (this.preprocessCanvas.width !== this.video.videoWidth ||
        this.preprocessCanvas.height !== this.video.videoHeight) {
      this.preprocessCanvas.width = this.video.videoWidth;
      this.preprocessCanvas.height = this.video.videoHeight;
    }

    const ctx = this.preprocessCtx;
    const w = this.preprocessCanvas.width;
    const h = this.preprocessCanvas.height;

    ctx.save();

    // Apply camera orientation transform
    switch (this.cameraOrientation) {
      case 'flip-vertical':
        // Camera under display pointing UP - flip vertically
        // This is the key fix for webcam-under-display setups
        ctx.translate(0, h);
        ctx.scale(1, -1);
        break;

      case 'flip-horizontal':
        // Flip horizontally (mirror)
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        break;

      case 'rotate-180':
        // Rotate 180 degrees (both flips)
        ctx.translate(w, h);
        ctx.scale(-1, -1);
        break;

      case 'normal':
      default:
        // No transform
        break;
    }

    // Draw the video frame with transform applied
    ctx.drawImage(this.video, 0, 0, w, h);
    ctx.restore();

    return this.preprocessCanvas;
  }

  detect(timestamp) {
    if (!this.isReady || !this.video || this.video.readyState < 2) {
      return null;
    }

    // Only process new frames
    if (this.video.currentTime === this.lastVideoTime) {
      return this.results;
    }

    this.lastVideoTime = this.video.currentTime;

    try {
      // Get input source - use preprocessed canvas if camera needs orientation correction
      let inputSource = this.video;
      if (this.cameraOrientation !== 'normal' && this.preprocessCanvas) {
        inputSource = this.preprocessVideoFrame();
      }

      // Run pose detection on the (possibly transformed) input
      this.results = this.poseLandmarker.detectForVideo(inputSource, timestamp);
      this.detectionCount++;

      // Log detection info periodically (every 2 seconds)
      if (timestamp - this.lastDetectionLog > 2000) {
        const numPeople = this.results?.landmarks?.length || 0;
        const hasMask = this.results?.segmentationMasks?.length > 0;
        const maskInfo = hasMask ? `${this.results.segmentationMasks[0].width}x${this.results.segmentationMasks[0].height}` : 'none';
        console.log(`MediaPipe: Detection #${this.detectionCount} - People: ${numPeople}, Mask: ${maskInfo}`);
        this.lastDetectionLog = timestamp;
      }

      return this.results;
    } catch (error) {
      console.error('MediaPipe detection error:', error);
      return null;
    }
  }

  getVideoSize() {
    return {
      width: this.video?.videoWidth || 1280,
      height: this.video?.videoHeight || 720
    };
  }

  dispose() {
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
    }
    if (this.video?.srcObject) {
      this.video.srcObject.getTracks().forEach(track => track.stop());
    }
  }
}

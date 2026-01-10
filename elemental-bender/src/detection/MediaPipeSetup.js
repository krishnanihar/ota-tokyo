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
      console.log(`MediaPipe: Creating pose landmarker for ${this.maxPoses} people...`);
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/mediapipe/pose_landmarker_lite.task',  // Local model
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: this.maxPoses, // Track multiple people
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: true
      });
      console.log(`MediaPipe: Pose landmarker created for ${this.maxPoses} people`);

      // Setup webcam
      await this.setupCamera();

      this.isReady = true;
      console.log('MediaPipe: Initialization complete!');
      return true;
    } catch (error) {
      console.error('MediaPipe initialization failed:', error);
      throw error;
    }
  }

  async setupCamera() {
    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
        frameRate: { ideal: 30 }
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
      // Run pose detection
      this.results = this.poseLandmarker.detectForVideo(this.video, timestamp);
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

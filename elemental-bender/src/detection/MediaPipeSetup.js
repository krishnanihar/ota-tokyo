// MediaPipe Pose Landmarker Setup
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
  }

  async initialize(videoElement) {
    this.video = videoElement;

    console.log('MediaPipe: Loading vision tasks...');

    try {
      // Load MediaPipe vision tasks
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      console.log('MediaPipe: Vision WASM loaded');

      // Create pose landmarker with segmentation
      console.log('MediaPipe: Creating pose landmarker...');
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: true
      });
      console.log('MediaPipe: Pose landmarker created');

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

      // Log detection info periodically (every 60 frames)
      if (timestamp - this.lastDetectionLog > 2000) {
        const hasLandmarks = this.results?.landmarks?.length > 0;
        const hasMask = this.results?.segmentationMasks?.length > 0;
        const maskInfo = hasMask ? `${this.results.segmentationMasks[0].width}x${this.results.segmentationMasks[0].height}` : 'none';
        console.log(`MediaPipe: Detection #${this.detectionCount} - Landmarks: ${hasLandmarks}, Mask: ${maskInfo}`);
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

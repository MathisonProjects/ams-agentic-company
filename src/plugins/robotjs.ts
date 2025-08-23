import { Logger } from '../utils/logger';
import robotjs from 'robotjs';

export interface MouseLocationEvent {
  x: number;
  y: number;
  timestamp: number;
}

export class RobotJsPlugin {
  private logger: Logger;
  private robot: any;
  private mouseTrackingInterval: NodeJS.Timeout | null = null;
  private isTracking: boolean = false;
  private clickCallbacks: Array<(event: MouseLocationEvent) => void> = [];
  private lastLocation: MouseLocationEvent | null = null;

  constructor() {
    this.logger = new Logger('RobotJS');
    this.robot = robotjs;
  }

  /**
   * Start tracking mouse location
   */
  public startMouseTracking(): void {
    if (this.isTracking) {
      this.logger.warn('Mouse tracking is already active');
      return;
    }

    this.mouseTrackingInterval = setInterval(() => {
      const mouse = this.robot.getMousePos();
      const locationEvent: MouseLocationEvent = {
        x: mouse.x,
        y: mouse.y,
        timestamp: Date.now()
      };

      // Only log if location has changed
      if (!this.lastLocation || 
          this.lastLocation.x !== locationEvent.x || 
          this.lastLocation.y !== locationEvent.y) {
        
        this.logger.info('Mouse location changed', locationEvent);
        this.lastLocation = locationEvent;
        
        // Notify all callbacks
        this.clickCallbacks.forEach(callback => {
          try {
            callback(locationEvent);
          } catch (error) {
            this.logger.error('Error in mouse location callback', error);
          }
        });
      }
    }, 15000);

    this.isTracking = true;
    this.logger.info('Started mouse location tracking');
  }

  /**
   * Stop tracking mouse location
   */
  public stopMouseTracking(): void {
    if (!this.isTracking) {
      this.logger.warn('Mouse tracking is not currently active');
      return;
    }

    if (this.mouseTrackingInterval) {
      clearInterval(this.mouseTrackingInterval);
      this.mouseTrackingInterval = null;
    }

    this.isTracking = false;
    this.logger.info('Stopped mouse location tracking');
  }

  /**
   * Add a callback for mouse location events
   */
  public onMouseLocation(callback: (event: MouseLocationEvent) => void): void {
    this.clickCallbacks.push(callback);
  }

  /**
   * Remove a mouse location callback
   */
  public removeMouseLocationCallback(callback: (event: MouseLocationEvent) => void): void {
    const index = this.clickCallbacks.indexOf(callback);
    if (index > -1) {
      this.clickCallbacks.splice(index, 1);
    }
  }

  /**
   * Get current tracking status
   */
  public getTrackingStatus(): {
    isTracking: boolean;
    callbackCount: number;
    lastLocation: MouseLocationEvent | null;
  } {
    return {
      isTracking: this.isTracking,
      callbackCount: this.clickCallbacks.length,
      lastLocation: this.lastLocation
    };
  }

  /**
   * Open a web browser with the specified URL
   */
  async openBrowser(url: string): Promise<void> {
    try {
      // Use the system's default browser to open the URL
      const { exec } = require('child_process');
      const { platform } = require('os');

      let command: string;

      switch (platform()) {
        case 'darwin': // macOS
          command = `open "${url}"`;
          break;
        case 'win32': // Windows
          command = `start "${url}"`;
          break;
        default: // Linux and others
          command = `xdg-open "${url}"`;
          break;
      }

      exec(command, (error: any) => {
        if (error) {
          this.logger.error('Failed to open browser', error);
        } else {
          this.logger.info(`Browser opened successfully: ${url}`);
        }
      });
    } catch (error) {
      this.logger.error('Error opening browser', error);
    }
  }
}

export default RobotJsPlugin;
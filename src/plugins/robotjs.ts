import { Logger } from '../utils/logger';

export class RobotJsPlugin {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('RobotJS');
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
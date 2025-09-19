import { Logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

// Conditional import for robotjs - only available in non-Docker environments
let robotjs: any = null;
try {
    if (process.env['NODE_ENV'] !== 'docker') {
        robotjs = require('robotjs');
    }
} catch (error) {
    // robotjs not available, will use mock functions
}

export interface MouseLocationEvent {
    x: number;
    y: number;
    timestamp: number;
}

export class RobotJsPlugin {
    private logger: Logger;

    constructor() {
        this.logger = new Logger('RobotJS');
        
        if (robotjs) {
            // Initialize robotjs with delays for more human-like behavior
            robotjs.setMouseDelay(2);
            robotjs.setKeyboardDelay(100);
            this.logger.info('RobotJS initialized successfully');
        } else {
            this.logger.warn('RobotJS not available - running in Docker mode with mock functions');
        }
        
        // Ensure tmp directory exists
        this.ensureTmpDirectory();
    }

    /**
     * Ensure the tmp directory exists for screenshots
     */
    private ensureTmpDirectory(): void {
        const tmpDir = path.join(process.cwd(), 'src', 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
            this.logger.info('Created tmp directory for screenshots');
        }
    }

    /**
     * Open a web browser with the specified URL
     */
    async openBrowser(url: string): Promise<void> {
        try {
            if (!robotjs) {
                this.logger.info('Mock: Browser would open URL:', url);
                return;
            }
            
            const command = `open "${url}"`;
            const { exec } = require('child_process');
            
            exec(command, (error: any) => {
                if (error) {
                    this.logger.error('Failed to open browser', error);
                    throw error;
                }
                this.logger.info('Browser opened successfully:', url);
            });
        } catch (error) {
            this.logger.error('Error opening browser', error);
            throw error;
        }
    }

    /**
     * Move mouse to specific coordinates
     */
    async mouseMove(x: number, y: number): Promise<void> {
        try {
            if (!robotjs) {
                this.logger.info('Mock: Mouse moved to', { x, y });
                return;
            }
            
            // Get current mouse position
            const pos = robotjs.getMousePos();
            
            // Calculate distance to move
            const dx = x - pos.x;
            const dy = y - pos.y;
            
            // Move mouse gradually in small steps for more human-like movement
            const steps = 20;
            for (let i = 0; i < steps; i++) {
                const stepX = Math.round(pos.x + (dx * (i + 1) / steps));
                const stepY = Math.round(pos.y + (dy * (i + 1) / steps));
                robotjs.moveMouse(stepX, stepY);
            }
            
            this.logger.info('Mouse moved to', { x, y });
        } catch (error) {
            this.logger.error('Error moving mouse', error);
            throw error;
        }
    }

    /**
     * Left click at current mouse position or specific coordinates
     */
    async leftClick(x?: number, y?: number): Promise<void> {
        try {
            if (!robotjs) {
                this.logger.info('Mock: Left click performed', x !== undefined ? { x, y } : 'at current position');
                return;
            }
            
            if (x !== undefined && y !== undefined) {
                await this.mouseMove(x, y);
            }
            
            robotjs.mouseClick();
            this.logger.info('Left click performed', x !== undefined ? { x, y } : 'at current position');
        } catch (error) {
            this.logger.error('Error performing left click', error);
            throw error;
        }
    }

    /**
     * Right click at current mouse position or specific coordinates
     */
    async rightClick(x?: number, y?: number): Promise<void> {
        try {
            if (x !== undefined && y !== undefined) {
                await this.mouseMove(x, y);
            }
            
            robotjs.mouseClick('right');
            this.logger.info('Right click performed', x !== undefined ? { x, y } : 'at current position');
        } catch (error) {
            this.logger.error('Error performing right click', error);
            throw error;
        }
    }

    /**
     * Double click at current mouse position or specific coordinates
     */
    async doubleClick(x?: number, y?: number): Promise<void> {
        try {
            if (x !== undefined && y !== undefined) {
                await this.mouseMove(x, y);
            }
            
            robotjs.mouseClick('left', true);
            this.logger.info('Double click performed', x !== undefined ? { x, y } : 'at current position');
        } catch (error) {
            this.logger.error('Error performing double click', error);
            throw error;
        }
    }

    /**
     * Type text with standard robotjs typing
     */
    async typeText(text: string): Promise<void> {
        try {
            robotjs.typeString(text);
            this.logger.info('Text typed:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
        } catch (error) {
            this.logger.error('Error typing text', error);
            throw error;
        }
    }

    /**
     * Type text with human-like delays and variations
     */
    async humanTypeText(text: string): Promise<void> {
        try {
            const baseDelay = text.length > 50 ? (25 + Math.random() * 25) : (Math.random() * 25);

            // Simulate human typing with random delays
            for (let char of text) {
                if (char === '\n') {
                    robotjs.keyTap('enter');
                    await new Promise(resolve => setTimeout(resolve, (baseDelay + Math.random() * 50)));
                } else {
                    robotjs.typeString(char);
                    await new Promise(resolve => setTimeout(resolve, (baseDelay + Math.random() * 50)));
                    
                    if (char === '.' || char === '!' || char === '?') {
                        await new Promise(resolve => setTimeout(resolve, (200 + Math.random() * 50)));
                    }
                    if (char === ' ') {
                        await new Promise(resolve => setTimeout(resolve, (10 + Math.random() * 25)));
                    }
                    if (Math.random() < 0.05) { // 5% chance of a mistake
                        robotjs.keyTap('backspace');
                        robotjs.typeString(char);
                    }
                }
            }
            
            this.logger.info('Human-like text typed:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
        } catch (error) {
            this.logger.error('Error in human typing', error);
            throw error;
        }
    }

    /**
     * Press a key or combination of keys
     */
    async pressKey(key: string, modifier?: string): Promise<void> {
        try {
            if (modifier) {
                robotjs.keyTap(key, modifier);
            } else {
                robotjs.keyTap(key);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.logger.info('Key pressed:', modifier ? `${modifier}+${key}` : key);
        } catch (error) {
            this.logger.error('Error pressing key', error);
            throw error;
        }
    }

    /**
     * Scroll up
     */
    scrollUp(amount: number = 10): void {
        try {
            robotjs.scrollMouse(0, amount);
            this.logger.info('Scrolled up by', amount);
        } catch (error) {
            this.logger.error('Error scrolling up', error);
            throw error;
        }
    }

    /**
     * Scroll down
     */
    scrollDown(amount: number = 10): void {
        try {
            robotjs.scrollMouse(0, -amount);
            this.logger.info('Scrolled down by', amount);
        } catch (error) {
            this.logger.error('Error scrolling down', error);
            throw error;
        }
    }

    /**
     * Get current mouse position
     */
    getMousePosition(): { x: number; y: number } {
        try {
            const pos = robotjs.getMousePos();
            return { x: pos.x, y: pos.y };
        } catch (error) {
            this.logger.error('Error getting mouse position', error);
            throw error;
        }
    }

    /**
     * Get screen size
     */
    getScreenSize(): { width: number; height: number } {
        try {
            const size = robotjs.getScreenSize();
            return { width: size.width, height: size.height };
        } catch (error) {
            this.logger.error('Error getting screen size', error);
            throw error;
        }
    }

    /**
     * Click at percentile coordinates (0-100)
     */
    async clickPercentile(x: number, y: number): Promise<void> {
        try {
            const { width, height } = this.getScreenSize();
            const targetX = Math.floor(width * (x / 100));
            const targetY = Math.floor(height * (y / 100));
            
            await this.mouseMove(targetX, targetY);
            await new Promise(resolve => setTimeout(resolve, 250));
            robotjs.mouseClick();
            
            this.logger.info('Clicked at percentile coordinates', { x, y, targetX, targetY });
        } catch (error) {
            this.logger.error('Error clicking at percentile coordinates', error);
            throw error;
        }
    }

    /**
     * Take a screenshot and save it to the tmp folder
     */
    async takeScreenshot(filename?: string): Promise<string> {
        try {
            // Generate filename if not provided
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotName = filename || `screenshot-${timestamp}.png`;
            const screenshotPath = path.join(process.cwd(), 'src', 'tmp', screenshotName);
            
            // Take screenshot using robotjs
            const screenshot = robotjs.screen.capture();
            
            // Save the screenshot
            const imageBuffer = screenshot.image;
            fs.writeFileSync(screenshotPath, imageBuffer);
            
            this.logger.info('Screenshot taken and saved', { 
                filename: screenshotName, 
                path: screenshotPath,
                size: imageBuffer.length 
            });
            
            return screenshotPath;
        } catch (error) {
            this.logger.error('Error taking screenshot', error);
            throw error;
        }
    }

    /**
     * Take a screenshot of a specific region
     */
    async takeScreenshotRegion(x: number, y: number, width: number, height: number, filename?: string): Promise<string> {
        try {
            // Generate filename if not provided
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotName = filename || `screenshot-region-${timestamp}.png`;
            const screenshotPath = path.join(process.cwd(), 'src', 'tmp', screenshotName);
            
            // Take screenshot of specific region using robotjs
            const screenshot = robotjs.screen.capture(x, y, width, height);
            
            // Save the screenshot
            const imageBuffer = screenshot.image;
            fs.writeFileSync(screenshotPath, imageBuffer);
            
            this.logger.info('Region screenshot taken and saved', { 
                filename: screenshotName, 
                path: screenshotPath,
                region: { x, y, width, height },
                size: imageBuffer.length 
            });
            
            return screenshotPath;
        } catch (error) {
            this.logger.error('Error taking region screenshot', error);
            throw error;
        }
    }

    /**
     * Get screenshot as base64 string
     */
    async getScreenshotBase64(): Promise<string> {
        try {
            // Take screenshot using robotjs
            const screenshot = robotjs.screen.capture();
            
            // Convert to base64
            const imageBuffer = screenshot.image;
            const base64String = imageBuffer.toString('base64');
            
            this.logger.info('Screenshot converted to base64', { 
                size: imageBuffer.length,
                base64Length: base64String.length 
            });
            
            return base64String;
        } catch (error) {
            this.logger.error('Error getting screenshot as base64', error);
            throw error;
        }
    }

    /**
     * Get screenshot of a specific region as base64 string
     */
    async getScreenshotRegionBase64(x: number, y: number, width: number, height: number): Promise<string> {
        try {
            // Take screenshot of specific region using robotjs
            const screenshot = robotjs.screen.capture(x, y, width, height);
            
            // Convert to base64
            const imageBuffer = screenshot.image;
            const base64String = imageBuffer.toString('base64');
            
            this.logger.info('Region screenshot converted to base64', { 
                region: { x, y, width, height },
                size: imageBuffer.length,
                base64Length: base64String.length 
            });
            
            return base64String;
        } catch (error) {
            this.logger.error('Error getting region screenshot as base64', error);
            throw error;
        }
    }
}

export default RobotJsPlugin;
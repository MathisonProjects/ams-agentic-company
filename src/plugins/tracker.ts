import { Logger } from '../utils/logger';
import { exec } from 'child_process';

// Conditional import for robotjs - only available in non-Docker environments
let robotjs: any = null;
try {
    if (process.env['NODE_ENV'] !== 'docker') {
        robotjs = require('robotjs');
    }
} catch (error) {
    // robotjs not available, will use mock functions
}

// Conditional import for GlobalKeyboardListener
let GlobalKeyboardListener: any = null;
try {
    if (process.env['NODE_ENV'] !== 'docker') {
        GlobalKeyboardListener = require('node-global-key-listener').GlobalKeyboardListener;
    }
} catch (error) {
    // GlobalKeyboardListener not available in Docker
}

export interface TrackedEvent {
    type: 'leftClick' | 'rightClick' | 'doubleClick' | 'drag' | 'keyPress' | 'hotkey' | 'scroll';
    timestamp: number;
    data: any;
}

export interface ClickEvent {
    x: number;
    y: number;
}

export interface DragEvent {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

export interface KeyEvent {
    key: string;
    modifiers?: string[];
}

export interface HotkeyEvent {
    keys: string[];
}

export interface ScrollEvent {
    direction: 'up' | 'down' | 'left' | 'right';
    amount: number;
    x: number;
    y: number;
}

export class TrackerPlugin {
    private logger: Logger;
    private isTracking: boolean = false;
    private sequence: TrackedEvent[] = [];
    private lastMousePosition: { x: number; y: number } | null = null;
    private dragStartPosition: { x: number; y: number } | null = null;
    private mouseClickInterval: NodeJS.Timeout | null = null;
    private keyboardListener: any = null;
    private lastClickTime: number = 0;
    private clickCount: number = 0;
    private lastClickPosition: { x: number; y: number } | null = null;
    private lastKeyEvent: { key: string; state: string; timestamp: number } | null = null;
    private deduplicationWindow: number = 50; // 50ms window for deduplication
    private lastDragTime: number = 0;
    private isInScreenshotMode: boolean = false; // Track if we're in screenshot selection mode

    constructor() {
        this.logger = new Logger('Tracker');
    }

    /**
     * Start tracking user interactions
     */
    startTracking(): void {
        if (this.isTracking) {
            this.logger.warn('Tracking is already active');
            return;
        }

        this.sequence = [];
        this.isTracking = true;
        this.lastMousePosition = null;
        this.dragStartPosition = null;
        this.isInScreenshotMode = false; // Reset screenshot mode

        // Start monitoring mouse clicks
        this.startMouseTracking();
        
        // Start monitoring keyboard
        this.startKeyboardTracking();

        this.logger.info('Started tracking user interactions');
    }

    /**
     * Stop tracking and copy sequence to clipboard
     */
    async endTracking(): Promise<void> {
        if (!this.isTracking) {
            this.logger.warn('Tracking is not currently active');
            return;
        }

        this.isTracking = false;
        
        // Stop monitoring
        this.stopMouseTracking();
        this.stopKeyboardTracking();

        // Copy sequence to clipboard
        await this.copySequenceToClipboard();

        this.logger.info('Stopped tracking and copied sequence to clipboard', {
            eventCount: this.sequence.length
        });
    }

    /**
     * Get current tracking status
     */
    getTrackingStatus(): {
        isTracking: boolean;
        eventCount: number;
        lastEvent?: TrackedEvent;
    } {
        const result: {
            isTracking: boolean;
            eventCount: number;
            lastEvent?: TrackedEvent;
        } = {
            isTracking: this.isTracking,
            eventCount: this.sequence.length
        };
        
        if (this.sequence.length > 0) {
            result.lastEvent = this.sequence[this.sequence.length - 1]!;
        }
        
        return result;
    }

    /**
     * Get the current sequence
     */
    getSequence(): TrackedEvent[] {
        return [...this.sequence];
    }

    /**
     * Clear the current sequence
     */
    clearSequence(): void {
        this.sequence = [];
        this.logger.info('Sequence cleared');
    }

    /**
     * Start monitoring mouse clicks and drags
     */
    private startMouseTracking(): void {
        if (!robotjs) {
            this.logger.warn('Mouse tracking not available - RobotJS not loaded');
            return;
        }

        this.mouseClickInterval = setInterval(() => {
            if (!this.isTracking || !robotjs) return;

            const currentPosition = robotjs.getMousePos();
            
            // Track mouse movement for drag detection
            if (this.lastMousePosition) {
                const distance = Math.sqrt(
                    Math.pow(currentPosition.x - this.lastMousePosition.x, 2) +
                    Math.pow(currentPosition.y - this.lastMousePosition.y, 2)
                );

                // If we have a drag start position and mouse is moving significantly, record drag
                if (this.dragStartPosition && distance > 2) {
                    // Update the drag end position
                    this.lastMousePosition = currentPosition;
                    
                    // Record drag event if we haven't recorded one recently
                    const timeSinceLastDrag = Date.now() - (this.lastDragTime || 0);
                    if (timeSinceLastDrag > 100) { // Record drag every 100ms
                        this.recordDragEvent();
                        this.lastDragTime = Date.now();
                    }
                }
            }

            this.lastMousePosition = currentPosition;
        }, 16); // Check every 16ms (60fps) for more responsive detection
    }

    /**
     * Stop monitoring mouse clicks
     */
    private stopMouseTracking(): void {
        if (this.mouseClickInterval) {
            clearInterval(this.mouseClickInterval);
            this.mouseClickInterval = null;
        }
    }

    /**
     * Start monitoring keyboard
     */
    private startKeyboardTracking(): void {
        try {
            if (!GlobalKeyboardListener) {
                this.logger.warn('GlobalKeyboardListener not available - running in Docker mode');
                return;
            }
            
            this.keyboardListener = new GlobalKeyboardListener();
            
            // need to deprecate down - it looks to always be true
            // when logged, down always returns {'MOUSE LEFT': true}
            this.keyboardListener.addListener((e: any, down: any) => {
                if (!this.isTracking) return;
                
                const currentPosition = robotjs ? robotjs.getMousePos() : { x: 0, y: 0 };
                const keyName = e.name || '';
                const keyState = e.state || '';
                // Handle mouse clicks
                if (keyName === 'MOUSE LEFT') {
                    if (keyState === "DOWN") {
                        // Left mouse button pressed - potential drag start
                        this.lastClickTime = Date.now();
                        this.lastClickPosition = currentPosition;
                        this.dragStartPosition = currentPosition; // Set drag start position
                        this.clickCount++;
                        
                        if (this.isInScreenshotMode) {
                            this.logger.debug('Screenshot selection started', { x: currentPosition.x, y: currentPosition.y });
                        } else {
                            this.logger.debug('Mouse button pressed - potential drag start', { x: currentPosition.x, y: currentPosition.y });
                        }
                    } else if (keyState === 'UP') {
                        // Left mouse button released - check if it was a drag or click
                        if (this.dragStartPosition) {
                            const distance = Math.sqrt(
                                Math.pow(currentPosition.x - this.dragStartPosition.x, 2) +
                                Math.pow(currentPosition.y - this.dragStartPosition.y, 2)
                            );
                            
                            // Require both distance AND minimum time for intentional drag
                            const timeSinceDown = Date.now() - this.lastClickTime;
                            const isIntentionalDrag = distance > 15 && timeSinceDown > 100;

                            if (isIntentionalDrag) { // Prevent accidental micro-movement drags
                                // This was a drag - record final drag event
                                this.recordDragEvent();
                                
                                if (this.isInScreenshotMode) {
                                    this.logger.debug('Screenshot selection completed', { 
                                        startX: this.dragStartPosition.x, 
                                        startY: this.dragStartPosition.y,
                                        endX: currentPosition.x, 
                                        endY: currentPosition.y 
                                    });
                                    // Exit screenshot mode after selection
                                    this.isInScreenshotMode = false;
                                } else {
                                    this.logger.debug('Drag completed', { 
                                        startX: this.dragStartPosition.x, 
                                        startY: this.dragStartPosition.y,
                                        endX: currentPosition.x, 
                                        endY: currentPosition.y 
                                    });
                                }
                            } else {
                                // This was a click - check for double click
                                if (this.clickCount === 2 && this.lastClickPosition) {
                                    const timeDiff = Date.now() - this.lastClickTime;
                                    const clickDistance = Math.sqrt(
                                        Math.pow(currentPosition.x - this.lastClickPosition.x, 2) +
                                        Math.pow(currentPosition.y - this.lastClickPosition.y, 2)
                                    );
                                    
                                    if (timeDiff < 500 && clickDistance < 10) {
                                        // Double click detected
                                        this.recordDoubleClick(currentPosition.x, currentPosition.y);
                                        this.logger.debug('Double click detected', { x: currentPosition.x, y: currentPosition.y });
                                        this.clickCount = 0;
                                    } else {
                                        // Single click
                                        this.recordLeftClick(currentPosition.x, currentPosition.y);
                                        this.logger.debug('Left click detected', { x: currentPosition.x, y: currentPosition.y });
                                        this.clickCount = 1;
                                    }
                                } else {
                                    // Single click
                                    this.recordLeftClick(currentPosition.x, currentPosition.y);
                                    this.logger.debug('Left click detected', { x: currentPosition.x, y: currentPosition.y });
                                }
                            }
                            
                            // Reset drag state
                            this.dragStartPosition = null;
                        }
                    }
                } else if (keyName === 'MOUSE RIGHT') {
                    if (down && e.state === 'DOWN') {
                        // Right mouse button pressed
                        this.recordRightClick(currentPosition.x, currentPosition.y);
                        this.logger.debug('Right click detected', { x: currentPosition.x, y: currentPosition.y });
                    }
                } else if (keyName.includes('WHEEL') || keyName.includes('SCROLL')) {
                    if (down) {
                        // Handle scroll events
                        if (keyName.includes('UP')) {
                            this.recordScrollEvent('up', 1, currentPosition.x, currentPosition.y);
                            this.logger.debug('Scroll up detected', { x: currentPosition.x, y: currentPosition.y });
                        } else if (keyName.includes('DOWN')) {
                            this.recordScrollEvent('down', 1, currentPosition.x, currentPosition.y);
                            this.logger.debug('Scroll down detected', { x: currentPosition.x, y: currentPosition.y });
                        } else if (keyName.includes('LEFT')) {
                            this.recordScrollEvent('left', 1, currentPosition.x, currentPosition.y);
                            this.logger.debug('Scroll left detected', { x: currentPosition.x, y: currentPosition.y });
                        } else if (keyName.includes('RIGHT')) {
                            this.recordScrollEvent('right', 1, currentPosition.x, currentPosition.y);
                            this.logger.debug('Scroll right detected', { x: currentPosition.x, y: currentPosition.y });
                        }
                    }
                } else if (down && keyName) {
                    // Regular key press with deduplication
                    if (this.isDuplicateKeyEvent(keyName, e.state)) {
                        this.logger.debug('Duplicate key event ignored', { key: keyName, state: e.state });
                        return;
                    }
                    
                    const modifiers = e.state ? [e.state] : undefined;
                    this.recordKeyPress(keyName, modifiers);
                    this.logger.debug('Key press detected', { key: keyName, modifiers: e.state });
                    
                    // Check if we're entering screenshot mode (Cmd+Shift+4)
                    if (keyName === '4' && modifiers && modifiers.includes('DOWN')) {
                        // Check if command and shift are active (we'll detect this from the sequence)
                        const recentEvents = this.sequence.slice(-10); // Check last 10 events
                        const hasCommand = recentEvents.some(event => 
                            event.type === 'keyPress' && 
                            event.data.key === 'command' && 
                            event.data.modifiers?.includes('DOWN')
                        );
                        const hasShift = recentEvents.some(event => 
                            event.type === 'keyPress' && 
                            event.data.key === 'shift' && 
                            event.data.modifiers?.includes('DOWN')
                        );
                        
                        if (hasCommand && hasShift) {
                            this.isInScreenshotMode = true;
                            this.logger.info('Screenshot mode activated - will track selection drag');
                        }
                    }
                }
            });
            
            this.logger.info('Keyboard listener started');
        } catch (error) {
            this.logger.warn('Failed to start keyboard listener (this is normal on macOS without permissions)', error);
            this.logger.info('Keyboard events will not be automatically captured, but manual recording is still available');
        }
    }

    /**
     * Stop monitoring keyboard
     */
    private stopKeyboardTracking(): void {
        if (this.keyboardListener) {
            // The GlobalKeyboardListener doesn't have a removeListener method
            // We'll just set it to null and let it be garbage collected
            this.keyboardListener = null;
            this.logger.info('Keyboard listener stopped');
        }
    }

    /**
     * Record a left click event
     */
    recordLeftClick(x: number, y: number): void {
        if (!this.isTracking) return;

        const event: TrackedEvent = {
            type: 'leftClick',
            timestamp: Date.now(),
            data: { x, y } as ClickEvent
        };

        this.sequence.push(event);
        this.logger.debug('Recorded left click', { x, y });
    }

    /**
     * Record a right click event
     */
    recordRightClick(x: number, y: number): void {
        if (!this.isTracking) return;

        const event: TrackedEvent = {
            type: 'rightClick',
            timestamp: Date.now(),
            data: { x, y } as ClickEvent
        };

        this.sequence.push(event);
        this.logger.debug('Recorded right click', { x, y });
    }

    /**
     * Record a double click event
     */
    recordDoubleClick(x: number, y: number): void {
        if (!this.isTracking) return;

        const event: TrackedEvent = {
            type: 'doubleClick',
            timestamp: Date.now(),
            data: { x, y } as ClickEvent
        };

        this.sequence.push(event);
        this.logger.debug('Recorded double click', { x, y });
    }

    /**
     * Record a drag event
     */
    recordDragEvent(): void {
        if (!this.isTracking || !this.dragStartPosition || !this.lastMousePosition) return;

        const event: TrackedEvent = {
            type: 'drag',
            timestamp: Date.now(),
            data: {
                startX: this.dragStartPosition.x,
                startY: this.dragStartPosition.y,
                endX: this.lastMousePosition.x,
                endY: this.lastMousePosition.y
            } as DragEvent
        };

        this.sequence.push(event);
        this.logger.debug('Recorded drag event', event.data);
        
        // Reset drag state
        this.dragStartPosition = null;
    }

    /**
     * Check if a key event is a duplicate
     */
    private isDuplicateKeyEvent(key: string, state: string): boolean {
        const now = Date.now();
        
        if (this.lastKeyEvent && 
            this.lastKeyEvent.key === key && 
            this.lastKeyEvent.state === state &&
            (now - this.lastKeyEvent.timestamp) < this.deduplicationWindow) {
            return true;
        }
        
        // Update last key event
        this.lastKeyEvent = { key, state, timestamp: now };
        return false;
    }

    /**
     * Remove duplicate key events from a sequence
     */
    private removeDuplicateKeyEvents(events: TrackedEvent[]): TrackedEvent[] {
        const result: TrackedEvent[] = [];
        const seen: { [key: string]: number } = {};
        
        for (const event of events) {
            if (event.type === 'keyPress') {
                const key = event.data.key;
                const modifiers = event.data.modifiers || [];
                const state = modifiers.includes('DOWN') ? 'DOWN' : modifiers.includes('UP') ? 'UP' : 'NONE';
                const eventKey = `${key}-${state}`;
                
                // Check if we've seen this exact key-state combination recently
                if (seen[eventKey] && (event.timestamp - (seen[eventKey] || 0)) < this.deduplicationWindow) {
                    this.logger.debug('Removing duplicate key event', { key, state, timestamp: event.timestamp });
                    continue;
                }
                
                seen[eventKey] = event.timestamp;
            }
            
            result.push(event);
        }
        
        this.logger.info(`Removed ${events.length - result.length} duplicate key events`);
        return result;
    }

    /**
     * Record a key press event
     */
    recordKeyPress(key: string, modifiers?: string[]): void {
        if (!this.isTracking) return;

        const event: TrackedEvent = {
            type: 'keyPress',
            timestamp: Date.now(),
            data: { key, modifiers } as KeyEvent
        };

        this.sequence.push(event);
        this.logger.debug('Recorded key press', { key, modifiers });
    }

    /**
     * Record a hotkey event
     */
    recordHotkey(keys: string[]): void {
        if (!this.isTracking) return;

        const event: TrackedEvent = {
            type: 'hotkey',
            timestamp: Date.now(),
            data: { keys } as HotkeyEvent
        };

        this.sequence.push(event);
        this.logger.debug('Recorded hotkey', { keys });
    }

    /**
     * Record a scroll event
     */
    recordScrollEvent(direction: 'up' | 'down' | 'left' | 'right', amount: number, x: number, y: number): void {
        if (!this.isTracking) return;

        const event: TrackedEvent = {
            type: 'scroll',
            timestamp: Date.now(),
            data: { direction, amount, x, y } as ScrollEvent
        };

        this.sequence.push(event);
        this.logger.debug('Recorded scroll event', event.data);
    }

    /**
     * Manually record a left click (for testing)
     */
    manualRecordLeftClick(x?: number, y?: number): void {
        if (!this.isTracking) return;

        const position = x !== undefined && y !== undefined ? { x, y } : (robotjs ? robotjs.getMousePos() : { x: 0, y: 0 });
        this.recordLeftClick(position.x, position.y);
        this.logger.info('Manually recorded left click', { x: position.x, y: position.y });
    }

    /**
     * Manually record a right click (for testing)
     */
    manualRecordRightClick(x?: number, y?: number): void {
        if (!this.isTracking) return;

        const position = x !== undefined && y !== undefined ? { x, y } : (robotjs ? robotjs.getMousePos() : { x: 0, y: 0 });
        this.recordRightClick(position.x, position.y);
        this.logger.info('Manually recorded right click', { x: position.x, y: position.y });
    }

    /**
     * Manually record a key press (for testing)
     */
    manualRecordKeyPress(key: string, modifiers?: string[]): void {
        if (!this.isTracking) return;

        this.recordKeyPress(key, modifiers);
        this.logger.info('Manually recorded key press', { key, modifiers });
    }

    /**
     * Manually record a scroll event (for testing)
     */
    manualRecordScroll(direction: 'up' | 'down' | 'left' | 'right', amount: number = 1): void {
        if (!this.isTracking) return;

        const position = robotjs ? robotjs.getMousePos() : { x: 0, y: 0 };
        this.recordScrollEvent(direction, amount, position.x, position.y);
        this.logger.info('Manually recorded scroll event', { direction, amount, x: position.x, y: position.y });
    }

    /**
     * Manually record a double click (for testing)
     */
    manualRecordDoubleClick(x?: number, y?: number): void {
        if (!this.isTracking) return;

        const position = x !== undefined && y !== undefined ? { x, y } : (robotjs ? robotjs.getMousePos() : { x: 0, y: 0 });
        this.recordDoubleClick(position.x, position.y);
        this.logger.info('Manually recorded double click', { x: position.x, y: position.y });
    }

    /**
     * Convert tracker sequence to plan executor format with preserved timing
     */
    convertToPlanFormat(): any {
        if (this.sequence.length === 0) {
            return null;
        }

        // RACE CONDITION FIX: Don't sort by timestamp - preserve recording order
        // The sequence array already represents the chronological order of user actions
        const eventsInRecordOrder = [...this.sequence];

        if (eventsInRecordOrder.length === 0) {
            return null;
        }

        // Remove duplicate key events
        const deduplicatedEvents = this.removeDuplicateKeyEvents(eventsInRecordOrder);
        
        // Calculate relative timing from the first event
        const startTime = deduplicatedEvents[0]?.timestamp || 0;
        const eventsWithRelativeTiming = deduplicatedEvents.map(event => ({
            type: event.type,
            timestamp: event.timestamp,
            relativeTime: event.timestamp - startTime, // Time since recording started
            data: event.data
        }));

        // Convert to plan format with timing information
        const plan = {
            key: `recorded-sequence-${Date.now()}`,
            startTime: startTime,
            totalDuration: deduplicatedEvents[deduplicatedEvents.length - 1]?.timestamp ? 
                (deduplicatedEvents[deduplicatedEvents.length - 1]?.timestamp || 0) - startTime : 0,
            plan: [eventsWithRelativeTiming] // Single step with all events and timing
        };

        return plan;
    }

    /**
     * Copy sequence to clipboard
     */
    private async copySequenceToClipboard(): Promise<void> {
        try {
            // Convert to plan format and copy both formats
            const planFormat = this.convertToPlanFormat();
            const sequenceJson = JSON.stringify(this.sequence, null, 2);
            const planJson = planFormat ? JSON.stringify(planFormat, null, 2) : '';
            
            // Use system clipboard command
            const platform = process.platform;
            let command: string;

            const clipboardContent = planFormat ? 
                `// Plan Format (for execution):\n${planJson}\n\n// Raw Sequence Format:\n${sequenceJson}` :
                sequenceJson;

            if (platform === 'darwin') {
                // macOS
                command = `echo '${clipboardContent.replace(/'/g, "'\\''")}' | pbcopy`;
            } else if (platform === 'win32') {
                // Windows
                command = `echo '${clipboardContent.replace(/'/g, "''")}' | clip`;
            } else {
                // Linux
                command = `echo '${clipboardContent.replace(/'/g, "'\\''")}' | xclip -selection clipboard`;
            }

            exec(command, (error) => {
                if (error) {
                    this.logger.error('Failed to copy sequence to clipboard', error);
                } else {
                    this.logger.info('Sequence copied to clipboard successfully');
                }
            });
        } catch (error) {
            this.logger.error('Error copying sequence to clipboard', error);
        }
    }

    /**
     * Export sequence to file
     */
    async exportSequenceToFile(filename?: string): Promise<string> {
        try {
            const fs = require('fs');
            const path = require('path');
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const sequenceName = filename || `sequence-${timestamp}.json`;
            const sequencePath = path.join(process.cwd(), 'src', 'tmp', sequenceName);
            
            const sequenceJson = JSON.stringify(this.sequence, null, 2);
            fs.writeFileSync(sequencePath, sequenceJson);
            
            this.logger.info('Sequence exported to file', { 
                filename: sequenceName, 
                path: sequencePath,
                eventCount: this.sequence.length 
            });
            
            return sequencePath;
        } catch (error) {
            this.logger.error('Error exporting sequence to file', error);
            throw error;
        }
    }

    /**
     * Load sequence from file
     */
    async loadSequenceFromFile(filepath: string): Promise<void> {
        try {
            const fs = require('fs');
            const sequenceJson = fs.readFileSync(filepath, 'utf8');
            this.sequence = JSON.parse(sequenceJson);
            
            this.logger.info('Sequence loaded from file', { 
                filepath,
                eventCount: this.sequence.length 
            });
        } catch (error) {
            this.logger.error('Error loading sequence from file', error);
            throw error;
        }
    }

    /**
     * Replay a sequence of events
     */
    async replaySequence(sequence?: TrackedEvent[]): Promise<void> {
        const eventsToReplay = sequence || this.sequence;
        
        if (eventsToReplay.length === 0) {
            this.logger.warn('No events to replay');
            return;
        }

        this.logger.info('Starting sequence replay', { eventCount: eventsToReplay.length });

        for (const event of eventsToReplay) {
            try {
                await this.replayEvent(event);
                // Add a small delay between events
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                this.logger.error('Error replaying event', { event, error });
            }
        }

        this.logger.info('Sequence replay completed');
    }

    /**
     * Replay a single event
     */
    private async replayEvent(event: TrackedEvent): Promise<void> {
        if (!robotjs) {
            this.logger.warn(`Mock replay: ${event.type} event`);
            return;
        }

        switch (event.type) {
            case 'leftClick':
                const clickData = event.data as ClickEvent;
                await robotjs.moveMouse(clickData.x, clickData.y);
                robotjs.mouseClick();
                break;
                
            case 'rightClick':
                const rightClickData = event.data as ClickEvent;
                await robotjs.moveMouse(rightClickData.x, rightClickData.y);
                robotjs.mouseClick('right');
                break;
                
            case 'doubleClick':
                const doubleClickData = event.data as ClickEvent;
                await robotjs.moveMouse(doubleClickData.x, doubleClickData.y);
                robotjs.mouseClick('left', true);
                break;
                
            case 'keyPress':
                const keyData = event.data as KeyEvent;
                if (keyData.modifiers && keyData.modifiers.length > 0) {
                    robotjs.keyTap(keyData.key, keyData.modifiers);
                } else {
                    robotjs.keyTap(keyData.key);
                }
                break;
                
            case 'hotkey':
                const hotkeyData = event.data as HotkeyEvent;
                // Handle hotkey combinations
                if (hotkeyData.keys.length === 2) {
                    const key1 = hotkeyData.keys[0];
                    const key2 = hotkeyData.keys[1];
                    if (key1 && key2) {
                        robotjs.keyTap(key2, key1);
                    }
                } else if (hotkeyData.keys.length === 3) {
                    const key1 = hotkeyData.keys[0];
                    const key2 = hotkeyData.keys[1];
                    const key3 = hotkeyData.keys[2];
                    if (key1 && key2 && key3) {
                        robotjs.keyTap(key3, [key1, key2]);
                    }
                }
                break;
                
            case 'scroll':
                const scrollData = event.data as ScrollEvent;
                await robotjs.moveMouse(scrollData.x, scrollData.y);
                if (scrollData.direction === 'up') {
                    robotjs.scrollMouse(0, scrollData.amount);
                } else if (scrollData.direction === 'down') {
                    robotjs.scrollMouse(0, -scrollData.amount);
                } else if (scrollData.direction === 'left') {
                    robotjs.scrollMouse(-scrollData.amount, 0);
                } else if (scrollData.direction === 'right') {
                    robotjs.scrollMouse(scrollData.amount, 0);
                }
                break;
                
            default:
                this.logger.warn('Unknown event type for replay', { type: event.type });
        }
    }
}

export default TrackerPlugin;
import { Logger } from '../utils/logger';

// Conditional import for robotjs - only available in non-Docker environments
let robotjs: any = null;
try {
    if (process.env['NODE_ENV'] !== 'docker') {
        robotjs = require('robotjs');
    }
} catch (error) {
    // robotjs not available, will use mock functions
}

interface PlanEvent {
    type: 'leftClick' | 'rightClick' | 'doubleClick' | 'drag' | 'keyPress' | 'scroll';
    timestamp: number;
    relativeTime?: number; // Time since recording started
    data: {
        x?: number;
        y?: number;
        startX?: number;
        startY?: number;
        endX?: number;
        endY?: number;
        key?: string;
        modifiers?: string[];
        direction?: string;
        amount?: number;
    };
}

interface Plan {
    key: string;
    startTime?: number;
    totalDuration?: number;
    plan: PlanEvent[][];
    repetitions?: number;
}

class PlanExecutor {
    private logger: Logger;
    private isExecuting: boolean = false;
    private currentPlan: Plan | null = null;
    private executionSpeed: number = 1.0; // 1.0 = real time, 2.0 = 2x speed, etc.
    private activeModifiers: Set<string> = new Set(); // Track active modifier keys
    private repetitions: number = 0; // Track repetitions

    constructor() {
        this.logger = new Logger('PlanExecutor');
        
        if (robotjs) {
            // Set robotjs delays for more human-like execution
            robotjs.setMouseDelay(2);
            robotjs.setKeyboardDelay(100);
            this.logger.info('PlanExecutor initialized with RobotJS');
        } else {
            this.logger.warn('PlanExecutor running in Docker mode with mock functions');
        }
    }

    /**
     * Execute a plan from a department config
     */
    async executePlan(plan: Plan, speed: number = 1.0, repetitions: number = 0): Promise<boolean> {
        // RACE CONDITION: No synchronization if multiple executePlan calls occur simultaneously
        if (this.isExecuting) {
            this.logger.warn('Plan execution already in progress');
            return false;
        }

        this.isExecuting = true;
        this.currentPlan = plan;
        this.executionSpeed = speed;
        this.repetitions = repetitions;

        // Reset modifier key states
        this.activeModifiers.clear();

        try {
            this.logger.info(`Starting plan execution: ${plan.key}`);
            
            // Check if this is a recorded sequence with timing information
            const hasTimingInfo = plan.startTime !== undefined && plan.totalDuration !== undefined;
            
            if (hasTimingInfo) {
                this.logger.info(`Executing recorded sequence with timing (duration: ${plan.totalDuration}ms, speed: ${speed}x)`);
                await this.executeRecordedSequence(plan, speed, repetitions);
            } else {
                this.logger.info('Executing plan with fixed timing');
                // Execute each step in the plan (legacy format)
                for (let stepIndex = 0; stepIndex < plan.plan.length; stepIndex++) {
                    const step = plan.plan[stepIndex];
                    if (step) {
                        this.logger.info(`Executing step ${stepIndex + 1}/${plan.plan.length} with ${step.length} events`);
                        
                        await this.executeStep(step);
                        
                        // Add delay between steps if not the last step
                        if (stepIndex < plan.plan.length - 1) {
                            await this.delay(1000 / this.executionSpeed);
                        }
                    }
                }
            }

            this.logger.info(`Plan execution completed: ${plan.key}`);
            return true;
        } catch (error) {
            this.logger.error('Plan execution failed', error);
            return false;
        } finally {
            this.isExecuting = false;
            this.currentPlan = null;
        }
    }

    /**
     * Execute a recorded sequence with preserved timing
     */
    private async executeRecordedSequence(plan: Plan, speed: number, repetitions: number): Promise<void> {
        if (plan.plan.length === 0 || !plan.plan[0] || plan.plan[0].length === 0) {
            this.logger.warn('No events to execute in recorded sequence');
            return;
        }

        const events = plan.plan[0]; // All events are in the first step for recorded sequences
        if (!events) {
            this.logger.warn('No events array found in recorded sequence');
            return;
        }

        this.repetitions = repetitions;

        // Events should already be in chronological order from tracker
        const startTime = Date.now();

        this.logger.info(`Executing ${events.length} events with preserved timing`);

        this.logger.info(`Executing ${repetitions} repetitions`);

        // go through each repetition, default of 0 so that it only runs once
        for (let i = 0; i < repetitions; i++) {
            // -1 to prevent accidental start of new sequence recording
            for (let i = 0; i < events.length - 1; i++) {
                const event = events[i];
                if (!event) continue;
    
                const nextEvent = events[i + 1];
                // Execute the current event
                await this.executeEvent(event);
    
                // Calculate delay to next event based on relative timing
                if (nextEvent && event.relativeTime !== undefined && nextEvent.relativeTime !== undefined) {
                    const timeToNextEvent = (nextEvent.relativeTime - event.relativeTime) / speed;
    
                    if (timeToNextEvent > 0) {
                        this.logger.debug(`Waiting ${timeToNextEvent}ms before next event`);
                        await this.delay(timeToNextEvent);
                    }
                } else if (i < events.length - 1) {
                    // RACE CONDITION: Fixed 100ms delay may not account for varying event completion times
                    await this.delay(100 / speed);
                }
            }
            
            const executionTime = Date.now() - startTime;
            this.logger.info(`Recorded sequence execution completed in ${executionTime}ms`);
        }

    }

    /**
     * Execute a single step (array of events)
     */
    private async executeStep(events: PlanEvent[]): Promise<void> {
        for (const event of events) {
            await this.executeEvent(event);
            
            // Add small delay between events for more human-like behavior
            await this.delay(50 / this.executionSpeed);
        }
    }

    /**
     * Execute a single event
     */
    private async executeEvent(event: PlanEvent): Promise<void> {
        try {
            switch (event.type) {
                case 'leftClick':
                    await this.executeLeftClick(event);
                    break;
                case 'rightClick':
                    await this.executeRightClick(event);
                    break;
                case 'doubleClick':
                    await this.executeDoubleClick(event);
                    break;
                case 'drag':
                    await this.executeDrag(event);
                    break;
                case 'keyPress':
                    await this.executeKeyPress(event);
                    break;
                case 'scroll':
                    await this.executeScroll(event);
                    break;
                default:
                    this.logger.warn(`Unknown event type: ${event.type}`);
            }
        } catch (error) {
            this.logger.error(`Failed to execute event: ${event.type}`, error);
        }
    }

    /**
     * Execute left click event with natural mouse movement
     */
    private async executeLeftClick(event: PlanEvent): Promise<void> {
        if (!robotjs) {
            this.logger.info(`Mock: Left click at (${event.data.x}, ${event.data.y})`);
            return;
        }
        
        if (event.data.x !== undefined && event.data.y !== undefined) {
            this.logger.debug(`Left click at (${event.data.x}, ${event.data.y})`);
            
            // Move mouse to target position with human-like movement
            await this.moveMouseHumanLike(event.data.x, event.data.y);
            
            // Natural human-like delay before clicking (200-400ms)
            const hoverDelay = this.getRandomDelay(200, 400);
            this.logger.debug(`Hovering for ${hoverDelay}ms before clicking`);
            await this.delay(hoverDelay / this.executionSpeed);
            
            // Perform the click
            robotjs.mouseClick('left');
        }
    }

    /**
     * Execute right click event with natural mouse movement
     */
    private async executeRightClick(event: PlanEvent): Promise<void> {
        if (!robotjs) {
            this.logger.info(`Mock: Right click at (${event.data.x}, ${event.data.y})`);
            return;
        }
        
        if (event.data.x !== undefined && event.data.y !== undefined) {
            this.logger.debug(`Right click at (${event.data.x}, ${event.data.y})`);
            
            // Move mouse to target position with human-like movement
            await this.moveMouseHumanLike(event.data.x, event.data.y);
            
            // Natural human-like delay before clicking (200-400ms)
            const hoverDelay = this.getRandomDelay(200, 400);
            this.logger.debug(`Hovering for ${hoverDelay}ms before right clicking`);
            await this.delay(hoverDelay / this.executionSpeed);
            
            // Perform the click
            robotjs.mouseClick('right');
        }
    }

    /**
     * Execute double click event with natural mouse movement
     */
    private async executeDoubleClick(event: PlanEvent): Promise<void> {
        if (!robotjs) {
            this.logger.info(`Mock: Double click at (${event.data.x}, ${event.data.y})`);
            return;
        }
        
        if (event.data.x !== undefined && event.data.y !== undefined) {
            this.logger.debug(`Double click at (${event.data.x}, ${event.data.y})`);
            
            // Move mouse to target position with human-like movement
            await this.moveMouseHumanLike(event.data.x, event.data.y);
            
            // Natural human-like delay before double clicking (300-500ms)
            const hoverDelay = this.getRandomDelay(300, 500);
            this.logger.debug(`Hovering for ${hoverDelay}ms before double clicking`);
            await this.delay(hoverDelay / this.executionSpeed);
            
            // Perform the double click
            robotjs.mouseClick('left', true); // true = double click
        }
    }

    /**
     * Execute drag event with natural mouse movement
     */
    private async executeDrag(event: PlanEvent): Promise<void> {
        if (!robotjs) {
            this.logger.info(`Mock: Drag from (${event.data.startX}, ${event.data.startY}) to (${event.data.endX}, ${event.data.endY})`);
            return;
        }
        
        if (event.data.startX !== undefined && event.data.startY !== undefined && 
            event.data.endX !== undefined && event.data.endY !== undefined) {
            
            this.logger.debug(`Drag from (${event.data.startX}, ${event.data.startY}) to (${event.data.endX}, ${event.data.endY})`);
            
            // Move to start position with human-like movement
            await this.moveMouseHumanLike(event.data.startX, event.data.startY);
            
            // Longer delay before starting drag for more reliable detection
            await this.delay(200 / this.executionSpeed);
            
            // Press and hold mouse button
            robotjs.mouseToggle('down', 'left');

            // Small delay to ensure button press is registered
            await this.delay(50 / this.executionSpeed);

            // Move to end position while holding with more gradual movement
            await this.moveMouseHumanLike(event.data.startX, event.data.startY);

            // Small delay before releasing
            await this.delay(100 / this.executionSpeed);

            // RACE CONDITION: No verification that drag completed before releasing button
            robotjs.mouseToggle('up', 'left');
            
            // Additional delay after drag completion
            await this.delay(100 / this.executionSpeed);
        }
    }

    /**
     * Execute key press event with improved modifier handling
     */
    private async executeKeyPress(event: PlanEvent): Promise<void> {
        if (!robotjs) {
            this.logger.info(`Mock: Key press ${event.data.key} with modifiers: ${event.data.modifiers?.join(', ') || 'none'}`);
            return;
        }

        if (event.data.key) {
            const key = this.normalizeKey(event.data.key);
            const modifiers = event.data.modifiers || [];

            this.logger.debug(`Key press: ${key} with modifiers: ${modifiers.join(', ')}`);

            try {
                // Handle modifier key states
                if (modifiers.includes('DOWN')) {
                    // Key press
                    if (this.isModifierKey(key)) {
                        // RACE CONDITION: activeModifiers Set not thread-safe for concurrent access
                        this.activeModifiers.add(key);
                        this.logger.debug(`Modifier key pressed: ${key} (active: ${Array.from(this.activeModifiers).join(', ')})`);
                    } else {
                        // Press key with active modifiers
                        const activeModifierArray = Array.from(this.activeModifiers);
                        if (activeModifierArray.length > 0) {
                            this.logger.debug(`Pressing key combination: ${activeModifierArray.join('+')}+${key}`);
                            robotjs.keyTap(key, activeModifierArray);
                        } else {
                            this.logger.debug(`Pressing key: ${key}`);
                            robotjs.keyTap(key);
                        }
                    }
                } else if (modifiers.includes('UP')) {
                    // Key release
                    if (this.isModifierKey(key)) {
                        // RACE CONDITION: activeModifiers Set not thread-safe for concurrent access
                        this.activeModifiers.delete(key);
                        this.logger.debug(`Modifier key released: ${key} (active: ${Array.from(this.activeModifiers).join(', ')})`);
                    } else {
                        this.logger.debug(`Key release: ${key}`);
                    }
                } else {
                    // No modifiers specified, just press the key
                    this.logger.debug(`Pressing key: ${key}`);
                    robotjs.keyTap(key);
                }
            } catch (error) {
                this.logger.error(`Failed to execute event: keyPress`, error);
                // Continue execution even if one key fails
            }
        }
    }

    /**
     * Check if a key is a modifier key
     */
    private isModifierKey(key: string): boolean {
        const modifierKeys = ['shift', 'control', 'alt', 'command', 'meta', 'cmd'];
        return modifierKeys.includes(key.toLowerCase());
    }

    /**
     * Execute scroll event
     */
    private async executeScroll(event: PlanEvent): Promise<void> {
        if (!robotjs) {
            this.logger.info(`Mock: Scroll ${event.data.direction} by ${event.data.amount}`);
            return;
        }
        
        if (event.data.direction && event.data.amount) {
            this.logger.debug(`Scroll ${event.data.direction} by ${event.data.amount}`);
            
            const direction = event.data.direction.toLowerCase();
            const amount = event.data.amount;
            
            if (direction === 'up') {
                robotjs.scrollMouse(0, -amount);
            } else if (direction === 'down') {
                robotjs.scrollMouse(0, amount);
            } else if (direction === 'left') {
                robotjs.scrollMouse(-amount, 0);
            } else if (direction === 'right') {
                robotjs.scrollMouse(amount, 0);
            }
        }
    }

    /**
     * Normalize key names for robotjs compatibility
     */
    private normalizeKey(key: string): string {
        const keyMap: { [key: string]: string } = {
            // Basic keys
            'SPACE': 'space',
            'RETURN': 'enter',
            'ENTER': 'enter',
            'BACKSPACE': 'backspace',
            'DELETE': 'delete',
            'TAB': 'tab',
            'ESCAPE': 'escape',
            'HOME': 'home',
            'END': 'end',
            'PAGE UP': 'pageup',
            'PAGE DOWN': 'pagedown',
            'INSERT': 'insert',
            'PRINT SCREEN': 'printscreen',
            'SCROLL LOCK': 'scrolllock',
            'PAUSE': 'pause',
            'BREAK': 'pause',
            
            // Function keys
            'F1': 'f1', 'F2': 'f2', 'F3': 'f3', 'F4': 'f4',
            'F5': 'f5', 'F6': 'f6', 'F7': 'f7', 'F8': 'f8',
            'F9': 'f9', 'F10': 'f10', 'F11': 'f11', 'F12': 'f12',
            
            // Lock keys
            'NUM LOCK': 'numlock',
            'CAPS LOCK': 'capslock',
            
            // Modifier keys - handle both GlobalKeyboardListener and robotjs formats
            'LEFT SHIFT': 'shift', 'RIGHT SHIFT': 'shift', 'SHIFT': 'shift',
            'LEFT CTRL': 'control', 'RIGHT CTRL': 'control', 'CTRL': 'control', 'CONTROL': 'control',
            'LEFT ALT': 'alt', 'RIGHT ALT': 'alt', 'ALT': 'alt',
            'LEFT META': 'command', 'RIGHT META': 'command', 'META': 'command', 'COMMAND': 'command',
            'CMD': 'command', 'LEFT CMD': 'command', 'RIGHT CMD': 'command',
            
            // Special characters
            'FORWARD SLASH': '/', 'BACK SLASH': '\\',
            'QUESTION MARK': '?', 'EXCLAMATION MARK': '!',
            'AT SYMBOL': '@', 'HASH': '#', 'DOLLAR SIGN': '$',
            'PERCENT': '%', 'CARET': '^', 'AMPERSAND': '&',
            'ASTERISK': '*', 'LEFT PARENTHESIS': '(', 'RIGHT PARENTHESIS': ')',
            'UNDERSCORE': '_', 'PLUS': '+', 'MINUS': '-', 'EQUALS': '=',
            'LEFT BRACKET': '[', 'RIGHT BRACKET': ']',
            'LEFT BRACE': '{', 'RIGHT BRACE': '}',
            'PIPE': '|', 'SEMICOLON': ';', 'COLON': ':',
            'QUOTE': "'", 'DOUBLE QUOTE': '"', 'COMMA': ',',
            'PERIOD': '.', 'DOT': '.', // Handle both "PERIOD" and "DOT"
            'LESS THAN': '<', 'GREATER THAN': '>',
            'TILDE': '~', 'BACKTICK': '`'
        };

        // Handle lowercase versions too
        const lowerKey = key.toLowerCase();
        if (keyMap[lowerKey]) {
            return keyMap[lowerKey]!;
        }

        return keyMap[key] || key.toLowerCase();
    }

    /**
     * Get execution status
     */
    getExecutionStatus(): { isExecuting: boolean; currentPlan: string | null; speed: number; repetitions: number } {
        return {
            isExecuting: this.isExecuting,
            currentPlan: this.currentPlan?.key || null,
            speed: this.executionSpeed,
            repetitions: this.repetitions
        };
    }

    /**
     * Stop current execution
     */
    stopExecution(): void {
        if (this.isExecuting) {
            this.logger.info('Stopping plan execution');
            // RACE CONDITION: No cleanup of partially executed events or active modifier states
            this.isExecuting = false;
            this.currentPlan = null;
        }
    }

    /**
     * Get a random delay within a range for more human-like behavior
     */
    private getRandomDelay(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Move mouse to position with human-like movement
     */
    private async moveMouseHumanLike(targetX: number, targetY: number): Promise<void> {
        if (!robotjs) return;
        
        const currentPos = robotjs.getMousePos();
        const distance = Math.sqrt(
            Math.pow(targetX - currentPos.x, 2) + 
            Math.pow(targetY - currentPos.y, 2)
        );
        
        // For short distances, move directly
        if (distance < 50) {
            robotjs.moveMouse(targetX, targetY);
            return;
        }
        
        // For longer distances, add a slight curve for more human-like movement
        const steps = Math.max(3, Math.floor(distance / 100));
        const stepDelay = this.getRandomDelay(10, 30);
        
        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            
            // Add slight curve using quadratic easing
            const easedProgress = progress * progress;
            
            const x = currentPos.x + (targetX - currentPos.x) * easedProgress;
            const y = currentPos.y + (targetY - currentPos.y) * easedProgress;
            
            // Add slight randomness to make it more human-like
            const randomOffset = 2;
            const finalX = x + this.getRandomDelay(-randomOffset, randomOffset);
            const finalY = y + this.getRandomDelay(-randomOffset, randomOffset);
            
            robotjs.moveMouse(finalX, finalY);
            
            if (i < steps) {
                await this.delay(stepDelay);
            }
        }
        
        // Ensure we end up at the exact target position
        robotjs.moveMouse(targetX, targetY);
    }

    /**
     * Utility function for delays
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default PlanExecutor;

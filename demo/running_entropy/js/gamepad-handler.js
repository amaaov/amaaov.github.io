/**
 * RUNNING ENTROPY - Gamepad Handler
 * Handles Bluetooth gamepad/joystick input
 */

class GamepadHandler {
    constructor() {
        this.isInitialized = false;
        this.gamepads = new Map();
        this.connectedGamepads = new Set();
        this.lastGamepadState = new Map();
        this.currentGamepadState = new Map();

        // Gamepad mapping
        this.buttonMapping = {
            // Standard buttons
            A: 0,           // A / Cross
            B: 1,           // B / Circle
            X: 2,           // X / Square
            Y: 3,           // Y / Triangle
            LB: 4,          // Left Bumper
            RB: 5,          // Right Bumper
            LT: 6,          // Left Trigger
            RT: 7,          // Right Trigger
            BACK: 8,        // Back / Select
            START: 9,       // Start
            LS: 10,         // Left Stick Press
            RS: 11,         // Right Stick Press

            // D-pad (as buttons)
            DPAD_UP: 12,
            DPAD_DOWN: 13,
            DPAD_LEFT: 14,
            DPAD_RIGHT: 15,

            // Xbox specific
            GUIDE: 16,      // Xbox Guide button

            // Additional buttons
            EXTRA_1: 17,
            EXTRA_2: 18
        };

        // Axis mapping
        this.axisMapping = {
            LS_X: 0,        // Left Stick X
            LS_Y: 1,        // Left Stick Y
            RS_X: 2,        // Right Stick X
            RS_Y: 3,        // Right Stick Y
            LT: 4,          // Left Trigger
            RT: 5           // Right Trigger
        };

        // Dead zone for analog sticks
        this.deadZone = 0.1;

        // Event handlers
        this.handlers = {
            connected: null,
            disconnected: null,
            buttonPressed: null,
            buttonReleased: null,
            axisChanged: null
        };

        // Polling interval
        this.pollInterval = null;
        this.pollRate = 60; // Hz
    }

    /**
     * Initialize gamepad handling
     */
    initialize() {
        try {
            if (!Utils.isGamepadSupported()) {
                console.warn('Gamepad API not supported');
                return false;
            }

            // Set up event listeners
            window.addEventListener('gamepadconnected', this.handleGamepadConnected.bind(this));
            window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected.bind(this));

            // Start polling
            this.startPolling();

            this.isInitialized = true;
            console.log('Gamepad handler initialized successfully');
            return true;

        } catch (error) {
            console.error('Failed to initialize gamepad handler:', error);
            return false;
        }
    }

    /**
     * Handle gamepad connected event
     * @param {GamepadEvent} event - Gamepad event
     */
    handleGamepadConnected(event) {
        const gamepad = event.gamepad;
        console.log(`Gamepad connected: ${gamepad.id} (${gamepad.buttons.length} buttons, ${gamepad.axes.length} axes)`);

        this.gamepads.set(gamepad.index, gamepad);
        this.connectedGamepads.add(gamepad.index);

        // Initialize state tracking
        this.lastGamepadState.set(gamepad.index, {
            buttons: new Array(gamepad.buttons.length).fill(false),
            axes: new Array(gamepad.axes.length).fill(0)
        });

        this.currentGamepadState.set(gamepad.index, {
            buttons: new Array(gamepad.buttons.length).fill(false),
            axes: new Array(gamepad.axes.length).fill(0)
        });

        // Update status display
        Utils.updateStatus('gamepad', `Connected: ${gamepad.id}`);

        if (this.handlers.connected) {
            this.handlers.connected(gamepad);
        }
    }

    /**
     * Handle gamepad disconnected event
     * @param {GamepadEvent} event - Gamepad event
     */
    handleGamepadDisconnected(event) {
        const gamepad = event.gamepad;
        console.log(`Gamepad disconnected: ${gamepad.id}`);

        this.gamepads.delete(gamepad.index);
        this.connectedGamepads.delete(gamepad.index);
        this.lastGamepadState.delete(gamepad.index);
        this.currentGamepadState.delete(gamepad.index);

        // Update status display
        if (this.connectedGamepads.size === 0) {
            Utils.updateStatus('gamepad', 'No Gamepad');
        } else {
            Utils.updateStatus('gamepad', `${this.connectedGamepads.size} Gamepad(s)`);
        }

        if (this.handlers.disconnected) {
            this.handlers.disconnected(gamepad);
        }
    }

    /**
     * Start polling for gamepad state
     */
    startPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }

        this.pollInterval = setInterval(() => {
            this.pollGamepads();
        }, 1000 / this.pollRate);
    }

    /**
     * Stop polling for gamepad state
     */
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    /**
     * Poll all connected gamepads
     */
    pollGamepads() {
        const gamepads = navigator.getGamepads();

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad && this.connectedGamepads.has(gamepad.index)) {
                this.updateGamepadState(gamepad);
            }
        }
    }

    /**
     * Update gamepad state and trigger events
     * @param {Gamepad} gamepad - Gamepad object
     */
    updateGamepadState(gamepad) {
        const lastState = this.lastGamepadState.get(gamepad.index);
        const currentState = this.currentGamepadState.get(gamepad.index);

        if (!lastState || !currentState) return;

        // Update button states
        for (let i = 0; i < gamepad.buttons.length; i++) {
            const button = gamepad.buttons[i];
            const wasPressed = lastState.buttons[i];
            const isPressed = button.pressed;

            currentState.buttons[i] = isPressed;

            // Trigger button events
            if (isPressed && !wasPressed) {
                if (this.handlers.buttonPressed) {
                    this.handlers.buttonPressed(gamepad.index, i, button.value);
                }
            } else if (!isPressed && wasPressed) {
                if (this.handlers.buttonReleased) {
                    this.handlers.buttonReleased(gamepad.index, i, button.value);
                }
            }
        }

        // Update axis states
        for (let i = 0; i < gamepad.axes.length; i++) {
            const axisValue = gamepad.axes[i];
            const lastValue = lastState.axes[i];

            // Apply dead zone
            const deadZoneValue = Math.abs(axisValue) < this.deadZone ? 0 : axisValue;
            currentState.axes[i] = deadZoneValue;

            // Trigger axis events if value changed significantly
            if (Math.abs(deadZoneValue - lastValue) > 0.01) {
                if (this.handlers.axisChanged) {
                    this.handlers.axisChanged(gamepad.index, i, deadZoneValue);
                }
            }
        }

        // Copy current state to last state for next frame
        lastState.buttons = [...currentState.buttons];
        lastState.axes = [...currentState.axes];
    }

    /**
     * Update method called by main app loop
     * This method is called every frame to update gamepad state
     */
    update() {
        // Poll gamepads if not using interval-based polling
        if (!this.pollInterval) {
            this.pollGamepads();
        }
    }

    /**
     * Get current gamepad state
     * @param {number} gamepadIndex - Gamepad index
     * @returns {Object|null} Gamepad state or null if not found
     */
    getGamepadState(gamepadIndex) {
        return this.currentGamepadState.get(gamepadIndex) || null;
    }

    /**
     * Get all connected gamepad states
     * @returns {Object} Object with gamepad states
     */
    getAllGamepadStates() {
        const states = {};
        for (const [index, state] of this.currentGamepadState) {
            states[index] = state;
        }
        return states;
    }

    /**
     * Check if button is pressed
     * @param {number} gamepadIndex - Gamepad index
     * @param {number} buttonIndex - Button index
     * @returns {boolean} True if button is pressed
     */
    isButtonPressed(gamepadIndex, buttonIndex) {
        const state = this.getGamepadState(gamepadIndex);
        return state ? state.buttons[buttonIndex] : false;
    }

    /**
     * Check if button is pressed by name
     * @param {number} gamepadIndex - Gamepad index
     * @param {string} buttonName - Button name
     * @returns {boolean} True if button is pressed
     */
    isButtonPressedByName(gamepadIndex, buttonName) {
        const buttonIndex = this.buttonMapping[buttonName];
        if (buttonIndex === undefined) return false;
        return this.isButtonPressed(gamepadIndex, buttonIndex);
    }

    /**
     * Get axis value
     * @param {number} gamepadIndex - Gamepad index
     * @param {number} axisIndex - Axis index
     * @returns {number} Axis value (-1 to 1)
     */
    getAxisValue(gamepadIndex, axisIndex) {
        const state = this.getGamepadState(gamepadIndex);
        return state ? state.axes[axisIndex] : 0;
    }

    /**
     * Get axis value by name
     * @param {number} gamepadIndex - Gamepad index
     * @param {string} axisName - Axis name
     * @returns {number} Axis value (-1 to 1)
     */
    getAxisValueByName(gamepadIndex, axisName) {
        const axisIndex = this.axisMapping[axisName];
        if (axisIndex === undefined) return 0;
        return this.getAxisValue(gamepadIndex, axisIndex);
    }

    /**
     * Get left stick values
     * @param {number} gamepadIndex - Gamepad index
     * @returns {Object} Left stick {x, y} values
     */
    getLeftStick(gamepadIndex) {
        return {
            x: this.getAxisValueByName(gamepadIndex, 'LS_X'),
            y: this.getAxisValueByName(gamepadIndex, 'LS_Y')
        };
    }

    /**
     * Get right stick values
     * @param {number} gamepadIndex - Gamepad index
     * @returns {Object} Right stick {x, y} values
     */
    getRightStick(gamepadIndex) {
        return {
            x: this.getAxisValueByName(gamepadIndex, 'RS_X'),
            y: this.getAxisValueByName(gamepadIndex, 'RS_Y')
        };
    }

    /**
     * Get trigger values
     * @param {number} gamepadIndex - Gamepad index
     * @returns {Object} Trigger {left, right} values
     */
    getTriggers(gamepadIndex) {
        return {
            left: this.getAxisValueByName(gamepadIndex, 'LT'),
            right: this.getAxisValueByName(gamepadIndex, 'RT')
        };
    }

    /**
     * Get primary gamepad input (first connected gamepad)
     * @returns {Object} Primary gamepad input state
     */
    getPrimaryInput() {
        const gamepadIndices = Array.from(this.connectedGamepads);
        if (gamepadIndices.length === 0) {
            return {
                leftStick: { x: 0, y: 0 },
                rightStick: { x: 0, y: 0 },
                triggers: { left: 0, right: 0 },
                buttons: {}
            };
        }

        const primaryIndex = gamepadIndices[0];
        const state = this.getGamepadState(primaryIndex);

        if (!state) {
            return {
                leftStick: { x: 0, y: 0 },
                rightStick: { x: 0, y: 0 },
                triggers: { left: 0, right: 0 },
                buttons: {}
            };
        }

        // Create button state object
        const buttons = {};
        for (const [name, index] of Object.entries(this.buttonMapping)) {
            buttons[name] = state.buttons[index] || false;
        }

        return {
            leftStick: this.getLeftStick(primaryIndex),
            rightStick: this.getRightStick(primaryIndex),
            triggers: this.getTriggers(primaryIndex),
            buttons: buttons
        };
    }

    /**
     * Set dead zone for analog sticks
     * @param {number} deadZone - Dead zone value (0-1)
     */
    setDeadZone(deadZone) {
        this.deadZone = Utils.clamp(deadZone, 0, 1);
    }

    /**
     * Set polling rate
     * @param {number} rate - Polling rate in Hz
     */
    setPollRate(rate) {
        this.pollRate = Math.max(1, rate);
        if (this.isInitialized) {
            this.startPolling();
        }
    }

    /**
     * Set event handler
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     */
    setHandler(event, handler) {
        if (this.handlers.hasOwnProperty(event)) {
            this.handlers[event] = handler;
        }
    }

    /**
     * Get connected gamepad count
     * @returns {number} Number of connected gamepads
     */
    getConnectedCount() {
        return this.connectedGamepads.size;
    }

    /**
     * Get gamepad information
     * @param {number} gamepadIndex - Gamepad index
     * @returns {Object|null} Gamepad info or null if not found
     */
    getGamepadInfo(gamepadIndex) {
        const gamepad = this.gamepads.get(gamepadIndex);
        if (!gamepad) return null;

        return {
            id: gamepad.id,
            index: gamepad.index,
            connected: gamepad.connected,
            timestamp: gamepad.timestamp,
            mapping: gamepad.mapping,
            axes: gamepad.axes.length,
            buttons: gamepad.buttons.length
        };
    }

    /**
     * Get all gamepad information
     * @returns {Array} Array of gamepad info objects
     */
    getAllGamepadInfo() {
        return Array.from(this.gamepads.values()).map(gamepad => ({
            id: gamepad.id,
            index: gamepad.index,
            connected: gamepad.connected,
            timestamp: gamepad.timestamp,
            mapping: gamepad.mapping,
            axes: gamepad.axes.length,
            buttons: gamepad.buttons.length
        }));
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.stopPolling();

        // Remove event listeners
        window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
        window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);

        // Clear state
        this.gamepads.clear();
        this.connectedGamepads.clear();
        this.lastGamepadState.clear();
        this.currentGamepadState.clear();

        this.isInitialized = false;
        console.log('Gamepad handler disposed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GamepadHandler;
}

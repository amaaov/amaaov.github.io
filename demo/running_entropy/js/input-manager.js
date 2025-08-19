/**
 * RUNNING ENTROPY - Input Manager
 * Handles mouse, touch, and keyboard input
 */

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.isInitialized = false;

        // Input state
        this.mouse = {
            x: 0,
            y: 0,
            isDown: false,
            isMoving: false,
            lastX: 0,
            lastY: 0,
            deltaX: 0,
            deltaY: 0
        };

        this.touch = {
            x: 0,
            y: 0,
            isActive: false,
            isMoving: false,
            lastX: 0,
            lastY: 0,
            deltaX: 0,
            deltaY: 0,
            touches: []
        };

        this.keyboard = {
            keys: new Set(),
            pressed: new Set(),
            released: new Set()
        };

        // Event handlers
        this.handlers = {
            mouseMove: null,
            mouseDown: null,
            mouseUp: null,
            touchStart: null,
            touchMove: null,
            touchEnd: null,
            keyDown: null,
            keyUp: null
        };

        // Prevent default behaviors
        this.preventDefault = true;
    }

    /**
     * Initialize input handling
     */
    initialize() {
        try {
            // Mouse events
            this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this), { passive: false });
            this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this), { passive: false });
            this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this), { passive: false });
            this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this), { passive: false });

            // Touch events
            this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
            this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
            this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
            this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });

            // Keyboard events
            document.addEventListener('keydown', this.handleKeyDown.bind(this), { passive: false });
            document.addEventListener('keyup', this.handleKeyUp.bind(this), { passive: false });

            // Prevent context menu
            this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this), { passive: false });

            this.isInitialized = true;
            console.log('Input manager initialized successfully');
            return true;

        } catch (error) {
            console.error('Failed to initialize input manager:', error);
            return false;
        }
    }

    /**
     * Handle mouse down event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseDown(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;

        this.mouse.x = x;
        this.mouse.y = y;
        this.mouse.isDown = true;
        this.mouse.isMoving = false;
        this.mouse.lastX = x;
        this.mouse.lastY = y;
        this.mouse.deltaX = 0;
        this.mouse.deltaY = 0;

        if (this.handlers.mouseDown) {
            this.handlers.mouseDown(x, y, event);
        }
    }

    /**
     * Handle mouse move event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseMove(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;

        this.mouse.deltaX = x - this.mouse.lastX;
        this.mouse.deltaY = y - this.mouse.lastY;
        this.mouse.lastX = this.mouse.x;
        this.mouse.lastY = this.mouse.y;
        this.mouse.x = x;
        this.mouse.y = y;
        this.mouse.isMoving = true;

        if (this.handlers.mouseMove) {
            this.handlers.mouseMove(x, y, this.mouse.deltaX, this.mouse.deltaY, event);
        }
    }

    /**
     * Handle mouse up event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseUp(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }

        this.mouse.isDown = false;
        this.mouse.isMoving = false;

        if (this.handlers.mouseUp) {
            this.handlers.mouseUp(this.mouse.x, this.mouse.y, event);
        }
    }

    /**
     * Handle mouse leave event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseLeave(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }

        this.mouse.isDown = false;
        this.mouse.isMoving = false;
    }

    /**
     * Handle touch start event
     * @param {TouchEvent} event - Touch event
     */
    handleTouchStart(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }

        const rect = this.canvas.getBoundingClientRect();
        const touches = Array.from(event.touches).map(touch => ({
            id: touch.identifier,
            x: (touch.clientX - rect.left) / rect.width,
            y: (touch.clientY - rect.top) / rect.height
        }));

        this.touch.touches = touches;
        this.touch.isActive = touches.length > 0;

        if (touches.length > 0) {
            const primaryTouch = touches[0];
            this.touch.x = primaryTouch.x;
            this.touch.y = primaryTouch.y;
            this.touch.lastX = primaryTouch.x;
            this.touch.lastY = primaryTouch.y;
            this.touch.deltaX = 0;
            this.touch.deltaY = 0;
        }

        if (this.handlers.touchStart) {
            this.handlers.touchStart(touches, event);
        }
    }

    /**
     * Handle touch move event
     * @param {TouchEvent} event - Touch event
     */
    handleTouchMove(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }

        const rect = this.canvas.getBoundingClientRect();
        const touches = Array.from(event.touches).map(touch => ({
            id: touch.identifier,
            x: (touch.clientX - rect.left) / rect.width,
            y: (touch.clientY - rect.top) / rect.height
        }));

        this.touch.touches = touches;
        this.touch.isActive = touches.length > 0;

        if (touches.length > 0) {
            const primaryTouch = touches[0];
            this.touch.deltaX = primaryTouch.x - this.touch.lastX;
            this.touch.deltaY = primaryTouch.y - this.touch.lastY;
            this.touch.lastX = this.touch.x;
            this.touch.lastY = this.touch.y;
            this.touch.x = primaryTouch.x;
            this.touch.y = primaryTouch.y;
            this.touch.isMoving = true;
        }

        if (this.handlers.touchMove) {
            this.handlers.touchMove(touches, this.touch.deltaX, this.touch.deltaY, event);
        }
    }

    /**
     * Handle touch end event
     * @param {TouchEvent} event - Touch event
     */
    handleTouchEnd(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }

        this.touch.isActive = false;
        this.touch.isMoving = false;
        this.touch.touches = [];

        if (this.handlers.touchEnd) {
            this.handlers.touchEnd(event);
        }
    }

    /**
     * Handle key down event
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyDown(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }

        const key = event.code || event.key;
        console.log('Key down:', key);

        this.keyboard.keys.add(key);
        this.keyboard.pressed.add(key);

        if (this.handlers.keyDown) {
            this.handlers.keyDown(key, event);
        }
    }

    /**
     * Handle key up event
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyUp(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }

        const key = event.code || event.key;
        console.log('Key up:', key);

        this.keyboard.keys.delete(key);
        this.keyboard.released.add(key);

        if (this.handlers.keyUp) {
            this.handlers.keyUp(key, event);
        }
    }

    /**
     * Handle context menu event
     * @param {MouseEvent} event - Mouse event
     */
    handleContextMenu(event) {
        if (this.preventDefault) {
            event.preventDefault();
        }
    }

    /**
     * Update input state (call once per frame)
     */
    update() {
        // Clear one-frame states
        this.keyboard.pressed.clear();
        this.keyboard.released.clear();

        // Reset movement flags
        this.mouse.isMoving = false;
        this.touch.isMoving = false;
    }

    /**
     * Get current mouse position
     * @returns {Object} Mouse position {x, y}
     */
    getMousePosition() {
        return {
            x: this.mouse.x,
            y: this.mouse.y
        };
    }

    /**
     * Get current touch position
     * @returns {Object} Touch position {x, y}
     */
    getTouchPosition() {
        return {
            x: this.touch.x,
            y: this.touch.y
        };
    }

    /**
     * Get current input position (mouse or touch)
     * @returns {Object} Input position {x, y}
     */
    getInputPosition() {
        if (this.touch.isActive) {
            return this.getTouchPosition();
        } else {
            return this.getMousePosition();
        }
    }

    /**
     * Check if mouse is down
     * @returns {boolean} True if mouse is down
     */
    isMouseDown() {
        return this.mouse.isDown;
    }

    /**
     * Check if touch is active
     * @returns {boolean} True if touch is active
     */
    isTouchActive() {
        return this.touch.isActive;
    }

    /**
     * Check if any input is active
     * @returns {boolean} True if any input is active
     */
    isInputActive() {
        return this.mouse.isDown || this.touch.isActive;
    }

    /**
     * Check if key is pressed
     * @param {string} key - Key code
     * @returns {boolean} True if key is pressed
     */
    isKeyPressed(key) {
        return this.keyboard.keys.has(key);
    }

    /**
     * Check if key was just pressed this frame
     * @param {string} key - Key code
     * @returns {boolean} True if key was just pressed
     */
    isKeyJustPressed(key) {
        return this.keyboard.pressed.has(key);
    }

    /**
     * Check if key was just released this frame
     * @param {string} key - Key code
     * @returns {boolean} True if key was just released
     */
    isKeyJustReleased(key) {
        return this.keyboard.released.has(key);
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
     * Get input state for rendering
     * @returns {Object} Input state object
     */
    getInputState() {
        const inputPos = this.getInputPosition();

        return {
            mouse: {
                x: this.mouse.x,
                y: this.mouse.y,
                isDown: this.mouse.isDown,
                isMoving: this.mouse.isMoving,
                deltaX: this.mouse.deltaX,
                deltaY: this.mouse.deltaY
            },
            touch: {
                x: this.touch.x,
                y: this.touch.y,
                isActive: this.touch.isActive,
                isMoving: this.touch.isMoving,
                deltaX: this.touch.deltaX,
                deltaY: this.touch.deltaY,
                touches: this.touch.touches
            },
            input: {
                x: inputPos.x,
                y: inputPos.y,
                isActive: this.isInputActive()
            },
            keyboard: {
                keys: Array.from(this.keyboard.keys),
                pressed: Array.from(this.keyboard.pressed),
                released: Array.from(this.keyboard.released)
            }
        };
    }

    /**
     * Clean up resources
     */
    dispose() {
        // Remove event listeners
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);

        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
        this.canvas.removeEventListener('touchcancel', this.handleTouchEnd);

        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);

        this.canvas.removeEventListener('contextmenu', this.handleContextMenu);

        this.isInitialized = false;
        console.log('Input manager disposed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputManager;
}

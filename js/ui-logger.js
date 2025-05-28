// Filename: js/ui-logger.js
class UiLogger {
    constructor(textareaId) {
        this.logArea = document.getElementById(textareaId);
        if (!this.logArea) {
            console.error("UI Log Console textarea not found:", textareaId);
            // Fallback to console if textarea isn't found
            this.log = (message, level = 'INFO') => {
                console.log(`[UI FALLBACK] [${level}] ${message}`);
            };
            this.info = (message) => this.log(message, 'INFO');
            this.warn = (message) => this.log(message, 'WARN');
            this.error = (message) => this.log(message, 'ERROR');
            this.clear = () => console.log("[UI FALLBACK] Clear logs");
            return;
        }
        this.logArea.value = ""; // Clear on init
        console.log("UiLogger initialized for textarea:", textareaId);
    }

    log(message, level = 'INFO') {
        if (!this.logArea || typeof this.logArea.value === 'undefined') { // Check if logArea is still valid
             console.log(`[UI FALLBACK AFTER INIT] [${level}] ${message}`);
             return;
        }
        const timestamp = new Date().toLocaleTimeString();
        const formattedMessage = `[${timestamp}] [${level}] ${message}\n`;
        this.logArea.value += formattedMessage;
        this.logArea.scrollTop = this.logArea.scrollHeight; // Auto-scroll to bottom
    }

    info(message) {
        this.log(message, 'INFO');
    }

    warn(message) {
        this.log(message, 'WARN');
    }

    error(message) {
        this.log(message, 'ERROR');
    }

    clear() {
        if (!this.logArea || typeof this.logArea.value === 'undefined') return;
        this.logArea.value = "";
    }
}

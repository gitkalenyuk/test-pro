console.log("settings.js loaded");

// Settings management logic will go here.
// For example, loading/saving user preferences.

class Settings {
    constructor() {
        this.settings = {};
        this.loadSettings();
    }

    loadSettings() {
        // Load settings from localStorage or a default configuration
        const savedSettings = localStorage.getItem('pdfViewerSettings');
        if (savedSettings) {
            this.settings = JSON.parse(savedSettings);
            console.log("Settings loaded:", this.settings);
        } else {
            console.log("No saved settings found, using defaults.");
            this.setDefaultSettings();
        }
    }

    setDefaultSettings() {
        this.settings = {
            language: 'en', // This might be the same as uiLanguage or separate. Let's use uiLanguage for this task.
            theme: 'light',
            showAnnotations: true,
            initialColor: '#FFFF00', 
            editedColor: '#00FF00', 
            savedColor: '#0000FF', 
            priceFontSize: 10,
            marginPercentage: 0,
            uiLanguage: 'uk' // New setting, default 'uk'
        };
        // Load saved settings, which might override defaults including marginPercentage
        this.loadSettings(); // This was called in constructor before, ensure it now correctly loads margin
    }

    loadSettings() {
        // Load settings from localStorage or a default configuration
        const savedSettings = localStorage.getItem('pdfViewerSettings');
        if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            this.settings = { ...this.settings, ...parsedSettings }; // Merge defaults with saved
            console.log("Settings loaded:", this.settings);
        } else {
            console.log("No saved settings found, using defaults.");
            // No need to call setDefaultSettings here as constructor sets defaults first
        }
        // Ensure critical default values are present if not in saved settings
        if (this.settings.marginPercentage === undefined) this.settings.marginPercentage = 0;
        if (this.settings.initialColor === undefined) this.settings.initialColor = '#FFFF00';
        if (this.settings.editedColor === undefined) this.settings.editedColor = '#00FF00';
        if (this.settings.savedColor === undefined) this.settings.savedColor = '#0000FF';
        if (this.settings.priceFontSize === undefined) this.settings.priceFontSize = 10;
        if (this.settings.uiLanguage === undefined) this.settings.uiLanguage = 'uk'; // Default for new setting

        this.saveSettings(); // Save back to ensure all keys exist in localStorage
    }
    
    // setDefaultSettings() is effectively handled by initial values in constructor and loadSettings logic

    getSetting(key) {
        // Ensure settings object is available (it should be by constructor)
        return this.settings ? this.settings[key] : undefined;
    }

    // --- Color Settings ---
    getInitialColor() { return this.getSetting('initialColor') || '#FFFF00'; }
    setInitialColor(value) { this.setSetting('initialColor', value); }

    getEditedColor() { return this.getSetting('editedColor') || '#00FF00'; }
    setEditedColor(value) { this.setSetting('editedColor', value); }

    getSavedColor() { return this.getSetting('savedColor') || '#0000FF'; }
    setSavedColor(value) { this.setSetting('savedColor', value); }

    // --- Font Size Setting ---
    getPriceFontSize() { return parseInt(this.getSetting('priceFontSize'), 10) || 10; }
    setPriceFontSize(value) { 
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue >= 6 && numValue <= 72) {
            this.setSetting('priceFontSize', numValue);
        } else {
            console.warn("Invalid price font size:", value, "Using default 10.");
            this.setSetting('priceFontSize', 10); // Fallback or clamp
        }
    }

    // --- Margin Setting ---
    getMarginPercentage() {
        const margin = parseFloat(this.getSetting('marginPercentage'));
        return isNaN(margin) ? 0 : margin;
    }
    setMarginPercentage(value) {
        let numericValue = parseFloat(value);
        if (isNaN(numericValue)) {
            numericValue = 0;
        }
        numericValue = Math.max(0, Math.min(100, numericValue)); // Clamp
        this.setSetting('marginPercentage', numericValue);
    }

    // --- UI Language Setting ---
    getUiLanguage() { return this.getSetting('uiLanguage') || 'uk'; }
    setUiLanguage(value) { 
        // Basic validation for language codes (e.g., 2 letters) could be added
        if (value && typeof value === 'string' && value.length >= 2) {
            this.setSetting('uiLanguage', value);
        } else {
            console.warn("Invalid UI language:", value, "Using default 'uk'.");
            this.setSetting('uiLanguage', 'uk');
        }
    }


    setSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        console.log(`Setting "${key}" updated to "${value}"`);
    }

    saveSettings() {
        localStorage.setItem('pdfViewerSettings', JSON.stringify(this.settings));
        console.log("Settings saved to localStorage.");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.appSettings = new Settings();
});

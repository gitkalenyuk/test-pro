console.log("translations.js loaded");

class Translator {
    constructor(initialLanguage) {
        this.currentLanguage = initialLanguage || 'uk'; // Default to 'uk' if none provided
        this.translations = {}; // Store all loaded translations here, keyed by language
        console.log(`Translator initialized with language: ${this.currentLanguage}`);
    }

    async loadTranslations(lang = this.currentLanguage) {
        if (this.translations[lang]) {
            console.log(`${lang.toUpperCase()} translations already loaded.`);
            this.currentLanguage = lang; // Ensure currentLanguage is set
            this.applyTranslationsToPage();
            return true;
        }

        console.log(`Loading translations for ${lang.toUpperCase()}...`);
        try {
            const response = await fetch(`assets/translations/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load translation file for ${lang}: ${response.statusText} (status ${response.status})`);
            }
            const newTranslations = await response.json();
            this.translations[lang] = newTranslations; // Store the loaded translations for this language
            this.currentLanguage = lang; // Update current language
            console.log(`${lang.toUpperCase()} translations loaded successfully:`, this.translations[lang]);
            this.applyTranslationsToPage();
            return true;
        } catch (error) {
            console.error("Error loading translations for language:", lang, error);
            if (lang !== 'uk') { // Fallback to 'uk' (default) if primary load fails
                console.warn(`Falling back to UK (Ukrainian) translations.`);
                return await this.loadTranslations('uk'); // Attempt to load default
            } else if (lang === 'uk' && lang !== 'en') { // If 'uk' fails, try 'en' as ultimate fallback
                 console.warn(`UK (Ukrainian) failed, falling back to EN (English) translations.`);
                 return await this.loadTranslations('en');
            }
            // If all fallbacks fail, the page will remain untranslated or partially translated.
            return false;
        }
    }

    applyTranslationsToPage() {
        if (!this.translations[this.currentLanguage]) {
            console.warn(`No translations available for ${this.currentLanguage} to apply.`);
            return;
        }
        console.log(`Applying translations for ${this.currentLanguage.toUpperCase()} to page...`);
        const elements = document.querySelectorAll('[data-translate-key]');
        elements.forEach(element => {
            const key = element.dataset.translateKey;
            const translation = this.translations[this.currentLanguage][key];

            if (translation !== undefined) {
                if (element.tagName === 'TITLE') {
                    document.title = translation;
                } else if (element.hasAttribute('title') && (key.endsWith('Button') || element.tagName === 'INPUT' || element.id === 'customPdfUploadButton')) { 
                    // For buttons or inputs where the key might be for the main text,
                    // also update the title attribute if a specific title translation isn't provided.
                    // More specific title keys (e.g., "zoomInButtonTitle") could be used if needed.
                    element.title = translation; 
                    // If the element itself should have text content (e.g. a button), set it too.
                    if (element.tagName === 'BUTTON' || (element.tagName === 'LABEL' && !element.control) || element.tagName === 'SPAN') {
                         element.textContent = translation;
                    }
                } else if (element.tagName === 'INPUT' && element.type === 'file') {
                    // Custom handling for file input if needed, e.g. if we had a custom button text
                    // The customPdfUploadButton handles its own text via its key.
                }
                else {
                    element.textContent = translation;
                }
            } else {
                console.warn(`Translation key "${key}" not found for language "${this.currentLanguage}". Element content:`, element.textContent.trim());
            }
        });
        console.log("Translations applied.");
    }

    getString(key, lang = this.currentLanguage) {
        if (this.translations[lang] && this.translations[lang][key]) {
            return this.translations[lang][key];
        }
        // Fallback to 'uk' if key not found in current language (and current is not 'uk')
        if (lang !== 'uk' && this.translations['uk'] && this.translations['uk'][key]) {
            console.warn(`Translation key "${key}" not found in "${lang}", using "uk".`);
            return this.translations['uk'][key];
        }
        // Fallback to 'en' if key not found in 'uk' or current (and current is not 'en')
        if (lang !== 'en' && this.translations['en'] && this.translations['en'][key]) {
            console.warn(`Translation key "${key}" not found in "${lang}" or "uk", using "en".`);
            return this.translations['en'][key];
        }
        console.warn(`Translation key "${key}" not found in any loaded language. Returning key.`);
        return key; // Return the key itself if no translation is found anywhere
    }

    async changeLanguage(newLang) {
        console.log(`Attempting to change language to ${newLang.toUpperCase()}`);
        if (this.currentLanguage === newLang && this.translations[newLang]) {
            console.log(`Language ${newLang.toUpperCase()} is already current and loaded.`);
            this.applyTranslationsToPage(); // Re-apply in case DOM changed
            return;
        }
        const success = await this.loadTranslations(newLang);
        if (success) {
            this.currentLanguage = newLang; // Confirm current language
            if (window.appSettings) {
                window.appSettings.setUiLanguage(newLang);
            }
            console.log(`Language changed successfully to ${newLang.toUpperCase()}.`);
        } else {
            console.error(`Failed to change language to ${newLang.toUpperCase()}. Check console for errors.`);
            // Potentially revert selector or notify user
        }
    }
}

// Initialization will be handled in app.js
// Example:
// document.addEventListener('DOMContentLoaded', async () => {
//     if (window.appSettings) {
//         const currentLang = window.appSettings.getUiLanguage();
//         window.translator = new Translator(currentLang);
//         await window.translator.loadTranslations(currentLang); // Initial load
//     } else {
//         console.error("Settings module not available for Translator initialization.");
//         // Fallback if settings aren't there, though app.js structure implies it will be.
//         window.translator = new Translator('uk'); // Default to 'uk'
//         await window.translator.loadTranslations('uk');
//     }
// });

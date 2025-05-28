console.log("app.js loaded");

document.addEventListener('DOMContentLoaded', async () => { // Make async
    console.log("DOM fully loaded and parsed");

    // Ensure PDF.js worker is configured (already in index.html, but good to double-check)
    if (typeof pdfjsLib !== 'undefined') {
        // pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
        // This line is commented out as it should be set in index.html.
        // If it were to be set here, it should be done before any PDF.js API call.
    } else {
        console.error("PDF.js library (pdfjsLib) is not loaded. Ensure the script tag is in index.html.");
        alert("Error: PDF library not loaded. Please check console for details.");
        return;
    }

    // Configuration for PDFViewer, mapping to actual IDs in index.html
    const viewerOptions = {
        viewerContainerId: 'pdfView',       // The div that wraps the canvas, for styling/scrolling purposes
        canvasId: 'pdfCanvas',
        thumbnailViewId: 'thumbnailView',
        
        filenameId: 'pdfFilename',
        currentPageId: 'currentPage',
        totalPagesId: 'totalPages',
        
        prevPageId: 'prevPage',
        nextPageId: 'nextPage',
        
        zoomOutId: 'zoomOut',
        zoomPercentageId: 'zoomPercentage',
        zoomInId: 'zoomIn'
    };

    // Instantiate PDFViewer
    const pdfViewer = new PDFViewer(viewerOptions);
    // pdfViewer instance now holds references to all its UI elements based on IDs passed.

    // Event listener for file upload
    const pdfUploadElement = document.getElementById('pdfUpload');
    if (pdfUploadElement) {
        pdfUploadElement.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && file.type === "application/pdf") {
                pdfViewer.loadPdf(file);
            } else if (file) {
                alert("Please select a PDF file.");
                event.target.value = null; // Reset file input
            }
        });
    } else {
        console.error("File upload element 'pdfUpload' not found.");
    }

    // Event listeners for top bar controls, directly using methods from pdfViewer instance
    // The PDFViewer class now finds these elements itself via IDs in constructor.
    // These direct event listeners here are correct.

    if (pdfViewer.prevPageButton) {
        pdfViewer.prevPageButton.addEventListener('click', () => pdfViewer.prevPage());
    }

    if (pdfViewer.nextPageButton) {
        pdfViewer.nextPageButton.addEventListener('click', () => pdfViewer.nextPage());
    }

    if (pdfViewer.currentPageInput) {
        // Using 'change' event, which fires when the value is committed (e.g., on blur or Enter)
        pdfViewer.currentPageInput.addEventListener('change', (event) => pdfViewer.goToPage(event));
        // Optional: Add 'keypress' for Enter key if desired, but 'change' often covers it for type="number"
        // pdfViewer.currentPageInput.addEventListener('keypress', (event) => {
        //     if (event.key === 'Enter') {
        //         pdfViewer.goToPage(event);
        //     }
        // });
    }

    if (pdfViewer.zoomOutButton) {
        pdfViewer.zoomOutButton.addEventListener('click', () => pdfViewer.zoomOut());
    }

    if (pdfViewer.zoomInButton) {
        pdfViewer.zoomInButton.addEventListener('click', () => pdfViewer.zoomIn());
    }

    if (pdfViewer.zoomPercentageInput) {
        // Using 'change' event for when input loses focus or Enter is pressed
        pdfViewer.zoomPercentageInput.addEventListener('change', (event) => pdfViewer.setZoomFromInput(event));
        // Optional: Add 'keypress' for Enter key
        // pdfViewer.zoomPercentageInput.addEventListener('keypress', (event) => {
        //     if (event.key === 'Enter') {
        //         pdfViewer.setZoomFromInput(event);
        //         event.target.blur(); // Optional: remove focus
        //     }
        // });
    }
    
    // Initialize other modules if necessary
    if (window.appSettings && window.translator) {
        console.log("Settings and Translator modules are available and should self-initialize or be initialized if needed.");
        // Example: translator might need to run translatePage after dynamic content is loaded,
        // but this example focuses on PDF viewer.

        // Margin input functionality
        const marginInput = document.getElementById('marginInput');
        const marginSlider = document.getElementById('marginSlider');

        if (marginInput && marginSlider && window.appSettings) {
            const initialMargin = window.appSettings.getMarginPercentage();
            marginInput.value = initialMargin;
            marginSlider.value = initialMargin;

            marginInput.addEventListener('input', (event) => {
                const newValue = parseFloat(event.target.value);
                if (!isNaN(newValue)) {
                    const clampedValue = Math.max(0, Math.min(100, newValue)); // Ensure value is within range
                    window.appSettings.setMarginPercentage(clampedValue);
                    marginSlider.value = clampedValue;
                    // Potentially trigger a re-render or update if needed immediately
                    // e.g., if (pdfViewer.pdfDoc) pdfViewer.renderPage(pdfViewer.currentPageNum);
                }
            });

            marginSlider.addEventListener('input', (event) => {
                const newValue = parseFloat(event.target.value);
                window.appSettings.setMarginPercentage(newValue); // Setter already clamps
                marginInput.value = newValue;
                // Potentially trigger a re-render or update if needed immediately
                // e.g., if (pdfViewer.pdfDoc) pdfViewer.renderPage(pdfViewer.currentPageNum);
            });
            console.log("Margin input elements initialized and event listeners set up.");
        } else {
            console.warn("Margin input elements or appSettings not found.");
        }

        // Undo button functionality
        const undoButton = document.getElementById('undoButton');
        if (undoButton && pdfViewer) { // pdfViewer should be available here
            undoButton.addEventListener('click', () => {
                pdfViewer.undoLastEdit();
            });
            console.log("Undo button event listener set up.");
        } else {
            console.warn("Undo button or pdfViewer instance not found.");
        }

        // Download Modified PDF button functionality
        const downloadPdfButton = document.getElementById('downloadPdfButton');
        if (downloadPdfButton && pdfViewer) {
            downloadPdfButton.addEventListener('click', () => {
                pdfViewer.handleDownloadPdf();
            });
            console.log("Download PDF button event listener set up.");
        } else {
            console.warn("Download PDF button or pdfViewer instance not found.");
        }

        // Settings UI elements
        const initialColorPicker = document.getElementById('initialColorPicker');
        const editedColorPicker = document.getElementById('editedColorPicker');
        const savedColorPicker = document.getElementById('savedColorPicker');
        const priceFontSizeInput = document.getElementById('priceFontSizeInput');

        if (window.appSettings) {
            if (initialColorPicker) {
                initialColorPicker.value = window.appSettings.getInitialColor();
                initialColorPicker.addEventListener('change', (event) => {
                    window.appSettings.setInitialColor(event.target.value);
                    if (pdfViewer) pdfViewer.refreshCurrentPageOverlays();
                });
            }
            if (editedColorPicker) {
                editedColorPicker.value = window.appSettings.getEditedColor();
                editedColorPicker.addEventListener('change', (event) => {
                    window.appSettings.setEditedColor(event.target.value);
                    if (pdfViewer) pdfViewer.refreshCurrentPageOverlays();
                });
            }
            if (savedColorPicker) {
                savedColorPicker.value = window.appSettings.getSavedColor();
                savedColorPicker.addEventListener('change', (event) => {
                    window.appSettings.setSavedColor(event.target.value);
                    if (pdfViewer) pdfViewer.refreshCurrentPageOverlays();
                });
            }
            if (priceFontSizeInput) {
                priceFontSizeInput.value = window.appSettings.getPriceFontSize();
                priceFontSizeInput.addEventListener('change', (event) => {
                    window.appSettings.setPriceFontSize(parseInt(event.target.value, 10));
                    if (pdfViewer) pdfViewer.refreshCurrentPageOverlays();
                });
            }
            console.log("Settings UI elements initialized and event listeners set up.");
        } else {
            console.warn("appSettings not found. Cannot initialize settings UI.");
        }

    } else {
        console.warn("Settings or Translator modules not fully initialized or available on window global.");
    }

    console.log("app.js: Event listeners set up.");
});

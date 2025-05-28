console.log("pdf-viewer.js loaded");

class PDFViewer {
    constructor(options) {
        this.pdfDoc = null;
        this.currentPageNum = 1;
        this.currentZoom = 1.0; // Default zoom 100%
        this.activeThumbnail = null;
        this.settings = window.appSettings; // Access global settings
        this.lastEditedPriceIndex = null; // For undo functionality

        // UI Elements
        this.viewerContainer = document.getElementById(options.viewerContainerId); // e.g., 'pdfView'
        this.canvas = document.getElementById(options.canvasId); // e.g., 'pdfCanvas'
        this.thumbnailViewContainer = document.getElementById(options.thumbnailViewId); // e.g., 'thumbnailView'

        // Create a container for price overlays
        this.priceOverlayContainer = document.createElement('div');
        this.priceOverlayContainer.setAttribute('id', 'priceOverlayContainer');
        // Style for this container will be handled in CSS (e.g., position absolute, top 0, left 0, pointer-events none for container itself)
        if (this.viewerContainer) {
            // Ensure viewerContainer is positioned to be a reference for absolute children
            // This will be set in CSS, but good to be mindful here.
            // this.viewerContainer.style.position = 'relative'; // Best handled by CSS
            this.viewerContainer.appendChild(this.priceOverlayContainer);
        } else {
            console.error("PDFViewer: viewerContainer (e.g., 'pdfView') not found for appending price overlays.");
        }
        
        this.pdfFilenameDisplay = document.getElementById(options.filenameId);
        this.currentPageInput = document.getElementById(options.currentPageId);
        this.totalPagesDisplay = document.getElementById(options.totalPagesId);
        
        this.prevPageButton = document.getElementById(options.prevPageId);
        this.nextPageButton = document.getElementById(options.nextPageId);
        
        this.zoomOutButton = document.getElementById(options.zoomOutId);
        this.zoomPercentageInput = document.getElementById(options.zoomPercentageId);
        this.zoomInButton = document.getElementById(options.zoomInId);

        if (!this.viewerContainer || !this.canvas || !this.thumbnailViewContainer ||
            !this.pdfFilenameDisplay || !this.currentPageInput || !this.totalPagesDisplay ||
            !this.prevPageButton || !this.nextPageButton ||
            !this.zoomOutButton || !this.zoomPercentageInput || !this.zoomInButton) {
            console.error("PDFViewer: One or more essential DOM elements not found. Check provided IDs in options:", options);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        console.log("PDFViewer initialized with all elements.");
        this.updateZoomDisplay(); // Initialize zoom display
    }

    async loadPdf(file) {
        if (!file) {
            console.error("loadPdf: No file provided.");
            this.pdfFilenameDisplay.textContent = "Error: No file provided.";
            return;
        }
        console.log("Loading PDF:", file.name);
        this.pdfFilenameDisplay.textContent = `Loading: ${file.name}...`;
        this.originalPdfFile = file; // Store the original File object

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const arrayBuffer = event.target.result;
                this.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                console.log("PDF loaded:", this.pdfDoc.numPages, "pages.");

                this.pdfFilenameDisplay.textContent = file.name;
                this.totalPagesDisplay.textContent = this.pdfDoc.numPages;
                this.currentPageNum = 1;
                this.detectedPrices = []; // Initialize/clear previous prices

                // Call detect-prices endpoint
                const formData = new FormData();
                formData.append('file', file); // 'file' needs to be the File object

                try {
                    const response = await fetch('/detect-prices', {
                        method: 'POST',
                        body: formData
                    });
                    if (response.ok) {
                        const priceData = await response.json();
                        const rawPrices = priceData.prices || [];
                        this.detectedPrices = rawPrices.map(price => ({
                            ...price,
                            originalText: price.text, // Store original server text
                            editedInSession: false,
                            currentDisplayText: price.text, // Initially same as original
                            currentColor: this.settings.getInitialColor() // Initial color
                        }));
                        console.log("Processed prices with initial state:", this.detectedPrices);
                    } else {
                        console.error("Error detecting prices:", response.statusText);
                        // Optionally inform user
                    }
                } catch (fetchError) {
                    console.error("Network error or server not responding:", fetchError);
                    // Optionally inform user
                }
                
                // Proceed with rendering
                await this.renderPage(this.currentPageNum); 
                await this.renderThumbnails();
                this.setZoom(1.0); // Reset zoom to 100% and render
            } catch (error) {
                console.error("Error loading PDF data:", error);
                this.pdfFilenameDisplay.textContent = `Error loading ${file.name}`;
                this.totalPagesDisplay.textContent = '0';
                this.currentPageInput.value = '1';
                if (this.thumbnailViewContainer) this.thumbnailViewContainer.innerHTML = 'Error loading PDF.';
            }
        };
        reader.onerror = (error) => {
            console.error("FileReader error:", error);
            this.pdfFilenameDisplay.textContent = "Error reading file.";
        };
        reader.readAsArrayBuffer(file);
    }

    async renderPage(pageNumToRender, zoomLevel = this.currentZoom) {
        if (!this.pdfDoc) {
            console.warn("renderPage: PDF not loaded.");
            return;
        }
        if (pageNumToRender < 1 || pageNumToRender > this.pdfDoc.numPages) {
            console.warn("renderPage: Page number out of range.", pageNumToRender);
            this.currentPageInput.value = this.currentPageNum; // Reset input to valid current page
            return;
        }
        
        this.currentPageNum = pageNumToRender;
        this.currentZoom = Math.max(0.1, Math.min(zoomLevel, 5.0)); // Clamp zoom
        this.currentPageInput.value = this.currentPageNum;

        try {
            const page = await this.pdfDoc.getPage(this.currentPageNum);
            const viewport = page.getViewport({ scale: this.currentZoom });

            this.canvas.height = viewport.height;
            this.canvas.width = viewport.width;
            
            // The #pdf-viewer (parent of #pdfView) has overflow: auto and padding.
            // The #pdfView (this.viewerContainer) contains the canvas.
            // No specific styling needed for viewerContainer itself if canvas dictates size and parent handles scroll.
            // this.viewerContainer.style.width = `${viewport.width}px`;
            // this.viewerContainer.style.height = `${viewport.height}px`;

            const renderContext = {
                canvasContext: this.ctx,
                viewport: viewport
            };
            await page.render(renderContext).promise;
            console.log(`Page ${this.currentPageNum} rendered at ${this.currentZoom * 100}% zoom.`);
            this.updateActiveThumbnail();
            this.renderPriceOverlays(page, viewport); // Add this call
        } catch (error) {
            console.error(`Error rendering page ${this.currentPageNum}:`, error);
        }
        this.updateZoomDisplay(); // Ensure zoom display is always current
    }

    renderPriceOverlays(pdfPage, viewport) {
        if (!this.detectedPrices || !this.priceOverlayContainer || !this.settings) {
            console.warn("Price data, overlay container, or settings not available for rendering overlays.");
            return;
        }

        // Clear previous overlays for this page
        this.priceOverlayContainer.innerHTML = '';

        // const initialColor = this.settings.getInitialColor(); // No longer needed here directly
        const priceFontSize = this.settings.getPriceFontSize(); // Still needed

        this.detectedPrices.forEach((price, index) => { // Added index
            if (price.page === this.currentPageNum) {
                // The coordinates from PyMuPDF are typically from the PDF's own coordinate system (often points, 72 DPI).
                // The origin (0,0) is usually bottom-left for PDF, but PyMuPDF's `get_text("blocks")` provides top-left for blocks.
                // We need to scale these to the canvas's current viewport.
                
                // PyMuPDF's block coordinates [x0, y0, x1, y1] are from top-left of the page.
                // The viewport.convertToViewportPoint([x, y]) converts PDF page coordinates to viewport coordinates.
                // The PDF page origin for text extraction is usually top-left. Viewport origin is also top-left.
                const [canvasX, canvasY] = viewport.convertToViewportPoint([price.x, price.y]);
                const [canvasX1, canvasY1] = viewport.convertToViewportPoint([price.x + price.width, price.y + price.height]);

                const overlay = document.createElement('div');
                overlay.classList.add('price-overlay');
                overlay.style.position = 'absolute';
                
                overlay.style.left = `${canvasX}px`;
                overlay.style.top = `${canvasY}px`;
                overlay.style.width = `${canvasX1 - canvasX}px`; // Scaled width
                overlay.style.height = `${canvasY1 - canvasY}px`; // Scaled height
                
                overlay.textContent = price.currentDisplayText; // Use currentDisplayText
                overlay.style.color = price.currentColor; // Use currentColor
                overlay.style.fontSize = `${priceFontSize}px`; // Use settings font size
                
                // Keep background and border for now, or make them dynamic based on state
                overlay.style.backgroundColor = price.editedInSession ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 255, 0, 0.1)'; 
                overlay.style.border = `1px dashed ${price.editedInSession ? 'green' : 'red'}`;


                overlay.dataset.priceIndex = index; // Store index

                // Remove existing listener before adding a new one
                // A more robust way is to store the handler function if it's bound, or use a unique ID if needed
                // For now, we assume simple replacement on full re-render of overlays is okay.
                // If overlays are updated individually, this becomes more critical.
                // Let's assume renderPriceOverlays clears and recreates all overlays for the page,
                // so old listeners are naturally discarded. If not, this needs attention.
                // Given priceOverlayContainer.innerHTML = '' at the start, old listeners are gone.

                overlay.addEventListener('dblclick', (event) => this.handlePriceDoubleClick(event));

                this.priceOverlayContainer.appendChild(overlay);
            }
        });
    }

    handlePriceDoubleClick(event) {
        const overlayDiv = event.currentTarget; // Use currentTarget for the element listener was attached to
        const priceIndex = parseInt(overlayDiv.dataset.priceIndex, 10);

        if (isNaN(priceIndex) || priceIndex < 0 || priceIndex >= this.detectedPrices.length) {
            console.error("Invalid price index from double click event:", overlayDiv.dataset.priceIndex);
            return;
        }

        const priceObject = this.detectedPrices[priceIndex];

        if (priceObject.editedInSession === true) {
            this.showTemporaryNotification(window.translator.getString('notificationPriceEdited'), event.clientX, event.clientY);
            return;
        }

        // Not edited yet, proceed to calculate and update
        let currentPriceValue;
        try {
            // Attempt to parse originalText, which should be the server-provided numeric string
            currentPriceValue = parseFloat(priceObject.originalText.replace(',', '.')); 
            if (isNaN(currentPriceValue)) {
                throw new Error("Original price text is not a valid number.");
            }
        } catch (e) {
            console.error("Could not parse original price:", priceObject.originalText, e);
            this.showTemporaryNotification(window.translator.getString('notificationInvalidPrice'), event.clientX, event.clientY);
            return;
        }
        
        const margin = this.settings.getMarginPercentage() / 100;
        const newPrice = currentPriceValue * (1 + margin);
        const newPriceFormatted = newPrice.toFixed(2); // Format to 2 decimal places

        // Update priceObject state
        priceObject.previousDisplayText = priceObject.currentDisplayText;
        priceObject.previousColor = priceObject.currentColor;
        priceObject.currentDisplayText = newPriceFormatted;
        priceObject.currentColor = this.settings.getEditedColor();
        priceObject.editedInSession = true;
        this.lastEditedPriceIndex = priceIndex; // Store for undo

        // Directly update the overlay's appearance
        overlayDiv.textContent = priceObject.currentDisplayText;
        overlayDiv.style.color = priceObject.currentColor;
        overlayDiv.style.fontSize = `${this.settings.getPriceFontSize()}px`; // Ensure font size is reapplied
        // Update background/border to reflect edited state, consistent with renderPriceOverlays
        overlayDiv.style.backgroundColor = 'rgba(0, 255, 0, 0.1)'; 
        overlayDiv.style.border = '1px dashed green';


        console.log(`Price at index ${priceIndex} updated to ${newPriceFormatted}`);
        // No full re-render of all overlays to keep it simple for now, just direct update.
        // If a full re-render was desired:
        // (async () => {
        //     const page = await this.pdfDoc.getPage(this.currentPageNum);
        //     const viewport = page.getViewport({ scale: this.currentZoom });
        //     this.renderPriceOverlays(page, viewport);
        // })();
    }

    showTemporaryNotification(message, x, y) {
        const notification = document.createElement('div');
        notification.classList.add('temporary-notification'); // For CSS styling if preferred
        
        // Basic styling - can be enhanced via CSS class
        notification.style.position = 'fixed';
        notification.style.left = `${x + 15}px`; // Offset from cursor
        notification.style.top = `${y + 15}px`;  // Offset from cursor
        notification.style.backgroundColor = 'rgba(51, 51, 51, 0.9)'; // #333 with opacity
        notification.style.color = 'white';
        notification.style.padding = '8px 15px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '2000'; // Ensure it's above other elements
        notification.style.opacity = '1';
        notification.style.transition = 'opacity 0.5s ease-out';
        notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        notification.style.fontSize = '14px';

        notification.textContent = message;
        document.body.appendChild(notification);

        // Start fade out after a delay
        setTimeout(() => {
            notification.style.opacity = '0';
        }, 2000); // Message visible for 2 seconds

        // Remove from DOM after fade out transition
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2500); // 2s visible + 0.5s fade out
    }

    undoLastEdit() {
        if (this.lastEditedPriceIndex === null || this.lastEditedPriceIndex < 0 || this.lastEditedPriceIndex >= this.detectedPrices.length) {
            this.showTemporaryNotification(window.translator.getString('notificationNothingToUndo'), 
                (this.viewerContainer.offsetLeft + this.viewerContainer.offsetWidth / 2), 
                (this.viewerContainer.offsetTop + 20)); // Centered-ish notification
            return;
        }

        const priceObject = this.detectedPrices[this.lastEditedPriceIndex];

        // Check if the price was actually edited and has a state to revert to
        if (!priceObject.editedInSession || priceObject.previousDisplayText === undefined || priceObject.previousColor === undefined) {
            // This might happen if editedInSession was true but previous states weren't set,
            // or if it's called on a non-edited item.
            this.showTemporaryNotification(window.translator.getString('notificationNothingToUndo'), // Or a more specific message
                (this.viewerContainer.offsetLeft + this.viewerContainer.offsetWidth / 2), 
                (this.viewerContainer.offsetTop + 20));
            this.lastEditedPriceIndex = null; // Clear it as it's not a valid undo target
            return;
        }

        // Revert priceObject properties
        priceObject.currentDisplayText = priceObject.previousDisplayText;
        priceObject.currentColor = priceObject.previousColor;
        priceObject.editedInSession = false; // Mark as not edited in this session anymore

        // Clear the stored previous state as it's now been used for undo
        delete priceObject.previousDisplayText;
        delete priceObject.previousColor;

        // Update UI for the specific overlay
        // Find the overlay element. Assumes priceOverlayContainer is populated and visible.
        const overlayToUpdate = this.priceOverlayContainer.querySelector(`.price-overlay[data-price-index="${this.lastEditedPriceIndex}"]`);

        if (overlayToUpdate) {
            overlayToUpdate.textContent = priceObject.currentDisplayText;
            overlayToUpdate.style.color = priceObject.currentColor;
            overlayToUpdate.style.fontSize = `${this.settings.getPriceFontSize()}px`;
            // Revert background/border to reflect non-edited state, consistent with renderPriceOverlays
            overlayToUpdate.style.backgroundColor = 'rgba(255, 255, 0, 0.1)'; 
            overlayToUpdate.style.border = '1px dashed red';
            
            console.log(`Undo applied to price at index ${this.lastEditedPriceIndex}.`);
        } else {
            console.warn(`Could not find overlay to update for index ${this.lastEditedPriceIndex}. A full re-render might be needed.`);
            // Fallback or error: if direct update fails, might need a full re-render
            // This requires async context if renderPage is called:
            // (async () => {
            //     const page = await this.pdfDoc.getPage(this.currentPageNum);
            //     const viewport = page.getViewport({ scale: this.currentZoom });
            //     this.renderPriceOverlays(page, viewport);
            // })();
        }
        
        this.showTemporaryNotification(window.translator.getString('notificationLastEditUndone'), 
            (this.viewerContainer.offsetLeft + this.viewerContainer.offsetWidth / 2), 
            (this.viewerContainer.offsetTop + 20));
        this.lastEditedPriceIndex = null; // Reset after undo
    }

    async handleDownloadPdf() {
        if (!this.originalPdfFile) {
            this.showTemporaryNotification(window.translator.getString('notificationNoOriginalPdf'), 
                (this.viewerContainer.offsetLeft + this.viewerContainer.offsetWidth / 2), 
                (this.viewerContainer.offsetTop + 20));
            return;
        }
        if (!this.detectedPrices || this.detectedPrices.length === 0) {
            this.showTemporaryNotification(window.translator.getString('notificationNoPricesDetected'),
                (this.viewerContainer.offsetLeft + this.viewerContainer.offsetWidth / 2), 
                (this.viewerContainer.offsetTop + 20));
            return;
        }

        const priceDataForServer = this.detectedPrices.map(price => ({
            originalText: price.originalText,
            text: price.currentDisplayText, // This is the potentially edited text
            x: price.x,
            y: price.y,
            width: price.width,
            height: price.height,
            page: price.page,
            // Include editedInSession if server needs to know which ones changed,
            // though server task description implies it processes all items in priceData
        }));

        const formData = new FormData();
        formData.append('pdfFile', this.originalPdfFile);
        formData.append('priceData', JSON.stringify(priceDataForServer));
        formData.append('savedColor', this.settings.getSavedColor());
        formData.append('priceFontSize', this.settings.getPriceFontSize().toString()); // Ensure it's a string

        try {
            this.showTemporaryNotification(window.translator.getString('notificationPreparingPdf'), 
                (this.viewerContainer.offsetLeft + this.viewerContainer.offsetWidth / 2), 
                (this.viewerContainer.offsetTop + 20));

            const response = await fetch('/modify-pdf', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'modified_catalog.pdf'; // Or generate a more dynamic name
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                this.showTemporaryNotification(window.translator.getString('notificationDownloadStarted'), 
                    (this.viewerContainer.offsetLeft + this.viewerContainer.offsetWidth / 2), 
                    (this.viewerContainer.offsetTop + 20));

                // After initiating download, update colors and reset editedInSession state
                const savedColor = this.settings.getSavedColor();
                this.detectedPrices.forEach(price => {
                    price.currentColor = savedColor;
                    price.editedInSession = false; // Reset session edit state
                    // Keep currentDisplayText as is, as it's now "saved"
                    // Remove previousDisplayText/Color as they are no longer relevant for undo
                    delete price.previousDisplayText;
                    delete price.previousColor;
                });
                this.lastEditedPriceIndex = null; // Clear last edit index as session state is reset

                // Re-render current page overlays
                if (this.pdfDoc && this.currentPageNum) {
                    // Simpler: just call renderPage which handles overlays
                     this.renderPage(this.currentPageNum);
                }

            } else {
                const errorText = await response.text();
                console.error("Error modifying PDF:", response.status, errorText);
                const baseMessage = window.translator.getString('notificationErrorModifyingPdf');
                this.showTemporaryNotification(`${baseMessage}: ${errorText || response.statusText}`, 
                    (this.viewerContainer.offsetLeft + this.viewerContainer.offsetWidth / 2), 
                    (this.viewerContainer.offsetTop + 20));
            }
        } catch (error) {
            console.error("Network error or server not responding during PDF modification:", error);
            this.showTemporaryNotification(window.translator.getString('notificationNetworkError'), 
                (this.viewerContainer.offsetLeft + this.viewerContainer.offsetWidth / 2), 
                (this.viewerContainer.offsetTop + 20));
        }
    }

    async refreshCurrentPageOverlays() {
        if (!this.pdfDoc || !this.currentPageNum) {
            console.warn("Cannot refresh overlays: PDF not loaded or no current page.");
            return;
        }
        try {
            const page = await this.pdfDoc.getPage(this.currentPageNum);
            // Use the same viewport calculation as in renderPage
            const viewport = page.getViewport({ scale: this.currentZoom }); 
            this.renderPriceOverlays(page, viewport);
            console.log("Price overlays refreshed for page", this.currentPageNum);
        } catch (error) {
            console.error("Error refreshing overlays:", error);
        }
    }

    async renderThumbnails() {
        if (!this.pdfDoc || !this.thumbnailViewContainer) return;
        this.thumbnailViewContainer.innerHTML = ''; // Clear existing thumbnails
        console.log("Rendering thumbnails...");

        const maxThumbnails = this.pdfDoc.numPages; // Render all thumbnails as per current CSS (scrollable)

        for (let i = 1; i <= maxThumbnails; i++) {
            try {
                const page = await this.pdfDoc.getPage(i);
                const thumbnailCanvas = document.createElement('canvas');
                thumbnailCanvas.classList.add('thumbnail-canvas');
                const thumbnailCtx = thumbnailCanvas.getContext('2d');
                
                // Fixed width for thumbnails, calculate scale to maintain aspect ratio
                const desiredWidth = 150; // Matches CSS max-width for .thumbnail-canvas
                const viewportOptions = { scale: 1 }; // Get natural scale viewport first
                let viewport = page.getViewport(viewportOptions);
                const scale = desiredWidth / viewport.width;
                viewport = page.getViewport({scale: scale});

                thumbnailCanvas.height = viewport.height;
                thumbnailCanvas.width = viewport.width;

                const renderContext = {
                    canvasContext: thumbnailCtx,
                    viewport: viewport
                };
                await page.render(renderContext).promise;

                thumbnailCanvas.dataset.pageNumber = i;
                thumbnailCanvas.addEventListener('click', (event) => {
                    const pageNum = parseInt(event.currentTarget.dataset.pageNumber);
                    this.renderPage(pageNum); // This will call updateActiveThumbnail
                });
                this.thumbnailViewContainer.appendChild(thumbnailCanvas);
                if (i === this.currentPageNum) {
                    this.setActiveThumbnailStyle(thumbnailCanvas);
                }
            } catch (error) {
                console.error(`Error rendering thumbnail for page ${i}:`, error);
                const errorThumb = document.createElement('div');
                errorThumb.textContent = `Error page ${i}`;
                errorThumb.classList.add('thumbnail-error'); // Assumes CSS class exists
                this.thumbnailViewContainer.appendChild(errorThumb);
            }
        }
        console.log("Thumbnails rendered.");
        this.updateActiveThumbnail(); // Initial active state
    }
    
    setActiveThumbnailStyle(canvasElement) {
        if (this.activeThumbnail) {
            this.activeThumbnail.classList.remove('active-thumbnail');
        }
        if (canvasElement) {
            canvasElement.classList.add('active-thumbnail');
            this.activeThumbnail = canvasElement;
            // Scroll into view if needed
            this.activeThumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            this.activeThumbnail = null;
        }
    }

    updateActiveThumbnail() {
        if (!this.thumbnailViewContainer) return;
        const newActiveThumbnail = this.thumbnailViewContainer.querySelector(`.thumbnail-canvas[data-page-number="${this.currentPageNum}"]`);
        this.setActiveThumbnailStyle(newActiveThumbnail);
    }


    prevPage() {
        if (this.pdfDoc && this.currentPageNum > 1) {
            this.renderPage(this.currentPageNum - 1);
        }
    }

    nextPage() {
        if (this.pdfDoc && this.currentPageNum < this.pdfDoc.numPages) {
            this.renderPage(this.currentPageNum + 1);
        }
    }

    goToPage(event) { // Assumes event is from input field 'change' or 'blur'
        if (!this.pdfDoc) return;
        const inputElem = event.target;
        let newPageNum = parseInt(inputElem.value);

        if (!isNaN(newPageNum) && newPageNum >= 1 && newPageNum <= this.pdfDoc.numPages) {
            this.renderPage(newPageNum);
        } else {
            // Reset to current page if input is invalid
            inputElem.value = this.currentPageNum;
            console.warn("Invalid page number entered:", newPageNum);
        }
    }

    zoomIn() {
        if (!this.pdfDoc) return;
        this.setZoom(this.currentZoom + 0.1);
    }

    zoomOut() {
        if (!this.pdfDoc) return;
        this.setZoom(this.currentZoom - 0.1);
    }
    
    setZoom(newZoomLevel) { // Centralized zoom logic
        if (!this.pdfDoc) { // If no doc, just store and update display
             this.currentZoom = Math.max(0.1, Math.min(newZoomLevel, 5.0));
             this.updateZoomDisplay();
             return;
        }
        // Clamp zoom level
        this.currentZoom = Math.max(0.1, Math.min(newZoomLevel, 5.0)); 
        this.renderPage(this.currentPageNum, this.currentZoom); // renderPage will update display
    }

    setZoomFromInput(event) { // Assumes event is from input field 'change' or 'blur'
        const inputElem = event.target;
        let newZoom = parseFloat(inputElem.value.replace('%', '')) / 100;
        if (!isNaN(newZoom) && newZoom > 0) {
            this.setZoom(newZoom);
        } else {
            this.updateZoomDisplay(); // Reset to current zoom if input is invalid
            console.warn("Invalid zoom percentage entered:", inputElem.value);
        }
    }
    
    updateZoomDisplay() {
        this.zoomPercentageInput.value = `${Math.round(this.currentZoom * 100)}%`;
    }
}

// pdfjsLib.GlobalWorkerOptions.workerSrc should be set in index.html or main app script
// This ensures it's configured before any PDF.js operations are attempted.
// Example: pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
// This was confirmed to be in index.html.

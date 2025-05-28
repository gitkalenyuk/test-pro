# PDF Price Editor

## Description
The PDF Price Editor is a web-based application designed for interactively editing prices within PDF product catalogs. Users can upload a PDF, have prices automatically detected, apply a margin to recalculate them, and then download a new PDF with the updated prices. The application supports multiple languages and allows customization of various display settings.

## Features
*   **PDF Upload and Viewing:** Upload PDF files directly in the browser. View PDFs with page thumbnails, direct page navigation, and zoom controls.
*   **Automated Price Detection:** Server-side engine analyzes the PDF to identify and locate numerical price strings.
*   **Visual Highlighting:** Detected prices are visually highlighted on the PDF with a configurable initial color and font size.
*   **Margin-based Price Recalculation:** Users can set a margin percentage, which is used for calculating new prices.
*   **Interactive Price Editing:** Double-click on a detected price to apply the current margin. The price text and color update to reflect the change.
*   **Undo Functionality:** Revert the last price modification made in the current session.
*   **Download Modified PDF:** Generate and download a new PDF document where original prices are replaced with their edited values, using a configurable "saved" color and font size.
*   **Persistent Settings Management:** Customize and save preferences for:
    *   Initial display color for detected prices.
    *   Color for prices after editing.
    *   Color for prices in the final saved PDF.
    *   Font size for all displayed price text.
    *   Margin percentage.
    *   User interface language.
    Settings are stored in the browser's `localStorage`.
*   **Multi-Language Support:** The user interface is available in English, Ukrainian (Українська), and Italian (Italiano). Translations are managed via JSON files.
*   **Basic UI Log Console:** The HTML/CSS structure for a UI log console is in place (though full JavaScript integration was not completed).

## Technology Stack
*   **Frontend:** HTML5, CSS3, JavaScript (ES6+), [PDF.js](https://mozilla.github.io/pdf.js/) (for PDF rendering)
*   **Backend:** Python 3.x, Flask (for the HTTP server and API endpoints), [PyMuPDF (fitz)](https://pymupdf.readthedocs.io/) (for PDF parsing, text extraction, and modification)
*   **Data Persistence:** Browser `localStorage` (for user settings).

## Prerequisites
*   Python 3.7 or newer.
*   `pip` (Python package installer), usually included with Python.
*   A modern web browser that supports HTML5, CSS3, and JavaScript (e.g., Chrome, Firefox, Edge, Safari).

## Backend Setup Instructions
1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```
    *(Replace `<repository_url>` and `<repository_directory>` with actual values if known, otherwise leave as placeholders for the user to fill in.)*
2.  **Navigate to Server Directory:**
    ```bash
    cd server
    ```
3.  **Create and Activate a Virtual Environment (Recommended):**
    *   On macOS and Linux:
        ```bash
        python3 -m venv venv
        source venv/bin/activate
        ```
    *   On Windows:
        ```bash
        python -m venv venv
        .\venv\Scripts\activate
        ```
4.  **Install Dependencies:**
    Ensure you have a `requirements.txt` file in the `server` directory with the following content:
    ```txt
    Flask
    PyMuPDF
    ```
    Then run:
    ```bash
    pip install -r requirements.txt
    ```
5.  **Run the Flask Development Server:**
    ```bash
    flask run
    ```
    By default, this usually starts the server on `http://120.0.0.1:5000/`. The console output will indicate the address. This server must be running for the frontend to perform price detection and PDF modification.

## Frontend Setup/Running Instructions
1.  **Ensure Backend is Running:** The Python Flask server (from Backend Setup) must be running.
2.  **Open in Browser:**
    *   Navigate to the root directory of the cloned project (where `index.html` is located).
    *   Open the `index.html` file directly in your web browser (e.g., "File" > "Open File..." or drag-and-drop).

    *Alternatively, for a more robust setup that avoids potential browser restrictions with `file:///` URLs:*
    *   From the root project directory, you can serve the frontend files using a simple HTTP server. If you have Python installed, you can run:
        ```bash
        python -m http.server 8000
        ```
        Then, open `http://localhost:8000/` in your browser.

## Configuration
*   **User Settings:** Most application settings (UI language, price display colors, price font size, and margin percentage) are configurable directly through the application's toolbar. These settings are automatically saved in your browser's `localStorage` and will persist across sessions.
*   **Language Files:** Translations are managed via JSON files located in the `assets/translations/` directory (e.g., `en.json`, `uk.json`, `it.json`). To add or modify translations, edit these files.

## Known Issues/Limitations
*   **Client-Side Logging Integration:** The UI Log Console's full JavaScript integration (instantiation and use in `app.js` and `pdf-viewer.js`) and the enhancement of developer console logging in `pdf-viewer.js` were not completed due to persistent 'Invalid merge diff' technical issues encountered during development. Server-side logging is functional.
*   **Font Matching in Modified PDF:** When prices are modified and a new PDF is downloaded, the font face of the new price text might not exactly match the original font from the PDF. The configured font size and color are applied, but the font family may differ based on PDF defaults or available fonts on the server.
*   **Complex PDF Structures:** The accuracy of automated price detection may vary with highly complex PDF layouts, scanned documents (if not OCR'd with selectable text), or prices embedded directly within images rather than as text elements.
```

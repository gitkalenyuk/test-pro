import io
import re
from flask import Flask, request, jsonify
import fitz # PyMuPDF
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    handlers=[logging.FileHandler("server.log"),
                              logging.StreamHandler()])

app = Flask(__name__)
app.logger.addHandler(logging.getLogger().handlers[0]) # File handler
app.logger.addHandler(logging.getLogger().handlers[1]) # Stream handler
app.logger.setLevel(logging.INFO)


# Regex to find numbers that can be prices (integers or decimals with 1-2 places, using . or ,)
# It captures the number itself.
# It allows for optional thousands separators (',') that are not part of the captured group.
# It does not capture currency symbols but allows them to be adjacent.
PRICE_REGEX = re.compile(
    r"(?:[$\€\£\₹\₪\₴\¥\₩\₺\₽\元\円\฿\₱\₫\₭\₮\₦\₡\₲\₵\₸\₴\₺]|\b(?:USD|EUR|GBP|INR|ILS|UAH|JPY|KRW|TRY|RUB)\b\s*)?" # Optional currency symbol or code
    r"(\d{1,3}(?:[,.]\d{3})*|\d+)" # Integer part, allows for comma/dot as thousands separator (not captured) or just digits
    r"([.,]\d{1,2})?" # Optional decimal part (captured)
    r"(?:\s*[$\€\£\₹\₪\₴\¥\₩\₺\₽\元\円\฿\₱\₫\₭\₮\₦\₡\₲\₵\₸\₴\₺]|\b(?:USD|EUR|GBP|INR|ILS|UAH|JPY|KRW|TRY|RUB)\b)?" # Optional currency symbol or code
)

def extract_prices_from_pdf(pdf_file_stream):
    prices = []
    try:
        app.logger.info(f"Detecting prices for file: {pdf_file_stream.name if hasattr(pdf_file_stream, 'name') else 'N/A'}")
        doc = fitz.open(stream=pdf_file_stream, filetype="pdf")
        for page_num_zero_indexed in range(len(doc)):
            page = doc.load_page(page_num_zero_indexed)
            page_num_one_indexed = page_num_zero_indexed + 1
            
            # Get text blocks with coordinates
            blocks = page.get_text("blocks") # format: [x0, y0, x1, y1, "text", block_no, block_type]
            
            for block in blocks:
                text = block[4]
                x0, y0, x1, y1 = block[:4]
                
                # Search for prices in the text of the block
                # Since PyMuPDF gives text blocks, we process the whole block text
                # This is simpler than word-by-word, but might be less precise for multi-price blocks.
                # For this task, we'll assume one price per identified numerical match in a block is fine.

                for match in PRICE_REGEX.finditer(text):
                    integer_part = match.group(1).replace(',', '').replace('.', '') # Normalize thousands separators
                    decimal_part = match.group(2)
                    
                    if decimal_part:
                        # Normalize decimal separator to '.'
                        price_text = f"{integer_part}{decimal_part.replace(',', '.')}"
                    else:
                        price_text = integer_part

                    # Basic validation: try converting to float. If it fails, it's likely not a valid price.
                    try:
                        float(price_text) 
                    except ValueError:
                        continue # Not a valid number, skip

                    # Estimate coordinates for the matched price text. 
                    # This is an approximation. For more accuracy, word-level coordinates would be needed.
                    # Here, we use the block's coordinates. If multiple prices in a block, they'll share coords.
                    prices.append({
                        "page": page_num_one_indexed,
                        "text": price_text, # This is already the normalized text
                        "x": x0,
                        "y": y0,
                        "width": x1 - x0,
                        "height": y1 - y0,
                        "block_text": text # For debugging
                    })
        doc.close()
    except Exception as e:
        app.logger.error(f"Error processing PDF during price extraction: {e}", exc_info=True)
        # Optionally, re-raise or handle specific PyMuPDF errors
    app.logger.info(f"Detected {len(prices)} prices in total.")
    return prices

@app.route('/detect-prices', methods=['POST'])
def detect_prices_endpoint():
    if 'file' not in request.files:
        app.logger.warn("Request to /detect-prices missing file part.")
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        app.logger.warn("Request to /detect-prices with no selected file.")
        return jsonify({"error": "No selected file"}), 400

    if file and file.filename.lower().endswith('.pdf'):
        app.logger.info(f"Received file for price detection: {file.filename}")
        try:
            pdf_stream_bytes = file.read() # Read bytes once
            pdf_stream = io.BytesIO(pdf_stream_bytes)
            # Pass the filename to extract_prices_from_pdf for logging if needed
            # For now, filename is logged here.
            detected_prices = extract_prices_from_pdf(pdf_stream) 
            
            app.logger.info(f"Successfully detected {len(detected_prices)} prices in {file.filename}.")
            return jsonify({
                "filename": file.filename,
                "prices": detected_prices
            })
        except Exception as e:
            app.logger.error(f"Error in /detect-prices for file {file.filename}: {e}", exc_info=True)
            return jsonify({"error": "Failed to process PDF"}), 500
    else:
        app.logger.warn(f"Invalid file type for /detect-prices: {file.filename if file else 'N/A'}")
        return jsonify({"error": "Invalid file type, please upload a PDF"}), 400

if __name__ == '__main__':
    app.logger.info("Flask server starting...")
    # Note: For development, debug=True is fine. For production, use a proper WSGI server.
    app.run(debug=True, port=5000) # debug=True might affect custom logging level if not handled carefully.
                                 # For production, ensure debug=False.
                                 # Flask's default logger might also output, which is fine.

# Helper function to convert hex color string to a PyMuPDF color tuple
def hex_to_rgb_fitz(hex_color):
    """Converts a hex color string (e.g., "#RRGGBB") to a PyMuPDF color tuple (r/255, g/255, b/255)."""
    hex_color = hex_color.lstrip('#')
    if len(hex_color) != 6:
        # Default to black if format is invalid
        return (0, 0, 0) 
    try:
        r = int(hex_color[0:2], 16) / 255.0
        g = int(hex_color[2:4], 16) / 255.0
        b = int(hex_color[4:6], 16) / 255.0
        return (r, g, b)
    except ValueError:
        # Default to black on parsing error
        return (0, 0, 0)

@app.route('/modify-pdf', methods=['POST'])
def modify_pdf_endpoint():
    pdf_file = request.files.get('pdfFile')
    price_data_json = request.form.get('priceData')
    saved_color_hex = request.form.get('savedColor')
    price_font_size_str = request.form.get('priceFontSize')

    if not pdf_file:
        app.logger.warn("Request to /modify-pdf missing pdfFile part.")
        return jsonify({"error": "No PDF file part"}), 400
    if not price_data_json:
        app.logger.warn("Request to /modify-pdf missing priceData part.")
        return jsonify({"error": "No price data part"}), 400
    # savedColor and priceFontSize presence checked by client/defaulted
    
    app.logger.info(f"Received request to modify PDF: {pdf_file.filename}")
    app.logger.info(f"Color: {saved_color_hex}, Font Size: {price_font_size_str}")

    try:
        price_data = json.loads(price_data_json)
        app.logger.info(f"Number of price entries to process: {len(price_data)}")
        color_tuple = hex_to_rgb_fitz(saved_color_hex)
        font_size = float(price_font_size_str)
    except (json.JSONDecodeError, ValueError) as e:
        app.logger.error(f"Invalid input data for /modify-pdf: {e}", exc_info=True)
        return jsonify({"error": f"Invalid input data: {e}"}), 400

    try:
        doc = fitz.open(stream=pdf_file.read(), filetype="pdf") # Use pdf_file

        for price_info in price_data:
            page_num = int(price_info['page']) - 1  # 0-indexed
            if page_num < 0 or page_num >= doc.page_count:
                app.logger.warn(f"Invalid page number {price_info['page']} encountered in priceData. Skipping.")
                continue
            
            pdf_page = doc.load_page(page_num)
            
            x = float(price_info['x'])
            y = float(price_info['y'])
            width = float(price_info['width'])
            height = float(price_info['height'])
            new_text = str(price_info['text']) # Ensure it's a string

            rect = fitz.Rect(x, y, x + width, y + height)
            
            # 1. Redact (Cover Up) old text
            # Add a white filled rectangle. A more robust way might be page background color.
            # For simplicity, white is used.
            # pdf_page.draw_rect(rect, color=(1,1,1), fill=(1,1,1), overlay=True) 
            # Using add_redact_annot is cleaner if available and works as expected
            # However, apply_redactions can be slow if called per annotation.
            # For simplicity, let's try draw_rect first. If it has issues, switch to redaction.
            # PyMuPDF's draw_rect draws *under* existing content by default unless overlay=True.
            # We need to cover.
            
            # For covering, an alternative to redaction is to find the original text and remove it,
            # but this is very complex. Redaction or drawing over is more practical.
            # `add_redact_annot` and `apply_redactions` is the most robust way.
            # Let's group redactions by page.
            
            # The prompt suggests:
            # "Add a filled rectangle over the rect area with the page's background color (if easily determinable, otherwise white)."
            # Or, use pdf_page.add_redact_annot(rect, fill=True, text="") and then pdf_page.apply_redactions().
            # Let's go with add_redact_annot as it's generally cleaner.
            # We will add all redactions for a page, then apply them.

            # This part needs to be structured to collect all redactions for a page before applying.
            # For now, let's assume a simpler approach for this step, applying immediately,
            # or we'll need to refactor to group by page.
            # The task description implies processing per item.
            
            # Create a redaction annotation for the area
            redaction_annot = pdf_page.add_redact_annot(rect, text=" ", fill=(1,1,1)) # Fill with white
            # Apply redactions immediately for this specific annotation
            # Note: apply_redactions() without arguments applies all on page.
            # To apply only one, it's trickier. Usually, you add all, then apply all.
            # For simplicity and following the one-by-one processing:
            # pdf_page.apply_redactions() # This will apply ALL redaction annots on the page.
            # This might be okay if we process all items for a page, then move to next.
            # For now, let's assume we will apply all at the end or per page.
            # The current loop is per price_info.

        # Apply all redactions document-wide after iterating through all price_data
        # This is more efficient.
        for page_idx in range(doc.page_count):
            page_to_redact = doc.load_page(page_idx)
            # Check if there are any redaction annotations on this page before applying
            # This check is not straightforward. Let's assume apply_redactions() handles pages with no redactions gracefully.
            page_to_redact.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE) # images=0: Don't remove images


        # Second pass: Insert new text after all redactions are applied
        for price_info in price_data:
            page_num = int(price_info['page']) - 1
            if page_num < 0 or page_num >= doc.page_count:
                continue # Already warned

            pdf_page = doc.load_page(page_num)
            
            x = float(price_info['x'])
            y = float(price_info['y'])
            current_width = float(price_info['width']) # Width of original box
            current_height = float(price_info['height']) # Height of original box
            new_text = str(price_info['text'])

            # Define the rectangle for text insertion.
            # It should align with the original box, but height might need adjustment for new font size.
            # PyMuPDF's insert_textbox will handle text fitting.
            # Use current_width for the x1 coordinate of the insertion box
            rect_insert = fitz.Rect(x, y, x + current_width, y + current_height * 1.5) # Give some extra height

            # Align text. Default is left. For prices, often right or center.
            # Let's try right alignment.
            # PyMuPDF insert_textbox aligns text within the given rect.
            # For precise placement, one might need to calculate text width first if not using textbox.
            # Using text_rect.y0 + (text_rect.height - font_size) / 2 for vertical centering attempt if needed.
            # For now, default vertical alignment within the box.
            res = pdf_page.insert_textbox(rect_insert, new_text, 
                                          fontsize=font_size, 
                                          fontname="helv", # Using a standard font Helvetica
                                          color=color_tuple, 
                                          align=fitz.TEXT_ALIGN_RIGHT) # Align right
            if res < 0:
                app.logger.warn(f"Text for '{new_text}' on page {page_num+1} might have overflowed. Result code: {res}")


        output_stream = io.BytesIO()
        doc.save(output_stream, garbage=3, deflate=True) # garbage=3 to clean up
        doc.close()
        app.logger.info(f"Successfully modified PDF: {pdf_file.filename}")
        output_stream.seek(0)

        return send_file(output_stream, mimetype='application/pdf', 
                         as_attachment=True, download_name='modified_catalog.pdf')

    except Exception as e:
        app.logger.error(f"Error processing PDF for modification ({pdf_file.filename}): {e}", exc_info=True)
        return jsonify({"error": f"Failed to modify PDF: {e}"}), 500

# Need to import json and send_file
import json
from flask import send_file

const PDFDocument = require('pdfkit');
const logger = require('../utils/logger.js');

// Default page settings
const PAGE_SIZES = {
  letter: [612, 792],
  a4: [595.28, 841.89],
  legal: [612, 1008],
};

const DEFAULT_MARGINS = {
  top: 72,
  bottom: 72,
  left: 72,
  right: 72,
};

// Colors
const COLORS = {
  primary: '#2F4F4F',
  secondary: '#666666',
  text: '#333333',
  lightGray: '#CCCCCC',
  white: '#FFFFFF',
};

// Font sizes
const FONT_SIZES = {
  title: 18,
  subtitle: 14,
  heading: 12,
  body: 10,
  small: 8,
};

/**
 * Create a new PDF document with default settings
 * @param {object} options - PDFKit options
 * @returns {PDFDocument}
 */
function createDocument(options = {}) {
  const doc = new PDFDocument({
    size: options.size || 'letter',
    margins: options.margins || DEFAULT_MARGINS,
    bufferPages: true,
    autoFirstPage: true,
    ...options,
  });

  // Set default font
  doc.font('Helvetica');

  return doc;
}

/**
 * Stream PDF document to HTTP response
 * @param {PDFDocument} doc - The PDF document
 * @param {object} res - Express response object
 * @param {string} filename - Download filename (optional)
 */
function streamToResponse(doc, res, filename = 'document.pdf') {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

  doc.pipe(res);
  doc.end();
}

/**
 * Stream PDF document for download
 * @param {PDFDocument} doc - The PDF document
 * @param {object} res - Express response object
 * @param {string} filename - Download filename
 */
function downloadToResponse(doc, res, filename = 'document.pdf') {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  doc.pipe(res);
  doc.end();
}

/**
 * Convert PDF document to buffer
 * @param {PDFDocument} doc - The PDF document
 * @returns {Promise<Buffer>}
 */
function toBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/**
 * Embed an image buffer into the document
 * @param {PDFDocument} doc - The PDF document
 * @param {Buffer} buffer - Image buffer (PNG/JPEG)
 * @param {object} options - Position and size options
 */
function embedImage(doc, buffer, options = {}) {
  const {
    x = doc.x,
    y = doc.y,
    width,
    height,
    fit,
    align = 'center',
  } = options;

  const imgOptions = {};
  if (width) imgOptions.width = width;
  if (height) imgOptions.height = height;
  if (fit) imgOptions.fit = fit;
  if (align) imgOptions.align = align;

  doc.image(buffer, x, y, imgOptions);
}

/**
 * Add a standard header to the document
 * @param {PDFDocument} doc - The PDF document
 * @param {string} title - Main title
 * @param {string} subtitle - Subtitle (optional)
 * @param {object} options - Additional options
 */
function addHeader(doc, title, subtitle = '', options = {}) {
  const {
    logo,
    clinicName = 'MDSystem Medical Clinic',
    address = '',
    showLine = true,
  } = options;

  const startY = doc.y;

  // Logo (if provided)
  if (logo) {
    doc.image(logo, doc.page.margins.left, startY, { width: 50 });
    doc.x = doc.page.margins.left + 60;
  }

  // Clinic name
  doc
    .fontSize(FONT_SIZES.subtitle)
    .fillColor(COLORS.primary)
    .font('Helvetica-Bold')
    .text(clinicName, { align: 'center' });

  // Address
  if (address) {
    doc
      .fontSize(FONT_SIZES.small)
      .fillColor(COLORS.secondary)
      .font('Helvetica')
      .text(address, { align: 'center' });
  }

  doc.moveDown(0.5);

  // Document title
  doc
    .fontSize(FONT_SIZES.title)
    .fillColor(COLORS.primary)
    .font('Helvetica-Bold')
    .text(title, { align: 'center' });

  // Subtitle
  if (subtitle) {
    doc
      .fontSize(FONT_SIZES.body)
      .fillColor(COLORS.secondary)
      .font('Helvetica')
      .text(subtitle, { align: 'center' });
  }

  // Divider line
  if (showLine) {
    doc.moveDown(0.5);
    const lineY = doc.y;
    doc
      .strokeColor(COLORS.lightGray)
      .lineWidth(1)
      .moveTo(doc.page.margins.left, lineY)
      .lineTo(doc.page.width - doc.page.margins.right, lineY)
      .stroke();
  }

  doc.moveDown();
  doc.fillColor(COLORS.text).font('Helvetica');
}

/**
 * Add a footer with page numbers
 * @param {PDFDocument} doc - The PDF document
 * @param {object} options - Footer options
 */
function addFooter(doc, options = {}) {
  const {
    text = '',
    showPageNumbers = true,
    showDate = true,
  } = options;

  const pages = doc.bufferedPageRange();

  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    const footerY = doc.page.height - doc.page.margins.bottom + 20;

    // Footer text (left)
    if (text) {
      doc
        .fontSize(FONT_SIZES.small)
        .fillColor(COLORS.secondary)
        .text(text, doc.page.margins.left, footerY, {
          width: 200,
          align: 'left',
        });
    }

    // Date (center)
    if (showDate) {
      const dateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      doc
        .fontSize(FONT_SIZES.small)
        .fillColor(COLORS.secondary)
        .text(dateStr, 0, footerY, {
          width: doc.page.width,
          align: 'center',
        });
    }

    // Page numbers (right)
    if (showPageNumbers && pages.count > 1) {
      doc
        .fontSize(FONT_SIZES.small)
        .fillColor(COLORS.secondary)
        .text(
          `Page ${i + 1} of ${pages.count}`,
          doc.page.width - doc.page.margins.right - 100,
          footerY,
          { width: 100, align: 'right' }
        );
    }
  }
}

/**
 * Add a section heading
 * @param {PDFDocument} doc - The PDF document
 * @param {string} title - Section title
 */
function addSectionHeading(doc, title) {
  doc
    .fontSize(FONT_SIZES.heading)
    .fillColor(COLORS.primary)
    .font('Helvetica-Bold')
    .text(title);
  doc.moveDown(0.3);
  doc.font('Helvetica').fillColor(COLORS.text);
}

/**
 * Add a labeled field (label: value)
 * @param {PDFDocument} doc - The PDF document
 * @param {string} label - Field label
 * @param {string} value - Field value
 * @param {object} options - Display options
 */
function addField(doc, label, value, options = {}) {
  const { inline = true, labelWidth = 120 } = options;

  if (inline) {
    const startX = doc.page.margins.left;
    const startY = doc.y;
    const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right - labelWidth;

    doc
      .fontSize(FONT_SIZES.body)
      .font('Helvetica-Bold')
      .fillColor(COLORS.secondary)
      .text(`${label}:`, startX, startY, { continued: false, width: labelWidth });

    doc
      .font('Helvetica')
      .fillColor(COLORS.text)
      .text(value || 'N/A', startX + labelWidth, startY, { width: availableWidth });

    // Reset x to left margin so the next field starts correctly
    doc.x = doc.page.margins.left;
  } else {
    doc
      .fontSize(FONT_SIZES.body)
      .font('Helvetica-Bold')
      .fillColor(COLORS.secondary)
      .text(`${label}:`);
    doc
      .font('Helvetica')
      .fillColor(COLORS.text)
      .text(value || 'N/A');
  }
}

/**
 * Add a simple table
 * @param {PDFDocument} doc - The PDF document
 * @param {string[]} headers - Table headers
 * @param {string[][]} rows - Table data rows
 * @param {object} options - Table options
 */
function addTable(doc, headers, rows, options = {}) {
  const {
    columnWidths,
    cellPadding = 5,
    headerBg = COLORS.primary,
    headerColor = COLORS.white,
    borderColor = COLORS.lightGray,
  } = options;

  const startX = doc.x;
  const startY = doc.y;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = columnWidths || headers.map(() => tableWidth / headers.length);

  let currentY = startY;

  // Header row
  doc.rect(startX, currentY, tableWidth, 20).fill(headerBg);
  let currentX = startX;
  headers.forEach((header, i) => {
    doc
      .fontSize(FONT_SIZES.body)
      .fillColor(headerColor)
      .font('Helvetica-Bold')
      .text(header, currentX + cellPadding, currentY + cellPadding, {
        width: colWidth[i] - cellPadding * 2,
        align: 'left',
      });
    currentX += colWidth[i];
  });
  currentY += 20;

  // Data rows
  doc.font('Helvetica').fillColor(COLORS.text);
  rows.forEach((row) => {
    currentX = startX;
    const rowHeight = 18;

    row.forEach((cell, i) => {
      doc
        .fontSize(FONT_SIZES.body)
        .text(String(cell || ''), currentX + cellPadding, currentY + cellPadding, {
          width: colWidth[i] - cellPadding * 2,
          align: 'left',
        });
      currentX += colWidth[i];
    });

    // Row border
    doc
      .strokeColor(borderColor)
      .lineWidth(0.5)
      .moveTo(startX, currentY + rowHeight)
      .lineTo(startX + tableWidth, currentY + rowHeight)
      .stroke();

    currentY += rowHeight;
  });

  doc.y = currentY + 10;
}

/**
 * Add signature line
 * @param {PDFDocument} doc - The PDF document
 * @param {string} name - Signer name
 * @param {string} title - Signer title
 * @param {object} options - Options
 */
function addSignatureLine(doc, name, title = '', options = {}) {
  const { x, width = 200, date = true } = options;
  const startX = x || (doc.page.width - width) / 2;

  doc.moveDown(2);
  const lineY = doc.y;

  // Signature line
  doc
    .strokeColor(COLORS.text)
    .lineWidth(1)
    .moveTo(startX, lineY)
    .lineTo(startX + width, lineY)
    .stroke();

  // Name
  doc
    .fontSize(FONT_SIZES.body)
    .font('Helvetica-Bold')
    .fillColor(COLORS.text)
    .text(name, startX, lineY + 5, { width, align: 'center' });

  // Title
  if (title) {
    doc
      .fontSize(FONT_SIZES.small)
      .font('Helvetica')
      .fillColor(COLORS.secondary)
      .text(title, { width, align: 'center' });
  }

  // Date line
  if (date) {
    doc.moveDown(0.5);
    doc
      .fontSize(FONT_SIZES.small)
      .fillColor(COLORS.secondary)
      .text(`Date: _________________`, { width, align: 'center' });
  }
}

module.exports = {
  createDocument,
  streamToResponse,
  downloadToResponse,
  toBuffer,
  embedImage,
  addHeader,
  addFooter,
  addSectionHeading,
  addField,
  addTable,
  addSignatureLine,
  PAGE_SIZES,
  DEFAULT_MARGINS,
  COLORS,
  FONT_SIZES,
};

const fs = require('fs');
const path = require('path');
const BaseTemplate = require('../base-template.js');
const pdf = require('../../pdfkit.js');

// A5 dimensions in points (1 mm = 2.8346 pt)
const A5_WIDTH  = 419.53;
const A5_HEIGHT = 595.28;
const MM = 2.8346;

const MARGINS = {
  top:    Math.round(12 * MM),
  bottom: Math.round(14 * MM),
  left:   Math.round(14 * MM),
  right:  Math.round(14 * MM),
};

// TIP logo — resolved from this file's location:
// templates/ → doc-generate-module/ → services/ → Backend/ → MDSystem/mds-staff/public/
const LOGO_PATH = path.resolve(
  __dirname,
  '../../../../mds-staff/public/tip_logoo.jpg',
);

/**
 * Prescription Template — A5 format matching the TIP prescription layout.
 */
class PrescriptionTemplate extends BaseTemplate {
  constructor(options = {}) {
    super({ size: [A5_WIDTH, A5_HEIGHT], margins: MARGINS, ...options });
  }

  static get type() { return 'prescription'; }
  static get displayName() { return 'Prescription'; }
  static get persistToDatabase() { return true; }

  static getSampleData() {
    return {
      ...super.getSampleData(),
      prescription: {
        medications: [
          {
            name: 'Amoxicillin 500mg',
            dosage: '1 capsule',
            frequency: '3 times a day',
            duration: '7 days',
            quantity: 21,
            instructions: 'Take after meals',
          },
          {
            name: 'Paracetamol 500mg',
            dosage: '1 tablet',
            frequency: 'Every 4-6 hours as needed',
            duration: 'PRN for fever',
            quantity: 10,
            instructions: 'For fever above 37.5°C',
          },
        ],
        specialInstructions: 'Complete the full course of antibiotics. Return if symptoms persist after 3 days.',
      },
    };
  }

  // Skip the base-class footer (page numbers / clinic name) for this template
  async toBuffer() {
    return pdf.toBuffer(this.doc);
  }
  streamToResponse(res, filename) {
    pdf.streamToResponse(this.doc, res, filename);
  }
  downloadToResponse(res, filename) {
    pdf.downloadToResponse(this.doc, res, filename);
  }

  async build() {
    this.init();
    this._drawHeader();
    this._drawRxDateRow();
    this._drawPatientInfo();
    this._drawMedications();
    this._drawNotes();
    this._drawSignature();
    return this;
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  get _lm() { return this.doc.page.margins.left; }
  get _rm() { return this.doc.page.margins.right; }
  get _uw() { return this.doc.page.width - this._lm - this._rm; }

  // ─── sections ───────────────────────────────────────────────────────────────

  _drawHeader() {
    const { doc } = this;
    const lm = this._lm;
    const uw = this._uw;
    const topY = doc.page.margins.top;

    // Load logo (fail silently)
    let logoBuf = null;
    try { logoBuf = fs.readFileSync(LOGO_PATH); } catch (_) { /* no logo */ }

    const logoSize  = 42;
    const logoGap   = 8;
    const textX     = logoBuf ? lm + logoSize + logoGap : lm;
    const textWidth = logoBuf ? uw - logoSize - logoGap  : uw;
    const textAlign = logoBuf ? 'left' : 'center';

    if (logoBuf) {
      doc.image(logoBuf, lm, topY, { width: logoSize, height: logoSize });
    }

    // Institution name
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#1a1a1a')
      .text('TECHNOLOGICAL INSTITUTE OF THE PHILIPPINES', textX, topY, {
        width: textWidth,
        align: textAlign,
        lineBreak: true,
      });

    // Address
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#555')
      .text('363 P. CASAL ST., QUIAPO, MANILA', textX, doc.y + 1, {
        width: textWidth,
        align: textAlign,
      });

    // Align the department line below the taller of logo or text block
    const afterText   = doc.y + 4;
    const afterLogo   = logoBuf ? topY + logoSize + 4 : 0;
    const deptY       = Math.max(afterText, afterLogo);

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#2F4F4F')
      .text('MEDICAL – DENTAL SERVICES', lm, deptY, { width: uw, align: 'center' });

    // Separator line
    const lineY = doc.y + 4;
    doc
      .strokeColor('#555')
      .lineWidth(0.8)
      .moveTo(lm, lineY)
      .lineTo(lm + uw, lineY)
      .stroke();

    doc.y = lineY + 8;
  }

  _drawRxDateRow() {
    const { doc } = this;
    const lm  = this._lm;
    const uw  = this._uw;
    const y   = doc.y;

    // Large italic Rx symbol (Times-BoldItalic)
    doc
      .font('Times-BoldItalic')
      .fontSize(28)
      .fillColor('#1a1a1a')
      .text('Rx', lm, y, { lineBreak: false });

    // DATE label + value (right-aligned)
    const dateStr    = this._formatDate(this.data.issuedDate);
    const dateBlockW = 170;
    const dateBlockX = lm + uw - dateBlockW;

    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor('#777')
      .text('DATE', dateBlockX, y + 4, { width: dateBlockW, align: 'right' });

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#1a1a1a')
      .text(dateStr, dateBlockX, y + 14, { width: dateBlockW, align: 'right' });

    // Underline below the date value
    const underlineY = y + 26;
    doc
      .strokeColor('#444')
      .lineWidth(0.5)
      .moveTo(dateBlockX, underlineY)
      .lineTo(lm + uw, underlineY)
      .stroke();

    doc.y = y + 38;
  }

  _drawPatientInfo() {
    const { doc } = this;
    const { patient } = this.data;
    const lm  = this._lm;
    const uw  = this._uw;
    const y   = doc.y;

    const fullName = patient
      ? [patient.firstName, patient.middleName, patient.lastName, patient.suffix]
          .filter(Boolean).join(' ') || ''
      : '';

    const age = patient?.dateOfBirth
      ? String(this._calculateAge(patient.dateOfBirth))
      : (patient?.age || '');

    const sex = patient?.sex || '';

    const rowH   = 18;
    const lblW   = 30;
    const lineC  = '#555';
    const ageColW = 80;

    // ── Row 1: Name ──
    const nameLineX = lm + lblW;
    const nameLineW = uw - lblW;

    doc
      .font('Helvetica-Bold').fontSize(8).fillColor('#444')
      .text('Name:', lm, y + 4, { width: lblW, lineBreak: false });
    doc
      .font('Helvetica').fontSize(8.5).fillColor('#111')
      .text(fullName, nameLineX + 2, y + 4, { width: nameLineW - 4, lineBreak: false });
    doc
      .strokeColor(lineC).lineWidth(0.5)
      .moveTo(nameLineX, y + rowH)
      .lineTo(lm + uw, y + rowH)
      .stroke();

    // ── Row 2: Age + Sex ──
    const row2Y = y + rowH + 6;
    const sexLblX = lm + lblW + ageColW + 8;

    doc
      .font('Helvetica-Bold').fontSize(8).fillColor('#444')
      .text('Age:', lm, row2Y + 4, { width: lblW, lineBreak: false });
    doc
      .font('Helvetica').fontSize(8.5).fillColor('#111')
      .text(age, lm + lblW + 2, row2Y + 4, { width: ageColW - 4, lineBreak: false });
    doc
      .strokeColor(lineC).lineWidth(0.5)
      .moveTo(lm + lblW, row2Y + rowH)
      .lineTo(lm + lblW + ageColW, row2Y + rowH)
      .stroke();

    doc
      .font('Helvetica-Bold').fontSize(8).fillColor('#444')
      .text('Sex:', sexLblX, row2Y + 4, { width: lblW, lineBreak: false });
    doc
      .font('Helvetica').fontSize(8.5).fillColor('#111')
      .text(sex, sexLblX + lblW + 2, row2Y + 4, { width: 80, lineBreak: false });
    doc
      .strokeColor(lineC).lineWidth(0.5)
      .moveTo(sexLblX + lblW, row2Y + rowH)
      .lineTo(sexLblX + lblW + 90, row2Y + rowH)
      .stroke();

    doc.y = row2Y + rowH + 12;
  }

  _drawMedications() {
    const { doc } = this;
    const { prescription } = this.data;
    const medications = prescription?.medications || [];
    const lm      = this._lm;
    const uw      = this._uw;
    const startY  = doc.y;
    const numX    = lm + 4;
    const nameX   = lm + 22;
    const detailX = lm + 28;
    const minEnd  = startY + 160; // minimum content area

    medications.forEach((med, i) => {
      const medY = doc.y;

      // Index number
      doc
        .font('Helvetica-Bold').fontSize(9).fillColor('#1a1a1a')
        .text(`${i + 1}.`, numX, medY, { width: 16, align: 'right', lineBreak: false });

      // Medication name + dosage (bold)
      const nameLine = med.dosage
        ? `${med.name}  ${med.dosage}`
        : med.name;

      doc
        .font('Helvetica-Bold').fontSize(9.5).fillColor('#1a1a1a')
        .text(nameLine, nameX, medY, { width: uw - (nameX - lm) - 4 });

      // Detail row: Sig / Duration / Qty
      const parts = [];
      if (med.frequency) parts.push(`Sig.: ${med.frequency}`);
      if (med.duration)  parts.push(`For ${med.duration}`);
      if (med.quantity)  parts.push(`Qty: #${med.quantity}`);

      if (parts.length) {
        doc
          .font('Helvetica').fontSize(8.5).fillColor('#333')
          .text(parts.join('  ·  '), detailX, doc.y + 1, {
            width: uw - (detailX - lm) - 4,
          });
      }

      // Instructions (italic)
      if (med.instructions) {
        doc
          .font('Helvetica-Oblique').fontSize(8).fillColor('#555')
          .text(med.instructions, detailX, doc.y + 1, {
            width: uw - (detailX - lm) - 4,
          });
      }

      doc.y = doc.y + 8;
    });

    if (doc.y < minEnd) doc.y = minEnd;
  }

  _drawNotes() {
    const notes = this.data.prescription?.specialInstructions;
    if (!notes) return;

    const { doc } = this;
    const lm  = this._lm;
    const uw  = this._uw;
    const y   = doc.y;

    // Write text first so we know the height
    doc
      .font('Helvetica-Bold').fontSize(8).fillColor('#222')
      .text('Notes: ', lm + 8, y + 4, {
        continued: true,
        width: uw - 10,
      })
      .font('Helvetica').fillColor('#555')
      .text(notes);

    const endY = doc.y + 4;

    // Left border (drawn after text so coordinates are known)
    doc
      .strokeColor('#999')
      .lineWidth(2)
      .moveTo(lm, y)
      .lineTo(lm, endY)
      .stroke();

    doc.y = endY + 8;
  }

  _drawSignature() {
    const { doc } = this;
    const { physician } = this.data;
    const lm  = this._lm;
    const uw  = this._uw;
    const pageH = doc.page.height;
    const bm    = doc.page.margins.bottom;

    const doctorName = physician
      ? `${physician.firstName || ''} ${physician.lastName || ''}`.trim()
      : '';

    const licenseNo = physician?.licenseNo || '';
    const ptrNo     = physician?.ptrNo     || '';

    const sigW  = 190;
    const sigX  = lm + uw - sigW;
    // Fixed position: anchor block bottom at page bottom margin
    // Block height ≈ 4 lines: line(0) + name(13) + license(13) + ptr(13) = 39 pt above bm
    const blockH = 52;
    const sigY   = pageH - bm - blockH;

    // Signature line
    doc
      .strokeColor('#333')
      .lineWidth(0.8)
      .moveTo(sigX, sigY)
      .lineTo(sigX + sigW, sigY)
      .stroke();

    // Doctor name + M.D./DMD
    doc
      .font('Helvetica-Bold').fontSize(8.5).fillColor('#111')
      .text(`${doctorName}  M.D. / DMD`, sigX, sigY + 4, {
        width: sigW,
        align: 'center',
        lineBreak: false,
      });

    // License No. underline row
    const licY = sigY + 20;
    doc
      .font('Helvetica').fontSize(8).fillColor('#333')
      .text('License No.', sigX, licY, { width: 62, lineBreak: false });
    doc
      .font('Helvetica').fontSize(8).fillColor('#111')
      .text(licenseNo, sigX + 64, licY, { width: sigW - 66, lineBreak: false });
    doc
      .strokeColor('#555').lineWidth(0.4)
      .moveTo(sigX + 64, licY + 11)
      .lineTo(sigX + sigW, licY + 11)
      .stroke();

    // PTR No. underline row
    const ptrY = licY + 16;
    doc
      .font('Helvetica').fontSize(8).fillColor('#333')
      .text('PTR No.', sigX, ptrY, { width: 62, lineBreak: false });
    doc
      .font('Helvetica').fontSize(8).fillColor('#111')
      .text(ptrNo, sigX + 64, ptrY, { width: sigW - 66, lineBreak: false });
    doc
      .strokeColor('#555').lineWidth(0.4)
      .moveTo(sigX + 64, ptrY + 11)
      .lineTo(sigX + sigW, ptrY + 11)
      .stroke();
  }
}

module.exports = PrescriptionTemplate;

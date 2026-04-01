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
        chiefComplaints: 'Headache, fever for 3 days',
        peFindings: 'BP 120/80, Temp 38.2°C, throat congestion',
        diagnosis: 'Acute Pharyngitis; Upper Respiratory Tract Infection',
        advice: 'Drink plenty of fluids; Get adequate rest; Avoid cold beverages',
        followUpDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
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
    this._drawPatientInfo();
    this._drawClinicalTable();
    this._drawDiagnosis();
    this._drawMedicationTable();
    this._drawAdvice();
    this._drawFollowUp();
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
    const dateStr = this._formatDate(this.data.issuedDate);

    const rowH   = 18;
    const lblW   = 32;
    const lineC  = '#555';

    // ── Row 1: Name ──
    const nameLineX = lm + lblW;

    doc
      .font('Helvetica-Bold').fontSize(8).fillColor('#444')
      .text('Name:', lm, y + 4, { width: lblW, lineBreak: false });
    doc
      .font('Helvetica').fontSize(8.5).fillColor('#111')
      .text(fullName, nameLineX + 2, y + 4, { width: uw - lblW - 4, lineBreak: false });
    doc
      .strokeColor(lineC).lineWidth(0.5)
      .moveTo(nameLineX, y + rowH)
      .lineTo(lm + uw, y + rowH)
      .stroke();

    // ── Row 2: Age | Sex | Date ──
    const row2Y = y + rowH + 6;
    const ageValW = 40;
    const sexLblX = lm + lblW + ageValW + 12;
    const sexValW = 40;
    const dateLblX = sexLblX + lblW + sexValW + 12;

    // Age
    doc
      .font('Helvetica-Bold').fontSize(8).fillColor('#444')
      .text('Age:', lm, row2Y + 4, { width: lblW, lineBreak: false });
    doc
      .font('Helvetica').fontSize(8.5).fillColor('#111')
      .text(age, lm + lblW + 2, row2Y + 4, { width: ageValW - 4, lineBreak: false });
    doc
      .strokeColor(lineC).lineWidth(0.5)
      .moveTo(lm + lblW, row2Y + rowH)
      .lineTo(lm + lblW + ageValW, row2Y + rowH)
      .stroke();

    // Sex
    doc
      .font('Helvetica-Bold').fontSize(8).fillColor('#444')
      .text('Sex:', sexLblX, row2Y + 4, { width: lblW, lineBreak: false });
    doc
      .font('Helvetica').fontSize(8.5).fillColor('#111')
      .text(sex, sexLblX + lblW + 2, row2Y + 4, { width: sexValW - 4, lineBreak: false });
    doc
      .strokeColor(lineC).lineWidth(0.5)
      .moveTo(sexLblX + lblW, row2Y + rowH)
      .lineTo(sexLblX + lblW + sexValW, row2Y + rowH)
      .stroke();

    // Date
    doc
      .font('Helvetica-Bold').fontSize(8).fillColor('#444')
      .text('Date:', dateLblX, row2Y + 4, { width: lblW, lineBreak: false });
    doc
      .font('Helvetica').fontSize(8.5).fillColor('#111')
      .text(dateStr, dateLblX + lblW + 2, row2Y + 4, {
        width: lm + uw - dateLblX - lblW - 4, lineBreak: false,
      });
    doc
      .strokeColor(lineC).lineWidth(0.5)
      .moveTo(dateLblX + lblW, row2Y + rowH)
      .lineTo(lm + uw, row2Y + rowH)
      .stroke();

    doc.y = row2Y + rowH + 10;
  }

  _drawClinicalTable() {
    const { doc } = this;
    const { prescription } = this.data;
    const complaints = prescription?.chiefComplaints;
    const peFindings = prescription?.peFindings;

    if (!complaints && !peFindings) return;

    const lm = this._lm;
    const uw = this._uw;
    const y = doc.y;
    const colW = Math.floor(uw / 2);
    const col2W = uw - colW;
    const headerH = 15;
    const pad = 6;
    const borderC = '#555';
    const headerBg = '#E8E8E8';

    // Measure content heights for auto-expanding cells
    doc.font('Helvetica').fontSize(8);
    const leftH  = complaints ? doc.heightOfString(complaints, { width: colW - pad * 2 }) : 0;
    const rightH = peFindings ? doc.heightOfString(peFindings, { width: col2W - pad * 2 }) : 0;
    const contentH = Math.max(leftH, rightH, 24) + pad * 2;

    // ── Header row ──
    doc.save();
    doc.rect(lm, y, colW, headerH).fill(headerBg);
    doc.restore();
    doc.rect(lm, y, colW, headerH).stroke(borderC);

    doc.save();
    doc.rect(lm + colW, y, col2W, headerH).fill(headerBg);
    doc.restore();
    doc.rect(lm + colW, y, col2W, headerH).stroke(borderC);

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111');
    doc.text('Chief Complaints', lm + pad, y + 3, { width: colW - pad * 2 });
    doc.text('Clinical Findings', lm + colW + pad, y + 3, { width: col2W - pad * 2 });

    // ── Content row ──
    const cY = y + headerH;
    doc.rect(lm, cY, colW, contentH).stroke(borderC);
    doc.rect(lm + colW, cY, col2W, contentH).stroke(borderC);

    doc.font('Helvetica').fontSize(8).fillColor('#222');
    if (complaints) doc.text(complaints, lm + pad, cY + pad, { width: colW - pad * 2 });
    if (peFindings) doc.text(peFindings, lm + colW + pad, cY + pad, { width: col2W - pad * 2 });

    doc.y = cY + contentH + 8;
  }

  _drawDiagnosis() {
    const diagnosis = this.data.prescription?.diagnosis;
    if (!diagnosis) return;

    const { doc } = this;
    const lm = this._lm;
    const uw = this._uw;

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#111')
      .text('Diagnosis:', lm, doc.y);

    doc.font('Helvetica').fontSize(8).fillColor('#333');
    const items = diagnosis.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
    items.forEach(item => {
      doc.text(`  \u2022 ${item}`, lm + 6, doc.y, { width: uw - 6 });
    });

    doc.y += 8;
  }

  _drawMedicationTable() {
    const { doc } = this;
    const { prescription } = this.data;
    const medications = prescription?.medications || [];
    const lm  = this._lm;
    const uw  = this._uw;

    // Rx symbol
    doc.font('Times-BoldItalic').fontSize(22).fillColor('#1a1a1a')
      .text('Rx', lm, doc.y);
    doc.y += 2;

    if (medications.length === 0) return;

    // Column widths
    const col1W = Math.round(uw * 0.50);
    const col2W = Math.round(uw * 0.22);
    const col3W = uw - col1W - col2W;
    const headerH = 15;
    const pad = 5;
    const borderC = '#555';
    const headerBg = '#E8E8E8';
    let y = doc.y;

    // ── Table header ──
    const cols = [
      { x: lm,                    w: col1W, text: 'Medicine Name' },
      { x: lm + col1W,            w: col2W, text: 'Dosage' },
      { x: lm + col1W + col2W,    w: col3W, text: 'Duration' },
    ];
    cols.forEach(col => {
      doc.save();
      doc.rect(col.x, y, col.w, headerH).fill(headerBg);
      doc.restore();
      doc.rect(col.x, y, col.w, headerH).stroke(borderC);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111')
        .text(col.text, col.x + pad, y + 3, { width: col.w - pad * 2, align: 'center' });
    });
    y += headerH;

    // ── Table rows ──
    medications.forEach((med, i) => {
      // Measure name column content height
      const nameText = `${i + 1}. ${med.name}`;
      doc.font('Helvetica-Bold').fontSize(8);
      let nameH = doc.heightOfString(nameText, { width: col1W - pad * 2 });

      if (med.instructions) {
        doc.font('Helvetica-Oblique').fontSize(7);
        nameH += doc.heightOfString(med.instructions, { width: col1W - pad * 2 }) + 2;
      }

      // Measure duration column content
      const durParts = [];
      if (med.frequency) durParts.push(med.frequency);
      if (med.duration)  durParts.push(med.duration);
      if (med.quantity)  durParts.push(`Qty: #${med.quantity}`);
      const durText = durParts.join('\n');

      doc.font('Helvetica').fontSize(7.5);
      const durH = durText ? doc.heightOfString(durText, { width: col3W - pad * 2 }) : 0;

      const rowH = Math.max(nameH + pad * 2, durH + pad * 2, 24);

      // Draw cell borders
      doc.rect(lm, y, col1W, rowH).stroke(borderC);
      doc.rect(lm + col1W, y, col2W, rowH).stroke(borderC);
      doc.rect(lm + col1W + col2W, y, col3W, rowH).stroke(borderC);

      // Medicine name (bold)
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#111')
        .text(nameText, lm + pad, y + pad, { width: col1W - pad * 2 });

      // Instructions / generic info (italic, smaller)
      if (med.instructions) {
        doc.font('Helvetica-Oblique').fontSize(7).fillColor('#555')
          .text(med.instructions, lm + pad, doc.y + 1, { width: col1W - pad * 2 });
      }

      // Dosage (centered vertically in cell)
      const dosageText = med.dosage || '';
      doc.font('Helvetica').fontSize(8).fillColor('#111')
        .text(dosageText, lm + col1W + pad, y + pad, {
          width: col2W - pad * 2, align: 'center',
        });

      // Duration / frequency / qty
      if (durText) {
        doc.font('Helvetica').fontSize(7.5).fillColor('#111')
          .text(durText, lm + col1W + col2W + pad, y + pad, {
            width: col3W - pad * 2, align: 'center',
          });
      }

      y += rowH;
    });

    doc.y = y + 8;
  }

  _drawAdvice() {
    const advice = this.data.prescription?.advice;
    const notes = this.data.prescription?.specialInstructions;
    const content = advice || notes;
    if (!content) return;

    const { doc } = this;
    const lm = this._lm;
    const uw = this._uw;

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#111')
      .text('Advice:', lm, doc.y);

    doc.font('Helvetica').fontSize(8).fillColor('#333');
    const items = content.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
    items.forEach(item => {
      doc.text(`  \u2022 ${item}`, lm + 6, doc.y, { width: uw - 6 });
    });

    doc.y += 6;
  }

  _drawFollowUp() {
    const followUp = this.data.prescription?.followUpDate;
    if (!followUp) return;

    const { doc } = this;
    const lm = this._lm;
    const uw = this._uw;

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#CC0000')
      .text(`Follow Up: ${this._formatDate(followUp)}`, lm, doc.y, { width: uw });

    doc.y += 6;
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

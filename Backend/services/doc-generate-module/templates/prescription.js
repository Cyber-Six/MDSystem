const BaseTemplate = require('../base-template.js');
const pdf = require('../../pdfkit.js');

/**
 * Prescription Template
 * Used for medication prescriptions
 */
class PrescriptionTemplate extends BaseTemplate {
  static get type() {
    return 'prescription';
  }

  static get displayName() {
    return 'Prescription';
  }

  static get persistToDatabase() {
    return true;
  }

  static getSampleData() {
    return {
      ...super.getSampleData(),
      prescription: {
        diagnosis: 'Upper Respiratory Tract Infection',
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
          {
            name: 'Cetirizine 10mg',
            dosage: '1 tablet',
            frequency: 'Once daily at bedtime',
            duration: '5 days',
            quantity: 5,
            instructions: 'May cause drowsiness',
          },
        ],
        specialInstructions: 'Complete the full course of antibiotics. Return if symptoms persist after 3 days.',
        followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      },
    };
  }

  async build() {
    this.init();

    // Header
    this.addHeader('PRESCRIPTION', `Rx`);

    // Patient Info (simplified for prescription)
    this._addPatientInfoCompact();

    // Diagnosis
    this._addDiagnosis();

    // Medications
    this._addMedications();

    // Special Instructions
    this._addInstructions();

    // Physician Signature
    this.addPhysicianSignature();

    return this;
  }

  _addPatientInfoCompact() {
    const { patient } = this.data;
    if (!patient) return;

    const fullName = [
      patient.firstName,
      patient.middleName,
      patient.lastName,
      patient.suffix,
    ].filter(Boolean).join(' ');

    const age = patient.dateOfBirth
      ? this._calculateAge(patient.dateOfBirth)
      : 'N/A';

    // Compact patient info in one row format
    this.doc
      .fontSize(pdf.FONT_SIZES.body)
      .font('Helvetica');

    const startY = this.doc.y;
    const leftCol = this.doc.page.margins.left;
    const midCol = 250;
    const rightCol = 400;

    // Row 1: Name, Age/Sex, Date
    this.doc
      .font('Helvetica-Bold')
      .text('Name:', leftCol, startY, { continued: true })
      .font('Helvetica')
      .text(` ${fullName}`);

    this.doc
      .font('Helvetica-Bold')
      .text('Age/Sex:', midCol, startY, { continued: true })
      .font('Helvetica')
      .text(` ${age}/${patient.sex?.charAt(0) || 'N/A'}`);

    this.doc
      .font('Helvetica-Bold')
      .text('Date:', rightCol, startY, { continued: true })
      .font('Helvetica')
      .text(` ${this._formatDate(this.data.issuedDate)}`);

    // Row 2: Address
    const row2Y = startY + 18;
    this.doc
      .font('Helvetica-Bold')
      .text('Address:', leftCol, row2Y, { continued: true })
      .font('Helvetica')
      .text(` ${patient.address || 'N/A'}`);

    this.doc.y = row2Y + 25;
    this.doc.moveDown(0.5);

    // Divider
    this.doc
      .strokeColor(pdf.COLORS.lightGray)
      .lineWidth(1)
      .moveTo(this.doc.page.margins.left, this.doc.y)
      .lineTo(this.doc.page.width - this.doc.page.margins.right, this.doc.y)
      .stroke();

    this.doc.moveDown();
  }

  _addDiagnosis() {
    const { prescription } = this.data;
    if (!prescription?.diagnosis) return;

    this.doc
      .font('Helvetica-Bold')
      .fontSize(pdf.FONT_SIZES.body)
      .fillColor(pdf.COLORS.secondary)
      .text('Diagnosis: ', { continued: true })
      .font('Helvetica')
      .fillColor(pdf.COLORS.text)
      .text(prescription.diagnosis);

    this.doc.moveDown();
  }

  _addMedications() {
    const { prescription } = this.data;
    if (!prescription?.medications?.length) return;

    // Rx symbol
    this.doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .fillColor(pdf.COLORS.primary)
      .text('Rx', this.doc.page.margins.left, this.doc.y);

    this.doc.moveDown(0.5);

    // Medication list
    prescription.medications.forEach((med, index) => {
      const startY = this.doc.y;

      // Medication number and name
      this.doc
        .fontSize(pdf.FONT_SIZES.body)
        .font('Helvetica-Bold')
        .fillColor(pdf.COLORS.text)
        .text(`${index + 1}. ${med.name}`, this.doc.page.margins.left + 30);

      // Dosage and frequency
      this.doc
        .font('Helvetica')
        .text(`   Sig: ${med.dosage} ${med.frequency}`, { indent: 20 });

      // Duration
      if (med.duration) {
        this.doc.text(`   Duration: ${med.duration}`, { indent: 20 });
      }

      // Quantity
      if (med.quantity) {
        this.doc.text(`   Dispense: #${med.quantity}`, { indent: 20 });
      }

      // Special instructions for this medication
      if (med.instructions) {
        this.doc
          .fillColor(pdf.COLORS.secondary)
          .fontSize(pdf.FONT_SIZES.small)
          .text(`   Note: ${med.instructions}`, { indent: 20 });
      }

      this.doc.fillColor(pdf.COLORS.text);
      this.doc.moveDown(0.5);
    });

    this.doc.moveDown();
  }

  _addInstructions() {
    const { prescription } = this.data;

    // Special instructions
    if (prescription?.specialInstructions) {
      this.doc
        .font('Helvetica-Bold')
        .fontSize(pdf.FONT_SIZES.body)
        .fillColor(pdf.COLORS.secondary)
        .text('Special Instructions:');
      this.doc
        .font('Helvetica')
        .fillColor(pdf.COLORS.text)
        .text(prescription.specialInstructions);
      this.doc.moveDown();
    }

    // Follow-up date
    if (prescription?.followUpDate) {
      this.doc
        .font('Helvetica-Bold')
        .fillColor(pdf.COLORS.secondary)
        .text('Follow-up: ', { continued: true })
        .font('Helvetica')
        .fillColor(pdf.COLORS.text)
        .text(this._formatDate(prescription.followUpDate));
    }

    this.doc.moveDown();
  }
}

module.exports = PrescriptionTemplate;

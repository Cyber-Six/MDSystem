const BaseTemplate = require('../base-template.js');
const pdf = require('../../pdfkit.js');

/**
 * Medical Certificate Template
 * Used for fitness certificates, sick leave certificates, etc.
 */
class MedicalCertificateTemplate extends BaseTemplate {
  static get type() {
    return 'medical-certificate';
  }

  static get displayName() {
    return 'Medical Certificate';
  }

  static get persistToDatabase() {
    return true;
  }

  static getSampleData() {
    return {
      ...super.getSampleData(),
      certificate: {
        purpose: 'Fitness to Work',
        diagnosis: 'The patient was examined and found to be in good health.',
        recommendations: 'Fit for regular work duties.',
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        restrictions: null,
        remarks: null,
      },
    };
  }

  async build() {
    this.init();

    // Header
    this.addHeader('MEDICAL CERTIFICATE');

    // Patient Info
    this.addPatientInfo();

    // Certificate Details
    this._addCertificateDetails();

    // Physician Signature
    this.addPhysicianSignature();

    return this;
  }

  _addCertificateDetails() {
    const { certificate } = this.data;
    if (!certificate) return;

    pdf.addSectionHeading(this.doc, 'Certificate Details');

    // Purpose
    pdf.addField(this.doc, 'Purpose', certificate.purpose);
    this.doc.moveDown(0.5);

    // Examination findings / Diagnosis
    this.doc
      .font('Helvetica-Bold')
      .fontSize(pdf.FONT_SIZES.body)
      .fillColor(pdf.COLORS.secondary)
      .text('Findings:');
    this.doc
      .font('Helvetica')
      .fillColor(pdf.COLORS.text)
      .text(certificate.diagnosis || 'N/A');
    this.doc.moveDown(0.5);

    // Recommendations
    this.doc
      .font('Helvetica-Bold')
      .fillColor(pdf.COLORS.secondary)
      .text('Recommendations:');
    this.doc
      .font('Helvetica')
      .fillColor(pdf.COLORS.text)
      .text(certificate.recommendations || 'N/A');
    this.doc.moveDown(0.5);

    // Validity period
    if (certificate.validFrom || certificate.validUntil) {
      const validityText = [
        certificate.validFrom ? `From: ${this._formatDate(certificate.validFrom)}` : null,
        certificate.validUntil ? `Until: ${this._formatDate(certificate.validUntil)}` : null,
      ]
        .filter(Boolean)
        .join('  |  ');

      pdf.addField(this.doc, 'Validity', validityText);
    }

    // Restrictions
    if (certificate.restrictions) {
      this.doc.moveDown(0.5);
      this.doc
        .font('Helvetica-Bold')
        .fillColor(pdf.COLORS.secondary)
        .text('Restrictions:');
      this.doc
        .font('Helvetica')
        .fillColor(pdf.COLORS.text)
        .text(certificate.restrictions);
    }

    // Remarks
    if (certificate.remarks) {
      this.doc.moveDown(0.5);
      this.doc
        .font('Helvetica-Bold')
        .fillColor(pdf.COLORS.secondary)
        .text('Remarks:');
      this.doc
        .font('Helvetica')
        .fillColor(pdf.COLORS.text)
        .text(certificate.remarks);
    }

    this.doc.moveDown();

    // Issue date
    pdf.addField(this.doc, 'Date Issued', this._formatDate(this.data.issuedDate));

    this.doc.moveDown();
  }
}

module.exports = MedicalCertificateTemplate;

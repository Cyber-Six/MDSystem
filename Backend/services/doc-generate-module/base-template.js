const pdf = require('../pdfkit.js');

/**
 * Base template class for document generation
 * All document templates should extend this class
 */
class BaseTemplate {
  constructor(options = {}) {
    this.options = {
      size: 'letter',
      margins: pdf.DEFAULT_MARGINS,
      ...options,
    };
    this.doc = null;
    this.data = {};
  }

  /**
   * Get template type identifier
   * @returns {string}
   */
  static get type() {
    throw new Error('Template must implement static type getter');
  }

  /**
   * Get template display name
   * @returns {string}
   */
  static get displayName() {
    throw new Error('Template must implement static displayName getter');
  }

  /**
   * Whether this template should be stored in database
   * @returns {boolean}
   */
  static get persistToDatabase() {
    return false;
  }

  /**
   * Get sample data for testing
   * @returns {object}
   */
  static getSampleData() {
    return {
      patient: {
        id: 12345,
        firstName: 'Juan',
        middleName: 'Dela',
        lastName: 'Cruz',
        suffix: '',
        dateOfBirth: '1990-05-15',
        sex: 'Male',
        contactNumber: '09171234567',
        address: '123 Sample Street, Manila, Philippines',
      },
      physician: {
        id: 1,
        firstName: 'Maria',
        lastName: 'Santos',
        title: 'MD',
        licenseNo: 'PRC-123456',
        specialization: 'General Medicine',
      },
      clinic: {
        name: 'MDSystem Medical Clinic',
        address: 'University Health Center, Manila, Philippines',
        contactNumber: '(02) 1234-5678',
      },
      issuedDate: new Date().toISOString().split('T')[0],
    };
  }

  /**
   * Initialize the PDF document
   * @returns {BaseTemplate}
   */
  init() {
    this.doc = pdf.createDocument(this.options);
    return this;
  }

  /**
   * Set document data
   * @param {object} data - Document data
   * @returns {BaseTemplate}
   */
  setData(data) {
    // Merge with sample data for missing fields (if testing)
    const sample = this.constructor.getSampleData();
    this.data = {
      ...sample,
      ...data,
      patient: { ...sample.patient, ...data.patient },
      physician: { ...sample.physician, ...data.physician },
      clinic: { ...sample.clinic, ...data.clinic },
    };
    return this;
  }

  /**
   * Add document header
   * @param {string} title - Document title
   * @param {string} subtitle - Document subtitle
   * @returns {BaseTemplate}
   */
  addHeader(title, subtitle = '') {
    pdf.addHeader(this.doc, title, subtitle, {
      clinicName: this.data.clinic?.name,
      address: this.data.clinic?.address,
    });
    return this;
  }

  /**
   * Add patient information section
   * @returns {BaseTemplate}
   */
  addPatientInfo() {
    const { patient } = this.data;
    if (!patient) return this;

    pdf.addSectionHeading(this.doc, 'Patient Information');

    const fullName = [
      patient.firstName,
      patient.middleName,
      patient.lastName,
      patient.suffix,
    ].filter(Boolean).join(' ');

    const age = patient.dateOfBirth
      ? this._calculateAge(patient.dateOfBirth)
      : 'N/A';

    pdf.addField(this.doc, 'Name', fullName);
    pdf.addField(this.doc, 'Patient ID', String(patient.id || 'N/A'));
    pdf.addField(this.doc, 'Date of Birth', this._formatDate(patient.dateOfBirth));
    pdf.addField(this.doc, 'Age', `${age} years old`);
    pdf.addField(this.doc, 'Sex', patient.sex);
    pdf.addField(this.doc, 'Contact', patient.contactNumber);
    pdf.addField(this.doc, 'Address', patient.address);

    this.doc.moveDown();
    return this;
  }

  /**
   * Add physician signature section
   * @returns {BaseTemplate}
   */
  addPhysicianSignature() {
    const { physician } = this.data;
    if (!physician) return this;

    const name = `${physician.firstName} ${physician.lastName}, ${physician.title}`;
    const title = [
      physician.specialization,
      physician.licenseNo ? `License No: ${physician.licenseNo}` : null,
    ].filter(Boolean).join(' | ');

    pdf.addSignatureLine(this.doc, name, title);
    return this;
  }

  /**
   * Add footer to all pages
   * @param {object} options - Footer options
   * @returns {BaseTemplate}
   */
  addFooter(options = {}) {
    pdf.addFooter(this.doc, {
      text: this.data.clinic?.name || 'MDSystem',
      ...options,
    });
    return this;
  }

  /**
   * Build the document content
   * Override this method in subclasses
   * @returns {Promise<BaseTemplate>}
   */
  async build() {
    throw new Error('Template must implement build() method');
  }

  /**
   * Get the PDF document instance
   * @returns {PDFDocument}
   */
  getDocument() {
    return this.doc;
  }

  /**
   * Stream document to HTTP response
   * @param {object} res - Express response object
   * @param {string} filename - Download filename
   */
  streamToResponse(res, filename) {
    this.addFooter();
    pdf.streamToResponse(this.doc, res, filename);
  }

  /**
   * Download document as attachment
   * @param {object} res - Express response object
   * @param {string} filename - Download filename
   */
  downloadToResponse(res, filename) {
    this.addFooter();
    pdf.downloadToResponse(this.doc, res, filename);
  }

  /**
   * Get document as buffer
   * @returns {Promise<Buffer>}
   */
  async toBuffer() {
    this.addFooter();
    return pdf.toBuffer(this.doc);
  }

  /**
   * Calculate age from date of birth
   * @param {string} dob - Date of birth (YYYY-MM-DD)
   * @returns {number}
   */
  _calculateAge(dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Format date for display
   * @param {string} date - Date string
   * @returns {string}
   */
  _formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Format date for filename
   * @param {Date} date - Date object
   * @returns {string}
   */
  _formatDateForFilename(date = new Date()) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Generate filename for the document
   * @returns {string}
   */
  generateFilename() {
    const patientName = this.data.patient
      ? `${this.data.patient.lastName}_${this.data.patient.firstName}`.replace(/\s+/g, '_')
      : 'document';
    const date = this._formatDateForFilename();
    return `${this.constructor.type}_${patientName}_${date}.pdf`;
  }
}

module.exports = BaseTemplate;

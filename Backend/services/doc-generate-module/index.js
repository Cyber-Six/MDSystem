const logger = require('../../utils/logger.js');

// Import templates
const MedicalCertificateTemplate = require('./templates/medical-certificate.js');
const PrescriptionTemplate = require('./templates/prescription.js');
const DiagnosisReportTemplate = require('./templates/diagnosis-report.js');
const StaffReportTemplate = require('./templates/staff-report.js');

// Template registry
const templates = {
  [MedicalCertificateTemplate.type]: MedicalCertificateTemplate,
  [PrescriptionTemplate.type]: PrescriptionTemplate,
  [DiagnosisReportTemplate.type]: DiagnosisReportTemplate,
  [StaffReportTemplate.type]: StaffReportTemplate,
};

/**
 * Get available template types
 * @returns {string[]}
 */
function getAvailableTemplates() {
  return Object.keys(templates);
}

/**
 * Get template metadata
 * @returns {object[]}
 */
function getTemplateMetadata() {
  return Object.values(templates).map((Template) => ({
    type: Template.type,
    displayName: Template.displayName,
    persistToDatabase: Template.persistToDatabase,
  }));
}

/**
 * Get template class by type
 * @param {string} templateType - Template type identifier
 * @returns {class|null}
 */
function getTemplate(templateType) {
  return templates[templateType] || null;
}

/**
 * Get sample data for a template
 * @param {string} templateType - Template type identifier
 * @returns {object|null}
 */
function getSampleData(templateType) {
  const Template = getTemplate(templateType);
  if (!Template) return null;
  return Template.getSampleData();
}

/**
 * Generate a document
 * @param {string} templateType - Template type identifier
 * @param {object} data - Document data
 * @param {object} options - Template options
 * @returns {Promise<{template: BaseTemplate, doc: PDFDocument}>}
 */
async function generateDocument(templateType, data = {}, options = {}) {
  const Template = getTemplate(templateType);

  if (!Template) {
    throw new Error(`Unknown template type: ${templateType}`);
  }

  logger.debug(`Generating document: ${templateType}`);

  const template = new Template(options);
  template.setData(data);
  await template.build();

  return {
    template,
    doc: template.getDocument(),
  };
}

/**
 * Preview a document (stream to response)
 * @param {string} templateType - Template type identifier
 * @param {object} data - Document data
 * @param {object} res - Express response object
 * @param {object} options - Template options
 */
async function previewDocument(templateType, data, res, options = {}) {
  const { template } = await generateDocument(templateType, data, options);
  const filename = template.generateFilename();
  template.streamToResponse(res, filename);
}

/**
 * Download a document (attachment to response)
 * @param {string} templateType - Template type identifier
 * @param {object} data - Document data
 * @param {object} res - Express response object
 * @param {object} options - Template options
 */
async function downloadDocument(templateType, data, res, options = {}) {
  const { template } = await generateDocument(templateType, data, options);
  const filename = template.generateFilename();
  template.downloadToResponse(res, filename);
}

/**
 * Generate document as buffer (for database storage)
 * @param {string} templateType - Template type identifier
 * @param {object} data - Document data
 * @param {object} options - Template options
 * @returns {Promise<{buffer: Buffer, filename: string, metadata: object}>}
 */
async function generateDocumentBuffer(templateType, data, options = {}) {
  const Template = getTemplate(templateType);

  if (!Template) {
    throw new Error(`Unknown template type: ${templateType}`);
  }

  const { template } = await generateDocument(templateType, data, options);
  const buffer = await template.toBuffer();
  const filename = template.generateFilename();

  return {
    buffer,
    filename,
    metadata: {
      templateType,
      displayName: Template.displayName,
      persistToDatabase: Template.persistToDatabase,
      patientId: data.patient?.id,
      physicianId: data.physician?.id,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Check if a template should be persisted to database
 * @param {string} templateType - Template type identifier
 * @returns {boolean}
 */
function shouldPersist(templateType) {
  const Template = getTemplate(templateType);
  return Template?.persistToDatabase ?? false;
}

module.exports = {
  // Template registry
  getAvailableTemplates,
  getTemplateMetadata,
  getTemplate,
  getSampleData,

  // Document generation
  generateDocument,
  previewDocument,
  downloadDocument,
  generateDocumentBuffer,

  // Utilities
  shouldPersist,

  // Export template classes for direct use
  templates: {
    MedicalCertificateTemplate,
    PrescriptionTemplate,
    DiagnosisReportTemplate,
    StaffReportTemplate,
  },
};

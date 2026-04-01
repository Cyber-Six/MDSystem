const BaseTemplate = require('../base-template.js');
const pdf = require('../../pdfkit.js');
const chart = require('../../chart.js');

/**
 * Diagnosis Report Template
 * Used for consultation outcome reports with ICD codes
 * Can include charts for diagnosis statistics
 */
class DiagnosisReportTemplate extends BaseTemplate {
  static get type() {
    return 'diagnosis-report';
  }

  static get displayName() {
    return 'Diagnosis Report';
  }

  static get persistToDatabase() {
    // Reports are streamed directly, not stored
    return false;
  }

  static getSampleData() {
    return {
      ...super.getSampleData(),
      consultation: {
        id: 1001,
        date: new Date().toISOString().split('T')[0],
        type: 'Medical',
        mode: 'Onsite',
        status: 'Completed',
      },
      complaints: [
        'Persistent cough for 3 days',
        'Low-grade fever',
        'Body malaise',
      ],
      peFindings: [
        'Temperature: 37.8°C',
        'BP: 120/80 mmHg',
        'HR: 82 bpm',
        'Throat: erythematous pharynx',
        'Lungs: clear breath sounds',
      ],
      diagnoses: [
        {
          name: 'Acute Upper Respiratory Tract Infection',
          icdCode: 'J06.9',
          type: 'Primary',
          notes: 'Viral etiology suspected',
        },
        {
          name: 'Acute Pharyngitis',
          icdCode: 'J02.9',
          type: 'Secondary',
          notes: null,
        },
      ],
      treatments: [
        'Prescribed symptomatic medications',
        'Advised rest and increased fluid intake',
        'Follow-up if symptoms worsen or persist beyond 5 days',
      ],
      remarks: 'Patient counseled on supportive care measures.',
      // Optional: chart data for diagnosis statistics
      chartData: {
        show: true,
        title: 'Diagnosis Distribution',
        labels: ['URTI', 'Pharyngitis', 'Fever'],
        data: [45, 30, 25],
      },
    };
  }

  async build() {
    this.init();

    // Header
    this.addHeader('DIAGNOSIS REPORT', `Consultation #${this.data.consultation?.id || 'N/A'}`);

    // Patient Info
    this.addPatientInfo();

    // Consultation Details
    this._addConsultationDetails();

    // Chief Complaints
    this._addComplaints();

    // Physical Examination Findings
    this._addPEFindings();

    // Diagnoses with ICD codes
    this._addDiagnoses();

    // Treatment Plan
    this._addTreatments();

    // Chart (if applicable)
    await this._addChart();

    // Remarks
    this._addRemarks();

    // Physician Signature
    this.addPhysicianSignature();

    return this;
  }

  _addConsultationDetails() {
    const { consultation } = this.data;
    if (!consultation) return;

    pdf.addSectionHeading(this.doc, 'Consultation Details');

    pdf.addField(this.doc, 'Consultation ID', String(consultation.id || 'N/A'));
    pdf.addField(this.doc, 'Date', this._formatDate(consultation.date));
    pdf.addField(this.doc, 'Type', consultation.type);
    pdf.addField(this.doc, 'Mode', consultation.mode);
    pdf.addField(this.doc, 'Status', consultation.status);

    this.doc.moveDown();
  }

  _addComplaints() {
    const { complaints } = this.data;
    if (!complaints?.length) return;

    pdf.addSectionHeading(this.doc, 'Chief Complaints');

    complaints.forEach((complaint, index) => {
      this.doc
        .fontSize(pdf.FONT_SIZES.body)
        .font('Helvetica')
        .fillColor(pdf.COLORS.text)
        .text(`${index + 1}. ${complaint}`);
    });

    this.doc.moveDown();
  }

  _addPEFindings() {
    const { peFindings } = this.data;
    if (!peFindings?.length) return;

    pdf.addSectionHeading(this.doc, 'Physical Examination Findings');

    peFindings.forEach((finding) => {
      this.doc
        .fontSize(pdf.FONT_SIZES.body)
        .font('Helvetica')
        .fillColor(pdf.COLORS.text)
        .text(`• ${finding}`);
    });

    this.doc.moveDown();
  }

  _addDiagnoses() {
    const { diagnoses } = this.data;
    if (!diagnoses?.length) return;

    pdf.addSectionHeading(this.doc, 'Diagnoses (ICD-10)');

    // Create table for diagnoses
    const headers = ['Type', 'Diagnosis', 'ICD-10 Code', 'Notes'];
    const rows = diagnoses.map((d) => [
      d.type || 'N/A',
      d.name || 'N/A',
      d.icdCode || 'N/A',
      d.notes || '-',
    ]);

    pdf.addTable(this.doc, headers, rows, {
      columnWidths: [80, 180, 80, 128],
    });

    this.doc.moveDown();
  }

  _addTreatments() {
    const { treatments } = this.data;
    if (!treatments?.length) return;

    pdf.addSectionHeading(this.doc, 'Treatment Plan');

    treatments.forEach((treatment, index) => {
      this.doc
        .fontSize(pdf.FONT_SIZES.body)
        .font('Helvetica')
        .fillColor(pdf.COLORS.text)
        .text(`${index + 1}. ${treatment}`);
    });

    this.doc.moveDown();
  }

  async _addChart() {
    const { chartData } = this.data;
    if (!chartData?.show) return;

    // Check if we need a new page for the chart
    if (this.doc.y > 500) {
      this.doc.addPage();
    }

    pdf.addSectionHeading(this.doc, chartData.title || 'Statistics');

    try {
      const chartBuffer = await chart.generatePieChart(
        chartData.labels,
        chartData.data,
        {
          width: 400,
          height: 300,
          title: chartData.title,
        }
      );

      // Center the chart
      const chartX = (this.doc.page.width - 400) / 2;
      pdf.embedImage(this.doc, chartBuffer, {
        x: chartX,
        y: this.doc.y,
        width: 400,
        height: 300,
      });

      this.doc.y += 310;
      this.doc.moveDown();
    } catch (err) {
      this.doc
        .fontSize(pdf.FONT_SIZES.small)
        .fillColor(pdf.COLORS.secondary)
        .text('[Chart could not be generated]');
      this.doc.moveDown();
    }
  }

  _addRemarks() {
    const { remarks } = this.data;
    if (!remarks) return;

    pdf.addSectionHeading(this.doc, 'Remarks');

    this.doc
      .fontSize(pdf.FONT_SIZES.body)
      .font('Helvetica')
      .fillColor(pdf.COLORS.text)
      .text(remarks);

    this.doc.moveDown();
  }
}

module.exports = DiagnosisReportTemplate;

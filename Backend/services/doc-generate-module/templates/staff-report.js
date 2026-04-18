const BaseTemplate = require('../base-template.js');
const pdf = require('../../pdfkit.js');
const chart = require('../../chart.js');

/**
 * Staff Analytics Report Template
 * Used for staff-only analytics reports with data visualizations
 * Not persisted to database - streamed directly
 */
class StaffReportTemplate extends BaseTemplate {
  static get type() {
    return 'staff-report';
  }

  static get displayName() {
    return 'Staff Analytics Report';
  }

  static get persistToDatabase() {
    return false;
  }

  static getSampleData() {
    return {
      ...super.getSampleData(),
      report: {
        title: 'Monthly Analytics Report',
        subtitle: 'January 2026',
        branch: 'Manila',
        dateRange: {
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        },
        generatedAt: new Date().toISOString(),
      },
      sections: [
        {
          title: 'Consultations by Type',
          chartType: 'pie',
          labels: ['Medical', 'Dental'],
          values: [120, 45],
          summary: 'Total: 165 consultations',
        },
        {
          title: 'Daily Consultations Trend',
          chartType: 'line',
          labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
          values: [38, 42, 45, 40],
          summary: 'Average: 41 consultations per week',
        },
        {
          title: 'Top Diagnoses',
          chartType: 'bar',
          labels: ['URTI', 'Dental Caries', 'Hypertension', 'Allergy', 'Other'],
          values: [45, 32, 28, 20, 40],
          summary: 'Most common: Upper Respiratory Tract Infection',
        },
      ],
      summary: {
        totalPatients: 312,
        newPatients: 45,
        totalConsultations: 165,
        appointmentsCompleted: 142,
        medicineIssued: 523,
      },
    };
  }

  async build() {
    this.init();

    const { report } = this.data;

    // Header
    this.addHeader(
      report?.title || 'ANALYTICS REPORT',
      report?.subtitle || this._getDateRangeLabel()
    );

    // Report metadata
    this._addReportMetadata();

    // Summary statistics
    this._addSummaryStats();

    // Chart sections
    await this._addChartSections();

    // Footer note
    this._addFooterNote();

    // Generator signature
    this._addGeneratorSignature();

    return this;
  }

  _getDateRangeLabel() {
    const { report } = this.data;
    if (!report?.dateRange) return '';

    const start = this._formatDate(report.dateRange.startDate);
    const end = this._formatDate(report.dateRange.endDate);
    return `${start} - ${end}`;
  }

  _addReportMetadata() {
    const { report } = this.data;
    if (!report) return;

    pdf.addSectionHeading(this.doc, 'Report Information');

    pdf.addField(this.doc, 'Branch', report.branch || 'All Branches');
    pdf.addField(this.doc, 'Date Range', this._getDateRangeLabel());
    pdf.addField(this.doc, 'Generated At', this._formatDate(report.generatedAt) + ' ' +
      new Date(report.generatedAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }));

    this.doc.moveDown();
  }

  _addSummaryStats() {
    const { summary } = this.data;
    if (!summary) return;

    pdf.addSectionHeading(this.doc, 'Summary Statistics');

    // Create a summary table
    const headers = ['Metric', 'Value'];
    const rows = [];

    if (summary.totalPatients !== undefined) {
      rows.push(['Total Patients', summary.totalPatients.toLocaleString()]);
    }
    if (summary.newPatients !== undefined) {
      rows.push(['New Patients', summary.newPatients.toLocaleString()]);
    }
    if (summary.totalConsultations !== undefined) {
      rows.push(['Total Consultations', summary.totalConsultations.toLocaleString()]);
    }
    if (summary.appointmentsCompleted !== undefined) {
      rows.push(['Appointments Completed', summary.appointmentsCompleted.toLocaleString()]);
    }
    if (summary.medicineIssued !== undefined) {
      rows.push(['Medicine Units Issued', summary.medicineIssued.toLocaleString()]);
    }

    // Add any custom metrics
    Object.entries(summary).forEach(([key, value]) => {
      if (!['totalPatients', 'newPatients', 'totalConsultations', 'appointmentsCompleted', 'medicineIssued'].includes(key)) {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        rows.push([label, typeof value === 'number' ? value.toLocaleString() : String(value)]);
      }
    });

    if (rows.length > 0) {
      pdf.addTable(this.doc, headers, rows, {
        columnWidths: [250, 218],
      });
    }

    this.doc.moveDown();
  }

  async _addChartSections() {
    const { sections } = this.data;
    if (!sections?.length) return;

    for (const section of sections) {
      // Add page if section heading + table (min 60pt) + chart (240pt) won't fit
      const sectionNeeds = 310;
      const pageContentBottom = this.doc.page.height - this.doc.page.margins.bottom - 20;
      if (this.doc.y + sectionNeeds > pageContentBottom) {
        this.doc.addPage();
      }

      pdf.addSectionHeading(this.doc, section.title);

      // ── Data Table (ranked, before chart) ──────────────
      if (section.labels?.length > 0) {
        if (section.isBoxPlot && Array.isArray(section.boxPlot) && section.boxPlot.length > 0) {
          const headers = ['#', 'Vital', 'Min', 'Q1', 'Median', 'Q3', 'Max', 'n'];
          const rows = section.boxPlot.map((item, i) => [
            String(i + 1),
            item.name,
            String(item.min ?? 0),
            String(item.q1 ?? 0),
            String(item.median ?? 0),
            String(item.q3 ?? 0),
            String(item.max ?? 0),
            String(item.count ?? 0),
          ]);
          pdf.addTable(this.doc, headers, rows, {
            // Column widths sum to 468 (standard doc width 612 - 72*2 margins)
            columnWidths: [24, 112, 44, 44, 52, 44, 44, 104],
          });
        } else if (section.isBP && section.diastolicValues) {
          // Blood Pressure: show Systolic, Diastolic, Combined
          // Column widths sum to 468 (standard doc width 612 - 72*2 margins)
          const headers = ['#', 'Period', 'Systolic', 'Diastolic', 'Avg BP'];
          const rows = section.labels.map((label, i) => [
            String(i + 1),
            label,
            String(section.values[i] || 0),
            String(section.diastolicValues[i] || 0),
            `${section.values[i] || 0}/${section.diastolicValues[i] || 0}`,
          ]);
          pdf.addTable(this.doc, headers, rows, {
            columnWidths: [28, 180, 90, 90, 80],
          });
        } else if (section.isTrend) {
          const headers = ['#', 'Period', section.yAxis || 'Value'];
          const rows = section.labels.map((label, i) => [
            String(i + 1),
            label,
            String(section.values[i] || 0),
          ]);
          pdf.addTable(this.doc, headers, rows, {
            columnWidths: [28, 300, 140],
          });
        } else {
          const showPercentage = section.showPercentage !== false;
          const headers = showPercentage
            ? ['#', section.xAxis || 'Item', section.yAxis || 'Count', '%']
            : ['#', section.xAxis || 'Item', section.yAxis || 'Count'];
          const rows = section.labels.map((label, i) => {
            if (!showPercentage) {
              return [String(i + 1), label, String(section.values[i] || 0)];
            }
            const pct = section.total > 0
              ? ((section.values[i] / section.total) * 100).toFixed(1) + '%'
              : '0%';
            return [String(i + 1), label, String(section.values[i] || 0), pct];
          });
          pdf.addTable(this.doc, headers, rows, {
            columnWidths: showPercentage ? [28, 280, 90, 70] : [28, 300, 140],
          });
        }
        this.doc.moveDown(0.3);
      }

      // ── Chart ──────────────────────────────────────────
      try {
        let chartBuffer;
        const chartOptions = {
          width: 420,
          height: 240,
          title: section.title,
        };

        if (section.isBP && section.diastolicValues) {
          chartBuffer = await chart.generateLineChart(
            section.labels,
            [
              { label: 'Systolic', data: section.values, borderColor: '#F44336', fill: false },
              { label: 'Diastolic', data: section.diastolicValues, borderColor: '#2196F3', fill: false },
            ],
            chartOptions
          );
        } else {
          switch (section.chartType) {
            case 'pie':
              chartBuffer = await chart.generatePieChart(section.labels, section.values, chartOptions);
              break;
            case 'doughnut':
              chartBuffer = await chart.generateDoughnutChart(section.labels, section.values, chartOptions);
              break;
            case 'line':
              chartBuffer = await chart.generateLineChart(
                section.labels,
                [{
                  label: section.title,
                  data: section.values,
                borderColor: '#2196F3',
                fill: false,
              }],
              chartOptions
            );
            break;
          case 'bar':
          default:
            chartBuffer = await chart.generateBarChart(
              section.labels,
              [{
                label: section.title,
                data: section.values,
                backgroundColor: '#4CAF50',
              }],
              chartOptions
            );
            break;
          }
        }

        // Add page if chart won't fit in remaining space
        const chartNeeds = 250; // chart height + some padding
        if (this.doc.y + chartNeeds > pageContentBottom) {
          this.doc.addPage();
        } else {
          this.doc.moveDown(0.3);
        }
        const chartX = (this.doc.page.width - 420) / 2;
        pdf.embedImage(this.doc, chartBuffer, {
          x: chartX,
          y: this.doc.y,
          width: 420,
          height: 240,
        });

        this.doc.y += 250;
      } catch (err) {
        this.doc
          .fontSize(pdf.FONT_SIZES.small)
          .fillColor(pdf.COLORS.secondary)
          .text('[Chart could not be generated]');
      }

      // Add summary if provided
      if (section.summary) {
        this.doc
          .fontSize(pdf.FONT_SIZES.small)
          .font('Helvetica-Oblique')
          .fillColor(pdf.COLORS.secondary)
          .text(section.summary, { align: 'center' });
        this.doc.font('Helvetica');
      }

      this.doc.moveDown();
    }
  }

  _addFooterNote() {
    this.doc.moveDown();

    this.doc
      .fontSize(pdf.FONT_SIZES.small)
      .fillColor(pdf.COLORS.secondary)
      .text(
        'This report is generated for internal use only. Data is based on records available at the time of generation.',
        { align: 'center' }
      );

    this.doc.moveDown();
  }

  _addGeneratorSignature() {
    const { physician } = this.data;
    if (!physician) return;

    const name = `Generated by: ${physician.firstName} ${physician.lastName}`;

    this.doc
      .fontSize(pdf.FONT_SIZES.body)
      .font('Helvetica')
      .fillColor(pdf.COLORS.text)
      .text(name, { align: 'right' });
  }

  generateFilename() {
    const { report } = this.data;
    const branch = report?.branch?.replace(/\s+/g, '_') || 'all';
    const date = this._formatDateForFilename();
    return `staff_report_${branch}_${date}.pdf`;
  }
}

module.exports = StaffReportTemplate;

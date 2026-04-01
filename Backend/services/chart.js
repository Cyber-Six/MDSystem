const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const logger = require('../utils/logger.js');

// Default chart dimensions
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;

// Create chart canvas instance (reusable)
let chartCanvas = null;

function getChartCanvas(width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
  // Create new canvas if dimensions differ or doesn't exist
  if (!chartCanvas || chartCanvas.width !== width || chartCanvas.height !== height) {
    chartCanvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: 'white',
    });
  }
  return chartCanvas;
}

/**
 * Generate a chart image as PNG buffer
 * @param {string} type - Chart type: 'bar', 'line', 'pie', 'doughnut'
 * @param {object} data - Chart.js data object { labels, datasets }
 * @param {object} options - Additional chart options
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateChart(type, data, options = {}) {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    title = '',
    ...chartOptions
  } = options;

  const canvas = getChartCanvas(width, height);

  const configuration = {
    type,
    data,
    options: {
      responsive: false,
      plugins: {
        title: {
          display: !!title,
          text: title,
          font: { size: 16, weight: 'bold' },
        },
        legend: {
          display: true,
          position: 'bottom',
        },
      },
      ...chartOptions,
    },
  };

  try {
    const buffer = await canvas.renderToBuffer(configuration);
    logger.debug(`Chart generated: type=${type}, size=${buffer.length} bytes`);
    return buffer;
  } catch (err) {
    logger.error('Chart generation failed', { error: err.message, type });
    throw err;
  }
}

/**
 * Generate a bar chart
 * @param {string[]} labels - X-axis labels
 * @param {object[]} datasets - Array of { label, data, backgroundColor }
 * @param {object} options - Chart options
 * @returns {Promise<Buffer>}
 */
async function generateBarChart(labels, datasets, options = {}) {
  return generateChart('bar', { labels, datasets }, options);
}

/**
 * Generate a line chart
 * @param {string[]} labels - X-axis labels
 * @param {object[]} datasets - Array of { label, data, borderColor, fill }
 * @param {object} options - Chart options
 * @returns {Promise<Buffer>}
 */
async function generateLineChart(labels, datasets, options = {}) {
  return generateChart('line', { labels, datasets }, {
    ...options,
    elements: {
      line: { tension: 0.3 },
    },
  });
}

/**
 * Generate a pie chart
 * @param {string[]} labels - Slice labels
 * @param {number[]} data - Slice values
 * @param {object} options - Chart options
 * @returns {Promise<Buffer>}
 */
async function generatePieChart(labels, data, options = {}) {
  const colors = options.colors || [
    '#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0',
    '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#E91E63',
  ];

  return generateChart('pie', {
    labels,
    datasets: [{
      data,
      backgroundColor: colors.slice(0, data.length),
    }],
  }, options);
}

/**
 * Generate a doughnut chart
 * @param {string[]} labels - Slice labels
 * @param {number[]} data - Slice values
 * @param {object} options - Chart options
 * @returns {Promise<Buffer>}
 */
async function generateDoughnutChart(labels, data, options = {}) {
  const colors = options.colors || [
    '#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0',
    '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#E91E63',
  ];

  return generateChart('doughnut', {
    labels,
    datasets: [{
      data,
      backgroundColor: colors.slice(0, data.length),
    }],
  }, options);
}

// Sample data for testing
const sampleChartData = {
  bar: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [{
      label: 'Consultations',
      data: [45, 62, 38, 55, 70],
      backgroundColor: '#4CAF50',
    }],
  },
  pie: {
    labels: ['Hypertension', 'Diabetes', 'URTI', 'Allergies', 'Others'],
    data: [30, 25, 20, 15, 10],
  },
};

module.exports = {
  generateChart,
  generateBarChart,
  generateLineChart,
  generatePieChart,
  generateDoughnutChart,
  sampleChartData,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
};

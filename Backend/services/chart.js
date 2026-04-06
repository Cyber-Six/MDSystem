const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const logger = require('../utils/logger.js');

// Default chart dimensions
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;

function createChartCanvas(width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
  return new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: 'white',
  });
}

/**
 * Generate a chart image as PNG buffer
 * @param {string} type - Chart type: 'bar', 'line', 'pie', 'doughnut'
 * @param {object} data - Chart.js data object { labels, datasets }
 * @param {object} options - Additional chart options
 * @returns {Promise<Buffer>} PNG image buffer
 */
// Truncate labels that are too long to display cleanly on charts
function truncateLabels(labels, maxLength = 30) {
  return labels.map(l => {
    const s = String(l || '');
    return s.length > maxLength ? s.substring(0, maxLength - 1) + '…' : s;
  });
}

async function generateChart(type, data, options = {}) {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    title = '',
    ...chartOptions
  } = options;

  // Always create a fresh canvas — avoids concurrency issues in Express context
  const canvas = createChartCanvas(width, height);

  // Truncate labels for non-pie charts so axis labels render cleanly
  const chartData = { ...data };
  if (type === 'bar' || type === 'line') {
    chartData.labels = truncateLabels(data.labels || []);
  }

  const configuration = {
    type,
    data: chartData,
    options: {
      responsive: false,
      plugins: {
        title: {
          display: !!title,
          text: title,
          font: { size: 14, weight: 'bold' },
        },
        legend: {
          display: true,
          position: 'bottom',
          labels: { font: { size: 10 }, padding: 8 },
        },
      },
      scales: (type === 'bar' || type === 'line') ? {
        x: { ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 0 } },
        y: { ticks: { font: { size: 9 } } },
      } : undefined,
      ...chartOptions,
    },
  };

  try {
    const buffer = await canvas.renderToBuffer(configuration);
    if (!buffer || buffer.length < 100) {
      throw new Error('Chart rendered empty buffer');
    }
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

jest.mock('chartjs-node-canvas', () => ({ ChartJSNodeCanvas: jest.fn().mockImplementation(() => ({ renderToBuffer: jest.fn() })) }));
jest.mock('../utils/logger.js', () => ({ debug: jest.fn(), error: jest.fn() }));
const { ChartJSNodeCanvas } = require('chartjs-node-canvas'); const logger = require('../utils/logger'); const charts = require('./chart');
beforeEach(() => { jest.clearAllMocks(); });

test('generates chart types with default and custom dimensions and formatted axis labels', async () => {
  let instance;
  ChartJSNodeCanvas.mockImplementation(options => { instance = { options, renderToBuffer: jest.fn().mockResolvedValue(Buffer.alloc(120)) }; return instance; });
  const result = await charts.generateChart('bar', { labels: ['A'.repeat(32), null], datasets: [] }, { title: 'Report', width: 300, extra: true });
  expect(result).toHaveLength(120);
  expect(instance.options).toEqual({ width: 300, height: 400, backgroundColour: 'white' });
  const config = instance.renderToBuffer.mock.calls[0][0];
  expect(config.data.labels).toEqual(['A'.repeat(29) + '…', '']);
  expect(config.options).toMatchObject({ responsive: false, extra: true, plugins: { title: { display: true, text: 'Report' } } });
  await charts.generateChart('line', { labels: ['short'] });
  expect(instance.options).toEqual({ width: 600, height: 400, backgroundColour: 'white' });
  expect(instance.renderToBuffer.mock.calls[0][0].options.scales).toBeDefined();
  await charts.generateChart('pie', { labels: ['A'] });
  expect(instance.renderToBuffer.mock.calls[0][0].options.scales).toBeUndefined();
  expect(logger.debug).toHaveBeenCalled();
});

test.each(['bar', 'line', 'pie', 'doughnut'])('%s helper builds the expected data and supports options', async type => {
  const rendered = [];
  ChartJSNodeCanvas.mockImplementation(() => ({ renderToBuffer: jest.fn(async config => { rendered.push(config); return Buffer.alloc(100); }) }));
  const labels = ['A']; const values = [5]; const opts = { colors: ['red'], title: 'T' };
  const result = type === 'bar' ? await charts.generateBarChart(labels, [{ data: values }], opts)
    : type === 'line' ? await charts.generateLineChart(labels, [{ data: values }], opts)
      : type === 'pie' ? await charts.generatePieChart(labels, values, opts)
        : await charts.generateDoughnutChart(labels, values, opts);
  expect(result).toHaveLength(100);
  expect(rendered[0].type).toBe(type);
  if (type === 'line') expect(rendered[0].options.elements.line.tension).toBe(0.3);
  if (type === 'pie' || type === 'doughnut') expect(rendered[0].data.datasets[0].backgroundColor).toEqual(['red']);
});

test('rejects missing or undersized chart output and propagates renderer failures', async () => {
  ChartJSNodeCanvas.mockImplementationOnce(() => ({ renderToBuffer: jest.fn().mockResolvedValue(null) }));
  await expect(charts.generateChart('pie', { labels: [] })).rejects.toThrow('Chart rendered empty buffer');
  ChartJSNodeCanvas.mockImplementationOnce(() => ({ renderToBuffer: jest.fn().mockRejectedValue(new Error('canvas failed')) }));
  await expect(charts.generateChart('line', { labels: [] })).rejects.toThrow('canvas failed');
  expect(logger.error).toHaveBeenCalledTimes(2);
  expect(charts.sampleChartData).toHaveProperty('bar');
});

test('uses default pie colors, tolerates non-axis chart types, and logs successful default titles', async () => {
  let config;
  ChartJSNodeCanvas.mockImplementation(() => ({ renderToBuffer: jest.fn(async value => { config = value; return Buffer.alloc(101); }) }));
  await charts.generatePieChart(['one'], [1]);
  expect(config.data.datasets[0].backgroundColor).toHaveLength(1);
  expect(config.options.plugins.title).toMatchObject({ display: false, text: '' });
  await charts.generateDoughnutChart(['two'], [2], { colors: [] });
  expect(config.data.datasets[0].backgroundColor).toEqual([]);
  await charts.generateChart('scatter', { labels: ['ok'] });
  expect(config.options.scales).toBeUndefined();
});

test('rejects short chart buffers and truncates labels at a custom length', async () => {
  ChartJSNodeCanvas.mockImplementation(() => ({ renderToBuffer: jest.fn().mockResolvedValue(Buffer.alloc(99)) }));
  await expect(charts.generateChart('pie', { labels: [] })).rejects.toThrow('Chart rendered empty buffer');
  ChartJSNodeCanvas.mockImplementation(() => ({ renderToBuffer: jest.fn(async config => { expect(config.data.labels[0]).toBe(`${'x'.repeat(29)}…`); return Buffer.alloc(101); }) }));
  await charts.generateChart('line', { labels: ['x'.repeat(40)] }, { maxRotation: 12 });
});

test('supplies empty data and default arguments to convenience chart methods', async () => {
  let seen;
  ChartJSNodeCanvas.mockImplementation(() => ({ renderToBuffer: jest.fn(async config => { seen = config; return Buffer.alloc(100); }) }));
  await charts.generateChart('bar', {});
  expect(seen.data.labels).toEqual([]);
  await charts.generateBarChart(['A'], []);
  await charts.generateLineChart(['B'], []);
  await charts.generateDoughnutChart(['C'], [1]);
  expect(seen.data.datasets[0].backgroundColor).toHaveLength(1);
});

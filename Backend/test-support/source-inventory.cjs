const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const excludedDirectories = new Set(['node_modules', 'coverage', 'dist', 'build', '__tests__', '__mocks__', 'test-support']);
const excludedFiles = new Set(['jest.config.js', 'test-patient-management.js']);

function listSources(root = backendRoot) {
  function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return excludedDirectories.has(entry.name) ? [] : walk(absolute);
      if (!entry.isFile() || !entry.name.endsWith('.js') || /\.(test|spec)\.js$/.test(entry.name)) return [];
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      return excludedFiles.has(relative) ? [] : [relative];
    });
  }
  return walk(root).sort();
}

function counterpartPaths(source) {
  const directory = path.posix.dirname(source);
  const filename = path.posix.basename(source, '.js') + '.test.js';
  return [path.posix.join(directory, filename), path.posix.join(directory, '__tests__', filename)];
}

function missingCounterparts(root = backendRoot) {
  return listSources(root).filter(source => !counterpartPaths(source).some(test => fs.existsSync(path.join(root, test))));
}

const fullCoverage = { statements: 100, branches: 100, functions: 100, lines: 100 };
function coverageThresholds() {
  return Object.fromEntries(listSources().map(source => [path.join(backendRoot, source).replace(/\\/g, '/'), { ...fullCoverage }]));
}

module.exports = { backendRoot, listSources, counterpartPaths, missingCounterparts, coverageThresholds };

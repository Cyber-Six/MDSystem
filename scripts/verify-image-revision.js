'use strict';

const { spawnSync } = require('node:child_process');

function verifyImageRevisions(expectedRevision, containers, inspectRevision) {
  if (!expectedRevision) throw new Error('Expected source revision is required.');
  if (containers.length !== 2 || !['patient', 'staff'].every(name => containers.some(container => container.name === name && container.id))) {
    throw new Error('Pass the running patient and staff container IDs.');
  }
  for (const container of containers) {
    const actualRevision = inspectRevision(container.id);
    if (actualRevision !== expectedRevision) {
      throw new Error(`${container.name} runs image revision ${actualRevision || 'unknown'}; expected ${expectedRevision}.`);
    }
  }
  return true;
}

function inspectContainerRevision(container) {
  const containerResult = spawnSync('docker', ['inspect', '--format', '{{.Image}}', container], { encoding: 'utf8' });
  if (containerResult.status !== 0) throw new Error(`Could not inspect container ${container}: ${containerResult.stderr.trim()}`);
  const imageId = containerResult.stdout.trim();
  const imageResult = spawnSync('docker', ['image', 'inspect', '--format', '{{ index .Config.Labels "org.opencontainers.image.revision" }}', imageId], { encoding: 'utf8' });
  if (imageResult.status !== 0) throw new Error(`Could not inspect image for ${container}: ${imageResult.stderr.trim()}`);
  return imageResult.stdout.trim();
}

if (require.main === module) {
  const [revision, ...containerArgs] = process.argv.slice(2);
  const containers = containerArgs.map(value => {
    const separator = value.indexOf('=');
    return { name: value.slice(0, separator), id: value.slice(separator + 1) };
  });
  try {
    verifyImageRevisions(revision, containers, inspectContainerRevision);
    console.log(`Verified patient and staff containers use source revision ${revision}.`);
  } catch (error) {
    console.error(`Deployment image verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { verifyImageRevisions };

// Compatibility entrypoint: exercise production implementations via Jest.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync(process.execPath, [
  path.join(__dirname, '../node_modules/jest/bin/jest.js'),
  '--runInBand', '--runTestsByPath', 'test/credentials.spec.ts',
], { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;

/* global process */

import { build } from 'vite';

async function testBuild() {
  try {
    console.log('Starting build test...');
    await build({
      logLevel: 'info',
    });
    console.log('Build successful!');
  } catch (err) {
    console.error('Build failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

testBuild();

const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

async function build() {
  const ctx = await esbuild.context({
    entryPoints: ['src/showcal.js'],
    bundle: true,
    format: 'iife',
    globalName: 'ShowCal',
    outfile: 'dist/showcal.js',
    minify: false,
    sourcemap: true,
  });

  const ctxMin = await esbuild.context({
    entryPoints: ['src/showcal.js'],
    bundle: true,
    format: 'iife',
    globalName: 'ShowCal',
    outfile: 'dist/showcal.min.js',
    minify: true,
  });

  const ctxCss = await esbuild.context({
    entryPoints: ['showcal.css'],
    bundle: true,
    outfile: 'dist/showcal.css',
    minify: false,
  });

  const ctxCssMin = await esbuild.context({
    entryPoints: ['showcal.css'],
    bundle: true,
    outfile: 'dist/showcal.min.css',
    minify: true,
  });

  await Promise.all([ctx.rebuild(), ctxMin.rebuild(), ctxCss.rebuild(), ctxCssMin.rebuild()]);
  console.log('Build complete.');

  if (watch) {
    await Promise.all([ctx.watch(), ctxCss.watch()]);
    console.log('Watching for changes...');
  } else {
    await Promise.all([ctx.dispose(), ctxMin.dispose(), ctxCss.dispose(), ctxCssMin.dispose()]);
  }
}

build().catch((e) => { console.error(e); process.exit(1); });

const esbuild = require("esbuild");
const pkg = require("./package.json");

const watch = process.argv.includes("--watch");

// Inject the package version as a build-time constant. Consumed by
// src/util/ready-handshake.js to include the version in the
// `already:ready` postMessage payload — so a framing host can branch
// on bundle capability if the handshake's message shape evolves.
const define = {
  __ALREADY_VERSION__: JSON.stringify(pkg.version),
};

async function build() {
  const ctx = await esbuild.context({
    entryPoints: ["src/already-cal.js"],
    bundle: true,
    format: "iife",
    globalName: "Already",
    outfile: "dist/already-cal.js",
    minify: false,
    sourcemap: true,
    define,
  });

  const ctxMin = await esbuild.context({
    entryPoints: ["src/already-cal.js"],
    bundle: true,
    format: "iife",
    globalName: "Already",
    outfile: "dist/already-cal.min.js",
    minify: true,
    define,
  });

  const ctxCss = await esbuild.context({
    entryPoints: ["src/styles/index.css"],
    bundle: true,
    outfile: "dist/already-cal.css",
    minify: false,
  });

  const ctxCssMin = await esbuild.context({
    entryPoints: ["src/styles/index.css"],
    bundle: true,
    outfile: "dist/already-cal.min.css",
    minify: true,
  });

  // The DOM-free core entry (src/core.js), for server-side consumers. Built
  // with platform: "neutral" so nothing DOM-shaped leaks in. No mainFields
  // override is needed: marked's package.json has an "exports" map with an
  // "import" condition pointing at lib/marked.esm.js, and esbuild honors
  // that condition ahead of mainFields whenever format is "esm".
  const ctxCore = await esbuild.context({
    entryPoints: ["src/core.js"],
    bundle: true,
    format: "esm",
    platform: "neutral",
    outfile: "dist/already-cal-core.mjs",
    minify: false,
    define,
  });

  await Promise.all([
    ctx.rebuild(),
    ctxMin.rebuild(),
    ctxCss.rebuild(),
    ctxCssMin.rebuild(),
    ctxCore.rebuild(),
  ]);
  console.log("Build complete.");

  if (watch) {
    await Promise.all([ctx.watch(), ctxCss.watch(), ctxCore.watch()]);
    console.log("Watching for changes...");
  } else {
    await Promise.all([
      ctx.dispose(),
      ctxMin.dispose(),
      ctxCss.dispose(),
      ctxCssMin.dispose(),
      ctxCore.dispose(),
    ]);
  }
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});

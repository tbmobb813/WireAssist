// Deep-import shim for `@wireassist/core/logger` — lets consumers pull in
// just the logger (a leaf, dependency-free module) without requiring the
// full barrel (dist/index.js), which eagerly requires better-sqlite3 via
// its SQLite-backed stores. None of this package's tsconfigs inherit the
// root tsconfig.base.json's path-alias mapping (each overrides `paths`),
// and none declare a package.json `exports` map, so this file has to
// physically exist at the package root for both TypeScript's classic
// "node" resolution and Node's own runtime resolution to find it.
module.exports = require('./dist/logger');

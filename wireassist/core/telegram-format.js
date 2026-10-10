// Deep-import shim for `@wireassist/core/telegram-format` — same reason as
// logger.js: the Telegram bot needs only this leaf module, not the full
// barrel that eagerly loads better-sqlite3.
module.exports = require('./dist/telegram-format');

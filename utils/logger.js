// utils/logger.js - Logger simple MAKERHUB.PRO
const logger = {
  info: (message, meta) => console.log(`ℹ️ ${message}`, meta || ''),
  error: (message, meta) => console.error(`❌ ${message}`, meta || ''),
  warn: (message, meta) => console.warn(`⚠️ ${message}`, meta || ''),
  success: (message, meta) => console.log(`✅ ${message}`, meta || ''),
  debug: (message, meta) => console.log(`🐛 ${message}`, meta || ''),
  log: (level, message, meta) => console.log(`[${level}] ${message}`, meta || '')
};

module.exports = logger;
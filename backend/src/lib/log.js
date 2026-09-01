'use strict';

function stamp() {
  return new Date().toISOString();
}

module.exports = {
  info: (...args) => console.log(`[${stamp()}]`, ...args),
  warn: (...args) => console.warn(`[${stamp()}]`, ...args),
  error: (...args) => console.error(`[${stamp()}]`, ...args),
};

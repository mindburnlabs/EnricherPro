// Suppress the "url.parse()" deprecation warning
// This occurs due to dependencies using the legacy API.
if (typeof process !== 'undefined' && process.emitWarning) {
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = (warning, ...args) => {
    if (typeof warning === 'string' && warning.includes('url.parse()')) return;
    if (
      warning &&
      typeof warning === 'object' &&
      warning.name === 'DeprecationWarning' &&
      warning.message.includes('url.parse()')
    )
      return;
    // @ts-ignore
    return originalEmitWarning.call(process, warning, ...args);
  };
}

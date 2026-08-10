/**
 * Collect page errors and console errors while running a test body.
 * Ignores known benign browser noise.
 */
async function withConsoleGuard(page, run) {
  const errors = [];
  const ignore = [
    /favicon/i,
    /Download the React DevTools/i,
    /\[Violation\]/i,
  ];

  const onConsole = (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (ignore.some((pattern) => pattern.test(text))) return;
    errors.push(`console: ${text}`);
  };
  const onPageError = (error) => {
    errors.push(`pageerror: ${error.message}`);
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  try {
    await run();
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }

  return errors;
}

module.exports = { withConsoleGuard };

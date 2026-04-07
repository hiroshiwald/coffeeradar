// Tiny logger wrapper. Silent during tests so unit-test output stays clean.
// Use in place of bare console calls so we can later swap in structured logging.

const isTest =
  typeof process !== "undefined" &&
  (process.env.VITEST === "true" || process.env.NODE_ENV === "test");

type LogFn = (msg: string, meta?: unknown) => void;

function format(msg: string, meta?: unknown): unknown[] {
  return meta === undefined ? [msg] : [msg, meta];
}

export const logger: { warn: LogFn; error: LogFn; info: LogFn } = {
  warn(msg, meta) {
    if (isTest) return;
    console.warn(...format(msg, meta));
  },
  error(msg, meta) {
    if (isTest) return;
    console.error(...format(msg, meta));
  },
  info(msg, meta) {
    if (isTest) return;
    console.info(...format(msg, meta));
  },
};

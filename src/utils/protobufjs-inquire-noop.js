// No-op replacement for @protobufjs/inquire.
// The original uses eval() which crashes Hermes in production builds.
// inquire() is used to optionally require modules; returning null is safe —
// it's the same result as when the require fails.
module.exports = function inquire() {
  return null;
};

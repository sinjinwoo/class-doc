// @rhwp/editor defaults to this same URL internally when `studioUrl` is
// omitted (see node_modules/@rhwp/editor/index.js and its README) — the
// project chose to keep relying on that online hosting (Path A) rather than
// self-hosting rhwp-studio locally (out of scope for now, see CLAUDE.md).
// Pinning it here as an explicit named constant makes that dependency
// visible in the codebase instead of leaving it as an implicit default.
export const RHWP_STUDIO_URL = 'https://edwardkim.github.io/rhwp/'

// Ambient module declaration for Vite's `?raw` import query on `.sql` files
// (verified to work in electron-vite's main-process build — the loaded SQL
// text gets inlined as a plain string literal). Not covered by
// `electron-vite/node`'s ambient types (only `?asset`/`?modulePath`/
// `?nodeWorker`/`.node`/`.wasm?loader` are), so it's declared here
// explicitly. Uses TS's wildcard module syntax (`*.sql?raw`) rather than a
// relative specifier (`./schema.sql?raw`) — a relative-looking `declare
// module` specifier is resolved as an actual file path relative to *this*
// file rather than matched against other files' import specifiers, which
// would silently fail to apply to db/index.ts's import.
declare module '*.sql?raw' {
  const schemaSql: string
  export default schemaSql
}

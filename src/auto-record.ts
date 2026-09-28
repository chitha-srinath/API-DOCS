// ST-005 (S-05) fills the S-01 stub. Per ADR-24/ADR-40: the import-time side
// effect is isolated in this tsup entry only; `src/index.ts` begins with a
// bare `import './auto-record'`.
import './introspect/auto-record.js';

export {};

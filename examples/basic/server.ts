// examples/basic — entry point that actually starts the example (not
// exercised by the test, which only calls `createApp()` directly).
import { createApp } from './app.js';

const app = createApp();
const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Example listening on http://localhost:${port}`);
  console.log(`OpenAPI document: http://localhost:${port}/openapi.json`);
  console.log(`Docs UI:          http://localhost:${port}/docs`);
});

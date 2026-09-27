import SwaggerParser from '@apidevtools/swagger-parser';

/** Validate with @apidevtools/swagger-parser (OpenAPI 3.1). Throws when invalid. */
export async function expectValidSpec(spec: unknown): Promise<void> {
  await SwaggerParser.validate(structuredClone(spec) as never);
}

/**
 * Single seam prompts.ts calls through. Defaults to the static JSON (matches
 * prod behavior exactly, zero risk). Set SCHEMA_SOURCE=db to read from the
 * Postgres schema registry instead -- intended for preview/branch deploys
 * only while this is a spike, not the main branch default.
 */
import {
  buildCompactSchemaContext,
  buildOptimizationRules,
  buildSemanticContext,
  buildStrategicPatternsContext,
  getTargetingPhilosophy as getTargetingPhilosophyFromSchema,
} from './schema-context';
import { loadSchemaFromRegistry } from './schema-context-db';

const useDbSource = process.env.SCHEMA_SOURCE === 'db';

export async function resolveSchemaContext() {
  const source = useDbSource ? await loadSchemaFromRegistry() : undefined;

  return {
    schemaContext: buildCompactSchemaContext(source),
    optimizationRules: buildOptimizationRules(source),
    semanticContext: buildSemanticContext(source),
    strategicPatterns: buildStrategicPatternsContext(source),
    targetingPhilosophy: source
      ? source.business_context?.targeting_philosophy ?? ''
      : getTargetingPhilosophyFromSchema(),
  };
}

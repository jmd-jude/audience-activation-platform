import { getValidTables, isValidTable, isValidField } from './schema-context';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates SQL syntax at a basic level
 */
export function validateSQLSyntax(sql: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic checks
  if (!sql || sql.trim().length === 0) {
    errors.push('SQL query cannot be empty');
    return { isValid: false, errors, warnings };
  }

  const upperSQL = sql.toUpperCase();

  // Must start with SELECT
  if (!upperSQL.trim().startsWith('SELECT')) {
    errors.push('Query must start with SELECT');
  }

  // Must include FROM
  if (!upperSQL.includes('FROM')) {
    errors.push('Query must include FROM clause');
  }

  // Check for dangerous operations
  const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'TRUNCATE', 'ALTER', 'CREATE'];
  for (const keyword of dangerousKeywords) {
    if (upperSQL.includes(keyword)) {
      errors.push(`Dangerous keyword detected: ${keyword}. Only SELECT queries are allowed.`);
    }
  }

  // Check for balanced parentheses
  const openParens = (sql.match(/\(/g) || []).length;
  const closeParens = (sql.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push('Unbalanced parentheses in query');
  }

  // Warn if DISTINCT is not used
  if (!upperSQL.includes('DISTINCT')) {
    warnings.push('Consider using DISTINCT to avoid duplicate records');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates that SQL only uses valid schema tables and fields
 */
export function validateSchemaCompliance(sql: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validTables = getValidTables();

  // Extract table names from FROM and JOIN clauses
  const tablePattern = /(?:FROM|JOIN)\s+([A-Z_]+)/gi;
  const matches = sql.matchAll(tablePattern);
  const usedTables = new Set<string>();

  for (const match of matches) {
    const tableName = match[1].toUpperCase();
    usedTables.add(tableName);

    if (!isValidTable(tableName)) {
      errors.push(`Invalid table: ${tableName}. Valid tables are: ${validTables.join(', ')}`);
    }
  }

  if (usedTables.size === 0) {
    errors.push('No valid tables found in query');
  }

  // Extract field references (basic pattern matching)
  // This is a simplified check - real SQL parsing would be more complex
  const fieldPattern = /([A-Z_]+)\.([A-Z_]+)/gi;
  const fieldMatches = sql.matchAll(fieldPattern);

  for (const match of fieldMatches) {
    const tableName = match[1].toUpperCase();
    const fieldName = match[2].toUpperCase();

    if (isValidTable(tableName) && !isValidField(tableName, fieldName)) {
      warnings.push(`Field ${fieldName} may not exist in table ${tableName}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sanitizes SQL to prevent injection
 * Note: This is basic sanitization. In production, use parameterized queries.
 */
export function sanitizeSQL(sql: string): string {
  // Remove comments
  let sanitized = sql.replace(/--.*$/gm, ''); // Single line comments
  sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, ''); // Multi-line comments

  // Remove multiple semicolons (prevents multiple statement execution)
  sanitized = sanitized.replace(/;+/g, ';');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Remove trailing semicolon
  if (sanitized.endsWith(';')) {
    sanitized = sanitized.slice(0, -1);
  }

  return sanitized;
}

/**
 * Comprehensive validation combining syntax and schema checks
 */
export function validateSQL(sql: string): ValidationResult {
  const syntaxResult = validateSQLSyntax(sql);
  if (!syntaxResult.isValid) {
    return syntaxResult;
  }

  const schemaResult = validateSchemaCompliance(sql);

  return {
    isValid: syntaxResult.isValid && schemaResult.isValid,
    errors: [...syntaxResult.errors, ...schemaResult.errors],
    warnings: [...syntaxResult.warnings, ...schemaResult.warnings],
  };
}

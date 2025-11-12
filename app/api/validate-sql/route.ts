import { NextRequest, NextResponse } from 'next/server';
import { validateSQL, sanitizeSQL } from '@/lib/sql-validator';

// POST /api/validate-sql - Validate SQL query
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sqlQuery } = body;

    if (!sqlQuery) {
      return NextResponse.json(
        { error: 'Missing required field: sqlQuery' },
        { status: 400 }
      );
    }

    // Sanitize SQL
    const sanitizedSQL = sanitizeSQL(sqlQuery);

    // Validate SQL
    const validation = validateSQL(sanitizedSQL);

    return NextResponse.json({
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      sanitizedSQL,
    });
  } catch (error: any) {
    console.error('Error validating SQL:', error);
    return NextResponse.json(
      { error: 'Failed to validate SQL', details: error.message },
      { status: 500 }
    );
  }
}

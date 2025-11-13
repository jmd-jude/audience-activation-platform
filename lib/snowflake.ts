// lib/snowflake.ts
import snowflake from 'snowflake-sdk';

interface SnowflakeConfig {
  account: string;
  username: string;
  database: string;
  warehouse: string;
  schema: string;
  privateKey: string;
  timeout?: number;
}

interface QueryResult {
  rows: any[];
  columns: Array<{ name: string; type: string }>;
  rowCount: number;
  executionTime: number;
  queryId: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  estimatedRowCount?: number;
}

export class SnowflakeConnection {
  private config: SnowflakeConfig;
  private connection: any = null;

  constructor(config: SnowflakeConfig) {
    this.config = {
      timeout: 30000, // 30 second default timeout
      ...config
    };
  }

  /**
   * Establish connection to Snowflake using private key authentication
   * Mirrors Cylyndyr's authentication pattern
   */
  private async connect(): Promise<any> {
    if (this.connection) {
      return this.connection;
    }

    return new Promise((resolve, reject) => {
      try {
        // Process private key similar to Cylyndyr's approach
        let privateKeyContent = this.config.privateKey;

        // Handle potential newline issues from environment variables
        if (typeof privateKeyContent === 'string') {
          // Replace escaped newlines with actual newlines
          privateKeyContent = privateKeyContent.replace(/\\n/g, '\n').trim();
        }

        // Connection parameters matching Cylyndyr's pattern
        const connectionParams = {
          account: this.config.account,
          username: this.config.username,
          database: this.config.database,
          warehouse: this.config.warehouse,
          schema: this.config.schema,
          authenticator: 'SNOWFLAKE_JWT',
          privateKey: privateKeyContent,  // Pass PEM string directly
          timeout: this.config.timeout
        };

        console.log('Connecting to Snowflake with params:', {
          ...connectionParams,
          privateKey: '[REDACTED]'
        });

        this.connection = snowflake.createConnection(connectionParams);

        this.connection.connect((err: Error, conn: any) => {
          if (err) {
            console.error('Failed to connect to Snowflake:', err);
            reject(new Error(`Snowflake connection failed: ${err.message}`));
          } else {
            console.log('Successfully connected to Snowflake');
            resolve(conn);
          }
        });

      } catch (error) {
        reject(new Error(`Connection setup failed: ${error.message}`));
      }
    });
  }

  /**
   * Execute SQL query and return structured results
   */
  async executeQuery(sqlQuery: string): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      const conn = await this.connect();

      return new Promise((resolve, reject) => {
        conn.execute({
          sqlText: sqlQuery,
          complete: (err: Error, stmt: any, rows: any[]) => {
            const executionTime = Date.now() - startTime;

            if (err) {
              console.error('Query execution failed:', err);
              reject(new Error(`Query execution failed: ${err.message}`));
            } else {
              // Extract column metadata
              const columns = stmt.getColumns().map((col: any) => ({
                name: col.getName(),
                type: col.getType()
              }));

              const result: QueryResult = {
                rows: rows || [],
                columns,
                rowCount: rows?.length || 0,
                executionTime,
                queryId: stmt.getStatementId()
              };

              console.log(`Query executed successfully: ${result.rowCount} rows in ${executionTime}ms`);
              resolve(result);
            }
          }
        });
      });

    } catch (error) {
      throw new Error(`Query execution error: ${error.message}`);
    }
  }

  /**
   * Validate SQL query without executing it
   * Useful for checking syntax and estimating performance
   */
  async validateQuery(sqlQuery: string): Promise<ValidationResult> {
    try {
      const conn = await this.connect();

      // Use EXPLAIN to validate query without execution
      const explainQuery = `EXPLAIN ${sqlQuery}`;

      return new Promise((resolve, reject) => {
        conn.execute({
          sqlText: explainQuery,
          complete: (err: Error, stmt: any, rows: any[]) => {
            if (err) {
              // Parse Snowflake error messages
              const errorMessage = err.message || 'Unknown validation error';

              resolve({
                isValid: false,
                errors: [errorMessage],
                warnings: []
              });
            } else {
              // Query is syntactically valid
              resolve({
                isValid: true,
                errors: [],
                warnings: [],
                // Could extract estimated row count from explain plan if needed
              });
            }
          }
        });
      });

    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Get schema information for tables
   * Mirrors Cylyndyr's schema introspection
   */
  async getSchemaInfo(): Promise<any> {
    const query = `
      SELECT
        table_name,
        table_type,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = CURRENT_SCHEMA()
      ORDER BY table_name, ordinal_position
    `;

    const result = await this.executeQuery(query);

    // Group columns by table
    const schemaInfo: any = {};

    result.rows.forEach((row: any) => {
      const tableName = row.TABLE_NAME;

      if (!schemaInfo[tableName]) {
        schemaInfo[tableName] = {
          type: row.TABLE_TYPE,
          columns: []
        };
      }

      schemaInfo[tableName].columns.push({
        name: row.COLUMN_NAME,
        type: row.DATA_TYPE,
        nullable: row.IS_NULLABLE === 'YES',
        default: row.COLUMN_DEFAULT
      });
    });

    return schemaInfo;
  }

  /**
   * Close the connection
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      return new Promise((resolve) => {
        this.connection.destroy((err: Error) => {
          if (err) {
            console.error('Error closing connection:', err);
          } else {
            console.log('Connection closed successfully');
          }
          this.connection = null;
          resolve();
        });
      });
    }
  }
}

/**
 * Factory function to create Snowflake connection with environment variables
 */
export function createSnowflakeConnection(): SnowflakeConnection {
  const config: SnowflakeConfig = {
    account: process.env.SNOWFLAKE_ACCOUNT!,
    username: process.env.SNOWFLAKE_USERNAME!,
    database: process.env.SNOWFLAKE_DATABASE!,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE!,
    schema: process.env.SNOWFLAKE_SCHEMA!,
    privateKey: process.env.SNOWFLAKE_PRIVATE_KEY!,
    timeout: parseInt(process.env.SNOWFLAKE_TIMEOUT || '30000')
  };

  // Validate required environment variables
  const requiredVars = ['account', 'username', 'database', 'warehouse', 'schema', 'privateKey'];
  const missingVars = requiredVars.filter(key => !config[key as keyof SnowflakeConfig]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.map(v => `SNOWFLAKE_${v.toUpperCase()}`).join(', ')}`);
  }

  return new SnowflakeConnection(config);
}

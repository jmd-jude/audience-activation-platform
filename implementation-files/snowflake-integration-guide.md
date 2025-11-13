# Snowflake Integration Guide for Audience Activation Platform

## Overview
This guide walks through adding Snowflake database connectivity to your Next.js Audience Activation platform, enabling direct query execution similar to Cylyndyr's capabilities.

## Phase 1: Environment Setup - DONE

### 1. Install Required Dependencies
```bash
cd your-nextjs-project
npm install snowflake-sdk
npm install @types/snowflake-sdk --save-dev
```

### 2. Environment Variables Setup

Create or update your `.env.local` file with the following variables (copy values from your Cylyndyr `.env`):

```bash
# Snowflake Connection Parameters
SNOWFLAKE_ACCOUNT=your-account.snowflakecomputing.com
SNOWFLAKE_USERNAME=your-username
SNOWFLAKE_DATABASE=your-database
SNOWFLAKE_WAREHOUSE=your-warehouse  
SNOWFLAKE_SCHEMA=your-schema
SNOWFLAKE_PRIVATE_KEY=your-private-key-content-here

# Optional: For connection pooling
SNOWFLAKE_MAX_CONNECTIONS=10
SNOWFLAKE_TIMEOUT=30000
```

### 3. For Vercel Deployment
When you deploy to Vercel, you'll need to add these same environment variables to:
- Vercel Dashboard → Your Project → Settings → Environment Variables
- Make sure to mark sensitive ones (like SNOWFLAKE_PRIVATE_KEY) as secret

## Phase 2: Core Implementation Files - DONE

### 1. Snowflake Connection Library (`lib/snowflake.ts`)
This mirrors Cylyndyr's connection pattern but adapted for Node.js.

### 2. API Route for Query Execution (`app/api/snowflake/execute/route.ts`)
Handles SQL query execution requests from the frontend.

### 3. API Route for Schema Validation (`app/api/snowflake/validate/route.ts`)
Validates SQL queries without executing them.

### 4. Updated Segment Generation (`app/api/generate-segment/route.ts`)
Modified to actually execute queries and get estimated sizes.

## Phase 3: Frontend Integration

### 1. Update GenerateForm Component
- Add "Test Query" button to execute generated SQL
- Show actual result counts instead of estimates
- Display sample results for validation

### 2. Update SQLEditor Component  
- Add query execution capabilities
- Show execution status and results
- Add query performance metrics

### 3. Enhanced Review Interface
- Real-time query validation
- Actual audience size calculation
- Data quality checks

## Phase 4: Advanced Features (Future)

### 1. Query Optimization
- Query performance analysis
- Automatic query optimization suggestions
- Cost estimation

### 2. Data Preview
- Sample data preview before segment creation
- Interactive data exploration
- Visual data profiling

### 3. Real-time Validation
- Live SQL syntax checking
- Schema validation against actual tables
- Performance warnings

## Security Considerations

### 1. Private Key Handling
- Never expose private keys in client-side code
- Use server-side API routes only
- Implement proper error handling to avoid key leakage

### 2. Query Sanitization
- Validate SQL queries before execution
- Implement query whitelisting/blacklisting
- Add query timeout limits

### 3. Access Control
- Implement user-based query restrictions
- Add audit logging for all database queries
- Rate limiting for API endpoints

## Testing Strategy

### 1. Local Testing
- Test with your existing Snowflake credentials
- Validate against the schema JSON from Cylyndyr
- Test error handling scenarios

### 2. Deployment Testing
- Test environment variable loading on Vercel
- Verify connection pooling works correctly
- Test query execution performance

## Troubleshooting Common Issues

### 1. Private Key Format Issues
- Ensure private key includes proper BEGIN/END markers
- Handle newline characters correctly in environment variables
- Verify key format matches Cylyndyr's working setup

### 2. Connection Timeouts
- Adjust timeout values for large queries
- Implement proper connection cleanup
- Add retry logic for transient failures

### 3. Vercel Deployment Issues
- Check environment variable configuration
- Verify serverless function timeout limits
- Monitor cold start performance

## Next Steps

1. **Immediate**: Implement core connection library and basic query execution
2. **Short-term**: Add query validation and result preview
3. **Medium-term**: Integrate with existing segment generation workflow
4. **Long-term**: Build advanced AI-driven data exploration features

This foundation will unlock the "rainbow of AI/LLM facilitated flows" by providing direct database access within your Next.js application architecture.

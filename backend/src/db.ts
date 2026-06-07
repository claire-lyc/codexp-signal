import pg from 'pg';

const { Pool } = pg;
type QueryResultRow = pg.QueryResultRow;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query<T extends QueryResultRow>(sql: string, values: unknown[] = []) {
  const result = await pool.query<T>(sql, values);
  return result.rows;
}

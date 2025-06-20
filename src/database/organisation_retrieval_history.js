import { Pool } from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const dbConfig = {
  user: process.env.DBUSER,
  host: process.env.DBHOST,
  database: process.env.DBNAME,
  password: process.env.DBPW,
  port: process.env.DBPORT,
};

const connectToDatabase = () => {
  const pool = new Pool(dbConfig);
  console.log('Database connection established.');
  return pool;
};

const closeDatabase = (pool) => {
  if (pool) {
    pool.end();
    console.log('Database connection closed.');
  }
};

const checkOrganisationInSession = async (pool, organisationId) => {
  const paddedId = uuidv4(organisationId.replace(/-/g, '').padEnd(32, '0'));
  const query = `
    SELECT EXISTS (
      SELECT 1 FROM message_store
      WHERE session_id::TEXT LIKE $1
    )
  `;
  const client = await pool.connect();
  try {
    const result = await client.query(query, [`%${paddedId}%`]);
    return result.rows[0].exists;
  } catch (e) {
    throw new Error(`Failed to check organisation in session: ${e}`);
  } finally {
    client.release();
  }
};

export { connectToDatabase, closeDatabase, checkOrganisationInSession };
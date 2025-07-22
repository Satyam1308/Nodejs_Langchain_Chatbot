import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DBUSER,
  host: process.env.DBHOST,
  database: process.env.DBNAME,
  password: process.env.DBPW,
  port: process.env.DBPORT,
});

const connect = () => {
  console.log('Database connection established.');
  return pool;
};

const close = async (pool) => {
  try {
    await pool.end();
    console.log('Database connection closed.');
  } catch (e) {
    throw new Error(`Failed to close the database connection: ${e.message}`);
  }
};

const createTableIfNotExists = async (pool) => {
  const query = `
    CREATE TABLE IF NOT EXISTS organisation_data (
      organisation_id SERIAL PRIMARY KEY,
      organisation_data TEXT NOT NULL,
      ai_embeddings_status TEXT NOT NULL,
      ai_embeddings_reason TEXT,
      created_at TIMESTAMP NOT NULL,
      modified_at TIMESTAMP NOT NULL
    )
  `;
  const client = await pool.connect();
  try {
    await client.query(query);
    await pool.query('COMMIT');
    console.log('Table created or already exists.');
  } catch (e) {
    await pool.query('ROLLBACK');
    throw new Error(`Failed to create table: ${e.message}`);
  } finally {
    client.release();
  }
};

const createCollectionTableIfNotExists = async (pool) => {
  const queries = [
    `CREATE EXTENSION IF NOT EXISTS "vector"`,
    `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,
    `CREATE TABLE IF NOT EXISTS langchain_collections (
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      cmetadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const query of queries) {
      await client.query(query);
    }
    
    await client.query('COMMIT');
    console.log('✅ langchain_collections table created or already exists.');
    
    // Verify the table exists
    const verifyQuery = `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'langchain_collections'
    )`;
    const verifyResult = await pool.query(verifyQuery);
    
    if (verifyResult.rows[0].exists) {
      console.log('✅ langchain_collections table verified successfully.');
    } else {
      throw new Error('langchain_collections table was not created properly');
    }
    
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to create langchain_collections table:', e.message);
    throw e;
  } finally {
    client.release();
  }
};


const createEmbeddingTableIfNotExists = async (pool) => {
  const queries = [
    `CREATE EXTENSION IF NOT EXISTS "vector"`,
    `CREATE TABLE IF NOT EXISTS langchain_pg_embedding (
      id SERIAL PRIMARY KEY,
      embedding VECTOR(1536),
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      content TEXT,
      collection_id UUID REFERENCES langchain_collections(uuid) ON DELETE CASCADE
    )`
  ];
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const query of queries) {
      await client.query(query);
    }
    
    await client.query('COMMIT');
    console.log('✅ langchain_pg_embedding table created or already exists.');
    
    // Verify the table exists
    const verifyQuery = `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'langchain_pg_embedding'
    )`;
    const verifyResult = await pool.query(verifyQuery);
    
    if (verifyResult.rows[0].exists) {
      console.log('✅ langchain_pg_embedding table verified successfully.');
    } else {
      throw new Error('langchain_pg_embedding table was not created properly');
    }
    
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to create langchain_pg_embedding table:', e.message);
    throw e;
  } finally {
    client.release();
  }
};

const insertOrUpdateData = async (pool, data) => {
  const now = new Date();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (data.organisation_id) {
      // 🟠 Check if org exists
      const checkQuery = 'SELECT organisation_id FROM organisation_data WHERE organisation_id = $1';
      const checkResult = await client.query(checkQuery, [data.organisation_id]);

      if (checkResult.rows.length > 0) {
        // 🔁 Update existing org
        const updateQuery = `
          UPDATE organisation_data
          SET 
            organisation_data = $1,
            ai_embeddings_status = $2,
            ai_embeddings_reason = $3,
            modified_at = $4
          WHERE organisation_id = $5
        `;
        await client.query(updateQuery, [
          data.organisation_data,
          data.ai_embeddings_status,
          data.ai_embeddings_reason,
          now,
          data.organisation_id
        ]);
        await client.query('COMMIT');
        console.log('Record updated.');
        return data.organisation_id;
      } else {
        throw new Error(`No organisation found with ID: ${data.organisation_id}`);
      }
    } else {
 const insertQuery = `
  INSERT INTO organisation_data (
    organisation_data, ai_embeddings_status, ai_embeddings_reason, created_at, modified_at
  ) VALUES ($1, $2, $3, $4, $5)
  RETURNING organisation_id
`;
const insertResult = await client.query(insertQuery, [
  data.organisation_data,
  data.ai_embeddings_status,
  data.ai_embeddings_reason,
  now,
  now
]);
const newId = insertResult.rows[0].organisation_id;
await client.query('COMMIT');
console.log('Record inserted.');
return newId;
    }
  } catch (e) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to insert or update data: ${e.message}`);
  } finally {
    client.release();
  }
};

export const updateLangchainCollectionsSchema = async (pool) => {
  try {
    // Check if cmetadata column exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'langchain_collections' 
      AND column_name = 'cmetadata'
    `;
    
    const columnExists = await pool.query(checkColumnQuery);
    
    if (columnExists.rows.length === 0) {
      // Add the missing cmetadata column
      const addColumnQuery = `
        ALTER TABLE langchain_collections 
        ADD COLUMN cmetadata JSONB
      `;
      
      await pool.query(addColumnQuery);
      console.log('Added cmetadata column to langchain_collections table');
    } else {
      console.log('cmetadata column already exists in langchain_collections table');
    }
  } catch (error) {
    console.error('Error updating langchain_collections schema:', error);
    throw error;
  }
};

export { connect, close, createTableIfNotExists,createCollectionTableIfNotExists, createEmbeddingTableIfNotExists, insertOrUpdateData };
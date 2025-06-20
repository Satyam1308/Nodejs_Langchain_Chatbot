import { OpenAIEmbeddings } from '@langchain/openai';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Validate required ENV variables
const requiredEnvVars = ['DBUSER', 'DBHOST', 'DBNAME', 'DBPW', 'DBPORT', 'OPENAI_API_KEY', 'DIMENSION'];
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}

// ✅ Parse and validate dimension
const DIMENSION = parseInt(process.env.DIMENSION);
if (isNaN(DIMENSION) || DIMENSION <= 0) {
  throw new Error('Invalid DIMENSION value in environment variables');
}

// ✅ PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DBUSER,
  host: process.env.DBHOST,
  database: process.env.DBNAME,
  password: process.env.DBPW,
  port: parseInt(process.env.DBPORT),
  max: 10,
  idleTimeoutMillis: 30000,
});

// ✅ Initialize OpenAI Embeddings
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-large', // or any other embedding model you prefer
  dimensions: DIMENSION,
});
// ✅ Create Embeddings Function
const createEmbeddingSelection = async (data) => {
  if (!data.organisation_id || !data.organisation_data) {
    throw new Error('Missing organisation_id or organisation_data in input');
  }

  try {

    const vectorStore =  new PGVectorStore(embeddings, {
      pool,
      tableName: 'langchain_pg_embedding',
      collectionTableName: 'langchain_collections',
      // collectionName: data.organisation_id,
      collectionName: `org-${data.organisation_id}`,

      columns: {
        idColumnName: 'id',
        contentColumnName: 'content',
        vectorColumnName: 'vector',
        metadataColumnName: 'metadata',
        collectionIdColumnName: 'collection_id', // 🔥 ADD THIS
      },
    });
    

    // ✅ Add Document to PGVector
    await vectorStore.addDocuments([
      {
        pageContent: data.organisation_data,
        metadata: {
          organisation_id: data.organisation_id,
        },
      },
    ]);

    return {
      organisation_id: data.organisation_id,
      ai_embeddings_status: 'Completed',
      ai_embeddings_reason: `Embeddings for ${data.organisation_id} generated successfully`,
    };
  } catch (error) {
    console.error('Error creating embeddings:', error);
    return {
      organisation_id: data.organisation_id,
      ai_embeddings_status: 'Failed',
      ai_embeddings_reason: `Failed to generate embeddings: ${error.message}`,
    };
  }
};

// ✅ Clean up pool on shutdown
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

export { createEmbeddingSelection };

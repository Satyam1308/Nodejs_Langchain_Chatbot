import { Pool } from 'pg';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DBUSER,
  host: process.env.DBHOST,
  database: process.env.DBNAME,
  password: process.env.DBPW,
  port: process.env.DBPORT,
});

const getOrCreateCollection = async (collectionName, embeddings) => {
  return new PGVectorStore(embeddings, {
    pool,
    collectionName,
    tableName: 'langchain_pg_embedding',
    collectionTableName: 'langchain_collections',
    useJsonb: true,
    createExtension: true,
    columns: {
      idColumnName: 'id',
      contentColumnName: 'content',
      vectorColumnName: 'embedding',
      metadataColumnName: 'metadata',
      collectionIdColumnName: 'collection_id', // ✅ this is crucial
    },
  });
};


const storeDocsToCollection = async (collectionName, embeddings, organisationId, docs) => {
  const vectorStore = await getOrCreateCollection(collectionName, embeddings);
  const texts = docs.map(doc => doc.pageContent);
  const metadatas = docs.map(() => ({ id: organisationId }));
  const ids = docs.map(() => organisationId);

  try {
    await vectorStore.addDocuments(docs);
    return {
      status: true,
      organisation_id: organisationId,
      ai_embeddings_status: 'Completed',
      ai_embeddings_reason: `Embeddings of ${organisationId} generated successfully`,
    };
  } catch (e) {
    return {
      status: false,
      organisation_id: organisationId,
      ai_embeddings_status: 'Failed',
      ai_embeddings_reason: `${e.message}`,
    };
  }
};

const deleteDocumentsFromCollection = async (collectionName, embeddings, organisationId) => {
  const vectorStore = await getOrCreateCollection(collectionName, embeddings);
  await vectorStore.delete({ ids: [organisationId] });
};

const checkIfRecordExists = async (organisationId) => {
  try {
    const result = await pool.query('SELECT EXISTS (SELECT 1 FROM langchain_pg_embedding WHERE id = $1 LIMIT 1)', [organisationId]);
    return { is_rec_exist: result.rows[0].exists };
  } catch (e) {
    console.error(`Error checking record existence: ${e}`);
    return { is_rec_exist: false };
  }
};

export { getOrCreateCollection, storeDocsToCollection, deleteDocumentsFromCollection, checkIfRecordExists };
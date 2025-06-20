import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { connect, close, insertOrUpdateData, createTableIfNotExists, createEmbeddingTableIfNotExists } from './database/organisation_database.js';
import { createEmbeddingSelection } from './organisation_embedding_creation/embedding_generation.js';
import { getResponse } from './rag_folder/question_answer.js';
import { setTimeout as delay } from 'timers/promises';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*'],
}));

const logger = console;

app.post('/api/organisation_database', async (req, res) => {
  let { organisation_id, organisation_data } = req.body;

  if (!organisation_data) {
    return res.status(400).json({ message: 'Missing organisation data' });
  }

  const pool = connect();

  try {
    await createTableIfNotExists(pool);
    await createEmbeddingTableIfNotExists(pool);

    const organisationDataFromFrontend = JSON.stringify(organisation_data);

    const data = {
      organisation_id: organisation_id ? organisation_id.toString() : null, // ✅ allow null to trigger insert
      organisation_data: organisationDataFromFrontend,
      ai_embeddings_status: 'Pending',
      ai_embeddings_reason: 'Initial processing',
    };

    // 🔁 Insert or update, returns the correct org ID (serial)
    const resolvedOrganisationId = await insertOrUpdateData(pool, data);

    // 🧠 Generate embeddings
    await delay(2000);
    const embeddingStatus = await createEmbeddingSelection({
      ...data,
      organisation_id: resolvedOrganisationId.toString(), // stringified for embedding
    });

    // 🔄 Update record with final embedding status
    embeddingStatus.organisation_data = organisationDataFromFrontend;
    await insertOrUpdateData(pool, embeddingStatus);

    // ✅ Response with SERIAL (not UUID)
    res.json({
      organisation_id: resolvedOrganisationId,
      message: embeddingStatus.ai_embeddings_reason,
      status: embeddingStatus.ai_embeddings_status,
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error processing data', error: error.message });
  } finally {
    await close(pool);
  }
});

app.post('/api/organisation_chatbot', async (req, res) => {
  const { organisation_id, user_query } = req.body;

  if (!user_query) {
    return res.status(400).json({ message: 'Missing query' });
  }
  if (!organisation_id) {
    return res.status(400).json({ message: 'Missing Organisation ID' });
  }

  const data = {
    user_query,
    organisation_id: organisation_id.toString(),
  };

  try {
    await delay(2000); // Simulate 2-second delay
    const response = await getResponse(data);
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Error processing query', error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.log(`Server running on port ${PORT}`));

export default app;
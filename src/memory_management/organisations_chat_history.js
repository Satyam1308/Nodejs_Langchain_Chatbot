

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

const pool = new Pool(dbConfig);
const tableName = 'message_store';

// Initialize the chat history table
const initializeChatHistoryTable = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        message JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.error('Error creating table:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get or create chat history for a session
const getSessionChatHistory = async (organisationId) => {
  const baseId = String(organisationId).replace(/-/g, '').padEnd(32, '0');
  const sessionId = uuidv4(baseId);

  await initializeChatHistoryTable(); // Ensure table exists

  return {
    async addMessage(message) {
      const client = await pool.connect();
      try {
        // Store the full message object, including type information
        const messageData = {
          id: message._getType() === 'human' ? ['langchain_core', 'messages', 'HumanMessage'] : ['langchain_core', 'messages', 'AIMessage'],
          lc: 1,
          type: 'constructor',
          kwargs: {
            content: message.content,
            name: message.name,
            additional_kwargs: message.additional_kwargs || {},
            response_metadata: message.response_metadata || {},
            ...(message._getType() === 'ai' ? {
              tool_calls: message.tool_calls || [],
              invalid_tool_calls: message.invalid_tool_calls || [],
            } : {}),
          },
        };
        await client.query(
          'INSERT INTO message_store (session_id, message) VALUES ($1, $2)',
          [sessionId, JSON.stringify(messageData)]
        );
      } finally {
        client.release();
      }
    },
    async getMessages() {
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT message FROM message_store WHERE session_id = $1 ORDER BY created_at',
          [sessionId]
        );
        return result.rows.map(row => row.message);
      } finally {
        client.release();
      }
    },
  };
};

// Initialize table on startup
initializeChatHistoryTable().catch(console.error);

export { getSessionChatHistory, pool };
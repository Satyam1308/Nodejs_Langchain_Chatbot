# Chatbot AI Backend

This is a Node.js backend for a Retrieval-Augmented Generation (RAG) chatbot using LangChain, OpenAI, and PostgreSQL. It provides endpoints for storing organization data, generating embeddings, and answering user queries with context-aware responses.

---

## Features

- **RAG Chatbot**: Answers user queries using both stored organization data and chat history.
- **OpenAI Integration**: Uses OpenAI for both embeddings and chat completions.
- **PostgreSQL Storage**: Stores organization data, embeddings, and chat history.
- **Robust Error Handling**: Returns fallback responses on AI/JSON errors to prevent UI hangs.
- **Extensible Prompt Logic**: Customizable system prompt for chain-of-thought and strict JSON output.

---

## Project Structure

```
chatbot-ai-backend/
├── src/
│   ├── server.js                        # Express server and API endpoints
│   ├── database/
│   │   ├── organisation_database.js     # Organization data and table management
│   │   ├── organisation_vector_database.js # Embedding storage and retrieval
│   │   └── organisation_retrieval_history.js # Session/organization checks
│   ├── memory_management/
│   │   └── organisations_chat_history.js # Chat history management
│   ├── organisation_embedding_creation/
│   │   └── embedding_generation.js      # Embedding creation logic
│   ├── organisation_prompts/
│   │   └── prompts.js                   # System prompt for the chatbot
│   └── rag_folder/
│       └── question_answer.js           # Main RAG logic and error fallback
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

---

## Setup Instructions

### 1. Prerequisites

- **Node.js** v18 or higher
- **PostgreSQL** database

### 2. Install Dependencies

```bash
cd chatbot-ai-backend
npm install
```

### 3. Environment Variables

Create a `.env` file in `chatbot-ai-backend/` with the following:

```
DBUSER=your_db_user
DBHOST=your_db_host
DBNAME=your_db_name
DBPW=your_db_password
DBPORT=your_db_port
OPENAI_API_KEY=your_openai_api_key
DIMENSION=1536
PORT=3000
```

### 4. Start the Server

```bash
npm start
```

---

## API Endpoints

### `POST /api/organisation_database`

- **Purpose:** Store or update organization data and generate embeddings.
- **Body:**
  ```json
  {
    "organisation_id": "org123",      // optional for new orgs
    "organisation_data": { ... }      // required, any JSON
  }
  ```
- **Response:**  
  Returns the organization ID and embedding status.

---

### `POST /api/organisation_chatbot`

- **Purpose:** Ask a question to the chatbot for a specific organization.
- **Body:**
  ```json
  {
    "organisation_id": "org123",
    "user_query": "What is your mission?"
  }
  ```
- **Response:**  
  Returns a JSON object with:
  - `answer`: The chatbot's answer (string)
  - `task_creation`: Boolean (whether a task should be created)

---

## Error Handling

- If the AI returns invalid JSON or an internal error occurs, the backend responds with:
  ```json
  {
    "message": "Query failed, fallback response sent",
    "status": 500,
    "question": "...",
    "answer": "Sorry, this query does not proceed.",
    "task_creation": true
  }
  ```
- This ensures the UI does not hang and can handle errors gracefully.

---

## Development

- Uses `nodemon` for auto-reloading during development (`npm start`).
- All code is modular and organized by responsibility (database, embeddings, prompts, RAG logic, etc).

---

## License

ISC

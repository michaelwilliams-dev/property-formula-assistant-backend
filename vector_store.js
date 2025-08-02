// vector_store.js
// ISO Timestamp: 🕒 2025-08-01T18:00:00Z (Production-ready – index load logging included)

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenAI } from 'openai';

console.log("🟢 vector_store.js loaded: using /mnt/data/vector_index.json");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function loadIndex() {
  const indexPath = '/mnt/data/vector_index.json'; // hardcoded for Render disk
  const data = await fs.readFile(indexPath, 'utf-8');
  const parsed = JSON.parse(data);
  const count = parsed.vectors?.length || parsed.length || 0;
  console.log(`📦 Loaded vector index with ${count} chunks from disk`);

  return parsed.vectors || parsed; // support both wrapped and plain array formats
}

export async function searchIndex(rawQuery, index) {
  const query = (typeof rawQuery === 'string' ? rawQuery : String(rawQuery || '')).trim();

  console.log("🧪 [FAISS] Raw query:", rawQuery);
  console.log("🧪 [FAISS] Cleaned query:", query);
  console.log("🧪 [FAISS] Final input array for OpenAI:", [query]);

  if (!query || query.length < 3) {
    console.warn("⚠️ Query blocked: too short or invalid:", query);
    return [];
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: [query],
  });

  const queryEmbedding = response.data[0].embedding;

  const scores = index.map(item => {
    const dot = dotProduct(queryEmbedding, item.embedding);
    return { ...item, score: dot };
  });

  return scores.sort((a, b) => b.score - a.score).slice(0, 3); // return top 3 only
}

function dotProduct(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

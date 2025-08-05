// vector_store.js
// ISO Timestamp: 🕒 2025-08-05T08:15:00Z – Added dynamic index size and chunk count

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenAI } from 'openai';
import { statSync } from 'fs';

console.log("🟢 vector_store.js loaded: using /mnt/data/vector_index.json");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function loadIndex() {
  const indexPath = '/mnt/data/vector_index.json';
  const data = await fs.readFile(indexPath, 'utf-8');
  const parsed = JSON.parse(data);
  const vectors = parsed.vectors || parsed; // support both wrapped and raw formats

  const totalChunks = vectors.length || 0;
  const fileSizeBytes = statSync(indexPath).size;
  const fileSizeMB = Math.round(fileSizeBytes / (1024 * 1024));

  console.log(`📦 Loaded vector index with ${totalChunks} chunks`);
  console.log(`📦 Index file size: ${fileSizeMB}MB`);

  return {
    vectors,
    totalChunks,
    fileSizeMB
  };
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

  const sorted = scores.sort((a, b) => b.score - a.score);
  console.log(`🔢 Total scored chunks returned: ${sorted.length}`);
  return sorted;
}

function dotProduct(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

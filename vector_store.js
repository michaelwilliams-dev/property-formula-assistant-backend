// vector_store.js
// ISO Timestamp: 🕒 2025-08-02T12:10:00Z (Added semantic similarity filtering)

import fs from 'fs/promises';
import { OpenAI } from 'openai';

console.log("🟢 vector_store.js loaded: using /mnt/data/vector_index.json");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function loadIndex() {
  console.log("📁 Attempting to load index from /mnt/data/vector_index.json");
  const raw = await fs.readFile('/mnt/data/vector_index.json', 'utf-8');
  const vectorIndex = JSON.parse(raw);
  const count = vectorIndex.vectors?.length || 0;
  console.log(`📦 Loaded vector index with ${count} chunks from disk`);
  return vectorIndex.vectors || [];
}

export async function searchIndex(rawQuery, index) {
  const query = (typeof rawQuery === 'string' ? rawQuery : String(rawQuery || '')).trim();

  console.log("🧪 [FAISS] Raw query:", rawQuery);
  console.log("🧪 [FAISS] Cleaned query:", query);
  if (!query || query.length < 3) {
    console.warn("⚠️ Query blocked: too short or invalid:", query);
    return [];
  }

  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: [query],
  });

  const queryEmbedding = response.data[0].embedding;

  const scoredChunks = index.map(item => ({
    ...item,
    score: dotProduct(queryEmbedding, item.embedding)
  }));

  // ✅ Filter by similarity threshold
  const threshold = 0.01;
  const filtered = scoredChunks.filter(item => item.score >= threshold);

  console.log(`📊 Top ${filtered.length} FAISS matches (score ≥ ${threshold}):`);
  filtered
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .forEach((s, i) => console.log(` ${i + 1}: Score=${s.score.toFixed(4)} — Preview="${s.text.slice(0, 80)}"`));

  return filtered.sort((a, b) => b.score - a.score);
}

function dotProduct(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

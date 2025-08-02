// vector_store.js
// ISO Timestamp: 🕒 2025-08-02T18:45:00Z (Render disk version – stable + score logging + format fallback)

import fs from 'fs/promises';
import { OpenAI } from 'openai';

console.log("🟢 vector_store.js loaded: using /mnt/data/vector_index.json");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function loadIndex() {
  console.log("📁 Attempting to load index from /mnt/data/vector_index.json");

  const raw = await fs.readFile('/mnt/data/vector_index.json', 'utf-8');
  const parsed = JSON.parse(raw);

  const vectors = Array.isArray(parsed) ? parsed : parsed.vectors || [];
  const count = vectors.length;

  console.log(`📦 Loaded vector index with ${count} chunks from disk`);
  return vectors;
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

  const top = scores.sort((a, b) => b.score - a.score).slice(0, 3);

  console.log("📊 Top 3 FAISS matches:");
  top.forEach((s, i) =>
    console.log(` ${i + 1}: Score=${s.score.toFixed(4)} — Preview="${s.text.slice(0, 80)}"`)
  );

  return top;
}

function dotProduct(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

// ass_server.js
// ISO Timestamp: 🕒 2025-08-02T11:05:00Z (Assistant backend – FAISS with semantic filtering)

import express from 'express';
import bodyParser from 'body-parser';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { Buffer } from 'buffer';
import { loadIndex, searchIndex } from './vector_store.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function queryFaissIndex(question) {
  const index = await loadIndex();
  const matches = await searchIndex(question, index);
  const filtered = matches.filter(match => match.score >= 0.03); // ✅ Semantic filter
  return filtered.map(match => match.text);
}

app.post('/ask', async (req, res) => {
  const { question, email } = req.body;
  if (!question) return res.status(400).json({ error: 'Missing question' });

  try {
    const timestamp = new Date().toISOString();
    const faissContext = await queryFaissIndex(question);
    const context = faissContext.join('\n\n');

    const prompt = `You are an expert RICS property surveyor. Use the content provided below to clearly answer the client's question. 
Your reply must be clear, practical, and easy to understand. Avoid legal jargon. If no information is available, state so plainly.

Question: "${question}"

Content:
${context}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4
    });

    const openaiAnswer = completion.choices[0].message.content;

    const combinedAnswer = `🏠 Property Assistant Response
🕒 Generated at: ${timestamp}

📘 From indexed material (FAISS):
${context || '[No indexed content found]'}

🧠 OpenAI Completion:
${openaiAnswer || '[No AI answer generated]'}`;

    if (email && email.includes('@')) {
      try {
        // PDF
        const pdfDoc = new PDFDocument();
        let pdfBuffer = Buffer.alloc(0);
        pdfDoc.on('data', chunk => { pdfBuffer = Buffer.concat([pdfBuffer, chunk]); });
        pdfDoc.text(combinedAnswer);
        pdfDoc.end();

        // DOCX
        const doc = new Document({
          sections: [{ children: [new Paragraph({ children: [new TextRun(combinedAnswer)] })] }],
        });
        const docBuffer = await Packer.toBuffer(doc);

        const mailjetRes = await fetch("https://api.mailjet.com/v3.1/send", {
          method: "POST",
          headers: {
            "Authorization": "Basic " + Buffer.from(`${process.env.MJ_APIKEY_PUBLIC}:${process.env.MJ_APIKEY_PRIVATE}`).toString("base64"),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            Messages: [{
              From: { Email: "noreply@securemaildrop.uk", Name: "Secure Maildrop" },
              To: [{ Email: email }],
              Subject: `Your Property Assistant Answer`,
              TextPart: combinedAnswer,
              HTMLPart: combinedAnswer.split('\n').map(line => `<p>${line}</p>`).join(''),
              Attachments: [
                {
                  ContentType: "application/pdf",
                  Filename: `answer.pdf`,
                  Base64Content: pdfBuffer.toString('base64')
                },
                {
                  ContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  Filename: `answer.docx`,
                  Base64Content: docBuffer.toString('base64')
                }
              ]
            }]
          })
        });

        const mailResponse = await mailjetRes.json();
        console.log("📨 Mailjet response:", mailjetRes.status, mailResponse);
      } catch (err) {
        console.error("❌ Mailjet send failed:", err.message);
      }
    }

    res.json({ question, answer: combinedAnswer, timestamp });
  } catch (err) {
    console.error('❌ Assistant request failed:', err);
    res.status(500).json({ error: 'Assistant request failed' });
  }
});

app.get('/', (req, res) => {
  res.send('Property Assistant backend is live.');
});

app.listen(PORT, () => {
  console.log(`🟢 Property Assistant running on port ${PORT}`);
});

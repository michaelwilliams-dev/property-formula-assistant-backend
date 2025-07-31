// server.js
// ISO Timestamp: 🕒 2025-07-31T16:35:00Z (FAISS enabled — PropertyFormula blog backend)

import express from 'express';
import bodyParser from 'body-parser';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { Buffer } from 'buffer';
import { loadIndex, searchIndex } from './vector_store.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

console.log(`🕒 Server started at ${new Date().toISOString()}`);
console.log("✅ FAISS enabled — live vector search active");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ Real FAISS query
async function queryFaissIndex(topic) {
  const index = await loadIndex();
  const matches = await searchIndex(topic, index);
  return matches.map(match => match.text);
}

app.post('/api/blog-draft', async (req, res) => {
  const { topic, email } = req.body;
  console.log("🔁 Received blog draft request:", topic);

  if (!topic) return res.status(400).json({ error: 'Missing topic' });

  try {
    const faissContext = await queryFaissIndex(topic);
    const context = faissContext.join('\n');

    const prompt = `We are RICS chartered surveyors and valuers. Write a professional blog post on the topic: "${topic}". Use only the content below. Do not make anything up.\n\nDocuments:\n${context}\n\nInclude headline, intro, key points, and wrap-up.`;

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6
      });
      console.log("🧪 OpenAI raw response:", JSON.stringify(completion, null, 2));
    } catch (error) {
      console.error("❌ OpenAI API call failed:", error.message);
      return res.status(500).json({ error: "OpenAI API failed: " + error.message });
    }

    if (!completion?.choices?.[0]?.message?.content) {
      throw new Error('OpenAI returned an empty or invalid message.');
    }

    const blogText = completion.choices[0].message.content;

    if (email && email.includes('@')) {
      try {
        const pdfDoc = new PDFDocument();
        let pdfBuffer = Buffer.alloc(0);
        pdfDoc.on('data', chunk => { pdfBuffer = Buffer.concat([pdfBuffer, chunk]); });
        pdfDoc.text(blogText);
        pdfDoc.end();

        const doc = new Document({
          sections: [{ children: [new Paragraph({ children: [new TextRun(blogText)] })] }],
        });
        const docBuffer = await Packer.toBuffer(doc);

        const mailjetRes = await fetch("https://api.mailjet.com/v3.1/send", {
          method: "POST",
          headers: {
            "Authorization": "Basic " + Buffer.from(`${process.env.MJ_APIKEY_PUBLIC}:${process.env.MJ_APIKEY_PRIVATE}`).toString("base64"),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            Messages: [
              {
                From: { Email: "noreply@securemaildrop.uk", Name: "Secure Maildrop" },
                To: [{ Email: email }],
                Subject: `Your AI blog: ${topic}`,
                TextPart: blogText,
                HTMLPart: blogText.split('\n').map(line => `<p>${line}</p>`).join(''),
                Attachments: [
                  {
                    ContentType: "application/pdf",
                    Filename: `${topic}.pdf`,
                    Base64Content: pdfBuffer.toString('base64')
                  },
                  {
                    ContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    Filename: `${topic}.docx`,
                    Base64Content: docBuffer.toString('base64')
                  }
                ]
              }
            ]
          })
        });

        const mailResponse = await mailjetRes.json();
        console.log("📨 Mailjet response:", mailjetRes.status, mailResponse);
      } catch (err) {
        console.error("❌ Mailjet send failed:", err.message);
      }
    }

    res.json({ topic, blog: blogText });

  } catch (err) {
    console.error('❌ Blog generation failed:', err.message);
    res.status(500).json({ error: 'Blog generation failed' });
  }
});

app.get('/', (req, res) => {
  res.send('PropertyFormula blog backend is live.');
});

app.listen(PORT, () => {
  console.log(`🚀 Blog backend running at http://localhost:${PORT}`);
});
// ass_server.js
// ISO Timestamp: 🕒 2025-08-03T18:40:00Z – Assistant with formatted public output

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

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function queryFaissIndex(question) {
  const index = await loadIndex();
  const matches = await searchIndex(question, index);
  const filtered = matches.filter(match => match.score >= 0.03);
  return filtered.map(match => match.text);
}

app.post('/ask', async (req, res) => {
  const { question, email } = req.body;
  if (!question) return res.status(400).json({ error: 'Missing question' });

  try {
    const timestamp = new Date().toISOString();

    const faissContext = await queryFaissIndex(question);
    const context = [...new Set(faissContext.map(text => text.trim()))]
      .filter(text => text.length > 30)
      .join('\n\n');

    const prompt = `You are an expert RICS property surveyor. Based only on the provided content, write a clear, structured, public-friendly answer to the client's question below. 

Your reply must include:
- A headline
- A short introduction
- 2–4 bullet points
- A brief wrap-up

Do not include legal references. Avoid jargon. Use plain English.
If the content does not contain an answer, say so clearly.

Client question: "${question}"

Relevant content:
${context}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4
    });

    const openaiAnswer = completion.choices[0].message.content;

    const finalResponse = `🏠 Property Assistant Response
🕒 Generated at: ${timestamp}

${openaiAnswer || '[No AI answer generated]'}`;

    if (email && email.includes('@')) {
      try {
        const pdfDoc = new PDFDocument();
        let pdfBuffer = Buffer.alloc(0);
        pdfDoc.on('data', chunk => { pdfBuffer = Buffer.concat([pdfBuffer, chunk]); });
        pdfDoc.text(finalResponse);
        pdfDoc.end();

        const doc = new Document({
          sections: [{ children: [new Paragraph({ children: [new TextRun(finalResponse)] })] }],
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
              TextPart: finalResponse,
              HTMLPart: finalResponse.split('\n').map(line => `<p>${line}</p>`).join(''),
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

    res.json({ question, answer: finalResponse, timestamp });
  } catch (err) {
    console.error('❌ Assistant request failed:', err);
    res.status(500).json({ error: 'Assistant request failed' });
  }
});

app.get('/', (req, res) => {
  res.send('✅ Property Assistant backend is live.');
});

app.get('/assistant.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'assistant.html'));
});

app.get('/assistant', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'assistant.html'));
});

app.listen(PORT, () => {
  console.log(`🟢 Property Assistant running on port ${PORT}`);
});

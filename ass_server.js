// ass_server.js
// ISO Timestamp: 🕒 2025-08-05T10:45:00Z – Added name header + clean structure

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

function estimateTokens(text) {
  return Math.ceil(text.split(/\s+/).length * 1.3);
}

app.post('/ask', async (req, res) => {
  const { question, email, firstName, lastName } = req.body;
  console.log("📥 Assistant form data received:", { question, email, firstName, lastName });

  if (!question) return res.status(400).json({ error: 'Missing question' });

  try {
    const timestamp = new Date().toISOString();
    const { vectors, fileSizeMB, totalChunks } = await loadIndex();

    const matches = await searchIndex(question, vectors);
    const filtered = matches.filter(match => match.score >= 0.03);

    let context = '';
    let chunkCount = 0;
    let tokenCount = 0;
    const maxTokens = 6000;

    for (const match of filtered) {
      const chunkText = match.text.trim();
      const chunkTokens = estimateTokens(chunkText);
      if (tokenCount + chunkTokens > maxTokens) break;
      context += chunkText + '\n\n';
      tokenCount += chunkTokens;
      chunkCount++;
    }

    console.log(`🔍 Assistant using ${chunkCount} chunks (${tokenCount} tokens)`);

    const prompt = `You are a helpful, expert RICS surveyor. Write a customer-facing reply to the question below using only the content provided. Do not make anything up. Refer to the RICS RED Book.\n\nFormat strictly as:\n- A clear headline\n- A short 2–3 sentence introduction\n- 3–5 helpful bullet points (each 1–2 sentences)\n- A closing summary\n\nUse clear English. Avoid legal jargon or complex phrasing. Use only the content provided.\n\nClient question: "${question}"\n\nRelevant content:\n${context}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4
    });

    const openaiAnswer = completion.choices[0].message.content;

    const generalCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: question }],
      temperature: 0.4
    });

    const extraAnswer = generalCompletion.choices[0].message.content;
    const dynamicId = `${fileSizeMB}${totalChunks}${chunkCount}c`;

    const footer = `\n\n---\nAdditional GPT-4 Search (no indexed content):\n\n${extraAnswer}\n\n© AIVS Software Limited. All rights reserved.\nMob: 07968 184624 | Web: AIVS.uk\nid ${dynamicId}`;

    let header = '';
    if (firstName && lastName) {
      const fullName = `${firstName} ${lastName}`.trim();
      header = `Property Assistant Response\nRequested by ${fullName}\nGenerated at: ${timestamp}\n\n`;
    } else {
      header = `Property Assistant Response\nGenerated at: ${timestamp}\n\n`;
    }

    const finalResponse = `${header}${openaiAnswer}${footer}`;

    if (email && email.includes('@')) {
      try {
        const pdfDoc = new PDFDocument();
        let pdfBuffer = Buffer.alloc(0);
        pdfDoc.on('data', chunk => {
          pdfBuffer = Buffer.concat([pdfBuffer, chunk]);
        });
        pdfDoc.text(finalResponse);
        pdfDoc.end();

        const doc = new Document({
          sections: [
            {
              children: finalResponse.split('\n').map(line =>
                new Paragraph({ children: [new TextRun(line)] })
              )
            }
          ]
        });

        const docBuffer = await Packer.toBuffer(doc);

        await fetch("https://api.mailjet.com/v3.1/send", {
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
      } catch (err) {
        console.error("❌ Mailjet send failed:", err.message);
      }
    }

    res.json({ question, answer: finalResponse, timestamp });
  } catch (err) {
    console.error('❌ Assistant request failed:', err.stack || err.message);
    res.status(500).json({ error: 'Assistant request failed' });
  }
});

app.get('/', (req, res) => {
  res.send('Property Assistant backend is live.');
});

app.get('/assistant.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'assistant.html'));
});

app.get('/assistant', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'assistant.html'));
});

app.listen(PORT, () => {
  console.log(`🔵 Property Assistant running on port ${PORT}`);
});

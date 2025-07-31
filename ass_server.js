// ass.server.js
// ISO Timestamp: 🕒 2025-07-30T19:20:00Z (PropertyFormula Assistant)

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { OpenAI } from 'openai';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { Buffer } from 'buffer';
import { loadIndex, searchIndex } from './vector_store.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let index = [];
(async () => {
  index = await loadIndex();
  console.log("📦 Loaded vector index with", index.length, "chunks");
})();

app.post('/ask', async (req, res) => {
  const question = req.body.question || req.body.query;
  const email = req.body.email?.trim();

  if (!question) {
    return res.status(400).json({ error: 'Missing question' });
  }

  try {
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question
    });

    const queryEmbedding = embeddingRes.data[0].embedding;
    const topChunks = await searchIndex(queryEmbedding, 3);

    const contextText = topChunks
      .map(c => c.text?.trim())
      .filter(t => t && t.length > 50)
      .join('\n\n');

    let indexAnswer = '';
    let openaiAnswer = '';

    if (contextText && contextText.length > 50) {
      const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'Answer using only the following RICS surveying and valuation material:\n\n' + contextText },
            { role: 'user', content: question }
          ],
          temperature: 0.3
        })
      });

      const gptData = await gptRes.json();
      indexAnswer = gptData.choices?.[0]?.message?.content || '';
    }

    const fallbackPrompt = `\nYou are a UK-based RICS surveying assistant.\nAnswer based only on:\n- Property valuation practices\n- Chartered surveyor guidance\n- Red Book compliance and UK planning factors\n\nAvoid all tax or legal advice.\nIf the question is outside this scope, reply:\n\"This question falls outside the scope of surveying and valuation.\"\n\nQuestion: \"${question}\"`;

    const fallbackData = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful RICS property assistant.' },
        { role: 'user', content: fallbackPrompt }
      ],
      temperature: 0.2
    });

    openaiAnswer = fallbackData.choices?.[0]?.message?.content || 'No fallback answer.';

    const combinedAnswer = `🏠 Property Assistant Reply\n\n` +
      `📘 *From indexed material:*
${indexAnswer || 'No indexed response.'}\n\n` +
      `🧠 *OpenAI fallback response:*
${openaiAnswer}`;

    if (email && email.includes('@')) {
      try {
        const pdfDoc = new PDFDocument();
        let pdfBuffer = Buffer.alloc(0);
        pdfDoc.on('data', chunk => pdfBuffer = Buffer.concat([pdfBuffer, chunk]));
        pdfDoc.text(combinedAnswer);
        pdfDoc.end();

        const doc = new Document({
          sections: [
            { children: [new Paragraph({ children: [new TextRun(combinedAnswer)] })] }
          ]
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
                Subject: "Your Property Assistant Answer",
                TextPart: combinedAnswer,
                HTMLPart: combinedAnswer.split('\n').map(l => `<p>${l}</p>`).join(''),
                Attachments: [
                  {
                    ContentType: "application/pdf",
                    Filename: "response.pdf",
                    Base64Content: pdfBuffer.toString('base64')
                  },
                  {
                    ContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    Filename: "response.docx",
                    Base64Content: docBuffer.toString('base64')
                  }
                ]
              }
            ]
          })
        });

        const mailResult = await mailjetRes.json();
        console.log("📨 Mailjet status:", mailjetRes.status, mailResult);
      } catch (emailErr) {
        console.error("❌ Mailjet send failed:", emailErr.message);
      }
    }

    res.json({
      answer: combinedAnswer,
      fromIndex: !!indexAnswer,
      sources: topChunks
    });

  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Property Assistant running on port ${PORT}`);
});

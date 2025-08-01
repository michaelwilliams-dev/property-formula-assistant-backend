// assistant_script.js
// ISO Timestamp: 2025-07-30T19:30:00Z

// Set timestamp safely
const timestamp = new Date().toISOString();
const isoEl = document.getElementById('iso-timestamp');
if (isoEl) isoEl.textContent = timestamp;

// Event handler
const askBtn = document.getElementById('ask');
askBtn.addEventListener('click', async () => {
  const question = document.getElementById('question').value.trim();
  const email = document.getElementById('email').value.trim();
  const output = document.getElementById('response');

  if (!question) {
    output.textContent = '❌ Please enter a question.';
    return;
  }

  output.textContent = '⏳ Thinking...';

  try {
    const res = await fetch('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, email })
    });

    const data = await res.json();
    output.textContent = data.answer || '⚠️ No answer returned.';
  } catch (err) {
    console.error(err);
    output.textContent = '❌ Failed to contact assistant: ' + err.message;
  }
});

// assistant_script.js
// ISO Timestamp: 🕒 2025-08-01T10:15:00Z (Minimal clean test)

document.addEventListener("DOMContentLoaded", () => {
  const askBtn = document.getElementById('ask');
  const output = document.getElementById('response');
  const emailInput = document.getElementById('email');
  const questionInput = document.getElementById('question');
  const isoSpan = document.getElementById('iso-timestamp');

  if (isoSpan) isoSpan.textContent = new Date().toISOString();

  askBtn.addEventListener('click', async () => {
    const question = questionInput?.value?.trim() || '';
    const email = emailInput?.value?.trim() || '';

    if (!question) {
      output.textContent = '❌ Please enter a question.';
      return;
    }

    output.textContent = '⏳ Thinking...';

    try {
      const response = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, email })
      });

      const data = await response.json();

      output.textContent = data?.answer || '⚠️ No answer returned.';
    } catch (err) {
      console.error(err);
      output.textContent = '❌ Failed to contact assistant: ' + err.message;
    }
  });
});

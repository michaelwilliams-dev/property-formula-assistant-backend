// assistant_script.js
// ISO Timestamp: 🕒 2025-08-01T10:00:00Z

document.addEventListener("DOMContentLoaded", () => {
  const askBtn = document.getElementById('ask');
  const output = document.getElementById('response');
  const emailInput = document.getElementById('email');
  const questionInput = document.getElementById('question');

  document.getElementById('iso-timestamp').textContent = new Date().toISOString();

  askBtn.addEventListener('click', async () => {
    const question = questionInput.value.trim();
    const email = emailInput.value.trim();

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

      if (!res.ok) {
        output.textContent = `❌ Error: ${data.error || 'Unknown error'}`;
      } else {
        output.textContent = data.answer || '⚠️ No answer returned.';
      }
    } catch (err) {
      output.textContent = '❌ Failed to contact assistant: ' + err.message;
    }
  });
});

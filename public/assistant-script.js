// assistant_script.js
// ISO Timestamp: 2025-07-30T19:30:00Z

// assistant_script.js
// ISO Timestamp: 🕒 2025-08-01T09:50:00Z

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('iso-timestamp').textContent = new Date().toISOString();

  const askBtn = document.getElementById('ask');
  const output = document.getElementById('response');

  askBtn.addEventListener('click', async () => {
    const question = document.getElementById('question').value.trim();
    const email = document.getElementById('email').value.trim();

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

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server error: ${errorText}`);
      }

      const data = await res.json();
      output.textContent = data.answer || '⚠️ No answer returned.';
    } catch (err) {
      console.error("❌ JS fetch error:", err);
      output.textContent = '❌ Failed to contact assistant: ' + err.message;
    }
  });
});

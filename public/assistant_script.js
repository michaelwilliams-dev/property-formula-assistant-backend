// assistant_script.js
// ISO Timestamp: 🕒 2025-07-31T19:10:00Z (Stable – copied from blog structure)

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("iso-timestamp").textContent = new Date().toISOString();

  const askButton = document.getElementById("ask");
  const questionInput = document.getElementById("question");
  const emailInput = document.getElementById("email");
  const responseBox = document.getElementById("response");

  askButton.addEventListener("click", async () => {
    const question = questionInput.value.trim();
    const email = emailInput.value.trim();

    if (!question) {
      responseBox.textContent = '❌ Please enter a question.';
      return;
    }

    responseBox.textContent = '⏳ Processing your request...';
    askButton.disabled = true;

    try {
      const res = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, email })
      });

      const data = await res.json();

      if (!res.ok) {
        responseBox.textContent = `❌ Error: ${data?.error || 'Something went wrong.'}`;
      } else {
        responseBox.textContent = data.answer?.trim() || '⚠️ No answer returned.';
      }
    } catch (err) {
      responseBox.textContent = '❌ Failed to contact assistant: ' + err.message;
    }

    askButton.disabled = false;
  });
});

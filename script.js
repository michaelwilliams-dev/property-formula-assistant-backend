// script.js
// ISO Timestamp: 🕒 2025-07-31T21:45:00Z (Assistant UI JS based on blog)

document.addEventListener("DOMContentLoaded", () => {
  const generateButton = document.getElementById("ask");
  const questionInput = document.getElementById("question");
  const emailInput = document.getElementById("email");
  const output = document.getElementById("response");

  generateButton.addEventListener("click", async () => {
    const question = questionInput.value.trim();
    const email = emailInput.value.trim();

    if (!question) {
      output.textContent = "❌ Please enter a question.";
      return;
    }

    output.textContent = "⏳ Processing...";

    try {
      const res = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, email })
      });

      const data = await res.json();
      output.textContent = data.answer || "⚠️ No response received.";
    } catch (err) {
      console.error(err);
      output.textContent = "❌ Request failed: " + err.message;
    }
  });
});
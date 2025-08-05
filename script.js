// script.js
// ISO Timestamp: 🕒 2025-08-05T10:20:00Z (Assistant JS with name support)

document.addEventListener("DOMContentLoaded", () => {
  const generateButton = document.getElementById("ask");
  const questionInput = document.getElementById("question");
  const emailInput = document.getElementById("email");
  const firstNameInput = document.getElementById("firstName");
  const lastNameInput = document.getElementById("lastName");
  const output = document.getElementById("response");

  generateButton.addEventListener("click", async () => {
    const question = questionInput.value.trim();
    const email = emailInput.value.trim();
    const firstName = firstNameInput?.value?.trim() || '';
    const lastName = lastNameInput?.value?.trim() || '';

    if (!question) {
      output.textContent = "❌ Please enter a question.";
      return;
    }

    output.textContent = "⏳ Processing...";

    try {
      const res = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, email, firstName, lastName })
      });

      const data = await res.json();
      output.textContent = data.answer || "⚠️ No response received.";
    } catch (err) {
      console.error(err);
      output.textContent = "❌ Request failed: " + err.message;
    }
  });
});

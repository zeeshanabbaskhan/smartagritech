const fs = require('fs');

const questions = [
  "1. What was my last month's bill for Riverdale Manufacturing?",
  "2. How can I reduce my bill for Greenfield Energy Co given my current usage pattern?",
  "3. How can I keep my bill under Rs. 30,000 next month for Greenfield Energy Co?",
  "4. How does this month's bill compare to last month's for Riverdale Manufacturing?",
  "5. Which device is consuming the most energy this month for Riverdale Manufacturing?",
  "6. What's my average daily electricity cost this month for Greenfield Energy Co?",
  "7. Which days had the highest energy usage in the last 30 days for Riverdale Manufacturing?",
  "8. Am I on track to exceed my usual monthly bill this month for Riverdale Manufacturing?",
  "9. What would my bill look like if I cut usage on Cold Storage Meter by 20% for Riverdale Manufacturing?",
  "10. Which devices should I turn off during peak hours to save the most for Riverdale Manufacturing?",
  "11. Is my low power factor costing me extra, and how much could fixing it save for Greenfield Energy Co?",
  "12. What's my total energy cost breakdown by device this month for Riverdale Manufacturing?",
  "13. If I want to save 15% next month, which devices should I target first for Riverdale Manufacturing?"
];

async function run() {
  const output = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\n==================================================`);
    console.log(`Q${i+1}: ${q}`);
    console.log(`==================================================`);
    try {
      const res = await fetch('http://localhost:5175/api/chatbot/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: q }] })
      });
      const data = await res.json();
      const ans = data.reply || data.error || JSON.stringify(data);
      console.log(`REPLY:\n${ans}\n`);
      output.push({ question: q, reply: ans });
    } catch (err) {
      console.error(`ERROR: ${err.message}`);
      output.push({ question: q, error: err.message });
    }
    // Delay 5s between queries to respect Groq token rate limits
    await new Promise(r => setTimeout(r, 5000));
  }
  fs.writeFileSync('all_13_responses.json', JSON.stringify(output, null, 2), 'utf8');
  console.log('\nSaved all responses to all_13_responses.json!');
}

run();

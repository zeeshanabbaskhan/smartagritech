const questions = [
  "Q1: What was my last month's bill for Riverdale Manufacturing?",
  "Q2: How can I reduce my bill for Greenfield Energy Co given my current usage pattern?",
  "Q3: How can I keep my bill under Rs. 30,000 next month for Greenfield Energy Co?",
  "Q4: How does this month's bill compare to last month's for Riverdale Manufacturing?",
  "Q5: Which device is consuming the most energy this month for Riverdale Manufacturing?",
  "Q6: What's my average daily electricity cost this month for Greenfield Energy Co?",
  "Q7: Which days had the highest energy usage in the last 30 days for Riverdale Manufacturing?",
  "Q8: Am I on track to exceed my usual monthly bill this month for Riverdale Manufacturing?",
  "Q9: What would my bill look like if I cut usage on Cold Storage Meter by 20% for Riverdale Manufacturing?",
  "Q10: Which devices should I turn off during peak hours to save the most for Riverdale Manufacturing?",
  "Q11: Is my low power factor costing me extra, and how much could fixing it save for Greenfield Energy Co?",
  "Q12: What's my total energy cost breakdown by device this month for Riverdale Manufacturing?",
  "Q13: If I want to save 15% next month, which devices should I target first for Riverdale Manufacturing?"
];

async function run() {
  const args = process.argv.slice(2);
  const startIdx = args[0] ? parseInt(args[0]) : 0;
  const endIdx   = args[1] ? parseInt(args[1]) : questions.length;

  for (let i = startIdx; i < endIdx; i++) {
    const q = questions[i];
    console.log(`\n==================================================`);
    console.log(`${q}`);
    console.log(`==================================================`);
    try {
      const res = await fetch('http://localhost:5175/api/chatbot/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: q }] })
      });
      const data = await res.json();
      console.log(`REPLY:\n${data.reply || data.error}\n`);
    } catch (err) {
      console.error(`ERROR: ${err.message}`);
    }
    // Pause 6 seconds between questions to avoid 12k TPM rate limit
    await new Promise(r => setTimeout(r, 6000));
  }
}

run();

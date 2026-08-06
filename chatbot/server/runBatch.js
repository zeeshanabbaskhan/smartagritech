const fs = require('fs');

const questions = [
  { id: 1, text: "What was my last month's bill?", org: "Riverdale Manufacturing" },
  { id: 2, text: "How can I reduce my bill given my current usage pattern?", org: "Greenfield Energy Co" },
  { id: 3, text: "How can I keep my bill under Rs. 30,000 next month?", org: "Greenfield Energy Co" },
  { id: 4, text: "How does this month's bill compare to last month's?", org: "Riverdale Manufacturing" },
  { id: 5, text: "Which device is consuming the most energy this month?", org: "Riverdale Manufacturing" },
  { id: 6, text: "What's my average daily electricity cost this month?", org: "Greenfield Energy Co" },
  { id: 7, text: "Which days had the highest energy usage in the last 30 days?", org: "Riverdale Manufacturing" },
  { id: 8, text: "Am I on track to exceed my usual monthly bill this month?", org: "Riverdale Manufacturing" },
  { id: 9, text: "What would my bill look like if I cut usage on Cold Storage Meter by 20%?", org: "Riverdale Manufacturing" },
  { id: 10, text: "Which devices should I turn off during peak hours to save the most?", org: "Riverdale Manufacturing" },
  { id: 11, text: "Is my low power factor costing me extra, and how much could fixing it save?", org: "Greenfield Energy Co" },
  { id: 12, text: "What's my total energy cost breakdown by device this month?", org: "Riverdale Manufacturing" },
  { id: 13, text: "If I want to save 15% next month, which devices should I target first?", org: "Riverdale Manufacturing" }
];

async function run() {
  const results = [];
  for (const q of questions) {
    const prompt = `${q.text} for ${q.org}`;
    console.log(`[Testing ${q.id}/13] ${prompt}`);
    try {
      const res = await fetch('http://localhost:5175/api/chatbot/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
      });
      const data = await res.json();
      results.push({ id: q.id, question: prompt, reply: data.reply });
      console.log(`[Success ${q.id}/13]`);
    } catch (err) {
      console.error(`[Error ${q.id}/13] ${err.message}`);
      results.push({ id: q.id, question: prompt, error: err.message });
    }
  }

  fs.writeFileSync('testResults.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('ALL DONE! Results written to testResults.json');
}

run();

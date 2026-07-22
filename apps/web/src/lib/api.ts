export async function simulateContent(content: { title: string; cover: string; tags: string[] }) {
  const res = await fetch('/api/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, persona_count: 1000 }),
  });

  if (!res.ok) {
    throw new Error(`Simulate failed: ${res.status}`);
  }

  return res.json();
}

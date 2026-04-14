function isAutumnSelfRef(text) {
  const lc = text.toLowerCase();
  if (/\b(autumn leaves|autumn season|autumn weather|autumn colors|autumn foliage|in autumn|during autumn|last autumn|this autumn|the autumn)\b/.test(lc)) return false;
  if (/\bautumn\b/.test(lc) && /\b(generate|create|make|draw|depict|show|image|picture|look|appear|visual|yourself|herself|portrait|form)\b/.test(lc)) return true;
  if (/\b(generate|create|make|draw|depict|show|image|picture|photo)\b.*\b(of you|of yourself|yourself|you in|you as|you wearing|you at)\b/.test(lc)) return true;
  if (/\b(generate|create|make|draw)\b.{0,20}\b(you|yourself|autumn)\b/.test(lc)) return true;
  if (/\bwhat (do you|does autumn) look like\b/.test(lc)) return true;
  return false;
}

const tests = [
  { input: "generate an image of yourself", expected: true },
  { input: "what do you look like", expected: true },
  { input: "show me a picture of autumn", expected: true },
  { input: "draw autumn as a cyberpunk hacker", expected: true },
  { input: "create a portrait of yourself", expected: true },
  { input: "generate me an image of you in a forest", expected: true },
  { input: "I love the autumn leaves", expected: false },
  { input: "what is the weather like in autumn", expected: false },
  { input: "autumn colors are beautiful", expected: false },
  { input: "hello autumn", expected: false },
  { input: "generate an image of a cat", expected: false },
];

let failed = 0;
tests.forEach((t, i) => {
  const result = isAutumnSelfRef(t.input);
  if (result !== t.expected) {
    console.error(`Test ${i + 1} failed: '${t.input}' -> expected ${t.expected}, got ${result}`);
    failed++;
  }
});

if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
} else {
  console.log('All tests passed!');
  process.exit(0);
}

import { performance } from 'perf_hooks';

function formatRelative(dateStr) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupActivityByDateOriginal(items) {
  const groups = [];
  const now = new Date();
  const todayStr = now.toDateString();
  const yestStr = new Date(now.getTime() - 86400000).toDateString();

  for (const item of items) {
    const d = new Date(item.created_at).toDateString();
    const label = d === todayStr ? "Today" : d === yestStr ? "Yesterday" : formatRelative(item.created_at);
    const existing = groups.find((g) => g.label === label);
    if (existing) existing.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function groupActivityByDateOptimized(items) {
  const groupsMap = new Map();
  const groups = [];
  const now = new Date();
  const todayStr = now.toDateString();
  const yestStr = new Date(now.getTime() - 86400000).toDateString();

  for (const item of items) {
    const d = new Date(item.created_at).toDateString();
    const label = d === todayStr ? "Today" : d === yestStr ? "Yesterday" : formatRelative(item.created_at);

    let existing = groupsMap.get(label);
    if (existing) {
      existing.items.push(item);
    } else {
      const newGroup = { label, items: [item] };
      groupsMap.set(label, newGroup);
      groups.push(newGroup);
    }
  }
  return groups;
}

// Generate test data with many unique labels to test the grouping logic
const items = [];
const now = Date.now();
for (let i = 0; i < 50000; i++) {
  items.push({
    id: String(i),
    created_at: new Date(now - Math.random() * 86400000 * 1000).toISOString()
  });
}

function runBenchmark() {
  console.log('Warming up...');
  groupActivityByDateOriginal(items.slice(0, 1000));
  groupActivityByDateOptimized(items.slice(0, 1000));

  console.log('Running Original...');
  const startOriginal = performance.now();
  groupActivityByDateOriginal(items);
  const endOriginal = performance.now();
  const timeOriginal = endOriginal - startOriginal;

  console.log('Running Optimized...');
  const startOptimized = performance.now();
  groupActivityByDateOptimized(items);
  const endOptimized = performance.now();
  const timeOptimized = endOptimized - startOptimized;

  console.log(`Original Time: ${timeOriginal.toFixed(2)}ms`);
  console.log(`Optimized Time: ${timeOptimized.toFixed(2)}ms`);
  console.log(`Improvement: ${(timeOriginal / timeOptimized).toFixed(2)}x faster`);
}

runBenchmark();

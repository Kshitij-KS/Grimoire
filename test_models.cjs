const fs = require("fs");
const path = require("path");

const envLocalPath = path.resolve(".env.local");
let apiKey = "";

try {
  const envFile = fs.readFileSync(envLocalPath, "utf-8");
  const match = envFile.match(/GEMINI_API_KEY=(.+)/);
  if (match) apiKey = match[1].trim();
} catch (e) {
  console.error("Could not read .env.local", e);
}

if (!apiKey) {
  console.error("No API key found.");
  process.exit(1);
}

async function run() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    const results = data.models.map(model => `${model.name} - ${model.supportedGenerationMethods.join(", ")}`);
    fs.writeFileSync("models_list.txt", results.join("\n"), "utf8");
    console.log("Wrote to models_list.txt");
  } catch (err) {
    console.error(err);
  }
}

run();

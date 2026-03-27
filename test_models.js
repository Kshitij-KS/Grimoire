import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

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

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log("Available models:");
    data.models.forEach(model => console.log(model.name, "-", model.supportedGenerationMethods.join(", ")));
  } catch (err) {
    console.error(err);
  }
}

run();

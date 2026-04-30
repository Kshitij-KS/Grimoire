import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
dotenv.config();

async function run() {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("No key");
    const ai = new GoogleGenerativeAI(key);
    const model = ai.getGenerativeModel({ model: "gemini-2.5-pro" });
    const result = await model.generateContent("Hello!");
    console.log("Success:", result.response.text());
  } catch (e) {
    console.error("Error with gemini-2.5-pro:", e);
  }

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("No key");
    const ai = new GoogleGenerativeAI(key);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent("Hello!");
    console.log("Success 1.5:", result.response.text());
  } catch (e) {
    console.error("Error with gemini-1.5-pro:", e);
  }
}

run();

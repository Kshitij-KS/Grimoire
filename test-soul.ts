import { z } from "zod";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getGeminiModel } from "./lib/gemini.ts";
import { parseSoulCard, soulCardPrompt } from "./lib/soul-card.ts";

async function generateSoulCard(userPrompt: string, name: string) {
  const model = getGeminiModel();
  const attempts = [
    {
      systemInstruction: soulCardPrompt,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    },
    `${soulCardPrompt}\n\nCharacter name: ${name}\n\n${userPrompt}\n\nReturn only valid JSON matching the required shape exactly.`,
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      console.log("Trying attempt...");
      const result = await model.generateContent(attempt as any);
      console.log("Success! Parsing...");
      return parseSoulCard(result.response.text().trim());
    } catch (error) {
      console.error("Attempt failed:", error);
      lastError = error;
    }
  }

  throw lastError ?? new Error("Soul forge failed.");
}

async function main() {
  try {
    const result = await generateSoulCard("A brave knight who fights dragons.", "Arthur");
    console.log("Final Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Final Error:", error);
  }
}

main();

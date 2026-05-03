import { GoogleGenerativeAI } from "@google/generative-ai";

const primaryClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function tryFallback(actions, message) {
  let lastError;
  for (let i = 0; i < actions.length; i++) {
    try {
      return await actions[i]();
    } catch (error) {
      lastError = error;
      if (i < actions.length - 1) {
        console.warn(`${message} (Attempt ${i + 1} failed)`, error);
      }
    }
  }
  throw lastError;
}

function withFallback(modelNames) {
  const models = modelNames.map((name) =>
    primaryClient.getGenerativeModel({ model: name })
  );

  const baseModel = models[0];
  const proxyModel = Object.assign(Object.create(Object.getPrototypeOf(baseModel)), baseModel);

  proxyModel.generateContent = (...args) =>
    tryFallback(
      models.map((m) => () => m.generateContent(...args)),
      "Gemini generateContent failed, trying fallback..."
    );

  return proxyModel;
}

const soulCardPrompt = `
You are Grimoire's AI Soul Forge.
You generate valid JSON soul cards.
`;

async function generateSoulCard(userPrompt, name) {
  const model = withFallback(["gemini-3.1-pro", "gemini-2.5-pro"]);
  const attempts = [
    {
      systemInstruction: soulCardPrompt,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    },
    `${soulCardPrompt}\n\nCharacter name: ${name}\n\n${userPrompt}\n\nReturn only valid JSON matching the required shape exactly.`,
  ];

  let lastError;

  for (const attempt of attempts) {
    try {
      console.log("Trying attempt...");
      const result = await model.generateContent(attempt);
      console.log("Success! Parsing...");
      return result.response.text().trim();
    } catch (error) {
      console.error("Attempt failed:", error.message);
      lastError = error;
    }
  }

  throw lastError ?? new Error("Soul forge failed.");
}

async function main() {
  try {
    const result = await generateSoulCard("A brave knight who fights dragons.", "Arthur");
    console.log("Final Result:", result);
  } catch (error) {
    console.error("Final Error:", error.message);
  }
}

main();

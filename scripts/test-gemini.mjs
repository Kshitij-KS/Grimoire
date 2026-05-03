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

async function main() {
  try {
    const model = withFallback(["gemini-3.1-pro", "gemini-2.5-pro"]);
    console.log("Testing generateContent...");
    const result = await model.generateContent("Say hello");
    console.log("Success:", result.response.text());
  } catch (error) {
    console.error("Error generating content:", error);
  }
}

main();

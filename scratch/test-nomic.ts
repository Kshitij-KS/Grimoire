import { HfInference } from "@huggingface/inference";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const hfClient = new HfInference(process.env.HF_TOKEN);

async function test() {
  try {
    const result = await hfClient.featureExtraction({
      model: "nomic-ai/nomic-embed-text-v1",
      inputs: "search_query: Represent this sentence for searching: hello world",
    });

    let vector: number[];
    if (Array.isArray(result) && typeof result[0] === "number") {
      vector = result as number[];
    } else if (Array.isArray(result) && Array.isArray(result[0])) {
      vector = (result as number[][])[0];
    } else {
        throw new Error("Unexpected shape");
    }

    console.log(`Success! Dimension: ${vector.length}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

test();

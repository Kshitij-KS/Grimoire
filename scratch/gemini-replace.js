const fs = require('fs');

let f = fs.readFileSync('lib/embeddings.ts', 'utf8');
f = f.replace(/import \{ getGeminiClient \} from "@\/lib\/gemini";/g, 'import { getGeminiModel, getEmbeddingModel } from "@/lib/gemini";');
f = f.replace(/getGeminiClient\(\)\.getGenerativeModel\(\{\s*model:\s*"gemini-2\.5-pro"\s*\}\)/g, 'getGeminiModel()');
f = f.replace(/getGeminiClient\(\)\.getGenerativeModel\(\{\s*model:\s*"gemini-embedding-2-preview",?\s*\}\)/g, 'getEmbeddingModel()');
fs.writeFileSync('lib/embeddings.ts', f, 'utf8');

let narrator = fs.readFileSync('app/api/narrator/route.ts', 'utf8');
narrator = narrator.replace(/import \{ getGeminiClient \} from "@\/lib\/gemini";/g, 'import { getGeminiModel } from "@/lib/gemini";');
narrator = narrator.replace(/getGeminiClient\(\)\.getGenerativeModel\(\{\s*model:\s*"gemini-2\.5-pro"\s*\}\)/g, 'getGeminiModel()');
fs.writeFileSync('app/api/narrator/route.ts', narrator, 'utf8');

console.log("Replaced!");

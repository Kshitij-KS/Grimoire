"""
groq_adapter.py

Configures environment for lm-eval's `local-chat-completions` model type
to point at Groq's OpenAI-compatible API endpoint.

lm-eval reads OPENAI_API_KEY from the environment when using
`local-chat-completions`. We set it from GROQ_API_KEY here.
"""
import os


def configure_groq_env(groq_api_key: str) -> None:
    """Set env vars so lm-eval's OpenAI client talks to Groq."""
    os.environ["OPENAI_API_KEY"] = groq_api_key


# Groq's OpenAI-compatible chat completions endpoint
GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"

# Groq model → HuggingFace tokenizer mapping
# lm-eval needs a tokenizer to count tokens for prompt construction.
# Using open-access HF tokenizers that match the Groq model families.
GROQ_TOKENIZER_MAP: dict[str, str] = {
    "llama-3.3-70b-versatile": "meta-llama/Llama-3.2-1B",   # same tokenizer family
    "llama-3.1-70b-versatile": "meta-llama/Llama-3.2-1B",
    "llama-3.1-8b-instant":    "meta-llama/Llama-3.2-1B",
    "llama-3.2-3b-preview":    "meta-llama/Llama-3.2-1B",
    "mixtral-8x7b-32768":      "mistralai/Mistral-7B-v0.1",
    "gemma2-9b-it":            "google/gemma-2-2b",
}

def get_tokenizer_for_model(model_name: str) -> str:
    """Return the best matching HF tokenizer for a given Groq model."""
    return GROQ_TOKENIZER_MAP.get(model_name, "meta-llama/Llama-3.2-1B")

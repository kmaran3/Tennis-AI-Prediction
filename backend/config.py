import os
from dotenv import load_dotenv

load_dotenv()

LLM_PROVIDER        = os.getenv("LLM_PROVIDER", "claude")   # "claude" or "openai"
ANTHROPIC_API_KEY   = os.getenv("ANTHROPIC_API_KEY")
OPENAI_API_KEY      = os.getenv("OPENAI_API_KEY")
CHROMA_PERSIST_DIR  = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
DATA_PATH           = os.getenv("DATA_PATH", "./data/atp_tennis.csv")

# Model names — update here to upgrade without touching other files
CLAUDE_MODEL  = "claude-sonnet-4-6"
OPENAI_MODEL  = "gpt-4o"

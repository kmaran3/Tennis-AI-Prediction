import os
from dotenv import load_dotenv

load_dotenv()

# Resolve paths relative to this file so they work regardless of working directory
_HERE = os.path.dirname(os.path.abspath(__file__))

LLM_PROVIDER        = os.getenv("LLM_PROVIDER", "claude")   # "claude" or "openai"
ANTHROPIC_API_KEY   = os.getenv("ANTHROPIC_API_KEY")
OPENAI_API_KEY      = os.getenv("OPENAI_API_KEY")
CHROMA_PERSIST_DIR  = os.getenv("CHROMA_PERSIST_DIR", os.path.join(_HERE, "chroma_db"))
DATA_PATH           = os.getenv("DATA_PATH", os.path.join(_HERE, "data", "atp_tennis.csv"))

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")

# Model names — update here to upgrade without touching other files
CLAUDE_MODEL  = "claude-sonnet-4-6"
OPENAI_MODEL  = "gpt-4o"

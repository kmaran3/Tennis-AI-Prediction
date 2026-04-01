# ATP Tennis Match Predictor — Full Implementation Plan

> **For Claude Code:** This is a complete, sequential implementation guide. Follow phases in
> order. Do not skip ahead. Each phase ends with an explicit checkpoint — do not proceed until
> it passes. The developer is a React beginner — add clear inline comments to ALL frontend code
> explaining what each hook, prop, and component does.

---

## Project Overview

A full-stack web application that predicts ATP tennis match outcomes using a RAG
(Retrieval-Augmented Generation) pipeline. Users can run head-to-head predictions between any
two players and simulate full tournament brackets. A key feature is comparing the AI's predicted
win probability against the historical market-implied probability derived from betting odds.

**What makes this unique on a resume:**
- RAG pipeline feeding real match history as context to an LLM
- Betting odds vs AI prediction comparison (market disagreement signal)
- Tournament bracket simulator with round-by-round AI narration
- LLM provider abstraction — swap Claude/OpenAI with one environment variable
- Full-stack: React SPA frontend + FastAPI backend, local-first then cloud deployment

---

## Dataset

**Single CSV file** covering ATP matches 2020–2025.

**Exact column names (use these verbatim throughout all code):**
```
Tournament, Date, Series, Court, Surface, Round, Best of,
Player_1, Player_2, Winner, Rank_1, Rank_2, Pts_1, Pts_2,
Odd_1, Odd_2, Score
```

**Column notes:**
- `Player_1` / `Player_2` — match participants (no guaranteed ordering by rank/seed)
- `Winner` — name of the winner (matches either Player_1 or Player_2)
- `Rank_1` / `Rank_2` — ATP ranking at time of match
- `Pts_1` / `Pts_2` — ATP ranking points at time of match
- `Odd_1` / `Odd_2` — decimal betting odds (e.g. 1.45 means implied 69% win chance)
- `Series` — tournament tier (Grand Slam, Masters 1000, ATP500, ATP250, etc.)
- `Court` — Indoor / Outdoor
- `Best of` — integer, 3 or 5

**Derived columns to compute at load time:**
- `implied_prob_raw_1` = 1 / Odd_1
- `implied_prob_raw_2` = 1 / Odd_2
- `implied_prob_1` = implied_prob_raw_1 / (implied_prob_raw_1 + implied_prob_raw_2)  ← removes bookmaker overround
- `implied_prob_2` = implied_prob_raw_2 / (implied_prob_raw_1 + implied_prob_raw_2)
- `player_1_won` = 1 if Winner == Player_1 else 0
- `rank_diff` = Rank_2 - Rank_1  (positive = Player_1 is better ranked)
- `year` = Date parsed to year integer
- `upset` = 1 if the lower-ranked player (higher rank number) won, else 0

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React (Vite) + React Router | SPA, beginner-friendly with comments |
| Styling | TailwindCSS | Utility-first CSS |
| Charts | Recharts | Simple React charting library |
| Backend | FastAPI (Python 3.10+) | Async, auto-generates /docs UI |
| AI/RAG | LLM abstraction + ChromaDB | Swap Claude/OpenAI via .env |
| Embeddings | sentence-transformers (local) | No API cost for embeddings |
| Data | Pandas | CSV loading and stat aggregation |

**LLM abstraction rule:** The LLM provider is set via `LLM_PROVIDER` in `.env` ("claude" or
"openai"). ALL LLM calls go through `services/llm_client.py` — no other file imports
anthropic or openai SDKs directly.

**Deployment path (Phase 8, do last):**
- Frontend → Vercel (free tier)
- Backend → Render (free tier)
- ChromaDB → Pinecone (swap at deploy, one config change)

---

## Repository Structure

```
atp-predictor/
├── backend/
│   ├── main.py                    # FastAPI app, CORS, router registration, startup
│   ├── config.py                  # All env vars and constants in one place
│   ├── routers/
│   │   ├── players.py             # Player search + stats endpoints
│   │   ├── predict.py             # H2H prediction endpoint
│   │   └── tournament.py          # Bracket simulation endpoint
│   ├── services/
│   │   ├── data_loader.py         # CSV loading, cleaning, derived columns
│   │   ├── stats_engine.py        # Player stat aggregation functions
│   │   ├── rag_pipeline.py        # ChromaDB setup, indexing, retrieval
│   │   └── llm_client.py          # LLM abstraction (Claude or OpenAI)
│   ├── models/
│   │   └── schemas.py             # Pydantic request/response models
│   ├── data/
│   │   └── atp_matches.csv        # Full 2020-2025 dataset — place here
│   ├── chroma_db/                 # Auto-generated local vector store (gitignored)
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── main.jsx               # React entry point — mounts App into index.html
│   │   ├── App.jsx                # Router setup and page layout
│   │   ├── index.css              # Tailwind directives
│   │   ├── api/
│   │   │   └── client.js          # All API calls to FastAPI backend
│   │   ├── pages/
│   │   │   ├── Home.jsx           # Landing page
│   │   │   ├── HeadToHead.jsx     # H2H prediction page
│   │   │   └── Tournament.jsx     # Bracket simulation page
│   │   └── components/
│   │       ├── Navbar.jsx
│   │       ├── PlayerSearch.jsx   # Autocomplete search input
│   │       ├── SurfaceSelector.jsx
│   │       ├── PredictionCard.jsx # AI result display
│   │       ├── OddsComparison.jsx # AI prob vs market implied prob
│   │       ├── WinRateChart.jsx   # Recharts bar chart
│   │       └── TournamentBracket.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── .gitignore
└── README.md
```

---

## Phase 1 — Project Scaffolding

### 1.1 Create the monorepo

```bash
mkdir atp-predictor && cd atp-predictor
git init
```

Create `.gitignore` at project root:
```
# Backend
backend/.env
backend/chroma_db/
backend/__pycache__/
backend/venv/
**/__pycache__/
*.pyc

# Frontend
frontend/node_modules/
frontend/dist/

# General
.DS_Store
```

### 1.2 Backend setup

```bash
mkdir backend && cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
```

Install all dependencies:
```bash
pip install fastapi uvicorn pandas python-dotenv pydantic \
            chromadb sentence-transformers anthropic openai slowapi
pip freeze > requirements.txt
```

Create `backend/.env`:
```
# Set to "claude" or "openai"
LLM_PROVIDER=claude

# Fill in whichever provider you are using
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENAI_API_KEY=your_openai_key_here

# Local ChromaDB storage path (auto-created on first run)
CHROMA_PERSIST_DIR=./chroma_db

# Path to your CSV file
DATA_PATH=./data/atp_matches.csv
```

Create `backend/config.py`:
```python
import os
from dotenv import load_dotenv

load_dotenv()

LLM_PROVIDER        = os.getenv("LLM_PROVIDER", "claude")   # "claude" or "openai"
ANTHROPIC_API_KEY   = os.getenv("ANTHROPIC_API_KEY")
OPENAI_API_KEY      = os.getenv("OPENAI_API_KEY")
CHROMA_PERSIST_DIR  = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
DATA_PATH           = os.getenv("DATA_PATH", "./data/atp_matches.csv")

# Model names — update here to upgrade without touching other files
CLAUDE_MODEL  = "claude-sonnet-4-20250514"
OPENAI_MODEL  = "gpt-4o"
```

Create `backend/models/__init__.py` and `backend/routers/__init__.py` and
`backend/services/__init__.py` (all empty — Python needs these to treat the
folders as importable packages).

### 1.3 Frontend setup

```bash
cd ../frontend
npm create vite@latest . -- --template react
npm install
npm install axios react-router-dom recharts
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Replace `tailwind.config.js` with:
```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

Replace the entire contents of `frontend/src/index.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create `frontend/.env.local`:
```
VITE_API_URL=http://localhost:8000
```

### 1.4 Place your CSV

Copy your ATP matches CSV into `backend/data/atp_matches.csv`. The header row must be:
```
Tournament,Date,Series,Court,Surface,Round,Best of,Player_1,Player_2,Winner,Rank_1,Rank_2,Pts_1,Pts_2,Odd_1,Odd_2,Score
```

### 1.5 Temporary main.py to test startup

Create `backend/main.py` with just:
```python
from fastapi import FastAPI
app = FastAPI()

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

**✅ CHECKPOINT 1:**
- Run `uvicorn main:app --reload` from `backend/`. Visit `http://localhost:8000/api/health`.
  Should return `{"status": "ok"}`.
- Run `npm run dev` from `frontend/`. Should open at `http://localhost:5173`.
- Both servers run simultaneously in separate terminals throughout development.

---

## Phase 2 — Data Loading & Stats Engine

### 2.1 `backend/services/data_loader.py`

```python
import pandas as pd
from config import DATA_PATH

# Module-level cache — CSV is loaded once at startup and reused for all requests
_df = None


def load_data() -> pd.DataFrame:
    """
    Load and clean the ATP matches CSV. Returns the cleaned DataFrame.
    Uses a module-level cache so the CSV is only read from disk once.
    """
    global _df
    if _df is not None:
        return _df  # Return cached version if already loaded

    df = pd.read_csv(DATA_PATH)

    # Parse the Date column into proper datetime objects
    df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
    df['year'] = df['Date'].dt.year.astype('Int64')  # Int64 handles NaN years

    # Remove rows missing the columns we always need
    df = df.dropna(subset=['Player_1', 'Player_2', 'Winner', 'Surface'])

    # Normalize player name whitespace (trim leading/trailing spaces)
    for col in ['Player_1', 'Player_2', 'Winner', 'Tournament', 'Surface']:
        df[col] = df[col].astype(str).str.strip()

    # --- Who won? 1 = Player_1 won, 0 = Player_2 won ---
    df['player_1_won'] = (df['Winner'] == df['Player_1']).astype(int)

    # --- Betting odds: implied probability ---
    # Decimal odds of 2.0 = 50% implied chance of winning
    df['implied_prob_raw_1'] = 1 / df['Odd_1']
    df['implied_prob_raw_2'] = 1 / df['Odd_2']
    total_prob = df['implied_prob_raw_1'] + df['implied_prob_raw_2']
    # Normalize to remove the bookmaker's margin (overround)
    # After normalization, prob_1 + prob_2 = exactly 1.0
    df['implied_prob_1'] = df['implied_prob_raw_1'] / total_prob
    df['implied_prob_2'] = df['implied_prob_raw_2'] / total_prob

    # --- Rank difference (positive = Player_1 is better ranked) ---
    df['rank_diff'] = df['Rank_2'] - df['Rank_1']

    # --- Upset: lower-ranked player (higher rank number) won ---
    df['upset'] = (
        ((df['player_1_won'] == 1) & (df['Rank_1'] > df['Rank_2'])) |
        ((df['player_1_won'] == 0) & (df['Rank_2'] > df['Rank_1']))
    ).astype(int)

    _df = df
    print(f"[DataLoader] Loaded {len(df)} matches | "
          f"Years: {df['year'].min()}–{df['year'].max()} | "
          f"Players: {df['Player_1'].nunique() + df['Player_2'].nunique()} appearances")
    return _df


def get_all_player_names() -> list[str]:
    """Return a deduplicated, sorted list of all player names in the dataset."""
    df = load_data()
    names = set(df['Player_1'].tolist()) | set(df['Player_2'].tolist())
    return sorted(names)
```

### 2.2 `backend/services/stats_engine.py`

```python
import pandas as pd
from services.data_loader import load_data


def get_player_matches(player_name: str, surface: str = None) -> pd.DataFrame:
    """
    Return all matches involving a player.
    Optionally filter to a specific surface ("Hard", "Clay", "Grass").
    """
    df = load_data()
    mask = (df['Player_1'] == player_name) | (df['Player_2'] == player_name)
    result = df[mask].copy()
    if surface:
        result = result[result['Surface'] == surface]
    return result


def _count_wins(matches: pd.DataFrame, player_name: str) -> int:
    """Count how many matches in a DataFrame were won by player_name."""
    as_p1 = matches[matches['Player_1'] == player_name]
    as_p2 = matches[matches['Player_2'] == player_name]
    return len(as_p1[as_p1['player_1_won'] == 1]) + len(as_p2[as_p2['player_1_won'] == 0])


def get_player_stats(player_name: str, surface: str = None) -> dict:
    """
    Aggregate career stats for a player.
    Returns a dict consumed by both the frontend and LLM prompts.
    """
    matches = get_player_matches(player_name, surface)

    if matches.empty:
        return {"error": f"No matches found for '{player_name}'"}

    total = len(matches)
    wins = _count_wins(matches, player_name)

    # --- Win rate per surface ---
    surface_stats = {}
    for surf in ['Hard', 'Clay', 'Grass']:
        surf_matches = get_player_matches(player_name, surf)
        if surf_matches.empty:
            surface_stats[surf] = None
            continue
        s_wins = _count_wins(surf_matches, player_name)
        surface_stats[surf] = {
            "matches": len(surf_matches),
            "wins": s_wins,
            "win_rate": round(s_wins / len(surf_matches), 3)
        }

    # --- Win rate per tournament tier ---
    tier_stats = {}
    for tier in matches['Series'].dropna().unique():
        t = matches[matches['Series'] == tier]
        t_wins = _count_wins(t, player_name)
        tier_stats[str(tier)] = {
            "matches": len(t),
            "wins": t_wins,
            "win_rate": round(t_wins / len(t), 3)
        }

    # --- Win rate per round (to gauge deep-run ability) ---
    round_stats = {}
    for rnd in matches['Round'].dropna().unique():
        r = matches[matches['Round'] == rnd]
        r_wins = _count_wins(r, player_name)
        round_stats[str(rnd)] = {
            "matches": len(r),
            "wins": r_wins,
            "win_rate": round(r_wins / len(r), 3)
        }

    # --- Upset stats ---
    upset_wins = len(matches[(matches['upset'] == 1) & (matches['Winner'] == player_name)])
    upset_losses = len(matches[(matches['upset'] == 1) & (matches['Winner'] != player_name)])

    # --- Current/average ranking from the dataset ---
    as_p1 = matches[matches['Player_1'] == player_name]
    as_p2 = matches[matches['Player_2'] == player_name]
    all_ranks = pd.concat([as_p1['Rank_1'], as_p2['Rank_2']]).dropna()
    # Sort by date to get most recent ranking
    all_dates = pd.concat([as_p1['Date'], as_p2['Date']]).dropna()

    return {
        "player_name": player_name,
        "matches_played": total,
        "wins": wins,
        "losses": total - wins,
        "win_rate": round(wins / total, 3),
        "surface_win_rates": surface_stats,
        "tier_win_rates": tier_stats,
        "round_win_rates": round_stats,
        "upset_wins": upset_wins,
        "upset_losses": upset_losses,
        "avg_rank": round(float(all_ranks.mean()), 1) if not all_ranks.empty else None,
        "current_rank": int(all_ranks.iloc[-1]) if not all_ranks.empty else None,
    }


def get_h2h(player_a: str, player_b: str, surface: str = None) -> dict:
    """Return head-to-head record and individual match details between two players."""
    df = load_data()
    mask = (
        ((df['Player_1'] == player_a) & (df['Player_2'] == player_b)) |
        ((df['Player_1'] == player_b) & (df['Player_2'] == player_a))
    )
    h2h = df[mask].copy()
    if surface:
        h2h = h2h[h2h['Surface'] == surface]

    if h2h.empty:
        return {
            "matches": 0,
            "player_a_wins": 0,
            "player_b_wins": 0,
            "player_a_win_rate": 0,
            "matches_detail": []
        }

    a_wins = len(h2h[h2h['Winner'] == player_a])
    b_wins = len(h2h[h2h['Winner'] == player_b])

    # Format each match as a dict for the LLM context and frontend display
    matches_detail = []
    for _, row in h2h.iterrows():
        winner_is_p1 = row['Winner'] == row['Player_1']
        market_prob_winner = row['implied_prob_1'] if winner_is_p1 else row['implied_prob_2']
        matches_detail.append({
            "date": str(row['Date'])[:10],
            "tournament": row['Tournament'],
            "surface": row['Surface'],
            "round": row['Round'],
            "winner": row['Winner'],
            "score": row['Score'],
            "implied_prob_winner": round(float(market_prob_winner), 3)
                if pd.notna(market_prob_winner) else None
        })

    # Sort most recent first
    matches_detail.sort(key=lambda x: x['date'], reverse=True)

    return {
        "matches": len(h2h),
        "player_a_wins": a_wins,
        "player_b_wins": b_wins,
        "player_a_win_rate": round(a_wins / len(h2h), 3),
        "matches_detail": matches_detail
    }
```

**✅ CHECKPOINT 2:**
Create `backend/test_phase2.py` (delete after testing):
```python
from services.data_loader import load_data, get_all_player_names
from services.stats_engine import get_player_stats, get_h2h

df = load_data()
print("Shape:", df.shape)
print("Columns:", df.columns.tolist())
print("Derived columns present:", all(c in df.columns for c in
    ['player_1_won', 'implied_prob_1', 'implied_prob_2', 'rank_diff', 'upset', 'year']))

names = get_all_player_names()
print(f"Total unique players: {len(names)}")
print("Sample names:", names[:5])

# Pick real players from your dataset to test with
stats = get_player_stats(names[0])
print("Stats:", stats)

h2h = get_h2h(names[0], names[1])
print("H2H:", h2h)
```
Run with `python test_phase2.py`. All assertions must pass before continuing.

---

## Phase 3 — RAG Pipeline

### 3.1 `backend/services/rag_pipeline.py`

```python
import chromadb
from chromadb.utils import embedding_functions
import pandas as pd
from config import CHROMA_PERSIST_DIR
from services.data_loader import load_data

# Singleton — ChromaDB collection is initialized once and reused
_collection = None


def get_collection():
    """Initialize and return the ChromaDB collection (created once, cached)."""
    global _collection
    if _collection is not None:
        return _collection

    client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)

    # all-MiniLM-L6-v2 is a fast, lightweight embedding model.
    # It runs locally on CPU — no API key or internet connection needed.
    # It produces 384-dimensional vectors, good enough for semantic search.
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    _collection = client.get_or_create_collection(
        name="atp_matches",
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"}  # Use cosine similarity for matching
    )
    return _collection


def _match_to_document(row) -> str:
    """
    Convert one DataFrame row into a natural language string.
    This string gets embedded into a vector and stored in ChromaDB.
    When a user queries "Djokovic vs Alcaraz on clay", the most semantically
    similar stored strings are retrieved and fed to the LLM as context.
    """
    winner = row['Winner']
    loser = row['Player_2'] if winner == row['Player_1'] else row['Player_1']
    winner_rank = row['Rank_1'] if winner == row['Player_1'] else row['Rank_2']
    loser_rank = row['Rank_2'] if winner == row['Player_1'] else row['Rank_1']
    market_prob = row['implied_prob_1'] if winner == row['Player_1'] else row['implied_prob_2']

    rank_w = f"{int(winner_rank)}" if pd.notna(winner_rank) else "unranked"
    rank_l = f"{int(loser_rank)}" if pd.notna(loser_rank) else "unranked"
    prob = f"{round(float(market_prob) * 100, 1)}%" if pd.notna(market_prob) else "N/A"
    year = int(row['year']) if pd.notna(row['year']) else "unknown year"

    return (
        f"{winner} (ranked {rank_w}) defeated {loser} (ranked {rank_l}) "
        f"at {row['Tournament']} {year} on {row['Surface']}. "
        f"Round: {row['Round']}. Score: {row['Score']}. "
        f"Market-implied win probability for {winner}: {prob}."
    )


def index_all_matches():
    """
    Index all matches into ChromaDB. Skips if already indexed.
    This runs at app startup. First run: ~5-10 minutes for ~30k matches.
    Subsequent runs are instant (skipped via count check).
    """
    collection = get_collection()

    if collection.count() > 0:
        print(f"[RAG] ChromaDB already has {collection.count()} documents. Skipping indexing.")
        return

    df = load_data()
    total = len(df)
    print(f"[RAG] Indexing {total} matches into ChromaDB. First run only — please wait...")

    documents, ids, metadatas = [], [], []

    for i, (_, row) in enumerate(df.iterrows()):
        doc = _match_to_document(row)
        documents.append(doc)
        ids.append(f"match_{i}")
        metadatas.append({
            "player_1": str(row['Player_1']),
            "player_2": str(row['Player_2']),
            "winner": str(row['Winner']),
            "surface": str(row['Surface']),
            "year": int(row['year']) if pd.notna(row['year']) else 0,
            "tournament": str(row['Tournament'])
        })

        # Upsert in batches of 500 to avoid memory issues
        if len(documents) == 500 or i == total - 1:
            collection.upsert(documents=documents, ids=ids, metadatas=metadatas)
            print(f"[RAG] Progress: {min(i + 1, total)}/{total} matches indexed...")
            documents, ids, metadatas = [], [], []

    print(f"[RAG] Indexing complete. Total: {collection.count()} documents.")


def retrieve_context(player_a: str, player_b: str, surface: str, n_results: int = 12) -> str:
    """
    Retrieve the most relevant past matches for the given matchup.
    Uses semantic similarity — returns matches involving either player on the given surface.
    Returns a single formatted string ready to paste into an LLM prompt.
    """
    collection = get_collection()

    query = f"{player_a} vs {player_b} on {surface}"

    try:
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where={
                "$or": [
                    {"player_1": player_a},
                    {"player_2": player_a},
                    {"player_1": player_b},
                    {"player_2": player_b},
                ]
            }
        )
    except Exception:
        # ChromaDB where-filter fails if collection is empty or filter finds nothing
        # Fall back to unfiltered semantic search
        results = collection.query(query_texts=[query], n_results=n_results)

    if not results['documents'] or not results['documents'][0]:
        return "No relevant match history found in dataset."

    return "\n".join(results['documents'][0])
```

**✅ CHECKPOINT 3:**
Create `backend/test_phase3.py` (delete after testing):
```python
from services.rag_pipeline import index_all_matches, retrieve_context
index_all_matches()  # Will take several minutes on first run
# Pick two real players from your dataset
context = retrieve_context("Player Name A", "Player Name B", "Hard")
print(context)
assert len(context) > 50, "Should have retrieved match documents"
```
Run with `python test_phase3.py`. Confirm `chroma_db/` folder is created and populated.
Confirm retrieved documents mention the two player names. Delete test file after.

---

## Phase 4 — LLM Abstraction Layer

### 4.1 `backend/services/llm_client.py`

```python
import json
from config import LLM_PROVIDER, CLAUDE_MODEL, OPENAI_MODEL

# Shared system prompt — tells the LLM its role and output format
SYSTEM_PROMPT = """You are an expert ATP tennis analyst with access to real match data
from 2020-2025. You will receive player statistics, head-to-head records, and relevant
match history as context. Base your prediction on this data — be specific and cite
patterns you see. Always respond with valid JSON only. No preamble, no markdown fences,
no explanation outside the JSON object."""


def build_h2h_prompt(player_a: str, player_b: str, surface: str, best_of: int,
                     stats_a: dict, stats_b: dict, h2h: dict, context: str) -> str:
    """
    Build the full prediction prompt with all context injected.
    This is what gets sent to the LLM.
    """

    def fmt_surface_stats(surface_rates: dict) -> str:
        lines = []
        for surf, data in (surface_rates or {}).items():
            if data:
                lines.append(f"  {surf}: {data['win_rate']:.0%} ({data['matches']} matches)")
        return "\n".join(lines) if lines else "  No surface data available"

    def fmt_stats(player: str, s: dict) -> str:
        if "error" in s:
            return f"  No data found for {player}"
        return (
            f"  Overall: {s.get('wins', '?')}-{s.get('losses', '?')} "
            f"({s.get('win_rate', 0):.0%} win rate over {s.get('matches_played', '?')} matches)\n"
            f"  Current ranking: {s.get('current_rank', 'Unknown')}\n"
            f"  Average ranking (2020-2025): {s.get('avg_rank', 'Unknown')}\n"
            f"  Upset wins: {s.get('upset_wins', 0)} | Upset losses: {s.get('upset_losses', 0)}\n"
            f"  Win rates by surface:\n{fmt_surface_stats(s.get('surface_win_rates', {}))}"
        )

    h2h_summary = (
        f"{player_a} leads H2H {h2h['player_a_wins']}-{h2h['player_b_wins']} "
        f"across {h2h['matches']} matches."
        if h2h['matches'] > 0
        else "No prior meetings between these players in the 2020-2025 dataset."
    )

    recent_h2h = ""
    if h2h.get('matches_detail'):
        recent = h2h['matches_detail'][:5]  # Last 5 meetings
        recent_h2h = "\nRecent meetings:\n" + "\n".join(
            f"  {m['date']} | {m['tournament']} | {m['surface']} | "
            f"{m['round']} | Winner: {m['winner']} ({m['score']}) | "
            f"Market prob for winner: {m['implied_prob_winner'] or 'N/A'}"
            for m in recent
        )

    return f"""
## Player Statistics

### {player_a}
{fmt_stats(player_a, stats_a)}

### {player_b}
{fmt_stats(player_b, stats_b)}

## Head-to-Head Record
{h2h_summary}{recent_h2h}

## Relevant Match History (retrieved from dataset)
{context}

## Prediction Task
Predict the outcome of: {player_a} vs {player_b}
Surface: {surface} | Format: Best of {best_of}

Return ONLY this JSON object (no other text):
{{
  "predicted_winner": "<exact player name as given above>",
  "win_probability": <float 0.0-1.0, winner's probability>,
  "confidence": "<low|medium|high>",
  "key_factors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "narrative": "<3-4 sentences of analyst commentary grounded in the data above>",
  "predicted_score": "<e.g. 6-4 7-5 or 6-3 4-6 6-4>",
  "upset_potential": "<low|medium|high>"
}}
"""


def predict(prompt: str) -> dict:
    """
    Call the configured LLM provider with the prompt.
    Returns a parsed dict from the LLM's JSON response.
    Raises no exceptions — errors are returned as {"error": "..."} dicts.
    """
    if LLM_PROVIDER == "claude":
        return _call_claude(prompt)
    elif LLM_PROVIDER == "openai":
        return _call_openai(prompt)
    else:
        return {"error": f"Unknown LLM_PROVIDER: '{LLM_PROVIDER}'. Must be 'claude' or 'openai'."}


def _call_claude(prompt: str) -> dict:
    """Call Claude via Anthropic SDK."""
    try:
        import anthropic
        from config import ANTHROPIC_API_KEY
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )
        return _safe_parse(message.content[0].text)
    except Exception as e:
        return {"error": f"Claude API call failed: {str(e)}"}


def _call_openai(prompt: str) -> dict:
    """Call GPT-4 via OpenAI SDK."""
    try:
        from openai import OpenAI
        from config import OPENAI_API_KEY
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            response_format={"type": "json_object"}
        )
        return _safe_parse(response.choices[0].message.content)
    except Exception as e:
        return {"error": f"OpenAI API call failed: {str(e)}"}


def _safe_parse(raw: str) -> dict:
    """Strip markdown fences if present, then parse JSON."""
    cleaned = raw.strip()
    # Remove ```json or ``` fences that some models add despite instructions
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        return {"error": f"JSON parse failed: {str(e)}", "raw_response": raw[:500]}
```

**✅ CHECKPOINT 4:**
Create `backend/test_phase4.py` (delete after testing):
```python
from services.llm_client import predict

# Simple direct test — build a minimal prompt
test_prompt = """
## Prediction Task
Predict: Player A vs Player B | Surface: Hard | Best of 3
No stats available — make a generic prediction for testing.

Return ONLY this JSON:
{
  "predicted_winner": "Player A",
  "win_probability": 0.6,
  "confidence": "low",
  "key_factors": ["test factor"],
  "narrative": "Test narrative.",
  "predicted_score": "6-4 6-3",
  "upset_potential": "low"
}
"""
result = predict(test_prompt)
print(result)
assert "predicted_winner" in result, f"Expected JSON, got: {result}"
print("LLM integration working!")
```
Run `python test_phase4.py`. Delete after confirming.

---

## Phase 5 — FastAPI Endpoints

### 5.1 `backend/models/schemas.py`

```python
from pydantic import BaseModel
from typing import Literal, Optional


class H2HRequest(BaseModel):
    player_a: str
    player_b: str
    surface: Literal["Hard", "Clay", "Grass"]
    best_of: Literal[3, 5] = 3


class TournamentRequest(BaseModel):
    draw: list[str]            # Player names in bracket order (must be power of 2: 4, 8, 16, 32)
    surface: Literal["Hard", "Clay", "Grass"]
    best_of: Literal[3, 5] = 3
    mock: bool = False         # If True, return random results (saves API costs during dev)
```

### 5.2 `backend/main.py` (final version)

```python
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers import players, predict, tournament
from services.data_loader import load_data
from services.rag_pipeline import index_all_matches

app = FastAPI(title="ATP Tennis Predictor", version="1.0.0")

# CORS — allows the React app at localhost:5173 to call this API
# In production, replace "http://localhost:5173" with your Vercel domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router, prefix="/api/players", tags=["Players"])
app.include_router(predict.router, prefix="/api/predict", tags=["Predictions"])
app.include_router(tournament.router, prefix="/api/tournament", tags=["Tournament"])


@app.on_event("startup")
async def startup():
    """Runs once when the server starts. Loads data and indexes into ChromaDB."""
    load_data()
    index_all_matches()  # No-op if already indexed


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all error handler — returns JSON instead of crashing."""
    return JSONResponse(status_code=500, content={"detail": str(exc)})
```

### 5.3 `backend/routers/players.py`

```python
from fastapi import APIRouter, Query
from services.data_loader import get_all_player_names
from services.stats_engine import get_player_stats

router = APIRouter()


@router.get("/search")
def search_players(q: str = Query(..., min_length=2)):
    """
    Search for player names containing the query string (case-insensitive).
    Returns up to 20 matches.
    """
    all_names = get_all_player_names()
    q_lower = q.lower()
    matches = [name for name in all_names if q_lower in name.lower()]
    return {"results": matches[:20]}


@router.get("/{player_name}/stats")
def player_stats(player_name: str, surface: str = None):
    """
    Return aggregated stats for one player.
    Optionally filter by surface (Hard, Clay, Grass).
    """
    return get_player_stats(player_name, surface)
```

### 5.4 `backend/routers/predict.py`

```python
from fastapi import APIRouter, HTTPException
from models.schemas import H2HRequest
from services.stats_engine import get_player_stats, get_h2h
from services.rag_pipeline import retrieve_context
from services.llm_client import predict, build_h2h_prompt

router = APIRouter()


@router.post("/h2h")
def predict_h2h(req: H2HRequest):
    """
    Full RAG prediction pipeline:
    1. Fetch aggregated stats for both players
    2. Fetch head-to-head record
    3. Retrieve semantically relevant past matches from ChromaDB
    4. Build prompt and call LLM
    5. Attach market comparison fields and return
    """
    stats_a = get_player_stats(req.player_a, req.surface)
    stats_b = get_player_stats(req.player_b, req.surface)
    h2h     = get_h2h(req.player_a, req.player_b, req.surface)
    context = retrieve_context(req.player_a, req.player_b, req.surface)

    prompt = build_h2h_prompt(
        player_a=req.player_a,
        player_b=req.player_b,
        surface=req.surface,
        best_of=req.best_of,
        stats_a=stats_a,
        stats_b=stats_b,
        h2h=h2h,
        context=context
    )

    result = predict(prompt)

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    # --- Market comparison: average historical implied prob for predicted winner ---
    # This compares the AI's confidence against what the betting market historically priced
    market_prob = None
    ai_prob = result.get("win_probability")
    h2h_matches = h2h.get("matches_detail", [])
    if h2h_matches:
        winner_probs = [
            m["implied_prob_winner"]
            for m in h2h_matches
            if m.get("implied_prob_winner") is not None
            and m["winner"] == result.get("predicted_winner")
        ]
        if winner_probs:
            market_prob = round(sum(winner_probs) / len(winner_probs), 3)

    result["market_implied_prob_winner"] = market_prob
    result["ai_vs_market_diff"] = (
        round(float(ai_prob) - float(market_prob), 3)
        if market_prob is not None and ai_prob is not None else None
    )
    result["player_a_stats"] = stats_a
    result["player_b_stats"] = stats_b
    result["h2h_record"] = h2h

    return result
```

### 5.5 `backend/routers/tournament.py`

```python
import random
from fastapi import APIRouter
from models.schemas import TournamentRequest
from services.stats_engine import get_player_stats, get_h2h
from services.rag_pipeline import retrieve_context
from services.llm_client import predict, build_h2h_prompt

router = APIRouter()


def _mock_match(player_a: str, player_b: str) -> dict:
    """
    Return fake prediction data without calling the LLM.
    Use this during frontend development to avoid API costs.
    Enable via mock=true in the request body.
    """
    winner = random.choice([player_a, player_b])
    return {
        "player_a": player_a,
        "player_b": player_b,
        "predicted_winner": winner,
        "win_probability": round(random.uniform(0.52, 0.78), 2),
        "confidence": random.choice(["low", "medium", "high"]),
        "narrative": f"[MOCK MODE] {winner} predicted to win.",
        "predicted_score": "6-4 6-3",
        "upset_potential": "low"
    }


def _simulate_match(player_a: str, player_b: str, surface: str, best_of: int) -> dict:
    """Run a real RAG + LLM prediction for a single match."""
    stats_a  = get_player_stats(player_a, surface)
    stats_b  = get_player_stats(player_b, surface)
    h2h      = get_h2h(player_a, player_b, surface)
    context  = retrieve_context(player_a, player_b, surface)
    prompt   = build_h2h_prompt(player_a, player_b, surface, best_of,
                                 stats_a, stats_b, h2h, context)
    result   = predict(prompt)
    result["player_a"] = player_a
    result["player_b"] = player_b
    # Fall back to player_a if LLM response is malformed
    if "predicted_winner" not in result:
        result["predicted_winner"] = player_a
    return result


@router.post("/simulate")
def simulate_tournament(req: TournamentRequest):
    """
    Simulate a full tournament bracket round by round.
    draw: list of player names in bracket seeding order.
    Must be a power of 2 (4, 8, 16, or 32 players).
    Cost note: a 16-player bracket makes 15 LLM API calls. Use mock=true to test layout.
    """
    draw = req.draw

    # Validate draw size is a power of 2
    if len(draw) < 2 or (len(draw) & (len(draw) - 1)) != 0:
        return {"error": "Draw must contain exactly 4, 8, 16, or 32 players."}

    rounds = []
    current_round_players = draw

    while len(current_round_players) > 1:
        round_results = []
        next_round_players = []

        # Pair up players: [0 vs 1, 2 vs 3, 4 vs 5, ...]
        for i in range(0, len(current_round_players), 2):
            player_a = current_round_players[i]
            player_b = current_round_players[i + 1]

            if req.mock:
                match_result = _mock_match(player_a, player_b)
            else:
                match_result = _simulate_match(player_a, player_b, req.surface, req.best_of)

            round_results.append(match_result)
            next_round_players.append(match_result["predicted_winner"])

        rounds.append(round_results)
        current_round_players = next_round_players

    champion = current_round_players[0]
    return {"rounds": rounds, "champion": champion}
```

**✅ CHECKPOINT 5:**
Start backend: `uvicorn main:app --reload`
Open `http://localhost:8000/docs` (FastAPI auto-generated Swagger UI).
Test these four endpoints manually:
1. `GET /api/players/search?q=djok` → list of player names
2. `GET /api/players/{a real player name}/stats` → stats dict
3. `POST /api/predict/h2h` → `{"player_a": "...", "player_b": "...", "surface": "Hard", "best_of": 3}` → prediction dict
4. `POST /api/tournament/simulate` → `{"draw": ["A","B","C","D"], "surface": "Hard", "best_of": 3, "mock": true}` → bracket results

All four must return 200 responses before proceeding.

---

## Phase 6 — React Frontend

> **For Claude Code:** Add inline comments to EVERY component and hook explaining what it does.
> The developer is learning React. Never skip comments to save space.

### 6.1 `frontend/src/api/client.js`

```js
import axios from 'axios'

// axios.create makes a reusable HTTP client with a shared base URL.
// VITE_API_URL is read from .env.local — defaults to local backend.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

// Search for players whose names match the query string
// q: string (at least 2 characters)
export const searchPlayers = (q) =>
  api.get(`/api/players/search?q=${encodeURIComponent(q)}`)

// Get full stats for one player, optionally filtered by surface
// name: string, surface: "Hard"|"Clay"|"Grass"|null
export const getPlayerStats = (name, surface = null) =>
  api.get(`/api/players/${encodeURIComponent(name)}/stats`, {
    params: surface ? { surface } : {}
  })

// Run a head-to-head AI prediction
// body: { player_a, player_b, surface, best_of }
export const predictH2H = (body) =>
  api.post('/api/predict/h2h', body)

// Simulate a tournament bracket
// body: { draw: [...playerNames], surface, best_of, mock }
export const simulateTournament = (body) =>
  api.post('/api/tournament/simulate', body)
```

### 6.2 `frontend/src/main.jsx`

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// This is the React entry point.
// It mounts the entire app into the <div id="root"> in index.html.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### 6.3 `frontend/src/App.jsx`

```jsx
// React Router gives us navigation between pages without full page reloads.
// BrowserRouter: enables URL-based routing
// Routes + Route: maps URL paths to page components
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import HeadToHead from './pages/HeadToHead'
import Tournament from './pages/Tournament'

export default function App() {
  return (
    <BrowserRouter>
      {/* Navbar is outside Routes so it appears on every page */}
      <Navbar />

      {/* The content area — only the matching route renders here */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/"           element={<Home />} />
          <Route path="/h2h"        element={<HeadToHead />} />
          <Route path="/tournament" element={<Tournament />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
```

### 6.4 `frontend/src/components/Navbar.jsx`

```jsx
// Link is like <a> but uses client-side navigation (no page reload)
// useLocation gives us the current URL path so we can highlight the active link
import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()

  const links = [
    { to: '/',           label: 'Home' },
    { to: '/h2h',        label: 'Head-to-Head' },
    { to: '/tournament', label: 'Tournament' },
  ]

  return (
    <nav className="bg-gray-900 text-white px-6 py-4 flex items-center gap-8 shadow-lg">
      <span className="font-bold text-lg text-green-400 tracking-tight">
        🎾 ATP Predictor
      </span>

      <div className="flex gap-6">
        {links.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            // Add green color + bold when this link matches the current URL
            className={`text-sm transition-colors hover:text-green-400 ${
              pathname === to
                ? 'text-green-400 font-semibold'
                : 'text-gray-300'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

### 6.5 `frontend/src/components/PlayerSearch.jsx`

```jsx
// useState: stores component-level data that causes re-renders when it changes
// useEffect: runs side effects (like API calls) in response to state changes
import { useState, useEffect } from 'react'
import { searchPlayers } from '../api/client'

// Props this component accepts:
//   onSelect(playerName) — called when user clicks a player from the dropdown
//   placeholder         — placeholder text for the text input
//   label               — optional label shown above the input
export default function PlayerSearch({ onSelect, placeholder = "Search player...", label }) {
  const [query, setQuery]     = useState('')    // Text the user has typed
  const [results, setResults] = useState([])   // Array of player name strings from API
  const [loading, setLoading] = useState(false)

  // This useEffect runs every time `query` changes.
  // We wait 300ms after the last keystroke before calling the API (debouncing).
  // This prevents spamming the API on every single character typed.
  useEffect(() => {
    if (query.length < 2) {
      setResults([])  // Clear dropdown if query is too short
      return
    }

    // Set a 300ms delay before calling the API
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchPlayers(query)
        setResults(res.data.results)
      } catch (e) {
        console.error('Player search error:', e)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    // Cleanup function: cancels the timer if the user types again before 300ms
    // Without this, multiple API calls could overlap
    return () => clearTimeout(timer)
  }, [query]) // ← only re-runs when `query` changes

  const handleSelect = (name) => {
    setQuery(name)    // Fill the input with the selected name
    setResults([])    // Close the dropdown
    onSelect(name)    // Notify the parent component (e.g. HeadToHead page)
  }

  return (
    <div className="relative w-full">
      {/* Label shown above input */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}

      {/* Text input */}
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          // If user edits after selecting, clear the selection
        }}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
      />

      {/* Loading indicator */}
      {loading && (
        <span className="absolute right-3 top-3 text-xs text-gray-400">Searching...</span>
      )}

      {/* Dropdown results list — only rendered when results exist */}
      {results.length > 0 && (
        <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg
                       shadow-xl mt-1 max-h-52 overflow-y-auto">
          {results.map((name) => (
            <li
              key={name}
              onClick={() => handleSelect(name)}
              className="px-4 py-2.5 text-sm cursor-pointer hover:bg-green-50
                         hover:text-green-800 transition-colors"
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

### 6.6 `frontend/src/components/SurfaceSelector.jsx`

```jsx
// Props:
//   value     — currently selected surface ("Hard", "Clay", or "Grass")
//   onChange  — called with the new surface when user clicks a button
export default function SurfaceSelector({ value, onChange }) {
  const surfaces = [
    { label: 'Hard',  bg: 'bg-blue-500',   ring: 'ring-blue-600'   },
    { label: 'Clay',  bg: 'bg-orange-500', ring: 'ring-orange-600' },
    { label: 'Grass', bg: 'bg-green-500',  ring: 'ring-green-600'  },
  ]

  return (
    <div className="flex gap-3">
      {surfaces.map(({ label, bg, ring }) => (
        <button
          key={label}
          onClick={() => onChange(label)}
          // Active button gets a ring and slight scale; inactive is dimmed
          className={`px-5 py-2 rounded-full text-white text-sm font-semibold
                      transition-all duration-150 ${bg} ${
            value === label
              ? `ring-2 ${ring} ring-offset-1 scale-105 shadow-md`
              : 'opacity-60 hover:opacity-90'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

### 6.7 `frontend/src/components/PredictionCard.jsx`

```jsx
// Displays the full AI prediction result from POST /api/predict/h2h.
// Props:
//   prediction — the response object (predicted_winner, win_probability, etc.)
//   playerA    — name of player A (string)
//   playerB    — name of player B (string)
export default function PredictionCard({ prediction, playerA, playerB }) {
  // Don't render anything if no prediction has been made yet
  if (!prediction) return null

  const {
    predicted_winner, win_probability, confidence,
    key_factors, narrative, predicted_score, upset_potential
  } = prediction

  // Color-code confidence and upset badges
  const confidenceBadge = {
    high:   'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low:    'bg-red-100 text-red-800',
  }[confidence] || 'bg-gray-100 text-gray-700'

  const upsetBadge = {
    low:    'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high:   'bg-red-100 text-red-800',
  }[upset_potential] || 'bg-gray-100 text-gray-700'

  // Calculate the bar width for each player
  // If playerA is the predicted winner, bar fills to win_probability from the left
  const barWidthA = predicted_winner === playerA
    ? win_probability * 100
    : (1 - win_probability) * 100

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">

      {/* Winner header */}
      <div className="text-center border-b pb-4">
        <p className="text-xs text-gray-400 uppercase tracking-widest">Predicted Winner</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{predicted_winner}</p>
        <p className="text-sm text-gray-400 mt-1">Predicted score: {predicted_score}</p>
      </div>

      {/* Win probability bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span className="font-medium">{playerA}</span>
          <span className="font-medium">{playerB}</span>
        </div>
        <div className="w-full h-5 bg-gray-100 rounded-full overflow-hidden flex">
          {/* Player A's portion of the bar */}
          <div
            className="h-full bg-blue-500 transition-all duration-700 ease-out"
            style={{ width: `${barWidthA}%` }}
          />
          {/* Player B's portion fills the rest */}
          <div className="h-full bg-purple-500 flex-1" />
        </div>
        <div className="flex justify-between text-xs mt-1 font-semibold">
          <span className="text-blue-600">{barWidthA.toFixed(0)}%</span>
          <span className="text-purple-600">{(100 - barWidthA).toFixed(0)}%</span>
        </div>
      </div>

      {/* Confidence and upset badges */}
      <div className="flex flex-wrap gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${confidenceBadge}`}>
          Confidence: {confidence}
        </span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${upsetBadge}`}>
          Upset potential: {upset_potential}
        </span>
      </div>

      {/* Key factors list */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Key Factors</p>
        <ul className="space-y-1.5">
          {(key_factors || []).map((f, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-600">
              <span className="text-green-500 flex-shrink-0">→</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* AI analyst narrative */}
      <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-green-400">
        <p className="text-sm text-gray-700 leading-relaxed italic">"{narrative}"</p>
      </div>
    </div>
  )
}
```

### 6.8 `frontend/src/components/OddsComparison.jsx`

```jsx
// Compares the AI's win probability against historical market-implied probability.
// This is the unique differentiating feature of this app.
// Props:
//   playerName  — the predicted winner's name
//   aiProb      — float (0 to 1): AI's predicted win probability
//   marketProb  — float or null: avg historical market-implied prob for this winner
export default function OddsComparison({ playerName, aiProb, marketProb }) {
  if (!aiProb) return null

  // How much does the AI differ from the market? Positive = AI more bullish
  const diffPercent = marketProb ? ((aiProb - marketProb) * 100) : null

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="font-semibold text-gray-800 mb-1">AI vs Market Comparison</h3>
      <p className="text-xs text-gray-400 mb-4">
        Market probability is the average historical betting market implied probability
        for {playerName} in past H2H meetings.
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* AI probability */}
        <div className="text-center bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
            AI Prediction
          </p>
          <p className="text-4xl font-bold text-blue-700 mt-2">
            {(aiProb * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">{playerName} wins</p>
        </div>

        {/* Market probability */}
        <div className="text-center bg-purple-50 rounded-xl p-4">
          <p className="text-xs text-purple-600 font-semibold uppercase tracking-wide">
            Historical Market
          </p>
          {marketProb ? (
            <>
              <p className="text-4xl font-bold text-purple-700 mt-2">
                {(marketProb * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-gray-400 mt-1">Avg implied odds</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-6">
              No H2H odds data available
            </p>
          )}
        </div>
      </div>

      {/* Divergence summary */}
      {diffPercent !== null && (
        <div className="mt-4 p-3 bg-gray-50 rounded-xl text-center">
          <p className="text-sm text-gray-600">
            AI is{' '}
            <span className={`font-bold ${diffPercent > 0 ? 'text-blue-600' : 'text-red-500'}`}>
              {Math.abs(diffPercent).toFixed(1)}%{' '}
              {diffPercent > 0 ? 'more confident' : 'less confident'}
            </span>{' '}
            than the historical betting market.
          </p>
        </div>
      )}
    </div>
  )
}
```

### 6.9 `frontend/src/components/WinRateChart.jsx`

```jsx
// Recharts components — we import only what we need
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

// Shows a grouped bar chart comparing surface win rates for two players.
// Props:
//   playerA, playerB — player name strings (used as chart labels)
//   statsA, statsB   — stats objects from the API (contain surface_win_rates)
export default function WinRateChart({ playerA, playerB, statsA, statsB }) {
  const surfaces = ['Hard', 'Clay', 'Grass']

  // Recharts needs data as an array of objects.
  // Each object represents one group of bars (one surface).
  const data = surfaces.map((surf) => ({
    surface: surf,
    // Use the win_rate value if it exists, otherwise null (no bar rendered)
    [playerA]: statsA?.surface_win_rates?.[surf]?.win_rate ?? null,
    [playerB]: statsB?.surface_win_rates?.[surf]?.win_rate ?? null,
  }))

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="font-semibold text-gray-800 mb-4">Win Rate by Surface</h3>
      {/* ResponsiveContainer makes the chart fill its parent's width */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="surface" tick={{ fontSize: 12 }} />
          {/* Format Y axis ticks as percentages */}
          <YAxis
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            domain={[0, 1]}
            tick={{ fontSize: 11 }}
          />
          {/* Format tooltip values as percentages */}
          <Tooltip
            formatter={(v) => v !== null ? `${(v * 100).toFixed(1)}%` : 'No data'}
          />
          <Legend />
          <Bar dataKey={playerA} fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey={playerB} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### 6.10 `frontend/src/components/TournamentBracket.jsx`

```jsx
// Renders a visual tournament bracket from the simulation API response.
// Props:
//   rounds    — array of round arrays. rounds[0] = first round match results.
//   champion  — string: the tournament winner's name
//   isLoading — boolean: show spinner while simulation is running
export default function TournamentBracket({ rounds, champion, isLoading }) {

  // Show spinner while the API is running
  if (isLoading) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-5xl mb-4 animate-bounce">🎾</div>
        <p className="font-medium">Simulating tournament...</p>
        <p className="text-sm mt-2">
          Each match requires an AI call — this may take a minute or two.
        </p>
      </div>
    )
  }

  // Show empty state before simulation runs
  if (!rounds || rounds.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Add players and click Simulate to see the bracket.</p>
      </div>
    )
  }

  // Round labels — shows the most descriptive label for each round
  const ROUND_LABELS = ['R32', 'R16', 'Quarterfinals', 'Semifinals', 'Final']
  const labelOffset = ROUND_LABELS.length - rounds.length

  return (
    // Horizontal scroll handles large brackets on small screens
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max items-start">

        {/* Each column = one round */}
        {rounds.map((round, roundIndex) => (
          <div key={roundIndex} className="flex flex-col gap-3" style={{ minWidth: 170 }}>

            {/* Round label at the top */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center pb-1">
              {ROUND_LABELS[roundIndex + labelOffset] || `Round ${roundIndex + 1}`}
            </p>

            {/* Each match card in this round */}
            {round.map((match, matchIndex) => (
              <div
                key={matchIndex}
                className="bg-white border border-gray-100 rounded-xl shadow-sm p-3 text-sm"
              >
                {/* Player A row */}
                <div className={`py-1 px-2 rounded mb-1 truncate ${
                  match.predicted_winner === match.player_a
                    ? 'bg-green-50 text-green-800 font-bold'
                    : 'text-gray-400 line-through'
                }`}>
                  {match.player_a || '—'}
                </div>

                <div className="text-center text-xs text-gray-300 my-0.5">vs</div>

                {/* Player B row */}
                <div className={`py-1 px-2 rounded truncate ${
                  match.predicted_winner === match.player_b
                    ? 'bg-green-50 text-green-800 font-bold'
                    : 'text-gray-400 line-through'
                }`}>
                  {match.player_b || '—'}
                </div>

                {/* Win probability shown at bottom of card */}
                {match.win_probability && (
                  <div className="text-xs text-gray-400 text-center mt-2">
                    {(match.win_probability * 100).toFixed(0)}% confidence
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Champion trophy column — shown after simulation completes */}
        {champion && (
          <div className="flex flex-col items-center justify-center min-w-[140px] pt-8">
            <div className="text-4xl mb-2">🏆</div>
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3 text-center shadow">
              <p className="text-xs text-yellow-600 font-bold uppercase tracking-wide">Champion</p>
              <p className="font-bold text-gray-900 text-sm mt-1 leading-tight">{champion}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

### 6.11 `frontend/src/pages/Home.jsx`

```jsx
// Link from react-router-dom gives us navigation without page reloads
import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="text-center py-16 space-y-10">

      {/* Hero section */}
      <div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight">
          🎾 ATP Match Predictor
        </h1>
        <p className="text-lg text-gray-500 mt-4 max-w-2xl mx-auto leading-relaxed">
          AI-powered tennis predictions backed by real ATP match data (2020–2025).
          Compare AI win probabilities against historical betting market odds.
        </p>
      </div>

      {/* Two CTA cards */}
      <div className="flex gap-6 justify-center flex-wrap">
        <Link
          to="/h2h"
          className="bg-green-500 hover:bg-green-600 text-white rounded-2xl px-8 py-7
                     text-left w-64 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          <div className="text-4xl mb-3">⚔️</div>
          <h2 className="text-xl font-bold">Head-to-Head</h2>
          <p className="text-green-100 text-sm mt-2 leading-snug">
            Pick two players and a surface. Get an AI prediction with key factors,
            win probability, and betting market comparison.
          </p>
        </Link>

        <Link
          to="/tournament"
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-2xl px-8 py-7
                     text-left w-64 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          <div className="text-4xl mb-3">🏆</div>
          <h2 className="text-xl font-bold">Tournament Simulator</h2>
          <p className="text-blue-100 text-sm mt-2 leading-snug">
            Build a custom bracket with up to 16 players, pick a surface,
            and simulate the full tournament round by round.
          </p>
        </Link>
      </div>

      {/* Dataset attribution line */}
      <p className="text-sm text-gray-400">
        2020–2025 ATP match data · RAG pipeline · Betting odds analysis
      </p>
    </div>
  )
}
```

### 6.12 `frontend/src/pages/HeadToHead.jsx`

```jsx
// useState lets us store data inside this component that persists across re-renders.
// When state changes, React re-renders the component with the new values.
import { useState } from 'react'
import PlayerSearch    from '../components/PlayerSearch'
import SurfaceSelector from '../components/SurfaceSelector'
import PredictionCard  from '../components/PredictionCard'
import OddsComparison  from '../components/OddsComparison'
import WinRateChart    from '../components/WinRateChart'
import { predictH2H, getPlayerStats } from '../api/client'

export default function HeadToHead() {
  // User input state
  const [playerA,  setPlayerA]  = useState('')      // Selected player A name
  const [playerB,  setPlayerB]  = useState('')      // Selected player B name
  const [surface,  setSurface]  = useState('Hard')  // Selected surface
  const [bestOf,   setBestOf]   = useState(3)       // 3 or 5 sets

  // API result state
  const [prediction, setPrediction] = useState(null)  // AI prediction response
  const [statsA,     setStatsA]     = useState(null)  // Player A stats
  const [statsB,     setStatsB]     = useState(null)  // Player B stats
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  const handlePredict = async () => {
    // Validate inputs before calling the API
    if (!playerA || !playerB) {
      setError('Please select both players.')
      return
    }
    if (playerA === playerB) {
      setError('Please select two different players.')
      return
    }

    setLoading(true)
    setError('')
    setPrediction(null)

    try {
      // Promise.all runs three API calls simultaneously (faster than sequential)
      const [predRes, statsARes, statsBRes] = await Promise.all([
        predictH2H({ player_a: playerA, player_b: playerB, surface, best_of: bestOf }),
        getPlayerStats(playerA, surface),
        getPlayerStats(playerB, surface),
      ])

      setPrediction(predRes.data)
      setStatsA(statsARes.data)
      setStatsB(statsBRes.data)
    } catch (e) {
      setError('Prediction failed. Check the backend is running and player names are valid.')
      console.error(e)
    } finally {
      // Always runs — clears loading state whether call succeeded or failed
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Head-to-Head Predictor</h1>

      {/* Input card */}
      <div className="bg-white rounded-2xl shadow p-6 space-y-6">

        {/* Player search inputs side by side on wide screens */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlayerSearch
            label="Player A"
            onSelect={setPlayerA}
            placeholder="Search player A..."
          />
          <PlayerSearch
            label="Player B"
            onSelect={setPlayerB}
            placeholder="Search player B..."
          />
        </div>

        {/* Surface and best-of options */}
        <div className="flex flex-wrap gap-8 items-start">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Surface</p>
            <SurfaceSelector value={surface} onChange={setSurface} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Format</p>
            <div className="flex gap-2">
              {[3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setBestOf(n)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    bestOf === n
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-300 text-gray-600 hover:border-gray-500'
                  }`}
                >
                  Best of {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Predict button */}
        <button
          onClick={handlePredict}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed
                     text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-sm"
        >
          {loading ? '⏳ Predicting...' : '🎾 Predict Match'}
        </button>
      </div>

      {/* Results — only render once we have a prediction */}
      {prediction && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: main prediction card */}
          <PredictionCard
            prediction={prediction}
            playerA={playerA}
            playerB={playerB}
          />

          {/* Right column: odds comparison + surface chart */}
          <div className="space-y-6">
            <OddsComparison
              playerName={prediction.predicted_winner}
              aiProb={prediction.win_probability}
              marketProb={prediction.market_implied_prob_winner}
            />
            <WinRateChart
              playerA={playerA}
              playerB={playerB}
              statsA={statsA}
              statsB={statsB}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

### 6.13 `frontend/src/pages/Tournament.jsx`

```jsx
import { useState } from 'react'
import PlayerSearch      from '../components/PlayerSearch'
import SurfaceSelector   from '../components/SurfaceSelector'
import TournamentBracket from '../components/TournamentBracket'
import { simulateTournament } from '../api/client'

// Supported bracket sizes. Must be powers of 2.
const DRAW_SIZES = [4, 8, 16]

export default function Tournament() {
  // User input state
  const [draw,     setDraw]     = useState([])       // Array of player names in bracket order
  const [surface,  setSurface]  = useState('Hard')
  const [bestOf,   setBestOf]   = useState(3)
  const [drawSize, setDrawSize] = useState(8)        // How many players in the bracket
  const [useMock,  setUseMock]  = useState(false)    // Mock mode skips LLM calls

  // API result state
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleAddPlayer = (name) => {
    if (draw.includes(name)) return           // Prevent duplicates
    if (draw.length >= drawSize) return        // Prevent exceeding draw size
    setDraw([...draw, name])                  // Spread creates a new array (React needs new refs)
  }

  const handleRemovePlayer = (name) => {
    setDraw(draw.filter((p) => p !== name))   // Filter returns array without the removed name
  }

  const handleChangDrawSize = (size) => {
    setDrawSize(size)
    setDraw([])     // Reset draw when size changes
    setResult(null)
  }

  const handleSimulate = async () => {
    if (draw.length !== drawSize) {
      setError(`Please add exactly ${drawSize} players to the draw.`)
      return
    }
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const res = await simulateTournament({
        draw,
        surface,
        best_of: bestOf,
        mock: useMock,
      })
      setResult(res.data)
    } catch (e) {
      setError('Simulation failed. Check that the backend is running.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Tournament Simulator</h1>

      {/* Configuration card */}
      <div className="bg-white rounded-2xl shadow p-6 space-y-6">

        {/* Draw size, surface, best-of options */}
        <div className="flex flex-wrap gap-8 items-start">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Draw Size</p>
            <div className="flex gap-2">
              {DRAW_SIZES.map((n) => (
                <button
                  key={n}
                  onClick={() => handleChangDrawSize(n)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    drawSize === n
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-300 text-gray-600 hover:border-gray-500'
                  }`}
                >
                  {n} players
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Surface</p>
            <SurfaceSelector value={surface} onChange={setSurface} />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Format</p>
            <div className="flex gap-2">
              {[3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setBestOf(n)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    bestOf === n
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'border-gray-300 text-gray-600 hover:border-gray-500'
                  }`}
                >
                  Best of {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mock mode toggle — saves API costs while testing UI */}
        <label className="flex items-center gap-3 cursor-pointer w-fit">
          <div className="relative">
            <input
              type="checkbox"
              checked={useMock}
              onChange={(e) => setUseMock(e.target.checked)}
              className="sr-only"  // Visually hidden, but accessible
            />
            {/* Custom toggle appearance */}
            <div className={`w-10 h-6 rounded-full transition-colors ${
              useMock ? 'bg-blue-500' : 'bg-gray-200'
            }`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow mt-1 transition-transform ${
                useMock ? 'translate-x-5' : 'translate-x-1'
              }`} />
            </div>
          </div>
          <span className="text-sm text-gray-600">
            Mock mode{' '}
            <span className="text-gray-400">(skips AI calls — use while testing layout)</span>
          </span>
        </label>

        {/* Player search to add players to the draw */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Build Your Draw ({draw.length} / {drawSize} players)
          </p>
          <PlayerSearch
            onSelect={handleAddPlayer}
            placeholder="Search and add a player..."
          />
        </div>

        {/* Current draw — chips with remove button */}
        {draw.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {draw.map((name, index) => (
              <div
                key={name}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200
                           rounded-full pl-3 pr-2 py-1.5 text-sm transition-colors"
              >
                {/* Seed number */}
                <span className="text-gray-400 text-xs font-mono">#{index + 1}</span>
                <span className="font-medium text-gray-800">{name}</span>
                {/* Remove button */}
                <button
                  onClick={() => handleRemovePlayer(name)}
                  className="text-gray-400 hover:text-red-500 ml-1 text-base leading-none"
                  title="Remove player"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Cost warning for large real brackets */}
        {!useMock && drawSize > 4 && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            ⚠️ A {drawSize}-player bracket will make {drawSize - 1} AI API calls.
            Enable mock mode to test the UI without using API credits.
          </p>
        )}

        {/* Simulate button */}
        <button
          onClick={handleSimulate}
          disabled={loading || draw.length !== drawSize}
          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                     text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-sm"
        >
          {loading ? '⏳ Simulating...' : `🏆 Simulate ${drawSize}-Player Tournament`}
        </button>
      </div>

      {/* Bracket display */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="font-semibold text-gray-800 mb-4">
          Bracket {result?.champion ? `— Champion: ${result.champion}` : ''}
        </h2>
        <TournamentBracket
          rounds={result?.rounds}
          champion={result?.champion}
          isLoading={loading}
        />
      </div>
    </div>
  )
}
```

**✅ CHECKPOINT 6:**
With both servers running:
1. `http://localhost:5173` — Home page loads, both CTA cards visible
2. Navigate to H2H — type 3 letters in Player A search, dropdown appears with names
3. Select two players, pick surface, click Predict — prediction card, odds comparison, and chart all render
4. Navigate to Tournament — add 4 players, enable mock mode, click Simulate — bracket renders with winner
5. Disable mock mode, run a 4-player bracket for real — confirm real AI predictions appear

---

## Phase 7 — Polish & Production Readiness

### 7.1 README.md (create at project root)

```markdown
# ATP Tennis Match Predictor

AI-powered tennis prediction app using RAG (Retrieval-Augmented Generation).
React frontend + FastAPI backend + ChromaDB vector store.

## Prerequisites
- Python 3.10+
- Node.js 18+
- An Anthropic or OpenAI API key

## Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env` (see `.env.example`):
```
LLM_PROVIDER=claude
ANTHROPIC_API_KEY=your_key
DATA_PATH=./data/atp_matches.csv
CHROMA_PERSIST_DIR=./chroma_db
```

Place your ATP matches CSV at `backend/data/atp_matches.csv`.

### Frontend
```bash
cd frontend
npm install
```

## Running Locally

Terminal 1 (backend):
```bash
cd backend && source venv/bin/activate
uvicorn main:app --reload
```

Terminal 2 (frontend):
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`.

**First run:** ChromaDB indexing takes 5–10 minutes. Subsequent startups are instant.

## Switching LLM Provider
Change `LLM_PROVIDER=openai` in `backend/.env` and set `OPENAI_API_KEY`.
No other changes required.
```

### 7.2 Rate limiting on prediction endpoints

Add to `backend/main.py` (already has the slowapi install):
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Add to `backend/routers/predict.py`:
```python
from fastapi import Request
from main import limiter

@router.post("/h2h")
@limiter.limit("10/minute")   # Max 10 predictions per minute per IP
async def predict_h2h(request: Request, req: H2HRequest):
    ...
```

**✅ CHECKPOINT 7:** Full end-to-end test with real (non-mock) data.
- H2H prediction returns in under 30 seconds
- All four UI components render (prediction, odds comparison, chart)
- Tournament simulation with 4 real players completes successfully
- Rate limit triggers if you submit more than 10 requests in a minute

---

## Phase 8 — Deployment (Do After Local App is Complete)

> Do not start this phase until all Phase 7 checkpoints pass locally.

### 8.1 Update CORS for production

In `backend/main.py`, add your Vercel URL to allow_origins:
```python
allow_origins=[
    "http://localhost:5173",           # Local dev
    "https://your-app.vercel.app",     # Production (fill in after Vercel deploy)
],
```

### 8.2 Frontend → Vercel

1. Push code to GitHub
2. Go to vercel.com → New Project → Import your repo
3. Set: Framework = Vite, Root Directory = `frontend`
4. Add environment variable: `VITE_API_URL` = your Render backend URL (added in next step)
5. Deploy

### 8.3 Backend → Render

1. Go to render.com → New → Web Service → Connect GitHub repo
2. Root Directory: `backend`
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add all environment variables from your local `.env` in the Render dashboard
6. Note the generated URL (e.g. `https://atp-predictor-api.onrender.com`)
7. Go back to Vercel and set `VITE_API_URL` to this Render URL

### 8.4 ChromaDB → Pinecone (required for persistent storage on Render)

Render's filesystem resets on each deploy — ChromaDB data would be lost.
Swap to Pinecone (free tier supports this project easily):

1. Sign up at pinecone.io, create an index:
   - Dimensions: 384 (matches `all-MiniLM-L6-v2` output size)
   - Metric: cosine
2. Add `USE_PINECONE=true`, `PINECONE_API_KEY`, `PINECONE_INDEX_NAME` to `config.py` and `.env`
3. In `rag_pipeline.py`, add a conditional code path:
   - If `USE_PINECONE=true` → use `pinecone` client
   - Else → use ChromaDB (for local dev)
   - The indexing and retrieval logic is the same — just different client calls
4. Install: `pip install pinecone-client`

### 8.5 Final production checklist

- [ ] `.env` is in `.gitignore` (never committed)
- [ ] All API keys are set as env vars in Render dashboard (not hardcoded)
- [ ] CORS `allow_origins` includes Vercel domain
- [ ] Rate limiting is enabled on prediction endpoints
- [ ] `VITE_API_URL` in Vercel points to Render backend URL
- [ ] ChromaDB swapped to Pinecone on backend
- [ ] Test full flow on production URLs before sharing

---

## Suggested Resume Bullets (After Completion)

- Built a full-stack ATP tennis prediction app (React + FastAPI) using a RAG pipeline —
  ChromaDB with sentence-transformer embeddings retrieves semantically relevant match history
  as LLM context, improving prediction grounding over zero-shot prompting
- Engineered a betting odds analysis feature comparing AI-predicted win probabilities against
  historical market-implied probabilities, surfacing model-vs-market divergence as a signal
- Designed a tournament bracket simulator that chains sequential LLM calls to simulate
  round-by-round outcomes across custom 4/8/16-player draws
- Abstracted LLM provider behind a single environment variable enabling hot-swap between
  Claude and GPT-4 with zero code changes; deployed to Vercel + Render with Pinecone vector DB

import json
import random
import re
from fastapi import APIRouter
from models.schemas import TournamentRequest, ParseDrawRequest, FetchDrawRequest
from services.stats_engine import get_player_stats, get_h2h
from services.rag_pipeline import retrieve_context
from services.llm_client import predict, build_h2h_prompt
from config import ANTHROPIC_API_KEY, CLAUDE_MODEL

router = APIRouter()

# ── Prompt for parsing a draw image or text ────────────────────────────────

PARSE_DRAW_PROMPT = """Analyze this tennis tournament draw carefully.

CASE A — Unplayed draw (player names in slots but NO match scores or winners shown):
{
  "type": "unplayed",
  "players": ["Full Player Name", ...],
  "draw_size": <total players as power of 2>,
  "tournament_name": "<name if visible or null>"
}
Players in bracket order top to bottom. Skip BYE slots.

CASE B — In-progress or completed bracket (match results/scores ARE shown in the bracket):
{
  "type": "in_progress",
  "completed_rounds": [
    [
      {
        "player_a": "Full Name",
        "player_b": "Full Name",
        "winner": "Full Name",
        "score": "6-4 6-3",
        "completed": true
      }
    ]
  ],
  "remaining_players": ["Full Name", ...],
  "draw_size": <original draw size>,
  "tournament_name": "<name if visible or null>"
}
completed_rounds: array of fully completed rounds, earliest first. Each round is an array of matches.
remaining_players: players who advanced and haven't played their next round — in bracket order top to bottom.
remaining_players count must be a power of 2 (4, 8, 16, 32).

RULES:
- Return ONLY valid JSON, no other text
- Use FULL names as they appear (e.g. "Carlos Alcaraz" not "C. Alcaraz" or "Alcaraz")
- If only last name is shown (e.g. "ALCARAZ"), expand to the full known name
- draw_size must be a power of 2 (4, 8, 16, 32, 64)
- In CASE B: if the bracket shows only partial results, include only the rounds that are fully completed"""


def _parse_draw_with_claude(text: str = None, image_base64: str = None,
                             media_type: str = "image/png") -> dict:
    """Use Claude to extract draw structure from pasted text or an image."""
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        if image_base64:
            content = [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image_base64,
                    },
                },
                {"type": "text", "text": PARSE_DRAW_PROMPT},
            ]
        else:
            content = f"{PARSE_DRAW_PROMPT}\n\nDraw text:\n{text}"

        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": content}],
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception as e:
        return {"error": str(e)}


# ── Web fetch helpers ───────────────────────────────────────────────────────

def _fetch_draw_from_web(tournament_name: str) -> dict | None:
    """
    Try to scrape draw HTML from atptour.com.
    Returns dict with 'text' key if successful, None if failed.
    ATP Tour is JS-rendered so this often falls back to Claude knowledge.
    """
    try:
        import requests
        from bs4 import BeautifulSoup

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        }
        slug = re.sub(r"[^a-z0-9-]", "-", tournament_name.lower()).strip("-")
        urls_to_try = [
            f"https://www.atptour.com/en/draws/{slug}",
            f"https://www.atptour.com/en/scores/current",
        ]
        for url in urls_to_try:
            r = requests.get(url, headers=headers, timeout=8)
            if r.status_code != 200:
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            for tag in soup(["script", "style", "nav", "header", "footer"]):
                tag.decompose()
            text = soup.get_text(separator=" ", strip=True)
            # Only useful if it looks like it has draw content
            if len(text) > 3000 and any(
                kw in text.lower() for kw in ["draw", "player", "seed"]
            ):
                return {"text": text[:7000], "source": url}
    except Exception:
        pass
    return None


def _fetch_draw_from_claude_knowledge(tournament_name: str) -> dict:
    """Ask Claude to recall the draw from its training knowledge."""
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        prompt = f"""Tennis tournament: "{tournament_name}"

Using your training knowledge, provide the player draw for this tournament (most recent edition you know).

Return ONLY this JSON:
{{
  "players": ["Full Player Name", ...],
  "draw_size": <4|8|16|32>,
  "surface": "Hard" | "Clay" | "Grass",
  "tournament_name": "<official tournament name>",
  "source_note": "AI training knowledge (up to mid-2025) — verify for current events"
}}

Rules:
- Players in correct bracket seeding order top to bottom
- Only include players you are confident were in the draw
- draw_size must be 4, 8, 16, or 32 (if the real draw has 64+, return the last 32)
- If you genuinely don't know this tournament, return: {{"error": "Tournament not found in training data"}}"""

        msg = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception as e:
        return {"error": f"Failed to fetch draw: {str(e)}"}


# ── Match simulation helpers ────────────────────────────────────────────────

def _mock_match(player_a: str, player_b: str) -> dict:
    """Return fake prediction data without calling the LLM."""
    winner = random.choice([player_a, player_b])
    return {
        "player_a": player_a,
        "player_b": player_b,
        "predicted_winner": winner,
        "win_probability": round(random.uniform(0.52, 0.78), 2),
        "confidence": random.choice(["low", "medium", "high"]),
        "narrative": f"[MOCK MODE] {winner} predicted to win.",
        "predicted_score": "6-4 6-3",
        "upset_potential": "low",
    }


def _simulate_match(player_a: str, player_b: str, surface: str, best_of: int) -> dict:
    """Run a real RAG + LLM prediction for a single match."""
    stats_a = get_player_stats(player_a, surface)
    stats_b = get_player_stats(player_b, surface)
    h2h = get_h2h(player_a, player_b, surface)
    context = retrieve_context(player_a, player_b, surface)
    prompt = build_h2h_prompt(
        player_a, player_b, surface, best_of, stats_a, stats_b, h2h, context
    )
    result = predict(prompt)
    result["player_a"] = player_a
    result["player_b"] = player_b
    if "predicted_winner" not in result:
        result["predicted_winner"] = player_a
    return result


# ── API Endpoints ───────────────────────────────────────────────────────────

@router.post("/parse-draw")
def parse_draw(req: ParseDrawRequest):
    """
    Parse a tournament draw from pasted text or a base64 image.

    Returns one of:
    - { type: "unplayed", players: [...], draw_size: N } — clean draw, no results yet
    - { type: "in_progress", completed_rounds: [...], remaining_players: [...], draw_size: N }
      — bracket with some results already played
    """
    if not req.text and not req.image_base64:
        return {"error": "Provide either 'text' or 'image_base64'."}

    result = _parse_draw_with_claude(
        text=req.text,
        image_base64=req.image_base64,
        media_type=req.media_type or "image/png",
    )

    if "error" in result:
        return {"error": f"Failed to parse draw: {result['error']}"}

    return result


@router.post("/fetch-draw")
def fetch_draw_by_name(req: FetchDrawRequest):
    """
    Fetch a tournament draw by name.
    Tries to scrape from atptour.com first; falls back to Claude's training knowledge.
    Returns: { players, draw_size, surface, tournament_name, source_note }
    """
    web_data = _fetch_draw_from_web(req.tournament_name)

    if web_data:
        parsed = _parse_draw_with_claude(
            text=f"Tournament: {req.tournament_name}\n\n{web_data['text']}"
        )
        if "error" not in parsed and parsed.get("players"):
            parsed["source_note"] = f"Scraped from {web_data['source']}"
            return parsed

    return _fetch_draw_from_claude_knowledge(req.tournament_name)


@router.post("/simulate")
def simulate_tournament(req: TournamentRequest):
    """
    Simulate a full tournament bracket round by round.
    draw: list of player names in bracket order (power of 2: 4, 8, 16, 32).
    Cost note: a 16-player bracket makes 15 LLM API calls. Use mock=true to test layout.
    """
    draw = req.draw

    if len(draw) < 2 or (len(draw) & (len(draw) - 1)) != 0:
        return {"error": "Draw must contain exactly 4, 8, 16, or 32 players."}

    rounds = []
    current_round_players = draw

    while len(current_round_players) > 1:
        round_results = []
        next_round_players = []

        for i in range(0, len(current_round_players), 2):
            player_a = current_round_players[i]
            player_b = current_round_players[i + 1]

            if req.mock:
                match_result = _mock_match(player_a, player_b)
            else:
                match_result = _simulate_match(
                    player_a, player_b, req.surface, req.best_of
                )

            round_results.append(match_result)
            next_round_players.append(match_result["predicted_winner"])

        rounds.append(round_results)
        current_round_players = next_round_players

    champion = current_round_players[0]
    return {"rounds": rounds, "champion": champion}

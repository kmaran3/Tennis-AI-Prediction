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

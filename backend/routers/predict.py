from fastapi import APIRouter, HTTPException, Request
from models.schemas import H2HRequest
from services.stats_engine import get_player_stats, get_h2h
from services.rag_pipeline import retrieve_context
from services.llm_client import predict, build_h2h_prompt
from rate_limiter import limiter

router = APIRouter()


@router.post("/h2h")
@limiter.limit("10/minute")
async def predict_h2h(request: Request, req: H2HRequest):
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

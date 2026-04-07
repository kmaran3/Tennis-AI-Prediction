from fastapi import APIRouter, HTTPException, Request
from models.schemas import H2HRequest
from services.stats_engine import get_player_stats, get_h2h, get_recent_form
from services.rag_pipeline import retrieve_context
from services.llm_client import predict, build_h2h_prompt
from services.data_loader import resolve_player_name
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
    # Resolve to dataset names for all data lookups (handles full names from Sofascore etc.)
    ds_a = resolve_player_name(req.player_a)
    ds_b = resolve_player_name(req.player_b)

    stats_a  = get_player_stats(ds_a, req.surface)
    stats_b  = get_player_stats(ds_b, req.surface)
    h2h      = get_h2h(ds_a, ds_b, req.surface)
    context  = retrieve_context(ds_a, ds_b, req.surface)
    form_a   = get_recent_form(ds_a)
    form_b   = get_recent_form(ds_b)

    prompt = build_h2h_prompt(
        player_a=req.player_a,  # keep original names for readable narrative
        player_b=req.player_b,
        surface=req.surface,
        best_of=req.best_of,
        stats_a=stats_a,
        stats_b=stats_b,
        h2h=h2h,
        context=context,
        form_a=form_a,
        form_b=form_b,
        accuracy_context=req.accuracy_context,
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

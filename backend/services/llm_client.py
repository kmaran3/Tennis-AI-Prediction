import json
from config import LLM_PROVIDER, CLAUDE_MODEL, OPENAI_MODEL

# Shared system prompt — tells the LLM its role and output format
SYSTEM_PROMPT = """You are an expert ATP tennis analyst with access to real match data
from 2000-2026. You will receive player statistics, head-to-head records, and relevant
match history as context. Base your prediction on this data — be specific and cite
patterns you see. Always respond with valid JSON only. No preamble, no markdown fences,
no explanation outside the JSON object."""


def _fmt_accuracy(ctx: dict | None) -> str:
    """Format historical accuracy stats as a calibration note for the LLM."""
    if not ctx or ctx.get('total', 0) < 3:
        return "  No accuracy data yet — no prior predictions have been recorded."
    lines = [
        f"  Overall accuracy: {ctx['correct']}/{ctx['total']} "
        f"({ctx['overall_pct']}%) predictions correct."
    ]
    for surf, data in (ctx.get('by_surface') or {}).items():
        if data['total'] >= 2:
            lines.append(
                f"  {surf}: {data['correct']}/{data['total']} ({data['pct']}%) correct"
                + (" ← consider adjusting confidence on this surface" if data['pct'] < 50 else "")
            )
    if ctx.get('high_conf_pct') is not None:
        lines.append(
            f"  High-confidence predictions: {ctx['high_conf_pct']}% accurate "
            f"({'well-calibrated' if ctx['high_conf_pct'] >= 65 else 'overconfident — reduce win_probability for high-confidence calls'})"
        )
    lines.append("  Use this data to calibrate your confidence — do not overcorrect, but adjust win_probability and confidence field accordingly.")
    return "\n".join(lines)


def build_h2h_prompt(player_a: str, player_b: str, surface: str, best_of: int,
                     stats_a: dict, stats_b: dict, h2h: dict, context: str,
                     form_a: list = None, form_b: list = None,
                     accuracy_context: dict = None) -> str:
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
            f"  Average ranking (2000-2026): {s.get('avg_rank', 'Unknown')}\n"
            f"  Upset wins: {s.get('upset_wins', 0)} | Upset losses: {s.get('upset_losses', 0)}\n"
            f"  Win rates by surface:\n{fmt_surface_stats(s.get('surface_win_rates', {}))}"
        )

    def fmt_form(form: list) -> str:
        if not form:
            return "  No recent match data available"
        lines = []
        for m in form:
            result = "W" if m['won'] else "L"
            opp_rank = f"(Rank {m['opp_rank']})" if m.get('opp_rank') else "(Rank N/A)"
            series = f" [{m['series']}]" if m.get('series') else ""
            lines.append(
                f"  {result} | {m['date']} | vs {m['opponent']} {opp_rank} | "
                f"{m['surface']} | {m['tournament']}{series} | {m['round']} | {m['score']}"
            )
        return "\n".join(lines)

    h2h_summary = (
        f"{player_a} leads H2H {h2h['player_a_wins']}-{h2h['player_b_wins']} "
        f"across {h2h['matches']} matches."
        if h2h['matches'] > 0
        else "No prior meetings between these players in the dataset."
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

## Recent Form (last 10 matches, most recent first)

### {player_a}
{fmt_form(form_a or [])}

### {player_b}
{fmt_form(form_b or [])}

## Head-to-Head Record
{h2h_summary}{recent_h2h}

## Relevant Match History (retrieved from dataset)
{context}

## Prediction Accuracy Calibration
{_fmt_accuracy(accuracy_context)}

## Prediction Task
Predict the outcome of: {player_a} vs {player_b}
Surface: {surface} | Format: Best of {best_of}

When analysing recent form, weight wins and losses by opponent quality:
- A win over a top-10 ranked player or in a late round of a Masters/Slam carries much more weight than a win over a rank 80+ player in a small 250 event
- A losing streak against top opponents is less alarming than losses to low-ranked players
- A hot streak at 250-level events or against poor-form opponents should not be over-weighted against a top-ranked, in-form opponent
- Consider the tournament tier (Grand Slam > Masters 1000 > 500 > 250) and the round (Final/SF > QF > early rounds)
- Factor in both players' current rankings relative to each other — rank gap is a strong baseline signal
Also factor in each player's current age and career stage from your training knowledge —
consider physical prime, experience level, and trajectory (rising/peak/declining).

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

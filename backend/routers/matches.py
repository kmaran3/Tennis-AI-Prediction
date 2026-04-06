from fastapi import APIRouter
import requests as http
from datetime import date

router = APIRouter()


def _format_score(home: dict, away: dict, status_type: str) -> str | None:
    """Convert Sofascore period-based tennis score into a readable string like '6-4, 3-1'."""
    if not home and not away:
        return None
    sets = []
    for period in ["period1", "period2", "period3", "period4", "period5"]:
        h = home.get(period)
        a = away.get(period)
        if h is None or a is None:
            break
        sets.append(f"{h}-{a}")
    if not sets:
        return None
    score = ", ".join(sets)
    # Append live game score for in-progress matches
    if status_type == "inprogress":
        hc = home.get("current")
        ac = away.get("current")
        if hc is not None and ac is not None:
            score += f" ({hc}-{ac})"
    return score


@router.get("/today")
def get_todays_matches():
    """
    Fetch today's ATP matches from Sofascore's unofficial API.
    Filters to ATP singles matches only. Returns empty list gracefully on failure.
    """
    today_str = date.today().strftime("%Y-%m-%d")
    url = f"https://api.sofascore.com/api/v1/sport/tennis/scheduled-events/{today_str}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Referer": "https://www.sofascore.com/",
    }

    try:
        r = http.get(url, headers=headers, timeout=10)
        r.raise_for_status()
        data = r.json()

        matches = []
        for event in data.get("events", []):
            # Filter to ATP Tour only (category slug contains "atp")
            category = event.get("tournament", {}).get("category", {})
            cat_slug = category.get("slug", "").lower()
            if "atp" not in cat_slug:
                continue

            home = event.get("homeTeam", {}).get("name", "")
            away = event.get("awayTeam", {}).get("name", "")
            if not home or not away:
                continue

            tournament_name = event.get("tournament", {}).get("name", "ATP Tour")
            status      = event.get("status", {})
            status_type = status.get("type", "notstarted")   # notstarted | inprogress | finished
            status_desc = status.get("description", "Scheduled")

            # Build a readable score string from Sofascore's period-based tennis scoring
            score = _format_score(
                event.get("homeScore", {}),
                event.get("awayScore", {}),
                status_type,
            )

            matches.append({
                "id":          str(event.get("id", "")),
                "player_a":    home,
                "player_b":    away,
                "tournament":  tournament_name,
                "status":      status_desc,
                "status_type": status_type,
                "score":       score,
            })

        return {"matches": matches, "date": today_str}

    except Exception as e:
        return {"matches": [], "error": str(e)}

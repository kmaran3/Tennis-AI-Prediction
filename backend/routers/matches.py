from fastapi import APIRouter
import requests as http
from datetime import date

router = APIRouter()


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
            status_desc = event.get("status", {}).get("description", "Scheduled")
            completed = event.get("status", {}).get("type", "notstarted") == "finished"

            matches.append({
                "id":         str(event.get("id", "")),
                "player_a":   home,
                "player_b":   away,
                "tournament": tournament_name,
                "status":     status_desc,
                "completed":  completed,
            })

        return {"matches": matches, "date": today_str}

    except Exception as e:
        return {"matches": [], "error": str(e)}

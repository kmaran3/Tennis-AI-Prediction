from fastapi import APIRouter
import requests as http
import re
from datetime import date, timedelta
from concurrent.futures import ThreadPoolExecutor

router = APIRouter()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Referer": "https://www.sofascore.com/",
}

_SURFACE_MAP = {
    "red clay":        "Clay",
    "clay":            "Clay",
    "grass":           "Grass",
    "artificial grass": "Grass",
    "hard":            "Hard",
    "indoor hard":     "Hard",
    "hardcourt":       "Hard",
    "carpet":          "Hard",
}

def _normalize_surface(raw: str | None) -> str:
    if not raw:
        return "Hard"
    return _SURFACE_MAP.get(raw.lower(), "Hard")


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
    if status_type == "inprogress":
        hc = home.get("current")
        ac = away.get("current")
        if hc is not None and ac is not None:
            score += f" ({hc}-{ac})"
    return score


def _fetch_day_matches(args) -> dict:
    """Fetch all ATP matches for one day from Sofascore.
    args: (target_date, start_date) where start_date is the user's local today.
    """
    target_date, start_date = args
    date_str = target_date.strftime("%Y-%m-%d")
    url = f"https://api.sofascore.com/api/v1/sport/tennis/scheduled-events/{date_str}"

    days_ahead = (target_date - start_date).days
    if days_ahead == 0:
        label = "Today"
    elif days_ahead == 1:
        label = "Tomorrow"
    else:
        label = target_date.strftime("%a %b ") + str(target_date.day)

    try:
        r = http.get(url, headers=HEADERS, timeout=10)
        r.raise_for_status()
        data = r.json()

        matches = []
        for event in data.get("events", []):
            category = event.get("tournament", {}).get("category", {})
            if "atp" not in category.get("slug", "").lower():
                continue

            home = event.get("homeTeam", {}).get("name", "")
            away = event.get("awayTeam", {}).get("name", "")
            if not home or not away:
                continue

            tournament_name = event.get("tournament", {}).get("name", "ATP Tour")
            status      = event.get("status", {})
            status_type = status.get("type", "notstarted")
            status_desc = status.get("description", "Scheduled")

            raw_surface = (event.get("groundType") or
                           event.get("tournament", {}).get("uniqueTournament", {}).get("groundType"))
            surface = _normalize_surface(raw_surface)

            round_name = event.get("roundInfo", {}).get("name", "")

            score = _format_score(
                event.get("homeScore", {}),
                event.get("awayScore", {}),
                status_type,
            )

            matches.append({
                "id":            str(event.get("id", "")),
                "player_a":      home,
                "player_b":      away,
                "tournament":    tournament_name,
                "status":        status_desc,
                "status_type":   status_type,
                "score":         score,
                "surface":       surface,
                "round":         round_name,
                "start_timestamp": event.get("startTimestamp"),  # Unix seconds, timezone-safe
            })

        return {"date": date_str, "label": label, "matches": matches}

    except Exception as e:
        return {"date": date_str, "label": label, "matches": [], "error": str(e)}


def _flip_score(score: str) -> str:
    """Flip a 'H-A, H-A' score string to 'A-H, A-H'."""
    parts = [s.strip() for s in score.split(',')]
    flipped = []
    for s in parts:
        tb = re.search(r'\(([^)]+)\)', s)
        clean = re.sub(r'\s*\([^)]+\)', '', s).strip()
        nums = clean.split('-')
        if len(nums) == 2:
            fs = f"{nums[1]}-{nums[0]}"
            if tb:
                fs += f" ({tb.group(1)})"
            flipped.append(fs)
        else:
            flipped.append(s)
    return ', '.join(flipped)


def _winner_from_score(match: dict) -> str | None:
    """Derive winner from a finished match dict using set scores."""
    score = match.get('score')
    if not score:
        return None
    sets_str = re.sub(r'\([^)]+\)', '', score).strip()
    a_sets = b_sets = 0
    for s in sets_str.split(','):
        parts = s.strip().split('-')
        if len(parts) == 2:
            try:
                h, a = int(parts[0]), int(parts[1])
                if h > a: a_sets += 1
                elif a > h: b_sets += 1
            except ValueError:
                pass
    if a_sets > b_sets: return match['player_a']
    if b_sets > a_sets: return match['player_b']
    return None


@router.get("/result")
def get_match_result(player_a: str, player_b: str, after_date: str = None):
    """
    Look up the result of a specific match on Sofascore.
    Searches up to 14 days starting from after_date (the prediction date).
    Uses exact last-name matching to avoid false positives.
    Returns {winner, score, found}.
    """
    try:
        start = date.fromisoformat(after_date) if after_date else date.today() - timedelta(days=7)
    except ValueError:
        start = date.today() - timedelta(days=7)

    today = date.today()

    def last(name: str) -> str:
        parts = name.strip().split()
        return parts[-1].lower().rstrip('.') if parts else ''

    la, lb = last(player_a), last(player_b)

    for i in range(14):
        check_date = start + timedelta(days=i)
        if check_date > today:
            break
        day_result = _fetch_day_matches((check_date, check_date))
        for m in day_result.get('matches', []):
            if m['status_type'] != 'finished':
                continue
            ma, mb = last(m['player_a']), last(m['player_b'])
            # Exact last-name match only — avoids false positives from substring matches
            forward = (la == ma and lb == mb)
            reverse = (la == mb and lb == ma)
            if not (forward or reverse):
                continue
            winner_name = _winner_from_score(m)
            if winner_name is None:
                continue
            # Map winner back to the originally requested player names
            if forward:
                winner = player_a if winner_name == m['player_a'] else player_b
                score = m['score']
            else:
                winner = player_b if winner_name == m['player_a'] else player_a
                # Flip score so first number always corresponds to player_a from the request
                score = _flip_score(m['score']) if m['score'] else None
            return {'winner': winner, 'score': score, 'found': True}

    return {'winner': None, 'score': None, 'found': False}


def fetch_live_player_matches(player_name: str, days_back: int = 14) -> list[dict]:
    """
    Fetch completed Sofascore matches for a player over the past N days.
    Used to prepend live/current-tournament results to the historical CSV form.
    Matches by last name to handle Sofascore full-name vs CSV abbreviated format.
    Returns list sorted most-recent first, empty list on any error.
    """
    today = date.today()
    last_name = player_name.strip().split()[-1].lower().rstrip('.')

    dates = [today - timedelta(days=i) for i in range(days_back)]
    try:
        with ThreadPoolExecutor(max_workers=min(days_back, 7)) as executor:
            days_data = list(executor.map(_fetch_day_matches, [(d, today) for d in dates]))
    except Exception:
        return []

    results = []
    for day_data in days_data:
        day_date = day_data['date']
        for m in day_data.get('matches', []):
            if m['status_type'] != 'finished':
                continue
            la = m['player_a'].strip().split()[-1].lower()
            lb = m['player_b'].strip().split()[-1].lower()
            if last_name == la:
                won = _winner_from_score(m) == m['player_a']
                results.append({
                    'date': day_date, 'tournament': m['tournament'],
                    'surface': m['surface'], 'round': m['round'],
                    'opponent': m['player_b'], 'won': won,
                    'score': m['score'] or '', 'live': True,
                })
            elif last_name == lb:
                won = _winner_from_score(m) == m['player_b']
                results.append({
                    'date': day_date, 'tournament': m['tournament'],
                    'surface': m['surface'], 'round': m['round'],
                    'opponent': m['player_a'], 'won': won,
                    'score': m['score'] or '', 'live': True,
                })

    return sorted(results, key=lambda x: x['date'], reverse=True)


@router.get("/today")
def get_todays_matches():
    """Legacy single-day endpoint — returns today's matches."""
    today = date.today()
    result = _fetch_day_matches((today, today))
    return {"matches": result["matches"], "date": result["date"],
            "error": result.get("error")}


@router.get("/upcoming")
def get_upcoming_matches(days: int = 7, start_date: str = None):
    """
    Fetch ATP matches for the next N days in parallel.
    start_date (YYYY-MM-DD) should be the caller's local date so timezone
    differences between the server and the user don't shift the day labels.
    Returns {days: [{date, label, matches: [...]}]}
    """
    try:
        start = date.fromisoformat(start_date) if start_date else date.today()
    except ValueError:
        start = date.today()
    dates = [start + timedelta(days=i) for i in range(min(days, 14))]
    with ThreadPoolExecutor(max_workers=len(dates)) as executor:
        results = list(executor.map(_fetch_day_matches, [(d, start) for d in dates]))

    # Remove duplicates: keep each match ID only on the earliest day it appears
    seen_ids: set[str] = set()
    for day in results:
        unique = [m for m in day["matches"] if m["id"] not in seen_ids]
        seen_ids.update(m["id"] for m in unique)
        day["matches"] = unique

    return {"days": results}

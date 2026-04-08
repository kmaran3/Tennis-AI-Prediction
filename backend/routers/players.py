from fastapi import APIRouter, Query
from services.data_loader import get_all_player_names, find_player_names, resolve_player_name, _norm
from services.stats_engine import get_player_stats, get_h2h

router = APIRouter()


@router.get("/search")
def search_players(q: str = Query(..., min_length=2)):
    """
    Search for player names containing the query string (case-insensitive).
    Returns up to 20 matches.
    """
    all_names = get_all_player_names()
    q_norm = _norm(q)
    matches = [name for name in all_names if q_norm in _norm(name)]
    return {"results": matches[:20]}


@router.get("/{player_name}/stats")
def player_stats(player_name: str, surface: str = None):
    """
    Return aggregated stats for one player.
    Optionally filter by surface (Hard, Clay, Grass).
    Accepts full names (e.g. "Hubert Hurkacz") or dataset names ("Hurkacz H.").
    """
    return get_player_stats(resolve_player_name(player_name), surface)


@router.get("/h2h")
def head_to_head(a: str = Query(...), b: str = Query(...), surface: str = None):
    """Return head-to-head record between two players, optionally filtered by surface."""
    return get_h2h(a, b, surface)


@router.get("/{player_name}/recent-form")
def recent_form(player_name: str, n: int = 8):
    """Return the last N matches for a player, most recent first.
    Prepends live Sofascore results from the past 14 days before CSV history."""
    import pandas as pd
    from services.data_loader import load_data
    from routers.matches import fetch_live_player_matches

    # Live matches first (current tournament etc.)
    live = fetch_live_player_matches(player_name, days_back=14)

    names = find_player_names(player_name)
    df = load_data()
    mask = df['Player_1'].isin(names) | df['Player_2'].isin(names)
    csv_matches = df[mask].sort_values('Date', ascending=False)

    # Exclude CSV rows that overlap with live dates to avoid duplicates
    live_dates = {m['date'] for m in live}
    if live_dates:
        csv_matches = csv_matches[~csv_matches['Date'].dt.strftime('%Y-%m-%d').isin(live_dates)]

    csv_form = []
    for _, row in csv_matches.iterrows():
        won = row['Winner'] in names
        opponent = row['Player_2'] if row['Player_1'] in names else row['Player_1']
        csv_form.append({
            'date':       str(row['Date'])[:10],
            'tournament': str(row['Tournament']),
            'surface':    str(row['Surface']),
            'opponent':   opponent,
            'won':        bool(won),
            'score':      str(row['Score']) if pd.notna(row['Score']) else '',
            'round':      str(row['Round']) if pd.notna(row['Round']) else '',
            'live':       False,
        })

    form = (live + csv_form)[:n]
    return {'player': player_name, 'form': form}

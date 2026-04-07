from fastapi import APIRouter, Query
from services.data_loader import get_all_player_names, resolve_player_name
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
    Accepts full names (e.g. "Hubert Hurkacz") or dataset names ("Hurkacz H.").
    """
    return get_player_stats(resolve_player_name(player_name), surface)


@router.get("/{player_name}/recent-form")
def recent_form(player_name: str, n: int = 8):
    """Return the last N matches for a player, most recent first."""
    import pandas as pd
    from services.data_loader import load_data

    player_name = resolve_player_name(player_name)
    df = load_data()
    mask = (df['Player_1'] == player_name) | (df['Player_2'] == player_name)
    matches = df[mask].sort_values('Date', ascending=False).head(n)

    if matches.empty:
        return {'player': player_name, 'form': []}

    form = []
    for _, row in matches.iterrows():
        won = row['Winner'] == player_name
        opponent = row['Player_2'] if row['Player_1'] == player_name else row['Player_1']
        form.append({
            'date':       str(row['Date'])[:10],
            'tournament': str(row['Tournament']),
            'surface':    str(row['Surface']),
            'opponent':   opponent,
            'won':        bool(won),
            'score':      str(row['Score'])  if pd.notna(row['Score'])  else '',
            'round':      str(row['Round'])  if pd.notna(row['Round'])  else '',
        })

    return {'player': player_name, 'form': form}

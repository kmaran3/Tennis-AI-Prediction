from fastapi import APIRouter, Query
from services.data_loader import get_all_player_names
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
    """
    return get_player_stats(player_name, surface)

import pandas as pd
from services.data_loader import load_data, find_player_names


def get_player_matches(player_name: str, surface: str = None) -> pd.DataFrame:
    """
    Return all matches involving a player.
    Resolves the name to all dataset variants (e.g. "Etcheverry T." and
    "Etcheverry T. M.") so no match data is lost due to inconsistent
    abbreviation in the CSV.
    Optionally filter to a specific surface ("Hard", "Clay", "Grass").
    """
    df = load_data()
    names = find_player_names(player_name)
    mask = df['Player_1'].isin(names) | df['Player_2'].isin(names)
    result = df[mask].copy()
    if surface:
        result = result[result['Surface'] == surface]
    return result


def _count_wins(matches: pd.DataFrame, player_names: list[str]) -> int:
    """Count how many matches in a DataFrame were won by any of the player_names."""
    as_p1 = matches[matches['Player_1'].isin(player_names)]
    as_p2 = matches[matches['Player_2'].isin(player_names)]
    return len(as_p1[as_p1['player_1_won'] == 1]) + len(as_p2[as_p2['player_1_won'] == 0])


def get_player_stats(player_name: str, surface: str = None) -> dict:
    """
    Aggregate career stats for a player.
    Returns a dict consumed by both the frontend and LLM prompts.
    """
    names = find_player_names(player_name)
    matches = get_player_matches(player_name, surface)

    if matches.empty:
        return {"error": f"No matches found for '{player_name}'"}

    total = len(matches)
    wins = _count_wins(matches, names)

    # --- Win rate per surface ---
    surface_stats = {}
    for surf in ['Hard', 'Clay', 'Grass']:
        surf_matches = get_player_matches(player_name, surf)
        if surf_matches.empty:
            surface_stats[surf] = None
            continue
        s_wins = _count_wins(surf_matches, names)
        surface_stats[surf] = {
            "matches": len(surf_matches),
            "wins": s_wins,
            "win_rate": round(s_wins / len(surf_matches), 3)
        }

    # --- Win rate per tournament tier ---
    tier_stats = {}
    for tier in matches['Series'].dropna().unique():
        t = matches[matches['Series'] == tier]
        t_wins = _count_wins(t, names)
        tier_stats[str(tier)] = {
            "matches": len(t),
            "wins": t_wins,
            "win_rate": round(t_wins / len(t), 3)
        }

    # --- Win rate per round (to gauge deep-run ability) ---
    round_stats = {}
    for rnd in matches['Round'].dropna().unique():
        r = matches[matches['Round'] == rnd]
        r_wins = _count_wins(r, names)
        round_stats[str(rnd)] = {
            "matches": len(r),
            "wins": r_wins,
            "win_rate": round(r_wins / len(r), 3)
        }

    # --- Upset stats ---
    upset_wins   = len(matches[(matches['upset'] == 1) & matches['Winner'].isin(names)])
    upset_losses = len(matches[(matches['upset'] == 1) & ~matches['Winner'].isin(names)])

    # --- Current/average ranking from the dataset ---
    as_p1 = matches[matches['Player_1'].isin(names)]
    as_p2 = matches[matches['Player_2'].isin(names)]
    all_ranks = pd.concat([as_p1['Rank_1'], as_p2['Rank_2']]).dropna()

    return {
        "player_name": player_name,
        "matches_played": total,
        "wins": wins,
        "losses": total - wins,
        "win_rate": round(wins / total, 3),
        "surface_win_rates": surface_stats,
        "tier_win_rates": tier_stats,
        "round_win_rates": round_stats,
        "upset_wins": upset_wins,
        "upset_losses": upset_losses,
        "avg_rank": round(float(all_ranks.mean()), 1) if not all_ranks.empty else None,
        "current_rank": int(all_ranks.iloc[-1]) if not all_ranks.empty else None,
    }


def get_recent_form(player_name: str, n: int = 10) -> list[dict]:
    """Return the last N matches for a player, most recent first, for LLM context."""
    df = load_data()
    names = find_player_names(player_name)
    mask = df['Player_1'].isin(names) | df['Player_2'].isin(names)
    matches = df[mask].sort_values('Date', ascending=False).head(n)
    form = []
    for _, row in matches.iterrows():
        player_is_p1 = row['Player_1'] in names
        won = row['Winner'] in names
        opponent = row['Player_2'] if player_is_p1 else row['Player_1']
        opp_rank = row['Rank_2'] if player_is_p1 else row['Rank_1']
        series = str(row.get('Series', '')) if pd.notna(row.get('Series')) else ''
        form.append({
            'date':         str(row['Date'])[:10],
            'tournament':   str(row['Tournament']),
            'series':       series,
            'surface':      str(row['Surface']),
            'round':        str(row['Round']) if pd.notna(row['Round']) else '',
            'opponent':     opponent,
            'opp_rank':     int(opp_rank) if pd.notna(opp_rank) else None,
            'won':          won,
            'score':        str(row['Score']) if pd.notna(row['Score']) else '',
        })
    return form


def get_h2h(player_a: str, player_b: str, surface: str = None) -> dict:
    """Return head-to-head record and individual match details between two players."""
    df = load_data()
    names_a = find_player_names(player_a)
    names_b = find_player_names(player_b)
    mask = (
        (df['Player_1'].isin(names_a) & df['Player_2'].isin(names_b)) |
        (df['Player_1'].isin(names_b) & df['Player_2'].isin(names_a))
    )
    h2h = df[mask].copy()
    if surface:
        h2h = h2h[h2h['Surface'] == surface]

    if h2h.empty:
        return {
            "matches": 0,
            "player_a_wins": 0,
            "player_b_wins": 0,
            "player_a_win_rate": 0,
            "matches_detail": []
        }

    a_wins = len(h2h[h2h['Winner'].isin(names_a)])
    b_wins = len(h2h[h2h['Winner'].isin(names_b)])

    # Format each match as a dict for the LLM context and frontend display
    matches_detail = []
    for _, row in h2h.iterrows():
        winner_is_p1 = row['Winner'] == row['Player_1']
        market_prob_winner = row['implied_prob_1'] if winner_is_p1 else row['implied_prob_2']
        matches_detail.append({
            "date": str(row['Date'])[:10],
            "tournament": row['Tournament'],
            "surface": row['Surface'],
            "round": row['Round'],
            "winner": row['Winner'],
            "score": row['Score'],
            "implied_prob_winner": round(float(market_prob_winner), 3)
                if pd.notna(market_prob_winner) else None
        })

    # Sort most recent first
    matches_detail.sort(key=lambda x: x['date'], reverse=True)

    return {
        "matches": len(h2h),
        "player_a_wins": a_wins,
        "player_b_wins": b_wins,
        "player_a_win_rate": round(a_wins / len(h2h), 3),
        "matches_detail": matches_detail
    }

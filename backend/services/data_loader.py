import pandas as pd
from config import DATA_PATH

# Module-level cache — CSV is loaded once at startup and reused for all requests
_df = None


def load_data() -> pd.DataFrame:
    """
    Load and clean the ATP matches CSV. Returns the cleaned DataFrame.
    Uses a module-level cache so the CSV is only read from disk once.
    """
    global _df
    if _df is not None:
        return _df  # Return cached version if already loaded

    df = pd.read_csv(DATA_PATH, low_memory=False)

    # Parse the Date column into proper datetime objects
    df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
    df['year'] = df['Date'].dt.year.astype('Int64')  # Int64 handles NaN years

    # Remove rows missing the columns we always need
    df = df.dropna(subset=['Player_1', 'Player_2', 'Winner', 'Surface'])

    # Normalize player name whitespace (trim leading/trailing spaces)
    for col in ['Player_1', 'Player_2', 'Winner', 'Tournament', 'Surface']:
        df[col] = df[col].astype(str).str.strip()

    # Coerce odds columns to numeric — some rows have stray strings/blanks
    df['Odd_1'] = pd.to_numeric(df['Odd_1'], errors='coerce')
    df['Odd_2'] = pd.to_numeric(df['Odd_2'], errors='coerce')

    # --- Who won? 1 = Player_1 won, 0 = Player_2 won ---
    df['player_1_won'] = (df['Winner'] == df['Player_1']).astype(int)

    # --- Betting odds: implied probability ---
    # Decimal odds of 2.0 = 50% implied chance of winning
    df['implied_prob_raw_1'] = 1 / df['Odd_1']
    df['implied_prob_raw_2'] = 1 / df['Odd_2']
    total_prob = df['implied_prob_raw_1'] + df['implied_prob_raw_2']
    # Normalize to remove the bookmaker's margin (overround)
    # After normalization, prob_1 + prob_2 = exactly 1.0
    df['implied_prob_1'] = df['implied_prob_raw_1'] / total_prob
    df['implied_prob_2'] = df['implied_prob_raw_2'] / total_prob

    # --- Rank difference (positive = Player_1 is better ranked) ---
    df['rank_diff'] = df['Rank_2'] - df['Rank_1']

    # --- Upset: lower-ranked player (higher rank number) won ---
    df['upset'] = (
        ((df['player_1_won'] == 1) & (df['Rank_1'] > df['Rank_2'])) |
        ((df['player_1_won'] == 0) & (df['Rank_2'] > df['Rank_1']))
    ).astype(int)

    _df = df
    print(f"[DataLoader] Loaded {len(df)} matches | "
          f"Years: {df['year'].min()}–{df['year'].max()} | "
          f"Players: {df['Player_1'].nunique() + df['Player_2'].nunique()} appearances")
    return _df


def get_all_player_names() -> list[str]:
    """Return a deduplicated, sorted list of all player names in the dataset."""
    df = load_data()
    names = set(df['Player_1'].tolist()) | set(df['Player_2'].tolist())
    return sorted(names)


def resolve_player_name(query: str) -> str:
    """
    Map any player name format to the exact name used in the dataset.

    Handles:
      - Exact matches: "Federer R."  → "Federer R."
      - Full names:    "Roger Federer" → "Federer R."
      - Compound last names: "Roberto Bautista Agut" → "Bautista Agut R."
      - Already-abbreviated: "Hurkacz H." → "Hurkacz H."
    Returns the original query if no match is found.
    """
    all_names = get_all_player_names()

    # 1. Exact match
    if query in all_names:
        return query

    # 2. Case-insensitive exact match
    q_lower = query.strip().lower()
    for name in all_names:
        if name.lower() == q_lower:
            return name

    # 3. Try progressively shorter last-name prefixes (handles compound surnames)
    #    "Roberto Bautista Agut" → try "Bautista Agut", then "Agut"
    parts = query.strip().split()
    for start in range(1, len(parts)):
        last_part = ' '.join(parts[start:])
        candidates = [n for n in all_names if n.lower().startswith(last_part.lower() + ' ')
                      or n.lower() == last_part.lower()]
        if len(candidates) == 1:
            return candidates[0]
        # Multiple candidates — try to break the tie using the first initial
        if len(candidates) > 1 and parts:
            initial = parts[0][0].upper()
            refined = [c for c in candidates if c.split()[-1].rstrip('.').upper() == initial]
            if len(refined) == 1:
                return refined[0]

    # 4. Substring match on last name token only (e.g. "Hurkacz" → "Hurkacz H.")
    last_token = parts[-1].rstrip('.').lower() if parts else ''
    candidates = [n for n in all_names if n.lower().split()[0].rstrip('.') == last_token]
    if len(candidates) == 1:
        return candidates[0]

    return query  # fallback: return as-is

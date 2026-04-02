import chromadb
from chromadb.utils import embedding_functions
import pandas as pd
from config import CHROMA_PERSIST_DIR
from services.data_loader import load_data

# Singleton — ChromaDB collection is initialized once and reused
_collection = None


def get_collection():
    """Initialize and return the ChromaDB collection (created once, cached)."""
    global _collection
    if _collection is not None:
        return _collection

    client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)

    # all-MiniLM-L6-v2 is a fast, lightweight embedding model.
    # It runs locally on CPU — no API key or internet connection needed.
    # It produces 384-dimensional vectors, good enough for semantic search.
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    _collection = client.get_or_create_collection(
        name="atp_matches",
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"}  # Use cosine similarity for matching
    )
    return _collection


def _match_to_document(row) -> str:
    """
    Convert one DataFrame row into a natural language string.
    This string gets embedded into a vector and stored in ChromaDB.
    When a user queries "Djokovic vs Alcaraz on clay", the most semantically
    similar stored strings are retrieved and fed to the LLM as context.
    """
    winner = row['Winner']
    loser = row['Player_2'] if winner == row['Player_1'] else row['Player_1']
    winner_rank = row['Rank_1'] if winner == row['Player_1'] else row['Rank_2']
    loser_rank = row['Rank_2'] if winner == row['Player_1'] else row['Rank_1']
    market_prob = row['implied_prob_1'] if winner == row['Player_1'] else row['implied_prob_2']

    rank_w = f"{int(winner_rank)}" if pd.notna(winner_rank) else "unranked"
    rank_l = f"{int(loser_rank)}" if pd.notna(loser_rank) else "unranked"
    prob = f"{round(float(market_prob) * 100, 1)}%" if pd.notna(market_prob) else "N/A"
    year = int(row['year']) if pd.notna(row['year']) else "unknown year"

    return (
        f"{winner} (ranked {rank_w}) defeated {loser} (ranked {rank_l}) "
        f"at {row['Tournament']} {year} on {row['Surface']}. "
        f"Round: {row['Round']}. Score: {row['Score']}. "
        f"Market-implied win probability for {winner}: {prob}."
    )


def index_all_matches():
    """
    Index all matches into ChromaDB. Skips if already indexed.
    This runs at app startup. First run: several minutes for ~67k matches.
    Subsequent runs are instant (skipped via count check).
    """
    collection = get_collection()

    if collection.count() > 0:
        print(f"[RAG] ChromaDB already has {collection.count()} documents. Skipping indexing.")
        return

    df = load_data()
    total = len(df)
    print(f"[RAG] Indexing {total} matches into ChromaDB. First run only — please wait...")

    documents, ids, metadatas = [], [], []

    for i, (_, row) in enumerate(df.iterrows()):
        doc = _match_to_document(row)
        documents.append(doc)
        ids.append(f"match_{i}")
        metadatas.append({
            "player_1": str(row['Player_1']),
            "player_2": str(row['Player_2']),
            "winner": str(row['Winner']),
            "surface": str(row['Surface']),
            "year": int(row['year']) if pd.notna(row['year']) else 0,
            "tournament": str(row['Tournament'])
        })

        # Upsert in batches of 500 to avoid memory issues
        if len(documents) == 500 or i == total - 1:
            collection.upsert(documents=documents, ids=ids, metadatas=metadatas)
            print(f"[RAG] Progress: {min(i + 1, total)}/{total} matches indexed...")
            documents, ids, metadatas = [], [], []

    print(f"[RAG] Indexing complete. Total: {collection.count()} documents.")


def retrieve_context(player_a: str, player_b: str, surface: str, n_results: int = 12) -> str:
    """
    Retrieve the most relevant past matches for the given matchup.
    Uses semantic similarity — returns matches involving either player on the given surface.
    Returns a single formatted string ready to paste into an LLM prompt.
    """
    collection = get_collection()

    query = f"{player_a} vs {player_b} on {surface}"

    try:
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where={
                "$or": [
                    {"player_1": player_a},
                    {"player_2": player_a},
                    {"player_1": player_b},
                    {"player_2": player_b},
                ]
            }
        )
    except Exception:
        # ChromaDB where-filter fails if collection is empty or filter finds nothing
        # Fall back to unfiltered semantic search
        results = collection.query(query_texts=[query], n_results=n_results)

    if not results['documents'] or not results['documents'][0]:
        return "No relevant match history found in dataset."

    return "\n".join(results['documents'][0])

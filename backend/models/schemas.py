from pydantic import BaseModel
from typing import Literal, Optional


class H2HRequest(BaseModel):
    player_a: str
    player_b: str
    surface: Literal["Hard", "Clay", "Grass"]
    best_of: Literal[3, 5] = 3
    accuracy_context: Optional[dict] = None  # Historical accuracy stats for self-calibration


class TournamentRequest(BaseModel):
    draw: list[str]            # Player names in bracket order (must be power of 2: 4, 8, 16, 32)
    surface: Literal["Hard", "Clay", "Grass"]
    best_of: Literal[3, 5] = 3
    mock: bool = False         # If True, return random results (saves API costs during dev)


class ParseDrawRequest(BaseModel):
    text: Optional[str] = None          # Pasted draw text (from ATP website, etc.)
    image_base64: Optional[str] = None  # Base64-encoded image of the draw
    media_type: Optional[str] = "image/png"  # MIME type of the image


class FetchDrawRequest(BaseModel):
    tournament_name: str  # e.g. "Monte-Carlo Masters 2024", "Wimbledon 2024"

from pydantic import BaseModel
from typing import Literal, Optional


class H2HRequest(BaseModel):
    player_a: str
    player_b: str
    surface: Literal["Hard", "Clay", "Grass"]
    best_of: Literal[3, 5] = 3


class TournamentRequest(BaseModel):
    draw: list[str]            # Player names in bracket order (must be power of 2: 4, 8, 16, 32)
    surface: Literal["Hard", "Clay", "Grass"]
    best_of: Literal[3, 5] = 3
    mock: bool = False         # If True, return random results (saves API costs during dev)

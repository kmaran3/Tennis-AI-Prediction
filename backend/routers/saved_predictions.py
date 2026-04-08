import json
import os
import tempfile
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from routers.auth import _decode_token

router = APIRouter()

PREDICTIONS_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "predictions.json")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_all() -> dict:
    if not os.path.exists(PREDICTIONS_FILE):
        return {}
    with open(PREDICTIONS_FILE, "r") as f:
        return json.load(f)


def _save_all(data: dict) -> None:
    dir_ = os.path.dirname(PREDICTIONS_FILE)
    os.makedirs(dir_, exist_ok=True)
    # Write to a temp file then atomically rename to prevent corruption on concurrent writes
    fd, tmp = tempfile.mkstemp(dir=dir_, suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, PREDICTIONS_FILE)
    except Exception:
        os.unlink(tmp)
        raise


def _email_from_header(authorization: str) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    return _decode_token(authorization.removeprefix("Bearer "))


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SavePredictionRequest(BaseModel):
    id: int
    date: str
    player_a: str
    player_b: str
    surface: str
    best_of: int
    tournament: Optional[str] = None
    round: Optional[str] = None
    predicted_winner: str
    predicted_score: Optional[str] = None
    win_probability: Optional[float] = None
    actual_winner: Optional[str] = None
    prediction: Optional[Any] = None
    statsA: Optional[Any] = None
    statsB: Optional[Any] = None


class UpdatePredictionRequest(BaseModel):
    actual_winner: Optional[str] = None
    actual_score: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
def get_predictions(authorization: str = Header(...)):
    email = _email_from_header(authorization)
    return _load_all().get(email, [])


@router.post("")
def save_prediction(body: SavePredictionRequest, authorization: str = Header(...)):
    email = _email_from_header(authorization)

    data = _load_all()
    predictions = data.get(email, [])

    # Ignore duplicate saves
    if any(p["id"] == body.id for p in predictions):
        return {"ok": True}

    # Prepend newest, cap at 100
    data[email] = [body.model_dump(), *predictions][:100]
    _save_all(data)
    return {"ok": True}


@router.put("/{prediction_id}")
def update_prediction(
    prediction_id: int,
    body: UpdatePredictionRequest,
    authorization: str = Header(...),
):
    email = _email_from_header(authorization)

    data = _load_all()
    predictions = data.get(email, [])

    updated = False
    for p in predictions:
        if p["id"] == prediction_id:
            changes = body.model_dump(exclude_none=True)
            p.update(changes)
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Prediction not found")

    data[email] = predictions
    _save_all(data)
    return {"ok": True}


@router.delete("/{prediction_id}")
def delete_prediction(prediction_id: int, authorization: str = Header(...)):
    email = _email_from_header(authorization)

    data = _load_all()
    data[email] = [p for p in data.get(email, []) if p["id"] != prediction_id]
    _save_all(data)
    return {"ok": True}


@router.delete("")
def clear_predictions(authorization: str = Header(...)):
    email = _email_from_header(authorization)

    data = _load_all()
    data[email] = []
    _save_all(data)
    return {"ok": True}

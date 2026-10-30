"""Hosted ADMET-AI prediction service.

The model is loaded once at startup and reused for every request.
This process does not invent, simulate, or hardcode prediction values.
"""
from __future__ import annotations

import asyncio
import logging
import math
import os
import secrets
import threading
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

log = logging.getLogger("admet")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

PROVIDER = "ADMET-AI"
MODEL_NAME = "Chemprop models trained on Therapeutics Data Commons ADMET datasets"

state: dict[str, Any] = {"model": None, "version": None, "ready": False, "error": None}
model_ready = threading.Event()
predict_lock = threading.Lock()


class CompoundIn(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    smiles: str = Field(min_length=1, max_length=5000)


class PredictIn(BaseModel):
    compounds: list[CompoundIn] = Field(min_length=1, max_length=24)


def load_model() -> None:
    try:
        import importlib.metadata as metadata
        from admet_ai import ADMETModel

        state["version"] = metadata.version("admet_ai")
        log.info("ADMET-AI package version %s; loading model", state["version"])
        state["model"] = ADMETModel()
        state["ready"] = True
        log.info("ADMET-AI model ready")
    except Exception:
        log.exception("ADMET-AI model failed to load")
        state["error"] = "engine_unavailable"
    finally:
        model_ready.set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    threading.Thread(target=load_model, name="admet-model", daemon=True).start()
    yield


app = FastAPI(title="NANOTOPHEA ADMET-AI", lifespan=lifespan)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={"ok": False, "error": "assessment_failed", "message": "The prediction request was not valid."},
        )
    if isinstance(exc, HTTPException):
        detail = exc.detail if isinstance(exc.detail, dict) else {"ok": False, "error": "assessment_failed"}
        return JSONResponse(status_code=exc.status_code, content=detail)
    log.exception("request failed")
    return JSONResponse(status_code=500, content={"ok": False, "error": "assessment_failed"})


def authorized(request: Request) -> bool:
    expected = os.environ.get("ADMET_API_KEY", "").strip()
    if not expected:
        return True
    header = request.headers.get("authorization", "")
    token = header[7:].strip() if header.lower().startswith("bearer ") else ""
    return secrets.compare_digest(token, expected)


def require_auth(request: Request) -> None:
    if not authorized(request):
        raise HTTPException(
            status_code=401,
            detail={"ok": False, "error": "assessment_failed", "message": "The ADME prediction service rejected the request."},
        )


@app.get("/")
@app.get("/json/version")
def root() -> JSONResponse:
    # Local tools probe a new port with GET / and Chrome's /json/version.
    # This process is the ADME service, not a browser debugger.
    return health()


@app.get("/health")
def health() -> JSONResponse:
    if state["error"] and not state["ready"]:
        return JSONResponse(
            status_code=503,
            content={
                "ok": False,
                "ready": False,
                "provider": PROVIDER,
                "model": MODEL_NAME,
                "error": "engine_unavailable",
            },
        )
    ready = bool(state["ready"] and state["model"] is not None)
    return JSONResponse(
        content={
            "ok": ready,
            "ready": ready,
            "status": "ready" if ready else "loading",
            "provider": PROVIDER,
            "version": state["version"],
            "model": MODEL_NAME,
        }
    )


@app.post("/predict")
async def predict(body: PredictIn, request: Request) -> dict[str, Any]:
    require_auth(request)
    if state["error"] and not state["ready"]:
        raise HTTPException(
            status_code=503,
            detail={"ok": False, "error": "engine_unavailable", "message": "The ADME prediction engine is not available."},
        )
    loaded = await asyncio.to_thread(wait_for_model)
    if not loaded:
        raise HTTPException(
            status_code=503,
            detail={
                "ok": False,
                "error": "engine_unavailable",
                "message": "The ADME model is still loading. Keep this page open and retry the assessment.",
            },
        )
    log.info("predicting %s compound(s)", len(body.compounds))
    results = await asyncio.to_thread(predict_compounds, body.compounds)
    return {
        "ok": True,
        "provider": PROVIDER,
        "providerVersion": state["version"],
        "model": MODEL_NAME,
        "cached": False,
        "results": results,
    }


def wait_for_model() -> bool:
    if state["ready"] and state["model"] is not None:
        return True
    if not model_ready.wait(timeout=200):
        return False
    return bool(state["ready"] and state["model"] is not None)


def predict_compounds(compounds: list[CompoundIn]) -> list[dict[str, Any]]:
    model = state["model"]
    results: list[dict[str, Any]] = []
    with predict_lock:
        for compound in compounds:
            smiles = normalize_smiles(compound.smiles)
            if not smiles:
                results.append({"id": compound.id, "ok": False})
                continue
            try:
                values = flatten(model.predict(smiles=smiles))
            except Exception:
                log.exception("prediction failed for %s", compound.id)
                results.append({"id": compound.id, "ok": False})
                continue
            if not values:
                results.append({"id": compound.id, "ok": False})
                continue
            results.append({"id": compound.id, "ok": True, "values": values})
    return results


def normalize_smiles(value: str) -> str:
    return "".join(value.split())


def flatten(preds: Any) -> dict[str, float]:
    if hasattr(preds, "to_dict"):
        data = preds.to_dict()
    elif isinstance(preds, dict):
        data = preds
    else:
        return {}
    flat: dict[str, float] = {}
    for key, value in data.items():
        if isinstance(value, dict):
            if len(value) != 1:
                continue
            value = next(iter(value.values()))
        number = as_float(value)
        if number is None:
            continue
        flat[str(key)] = number
    return flat


def as_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    number = None
    if isinstance(value, (int, float)):
        number = float(value)
    elif hasattr(value, "item"):
        try:
            number = float(value.item())
        except Exception:
            return None
    elif isinstance(value, str):
        try:
            number = float(value)
        except ValueError:
            return None
    if number is None or not math.isfinite(number):
        return None
    return number

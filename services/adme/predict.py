"""Local ADMET-AI script.

Production assessments do not run this file. The Next.js server calls the
hosted FastAPI service in services/admet-api. This script remains only for
a manual local check and still loads a new model on every invocation.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path


def main() -> int:
    work = Path(sys.argv[1])
    raw = (work / "request.json").read_text(encoding="utf-8-sig")
    request = json.loads(raw)
    compounds = request.get("compounds") or []
    try:
        import importlib.metadata as metadata
        from admet_ai import ADMETModel
    except Exception:
        write(work, {"ok": False, "error": "engine_unavailable"})
        return 0
    try:
        version = metadata.version("admet_ai")
        model = ADMETModel()
    except Exception:
        write(work, {"ok": False, "error": "engine_unavailable"})
        return 0
    results = []
    for compound in compounds:
        smiles = str(compound.get("smiles") or "").strip()
        identifier = str(compound.get("id") or "")
        if not smiles or not identifier:
            results.append({"id": identifier, "ok": False})
            continue
        try:
            values = flatten(model.predict(smiles=smiles))
        except Exception:
            results.append({"id": identifier, "ok": False})
            continue
        if not values:
            results.append({"id": identifier, "ok": False})
            continue
        results.append({"id": identifier, "ok": True, "values": values})
    write(work, {"ok": True, "provider": "ADMET-AI", "providerVersion": version, "results": results})
    return 0


def flatten(preds) -> dict:
    if hasattr(preds, "to_dict"):
        data = preds.to_dict()
    elif isinstance(preds, dict):
        data = preds
    else:
        return {}
    flat = {}
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


def as_float(value):
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


def write(work: Path, payload: dict) -> None:
    (work / "result.json").write_text(json.dumps(payload), encoding="utf-8")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception:
        import traceback
        traceback.print_exc()
        if len(sys.argv) > 1:
            try:
                write(Path(sys.argv[1]), {"ok": False, "error": "assessment_failed"})
            except Exception:
                pass
        raise SystemExit(1)

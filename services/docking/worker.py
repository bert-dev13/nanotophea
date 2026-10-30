"""Server-side AutoDock Vina worker.

Reads a job directory prepared by the Node docking service.
Writes result.json. Does not invent affinities.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def fail(message: str, code: int = 1, detail: str | None = None) -> None:
    payload: dict[str, object] = {"ok": False, "error": message}
    if detail:
        payload["detail"] = detail[-12000:]
    out = Path(sys.argv[1]) / "result.json" if len(sys.argv) > 1 else None
    if out:
        out.write_text(json.dumps(payload), encoding="utf-8")
    print(json.dumps(payload))
    raise SystemExit(code)


def which(name: str) -> str | None:
    return shutil.which(name)


def run(cmd: list[str], cwd: Path, timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=cwd,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )


def command_detail(result: subprocess.CompletedProcess[str]) -> str:
    return ((result.stdout or "") + "\n" + (result.stderr or "")).strip()


def tool(*names: str) -> str | None:
    scripts = Path(sys.executable).resolve().parent
    for name in names:
        found = shutil.which(name)
        if found:
            return found
        candidate = scripts / name
        if candidate.exists():
            return str(candidate)
    return None


def prepare_ligand(work: Path, timeout: int) -> str:
    meeko = tool("mk_prepare_ligand.py", "mk_prepare_ligand.exe")
    obabel = tool("obabel", "obabel.exe")
    if meeko:
        result = run([meeko, "-i", "ligand.sdf", "-o", "ligand.pdbqt"], work, timeout)
        tool_name = meeko
    elif obabel:
        result = run([obabel, "ligand.sdf", "-O", "ligand.pdbqt", "-h"], work, timeout)
        tool_name = "Open Babel"
    else:
        fail("ligand preparation failure")
        return ""
    if result.returncode != 0 or not (work / "ligand.pdbqt").exists():
        fail("ligand preparation failure", detail=command_detail(result))
    return tool_name


def prepare_receptor(work: Path, timeout: int) -> str:
    meeko = tool("mk_prepare_receptor.py", "mk_prepare_receptor.exe")
    obabel = tool("obabel", "obabel.exe")
    if meeko:
        result = run(
            [meeko, "--read_pdb", "receptor.pdb", "-o", "receptor", "-p", "receptor.pdbqt", "--default_altloc", "A", "-x"],
            work,
            timeout,
        )
        tool_name = meeko
    elif obabel:
        result = run([obabel, "receptor.pdb", "-O", "receptor.pdbqt", "-xr"], work, timeout)
        tool_name = "Open Babel"
    else:
        fail("receptor preparation failure")
        return ""
    if result.returncode != 0 or not (work / "receptor.pdbqt").exists():
        fail("receptor preparation failure", detail=command_detail(result))
    return tool_name


def main() -> None:
    if len(sys.argv) < 2:
        fail("Vina execution failure")
    work = Path(sys.argv[1])
    job_path = work / "job.json"
    if not job_path.exists():
        fail("Vina execution failure")
    job = json.loads(job_path.read_text(encoding="utf-8"))
    timeout = int(job.get("timeoutSeconds") or 900)
    vina = os.environ.get("VINA_BIN") or which("vina") or which("vina.exe")
    if not vina and Path("C:/projects/nanotophea/tools/vina/vina.exe").exists():
        vina = "C:/projects/nanotophea/tools/vina/vina.exe"
    if not vina:
        fail("Docking engine unavailable")

    config = job["configuration"]
    conf = "\n".join(
        [
            "receptor = receptor.pdbqt",
            "ligand = ligand.pdbqt",
            f"center_x = {config['centerX']}",
            f"center_y = {config['centerY']}",
            f"center_z = {config['centerZ']}",
            f"size_x = {config['sizeX']}",
            f"size_y = {config['sizeY']}",
            f"size_z = {config['sizeZ']}",
            f"exhaustiveness = {config['exhaustiveness']}",
            f"num_modes = {config['numModes']}",
            f"energy_range = {config['energyRange']}",
            "out = poses.pdbqt",
            "",
        ]
    )
    (work / "vina.txt").write_text(conf, encoding="utf-8")
    (work / "stage.txt").write_text("Preparing ligand", encoding="utf-8")
    ligand_tool = prepare_ligand(work, timeout)
    (work / "stage.txt").write_text("Preparing receptor", encoding="utf-8")
    receptor_tool = prepare_receptor(work, timeout)
    (work / "stage.txt").write_text("Running AutoDock Vina", encoding="utf-8")
    try:
        result = run([vina, "--config", "vina.txt"], work, timeout)
    except subprocess.TimeoutExpired:
        fail("timeout")
        return
    log = (result.stdout or "") + ("\n" + result.stderr if result.stderr else "")
    (work / "vina.log").write_text(log, encoding="utf-8")
    if result.returncode != 0:
        fail("Vina execution failure", detail=log)
    version = run([vina, "--version"], work, 30)
    vina_version = (version.stdout or version.stderr or "").strip().splitlines()
    payload = {
        "ok": True,
        "ligandTool": ligand_tool,
        "receptorTool": receptor_tool,
        "vinaVersion": vina_version[0] if vina_version else None,
    }
    (work / "result.json").write_text(json.dumps(payload), encoding="utf-8")
    print(json.dumps(payload))


if __name__ == "__main__":
    main()

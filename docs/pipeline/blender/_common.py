"""Shared helpers for headless Blender stage scripts.

Kept deliberately dependency-light. Import from stage scripts via a sys.path insert
of this directory, or copy inline in a real build. All functions are pure w.r.t. their
inputs and avoid wall-clock / RNG unless a seed is supplied.
"""
import argparse
import hashlib
import json
import os
import sys


def parse_stage_args(argv=None):
    """Parse args after the Blender '--' separator."""
    argv = argv if argv is not None else sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="in_path", required=True)
    p.add_argument("--out", dest="out_path", required=True)
    p.add_argument("--config", dest="config", required=True, help="DNA json")
    p.add_argument("--thresholds", dest="thresholds", default=None)
    p.add_argument("--seed", dest="seed", type=int, default=0)
    p.add_argument("--report", dest="report", required=True)
    # stage-specific extras are collected and ignored here
    known, _ = p.parse_known_args(argv)
    return known


def load_json(path):
    with open(path, "r") as f:
        return json.load(f)


def file_hash(path):
    if not path or not os.path.exists(path):
        return None
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def config_hash(obj):
    return hashlib.sha256(json.dumps(obj, sort_keys=True).encode()).hexdigest()


class Receipt:
    """Accumulates checks and writes a stage receipt matching qa-report.schema.json."""

    def __init__(self, stage, args, config):
        self.stage = stage
        self.args = args
        self.config = config
        self.checks = []
        self.messages = []
        self.status = "ok"

    def check(self, category, name, value, threshold, passed, hard_fail=False):
        self.checks.append({
            "category": category, "name": name, "value": value,
            "threshold": threshold, "pass": bool(passed), "hard_fail": bool(hard_fail),
        })
        if not passed and hard_fail:
            self.status = "hard_fail"
        return passed

    def note(self, msg):
        self.messages.append(msg)

    def any_hard_fail(self):
        return any(c["hard_fail"] and not c["pass"] for c in self.checks)

    def write(self, out_path):
        report = {
            "stage": self.stage,
            "status": self.status,
            "input_hash": file_hash(self.args.in_path),
            "output_hash": file_hash(out_path) if os.path.exists(out_path) else None,
            "config_hash": config_hash(self.config),
            "seed": self.args.seed,
            "cache_hit": False,
            "checks": self.checks,
            "messages": self.messages,
        }
        with open(self.args.report, "w") as f:
            json.dump(report, f, indent=2)
        return report


def sorted_objects(objects, key=lambda o: o.name):
    """Deterministic iteration order over a Blender collection."""
    return sorted(objects, key=key)

# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Flames of Shiva contributors
"""Authenticated, bounded chart API. Each job runs in a new process."""
import asyncio
import json
import os
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse
from pydantic import BaseModel, ConfigDict, Field, model_validator

PLANETS = {"Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"}

class Birth(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    name: str = Field(min_length=1, max_length=120)
    gender: Literal["male", "female", "other"] = "other"
    year: int = Field(ge=1600, le=2100)
    month: int = Field(ge=1, le=12)
    day: int = Field(ge=1, le=31)
    hour: int = Field(ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)
    second: int = Field(default=0, ge=0, le=59)
    place: str = Field(min_length=1, max_length=300)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    timezone: float = Field(ge=-14, le=14)
    timezone_name: str | None = Field(default=None, max_length=100)
    include_sookshma: bool = False
    dasha_path: list[str] | None = Field(default=None, min_length=3, max_length=3)

    @model_validator(mode="after")
    def valid_birth(self):
        local = datetime(self.year, self.month, self.day, self.hour, self.minute, self.second)
        offset = timedelta(hours=self.timezone)
        instant = local.replace(tzinfo=timezone(offset))
        if instant > datetime.now(timezone.utc):
            raise ValueError("Birth date cannot be in the future")
        if not self.name.strip() or not self.place.strip():
            raise ValueError("Name and birthplace are required")
        if self.dasha_path and (not self.include_sookshma or any(p not in PLANETS for p in self.dasha_path)):
            raise ValueError("A fine-period request needs three valid parent planets")
        if self.timezone_name and self.timezone_name.startswith("UTC"):
            import re
            match = re.fullmatch(r"UTC(?:([+-])(\d{1,2})(?::(\d{2}))?)?", self.timezone_name)
            if not match:
                raise ValueError("Use UTC or an explicit offset such as UTC+05:30")
            expected = ((int(match[2] or 0) * 60 + int(match[3] or 0)) / 60) * (-1 if match[1] == "-" else 1)
            if (match[3] and int(match[3]) > 59) or abs(expected) > 14 or abs(expected - self.timezone) > 1 / 3600:
                raise ValueError("Explicit timezone does not match the supplied UTC offset")
        elif self.timezone_name:
            try:
                zone = ZoneInfo(self.timezone_name)
            except ZoneInfoNotFoundError:
                raise ValueError("Unknown IANA timezone")
            candidates = [local.replace(tzinfo=zone, fold=fold) for fold in (0, 1)]
            good = [d for d in candidates if d.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) == local]
            if not good:
                raise ValueError("Nonexistent local time during a daylight saving transition")
            if len({d.utcoffset() for d in good}) > 1:
                raise ValueError("Ambiguous local time; use an explicit UTC offset")
            if abs((good[0].utcoffset() - offset).total_seconds()) > 1:
                raise ValueError("UTC offset does not match this historical timezone")
        return self

app = FastAPI(title="Flames of Shiva Chart API", docs_url=None, redoc_url=None, openapi_url=None)
origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
if "*" in origins:
    raise RuntimeError("CORS_ORIGINS must list explicit website origins")
if origins:
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["POST", "GET"], allow_headers=["Content-Type", "x-api-key"])
semaphore = asyncio.Semaphore(max(1, min(4, int(os.environ.get("CHART_MAX_JOBS", "2")))))

@app.middleware("http")
async def safe_requests(request, call_next):
    if request.method == "POST":
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 8192:
                from fastapi.responses import JSONResponse
                return JSONResponse({"detail":"Request too large"}, status_code=413)
        request._body = bytes(body)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Link"] = '</source>; rel="source", </license>; rel="license"'
    return response

@app.get("/", response_class=HTMLResponse)
@app.get("/source", response_class=HTMLResponse)
def source_offer():
    return """<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flames of Shiva chart service source</title><h1>Chart service source code</h1><p>Release kundli-agpl-v1. Original application and integration: GNU AGPL version 3; no warranty. Upstream notices remain in effect.</p><p><a href="https://github.com/workmeridiangray-ops/fos/tree/kundli-agpl-v1">Browse complete corresponding source</a></p><p><a href="https://github.com/workmeridiangray-ops/fos/archive/refs/tags/kundli-agpl-v1.tar.gz">Download source archive</a></p><p><a href="/license">AGPLv3 licence</a> · <a href="https://github.com/workmeridiangray-ops/fos/blob/kundli-agpl-v1/THIRD_PARTY_NOTICES.md">Dependency source and notices</a></p></html>"""

@app.get("/license", response_class=PlainTextResponse)
def license_text():
    return Path(__file__).with_name("LICENSE").read_text()

@app.get("/health")
def health():
    return {"ok": True, "engine": "JyotishYamitra", "isolation": "fresh-process-per-job", "source": "/source", "release": "kundli-agpl-v1"}

@app.post("/chart")
async def chart(birth: Birth, x_api_key: str | None = Header(default=None)):
    key = os.environ.get("CHART_API_KEY", "")
    if not key:
        raise HTTPException(503, "Chart API key is not configured")
    if not x_api_key or not secrets.compare_digest(x_api_key, key):
        raise HTTPException(401, "Invalid API key")
    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=2)
    except TimeoutError:
        raise HTTPException(429, "Calculation capacity is busy; retry shortly")
    process = None
    try:
        process = await asyncio.create_subprocess_exec(
            sys.executable, str(Path(__file__).with_name("engine_job.py")),
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, _ = await asyncio.wait_for(process.communicate(json.dumps(birth.model_dump()).encode()), timeout=45)
        except (TimeoutError, asyncio.CancelledError):
            if process.returncode is None:
                process.kill()
            await process.wait()
            raise HTTPException(504, "Calculation timed out; retry later")
        if process.returncode or not stdout or len(stdout) > 8_000_000:
            raise HTTPException(502, "Chart calculation failed for these details; verify the coordinates and ephemeris configuration")
        return json.loads(stdout)
    finally:
        if process and process.returncode is None:
            process.kill()
            await process.wait()
        semaphore.release()

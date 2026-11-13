# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (c) 2026 Flames of Shiva contributors
"""One stdin request, one calculation, then exit. Never accepts filenames."""
import contextlib
import io
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "vendor"))

def calculate(b):
    import swisseph as swe
    import jyotishyamitra as engine
    ephe_path = os.environ.get("EPHE_PATH", "")
    swe.set_ephe_path(ephe_path)
    birth = datetime(b["year"], b["month"], b["day"], b["hour"], b["minute"], b["second"], tzinfo=timezone(timedelta(hours=b["timezone"])))
    utc = birth.astimezone(timezone.utc)
    jd = swe.julday(utc.year, utc.month, utc.day, utc.hour + utc.minute/60 + utc.second/3600)
    _, flags = swe.calc_ut(jd, swe.SUN, swe.FLG_SWIEPH)
    ephemeris = "Swiss Ephemeris files" if flags & swe.FLG_SWIEPH else "Moshier analytical ephemeris"
    if os.environ.get("REQUIRE_SWISS_EPHEMERIS", "false").lower() == "true" and not flags & swe.FLG_SWIEPH:
        raise RuntimeError("Swiss Ephemeris files are required")
    engine.clear_birthdata()
    engine.input_birthdata(name=b["name"], gender=b["gender"], year=str(b["year"]), month=str(b["month"]), day=str(b["day"]), hour=str(b["hour"]), min=str(b["minute"]), sec=str(b["second"]), place=b["place"], longitude=f'{b["longitude"]:+.12g}', lattitude=f'{b["latitude"]:+.12g}', timezone=f'{b["timezone"]:+.12g}')
    if engine.validate_birthdata() != "SUCCESS":
        raise ValueError("Birth validation failed")
    with contextlib.redirect_stdout(io.StringIO()):
        result = engine.generate_astrologicalData(engine.get_birthdata(), returnval="ASTRODATA_DICTIONARY", include_sookshma=b["include_sookshma"], dasha_path=b.get("dasha_path"))
    if not isinstance(result, dict) or not result.get("D1"):
        raise RuntimeError("Engine returned an incomplete chart")
    if not b["include_sookshma"]:
        result["Dashas"]["Vimshottari"].pop("sookshmadashas", None)
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    result["calculation_settings"] = {
        "engine":"JyotishYamitra supplied engine, isolated integration revision 1",
        "swisseph_version":swe.version, "ephemeris":ephemeris,
        "ayanamsa":"Lahiri (SIDM_LAHIRI)", "ayanamsa_degrees":swe.get_ayanamsa_ut(jd),
        "utc":utc.isoformat(), "utc_offset_hours":b["timezone"],
        "timezone":b.get("timezone_name") or str(b["timezone"]),
        "zodiac":"Sidereal", "houses":"Whole-sign houses; divisional houses start from each division's ascendant",
        "nodes":"Mean lunar node (Rahu); Ketu exactly opposite",
        "period_dates":"Engine calendar periods interpreted with the fixed UTC offset at birth",
        "include_sookshma":b["include_sookshma"], "fine_period_path":b.get("dasha_path"),
        "accuracy":"Engine calculations have not been independently certified; the reference fixture is a rendering regression only",
    }
    return result

if __name__ == "__main__":
    try:
        request = json.loads(sys.stdin.buffer.read(8192))
        print(json.dumps(calculate(request), allow_nan=False, separators=(",", ":")))
    except Exception:
        # No input, chart, person name, output path or provider secret in logs.
        sys.stderr.write("Chart calculation failed\n")
        sys.exit(1)

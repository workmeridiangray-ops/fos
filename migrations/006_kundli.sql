CREATE TABLE kundli_runs (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL, profile_id TEXT, input TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','ready','error')), chart TEXT, error TEXT,
 created TEXT NOT NULL, updated TEXT NOT NULL, UNIQUE(owner,request_key)
);
CREATE INDEX kundli_runs_owner ON kundli_runs(owner,created DESC);
CREATE TABLE kundli_dasha_cache (
 run_id TEXT NOT NULL REFERENCES kundli_runs(id) ON DELETE CASCADE,
 path TEXT NOT NULL, periods TEXT NOT NULL, PRIMARY KEY(run_id,path)
);

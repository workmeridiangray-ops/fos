CREATE TABLE write_revision(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL DEFAULT 0);
INSERT INTO write_revision(id,version) VALUES(1,0);
CREATE TABLE write_guards(id TEXT PRIMARY KEY,expected INTEGER NOT NULL,actual INTEGER NOT NULL,CONSTRAINT snapshot_changed CHECK(expected=actual));

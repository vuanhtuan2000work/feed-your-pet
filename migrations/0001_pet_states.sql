CREATE TABLE IF NOT EXISTS pet_states (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  device_id TEXT NOT NULL,
  pet_type TEXT NOT NULL DEFAULT 'cat',
  pet_name TEXT,

  mood TEXT NOT NULL DEFAULT 'happy',
  state TEXT NOT NULL DEFAULT 'idle',

  hunger INTEGER NOT NULL DEFAULT 80,
  happiness INTEGER NOT NULL DEFAULT 80,
  energy INTEGER NOT NULL DEFAULT 80,
  affection INTEGER NOT NULL DEFAULT 50,
  dream_power INTEGER NOT NULL DEFAULT 0,

  last_care_at TEXT NOT NULL,
  last_fed_at TEXT,
  last_pet_at TEXT,
  last_opened_at TEXT NOT NULL,

  position_x REAL DEFAULT 0,
  position_y REAL DEFAULT 0,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pet_states_user_id ON pet_states(user_id);
CREATE INDEX IF NOT EXISTS idx_pet_states_device_id ON pet_states(device_id);

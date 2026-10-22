import { pathToFileURL } from 'node:url';
import pg from 'pg';

/**
 * Idempotent, additive schema migrations. Safe to run repeatedly against an existing database:
 * every statement uses IF NOT EXISTS or checks the catalog first. Nothing is dropped.
 */
export const MIGRATION_SQL = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    bio TEXT DEFAULT '',
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    trust_score INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Academic profile collected during onboarding.
  ALTER TABLE users ADD COLUMN IF NOT EXISTS programme TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS academic_year TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS branch TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS section TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_version INTEGER NOT NULL DEFAULT 0;

  -- Compressed profile photos (WebP), stored in the database.
  CREATE TABLE IF NOT EXISTS user_avatars (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mime TEXT NOT NULL,
    data BYTEA NOT NULL,
    bytes INTEGER NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    location_label TEXT NOT NULL,
    location_geo JSONB DEFAULT '{"type":"Point","coordinates":[0,0]}'::jsonb,
    date_occurred TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'open',
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    verification_question TEXT,
    verification_answer_hash TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    idempotency_key TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Compressed listing photos: a full-size WebP plus a small thumbnail for cards.
  CREATE TABLE IF NOT EXISTS item_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    mime TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    bytes INTEGER NOT NULL,
    data BYTEA NOT NULL,
    thumb BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (item_id, position)
  );

  CREATE TABLE IF NOT EXISTS user_saved_items (
    user_id UUID NOT NULL,
    item_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    claimant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answers TEXT NOT NULL,
    proof_images JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    decided_at TIMESTAMPTZ,
    decision_note TEXT,
    audit_trail JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id UUID NOT NULL,
    reason TEXT NOT NULL,
    details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    resolution_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- participant_one is always the smaller UUID, so each pair has exactly one row per item.
  CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    participant_one UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_two UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(item_id, participant_one, participant_two)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    client_message_id TEXT NOT NULL,
    read_by UUID[] DEFAULT ARRAY[]::UUID[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(client_message_id, sender_id)
  );

  CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
  CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
  CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id);
  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
  CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_items_owner_idempotency ON items(owner_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_item_images_item ON item_images(item_id, position);
  CREATE INDEX IF NOT EXISTS idx_claims_item ON claims(item_id);
  CREATE INDEX IF NOT EXISTS idx_claims_claimant ON claims(claimant_id);
  CREATE INDEX IF NOT EXISTS idx_saved_items_user ON user_saved_items(user_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_one ON conversations(participant_one, last_message_at DESC);
  CREATE INDEX IF NOT EXISTS idx_conversations_two ON conversations(participant_two, last_message_at DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_once ON reports(reporter_id, target_type, target_id);

  -- Constraints that cannot use IF NOT EXISTS are added only when missing.
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_saved_user') THEN
      DELETE FROM user_saved_items s WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.user_id);
      ALTER TABLE user_saved_items ADD CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_saved_item') THEN
      DELETE FROM user_saved_items s WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.id = s.item_id);
      ALTER TABLE user_saved_items ADD CONSTRAINT fk_saved_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_conversation_order') THEN
      ALTER TABLE conversations ADD CONSTRAINT ck_conversation_order CHECK (participant_one < participant_two) NOT VALID;
    END IF;
  END $$;
`;

export async function runMigrations(client: pg.ClientBase): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(MIGRATION_SQL);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

// CLI entry: `npm run db:migrate -w backend`
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { env } = await import('./env.js');
  const { logger } = await import('./logger.js');
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    await runMigrations(client);
    logger.info('Migrations applied successfully.');
  } catch (err) {
    logger.error({ err }, 'Migration failed');
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

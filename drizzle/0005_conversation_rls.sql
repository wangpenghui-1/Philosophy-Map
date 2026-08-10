DROP POLICY IF EXISTS "conversations_owner_policy" ON "conversations";
--> statement-breakpoint
CREATE POLICY "conversations_owner_policy" ON "conversations"
  USING (
    ("user_id" IS NOT NULL AND "user_id"::text = current_setting('app.user_id', true))
    OR
    ("anonymous_session_hash" IS NOT NULL AND "anonymous_session_hash" = current_setting('app.anonymous_session_hash', true))
  )
  WITH CHECK (
    ("user_id" IS NOT NULL AND "user_id"::text = current_setting('app.user_id', true))
    OR
    ("anonymous_session_hash" IS NOT NULL AND "anonymous_session_hash" = current_setting('app.anonymous_session_hash', true))
  );

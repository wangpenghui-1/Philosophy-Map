ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "messages_owner_policy" ON "messages";
--> statement-breakpoint
CREATE POLICY "messages_owner_policy" ON "messages"
  USING (
    EXISTS (
      SELECT 1
      FROM "conversations"
      WHERE "conversations"."id" = "messages"."conversation_id"
        AND (
          ("conversations"."user_id" IS NOT NULL AND "conversations"."user_id"::text = current_setting('app.user_id', true))
          OR
          ("conversations"."anonymous_session_hash" IS NOT NULL AND "conversations"."anonymous_session_hash" = current_setting('app.anonymous_session_hash', true))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "conversations"
      WHERE "conversations"."id" = "messages"."conversation_id"
        AND (
          ("conversations"."user_id" IS NOT NULL AND "conversations"."user_id"::text = current_setting('app.user_id', true))
          OR
          ("conversations"."anonymous_session_hash" IS NOT NULL AND "conversations"."anonymous_session_hash" = current_setting('app.anonymous_session_hash', true))
        )
    )
  );
--> statement-breakpoint
ALTER TABLE "message_citations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "message_citations_owner_policy" ON "message_citations";
--> statement-breakpoint
CREATE POLICY "message_citations_owner_policy" ON "message_citations"
  USING (
    EXISTS (
      SELECT 1
      FROM "messages"
      JOIN "conversations" ON "conversations"."id" = "messages"."conversation_id"
      WHERE "messages"."id" = "message_citations"."message_id"
        AND (
          ("conversations"."user_id" IS NOT NULL AND "conversations"."user_id"::text = current_setting('app.user_id', true))
          OR
          ("conversations"."anonymous_session_hash" IS NOT NULL AND "conversations"."anonymous_session_hash" = current_setting('app.anonymous_session_hash', true))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "messages"
      JOIN "conversations" ON "conversations"."id" = "messages"."conversation_id"
      WHERE "messages"."id" = "message_citations"."message_id"
        AND (
          ("conversations"."user_id" IS NOT NULL AND "conversations"."user_id"::text = current_setting('app.user_id', true))
          OR
          ("conversations"."anonymous_session_hash" IS NOT NULL AND "conversations"."anonymous_session_hash" = current_setting('app.anonymous_session_hash', true))
        )
    )
  );
--> statement-breakpoint
ALTER TABLE "memory_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "memory_links_owner_policy" ON "memory_links";
--> statement-breakpoint
CREATE POLICY "memory_links_owner_policy" ON "memory_links"
  USING (
    EXISTS (
      SELECT 1 FROM "memory_items"
      WHERE "memory_items"."id" = "memory_links"."memory_id"
        AND "memory_items"."user_id"::text = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "memory_items"
      WHERE "memory_items"."id" = "memory_links"."memory_id"
        AND "memory_items"."user_id"::text = current_setting('app.user_id', true)
    )
  );
--> statement-breakpoint
ALTER TABLE "memory_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "memory_events_owner_policy" ON "memory_events";
--> statement-breakpoint
CREATE POLICY "memory_events_owner_policy" ON "memory_events"
  USING (
    EXISTS (
      SELECT 1 FROM "memory_items"
      WHERE "memory_items"."id" = "memory_events"."memory_id"
        AND "memory_items"."user_id"::text = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "memory_items"
      WHERE "memory_items"."id" = "memory_events"."memory_id"
        AND "memory_items"."user_id"::text = current_setting('app.user_id', true)
    )
  );

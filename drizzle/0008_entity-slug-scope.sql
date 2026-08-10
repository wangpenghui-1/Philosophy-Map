DROP INDEX IF EXISTS "entity_versions_slug_locale_version_uq";--> statement-breakpoint
CREATE INDEX "entity_versions_slug_locale_version_idx" ON "entity_versions" USING btree ("slug","locale","version");

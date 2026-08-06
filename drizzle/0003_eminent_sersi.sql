ALTER TABLE "journey_versions" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "journey_versions" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "journey_versions" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
CREATE TRIGGER "journey_versions_published_immutable"
BEFORE UPDATE OR DELETE ON "journey_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_published_version_mutation();

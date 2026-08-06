CREATE TABLE "memory_embeddings" (
	"memory_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"model" varchar(120) NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_memory_id_memory_items_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memory_embeddings_user_idx" ON "memory_embeddings" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "memory_embeddings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "memory_embeddings_owner_policy" ON "memory_embeddings"
  USING ("user_id"::text = current_setting('app.user_id', true))
  WITH CHECK ("user_id"::text = current_setting('app.user_id', true));

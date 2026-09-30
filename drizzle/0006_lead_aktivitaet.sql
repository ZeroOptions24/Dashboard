CREATE TABLE "lead_activity" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lead_activity_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"lead_id" text NOT NULL,
	"user_id" text,
	"role" text NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"data" text DEFAULT '{}' NOT NULL,
	"pipedrive" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_activity_lead_idx" ON "lead_activity" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_activity_user_idx" ON "lead_activity" USING btree ("user_id","created_at");
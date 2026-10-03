CREATE TABLE "provision" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"lead_id" text NOT NULL,
	"kunde" text DEFAULT '' NOT NULL,
	"anlass" text NOT NULL,
	"betrag" integer NOT NULL,
	"status" text DEFAULT 'tbk' NOT NULL,
	"grund" text,
	"payout_id" text,
	"frage" text,
	"frage_at" timestamp,
	"antwort" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"fest_at" timestamp,
	"storno_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "netto" integer;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "ust" integer;--> statement-breakpoint
ALTER TABLE "payout" ADD COLUMN "hinweis" text;--> statement-breakpoint
ALTER TABLE "provision" ADD CONSTRAINT "provision_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "provision_user_idx" ON "provision" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provision_lead_role_unique" ON "provision" USING btree ("lead_id","role","user_id");--> statement-breakpoint
CREATE INDEX "provision_payout_idx" ON "provision" USING btree ("payout_id");
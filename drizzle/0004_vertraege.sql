CREATE TABLE "contract" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"documents" text NOT NULL,
	"status" text DEFAULT 'offen' NOT NULL,
	"signature_request_id" text,
	"pdf_base64" text,
	"sent_by" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"signed_at" timestamp,
	"question" text,
	"question_at" timestamp,
	"last_reminder_at" timestamp,
	CONSTRAINT "contract_signature_request_id_unique" UNIQUE("signature_request_id")
);
--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_sent_by_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
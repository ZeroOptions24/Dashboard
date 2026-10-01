CREATE TABLE "lead_lock" (
	"lead_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"since" timestamp DEFAULT now() NOT NULL,
	"until" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_lock" ADD CONSTRAINT "lead_lock_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
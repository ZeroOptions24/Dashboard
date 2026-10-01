CREATE TABLE "setter_assignment" (
	"lead_id" text PRIMARY KEY NOT NULL,
	"setter_name" text NOT NULL,
	"assigned_by" text,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "setter_assignment" ADD CONSTRAINT "setter_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
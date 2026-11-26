# Quarantined migration drafts

These SQL files are retained as source history but are deliberately outside the
active migration stream. They implement an earlier, incompatible branch model
(`user_branches`) or duplicate a superseded tenancy migration. Do not move
them back into `supabase/migrations` or apply them to any environment.

The active migration stream uses `staff_assignments` and `profile_branches`.

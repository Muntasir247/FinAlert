# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.
## Backend Portability (Must Follow)
The app must stay provider-swappable so we can migrate off Supabase later with minimal
cost.

1. ** Centralize the backend :** All Supabase/SDK usage lives ONLY in lib/supabase.ts (
client) and `context/AuthContext. tsx' (auth). Screens and components must NEVER import or
call the Supabase SDK directly - they may only use `useAuth()` and exported helpers from
the context layer.
2. ** No SDK types leaking :** Components must use the app's own types (e.g. `Profile' from
AuthContext'), never `@supabase/supabase-js' types.
3. ** Logic in SQL, not JS :** Keep schema, triggers, RLS policies, and constraints in the
database (SQL). Do not replicate business rules in client code.
4. ** Avoid provider-locked features ** (realtime channels, storage buckets, edge functions)
unless explicitly approved and isolated behind the context layer.
5. ** Queries stay behind the context layer :** Any new data access (new tables, new
queries) must be added as a function in the context/lib layer - never inline in a screen.
6. ** Prefer standard SQL/Postgres patterns ** over Supabase-specific syntax so a data
migration stays a plain dump/import.
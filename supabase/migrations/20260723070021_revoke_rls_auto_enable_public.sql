-- Follow-up to initial_schema: anon/authenticated inherit EXECUTE via PUBLIC.
-- Event trigger for rls_auto_enable was created out-of-band; recreate manually in Prod.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

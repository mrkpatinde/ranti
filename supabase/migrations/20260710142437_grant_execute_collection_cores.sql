-- Fix: public.record_collection / confirm_collection / generate_receipt are thin
-- SECURITY INVOKER wrappers over private.*_core (introduced 20260705, sprint
-- instrumentation). The EXECUTE grant on the private cores was never added for
-- the `authenticated` role, so every landlord-initiated collection failed with
-- "permission denied for function record_collection_core".
--
-- The cores are SECURITY INVOKER: RLS still evaluates as the calling landlord.
-- Granting EXECUTE does not widen data access. The `private` schema is not
-- exposed through PostgREST, so these cannot be called directly by a client.

grant execute on function private.record_collection_core(uuid, uuid, uuid, integer, text, timestamptz, text, jsonb, text, text) to authenticated;
grant execute on function private.confirm_collection_core(uuid, uuid) to authenticated;
grant execute on function private.generate_receipt_core(uuid, uuid) to authenticated;

-- Fix: Org owners couldn't SELECT their own org because the only SELECT
-- policy checked org_members, and owners aren't necessarily in that table yet.
create policy "Org owners can read their org"
  on public.organizations for select
  using (owner_id = auth.uid());

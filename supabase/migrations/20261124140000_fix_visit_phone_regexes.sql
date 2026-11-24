-- Correct the JavaScript-style double escaping left in the two visit
-- registration functions. Preserve every other part of their definitions.

do $migration$
declare
  function_definition text;
  corrected_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.register_invited_visit_idempotent(bytea,text,text,text,bytea,bytea,bytea,smallint)'::regprocedure
  ) into function_definition;

  corrected_definition := pg_catalog.replace(
    function_definition,
    $bad$'^\\+[1-9][0-9]{7,14}$'$bad$,
    $good$'^[+][1-9][0-9]{7,14}$'$good$
  );

  if corrected_definition = function_definition then
    raise exception 'public invitation phone validation pattern was not found';
  end if;

  execute corrected_definition;

  select pg_catalog.pg_get_functiondef(
    'public.register_resident_expected_visit(text,text,text,bytea,bytea,bytea,smallint)'::regprocedure
  ) into function_definition;

  corrected_definition := pg_catalog.replace(
    function_definition,
    $bad$'^\\+[1-9][0-9]{7,14}$'$bad$,
    $good$'^[+][1-9][0-9]{7,14}$'$good$
  );

  if corrected_definition = function_definition then
    raise exception 'resident visit phone validation pattern was not found';
  end if;

  execute corrected_definition;
end;
$migration$;

revoke all on function public.register_invited_visit_idempotent(
  bytea, text, text, text, bytea, bytea, bytea, smallint
) from public, anon, authenticated;
grant execute on function public.register_invited_visit_idempotent(
  bytea, text, text, text, bytea, bytea, bytea, smallint
) to service_role;

revoke all on function public.register_resident_expected_visit(
  text, text, text, bytea, bytea, bytea, smallint
) from public, anon, service_role;
grant execute on function public.register_resident_expected_visit(
  text, text, text, bytea, bytea, bytea, smallint
) to authenticated;

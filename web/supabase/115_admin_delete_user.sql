-- Hard-delete every row belonging to a user (Clerk text user_id) across all
-- public tables that have a `user_id` column. Used by the admin "Delete account"
-- action for complete data removal.
--
-- SECURITY DEFINER so it runs with full privileges (bypasses RLS). Multi-pass so
-- foreign-key ordering between user_id tables resolves itself; child tables with
-- ON DELETE CASCADE are cleaned automatically when their parent row is deleted.
create or replace function admin_delete_user_data(p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer;
  pass integer := 0;
  pass_deleted integer;
  total integer := 0;
  deleted jsonb := '{}'::jsonb;
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    raise exception 'p_user_id is required';
  end if;

  loop
    pass := pass + 1;
    pass_deleted := 0;

    for r in
      select c.table_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.column_name = 'user_id'
        and c.table_schema = 'public'
        and t.table_type = 'BASE TABLE'
        and c.data_type in ('text', 'character varying')
    loop
      begin
        execute format('delete from public.%I where user_id = $1', r.table_name) using p_user_id;
        get diagnostics n = row_count;
        if n > 0 then
          deleted := jsonb_set(
            deleted,
            array[r.table_name],
            to_jsonb(coalesce((deleted ->> r.table_name)::int, 0) + n)
          );
          total := total + n;
          pass_deleted := pass_deleted + n;
        end if;
      exception when foreign_key_violation then
        -- A dependent row in another user_id table is blocking this delete; a
        -- later pass (once that dependent is gone) will succeed.
        null;
      end;
    end loop;

    exit when pass_deleted = 0 or pass >= 10;
  end loop;

  return jsonb_build_object('total_rows', total, 'by_table', deleted, 'passes', pass);
end;
$$;

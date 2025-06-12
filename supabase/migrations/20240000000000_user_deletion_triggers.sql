-- Function to delete auth.users when user_details is deleted
create or replace function public.handle_user_details_deleted()
returns trigger as $$
begin
  -- Delete the corresponding auth.users record
  delete from auth.users where id = old.id;
  return old;
end;
$$ language plpgsql security definer;

-- Function to delete user_details when auth.users is deleted
create or replace function public.handle_auth_user_deleted()
returns trigger as $$
begin
  -- Delete the corresponding user_details record
  delete from public.user_details where id = old.id;
  return old;
end;
$$ language plpgsql security definer;

-- Trigger for user_details deletion
create trigger on_user_details_deleted
  after delete on public.user_details
  for each row
  execute function public.handle_user_details_deleted();

-- Trigger for auth.users deletion
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row
  execute function public.handle_auth_user_deleted();

-- Grant necessary permissions
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all functions in schema public to service_role; 
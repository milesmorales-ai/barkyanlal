alter table public.push_notification_log
  add column if not exists notification_slot text;

update public.push_notification_log
set notification_slot = coalesce(notification_slot, 'morning')
where notification_slot is null;

alter table public.push_notification_log
  alter column notification_slot set default 'morning',
  alter column notification_slot set not null;

alter table public.push_notification_log
  drop constraint if exists push_notification_log_user_id_kitchen_item_id_reminder_date_key;

create unique index if not exists push_notification_log_slot_key
  on public.push_notification_log(user_id, kitchen_item_id, reminder_date, notification_slot);

-- Initial/demo seed. Run after the production schema migration.
-- Remove demo orders/bookings before production if you use this file as a demo dataset.

insert into public.menu_items (id, name, category, price, description, popular, image_key, available, sort_order) values
('10000000-0000-0000-0000-000000000001','Nshima & Beef Stew','Traditional Meals',85,'Soft nshima served with slow-cooked beef stew and seasonal vegetables.',true,'nshima-beef',true,10),
('10000000-0000-0000-0000-000000000002','Nshima & Chicken','Traditional Meals',80,'Traditional nshima with tender chicken and vegetables.',true,'nshima-chicken',true,20),
('10000000-0000-0000-0000-000000000003','Kapenta Plate','Traditional Meals',75,'Kapenta with nshima and vegetables.',false,'kapenta-plate',true,30),
('10000000-0000-0000-0000-000000000004','Ifisashi','Traditional Meals',55,'Leafy vegetable relish cooked with groundnuts.',false,'ifisashi',true,40),
('10000000-0000-0000-0000-000000000005','Chikanda','Traditional Meals',45,'Zambian chikanda served as a traditional side or light meal.',false,'chikanda',true,50),
('10000000-0000-0000-0000-000000000006','Classic Beef Burger','Fast Foods',70,'Seasoned beef patty with fresh toppings.',true,'beef-burger',true,60),
('10000000-0000-0000-0000-000000000007','Chicken Burger','Fast Foods',65,'Crispy chicken burger with fresh toppings.',false,'chicken-burger',true,70),
('10000000-0000-0000-0000-000000000008','Quarter Chicken & Chips','Fast Foods',75,'Quarter chicken with golden chips.',true,'chicken-chips',true,80),
('10000000-0000-0000-0000-000000000009','Chips','Sides',25,'Freshly fried chips.',false,'chips',true,90),
('10000000-0000-0000-0000-000000000010','Coleslaw','Sides',20,'Fresh crunchy coleslaw.',false,'coleslaw',true,100),
('10000000-0000-0000-0000-000000000011','Soft Drink (500ml)','Drinks',15,'Chilled soft drink.',false,'soft-drink',true,110),
('10000000-0000-0000-0000-000000000012','Fresh Juice','Drinks',25,'Fresh seasonal fruit juice.',false,'fresh-juice',true,120)
on conflict (id) do update set name=excluded.name, category=excluded.category, price=excluded.price, description=excluded.description, popular=excluded.popular, image_key=excluded.image_key, available=excluded.available, sort_order=excluded.sort_order;

-- Demo transaction records intentionally use the public RPC/table shape for dashboard testing.
-- If you want a clean production database, omit this section.
insert into public.orders (customer_name, phone, fulfillment, address, items, total, status, payment_method, payment_status)
values
('Demo Customer','0978000000','Pickup',null,'[{"id":"10000000-0000-0000-0000-000000000001","name":"Nshima & Beef Stew","price":85,"qty":1,"line_total":85}]'::jsonb,85,'Delivered','Cash','Cash due'),
('Demo Delivery','0968000000','Delivery','Solwezi CBD','[{"id":"10000000-0000-0000-0000-000000000008","name":"Quarter Chicken & Chips","price":75,"qty":2,"line_total":150}]'::jsonb,150,'Preparing','Mobile Money','Awaiting verification');

insert into public.bookings (event_type, package_name, event_date, event_time, venue, guests, notes, customer_name, phone, email)
values
('Corporate event','Standard',current_date + 14,'12:00','Solwezi CBD',40,'Demo booking for dashboard testing.','Demo Customer','0978000000','demo@example.com');

-- Demo Flutterwave ledger record for control-room reconciliation UI.
do $$
declare
  v_order_id uuid;
  v_order_number bigint;
begin
  select id, order_number into v_order_id, v_order_number
  from public.orders where phone = '0968000000' order by created_at desc limit 1;
  if v_order_id is not null then
    insert into public.payment_transactions(order_id, order_number, tx_ref, amount, currency, payment_method, status, provider_status, provider_message)
    values (v_order_id, v_order_number, 'DEMO-FLW-' || v_order_number, 150, 'ZMW', 'flutterwave', 'pending', 'pending', 'Demo pending payment — replace/remove before production')
    on conflict (tx_ref) do nothing;
  end if;
end $$;

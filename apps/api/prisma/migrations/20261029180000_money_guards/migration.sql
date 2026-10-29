-- Balances never go below zero: the order, debit and reversal paths lock and check them, and these back that up
ALTER TABLE "users" ADD CONSTRAINT "users_wallet_balance_non_negative" CHECK ("wallet_balance" >= 0);
ALTER TABLE "loyalty_balances" ADD CONSTRAINT "loyalty_balances_points_non_negative" CHECK ("points" >= 0);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_used_count_non_negative" CHECK ("used_count" >= 0);

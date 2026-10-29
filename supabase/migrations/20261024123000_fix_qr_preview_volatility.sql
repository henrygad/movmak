begin;

-- QR preview compares expiry against clock_timestamp(), which is VOLATILE.
-- Keep the function's declared volatility aligned with its implementation so
-- PostgreSQL does not optimize the time-sensitive credential check as stable.
alter function public.preview_visit_by_qr(bytea) volatile;

commit;

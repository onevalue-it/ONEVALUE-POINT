-- OVPoint: soft delete cho profiles.
-- Mục tiêu: xóa tài khoản khỏi hệ thống sử dụng nhưng vẫn giữ nguyên
-- posts, point_transactions và toàn bộ lịch sử điểm/audit.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx
ON public.profiles (deleted_at);

CREATE INDEX IF NOT EXISTS profiles_active_not_deleted_idx
ON public.profiles (is_active)
WHERE deleted_at IS NULL;

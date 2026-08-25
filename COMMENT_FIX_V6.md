# Comment fix V6

Nếu UI báo không gửi được comment, chạy file:

`supabase/migrations/20260825_repair_post_comments_rls.sql`

trong Supabase SQL Editor.

V6 cũng thay đổi việc insert comment: `user_id` được lấy trực tiếp từ `supabase.auth.getUser().user.id` để khớp chính xác với `auth.uid()` trong RLS. Khi DB trả lỗi, UI sẽ hiện `error.message` thật thay vì thông báo chung.

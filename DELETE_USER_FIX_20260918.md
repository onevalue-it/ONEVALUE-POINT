# OVPoint - Fix xoa user 2026-09-18

## Loi goc

API cu hard-delete `profiles` sau khi da xoa nhieu du lieu phu thuoc. Vi `posts.from_user_id` / `posts.to_user_id` con foreign key toi `profiles.id`, PostgreSQL chan lenh DELETE.

Nghiem trong hon, API cu co xoa `point_transactions` truoc khi profile bi loi foreign key. Dieu nay co the lam mat du lieu giao dich diem cua nhung user da thu xoa truoc khi ban fix duoc deploy.

## Logic moi

- KHONG hard-delete `profiles`.
- KHONG xoa `posts`.
- KHONG xoa `point_transactions`.
- Profile duoc soft-delete bang:
  - `is_active = false`
  - `deleted_at = now()`
- Auth user bi ban dai han de khong dang nhap lai.
- User da xoa khong con hien trong danh sach user, leaderboard, danh sach nguoi nhan Point.
- Lich su bai viet va diem nguoi do da tang/nhan van duoc giu nguyen.

## SQL migration

Neu database chua co 2 cot, chay file:

`supabase/migrations/20260918_soft_delete_profiles.sql`

## File da sua

- `app/api/admin/delete-user/route.ts`
- `app/admin/users/page.tsx`
- `app/login/page.tsx`
- `app/profile/[id]/page.tsx`
- `lib/store.ts`
- `lib/useAuthGuard.ts`
- `supabase/functions/delete-user/index.ts`
- `supabase/migrations/20260918_soft_delete_profiles.sql`

## Kiem tra sau deploy

1. Tao/test voi mot user phu.
2. User A tang diem cho user B.
3. Admin xoa user A.
4. User A bien mat khoi Admin Users va leaderboard.
5. User A khong dang nhap lai duoc.
6. Diem ma user A da tang cho B van con.
7. Bai post cu van con tren feed.

## Luu y ve cac lan xoa that bai truoc day

Ban API cu da xoa `point_transactions` truoc khi hard-delete profile va sau do moi gap loi foreign key. Neu da bam Xoa voi mot user truoc khi deploy ban nay, can kiem tra lai lich su giao dich Point cua user do. Du lieu `posts` van con nen co kha nang doi soat/khoi phuc, nhung can xem schema thuc te cua `point_transactions` truoc khi chay SQL khoi phuc.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import ExcelJS from "exceljs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ProfileRow = {
  id: string
  full_name: string
  email: string | null
  department: string | null
  office: string | null
  level: string | null
  role: string | null
  is_active: boolean | null
}

type PostRow = {
  id: number
  from_user_id: string | null
  to_user_id: string | null
  from_email: string | null
  to_email: string | null
  from_name: string | null
  to_name: string | null
  points: number | null
  title: string | null
  message: string | null
  created_at: string
}

type RewardItem = {
  points: number
  title: string
  message: string
  sender: string
  createdAt: string
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY"
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function getMonthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Tháng không hợp lệ")
  }

  const [year, monthNumber] = month.split("-").map(Number)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    throw new Error("Tháng không hợp lệ")
  }

  const start = `${month}-01T00:00:00+07:00`
  const nextMonthDate = new Date(Date.UTC(year, monthNumber, 1))
  const nextYear = nextMonthDate.getUTCFullYear()
  const nextMonth = String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0")
  const end = `${nextYear}-${nextMonth}-01T00:00:00+07:00`

  return { start, end, year, monthNumber }
}

function formatRewardDate(createdAt: string): string {
  return new Date(createdAt).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

async function requireAdminOrHr(request: NextRequest) {
  const authorization = request.headers.get("authorization")

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Bạn chưa đăng nhập")
  }

  const accessToken = authorization.slice("Bearer ".length).trim()
  const supabaseAdmin = getSupabaseAdmin()

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken)

  if (authError || !user) {
    throw new Error("Phiên đăng nhập không hợp lệ")
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    throw new Error("Không tìm thấy tài khoản")
  }

  if (!["admin", "hr"].includes(profile.role)) {
    throw new Error("Chỉ Admin hoặc HR được xuất báo cáo")
  }

  return supabaseAdmin
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = await requireAdminOrHr(request)
    const searchParams = request.nextUrl.searchParams

    const month =
      searchParams.get("month") ||
      new Date().toISOString().slice(0, 7)

    const office = searchParams.get("office") || "all"
    const department = searchParams.get("department") || "all"
    const level = searchParams.get("level") || "all"
    const { start, end, year, monthNumber } = getMonthRange(month)

    let profilesQuery = supabaseAdmin
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        department,
        office,
        level,
        role,
        is_active
      `)
      .neq("is_active", false)
      .order("full_name", { ascending: true })

    if (office !== "all") {
      profilesQuery = profilesQuery.eq("office", office)
    }

    if (department !== "all") {
      profilesQuery = profilesQuery.eq("department", department)
    }

    if (level !== "all") {
      profilesQuery = profilesQuery.eq("level", level)
    }

    const { data: profileData, error: profilesError } = await profilesQuery

    if (profilesError) {
      throw new Error(profilesError.message)
    }

    const profiles = (profileData || []) as ProfileRow[]

    if (profiles.length === 0) {
      return NextResponse.json(
        { error: "Không có nhân viên phù hợp với bộ lọc" },
        { status: 404 }
      )
    }

    const { data: postData, error: postError } = await supabaseAdmin
      .from("posts")
      .select(`
        id,
        from_user_id,
        to_user_id,
        from_email,
        to_email,
        from_name,
        to_name,
        points,
        title,
        message,
        created_at
      `)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true })

    if (postError) {
      throw new Error(postError.message)
    }

    const posts = (postData || []) as PostRow[]

    const profileById = new Map(
      profiles.map(profile => [profile.id, profile])
    )

    const profileByEmail = new Map(
      profiles
        .filter(profile => profile.email)
        .map(profile => [
          profile.email!.trim().toLowerCase(),
          profile,
        ])
    )

    const rewardsByUser = new Map<string, RewardItem[]>()

    for (const post of posts) {
      let receiver: ProfileRow | undefined

      if (post.to_user_id) {
        receiver = profileById.get(post.to_user_id)
      }

      if (!receiver && post.to_email) {
        receiver = profileByEmail.get(post.to_email.trim().toLowerCase())
      }

      if (!receiver) continue

      const rewards = rewardsByUser.get(receiver.id) || []

      rewards.push({
        points: Number(post.points || 0),
        title: post.title?.trim() || "Không có tiêu đề",
        message: post.message?.trim() || "Không có nội dung",
        sender:
          post.from_name?.trim() ||
          post.from_email?.trim() ||
          "Không xác định",
        createdAt: post.created_at,
      })

      rewardsByUser.set(receiver.id, rewards)
    }

    const profilesWithPoints = profiles.filter(profile => {
      const rewards = rewardsByUser.get(profile.id) || []
      const totalPoints = rewards.reduce(
        (sum, reward) => sum + reward.points,
        0
      )

      return totalPoints > 0
    })

    if (profilesWithPoints.length === 0) {
      return NextResponse.json(
        { error: "Không có nhân viên nào nhận điểm trong tháng đã chọn" },
        { status: 404 }
      )
    }

    const maximumPraiseCount = Math.max(
      0,
      ...profilesWithPoints.map(profile =>
        rewardsByUser.get(profile.id)?.length || 0
      )
    )

    const workbook = new ExcelJS.Workbook()
    workbook.creator = "OVPOINT"
    workbook.created = new Date()

    const worksheet = workbook.addWorksheet(`Tháng ${monthNumber}-${year}`, {
      views: [{ state: "frozen", ySplit: 2 }],
      properties: { defaultRowHeight: 20 },
    })

    const headers = [
      "Họ tên",
      "Email",
      "Phòng ban",
      "Văn phòng",
      "Tổng điểm",
      "Số lời khen",
      ...Array.from(
        { length: maximumPraiseCount },
        (_, index) => `Lời khen ${index + 1}`
      ),
    ]

    worksheet.mergeCells(1, 1, 1, headers.length)
    const titleCell = worksheet.getCell(1, 1)
    titleCell.value = `OVPOINT - Báo cáo khen thưởng tháng ${String(
      monthNumber
    ).padStart(2, "0")}/${year}`
    titleCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14 }
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF17365D" },
    }
    titleCell.alignment = { horizontal: "center", vertical: "middle" }
    worksheet.getRow(1).height = 28

    const headerRow = worksheet.addRow(headers)
    headerRow.height = 28
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F4E78" },
      }
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      }
    })

    for (const profile of profilesWithPoints) {
      const rewards = rewardsByUser.get(profile.id) || []
      const totalPoints = rewards.reduce(
        (sum, reward) => sum + reward.points,
        0
      )

      const praiseColumns = Array.from(
        { length: maximumPraiseCount },
        (_, index) => {
          const reward = rewards[index]

          if (!reward) return ""

          return [
            formatRewardDate(reward.createdAt),
            `+${reward.points} pts`,
            reward.title,
            reward.message,
            reward.sender,
          ].join(" — ")
        }
      )

      const row = worksheet.addRow([
        profile.full_name,
        profile.email || "",
        profile.department || "",
        profile.office || "",
        totalPoints,
        rewards.length,
        ...praiseColumns,
      ])

      row.alignment = { vertical: "top", wrapText: true }
      row.height = 72
      row.getCell(5).numFmt = "#,##0"
      row.getCell(6).numFmt = "#,##0"
    }

    worksheet.columns.forEach((column, index) => {
      if (index === 0) column.width = 25
      else if (index === 1) column.width = 32
      else if (index === 2) column.width = 20
      else if (index === 3) column.width = 14
      else if (index === 4 || index === 5) column.width = 13
      else column.width = 65
    })

    worksheet.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: 2, column: headers.length },
    }

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return

      row.eachCell(cell => {
        cell.border = {
          bottom: {
            style: "thin",
            color: { argb: "FFD9E2F3" },
          },
        }
      })
    })

    const output = await workbook.xlsx.writeBuffer()
    const fileName = `OVPOINT_KhenThuong_${month}.xlsx`

    return new NextResponse(new Uint8Array(output as ArrayBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể xuất báo cáo"

    let status = 500

    if (
      message === "Bạn chưa đăng nhập" ||
      message === "Phiên đăng nhập không hợp lệ"
    ) {
      status = 401
    }

    if (message === "Chỉ Admin hoặc HR được xuất báo cáo") {
      status = 403
    }

    return NextResponse.json({ error: message }, { status })
  }
}

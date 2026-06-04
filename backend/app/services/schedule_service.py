"""
苏格拉底之窗 - Schedule Service
Excel/ICS 课表解析 + 日历混合查询
"""
import re
import io
from datetime import datetime, date, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Course, Task, ScheduleEvent
from app.schemas.schemas import (
    ParsedCourseRecord, PeriodMapping, ParseExcelResponse, CalendarEventOut,
)

# ── 默认节次时间映射 ────────────────────────────────
DEFAULT_PERIOD_MAPPING: List[PeriodMapping] = [
    PeriodMapping(periods="1-2", start_time="08:00", end_time="09:40"),
    PeriodMapping(periods="3-4", start_time="10:00", end_time="11:40"),
    PeriodMapping(periods="5-6", start_time="14:00", end_time="15:40"),
    PeriodMapping(periods="7-8", start_time="16:00", end_time="17:40"),
    PeriodMapping(periods="9-10", start_time="19:00", end_time="20:40"),
]

# 课程颜色预设
COURSE_COLORS = [
    "#4A90D9", "#50C878", "#E8A838", "#E85D75", "#9B59B6",
    "#1ABC9C", "#E67E22", "#3498DB", "#2ECC71", "#F39C12",
]


def _expand_weeks(weeks_str: str) -> List[int]:
    """展开周次字符串为周次列表。'1-16' → [1,2,...,16], '1,3,5,7-15' → [1,3,5,7,8,...,15]"""
    result = []
    for part in weeks_str.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-", 1)
            result.extend(range(int(start), int(end) + 1))
        elif part.isdigit():
            result.append(int(part))
    return sorted(set(result))


def _period_to_time(period: int, period_mapping: List[PeriodMapping]) -> Optional[str]:
    """将节次映射为时间字符串。"""
    for pm in period_mapping:
        parts = pm.periods.replace(" ", "").split("-")
        start_p, end_p = int(parts[0]), int(parts[1])
        if period == start_p:
            return pm.start_time
        if start_p < period <= end_p:
            # 中间节次，按比例估算
            total_minutes_start = int(pm.start_time.split(":")[0]) * 60 + int(pm.start_time.split(":")[1])
            total_minutes_end = int(pm.end_time.split(":")[0]) * 60 + int(pm.end_time.split(":")[1])
            duration = total_minutes_end - total_minutes_start
            step = duration / (end_p - start_p)
            minutes = total_minutes_start + step * (period - start_p)
            h, m = divmod(int(minutes), 60)
            return f"{h:02d}:{m:02d}"
    return None


def _detect_excel_format(headers: List[str]) -> str:
    """检测 Excel 格式：list 或 grid。"""
    header_text = " ".join(str(h).lower() for h in headers if h)
    list_keywords = ["课程", "名称", "星期", "节次", "教师", "地点", "周次", "name", "day", "period"]
    match_count = sum(1 for kw in list_keywords if kw in header_text)
    return "list" if match_count >= 2 else "grid"


def parse_excel(file_content: bytes) -> ParseExcelResponse:
    """解析 Excel 课表文件。"""
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(file_content), read_only=True, data_only=True)
    ws = wb.active

    rows = []
    for row in ws.iter_rows(values_only=True):
        rows.append([str(cell).strip() if cell is not None else "" for cell in row])

    if len(rows) < 2:
        return ParseExcelResponse(format="list", records=[], period_mapping=DEFAULT_PERIOD_MAPPING)

    headers = rows[0]
    fmt = _detect_excel_format(headers)

    if fmt == "list":
        return _parse_list_format(headers, rows[1:])
    else:
        return _parse_grid_format(headers, rows)


def _parse_list_format(headers: List[str], data_rows: List[List[str]]) -> ParseExcelResponse:
    """解析列表格式 Excel。"""
    # 查找列索引
    header_lower = [str(h).lower().strip() for h in headers]
    col_map = {}
    keywords = {
        "name": ["课程名称", "课程", "名称", "课名", "科目", "name", "course"],
        "teacher": ["教师", "老师", "授课教师", "teacher", "instructor"],
        "day": ["星期", "周几", "day", "weekday"],
        "period": ["节次", "节", "上课节次", "period"],
        "location": ["地点", "教室", "上课地点", "location", "room"],
        "weeks": ["周次", "上课周次", "weeks", "week"],
    }
    for key, kws in keywords.items():
        for i, h in enumerate(header_lower):
            if any(kw in h for kw in kws):
                col_map[key] = i
                break

    records = []
    for row in data_rows:
        if not any(row):
            continue
        name = row[col_map["name"]] if "name" in col_map and col_map["name"] < len(row) else ""
        if not name:
            continue

        # 解析星期
        day = 1
        if "day" in col_map and col_map["day"] < len(row):
            day_str = row[col_map["day"]]
            day = _parse_day_of_week(day_str)

        # 解析节次
        start_period, end_period = 1, 2
        if "period" in col_map and col_map["period"] < len(row):
            period_str = row[col_map["period"]]
            start_period, end_period = _parse_period(period_str)

        teacher = row[col_map["teacher"]] if "teacher" in col_map and col_map["teacher"] < len(row) else ""
        location = row[col_map["location"]] if "location" in col_map and col_map["location"] < len(row) else ""
        weeks = row[col_map["weeks"]] if "weeks" in col_map and col_map["weeks"] < len(row) else "1-16"

        records.append(ParsedCourseRecord(
            name=name, day_of_week=day,
            start_period=start_period, end_period=end_period,
            teacher=teacher, location=location, weeks=weeks,
        ))

    return ParseExcelResponse(format="list", records=records, period_mapping=DEFAULT_PERIOD_MAPPING)


def _parse_grid_format(headers: List[str], all_rows: List[List[str]]) -> ParseExcelResponse:
    """解析网格格式 Excel（行为节次，列为星期）。"""
    # 星期列从第 2 列开始（第 1 列是节次）
    day_map = {}
    day_keywords = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0, "天": 0}
    for i, h in enumerate(headers[1:], 1):
        h_str = str(h)
        for kw, day_num in day_keywords.items():
            if kw in h_str:
                day_map[i] = day_num
                break

    if not day_map:
        # 尝试英文 Mon/Tue/...
        en_map = {"mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6, "sun": 0}
        for i, h in enumerate(headers[1:], 1):
            for en, num in en_map.items():
                if en in str(h).lower():
                    day_map[i] = num
                    break

    records = []
    period_mapping = []
    for row in all_rows[1:]:
        if not row or not row[0]:
            continue
        period_str = str(row[0]).strip()
        start_p, end_p = _parse_period(period_str)
        period_mapping.append(PeriodMapping(
            periods=f"{start_p}-{end_p}",
            start_time=_period_to_time(start_p, DEFAULT_PERIOD_MAPPING) or "08:00",
            end_time=_period_to_time(end_p, DEFAULT_PERIOD_MAPPING) or "09:40",
        ))

        for col_idx, day_num in day_map.items():
            if col_idx >= len(row):
                continue
            cell = str(row[col_idx]).strip()
            if not cell or cell.lower() == "none":
                continue

            # 单元格内可能有多行信息：课程名\n地点\n教师
            lines = [l.strip() for l in cell.replace("\\n", "\n").split("\n") if l.strip()]
            name = lines[0] if lines else cell
            location = lines[1] if len(lines) > 1 else ""
            teacher = lines[2] if len(lines) > 2 else ""

            records.append(ParsedCourseRecord(
                name=name, day_of_week=day_num,
                start_period=start_p, end_period=end_p,
                teacher=teacher, location=location, weeks="1-16",
            ))

    return ParseExcelResponse(format="grid", records=records, period_mapping=period_mapping or DEFAULT_PERIOD_MAPPING)


def parse_ics(file_content: bytes) -> List[ParsedCourseRecord]:
    """解析 ICS 日历文件为课程记录。"""
    from icalendar import Calendar
    cal = Calendar.from_ical(file_content)

    events = []
    for component in cal.walk():
        if component.name != "VEVENT":
            continue
        summary = str(component.get("SUMMARY", ""))
        dtstart = component.get("DTSTART")
        dtend = component.get("DTEND")
        location = str(component.get("LOCATION", ""))
        description = str(component.get("DESCRIPTION", ""))

        if not dtstart or not dtend:
            continue

        start = dtstart.dt
        end = dtend.dt

        if isinstance(start, datetime):
            day_of_week = start.weekday()  # 0=周一
            day_of_week = (day_of_week + 1) % 7  # 转为 0=周日
            start_hour = start.strftime("%H:%M")
            end_hour = end.strftime("%H:%M")
        else:
            continue

        events.append(ParsedCourseRecord(
            name=summary,
            day_of_week=day_of_week,
            start_period=0,  # ICS 不用节次，直接用时间
            end_period=0,
            teacher="",
            location=location,
            weeks="1-16",
        ))

    # 去重（同名+同星期）
    seen = set()
    unique = []
    for e in events:
        key = (e.name, e.day_of_week)
        if key not in seen:
            seen.add(key)
            unique.append(e)

    return unique


def parse_pasted_text(text: str) -> List[ParsedCourseRecord]:
    """解析粘贴的表格文本。"""
    lines = text.strip().split("\n")
    if len(lines) < 2:
        return []

    # 尝试 Tab 分隔
    headers = lines[0].split("\t")
    if len(headers) < 3:
        # 尝试多空格分隔
        headers = re.split(r"\s{2,}", lines[0])

    return _parse_list_format(headers, [re.split(r"\t|\s{2,}", line) for line in lines[1:]]).records


def _parse_day_of_week(s: str) -> int:
    """解析星期字符串为数字。"""
    s = str(s).strip()
    day_map = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0, "天": 0}
    for kw, num in day_map.items():
        if kw in s:
            return num
    if s.isdigit():
        v = int(s)
        return v if 0 <= v <= 6 else 1
    return 1


def _parse_period(s: str) -> Tuple[int, int]:
    """解析节次字符串为 (start, end)。"""
    s = str(s).strip()
    m = re.search(r"(\d+)\s*[-~]\s*(\d+)", s)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.search(r"(\d+)", s)
    if m:
        p = int(m.group(1))
        return p, p + 1
    return 1, 2


def course_to_virtual_event(
    course: Course, target_date: date, period_mapping: List[PeriodMapping],
) -> Optional[CalendarEventOut]:
    """将课程转换为指定日期的虚拟日历事件。"""
    # 计算是第几周
    if not course.semester_start:
        return None
    sem_start = date.fromisoformat(course.semester_start)
    delta_days = (target_date - sem_start).days
    if delta_days < 0:
        return None
    week_num = delta_days // 7 + 1

    weeks_list = _expand_weeks(course.weeks)
    if week_num not in weeks_list:
        return None

    # 计算时间
    start_time_str = _period_to_time(1, period_mapping) if course.start_time == "0" else course.start_time
    end_time_str = _period_to_time(2, period_mapping) if course.end_time == "0" else course.end_time

    # 如果 start_time 已经是 HH:MM 格式，直接用
    sh, sm = map(int, start_time_str.split(":"))
    eh, em = map(int, end_time_str.split(":"))

    start_dt = datetime(target_date.year, target_date.month, target_date.day, sh, sm, tzinfo=timezone.utc)
    end_dt = datetime(target_date.year, target_date.month, target_date.day, eh, em, tzinfo=timezone.utc)

    return CalendarEventOut(
        id=f"course-{course.id}-{target_date.isoformat()}",
        title=course.name,
        description=f"{course.teacher} · {course.location}" if course.teacher else course.location,
        start_time=start_dt,
        end_time=end_dt,
        event_type="course",
        color=course.color,
        course_id=course.id,
        task_id=None,
        all_day=False,
        is_completed=False,
        is_virtual=True,
    )


async def get_calendar_events(
    db: AsyncSession,
    start: datetime,
    end: datetime,
) -> List[CalendarEventOut]:
    """获取日历混合事件：真实事件 + 课表虚拟事件。"""
    # 1. 查询真实事件
    result = await db.execute(
        select(ScheduleEvent).where(
            ScheduleEvent.start_time < end,
            ScheduleEvent.end_time > start,
        )
    )
    real_events = result.scalars().all()

    events = [
        CalendarEventOut(
            id=e.id, title=e.title, description=e.description,
            start_time=e.start_time, end_time=e.end_time,
            event_type=e.event_type, color=e.color,
            course_id=e.course_id, task_id=e.task_id,
            all_day=e.all_day, is_completed=e.is_completed,
            is_virtual=False,
        )
        for e in real_events
    ]

    # 2. 查询启用的课程，生成虚拟事件
    course_result = await db.execute(
        select(Course).where(Course.is_active == True)
    )
    courses = course_result.scalars().all()

    if courses:
        # 遍历日期范围内的每一天
        current = start.date()
        end_date = end.date()
        while current <= end_date:
            # 检查是否是课程对应的星期
            day_of_week = current.weekday()
            day_of_week = (day_of_week + 1) % 7  # 转为 0=周日

            for course in courses:
                if course.day_of_week == day_of_week:
                    ve = course_to_virtual_event(course, current, DEFAULT_PERIOD_MAPPING)
                    if ve:
                        events.append(ve)
            current += timedelta(days=1)

    # 按开始时间排序
    events.sort(key=lambda e: e.start_time)
    return events


async def assign_color(db: AsyncSession) -> str:
    """自动分配未使用的课程颜色。"""
    result = await db.execute(select(Course.color))
    used = {row[0] for row in result.all()}
    for color in COURSE_COLORS:
        if color not in used:
            return color
    return COURSE_COLORS[0]  # 循环使用

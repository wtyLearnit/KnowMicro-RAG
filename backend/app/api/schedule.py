"""
KnowMicro - Schedule API Routes
课程、任务、日程事件的 CRUD + 课表导入 + 日历查询
"""
from datetime import datetime, timezone
from typing import Optional


def _to_utc_naive(dt: datetime) -> datetime:
    """将 datetime 转为 UTC 并去掉时区信息（SQLite 存储用）。"""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _parse_query_dt(s: str) -> datetime:
    """解析前端传来的 ISO 时间字符串，返回 UTC aware datetime。"""
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Course, Task, ScheduleEvent, get_db
from app.schemas.schemas import (
    CourseCreate, CourseUpdate, CourseOut,
    TaskCreate, TaskUpdate, TaskOut,
    EventCreate, EventUpdate, EventOut, EventReschedule,
    CalendarEventOut, ParseExcelResponse, ParsedCourseRecord,
    PeriodMapping, ParseTextRequest, ImportCoursesRequest,
)
from app.services.schedule_service import (
    parse_excel, parse_ics, parse_pasted_text,
    get_calendar_events, assign_color, DEFAULT_PERIOD_MAPPING,
)

schedule_router = APIRouter(prefix="/api/schedule", tags=["schedule"])


# ═══════════════════════════════════════════════════
#  Courses
# ═══════════════════════════════════════════════════

@schedule_router.get("/courses", response_model=list[CourseOut])
async def list_courses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Course).order_by(Course.day_of_week, Course.start_time))
    return result.scalars().all()


@schedule_router.post("/courses", response_model=CourseOut)
async def create_course(data: CourseCreate, db: AsyncSession = Depends(get_db)):
    color = data.color if data.color != "#4A90D9" else await assign_color(db)
    course = Course(
        name=data.name, day_of_week=data.day_of_week,
        start_time=data.start_time, end_time=data.end_time,
        location=data.location, teacher=data.teacher,
        color=color, weeks=data.weeks, semester_start=data.semester_start,
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course


@schedule_router.put("/courses/{course_id}", response_model=CourseOut)
async def update_course(course_id: str, data: CourseUpdate, db: AsyncSession = Depends(get_db)):
    course = await db.get(Course, course_id)
    if not course:
        raise HTTPException(404, "课程不存在")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(course, field, value)
    await db.commit()
    await db.refresh(course)
    return course


@schedule_router.delete("/courses/{course_id}")
async def delete_course(course_id: str, db: AsyncSession = Depends(get_db)):
    course = await db.get(Course, course_id)
    if not course:
        raise HTTPException(404, "课程不存在")
    await db.delete(course)
    await db.commit()
    return {"ok": True}


@schedule_router.patch("/courses/{course_id}/toggle", response_model=CourseOut)
async def toggle_course(course_id: str, db: AsyncSession = Depends(get_db)):
    course = await db.get(Course, course_id)
    if not course:
        raise HTTPException(404, "课程不存在")
    course.is_active = not course.is_active
    await db.commit()
    await db.refresh(course)
    return course


# ── 课表导入 ───────────────────────────────────────

@schedule_router.post("/courses/parse-excel")
async def parse_excel_endpoint(file: UploadFile = File(...)):
    content = await file.read()
    try:
        result = parse_excel(content)
        return result.model_dump()
    except Exception as e:
        raise HTTPException(400, f"Excel 解析失败: {str(e)}")


@schedule_router.post("/courses/parse-ics")
async def parse_ics_endpoint(file: UploadFile = File(...)):
    content = await file.read()
    try:
        records = parse_ics(content)
        return {
            "records": [r.model_dump() for r in records],
            "period_mapping": [p.model_dump() for p in DEFAULT_PERIOD_MAPPING],
        }
    except Exception as e:
        raise HTTPException(400, f"ICS 解析失败: {str(e)}")


@schedule_router.post("/courses/parse-text")
async def parse_text_endpoint(data: ParseTextRequest):
    try:
        records = parse_pasted_text(data.text)
        return {
            "records": [r.model_dump() for r in records],
            "period_mapping": [p.model_dump() for p in DEFAULT_PERIOD_MAPPING],
        }
    except Exception as e:
        raise HTTPException(400, f"文本解析失败: {str(e)}")


@schedule_router.post("/courses/import")
async def import_courses(data: ImportCoursesRequest, db: AsyncSession = Depends(get_db)):
    """批量导入课程（预览确认后调用）。"""
    created = 0
    skipped = 0

    # 构建节次→时间映射
    period_map = {pm.periods: (pm.start_time, pm.end_time) for pm in data.period_mapping}

    for rec in data.records:
        # 查找时间
        periods_key = f"{rec.start_period}-{rec.end_period}"
        if periods_key in period_map:
            start_time, end_time = period_map[periods_key]
        else:
            # 尝试从默认映射查找
            found = False
            for pm in DEFAULT_PERIOD_MAPPING:
                parts = pm.periods.split("-")
                if int(parts[0]) <= rec.start_period <= int(parts[1]):
                    start_time = pm.start_time
                    end_time = pm.end_time
                    found = True
                    break
            if not found:
                start_time = "08:00"
                end_time = "09:40"

        # 检查重复（同名称+同星期+同时段）
        existing = await db.execute(
            select(Course).where(
                Course.name == rec.name,
                Course.day_of_week == rec.day_of_week,
                Course.start_time == start_time,
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        color = await assign_color(db)
        course = Course(
            name=rec.name, day_of_week=rec.day_of_week,
            start_time=start_time, end_time=end_time,
            location=rec.location, teacher=rec.teacher,
            color=color, weeks=rec.weeks, semester_start=data.semester_start,
        )
        db.add(course)
        created += 1

    await db.commit()
    return {"created": created, "skipped": skipped}


# ═══════════════════════════════════════════════════
#  Tasks
# ═══════════════════════════════════════════════════

@schedule_router.get("/tasks", response_model=list[TaskOut])
async def list_tasks(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Task)
    if status:
        stmt = stmt.where(Task.status == status)
    stmt = stmt.order_by(Task.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@schedule_router.post("/tasks", response_model=TaskOut)
async def create_task(data: TaskCreate, db: AsyncSession = Depends(get_db)):
    task = Task(
        title=data.title, description=data.description,
        estimated_minutes=data.estimated_minutes, priority=data.priority,
        tags=data.tags, due_date=data.due_date,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@schedule_router.put("/tasks/{task_id}", response_model=TaskOut)
async def update_task(task_id: str, data: TaskUpdate, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    await db.commit()
    await db.refresh(task)
    return task


@schedule_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    await db.delete(task)
    await db.commit()
    return {"ok": True}


@schedule_router.patch("/tasks/{task_id}/complete", response_model=TaskOut)
async def complete_task(task_id: str, db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    task.status = "completed"
    await db.commit()
    await db.refresh(task)
    return task


# ═══════════════════════════════════════════════════
#  Events
# ═══════════════════════════════════════════════════

@schedule_router.get("/events", response_model=list[EventOut])
async def list_events(
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ScheduleEvent)
    if start and end:
        start_dt = _parse_query_dt(start)
        end_dt = _parse_query_dt(end)
        # 数据库存的是 UTC naive，查询也用 naive
        stmt = stmt.where(
            ScheduleEvent.start_time < end_dt.replace(tzinfo=None),
            ScheduleEvent.end_time > start_dt.replace(tzinfo=None),
        )
    stmt = stmt.order_by(ScheduleEvent.start_time)
    result = await db.execute(stmt)
    return result.scalars().all()


@schedule_router.post("/events", response_model=EventOut)
async def create_event(data: EventCreate, db: AsyncSession = Depends(get_db)):
    event = ScheduleEvent(
        title=data.title, description=data.description,
        start_time=_to_utc_naive(data.start_time),
        end_time=_to_utc_naive(data.end_time),
        event_type=data.event_type, color=data.color,
        course_id=data.course_id, task_id=data.task_id,
        all_day=data.all_day,
    )
    db.add(event)

    # 如果关联任务，更新任务状态
    if data.task_id:
        task = await db.get(Task, data.task_id)
        if task:
            task.status = "scheduled"
            task.scheduled_event_id = event.id

    await db.commit()
    await db.refresh(event)
    return event


@schedule_router.put("/events/{event_id}", response_model=EventOut)
async def update_event(event_id: str, data: EventUpdate, db: AsyncSession = Depends(get_db)):
    event = await db.get(ScheduleEvent, event_id)
    if not event:
        raise HTTPException(404, "事件不存在")
    for field, value in data.model_dump(exclude_unset=True).items():
        if field in ('start_time', 'end_time') and isinstance(value, datetime):
            value = _to_utc_naive(value)
        setattr(event, field, value)
    await db.commit()
    await db.refresh(event)
    return event


@schedule_router.delete("/events/{event_id}")
async def delete_event(event_id: str, db: AsyncSession = Depends(get_db)):
    event = await db.get(ScheduleEvent, event_id)
    if not event:
        raise HTTPException(404, "事件不存在")

    # 如果关联任务，将任务状态改回 pending
    if event.task_id:
        task = await db.get(Task, event.task_id)
        if task:
            task.status = "pending"
            task.scheduled_event_id = None

    await db.delete(event)
    await db.commit()
    return {"ok": True}


@schedule_router.patch("/events/{event_id}/reschedule", response_model=EventOut)
async def reschedule_event(event_id: str, data: EventReschedule, db: AsyncSession = Depends(get_db)):
    event = await db.get(ScheduleEvent, event_id)
    if not event:
        raise HTTPException(404, "事件不存在")
    event.start_time = _to_utc_naive(data.start_time)
    event.end_time = _to_utc_naive(data.end_time)
    await db.commit()
    await db.refresh(event)
    return event


# ═══════════════════════════════════════════════════
#  Calendar (混合查询)
# ═══════════════════════════════════════════════════

@schedule_router.get("/calendar", response_model=list[CalendarEventOut])
async def get_calendar(
    start: str = Query(...),
    end: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    start_dt = _parse_query_dt(start)
    end_dt = _parse_query_dt(end)
    return await get_calendar_events(db, start_dt, end_dt)

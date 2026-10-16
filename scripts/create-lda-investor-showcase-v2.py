from __future__ import annotations

import math
import asyncio
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUT_DIR = ROOT / "output" / "adverts"
TMP_DIR = ROOT / ".tmp" / "lda-investor-showcase-v2"
FFMPEG = ROOT / ".tmp" / "ad-tools" / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"

W, H = 1920, 1080
FPS = 24
DURATION = 90
TOTAL_FRAMES = FPS * DURATION

RED = (224, 17, 31)
BLACK = (4, 5, 7)
WHITE = (248, 248, 250)
GLASS = (255, 255, 255, 26)
MUTED = (190, 194, 203)
BLUE = (80, 178, 255)
GREEN = (67, 214, 142)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


F18 = font(18)
F22 = font(22)
F24 = font(24)
F26 = font(26)
F30 = font(30)
F34 = font(34, True)
F42 = font(42, True)
F54 = font(54, True)
F68 = font(68, True)
F78 = font(78, True)
F88 = font(88, True)
F112 = font(112, True)
F148 = font(148, True)


def clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def ease(x: float) -> float:
    x = clamp(x)
    return 1 - (1 - x) ** 3


def smooth(x: float) -> float:
    x = clamp(x)
    return x * x * (3 - 2 * x)


def ts(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if ts(draw, trial, fnt)[0] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(draw, xy, text, fnt, max_width, fill, gap=10):
    x, y = xy
    for line in wrap(draw, text, fnt, max_width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += ts(draw, line, fnt)[1] + gap
    return y


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def center(draw, x, y, text, fnt, fill):
    tw, th = ts(draw, text, fnt)
    draw.text((x - tw / 2, y - th / 2), text, font=fnt, fill=fill)


LOGO = Image.open(PUBLIC / "lda-canonical-logo.png").convert("RGBA")
LOGO.thumbnail((560, 190), Image.Resampling.LANCZOS)
PHOTO = Image.open(PUBLIC / "learner-instructor.jpg").convert("RGB")


def paste_logo(img: Image.Image, x: int, y: int, scale: float = 1.0):
    logo = LOGO
    if scale != 1.0:
        logo = LOGO.resize((int(LOGO.width * scale), int(LOGO.height * scale)), Image.Resampling.LANCZOS)
    img.paste(logo, (x, y), logo)


def base(t: float) -> Image.Image:
    y = np.linspace(0, 1, H)[:, None]
    x = np.linspace(0, 1, W)[None, :]
    glow = 10 + 20 * y + 5 * np.sin((x * 2.1 + t * 0.03) * math.pi)
    arr = np.dstack([glow * 0.72, glow * 0.75, glow]).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(arr, "RGB")
    draw = ImageDraw.Draw(img, "RGBA")
    draw.ellipse((1160, -360, 2360, 740), fill=(RED[0], RED[1], RED[2], 22))
    draw.ellipse((-560, 660, 780, 1680), fill=(BLUE[0], BLUE[1], BLUE[2], 13))
    for i in range(9):
        yy = 150 + i * 105 + 18 * math.sin(t * 0.4 + i)
        draw.line((0, yy, W, yy - 170), fill=(255, 255, 255, 8), width=2)
    return img


def finish(img: Image.Image, t: float) -> Image.Image:
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rectangle((0, 0, W, 62), fill=(0, 0, 0, 120))
    draw.rectangle((0, H - 68, W, H), fill=(0, 0, 0, 120))
    draw.rectangle((0, H - 72, int(W * clamp(t / DURATION)), H - 66), fill=RED)
    sweep = int(((t * 0.12) % 1.2 - 0.2) * W)
    draw.polygon([(sweep, 0), (sweep + 180, 0), (sweep - 410, H), (sweep - 590, H)], fill=(255, 255, 255, 10))
    draw.rectangle((0, 0, W, H), outline=(255, 255, 255, 18), width=1)
    return img


def reveal(draw, x, y, text, fnt, local, delay=0.0, fill=WHITE, max_width=None):
    a = int(255 * smooth((local - delay) / 0.75))
    if a <= 0:
        return
    dy = int((1 - ease((local - delay) / 0.9)) * 50)
    if max_width:
        draw_wrapped(draw, (x, y + dy), text, fnt, max_width, (*fill[:3], a), 10)
    else:
        draw.text((x, y + dy), text, font=fnt, fill=(*fill[:3], a))


def pill(draw, x, y, text, local=1, delay=0, fill=None):
    a = int(255 * smooth((local - delay) / 0.45))
    if a <= 0:
        return
    tw, _ = ts(draw, text, F22)
    color = fill or (255, 255, 255, a // 9)
    rounded(draw, (x, y, x + tw + 42, y + 48), 24, color, (255, 255, 255, a // 4), 1)
    draw.ellipse((x + 18, y + 18, x + 30, y + 30), fill=(RED[0], RED[1], RED[2], a))
    draw.text((x + 42, y + 13), text, font=F22, fill=(248, 248, 250, a))


def glass_card(draw, x, y, w, h, title, body=None, local=1.0, delay=0.0, accent=RED):
    a = int(255 * smooth((local - delay) / 0.55))
    if a <= 0:
        return
    dy = int((1 - ease((local - delay) / 0.65)) * 36)
    rounded(draw, (x + 10, y + 14 + dy, x + w + 10, y + h + 14 + dy), 24, (0, 0, 0, a // 4))
    rounded(draw, (x, y + dy, x + w, y + h + dy), 24, (255, 255, 255, a // 10), (255, 255, 255, a // 4), 2)
    draw.rectangle((x, y + dy, x + 7, y + h + dy), fill=(*accent[:3], a))
    draw.text((x + 34, y + 28 + dy), title, font=F34, fill=(255, 255, 255, a))
    if body:
        draw_wrapped(draw, (x + 34, y + 86 + dy), body, F24, w - 70, (214, 218, 226, a), 8)


def phone(draw, x, y, local):
    rounded(draw, (x, y, x + 390, y + 720), 58, (7, 8, 11, 255), (255, 255, 255, 55), 3)
    rounded(draw, (x + 24, y + 55, x + 366, y + 690), 32, (242, 244, 248, 255))
    draw.text((x + 58, y + 102), "Book a lesson", font=F34, fill=(20, 22, 26))
    rows = [("Instructor", "Verified ADI"), ("Transmission", "Automatic"), ("Pickup", "N12 9HE"), ("Checkout", "Stripe secure")]
    for i, (label, value) in enumerate(rows):
        yy = y + 180 + i * 92
        rounded(draw, (x + 55, yy, x + 336, yy + 66), 14, (255, 255, 255), (222, 224, 229), 2)
        draw.text((x + 75, yy + 10), label, font=F18, fill=(112, 116, 125))
        draw.text((x + 75, yy + 34), value, font=F24, fill=(22, 24, 28))
    p = smooth(local / 4.0)
    rounded(draw, (x + 60, y + 605, x + 330, y + 654), 24, (220, 224, 230))
    rounded(draw, (x + 60, y + 605, x + 60 + int(270 * p), y + 654), 24, RED)
    center(draw, x + 195, y + 630, "Confirm", F22, WHITE)


def map_panel(draw, x, y, w, h, local, title="Live route"):
    rounded(draw, (x, y, x + w, y + h), 28, (9, 11, 16, 230), (255, 255, 255, 55), 2)
    for i in range(12):
        xx = x + 45 + i * (w // 10)
        draw.line((xx, y + 30, xx - 190, y + h - 35), fill=(70, 76, 88), width=2)
    for i in range(8):
        yy = y + 45 + i * (h // 7)
        draw.line((x + 28, yy, x + w - 35, yy + 36 * math.sin(i)), fill=(56, 62, 74), width=2)
    pts = [(x + 70, y + h - 78), (x + 170, y + h - 165), (x + 265, y + h - 210), (x + 390, y + h - 205), (x + 500, y + h - 320), (x + 630, y + h - 430), (x + w - 82, y + 76)]
    n = max(2, int(2 + smooth(local / 4.3) * (len(pts) - 2)))
    draw.line(pts[:n], fill=RED, width=11, joint="curve")
    px, py = pts[min(n - 1, len(pts) - 1)]
    draw.ellipse((px - 22, py - 22, px + 22, py + 22), fill=RED)
    draw.ellipse((x + w - 96, y + 60, x + w - 68, y + 88), fill=WHITE)
    draw.text((x + 40, y + 35), title, font=F26, fill=WHITE)


def dashboard(draw, x, y, local, kind="finance"):
    rounded(draw, (x, y, x + 820, y + 520), 30, (255, 255, 255, 22), (255, 255, 255, 55), 2)
    title = "Revenue and subscription engine" if kind == "finance" else "Platform command centre"
    draw.text((x + 42, y + 36), title, font=F42, fill=WHITE)
    labels = [("Gross today", "£1.8k"), ("Net margin", "Live"), ("Subscriptions", "MRR"), ("Refund risk", "Monitored")]
    for i, (a, b) in enumerate(labels):
        cx = x + 42 + (i % 2) * 375
        cy = y + 116 + (i // 2) * 142
        glass_card(draw, cx, cy, 330, 104, b, a, local, i * 0.13, GREEN if i == 1 else RED)
    pts = []
    for i in range(12):
        px = x + 70 + i * 58
        py = y + 430 - (90 * smooth((local - i * 0.05) / 1.2)) - 42 * math.sin(i * 0.7)
        pts.append((px, py))
    if len(pts) > 1:
        draw.line(pts, fill=BLUE, width=5)
    for px, py in pts:
        draw.ellipse((px - 6, py - 6, px + 6, py + 6), fill=BLUE)


def cursor(draw, x: float, y: float, local: float, click_at: float | None = None):
    draw.polygon([(x, y), (x + 26, y + 62), (x + 42, y + 37)], fill=(255, 255, 255, 235), outline=(10, 12, 18, 190))
    if click_at is not None:
        r = int(18 + 42 * smooth((local - click_at) / 0.45))
        a = int(160 * (1 - smooth((local - click_at) / 0.55)))
        if a > 0:
            draw.ellipse((x - r, y - r, x + r, y + r), outline=(BLUE[0], BLUE[1], BLUE[2], a), width=4)


def browser_chrome(draw, x: int, y: int, w: int, h: int, title: str):
    rounded(draw, (x, y, x + w, y + h), 26, (246, 248, 252, 248), (255, 255, 255, 130), 2)
    rounded(draw, (x, y, x + w, y + 74), 26, (9, 11, 17, 255), None, 0)
    draw.text((x + 34, y + 24), title, font=F24, fill=WHITE)
    for i, color in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        draw.ellipse((x + w - 112 + i * 28, y + 28, x + w - 98 + i * 28, y + 42), fill=color)


def learner_booking_ui(draw, x: int, y: int, local: float):
    browser_chrome(draw, x, y, 760, 560, "LDA learner booking")
    draw.text((x + 42, y + 115), "Book your lesson", font=F54, fill=(18, 20, 25))
    fields = [("Pickup postcode", "N12 9HE"), ("Transmission", "Automatic"), ("Instructor", "Verified ADI"), ("Secure checkout", "Stripe")]
    for i, (label, value) in enumerate(fields):
        yy = y + 205 + i * 70
        rounded(draw, (x + 48, yy, x + 462, yy + 52), 14, (255, 255, 255, 255), (215, 220, 230), 2)
        draw.text((x + 68, yy + 14), f"{label}: {value}", font=F22, fill=(24, 27, 34))
    progress = smooth(local / 5.5)
    rounded(draw, (x + 500, y + 214, x + 688, y + 266), 24, (225, 12, 30, 255))
    center(draw, x + 594, y + 240, "Checkout", F22, WHITE)
    cursor(draw, x + 85 + 520 * progress, y + 420 - 170 * smooth((local - 2.0) / 2.2), local, 3.6)


def calendar_ui(draw, x: int, y: int, local: float):
    browser_chrome(draw, x, y, 820, 520, "Instructor calendar")
    draw.text((x + 38, y + 105), "July 2026", font=F42, fill=(18, 20, 25))
    days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    for i, day in enumerate(days):
        draw.text((x + 55 + i * 105, y + 170), day, font=F18, fill=(105, 110, 122))
    for row in range(3):
        for col in range(7):
            bx = x + 45 + col * 105
            by = y + 205 + row * 82
            rounded(draw, (bx, by, bx + 92, by + 68), 8, (255, 255, 255, 255), (224, 228, 235), 1)
    slot_alpha = int(255 * smooth((local - 1.1) / 0.8))
    if slot_alpha:
        rounded(draw, (x + 45 + 2 * 105, y + 205, x + 45 + 2 * 105 + 92, y + 273), 8, (BLUE[0], BLUE[1], BLUE[2], 35), (BLUE[0], BLUE[1], BLUE[2], slot_alpha), 3)
        draw.ellipse((x + 65 + 2 * 105, y + 246, x + 75 + 2 * 105, y + 256), fill=(RED[0], RED[1], RED[2], slot_alpha))
        draw.text((x + 82 + 2 * 105, y + 238), "1 booked", font=F18, fill=(25, 30, 39, slot_alpha))


def metric_graph(draw, x: int, y: int, w: int, h: int, local: float, title: str, value: str, accent=BLUE):
    rounded(draw, (x, y, x + w, y + h), 24, (255, 255, 255, 24), (255, 255, 255, 60), 2)
    draw.text((x + 28, y + 24), title, font=F26, fill=WHITE)
    draw.text((x + 28, y + 70), value, font=F54, fill=accent)
    pts = []
    for i in range(11):
        px = x + 30 + i * ((w - 70) / 10)
        py = y + h - 50 - smooth((local - i * 0.08) / 1.1) * (45 + i * 7) - 16 * math.sin(i * 0.9)
        pts.append((px, py))
    draw.line(pts, fill=accent, width=5)
    for px, py in pts:
        draw.ellipse((px - 5, py - 5, px + 5, py + 5), fill=accent)


def countdown_panel(draw, x: int, y: int, local: float):
    rounded(draw, (x, y, x + 420, y + 270), 28, (5, 7, 11, 235), (255, 255, 255, 55), 2)
    draw.text((x + 32, y + 30), "LIVE LESSON", font=F22, fill=RED)
    minutes = max(2, int(14 - smooth(local / 5.0) * 12))
    draw.text((x + 32, y + 78), f"{minutes} min", font=F88, fill=WHITE)
    draw.text((x + 36, y + 176), "Instructor en route", font=F30, fill=MUTED)
    rounded(draw, (x + 32, y + 222, x + 388, y + 238), 8, (255, 255, 255, 35))
    rounded(draw, (x + 32, y + 222, x + 32 + int(356 * smooth(local / 5.0)), y + 238), 8, BLUE)


def scene_index(t: float) -> tuple[int, float]:
    cuts = [0, 5, 12, 19, 26, 33, 40, 47, 55, 63, 71, 79, 86, 90]
    for i in range(len(cuts) - 1):
        if cuts[i] <= t < cuts[i + 1]:
            return i, t - cuts[i]
    return len(cuts) - 2, t - cuts[-2]


def photo_crop(w: int, h: int, t: float) -> Image.Image:
    scale = max(w / PHOTO.width, h / PHOTO.height) * (1.12 + 0.03 * math.sin(t * 0.2))
    resized = PHOTO.resize((int(PHOTO.width * scale), int(PHOTO.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - w) // 2
    top = (resized.height - h) // 2
    crop = resized.crop((left, top, left + w, top + h))
    crop = ImageEnhance.Contrast(crop).enhance(1.08)
    crop = ImageEnhance.Color(crop).enhance(0.78)
    return Image.alpha_composite(crop.convert("RGBA"), Image.new("RGBA", (w, h), (0, 0, 0, 92))).convert("RGB")


def frame_at(t: float) -> Image.Image:
    idx, local = scene_index(t)
    img = base(t)
    draw = ImageDraw.Draw(img, "RGBA")

    if idx == 0:
        paste_logo(img, int(W / 2 - LOGO.width * 0.98 / 2), 220, 0.98)
        center(draw, W // 2, 555, "Investor showcase", F68, WHITE)
        center(draw, W // 2, 640, "A scalable technology platform for driver education.", F34, MUTED)
        pill(draw, 735, 760, "L-DRIVING ACADEMY", local, 1.0, (255, 255, 255, 18))

    elif idx == 1:
        reveal(draw, 120, 150, "Millions of lessons. One fragmented market.", F88, local, 0.05, WHITE, 1040)
        reveal(draw, 126, 425, "Learners, instructors and operators still lose time across calls, diaries, payments and disconnected records.", F34, local, 0.75, MUTED, 880)
        labels = [("Wasted time", "manual coordination"), ("Missed demand", "unused instructor hours"), ("Weak visibility", "limited operational data"), ("Broken journeys", "separate tools")]
        for i, (title, body) in enumerate(labels):
            glass_card(draw, 1080 + (i % 2) * 360, 170 + (i // 2) * 210, 315, 145, title, body, local, 0.25 + i * 0.15, RED)

    elif idx == 2:
        reveal(draw, 120, 150, "LDA connects the ecosystem.", F88, local, 0.05, WHITE, 900)
        reveal(draw, 126, 395, "A single intelligent platform brings booking, scheduling, secure payments, progress and live updates into one trusted product.", F34, local, 0.8, MUTED, 880)
        nodes = [("Learner", 1160, 245), ("Instructor", 1460, 245), ("Payments", 1310, 460), ("Progress", 1120, 660), ("Admin", 1515, 660)]
        for a, x1, y1 in nodes:
            for b, x2, y2 in nodes:
                if a < b:
                    draw.line((x1, y1, x2, y2), fill=(80, 178, 255, 38), width=2)
        for i, (label, nx, ny) in enumerate(nodes):
            alpha = int(255 * smooth((local - i * 0.14) / 0.55))
            rounded(draw, (nx - 105, ny - 48, nx + 105, ny + 48), 28, (255, 255, 255, alpha // 10), (255, 255, 255, alpha // 3), 2)
            center(draw, nx, ny, label, F26, (255, 255, 255, alpha))

    elif idx == 3:
        reveal(draw, 115, 135, "A learner journey designed to feel effortless.", F68, local, 0.05, WHITE, 870)
        reveal(draw, 120, 325, "Search. Compare. Book. Pay. Track. Review.", F42, local, 0.65, BLUE, 900)
        learner_booking_ui(draw, 1030, 205, local)
        glass_card(draw, 120, 640, 390, 140, "Calendar sync", "The booking becomes a live record on both sides.", local, 1.4, BLUE)
        glass_card(draw, 540, 640, 390, 140, "Clear status", "Scheduled, pending, completed and cancelled states stay aligned.", local, 1.65, RED)

    elif idx == 4:
        reveal(draw, 110, 150, "Instructors get a business operating layer.", F68, local, 0.05, WHITE, 900)
        reveal(draw, 116, 360, "Availability, on-demand work, pupil records, reviews, compliance, earnings and pricing are managed from one focused workspace.", F34, local, 0.75, MUTED, 920)
        calendar_ui(draw, 980, 240, local)
        for i, label in enumerate(["Log on", "Auto-accept", "Pupil records", "Earnings"]):
            pill(draw, 125 + i * 245, 740, label, local, 1.1 + i * 0.15)

    elif idx == 5:
        reveal(draw, 110, 135, "Live lesson tracking brings trust to the journey.", F68, local, 0.05, WHITE, 910)
        reveal(draw, 116, 335, "The route follows roads, the countdown updates, and the location window expires when the lesson is complete.", F34, local, 0.78, MUTED, 880)
        map_panel(draw, 900, 160, 860, 690, local, "Instructor to learner route")
        countdown_panel(draw, 125, 660, local)

    elif idx == 6:
        reveal(draw, 115, 145, "From lesson start to lesson history.", F78, local, 0.05, WHITE, 860)
        reveal(draw, 120, 340, "Status, notifications, reviews and route history move cleanly through the platform.", F34, local, 0.75, MUTED, 850)
        steps = [("Accepted", "Instructor assigned"), ("En route", "Live ETA"), ("Lesson started", "Active record"), ("Completed", "Review saved")]
        for i, (title, body) in enumerate(steps):
            glass_card(draw, 1000, 150 + i * 170, 520, 118, title, body, local, i * 0.22, BLUE if i % 2 else RED)
            if i < 3:
                draw.line((1260, 268 + i * 170, 1260, 315 + i * 170), fill=(255, 255, 255, 50), width=3)

    elif idx == 7:
        reveal(draw, 110, 145, "Revenue is built into the product.", F88, local, 0.05, WHITE, 880)
        reveal(draw, 116, 390, "Secure checkout, subscriptions, instructor earnings, promo codes, refunds and disputes are part of the operating model.", F34, local, 0.8, MUTED, 900)
        dashboard(draw, 965, 230, local, "finance")
        for i, label in enumerate(["Stripe checkout", "Subscriptions", "Instructor payouts", "Refund controls"]):
            pill(draw, 120 + i * 290, 755, label, local, 1.2 + i * 0.12)

    elif idx == 8:
        reveal(draw, 100, 120, "Growth becomes visible.", F88, local, 0.05, WHITE, 790)
        reveal(draw, 106, 325, "MRR, retention, lesson completion, satisfaction and expansion can be monitored as the network scales.", F34, local, 0.7, MUTED, 850)
        metric_graph(draw, 930, 120, 360, 260, local, "MRR", "+34%", BLUE)
        metric_graph(draw, 1335, 120, 360, 260, local, "Retention", "82%", GREEN)
        metric_graph(draw, 930, 435, 360, 260, local, "Lessons", "12.4k", RED)
        metric_graph(draw, 1335, 435, 360, 260, local, "Satisfaction", "4.8/5", BLUE)

    elif idx == 9:
        reveal(draw, 110, 130, "Our initial focus is rapid adoption.", F78, local, 0.05, WHITE, 960)
        reveal(draw, 116, 345, "Lower barriers for instructors. Real value for learners from day one. A stronger engaged community with every completed lesson.", F34, local, 0.8, MUTED, 950)
        for i, (title, body) in enumerate([("Phase 1", "local density"), ("Phase 2", "network growth"), ("Phase 3", "revenue expansion")]):
            glass_card(draw, 995 + i * 275, 210 + i * 72, 245, 190, title, body, local, 0.35 + i * 0.25, BLUE if i == 1 else RED)
        draw.line((1035, 760, 1680, 530), fill=GREEN, width=7)
        for i in range(6):
            draw.ellipse((1025 + i * 128, 740 - i * 45, 1055 + i * 128, 770 - i * 45), fill=GREEN)

    elif idx == 10:
        reveal(draw, 115, 130, "The next layer is intelligence.", F88, local, 0.05, WHITE, 900)
        reveal(draw, 120, 355, "Smarter matching, faster document verification, better support, predictive progress and operational decisioning.", F34, local, 0.75, MUTED, 910)
        for i in range(24):
            a = int(170 * smooth((local - i * 0.04) / 0.6))
            cx = 1160 + int(430 * math.cos(i * 1.35 + local * 0.35))
            cy = 530 + int(300 * math.sin(i * 1.08 + local * 0.28))
            draw.ellipse((cx - 9, cy - 9, cx + 9, cy + 9), fill=(BLUE[0], BLUE[1], BLUE[2], a))
            if i:
                px = 1160 + int(430 * math.cos((i - 1) * 1.35 + local * 0.35))
                py = 530 + int(300 * math.sin((i - 1) * 1.08 + local * 0.28))
                draw.line((px, py, cx, cy), fill=(255, 255, 255, a // 3), width=2)

    elif idx == 11:
        reveal(draw, 110, 130, "Built for the UK. Designed to scale beyond it.", F68, local, 0.05, WHITE, 950)
        reveal(draw, 116, 340, "The model combines convenience, subscriptions, scalable technology and operational efficiency.", F34, local, 0.75, MUTED, 900)
        for i, label in enumerate(["Learners", "Instructors", "Payments", "Compliance", "AI", "Expansion"]):
            angle = i * math.pi / 3 + local * 0.08
            cx = 1300 + int(330 * math.cos(angle))
            cy = 520 + int(230 * math.sin(angle))
            glass_card(draw, cx - 120, cy - 55, 240, 110, label, None, local, i * 0.08, BLUE if i % 2 else RED)
        center(draw, 1300, 520, "LDA", F88, WHITE)

    elif idx == 12:
        paste_logo(img, int(W / 2 - LOGO.width * 1.0 / 2), 150, 1.0)
        center(draw, W // 2, 470, "Transforming driver education.", F68, WHITE)
        center(draw, W // 2, 555, "Connecting learners. Empowering instructors.", F42, MUTED)
        center(draw, W // 2, 635, "Built for the future. Ready for launch.", F42, BLUE)
        center(draw, W // 2, 875, "L-Driving Academy", F54, WHITE)

    return finish(img, t)


VOICEOVER = """Every year, millions of learners and instructors face the same friction: wasted time, missed opportunities and fragmented experiences.
L-Driving Academy is changing that.
We connect learners and instructors through a single, intelligent platform.
From booking and scheduling to secure payments, progress tracking and real-time lesson updates, every interaction is built for simplicity, efficiency and growth.
Our technology creates a seamless experience for users and a scalable model for the business.
Live tracking brings transparency to every lesson, from route guidance to arrival updates, lesson start, lesson completion and route history.
Powerful tools help instructors manage availability, pupils, earnings, reviews and compliance from one focused workspace.
Our initial focus is rapid adoption.
By lowering barriers for instructors and delivering real value from day one, we aim to build a strong, engaged community.
As the platform matures and the network grows, additional services can expand revenue over time.
As we scale across the UK and beyond, we are building long-term value through subscription revenue, scalable technology and operational efficiency.
The next layer is intelligence: smarter matching, faster verification, better support and clearer progress for every learner.
We are transforming driver education.
Connecting learners. Empowering instructors.
Built for the future. Ready for launch."""


def write_music(path: Path):
    sample_rate = 48000
    total = sample_rate * DURATION
    audio = np.zeros(total, dtype=np.float32)
    chords = [(55, 82, 110, 164), (65, 98, 130, 196), (73, 110, 146, 220), (82, 123, 164, 246)]
    for i in range(total):
        sec = i / sample_rate
        chord = chords[int(sec // (DURATION / len(chords))) % len(chords)]
        build = 0.35 + 0.65 * smooth(sec / DURATION)
        env = min(1.0, sec / 3.0, (DURATION - sec) / 3.5)
        pad = sum(math.sin(2 * math.pi * f * sec) for f in chord) / len(chord)
        pulse = math.sin(2 * math.pi * 0.5 * sec) * 0.5 + 0.5
        kick = math.exp(-((sec % 1.0) * 8.5)) * math.sin(2 * math.pi * 50 * sec)
        shimmer = 0.18 * math.sin(2 * math.pi * (740 + 90 * math.sin(sec * 0.4)) * sec)
        audio[i] = env * build * (0.038 * pad * (0.65 + pulse * 0.35) + 0.016 * kick + 0.005 * shimmer)
    audio_int = np.clip(audio * 32767, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(audio_int.tobytes())


def write_voiceover(path: Path):
    try:
        import edge_tts

        async def speak():
            voice = edge_tts.Communicate(
                VOICEOVER,
                voice="en-GB-RyanNeural",
                rate="+9%",
                volume="+0%",
            )
            await voice.save(str(path))

        asyncio.run(speak())
        return
    except Exception:
        fallback = path.with_suffix(".wav")
        ps1 = TMP_DIR / "voiceover.ps1"
        safe_text = VOICEOVER.replace("'", "''")
        safe_path = str(fallback).replace("'", "''")
        ps1.write_text(
            "\n".join(
                [
                    "Add-Type -AssemblyName System.Speech",
                    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
                    "$voice = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq 'en-GB' } | Select-Object -First 1",
                    "if ($voice) { $s.SelectVoice($voice.VoiceInfo.Name) }",
                    "$s.Rate = -1",
                    "$s.Volume = 100",
                    f"$s.SetOutputToWaveFile('{safe_path}')",
                    f"$s.Speak('{safe_text}')",
                    "$s.Dispose()",
                ]
            ),
            encoding="utf-8",
        )
        subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps1)], check=True)
        if fallback != path:
            subprocess.run([str(FFMPEG), "-y", "-i", str(fallback), str(path)], check=True)
        return

def render_contact_sheet(path: Path):
    times = [2, 8, 15, 22, 29, 36, 43, 51, 59, 67, 76, 87]
    sheet = Image.new("RGB", (1920, 810), (7, 8, 11))
    for idx, time in enumerate(times):
        thumb = frame_at(float(time)).resize((480, 270), Image.Resampling.LANCZOS)
        sheet.paste(thumb, ((idx % 4) * 480, (idx // 4) * 270))
    sheet.save(path, quality=92)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    if not FFMPEG.exists():
        raise FileNotFoundError(f"FFmpeg was not found at {FFMPEG}")

    music = TMP_DIR / "music.wav"
    voice = TMP_DIR / "voiceover.mp3"
    mixed = TMP_DIR / "mixed.wav"
    out = OUT_DIR / "LDA-investor-showcase-v2-90s.mp4"
    poster = OUT_DIR / "LDA-investor-showcase-v2-poster.png"
    contact = OUT_DIR / "LDA-investor-showcase-v2-contact-sheet.jpg"

    write_music(music)
    write_voiceover(voice)
    subprocess.run(
        [
            str(FFMPEG),
            "-y",
            "-i",
            str(music),
            "-i",
            str(voice),
            "-filter_complex",
            f"[0:a]volume=0.42[a0];[1:a]volume=1.0,adelay=950|950[a1];[a0][a1]amix=inputs=2:duration=longest:dropout_transition=0,atrim=0:{DURATION},afade=t=out:st={DURATION - 4}:d=4",
            "-c:a",
            "pcm_s16le",
            str(mixed),
        ],
        check=True,
    )

    cmd = [
        str(FFMPEG),
        "-y",
        "-f",
        "rawvideo",
        "-vcodec",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{W}x{H}",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-i",
        str(mixed),
        "-shortest",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "high",
        "-crf",
        "17",
        "-preset",
        "medium",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        str(out),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin is not None
    for frame in range(TOTAL_FRAMES):
        img = frame_at(frame / FPS).convert("RGB")
        if frame == 24:
            img.save(poster)
        proc.stdin.write(img.tobytes())
    proc.stdin.close()
    code = proc.wait()
    if code:
        raise RuntimeError(f"ffmpeg failed with exit code {code}")
    render_contact_sheet(contact)
    print(out)
    print(poster)
    print(contact)


if __name__ == "__main__":
    main()

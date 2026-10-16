from __future__ import annotations

import math
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUT_DIR = ROOT / "output" / "adverts"
TMP_DIR = ROOT / ".tmp" / "lda-tv-advert"
FFMPEG = ROOT / ".tmp" / "ad-tools" / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"

W, H = 1920, 1080
FPS = 24
DURATION = 30
TOTAL_FRAMES = FPS * DURATION

RED = (224, 17, 31)
BLACK = (5, 5, 6)
WHITE = (252, 252, 252)
INK = (17, 17, 19)
MUTED = (205, 205, 211)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


F24 = font(24)
F28 = font(28)
F30 = font(30)
F34 = font(34, True)
F38 = font(38, True)
F42 = font(42, True)
F52 = font(52, True)
F64 = font(64, True)
F82 = font(82, True)
F104 = font(104, True)
F132 = font(132, True)
F156 = font(156, True)


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


def centered(draw, x: int, y: int, text: str, fnt, fill):
    tw, th = ts(draw, text, fnt)
    draw.text((x - tw / 2, y - th / 2), text, font=fnt, fill=fill)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def logo_asset(max_w=520, max_h=180) -> Image.Image:
    logo = Image.open(PUBLIC / "lda-canonical-logo.png").convert("RGBA")
    logo.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    return logo


LOGO = logo_asset()
PHOTO_ORIG = Image.open(PUBLIC / "learner-instructor.jpg").convert("RGB")


def paste_logo(img: Image.Image, x: int, y: int, scale=1.0):
    logo = LOGO
    if scale != 1.0:
        logo = LOGO.resize((int(LOGO.width * scale), int(LOGO.height * scale)), Image.Resampling.LANCZOS)
    img.paste(logo, (x, y), logo)


def dark_base(t: float) -> Image.Image:
    y = np.linspace(0, 1, H)[:, None]
    x = np.linspace(0, 1, W)[None, :]
    base = 8 + 18 * y + 5 * np.sin((x + t * 0.02) * math.pi)
    arr = np.dstack([base, base, base + 2]).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(arr, "RGB")
    draw = ImageDraw.Draw(img, "RGBA")
    draw.ellipse((1160, -420, 2320, 680), fill=(RED[0], RED[1], RED[2], 25))
    draw.ellipse((-500, 690, 700, 1650), fill=(255, 255, 255, 10))
    draw.line((0, 865, W, 680), fill=(255, 255, 255, 14), width=2)
    return img


def light_base(t: float) -> Image.Image:
    y = np.linspace(0, 1, H)[:, None]
    base = 250 - 18 * y
    arr = np.repeat(base, W, axis=1)
    img = Image.fromarray(np.dstack([arr, arr, arr]).clip(0, 255).astype(np.uint8), "RGB")
    draw = ImageDraw.Draw(img, "RGBA")
    draw.ellipse((1200, -450, 2240, 500), fill=(RED[0], RED[1], RED[2], 18))
    draw.ellipse((-600, 740, 660, 1640), fill=(0, 0, 0, 9))
    return img


def polished_finish(img: Image.Image, t: float, dark: bool = False) -> Image.Image:
    """Adds the broadcast-style treatment that sits above every scene."""
    draw = ImageDraw.Draw(img, "RGBA")
    bar = (0, 0, 0, 92 if dark else 45)
    draw.rectangle((0, 0, W, 56), fill=bar)
    draw.rectangle((0, H - 56, W, H), fill=bar)
    progress = int(W * clamp(t / DURATION))
    draw.rectangle((0, H - 61, progress, H - 56), fill=RED)
    sweep = int((math.sin(t * 0.7) * 0.5 + 0.5) * W)
    draw.polygon([(sweep - 95, 0), (sweep + 25, 0), (sweep - 480, H), (sweep - 615, H)], fill=(255, 255, 255, 9 if dark else 13))
    pulse = int(20 + 14 * (math.sin(t * 2.4) * 0.5 + 0.5))
    draw.ellipse((W - 215 - pulse, 96 - pulse, W - 35 + pulse, 276 + pulse), fill=(RED[0], RED[1], RED[2], 14 if dark else 9))
    draw.rectangle((0, 0, W, H), outline=(255, 255, 255, 16 if dark else 26), width=1)
    return img


def scene_wipe(img: Image.Image, local: float, duration: float = 0.45, dark: bool = False):
    p = 1 - smooth(local / duration)
    if p <= 0:
        return
    draw = ImageDraw.Draw(img, "RGBA")
    w = int(W * p)
    fill = (RED[0], RED[1], RED[2], 210)
    draw.polygon([(0, 0), (w + 260, 0), (w, H), (0, H)], fill=fill)
    draw.polygon([(w + 210, 0), (w + 290, 0), (w + 30, H), (w - 50, H)], fill=(255, 255, 255, 50 if dark else 75))


def stat_tile(draw, x, y, value, label, local, delay=0.0, dark=False):
    a = int(255 * smooth((local - delay) / 0.5))
    if a <= 0:
        return
    dy = int((1 - ease((local - delay) / 0.55)) * 36)
    fill = (255, 255, 255, a // 10) if dark else (255, 255, 255, a)
    line = (255, 255, 255, a // 4) if dark else (224, 224, 224, a)
    rounded(draw, (x, y + dy, x + 270, y + 140 + dy), 18, fill, line, 2)
    draw.text((x + 28, y + 28 + dy), value, font=F52, fill=(255, 255, 255, a) if dark else (RED[0], RED[1], RED[2], a))
    draw.text((x + 30, y + 91 + dy), label, font=F24, fill=(220, 220, 224, a) if dark else (72, 72, 78, a))


def photo_panel(t: float, box: tuple[int, int, int, int], darken=78):
    x1, y1, x2, y2 = box
    bw, bh = x2 - x1, y2 - y1
    scale = 1.1 + 0.04 * math.sin(t * 0.4)
    ph = PHOTO_ORIG.resize((int(bw * scale), int(bh * scale)), Image.Resampling.LANCZOS)
    left = max(0, (ph.width - bw) // 2)
    top = max(0, (ph.height - bh) // 2)
    crop = ph.crop((left, top, left + bw, top + bh))
    crop = ImageEnhance.Contrast(crop).enhance(1.05)
    crop = ImageEnhance.Color(crop).enhance(0.9)
    overlay = Image.new("RGBA", crop.size, (0, 0, 0, darken))
    return Image.alpha_composite(crop.convert("RGBA"), overlay).convert("RGB")


def badge(draw, x, y, text, dark=False):
    f = F24
    tw, _ = ts(draw, text, f)
    fill = (255, 255, 255, 23) if dark else (255, 236, 238, 255)
    rounded(draw, (x, y, x + tw + 38, y + 44), 22, fill, (RED[0], RED[1], RED[2], 175), 2)
    draw.text((x + 19, y + 10), text, font=f, fill=WHITE if dark else RED)


def cinematic_reveal(draw, x: int, y: int, text: str, fnt, t: float, delay=0.0, fill=WHITE):
    a = int(255 * smooth((t - delay) / 0.6))
    dy = int((1 - ease((t - delay) / 0.75)) * 42)
    if a <= 0:
        return
    draw.text((x, y + dy), text, font=fnt, fill=(*fill[:3], a))


def small_card(draw, x, y, w, title, body, delay, t):
    alpha = int(255 * smooth((t - delay) / 0.45))
    if alpha <= 0:
        return
    dy = int((1 - ease((t - delay) / 0.55)) * 40)
    rounded(draw, (x + 8, y + 12 + dy, x + w + 8, y + 178 + dy), 18, (0, 0, 0, alpha // 8))
    rounded(draw, (x, y + dy, x + w, y + 166 + dy), 18, (255, 255, 255, alpha), (225, 225, 225, alpha), 2)
    draw.ellipse((x + 28, y + 34 + dy, x + 50, y + 56 + dy), fill=(RED[0], RED[1], RED[2], alpha))
    draw.text((x + 72, y + 26 + dy), title, font=F34, fill=(INK[0], INK[1], INK[2], alpha))
    yy = y + 80 + dy
    for line in wrap(draw, body, F28, w - 105):
        draw.text((x + 72, yy), line, font=F28, fill=(70, 70, 74, alpha))
        yy += 36


def phone_mockup(draw, x, y, t, title="Lesson booked"):
    rounded(draw, (x, y, x + 390, y + 720), 56, (20, 20, 22, 255), (255, 255, 255, 45), 3)
    rounded(draw, (x + 22, y + 52, x + 368, y + 688), 34, (248, 248, 248, 255))
    draw.text((x + 56, y + 98), title, font=F38, fill=INK)
    for i, (label, value) in enumerate([
        ("Instructor", "Joshua M.N"),
        ("Time", "16:30 today"),
        ("Status", "Confirmed"),
        ("Reference", "LDA-7K4P92"),
    ]):
        yy = y + 185 + i * 96
        rounded(draw, (x + 52, yy, x + 338, yy + 70), 14, (255, 255, 255, 255), (226, 226, 226), 2)
        draw.text((x + 72, yy + 12), label, font=F24, fill=(110, 110, 116))
        draw.text((x + 72, yy + 38), value, font=F28, fill=INK)
    progress = smooth(t / 2.0)
    rounded(draw, (x + 58, y + 600, x + 332, y + 646), 23, (230, 230, 232))
    rounded(draw, (x + 58, y + 600, x + 58 + int(274 * progress), y + 646), 23, RED)


def route_map(draw, x, y, t):
    rounded(draw, (x, y, x + 700, y + 620), 26, (22, 22, 25), (230, 230, 230), 2)
    for i in range(10):
        xx = x + 55 + i * 75
        draw.line((xx, y + 28, xx - 185, y + 590), fill=(88, 88, 95), width=3)
    for i in range(7):
        yy = y + 70 + i * 78
        draw.line((x + 35, yy, x + 665, yy + 50 * math.sin(i * 1.2)), fill=(70, 70, 78), width=3)
    pts = [(x + 70, y + 520), (x + 150, y + 445), (x + 230, y + 388), (x + 310, y + 390), (x + 395, y + 310), (x + 480, y + 230), (x + 590, y + 150), (x + 650, y + 82)]
    p = smooth(t / 2.8)
    n = max(2, int(2 + p * (len(pts) - 2)))
    draw.line(pts[:n], fill=RED, width=12, joint="curve")
    px, py = pts[min(n - 1, len(pts) - 1)]
    draw.ellipse((px - 22, py - 22, px + 22, py + 22), fill=RED)
    draw.ellipse((x + 638, y + 70, x + 664, y + 96), fill=WHITE)


def progress_board(draw, x, y, t):
    rounded(draw, (x, y, x + 750, y + 510), 28, (255, 255, 255), (224, 224, 224), 2)
    draw.text((x + 46, y + 44), "Learner progress", font=F42, fill=INK)
    items = [("After-lesson review", 1.0), ("Manoeuvres", 0.86), ("Hazard awareness", 0.76), ("Test readiness", 0.92)]
    for i, (label, value) in enumerate(items):
        yy = y + 125 + i * 82
        draw.text((x + 46, yy), label, font=F28, fill=(58, 58, 63))
        rounded(draw, (x + 330, yy + 5, x + 680, yy + 32), 14, (232, 232, 234))
        fill_w = int(350 * value * smooth((t - i * 0.15) / 0.9))
        rounded(draw, (x + 330, yy + 5, x + 330 + fill_w, yy + 32), 14, RED)


def final_pack(draw, t):
    labels = ["Verified instructors", "SmartMatch", "Secure checkout", "Synced calendars", "Live routes", "Progress reviews", "Instructor tools"]
    start_x = 200
    for i, label in enumerate(labels):
        x = start_x + (i % 4) * 390
        y = 650 + (i // 4) * 90
        a = int(230 * smooth((t - i * 0.08) / 0.45))
        rounded(draw, (x, y, x + 320, y + 54), 27, (255, 255, 255, a // 8), (255, 255, 255, a // 4), 1)
        draw.text((x + 24, y + 14), label, font=F24, fill=(245, 245, 245, a))


def frame_at(t: float) -> Image.Image:
    if t < 4:
        local = t
        img = dark_base(t)
        draw = ImageDraw.Draw(img, "RGBA")
        scene_wipe(img, local, dark=True)
        sweep = int(-450 + ease(local / 3.2) * 2450)
        draw.polygon([(sweep, 0), (sweep + 420, 0), (sweep - 240, H), (sweep - 660, H)], fill=(255, 255, 255, 18))
        scale = 0.86 + 0.045 * ease(local / 3.0)
        paste_logo(img, int(W / 2 - LOGO.width * scale / 2), 235, scale)
        cinematic_reveal(draw, 360, 560, "A smarter way to learn to drive.", F82, local, 0.35)
        cinematic_reveal(draw, 585, 675, "Click. Learn. Drive.", F42, local, 1.0, RED)
        centered(draw, W // 2, 820, "Learners, instructors, bookings, payments and progress in one connected platform.", F30, (226, 226, 232))
        return polished_finish(img, t, True)

    if t < 8:
        local = t - 4
        img = light_base(t)
        draw = ImageDraw.Draw(img, "RGBA")
        scene_wipe(img, local)
        photo = photo_panel(t, (920, 120, 1820, 930), 60)
        img.paste(photo, (920, 120))
        draw.rectangle((920, 120, 1820, 930), outline=(RED[0], RED[1], RED[2], 130), width=4)
        badge(draw, 140, 135, "THE PROBLEM")
        draw_wrapped(draw, (140, 225), "Booking lessons should not feel fragmented.", F82, 760, INK, 16)
        draw_wrapped(draw, (145, 500), "Learners need trust, clarity and progress. Instructors need reliable bookings, diary control and payment confidence.", F30, 750, (60, 60, 66), 11)
        small_card(draw, 150, 740, 510, "Learners", "Find the right instructor and know what happens next.", 0.25, local)
        small_card(draw, 690, 740, 510, "Instructors", "Manage bookings, availability and learner progress.", 0.5, local)
        stat_tile(draw, 1245, 745, "1", "joined-up journey", local, 0.75)
        return polished_finish(img, t)

    if t < 12:
        local = t - 8
        img = dark_base(t)
        draw = ImageDraw.Draw(img, "RGBA")
        scene_wipe(img, local, dark=True)
        paste_logo(img, 1260, 95, 0.55)
        badge(draw, 120, 145, "SMARTMATCH", True)
        draw_wrapped(draw, (120, 235), "The right instructor, matched faster.", F82, 840, WHITE, 14)
        draw_wrapped(draw, (125, 475), "LDA combines location, schedule, transmission, price and verified instructor profiles into one guided search.", F30, 805, MUTED, 10)
        chips = [("Location", 1050, 350), ("Availability", 1280, 275), ("Transmission", 1450, 420), ("Price", 1180, 560), ("Verified ADI", 1480, 635)]
        for i, (label, x, y) in enumerate(chips):
            a = int(255 * smooth((local - i * 0.14) / 0.45))
            rounded(draw, (x, y, x + 265, y + 74), 37, (255, 255, 255, a // 10), (255, 255, 255, a // 3), 2)
            draw.ellipse((x + 28, y + 25, x + 48, y + 45), fill=(RED[0], RED[1], RED[2], a))
            draw.text((x + 65, y + 22), label, font=F30, fill=(255, 255, 255, a))
        stat_tile(draw, 1060, 765, "ADI", "verified instructors", local, 0.9, True)
        stat_tile(draw, 1365, 765, "LIVE", "availability signals", local, 1.05, True)
        return polished_finish(img, t, True)

    if t < 16:
        local = t - 12
        img = light_base(t)
        draw = ImageDraw.Draw(img, "RGBA")
        scene_wipe(img, local)
        phone_mockup(draw, 1290, 150, local, "Lesson confirmed")
        badge(draw, 140, 145, "CONNECTED BOOKING")
        draw_wrapped(draw, (140, 235), "Checkout, calendars and notifications move together.", F82, 900, INK, 14)
        small_card(draw, 150, 670, 500, "Stripe checkout", "Secure payments, subscriptions and promo code support.", 0.2, local)
        small_card(draw, 680, 670, 500, "Calendar sync", "Learner and instructor see the same booking state.", 0.45, local)
        stat_tile(draw, 715, 430, "2", "calendars updated", local, 0.75)
        return polished_finish(img, t)

    if t < 20:
        local = t - 16
        img = dark_base(t)
        draw = ImageDraw.Draw(img, "RGBA")
        scene_wipe(img, local, dark=True)
        route_map(draw, 1040, 180, local)
        badge(draw, 120, 145, "LIVE LESSON FLOW", True)
        draw_wrapped(draw, (120, 235), "Live route tracking, limited to the lesson.", F82, 780, WHITE, 14)
        draw_wrapped(draw, (125, 500), "The learner sees the accepted instructor route. The instructor routes to the pickup pin. Location access expires after the lesson window.", F30, 800, MUTED, 10)
        stat_tile(draw, 155, 720, "ROADS", "not straight-line tracking", local, 0.7, True)
        return polished_finish(img, t, True)

    if t < 24:
        local = t - 20
        img = light_base(t)
        draw = ImageDraw.Draw(img, "RGBA")
        scene_wipe(img, local)
        progress_board(draw, 1035, 240, local)
        badge(draw, 140, 145, "AFTER EVERY LESSON")
        draw_wrapped(draw, (140, 235), "Progress becomes visible.", F82, 780, INK, 14)
        draw_wrapped(draw, (145, 465), "Instructor reviews, learner notes, test readiness and next steps stay connected to the learner journey.", F30, 760, (60, 60, 66), 10)
        stat_tile(draw, 150, 710, "100%", "test readiness pathway", local, 1.0)
        return polished_finish(img, t)

    if t < 27:
        local = t - 24
        img = dark_base(t)
        draw = ImageDraw.Draw(img, "RGBA")
        scene_wipe(img, local, dark=True)
        badge(draw, 120, 145, "INSTRUCTOR OPERATIONS", True)
        draw_wrapped(draw, (120, 235), "A working dashboard for independent instructors.", F82, 940, WHITE, 14)
        cards = [
            ("Availability", "Log on, add slots, accept on-demand work."),
            ("Compliance", "ADI, vehicle, insurance and safety records."),
            ("Earnings", "Payouts, tax profile and performance metrics."),
        ]
        for i, (title, body) in enumerate(cards):
            small_card(draw, 170 + i * 565, 720, 500, title, body, i * 0.18, local)
        stat_tile(draw, 1260, 250, "ADMIN", "secure platform oversight", local, 0.85, True)
        return polished_finish(img, t, True)

    local = t - 27
    img = dark_base(t)
    draw = ImageDraw.Draw(img, "RGBA")
    scene_wipe(img, local, dark=True)
    paste_logo(img, int(W / 2 - LOGO.width * 0.78 / 2), 195, 0.78)
    centered(draw, W // 2, 510, "Built to scale trust in driving lessons.", F64, WHITE)
    centered(draw, W // 2, 600, "For learners. For instructors. For a safer marketplace.", F38, MUTED)
    final_pack(draw, local)
    centered(draw, W // 2, 860, "LDA", F156, WHITE)
    centered(draw, W // 2, 965, "Click. Learn. Drive.", F42, RED)
    return polished_finish(img, t, True)


def write_audio(path: Path):
    sample_rate = 48000
    total = sample_rate * DURATION
    audio = np.zeros(total, dtype=np.float32)
    chords = [(82, 123, 164, 246), (98, 147, 196, 294), (110, 165, 220, 330), (73, 110, 146, 220)]
    for i in range(total):
        sec = i / sample_rate
        chord = chords[int(sec // 7.5) % len(chords)]
        env = min(1.0, sec / 2.0, (DURATION - sec) / 2.2)
        pad = sum(math.sin(2 * math.pi * f * sec) for f in chord) / len(chord)
        pulse = 0.35 + 0.65 * max(0, math.sin(2 * math.pi * 0.75 * sec))
        kick = math.exp(-((sec % 1.0) * 8.5)) * math.sin(2 * math.pi * 55 * sec)
        shimmer = 0.25 * math.sin(2 * math.pi * (880 + 60 * math.sin(sec)) * sec)
        audio[i] = env * (0.052 * pad * pulse + 0.018 * kick + 0.006 * shimmer)
    audio_int = np.clip(audio * 32767, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(audio_int.tobytes())


def render_contact_sheet(path: Path):
    times = [1.2, 5.5, 9.8, 14.0, 18.2, 22.2, 25.5, 28.5]
    sheet = Image.new("RGB", (1920, 540), (8, 8, 9))
    for idx, time in enumerate(times):
        thumb = frame_at(time).resize((480, 270), Image.Resampling.LANCZOS)
        sheet.paste(thumb, ((idx % 4) * 480, (idx // 4) * 270))
    sheet.save(path, quality=92)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    if not FFMPEG.exists():
        raise FileNotFoundError(f"FFmpeg was not found at {FFMPEG}")

    audio = TMP_DIR / "lda-tv-advert-bed.wav"
    out = OUT_DIR / "LDA-tv-investor-advert-30s.mp4"
    poster = OUT_DIR / "LDA-tv-investor-advert-poster.png"
    contact = OUT_DIR / "LDA-tv-investor-advert-contact-sheet.jpg"
    write_audio(audio)

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
        str(audio),
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
        "160k",
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

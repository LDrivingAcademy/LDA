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
TMP_DIR = ROOT / ".tmp" / "lda-premium-investor-film"
FFMPEG = ROOT / ".tmp" / "ad-tools" / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"

W, H = 1920, 1080
FPS = 24
DURATION = 75
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


def scene_index(t: float) -> tuple[int, float]:
    cuts = [0, 6, 12, 19, 26, 33, 40, 47, 54, 61, 68, 75]
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
        paste_logo(img, int(W / 2 - LOGO.width * 0.9 / 2), 250, 0.9)
        center(draw, W // 2, 575, "The future of driver education.", F68, WHITE)
        center(draw, W // 2, 655, "A connected platform for learners, instructors and operators.", F30, MUTED)
        pill(draw, 780, 765, "INVESTOR FILM", local, 1.2)

    elif idx == 1:
        reveal(draw, 130, 175, "An industry still held together by calls, diaries and guesswork.", F68, local, 0.1, WHITE, 930)
        reveal(draw, 135, 475, "LDA turns that fragmented journey into a single digital operating layer.", F34, local, 1.0, MUTED, 780)
        for i, word in enumerate(["Search", "Book", "Pay", "Track", "Review"]):
            glass_card(draw, 1230, 160 + i * 128, 420, 86, word, None, local, i * 0.22)

    elif idx == 2:
        photo = photo_crop(780, 760, t)
        img.paste(photo, (1040, 150))
        draw.rectangle((1040, 150, 1820, 910), outline=(RED[0], RED[1], RED[2], 115), width=4)
        reveal(draw, 120, 165, "Learners and instructors connected in real time.", F68, local, 0.1, WHITE, 860)
        reveal(draw, 125, 430, "Verified profiles, live availability, pickup data, calendar states and notifications move together.", F34, local, 0.9, MUTED, 820)
        for i, label in enumerate(["Verified ADI", "Live availability", "Pickup pin", "Lesson status"]):
            pill(draw, 140 + i * 270, 710, label, local, 1.2 + i * 0.15)

    elif idx == 3:
        phone(draw, 1280, 150, local)
        reveal(draw, 120, 160, "A premium booking flow.", F88, local, 0.05, WHITE, 760)
        reveal(draw, 125, 405, "Search. Select. Checkout. Confirmation. Calendar sync. All designed as one motion.", F34, local, 0.8, MUTED, 780)
        glass_card(draw, 130, 690, 410, 150, "Secure checkout", "Stripe handles card payments, subscriptions and promotion logic.", local, 1.1)
        glass_card(draw, 580, 690, 410, 150, "Synced records", "Learner and instructor see the same booking state.", local, 1.35, BLUE)

    elif idx == 4:
        reveal(draw, 120, 160, "SmartMatch becomes the marketplace intelligence layer.", F68, local, 0.05, WHITE, 900)
        reveal(draw, 125, 405, "Distance, availability, transmission, price, ratings and future AI signals can shape the match.", F34, local, 0.8, MUTED, 840)
        labels = ["Location", "Availability", "Transmission", "Price", "Reviews", "AI readiness"]
        for i, label in enumerate(labels):
            x = 1080 + (i % 2) * 315
            y = 170 + (i // 2) * 180
            glass_card(draw, x, y, 270, 115, label, "weighted signal", local, i * 0.16, BLUE if i % 2 else RED)
        draw.line((1000, 705, 1720, 705), fill=(255, 255, 255, 34), width=3)
        draw.ellipse((985 + int(700 * smooth(local / 5.5)), 686, 1027 + int(700 * smooth(local / 5.5)), 728), fill=RED)

    elif idx == 5:
        map_panel(draw, 1010, 165, 760, 650, local, "Learner and instructor live route")
        reveal(draw, 120, 160, "Maps that behave like real journeys.", F68, local, 0.05, WHITE, 790)
        reveal(draw, 125, 405, "Routes follow roads, not straight lines. Location is used during the lesson window, then expires.", F34, local, 0.8, MUTED, 820)
        glass_card(draw, 130, 720, 420, 135, "Safety by design", "Live visibility for lesson operations and support.", local, 1.3, GREEN)

    elif idx == 6:
        reveal(draw, 120, 155, "An instructor operating system.", F88, local, 0.05, WHITE, 890)
        reveal(draw, 125, 410, "Availability, on-demand work, pupil records, progress notes, compliance, finance and performance in one place.", F34, local, 0.85, MUTED, 850)
        cards = [("Log on", "enter the work pool"), ("Diary", "slots and accepted bookings"), ("Compliance", "ADI and vehicle evidence"), ("Progress", "after-lesson reviews")]
        for i, (a, b) in enumerate(cards):
            glass_card(draw, 1040 + (i % 2) * 360, 170 + (i // 2) * 220, 310, 150, a, b, local, i * 0.16)

    elif idx == 7:
        dashboard(draw, 970, 215, local, "finance")
        reveal(draw, 120, 160, "A monetisation model built into the product.", F68, local, 0.05, WHITE, 860)
        reveal(draw, 125, 405, "Lesson payments, learner subscriptions, instructor economics, refunds and disputes can be monitored from the platform layer.", F34, local, 0.85, MUTED, 830)
        pill(draw, 135, 720, "Stripe secure payments", local, 1.2)
        pill(draw, 445, 720, "Recurring subscriptions", local, 1.45)

    elif idx == 8:
        dashboard(draw, 980, 210, local, "admin")
        reveal(draw, 120, 155, "Admin intelligence at the centre.", F88, local, 0.05, WHITE, 850)
        reveal(draw, 125, 415, "Live bookings, revenue, payouts, refunds, compliance status, account warnings and marketplace health become visible.", F34, local, 0.85, MUTED, 820)
        for i, label in enumerate(["MFA", "Role gates", "Secure records", "Live metrics"]):
            pill(draw, 135 + i * 235, 740, label, local, 1.2 + i * 0.12)

    elif idx == 9:
        reveal(draw, 120, 150, "The next layer is AI.", F112, local, 0.05, WHITE, 850)
        reveal(draw, 125, 390, "Smarter matching, faster document verification, better support responses and predictive learner progress.", F34, local, 0.85, MUTED, 860)
        for i in range(18):
            a = int(140 * smooth((local - i * 0.05) / 0.6))
            cx = 1050 + int(330 * math.cos(i * 1.7 + local * 0.45))
            cy = 510 + int(255 * math.sin(i * 1.2 + local * 0.38))
            draw.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill=(BLUE[0], BLUE[1], BLUE[2], a))
            if i:
                px = 1050 + int(330 * math.cos((i - 1) * 1.7 + local * 0.45))
                py = 510 + int(255 * math.sin((i - 1) * 1.2 + local * 0.38))
                draw.line((px, py, cx, cy), fill=(255, 255, 255, a // 3), width=2)

    elif idx == 10:
        paste_logo(img, int(W / 2 - LOGO.width * 0.95 / 2), 160, 0.95)
        center(draw, W // 2, 465, "Not another driving school.", F68, WHITE)
        center(draw, W // 2, 545, "Infrastructure for the future of driver education.", F42, MUTED)
        for i, label in enumerate(["Trust", "Safety", "Scale", "Data", "AI", "Revenue"]):
            pill(draw, 310 + i * 220, 685, label, local, i * 0.12)
        center(draw, W // 2, 900, "Built for the road ahead.", F54, WHITE)

    return finish(img, t)


VOICEOVER = """Driver education is still fragmented.
LDA is building the connected operating system for learners and independent instructors.
From the first search to the final progress review, every step is joined up.
Learners compare verified instructors, book securely, track the route, and see progress after each lesson.
Instructors manage availability, on demand work, compliance, earnings, and learner records from one focused workspace.
Behind it is a data layer for live maps, calendars, notifications, payments, subscriptions, and platform oversight.
Stripe powers secure checkout and recurring revenue.
Admin intelligence monitors bookings, refunds, compliance, safety signals, and marketplace health.
The next layer is AI: smarter matching, faster verification, better support, and predictive learning progress.
LDA is not another driving school.
It is infrastructure for the future of driver education.
Built for trust. Built for scale. Built for the road ahead."""


def write_music(path: Path):
    sample_rate = 48000
    total = sample_rate * DURATION
    audio = np.zeros(total, dtype=np.float32)
    chords = [(55, 82, 110, 164), (65, 98, 130, 196), (73, 110, 146, 220), (82, 123, 164, 246)]
    for i in range(total):
        sec = i / sample_rate
        chord = chords[int(sec // 18.75) % len(chords)]
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
    ps1 = TMP_DIR / "voiceover.ps1"
    safe_text = VOICEOVER.replace("'", "''")
    ps1.write_text(
        "\n".join(
            [
                "Add-Type -AssemblyName System.Speech",
                "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
                "$voice = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq 'en-GB' } | Select-Object -First 1",
                "if ($voice) { $s.SelectVoice($voice.VoiceInfo.Name) }",
                "$s.Rate = -1",
                "$s.Volume = 100",
                f"$s.SetOutputToWaveFile('{str(path).replace(chr(92), chr(92)+chr(92))}')",
                f"$s.Speak('{safe_text}')",
                "$s.Dispose()",
            ]
        ),
        encoding="utf-8",
    )
    subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps1)], check=True)


def render_contact_sheet(path: Path):
    times = [2, 9, 15, 23, 30, 37, 44, 51, 58, 65, 71]
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
    voice = TMP_DIR / "voiceover.wav"
    mixed = TMP_DIR / "mixed.wav"
    out = OUT_DIR / "LDA-premium-investor-film-75s.mp4"
    poster = OUT_DIR / "LDA-premium-investor-film-poster.png"
    contact = OUT_DIR / "LDA-premium-investor-film-contact-sheet.jpg"

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
            "[0:a]volume=0.42[a0];[1:a]volume=1.0,adelay=950|950[a1];[a0][a1]amix=inputs=2:duration=longest:dropout_transition=0,atrim=0:75,afade=t=out:st=72:d=3",
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

from __future__ import annotations

import math
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUT_DIR = ROOT / "output" / "adverts"
TMP_DIR = ROOT / ".tmp" / "lda-investor-advert"
FFMPEG = ROOT / ".tmp" / "ad-tools" / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"

W, H = 1920, 1080
FPS = 24
DURATION = 20
TOTAL_FRAMES = FPS * DURATION

RED = (224, 17, 31)
BLACK = (6, 6, 7)
DARK = (15, 15, 17)
WHITE = (250, 250, 250)
MUTED = (190, 190, 194)
CARD = (247, 247, 247)
INK = (18, 18, 20)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


FONT_28 = font(28)
FONT_30 = font(30)
FONT_34 = font(34, True)
FONT_36 = font(36, True)
FONT_42 = font(42, True)
FONT_48 = font(48, True)
FONT_58 = font(58, True)
FONT_72 = font(72, True)
FONT_96 = font(96, True)
FONT_126 = font(126, True)


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def smooth(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def draw_centered(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fnt, fill=WHITE):
    tw, th = text_size(draw, text, fnt)
    draw.text((xy[0] - tw / 2, xy[1] - th / 2), text, font=fnt, fill=fill)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if text_size(draw, trial, fnt)[0] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fnt, max_width: int, fill=WHITE, line_gap=12):
    x, y = xy
    for line in wrap_text(draw, text, fnt, max_width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += text_size(draw, line, fnt)[1] + line_gap
    return y


def rounded_rect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def load_logo() -> Image.Image:
    logo = Image.open(PUBLIC / "lda-canonical-logo.png").convert("RGBA")
    logo.thumbnail((520, 170), Image.Resampling.LANCZOS)
    return logo


def load_photo() -> Image.Image:
    photo = Image.open(PUBLIC / "learner-instructor.jpg").convert("RGB")
    photo = photo.resize((1050, 700), Image.Resampling.LANCZOS)
    return photo


LOGO = load_logo()
PHOTO = load_photo()


def base_dark(t: float) -> Image.Image:
    arr = np.zeros((H, W, 3), dtype=np.uint8)
    for y in range(H):
        shade = int(7 + 18 * (y / H))
        arr[y, :, :] = (shade, shade, shade + 2)
    img = Image.fromarray(arr, "RGB")
    draw = ImageDraw.Draw(img, "RGBA")
    pulse = int(25 + 20 * math.sin(t * 0.9))
    draw.ellipse((1250, -340, 2300, 710), fill=(RED[0], RED[1], RED[2], pulse))
    draw.ellipse((-440, 600, 720, 1600), fill=(255, 255, 255, 10))
    draw.line((0, 880, W, 700), fill=(255, 255, 255, 18), width=2)
    return img


def base_light(t: float) -> Image.Image:
    arr = np.full((H, W, 3), 246, dtype=np.uint8)
    for y in range(H):
        shade = int(248 - 18 * (y / H))
        arr[y, :, :] = (shade, shade, shade)
    img = Image.fromarray(arr, "RGB")
    draw = ImageDraw.Draw(img, "RGBA")
    draw.ellipse((1230, -420, 2200, 520), fill=(RED[0], RED[1], RED[2], 22))
    draw.ellipse((-500, 720, 600, 1600), fill=(0, 0, 0, 12))
    return img


def paste_logo(img: Image.Image, x: int, y: int, scale: float = 1.0):
    logo = LOGO.copy()
    if scale != 1.0:
        logo = logo.resize((int(logo.width * scale), int(logo.height * scale)), Image.Resampling.LANCZOS)
    img.paste(logo, (x, y), logo)


def draw_badge(draw, x: int, y: int, text: str, dark=False):
    fill = (255, 255, 255, 24) if dark else (255, 235, 236, 255)
    outline = (RED[0], RED[1], RED[2], 180)
    text_fill = WHITE if dark else RED
    tw, th = text_size(draw, text, FONT_28)
    rounded_rect(draw, (x, y, x + tw + 44, y + 50), 25, fill, outline, 2)
    draw.text((x + 22, y + 11), text, font=FONT_28, fill=text_fill)


def draw_feature_card(img: Image.Image, x: int, y: int, title: str, body: str, icon: str, delay: float, local_t: float, width: int = 470, height: int = 235):
    dy = int((1 - ease((local_t - delay) / 0.55)) * 70)
    alpha = int(255 * smooth((local_t - delay) / 0.45))
    if alpha <= 0:
        return
    draw = ImageDraw.Draw(img, "RGBA")
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay, "RGBA")
    shadow = int(alpha * 0.16)
    rounded_rect(od, (x + 10, y + 14 + dy, x + width + 10, y + height + 14 + dy), 18, (0, 0, 0, shadow))
    rounded_rect(od, (x, y + dy, x + width, y + height + dy), 18, (255, 255, 255, alpha), (225, 225, 225, alpha), 2)
    od.rounded_rectangle((x + 34, y + 34 + dy, x + 104, y + 104 + dy), 14, fill=(255, 235, 236, alpha))
    draw_icon(od, icon, x + 69, y + 69 + dy, alpha)
    od.text((x + 34, y + 132 + dy), title, font=FONT_34, fill=(INK[0], INK[1], INK[2], alpha))
    yy = y + 184 + dy
    for line in wrap_text(od, body, FONT_28, width - 70):
        od.text((x + 34, yy), line, font=FONT_28, fill=(70, 70, 74, alpha))
        yy += 37
    img.alpha_composite(overlay)


def draw_dark_feature(draw, x: int, y: int, title: str, body: str, delay: float, local_t: float):
    alpha = int(255 * smooth((local_t - delay) / 0.45))
    if alpha <= 0:
        return
    dy = int((1 - ease((local_t - delay) / 0.55)) * 45)
    rounded_rect(draw, (x, y + dy, x + 520, y + 170 + dy), 18, (255, 255, 255, alpha // 11), (255, 255, 255, alpha // 4), 2)
    draw.ellipse((x + 36, y + 45 + dy, x + 58, y + 67 + dy), fill=(RED[0], RED[1], RED[2], alpha))
    draw.text((x + 85, y + 28 + dy), title, font=FONT_36, fill=(255, 255, 255, alpha))
    yy = y + 82 + dy
    for line in wrap_text(draw, body, FONT_28, 380):
        draw.text((x + 85, yy), line, font=FONT_28, fill=(205, 205, 210, alpha))
        yy += 36


def draw_icon(draw, kind: str, cx: int, cy: int, alpha=255):
    col = (RED[0], RED[1], RED[2], alpha)
    if kind == "pin":
        draw.ellipse((cx - 16, cy - 20, cx + 16, cy + 12), outline=col, width=5)
        draw.ellipse((cx - 5, cy - 9, cx + 5, cy + 1), fill=col)
        draw.polygon([(cx, cy + 34), (cx - 15, cy + 7), (cx + 15, cy + 7)], fill=col)
    elif kind == "shield":
        draw.polygon([(cx, cy - 30), (cx + 28, cy - 15), (cx + 20, cy + 28), (cx, cy + 38), (cx - 20, cy + 28), (cx - 28, cy - 15)], outline=col, width=5)
        draw.line((cx - 13, cy + 3, cx - 2, cy + 15, cx + 18, cy - 11), fill=col, width=5)
    elif kind == "calendar":
        draw.rounded_rectangle((cx - 32, cy - 28, cx + 32, cy + 34), 8, outline=col, width=5)
        draw.line((cx - 32, cy - 8, cx + 32, cy - 8), fill=col, width=5)
        draw.line((cx - 16, cy - 38, cx - 16, cy - 18), fill=col, width=5)
        draw.line((cx + 16, cy - 38, cx + 16, cy - 18), fill=col, width=5)
    elif kind == "route":
        draw.line((cx - 34, cy + 20, cx - 10, cy - 18, cx + 15, cy + 10, cx + 34, cy - 24), fill=col, width=6)
        for px, py in [(cx - 34, cy + 20), (cx - 10, cy - 18), (cx + 34, cy - 24)]:
            draw.ellipse((px - 7, py - 7, px + 7, py + 7), fill=col)
    else:
        draw.ellipse((cx - 30, cy - 30, cx + 30, cy + 30), outline=col, width=5)
        draw.line((cx - 12, cy, cx - 1, cy + 12, cx + 18, cy - 16), fill=col, width=5)


def frame_at(t: float) -> Image.Image:
    if t < 3.0:
        img = base_dark(t)
        draw = ImageDraw.Draw(img, "RGBA")
        fade = smooth(t / 0.7) * smooth((3.0 - t) / 0.5)
        scale = 0.85 + 0.06 * ease(t / 2.5)
        paste_logo(img, int(W / 2 - LOGO.width * scale / 2), 270, scale)
        draw_centered(draw, (W // 2, 585), "A smarter way to book driving lessons.", FONT_72, (255, 255, 255, int(255 * fade)))
        draw_centered(draw, (W // 2, 675), "Verified instructors. Live journeys. Connected learning.", FONT_42, (220, 220, 225, int(230 * fade)))
        return img

    if t < 7.0:
        local = t - 3.0
        img = base_light(t)
        draw = ImageDraw.Draw(img, "RGBA")
        photo = PHOTO.copy()
        photo = photo.filter(ImageFilter.GaussianBlur(radius=0.2))
        px = 980 + int(60 * (1 - ease(local / 1.1)))
        py = 190
        img.paste(photo, (px, py))
        draw.rectangle((px, py, px + photo.width, py + photo.height), fill=(0, 0, 0, 70))
        draw_badge(draw, 150, 150, "SMARTMATCH")
        draw_wrapped(draw, (150, 230), "Match learners with the right verified instructor.", FONT_72, 745, INK, 14)
        draw_wrapped(draw, (155, 475), "LDA compares availability, location, vehicle transmission, pricing and learner preferences in one structured booking flow.", FONT_30, 720, (64, 64, 68), 10)
        img = img.convert("RGBA")
        draw_feature_card(img, 160, 730, "Verified supply", "Approved instructor profiles and clear learner choice.", "shield", 0.3, local, 440, 220)
        draw_feature_card(img, 630, 730, "Better fit", "Distance, availability, price and preferences aligned.", "pin", 0.55, local, 440, 220)
        img = img.convert("RGB")
        return img

    if t < 11.0:
        local = t - 7.0
        img = base_dark(t)
        draw = ImageDraw.Draw(img, "RGBA")
        paste_logo(img, 120, 95, 0.55)
        draw_badge(draw, 120, 255, "CONNECTED BOOKINGS", True)
        draw_wrapped(draw, (120, 330), "One booking creates the full journey.", FONT_72, 750, WHITE, 18)
        draw_wrapped(draw, (125, 585), "Checkout, notifications and calendars stay connected for learners and instructors.", FONT_34, 710, (215, 215, 220), 10)
        items = [
            ("Secure checkout", "Stripe payments, subscriptions and promo codes."),
            ("Synced calendars", "Both sides see the same lesson status."),
            ("Instant alerts", "Email and hub notifications keep everyone updated."),
        ]
        for i, (title, body) in enumerate(items):
            draw_dark_feature(draw, 1160, 330 + i * 205, title, body, i * 0.22, local)
        return img

    if t < 15.0:
        local = t - 11.0
        img = base_light(t)
        draw = ImageDraw.Draw(img, "RGBA")
        draw_badge(draw, 140, 135, "LIVE LESSON FLOW")
        draw_wrapped(draw, (140, 210), "Live route guidance, protected by the lesson window.", FONT_72, 780, INK, 14)
        draw_wrapped(draw, (145, 455), "Learners can track an accepted lesson journey. Instructors only keep location access while the lesson is active.", FONT_30, 760, (64, 64, 68), 10)
        map_box = (1030, 140, 1780, 860)
        rounded_rect(draw, map_box, 22, (24, 24, 26), (220, 220, 220), 2)
        mx1, my1, mx2, my2 = map_box
        for i in range(9):
            x = mx1 + 50 + i * 80
            draw.line((x, my1 + 30, x - 200, my2 - 30), fill=(85, 85, 90), width=3)
        for i in range(7):
            y = my1 + 80 + i * 90
            draw.line((mx1 + 40, y, mx2 - 40, y + 60 * math.sin(i)), fill=(70, 70, 76), width=3)
        route = [(1100, 760), (1190, 670), (1270, 610), (1370, 610), (1465, 510), (1540, 430), (1650, 350), (1720, 270)]
        progress = smooth(local / 2.4)
        visible = max(2, int(2 + progress * (len(route) - 2)))
        draw.line(route[:visible], fill=(RED[0], RED[1], RED[2], 255), width=12, joint="curve")
        pos = route[min(visible - 1, len(route) - 1)]
        draw.ellipse((pos[0] - 22, pos[1] - 22, pos[0] + 22, pos[1] + 22), fill=RED)
        draw.ellipse((1710, 260, 1734, 284), fill=WHITE)
        draw.text((1095, 890), "Location access expires after the lesson window.", font=FONT_34, fill=INK)
        img = img.convert("RGBA")
        draw_feature_card(img, 155, 715, "Live tracking", "Road-based route guidance to the learner pickup point.", "route", 0.3, local, 455, 220)
        draw_feature_card(img, 640, 715, "Privacy by design", "Journey location is limited to the lesson window.", "shield", 0.6, local, 455, 220)
        img = img.convert("RGB")
        return img

    if t < 18.0:
        local = t - 15.0
        img = base_dark(t)
        draw = ImageDraw.Draw(img, "RGBA")
        draw_badge(draw, 120, 145, "AFTER THE LESSON", True)
        draw_wrapped(draw, (120, 235), "A complete workspace after every lesson.", FONT_72, 820, WHITE, 14)
        draw_wrapped(draw, (125, 450), "Learners get clearer progress. Instructors get one place to manage diary, compliance and performance.", FONT_34, 820, (215, 215, 220), 10)
        panels = [
            ("Progress notes", "Instructor feedback learners can review."),
            ("Test readiness", "Evidence-led confidence before booking."),
            ("Instructor workspace", "Diary, compliance, payouts and performance."),
        ]
        for i, (title, body) in enumerate(panels):
            x = 120 + i * 590
            y = 735 - int(50 * ease((local - i * 0.2) / 0.5))
            alpha = int(255 * smooth((local - i * 0.2) / 0.5))
            rounded_rect(draw, (x, y, x + 520, y + 215), 18, (255, 255, 255, alpha), (255, 255, 255, alpha), 1)
            draw.text((x + 34, y + 40), title, font=FONT_42, fill=(INK[0], INK[1], INK[2], alpha))
            draw_wrapped(draw, (x + 34, y + 102), body, FONT_28, 440, (70, 70, 74, alpha), 8)
        return img

    img = base_dark(t)
    draw = ImageDraw.Draw(img, "RGBA")
    fade = smooth((t - 18) / 0.5)
    paste_logo(img, int(W / 2 - LOGO.width * 0.8 / 2), 230, 0.8)
    draw_centered(draw, (W // 2, 570), "Built for learners. Built for instructors.", FONT_58, (255, 255, 255, int(255 * fade)))
    draw_centered(draw, (W // 2, 650), "Built to scale trust, safety and confidence.", FONT_48, (215, 215, 220, int(245 * fade)))
    draw_centered(draw, (W // 2, 820), "LDA", FONT_126, (255, 255, 255, int(255 * fade)))
    draw_centered(draw, (W // 2, 930), "Click. Learn. Drive.", FONT_42, (RED[0], RED[1], RED[2], int(255 * fade)))
    return img


def write_audio(path: Path):
    sample_rate = 48000
    total = sample_rate * DURATION
    audio = np.zeros(total, dtype=np.float32)
    chords = [(110, 165, 220), (98, 147, 196), (130, 195, 260), (146, 219, 292)]
    for i in range(total):
        sec = i / sample_rate
        chord = chords[int(sec // 5) % len(chords)]
        env = min(1.0, sec / 1.5, (DURATION - sec) / 1.3)
        wave_val = sum(math.sin(2 * math.pi * f * sec) for f in chord) / len(chord)
        beat = 0.45 + 0.55 * max(0, math.sin(2 * math.pi * 1.2 * sec))
        audio[i] = 0.055 * env * beat * wave_val
    audio_int = np.clip(audio * 32767, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(audio_int.tobytes())


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    if not FFMPEG.exists():
        raise FileNotFoundError(f"FFmpeg was not found at {FFMPEG}")

    audio = TMP_DIR / "lda-advert-bed.wav"
    out = OUT_DIR / "LDA-investor-advert-20s.mp4"
    poster = OUT_DIR / "LDA-investor-advert-poster.png"
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
        "18",
        "-preset",
        "medium",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
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
    print(out)
    print(poster)


if __name__ == "__main__":
    main()

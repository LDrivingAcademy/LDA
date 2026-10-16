from collections import deque
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps


source = Path("public/lda-logo-clarity-110-transparent.png")
transparent_output = Path("previews/lda-logo-matched-da-transparent.png")
preview_output = Path("previews/lda-logo-matched-da-on-black.jpg")

image = Image.open(source).convert("RGBA")
width, height = image.size
alpha = image.getchannel("A")

top_limit = int(height * 0.62)
mask = alpha.point(lambda value: 255 if value > 24 else 0)
mask_pixels = mask.load()
visited = set()
components = []

for y in range(0, top_limit, 4):
    for x in range(0, width, 4):
        if mask_pixels[x, y] == 0 or (x, y) in visited:
            continue

        queue = deque([(x, y)])
        visited.add((x, y))
        min_x = max_x = x
        min_y = max_y = y
        count = 0

        while queue:
            cx, cy = queue.popleft()
            count += 1
            min_x = min(min_x, cx)
            max_x = max(max_x, cx)
            min_y = min(min_y, cy)
            max_y = max(max_y, cy)

            for nx, ny in ((cx + 4, cy), (cx - 4, cy), (cx, cy + 4), (cx, cy - 4)):
                if nx < 0 or nx >= width or ny < 0 or ny >= top_limit:
                    continue
                if (nx, ny) in visited or mask_pixels[nx, ny] == 0:
                    continue
                visited.add((nx, ny))
                queue.append((nx, ny))

        if count > 100:
            components.append((min_x, min_y, max_x, max_y, count))

components.sort(key=lambda item: item[0])
letter_components = [component for component in components if component[4] > 9000]

if len(letter_components) < 3:
    raise RuntimeError(f"Could not find L, D, and A components: {letter_components}")

d_box = letter_components[1][:4]
a_box = letter_components[2][:4]

def pad_box(box, pad):
    left, top, right, bottom = box
    return (
        max(0, left - pad),
        max(0, top - pad),
        min(width, right + pad),
        min(height, bottom + pad),
    )


d_box = pad_box(d_box, 18)
a_box = pad_box(a_box, 18)
combined_box = (
    min(d_box[0], a_box[0]),
    min(d_box[1], a_box[1]),
    max(d_box[2], a_box[2]),
    max(d_box[3], a_box[3]),
)

rgb = image.convert("RGB")
combined_alpha = alpha.crop(combined_box)
combined_rgb = rgb.crop(combined_box)
combined_gray = ImageOps.grayscale(combined_rgb)
combined_gray = ImageOps.autocontrast(combined_gray, cutoff=0.4)
combined_gray = combined_gray.filter(ImageFilter.UnsharpMask(radius=1.2, percent=145, threshold=2))
combined_gray = ImageEnhance.Contrast(combined_gray).enhance(1.06)

silver_rgb = Image.merge("RGB", (combined_gray, combined_gray, combined_gray))
rgb.paste(silver_rgb, combined_box, combined_alpha)

result = rgb.convert("RGBA")
result.putalpha(alpha)
transparent_output.parent.mkdir(parents=True, exist_ok=True)
result.save(transparent_output, optimize=True)

preview = Image.new("RGBA", result.size, (0, 0, 0, 255))
preview.alpha_composite(result)
chat_preview = preview.convert("RGB")
chat_preview.thumbnail((1100, 1100), Image.Resampling.LANCZOS)
chat_preview.save(preview_output, quality=95, optimize=True)

print(f"D box: {d_box}")
print(f"A box: {a_box}")
print(transparent_output.resolve())
print(preview_output.resolve())

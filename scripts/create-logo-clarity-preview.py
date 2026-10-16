import math
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageEnhance, ImageFilter


source_pdf = Path("public/lda-academy-logo-2026-black-background.pdf")
transparent_output = Path("previews/lda-logo-clarity-110-transparent.png")
preview_output = Path("previews/lda-logo-clarity-110-on-black.png")

canvas_size = 4096
working_size = 8192
scale_up = 1.1


def remove_background(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    background = image.getpixel((0, 0))[:3]
    threshold = 18
    feather = 18
    pixels = []

    for red, green, blue, alpha in image.getdata():
        distance = math.sqrt(
            (red - background[0]) ** 2
            + (green - background[1]) ** 2
            + (blue - background[2]) ** 2
        )

        if distance <= threshold:
            pixels.append((red, green, blue, 0))
        elif distance <= threshold + feather:
            edge_alpha = int(255 * (distance - threshold) / feather)
            pixels.append((red, green, blue, min(alpha, edge_alpha)))
        else:
            pixels.append((red, green, blue, alpha))

    image.putdata(pixels)
    return image


def sharpen_lower_wordmark(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    alpha = image.getchannel("A")

    lower_box = (0, int(image.height * 0.55), image.width, int(image.height * 0.82))
    lower_rgb = rgb.crop(lower_box)
    lower_alpha = alpha.crop(lower_box)

    sharpened = lower_rgb.filter(ImageFilter.UnsharpMask(radius=1.6, percent=185, threshold=2))
    sharpened = ImageEnhance.Contrast(sharpened).enhance(1.08)
    sharpened = ImageEnhance.Sharpness(sharpened).enhance(1.18)

    rgb.paste(sharpened, lower_box, lower_alpha)
    rgb.putalpha(alpha)
    return rgb


pdf = pdfium.PdfDocument(str(source_pdf))
page = pdf[0]
width, _height = page.get_size()
render_scale = working_size / width
bitmap = page.render(scale=render_scale)
large = remove_background(bitmap.to_pil())

downsampled = large.resize((canvas_size, canvas_size), Image.Resampling.LANCZOS)
sharpened = sharpen_lower_wordmark(downsampled)

scaled_size = round(canvas_size * scale_up)
scaled = sharpened.resize((scaled_size, scaled_size), Image.Resampling.LANCZOS)

left = (scaled_size - canvas_size) // 2
top = (scaled_size - canvas_size) // 2
final_logo = scaled.crop((left, top, left + canvas_size, top + canvas_size))

transparent_output.parent.mkdir(parents=True, exist_ok=True)
final_logo.save(transparent_output, optimize=True)

black_preview = Image.new("RGBA", final_logo.size, (0, 0, 0, 255))
black_preview.alpha_composite(final_logo)
black_preview.save(preview_output, optimize=True)

print(transparent_output.resolve())
print(preview_output.resolve())

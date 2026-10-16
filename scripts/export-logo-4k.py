import math
from pathlib import Path

import pypdfium2 as pdfium


source_pdf = Path("public/lda-academy-logo-2026-black-background.pdf")
output_png = Path("public/lda-academy-logo-2026-transparent-4k.png")
target_size = 4096

pdf = pdfium.PdfDocument(str(source_pdf))
page = pdf[0]
width, _height = page.get_size()
scale = target_size / width

bitmap = page.render(scale=scale)
image = bitmap.to_pil().convert("RGBA")
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
image.save(output_png, optimize=True)

print(f"{output_png} {image.size[0]}x{image.size[1]} scale={scale:.4f}")

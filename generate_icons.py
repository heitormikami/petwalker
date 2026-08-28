import subprocess
import os
import time
from PIL import Image

WORKSPACE = r"c:\WorkHeitor\Prd\Programação\Petwalker"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
ASSETS_DIR = os.path.join(WORKSPACE, "assets")
SCRATCH_HTML = os.path.join(WORKSPACE, "render_icon.html")
TEMP_SCREENSHOT_FB = os.path.join(WORKSPACE, "temp_fullbleed.png")
TEMP_SCREENSHOT_TAB = os.path.join(WORKSPACE, "temp_tab.png")

# 1. Full-bleed SVG for Apple Touch Icon and PWA icons
# Background fills 100% (512x512) without external squircle, perfect for iOS squircle masking.
FULL_BLEED_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Vibrant Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7A42" />
      <stop offset="50%" stop-color="#FF5517" />
      <stop offset="100%" stop-color="#DE3804" />
    </linearGradient>

    <!-- Top Gloss Light -->
    <linearGradient id="glossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>

    <!-- Paw Symbol Gradient -->
    <linearGradient id="pawGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#FFF4ED" />
    </linearGradient>

    <!-- Accent Heart Gradient -->
    <linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7540" />
      <stop offset="100%" stop-color="#E83D08" />
    </linearGradient>

    <!-- Paw Glow Filter -->
    <filter id="pawShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#6B1600" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Full Bleed Square Background (iOS rounds this automatically) -->
  <rect x="0" y="0" width="512" height="512" fill="url(#bgGrad)" />

  <!-- Top Glass Highlight Reflection -->
  <path d="M 0 0 L 512 0 L 512 160 C 512 160 380 210 256 210 C 132 210 0 160 0 160 Z" fill="url(#glossGrad)" />

  <!-- Central Paw Emblem -->
  <g filter="url(#pawShadow)" transform="translate(0, 8)">
    <!-- Main Center Pad (Modern stylized heart-pad) -->
    <path d="M 256 260 
             C 210 260 165 295 165 350 
             C 165 395 205 425 256 425 
             C 307 425 347 395 347 350 
             C 347 295 302 260 256 260 Z" 
          fill="url(#pawGrad)" />
    
    <!-- Heart Inlay inside Main Pad -->
    <path d="M 256 322
             C 246 308 226 308 216 320
             C 204 335 208 355 226 372
             L 256 398
             L 286 372
             C 304 355 308 335 296 320
             C 286 308 266 308 256 322 Z"
          fill="url(#heartGrad)" opacity="0.95" />

    <!-- Toe 1: Far Left -->
    <ellipse cx="152" cy="225" rx="34" ry="46" transform="rotate(-28 152 225)" fill="url(#pawGrad)" />

    <!-- Toe 2: Center Left -->
    <ellipse cx="218" cy="180" rx="36" ry="52" transform="rotate(-10 218 180)" fill="url(#pawGrad)" />

    <!-- Toe 3: Center Right -->
    <ellipse cx="294" cy="180" rx="36" ry="52" transform="rotate(10 294 180)" fill="url(#pawGrad)" />

    <!-- Toe 4: Far Right -->
    <ellipse cx="360" cy="225" rx="34" ry="46" transform="rotate(28 360 225)" fill="url(#pawGrad)" />
  </g>

  <!-- Sparkle / Star in upper right corner (kept safely within iOS 20% corner radius) -->
  <path d="M 390 95 Q 390 120 365 120 Q 390 120 390 145 Q 390 120 415 120 Q 390 120 390 95 Z" fill="#FFFFFF" opacity="0.9" />
  <circle cx="390" cy="120" r="3" fill="#FFFFFF" />
</svg>
"""

# 2. Browser Tab Favicon SVG (Squircle with sleek stroke)
TAB_FAVICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Vibrant Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7A42" />
      <stop offset="50%" stop-color="#FF5517" />
      <stop offset="100%" stop-color="#DE3804" />
    </linearGradient>

    <!-- Top Gloss Light -->
    <linearGradient id="glossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>

    <!-- Paw Symbol Gradient -->
    <linearGradient id="pawGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#FFF4ED" />
    </linearGradient>

    <!-- Accent Heart Gradient -->
    <linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF7540" />
      <stop offset="100%" stop-color="#E83D08" />
    </linearGradient>

    <!-- Drop Shadow Filter -->
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#6B1600" flood-opacity="0.35" />
    </filter>
    
    <!-- Paw Glow Filter -->
    <filter id="pawShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#6B1600" flood-opacity="0.32" />
    </filter>
  </defs>

  <!-- Base Squircle with drop shadow -->
  <rect x="20" y="20" width="472" height="472" rx="108" fill="url(#bgGrad)" filter="url(#softShadow)" />

  <!-- Inner Subtle Border -->
  <rect x="22" y="22" width="468" height="468" rx="106" fill="none" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="3" />

  <!-- Top Glass Highlight Reflection -->
  <path d="M 20 128 C 20 68 68 20 128 20 L 384 20 C 444 20 492 68 492 128 C 492 165 408 190 256 190 C 104 190 20 165 20 128 Z" fill="url(#glossGrad)" />

  <!-- Central Paw Emblem -->
  <g filter="url(#pawShadow)" transform="translate(0, 10)">
    <!-- Main Center Pad -->
    <path d="M 256 260 
             C 210 260 165 295 165 350 
             C 165 395 205 425 256 425 
             C 307 425 347 395 347 350 
             C 347 295 302 260 256 260 Z" 
          fill="url(#pawGrad)" />
    
    <!-- Heart Inlay inside Main Pad -->
    <path d="M 256 322
             C 246 308 226 308 216 320
             C 204 335 208 355 226 372
             L 256 398
             L 286 372
             C 304 355 308 335 296 320
             C 286 308 266 308 256 322 Z"
          fill="url(#heartGrad)" opacity="0.95" />

    <!-- Toe 1: Far Left -->
    <ellipse cx="152" cy="225" rx="34" ry="46" transform="rotate(-28 152 225)" fill="url(#pawGrad)" />

    <!-- Toe 2: Center Left -->
    <ellipse cx="218" cy="180" rx="36" ry="52" transform="rotate(-10 218 180)" fill="url(#pawGrad)" />

    <!-- Toe 3: Center Right -->
    <ellipse cx="294" cy="180" rx="36" ry="52" transform="rotate(10 294 180)" fill="url(#pawGrad)" />

    <!-- Toe 4: Far Right -->
    <ellipse cx="360" cy="225" rx="34" ry="46" transform="rotate(28 360 225)" fill="url(#pawGrad)" />
  </g>

  <!-- Sparkle / Star in upper right corner -->
  <path d="M 395 95 Q 395 120 370 120 Q 395 120 395 145 Q 395 120 420 120 Q 395 120 395 95 Z" fill="#FFFFFF" opacity="0.9" />
  <circle cx="395" cy="120" r="3" fill="#FFFFFF" />
</svg>
"""

# Save SVGs
favicon_svg_path = os.path.join(ASSETS_DIR, "favicon.svg")
with open(favicon_svg_path, "w", encoding="utf-8") as f:
    f.write(TAB_FAVICON_SVG.strip())

def render_svg_to_png(svg_content, out_png_path, size=512):
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    html, body {{ width: {size}px; height: {size}px; overflow: hidden; background: transparent; }}
    svg {{ width: {size}px; height: {size}px; display: block; }}
  </style>
</head>
<body>
{svg_content}
</body>
</html>"""
    with open(SCRATCH_HTML, "w", encoding="utf-8") as f:
        f.write(html_content)

    url = f"file:///{os.path.abspath(SCRATCH_HTML).replace(os.sep, '/')}"
    cmd = [
        CHROME_PATH,
        "--headless=new",
        "--disable-gpu",
        "--force-device-scale-factor=1",
        f"--window-size={size},{size}",
        "--default-background-color=00000000",
        f"--screenshot={out_png_path}",
        url
    ]
    subprocess.run(cmd, check=True)

# Render base 512x512 images
print("Rendering Full Bleed icon...")
render_svg_to_png(FULL_BLEED_SVG, TEMP_SCREENSHOT_FB, 512)

print("Rendering Favicon Tab icon...")
render_svg_to_png(TAB_FAVICON_SVG, TEMP_SCREENSHOT_TAB, 512)

# Generate destination PNG files
# 1. apple-touch-icon.png (180x180 px - standard Apple touch icon)
fb_img = Image.open(TEMP_SCREENSHOT_FB).convert("RGBA")
apple_touch_img = fb_img.resize((180, 180), Image.Resampling.LANCZOS)
apple_touch_path = os.path.join(ASSETS_DIR, "apple-touch-icon.png")
apple_touch_img.save(apple_touch_path, "PNG", optimize=True)
print(f"Saved: {apple_touch_path} (180x180)")

# 2. icon-192.png (192x192)
icon_192 = fb_img.resize((192, 192), Image.Resampling.LANCZOS)
icon_192_path = os.path.join(ASSETS_DIR, "icon-192.png")
icon_192.save(icon_192_path, "PNG", optimize=True)
print(f"Saved: {icon_192_path} (192x192)")

# 3. icon-512.png (512x512)
icon_512_path = os.path.join(ASSETS_DIR, "icon-512.png")
fb_img.save(icon_512_path, "PNG", optimize=True)
print(f"Saved: {icon_512_path} (512x512)")

# 4. icon-512-maskable.png (512x512)
icon_512_maskable_path = os.path.join(ASSETS_DIR, "icon-512-maskable.png")
fb_img.save(icon_512_maskable_path, "PNG", optimize=True)
print(f"Saved: {icon_512_maskable_path} (512x512)")

# 5. favicon-32x32.png (32x32)
tab_img = Image.open(TEMP_SCREENSHOT_TAB).convert("RGBA")
favicon_32 = tab_img.resize((32, 32), Image.Resampling.LANCZOS)
favicon_32_path = os.path.join(ASSETS_DIR, "favicon-32x32.png")
favicon_32.save(favicon_32_path, "PNG", optimize=True)
print(f"Saved: {favicon_32_path} (32x32)")

# Cleanup temporary files
for f in [SCRATCH_HTML, TEMP_SCREENSHOT_FB, TEMP_SCREENSHOT_TAB]:
    if os.path.exists(f):
        os.remove(f)

print("All icons successfully generated and optimized!")

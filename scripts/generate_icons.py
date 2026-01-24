#!/usr/bin/env python3
"""
Icon Generation Script for CodeAvengers

Generates all required icon sizes for:
- Web app (PWA icons, favicons)
- Desktop app (Tauri icons for macOS, Windows, Linux)

Requirements:
    pip install cairosvg pillow

Usage:
    python scripts/generate_icons.py
"""

import os
import sys
from pathlib import Path

try:
    import cairosvg
    from PIL import Image
    import io
except ImportError:
    print("Missing dependencies. Please install:")
    print("  pip install cairosvg pillow")
    sys.exit(1)


# Project root directory
PROJECT_ROOT = Path(__file__).parent.parent

# Source SVG file
SOURCE_SVG = PROJECT_ROOT / "web" / "public" / "favicon.svg"

# Output directories
WEB_ICONS_DIR = PROJECT_ROOT / "web" / "public" / "icons"
DESKTOP_ICONS_DIR = PROJECT_ROOT / "desktop" / "src-tauri" / "icons"

# Icon sizes for web (PWA + favicon)
WEB_ICON_SIZES = [16, 32, 72, 96, 128, 144, 152, 180, 192, 384, 512]

# Icon sizes for Tauri desktop app
DESKTOP_ICON_SIZES = [32, 128, 256, 512]

# Windows .ico sizes (multiple sizes in one file)
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

# macOS .icns sizes
ICNS_SIZES = [16, 32, 64, 128, 256, 512, 1024]


def svg_to_png(svg_path: Path, size: int) -> Image.Image:
    """Convert SVG to PNG at specified size."""
    png_data = cairosvg.svg2png(
        url=str(svg_path),
        output_width=size,
        output_height=size
    )
    return Image.open(io.BytesIO(png_data))


def generate_web_icons():
    """Generate all web app icons."""
    print("\n--- Generating Web Icons ---")

    WEB_ICONS_DIR.mkdir(parents=True, exist_ok=True)

    for size in WEB_ICON_SIZES:
        output_path = WEB_ICONS_DIR / f"icon-{size}x{size}.png"
        img = svg_to_png(SOURCE_SVG, size)
        img.save(output_path, "PNG", optimize=True)
        print(f"  Created: {output_path.name}")

    # Apple Touch Icon (180x180)
    apple_icon = svg_to_png(SOURCE_SVG, 180)
    apple_path = WEB_ICONS_DIR / "apple-touch-icon.png"
    apple_icon.save(apple_path, "PNG", optimize=True)
    print(f"  Created: {apple_path.name}")

    print(f"\nWeb icons saved to: {WEB_ICONS_DIR}")


def generate_desktop_icons():
    """Generate all desktop app icons for Tauri."""
    print("\n--- Generating Desktop Icons ---")

    DESKTOP_ICONS_DIR.mkdir(parents=True, exist_ok=True)

    # Standard PNG sizes
    for size in DESKTOP_ICON_SIZES:
        output_path = DESKTOP_ICONS_DIR / f"{size}x{size}.png"
        img = svg_to_png(SOURCE_SVG, size)
        img.save(output_path, "PNG", optimize=True)
        print(f"  Created: {output_path.name}")

    # Retina @2x icons
    retina_sizes = [128]  # Creates 128x128@2x (256px)
    for size in retina_sizes:
        output_path = DESKTOP_ICONS_DIR / f"{size}x{size}@2x.png"
        img = svg_to_png(SOURCE_SVG, size * 2)
        img.save(output_path, "PNG", optimize=True)
        print(f"  Created: {output_path.name}")

    # icon.png (main icon, 512x512)
    main_icon = svg_to_png(SOURCE_SVG, 512)
    main_path = DESKTOP_ICONS_DIR / "icon.png"
    main_icon.save(main_path, "PNG", optimize=True)
    print(f"  Created: {main_path.name}")

    print(f"\nDesktop icons saved to: {DESKTOP_ICONS_DIR}")


def generate_ico():
    """Generate Windows .ico file with multiple sizes."""
    print("\n--- Generating Windows ICO ---")

    images = []
    for size in ICO_SIZES:
        img = svg_to_png(SOURCE_SVG, size)
        images.append(img)

    ico_path = DESKTOP_ICONS_DIR / "icon.ico"

    # Save as ICO with all sizes
    images[0].save(
        ico_path,
        format="ICO",
        sizes=[(img.width, img.height) for img in images],
        append_images=images[1:]
    )
    print(f"  Created: {ico_path.name} ({len(ICO_SIZES)} sizes)")


def generate_icns():
    """
    Generate macOS .icns file.

    Note: This creates a simple .icns by bundling PNG files.
    For production, use iconutil on macOS for best results.
    """
    print("\n--- Generating macOS ICNS ---")

    # Create iconset directory
    iconset_dir = DESKTOP_ICONS_DIR / "icon.iconset"
    iconset_dir.mkdir(parents=True, exist_ok=True)

    # Generate all required sizes for iconset
    iconset_sizes = [
        (16, "icon_16x16.png"),
        (32, "icon_16x16@2x.png"),
        (32, "icon_32x32.png"),
        (64, "icon_32x32@2x.png"),
        (128, "icon_128x128.png"),
        (256, "icon_128x128@2x.png"),
        (256, "icon_256x256.png"),
        (512, "icon_256x256@2x.png"),
        (512, "icon_512x512.png"),
        (1024, "icon_512x512@2x.png"),
    ]

    for size, filename in iconset_sizes:
        img = svg_to_png(SOURCE_SVG, size)
        img.save(iconset_dir / filename, "PNG", optimize=True)

    print(f"  Created iconset in: {iconset_dir}")

    # Try to run iconutil if on macOS
    icns_path = DESKTOP_ICONS_DIR / "icon.icns"
    if sys.platform == "darwin":
        import subprocess
        try:
            subprocess.run(
                ["iconutil", "-c", "icns", str(iconset_dir), "-o", str(icns_path)],
                check=True,
                capture_output=True
            )
            print(f"  Created: {icns_path.name}")

            # Clean up iconset directory
            import shutil
            shutil.rmtree(iconset_dir)
            print("  Cleaned up iconset directory")
        except subprocess.CalledProcessError as e:
            print(f"  Warning: iconutil failed: {e}")
            print("  Iconset directory preserved for manual conversion")
    else:
        print("  Note: Run 'iconutil -c icns icon.iconset -o icon.icns' on macOS")
        print("  Iconset directory preserved for manual conversion")


def main():
    """Main entry point."""
    print("=" * 50)
    print("CodeAvengers Icon Generator")
    print("=" * 50)

    if not SOURCE_SVG.exists():
        print(f"\nError: Source SVG not found: {SOURCE_SVG}")
        sys.exit(1)

    print(f"\nSource: {SOURCE_SVG}")

    # Generate all icons
    generate_web_icons()
    generate_desktop_icons()
    generate_ico()
    generate_icns()

    print("\n" + "=" * 50)
    print("Icon generation complete!")
    print("=" * 50)


if __name__ == "__main__":
    main()

import zlib
import struct
from pathlib import Path

def create_png(width, height, r, g, b, filepath):
    # PNG signature
    png_sig = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_crc = struct.pack('>I', zlib.crc32(b'IHDR' + ihdr_data))
    ihdr_chunk = struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + ihdr_crc
    
    # IDAT chunk: raw uncompressed rows with filter byte 0
    row_bytes = bytes([0] + [r, g, b] * width)
    raw_data = row_bytes * height
    compressed = zlib.compress(raw_data)
    idat_crc = struct.pack('>I', zlib.crc32(b'IDAT' + compressed))
    idat_chunk = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + idat_crc
    
    # IEND chunk
    iend_crc = struct.pack('>I', zlib.crc32(b'IEND'))
    iend_chunk = struct.pack('>I', 0) + b'IEND' + iend_crc
    
    with open(filepath, 'wb') as f:
        f.write(png_sig + ihdr_chunk + idat_chunk + iend_chunk)

public_dir = Path('c:/GoalGuard-AI/frontend/public')
public_dir.mkdir(parents=True, exist_ok=True)

# Generate sleek deep-slate icons with GoalGuard theme color (#0284c7: 2, 132, 199)
create_png(192, 192, 2, 132, 199, public_dir / 'pwa-192x192.png')
create_png(512, 512, 2, 132, 199, public_dir / 'pwa-512x512.png')
create_png(180, 180, 2, 132, 199, public_dir / 'apple-touch-icon.png')
print('PNG icons generated successfully!')

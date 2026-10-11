"""Create RGB JPEG derivatives for SDKs that reject grayscale JPEG (Pillow required)."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
manifest = root / 'materials/manifest.json'
rows = json.loads(manifest.read_text(encoding='utf-8'))
for row in rows:
    source = root / row['file']
    with Image.open(source) as image:
        image.load()
        if image.mode == 'RGB':
            continue
        target = root / 'materials/prepared' / (source.stem + '-rgb.jpg')
        target.parent.mkdir(parents=True, exist_ok=True)
        image.convert('RGB').save(target, 'JPEG', quality=95)
    data = target.read_bytes()
    row['inferenceFile'] = target.relative_to(root).as_posix()
    row['inferenceSha256'] = hashlib.sha256(data).hexdigest()
    row['inferenceBytes'] = len(data)
    row['inferenceChanges'] = 'Converted grayscale to RGB JPEG, quality 95; original preserved'
    print(row['inferenceFile'])
manifest.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

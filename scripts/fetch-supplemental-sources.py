"""Download pinned Z-Anatomy source files with verified Git blob identities.

Usage: python3 scripts/fetch-supplemental-sources.py [--workers 4]
Files are cached outside the published model directory. Interrupted ranges are
retried on the next run; incomplete files are never accepted as source assets.
"""
import argparse
import concurrent.futures
import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'work/z-anatomy'
SOURCES = [
    ('Joints100', 9804796, '9db06d20217f4f42999dcfdf31b1f6af78dc7794'),
    ('MuscularSystem100', 37343180, '2477e1b6caf97d7174762b5eec6cf1c80db64eed'),
    ('SkeletalSystem100', 41339660, '7c62e45211bf3992bb7239170343e06e2b073865'),
]

def identity(path):
    data = path.read_bytes()
    return hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()

def fetch_range(job):
    name, size, sha, start, end = job
    target = DEST / 'ranges' / f'{name}-{start}-{end}'
    if target.exists() and target.stat().st_size == end - start + 1:
        return target
    temporary = target.with_suffix('.partial')
    subprocess.run([
        'curl', '--http1.1', '--fail', '--location', '--silent', '--show-error',
        '--retry', '2', '--retry-all-errors',
        '--connect-timeout', '30', '--max-time', '600',
        '-H', 'Accept: application/vnd.github.raw+json',
        '--range', f'{start}-{end}',
        f'https://api.github.com/repos/LluisV/Z-Anatomy/git/blobs/{sha}',
        '-o', str(temporary),
    ], check=True)
    if temporary.stat().st_size != end - start + 1:
        raise ValueError(f'Invalid byte range: {name} {start}-{end}')
    temporary.replace(target)
    print(f'Downloaded {name} bytes {start}-{end}', flush=True)
    return target

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, default=4, choices=range(1, 9))
    parser.add_argument('--vascular', action='store_true', help='Fetch the pinned cardiovascular source instead of muscles/joints.')
    args = parser.parse_args()
    (DEST / 'ranges').mkdir(parents=True, exist_ok=True)
    pending = []
    sources = [('CardioVascular41', 64889388, 'aa5bbcb63ae6e9ace8051111b3a85ea87f00c4f3')] if args.vascular else SOURCES
    for name, size, sha in sources:
        target = DEST / f'{name}.fbx'
        if target.exists() and target.stat().st_size == size and identity(target) == sha:
            print(f'Verified cached {target.name}', flush=True)
            continue
        pending.append((name, size, sha))
    jobs = [(n, sz, sh, start, min(start + 4_000_000, sz) - 1)
            for n, sz, sh in pending for start in range(0, sz, 4_000_000)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        list(executor.map(fetch_range, jobs))
    for name, size, sha in pending:
        temporary = DEST / f'{name}.verified-partial'
        with temporary.open('wb') as output:
            for start in range(0, size, 4_000_000):
                end = min(start + 4_000_000, size) - 1
                output.write((DEST / 'ranges' / f'{name}-{start}-{end}').read_bytes())
        if identity(temporary) != sha:
            raise ValueError(f'Upstream identity mismatch: {name}')
        temporary.replace(DEST / f'{name}.fbx')
        print(f'Verified {name}.fbx: {sha}', flush=True)

if __name__ == '__main__':
    main()

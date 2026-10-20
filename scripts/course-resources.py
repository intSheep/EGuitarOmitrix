"""Versioned private course payloads. Only indexed viewer assets may enter a pack.

No third-party dependencies. Source files are read-only; extracted files are never
written into the developer's app/local-scores directory.
"""
import argparse
import hashlib
import json
import re
import shutil
import stat
import zipfile
from pathlib import Path

ASSET = re.compile(r"p\d{3}(?:-ex\d+)?/(?:score\.(?:musicxml|gp)|(?:page-\d+|source(?:-\d+)?)\.(?:png|jpg))\Z")
VERSION = re.compile(r"[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[1-9][0-9]*\Z")
MAX_BYTES = 1024 * 1024 * 1024
MAX_FILES = 3000
INDEX_KEYS = {"id", "entryId", "entryIds", "sourcePage", "title", "images", "referenceOnly", "gp", "xml", "acceptedAudioGp", "practiceBpm"}


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def references(data):
    if not isinstance(data, dict) or set(data) != {"schemaVersion", "items"} or data["schemaVersion"] != 1:
        raise ValueError("Unsupported course index")
    items = data["items"]
    if not isinstance(items, list) or not 1 <= len(items) <= 1000:
        raise ValueError("Invalid course item count")
    files, ids = {"index.json"}, set()
    for item in items:
        if not isinstance(item, dict) or set(item) - INDEX_KEYS:
            raise ValueError("Unexpected course index fields")
        if not isinstance(item.get("id"), str) or item["id"] in ids:
            raise ValueError("Invalid or duplicate course item")
        ids.add(item["id"])
        if not isinstance(item.get("images"), list):
            raise ValueError("Invalid image references")
        paths = item["images"] + [item[k] for k in ("gp", "xml", "acceptedAudioGp") if item.get(k)]
        for path in paths:
            if not isinstance(path, str) or not ASSET.fullmatch(path):
                raise ValueError("Invalid viewer asset path")
            files.add(path)
    return files, len(items)


def read_local(root, name):
    path = root / name
    # Reject all symlinks, including parents, even when their target is in root.
    current = root
    for part in Path(name).parts:
        current = current / part
        if current.is_symlink():
            raise ValueError("Symlinks are not course assets")
    if not path.is_file() or not path.resolve().is_relative_to(root.resolve()):
        raise ValueError("Missing or escaping course asset: " + name)
    if path.stat().st_size > MAX_BYTES:
        raise ValueError("Oversized course asset")
    return path.read_bytes()


def metadata(manifest, archive_hash, manifest_hash):
    return {"schemaVersion": 1, "version": manifest["version"],
            "sha256": archive_hash, "manifestSha256": manifest_hash,
            "itemCount": manifest["itemCount"], "fileCount": len(manifest["files"]),
            "uncompressedBytes": sum(f["bytes"] for f in manifest["files"])}


def validate_payload(manifest_bytes, names, read, lock):
    if digest(manifest_bytes) != lock["manifestSha256"]:
        raise ValueError("Course manifest checksum mismatch")
    manifest = json.loads(manifest_bytes)
    if manifest["schemaVersion"] != 1 or manifest["version"] != lock["version"]:
        raise ValueError("Course version mismatch")
    expected = {"resource-manifest.json"}
    total = 0
    for file in manifest["files"]:
        name = file["path"]
        if name != "index.json" and not ASSET.fullmatch(name):
            raise ValueError("Invalid manifest asset path")
        if name in expected or not isinstance(file["bytes"], int) or file["bytes"] < 0:
            raise ValueError("Duplicate or invalid asset")
        expected.add(name)
        total += file["bytes"]
        if total > MAX_BYTES or len(expected) > MAX_FILES:
            raise ValueError("Course payload exceeds bounds")
        data = read(name)
        if len(data) != file["bytes"] or digest(data) != file["sha256"]:
            raise ValueError("Course asset checksum mismatch: " + name)
    if expected != set(names):
        raise ValueError("Unexpected or missing course files")
    referenced, count = references(json.loads(read("index.json")))
    if referenced != expected - {"resource-manifest.json"} or count != manifest["itemCount"]:
        raise ValueError("Course index does not match manifest")
    actual = metadata(manifest, lock["sha256"], digest(manifest_bytes))
    if any(actual[k] != lock[k] for k in actual):
        raise ValueError("Course lock metadata mismatch")
    return actual


def create(args):
    if not VERSION.fullmatch(args.version):
        raise ValueError("Use a YYYY.MM.DD.REVISION resource version")
    root, output = Path(args.source), Path(args.archive)
    if root.is_symlink() or output.exists():
        raise ValueError("Source cannot be a symlink; output must be new")
    index = read_local(root, "index.json")
    names, count = references(json.loads(index))
    files, total = [], 0
    for name in sorted(names):
        data = read_local(root, name)
        total += len(data)
        if total > MAX_BYTES or len(names) > MAX_FILES:
            raise ValueError("Course payload exceeds bounds")
        files.append({"path": name, "bytes": len(data), "sha256": digest(data)})
    manifest = {"schemaVersion": 1, "version": args.version, "itemCount": count, "files": files}
    manifest_bytes = encoded(manifest)
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for name in [f["path"] for f in files] + ["resource-manifest.json"]:
                entry = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
                entry.compress_type = zipfile.ZIP_DEFLATED
                entry.external_attr = (stat.S_IFREG | 0o644) << 16
                data = manifest_bytes if name == "resource-manifest.json" else read_local(root, name)
                if name != "resource-manifest.json":
                    record = next(f for f in files if f["path"] == name)
                    if digest(data) != record["sha256"]:
                        raise ValueError("Course source changed while packaging")
                archive.writestr(entry, data)
        lock = metadata(manifest, digest(output.read_bytes()), digest(manifest_bytes))
        lock.update({"releaseTag": "course-resources-" + args.version, "asset": output.name})
        Path(args.lock).write_bytes(encoded(lock))
        verify(args)
    except BaseException:
        output.unlink(missing_ok=True)
        raise


def verify(args):
    lock = json.loads(Path(args.lock).read_bytes())
    archive_path = Path(args.archive)
    if archive_path.stat().st_size > MAX_BYTES or digest(archive_path.read_bytes()) != lock["sha256"]:
        raise ValueError("Course archive checksum mismatch")
    with zipfile.ZipFile(archive_path) as archive:
        entries = archive.infolist()
        names = [e.filename for e in entries]
        if len(set(names)) != len(names) or len(names) > MAX_FILES:
            raise ValueError("Duplicate entries or too many course files")
        if sum(e.file_size for e in entries) > MAX_BYTES:
            raise ValueError("Course expansion exceeds bounds")
        for entry in entries:
            if entry.filename not in ("resource-manifest.json", "index.json") and not ASSET.fullmatch(entry.filename):
                raise ValueError("Invalid archive path")
            mode = entry.external_attr >> 16
            if stat.S_ISLNK(mode) or entry.is_dir() or entry.flag_bits & 1:
                raise ValueError("Unsupported course archive entry")
        actual = validate_payload(archive.read("resource-manifest.json"), names, archive.read, lock)
        if args.command == "extract":
            output = Path(args.output)
            if output.exists():
                raise ValueError("Extraction output must be new")
            output.mkdir(parents=True)
            try:
                for name in names:
                    target = output / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(archive.read(name))
            except BaseException:
                shutil.rmtree(output)
                raise
    print(json.dumps(actual))


def directory(args):
    root = Path(args.source)
    names = [p.relative_to(root).as_posix() for p in root.rglob("*") if not p.is_dir() or p.is_symlink()]
    lock = json.loads(Path(args.lock).read_bytes())
    result = validate_payload(read_local(root, "resource-manifest.json"), names, lambda n: read_local(root, n), lock)
    print(json.dumps(result))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest="command", required=True)
    for command in ("create", "verify", "extract", "directory"):
        sub = subs.add_parser(command)
        sub.add_argument("--lock", required=True)
        if command != "directory":
            sub.add_argument("--archive", required=True)
        if command in ("create", "directory"):
            sub.add_argument("--source", required=True)
        if command == "create":
            sub.add_argument("--version", required=True)
        if command == "extract":
            sub.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        {"create": create, "verify": verify, "extract": verify, "directory": directory}[args.command](args)
    except (ValueError, KeyError, OSError, zipfile.BadZipFile) as error:
        parser.exit(1, "Course resource error: " + str(error) + "\n")

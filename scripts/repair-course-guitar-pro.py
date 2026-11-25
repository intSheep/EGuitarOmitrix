"""Repair native playback metadata in the original 2026.10.20.1 course pack."""

import argparse
import io
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.dom.minidom import parseString

GPIF = "Content/score.gpif"
STANDARD_TUNING = "40 45 50 55 59 64"
MIDI_PATH = "Midi/27"
RSE_PATH = "Stringed/Electric Guitars/Clean Guitar"
CLEAN_GUITAR_RSE = """<RSE>
<SoundbankPatch>Strat-Guitar</SoundbankPatch>
<ElementsSettings/>
<Pickups><OverloudPosition>0</OverloudPosition><Volumes>1 1</Volumes><Tones>1 1</Tones></Pickups>
<EffectChain>
<Effect id="A01_ComboTop30"><Parameters>0.61 0.59 0.38 0.511667 0.21 0.29 0 0</Parameters></Effect>
<Effect id="E30_EqGEq"><Parameters>0.494949 0.232323 0.373737 0.494949 0.373737 0.494949 0.494949 0.777778</Parameters></Effect>
</EffectChain>
</RSE>"""


def value(element):
    child = element.firstChild
    return child.data if child else ""


def one(element, tag):
    (child,) = [node for node in element.childNodes if node.nodeName == tag]
    return child


def property_node(properties, name):
    return next((node for node in properties.childNodes
                 if node.nodeName == "Property" and node.getAttribute("name") == name), None)


def repair_gpif(data):
    doc = parseString(data)
    track = one(one(doc.documentElement, "Tracks"), "Track")
    staff = one(one(track, "Staves"), "Staff")
    properties = one(staff, "Properties")
    tuning = property_node(properties, "Tuning")
    engine = one(track, "AudioEngineState")
    sound = one(one(track, "Sounds"), "Sound")
    path = one(sound, "Path")
    automation = one(one(one(track, "Automations"), "Automation"), "Value")
    if (value(engine), value(path), value(one(one(sound, "MIDI"), "Program"))) != ("MIDI", MIDI_PATH, "27"):
        raise ValueError("Unexpected guitar sound or playback engine")
    if not value(automation).startswith(MIDI_PATH + ";"):
        raise ValueError("Sound automation does not reference the original preset")
    if value(one(one(track, "InstrumentSet"), "Type")) != "electricGuitar":
        raise ValueError("Unexpected instrument type")

    missing_tuning = tuning is None
    if missing_tuning:
        # These exercises encode pitches directly. Keep their note data and view
        # configuration as-is. Tuning is track metadata, not assigned fingering.
        if any(property_node(one(note, "Properties"), "String") is not None
               for note in doc.getElementsByTagName("Note")):
            raise ValueError("Missing tuning on notes with explicit strings")
        # Guitar Pro's string playback emits unpitched attacks when fret data
        # is absent. The electric RSE preset can play these pitches directly.
        track.removeChild(one(track, "UseOneChannelPerString"))
        tuning = parseString(f"""<Property name="Tuning">
<Pitches>{STANDARD_TUNING}</Pitches><Label>Guitar Standard Tuning</Label>
<LabelVisible>true</LabelVisible><Flat/><Instrument>Guitar</Instrument></Property>""")
        properties.appendChild(doc.importNode(tuning.documentElement, deep=True))
        flags = one(property_node(properties, "PartialCapoStringFlags"), "Bitset")
        flags.appendChild(doc.createTextNode("000000"))
    else:
        instrument = one(tuning, "Instrument")
        if (value(one(tuning, "Pitches")), value(instrument)) != (STANDARD_TUNING, "Bass"):
            raise ValueError("Unexpected tablature tuning")
        instrument.firstChild.data = "Guitar"

    engine.firstChild.data = "RSE"
    path.firstChild.data = RSE_PATH
    automation.firstChild.data = RSE_PATH + value(automation)[len(MIDI_PATH):]
    sound.appendChild(doc.importNode(parseString(CLEAN_GUITAR_RSE).documentElement, deep=True))
    return doc.toxml(encoding="utf-8"), missing_tuning


def repair_score(score):
    output = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(score)) as original, zipfile.ZipFile(output, "w") as fixed:
        gpif, missing_tuning = repair_gpif(original.read(GPIF))
        for entry in original.infolist():
            fixed.writestr(entry, gpif if entry.filename == GPIF else original.read(entry))
    return output.getvalue(), missing_tuning


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    tool = Path(__file__).with_name("course-resources.py")
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--source-lock", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path, help="New course pack ZIP")
    parser.add_argument("--lock", required=True, type=Path, help="New lock JSON")
    parser.add_argument("--version", required=True)
    args = parser.parse_args()
    if args.lock.exists() or args.output.exists() or args.lock.resolve() == args.output.resolve():
        parser.error("Choose distinct, new output and lock files")
    if args.version == "2026.10.20.1":
        parser.error("Choose a new version")
    if json.loads(args.source_lock.read_bytes())["version"] != "2026.10.20.1":
        parser.error("This migration requires the original 2026.10.20.1 lock")

    with tempfile.TemporaryDirectory() as temporary:
        staged = Path(temporary) / "course"
        subprocess.run([sys.executable, str(tool), "extract", "--archive", str(args.archive),
                        "--lock", str(args.source_lock), "--output", str(staged)], check=True)
        manifest = json.loads((staged / "resource-manifest.json").read_bytes())
        scores = [staged / f["path"] for f in manifest["files"] if f["path"].endswith(".gp")]
        missing_tunings = 0
        for file in scores:
            fixed, missing_tuning = repair_score(file.read_bytes())
            file.write_bytes(fixed)
            missing_tunings += missing_tuning
        if (len(scores), missing_tunings) != (96, 28):
            raise ValueError("Course inventory differs from the audited source")
        subprocess.run([sys.executable, str(tool), "create", "--source", str(staged),
                        "--version", args.version, "--lock", str(args.lock),
                        "--archive", str(args.output)], check=True)
        print(f"Repaired {len(scores)} guitar tracks, including {missing_tunings} without tuning")


if __name__ == "__main__":
    main()

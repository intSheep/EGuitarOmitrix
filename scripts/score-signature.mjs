// Musical fields that must survive local MusicXML -> GP and audio packaging.
export function scoreSignature(score) {
  return JSON.stringify({
    tempo: score.tempo,
    bars: score.masterBars.map(b => [b.timeSignatureNumerator, b.timeSignatureDenominator, b.isRepeatStart, b.repeatCount, b.alternateEndings]),
    tracks: score.tracks.map(t => t.staves.map(st => ({
      tuning: st.tuning,
      bars: st.bars.map(b => b.voices.map(v => v.beats.map(x => ({
        duration: x.duration, grace: x.graceType, dots: x.dots, rest: x.isRest,
        tuplet: [x.tupletNumerator, x.tupletDenominator],
        brush: x.brushType, pick: x.pickStroke, palmMute: x.isPalmMute, letRing: x.isLetRing,
        notes: x.notes.map(n => [n.string, n.fret, n.realValue, n.isTieDestination,
          n.accentuated, n.slideInType, n.slideOutType, n.isHammerPullOrigin,
          n.isDead, n.isStaccato, n.vibrato, n.bendPoints?.map(p => [p.offset, p.value]) ?? []]),
      })))),
    }))),
  });
}

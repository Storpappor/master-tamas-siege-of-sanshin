# Omitted from the repository copy of kicker-pose-studies-r1b

The complete art-chat delivery is `kicker-pose-studies-r1b.zip` (SHA-256
`4be49d662d4327fbca363ea2d1cfb60bf04edcac6568e5014fb40fddfca4f17c`), whose `SHA256SUMS.txt` is kept
here unchanged as the manifest. Two folders of that archive are not committed, to keep the repository
light:

- `raw-studies/` (10 MB): the unchanged image-generator outputs, provenance only; `raw-studies.json`
  refers to them. The delivery's `NATIVE-EQUIVALENCE-PROOF.json` records that they assemble to the
  same decoded pixels as `studies/`.
- `reference/`: copies of the K1 concept and of the approved idle package, which the repository
  already holds under `docs/art/kicker-idle-r2/`.

Everything the assembly needs is here: `studies/`, `studies.json`, `sample-studies.mjs` (identical
to `docs/art/kicker-idle-r2/sample-studies.mjs`); `node docs/art/kicker-pose-studies-r1b/sample-studies.mjs docs/art/kicker-pose-studies-r1b/studies.json --out <dir>`
reproduces the staged `assets/sprites/kicker.png` (`862bb763…`) byte for byte with the
repository encoder. The idle study is referenced from `../kicker-idle-r2/`.

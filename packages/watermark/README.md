# @tether/watermark

Recoverable invisible watermarking: the piece of Tether that survives a
screenshot.

## Status

Interface defined (`Watermarker`), `NoOpWatermarker` in place. The embedding
implementation is the next milestone.

## Design direction

- DCT-domain spread-spectrum embedding into the luminance channel, the same
  family of technique behind C2PA's Durable Content Credentials soft bindings
  and Adobe's content watermark work.
- Payload is the manifest ID plus an error-correcting code (Reed-Solomon), so
  a cropped or recompressed image still recovers enough to look the manifest
  up in the repository.
- Robustness is a published benchmark, not a claim: the test suite will
  measure recovery rate across JPEG recompression ladders, crops, and
  screenshot resize filters before we call this done.

## Why not LSB / metadata

LSB dies on first recompression; metadata dies on first upload to any social
platform. Both are demonstrated in Tether's explainer page. The watermark has
to live in the pixels' frequency domain to survive.

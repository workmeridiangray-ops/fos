// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Flames of Shiva contributors
import { decode as decodePNG, encode as encodePNG } from "fast-png";
import jpeg from "jpeg-js";

// Bound decoded memory before allocating pixel buffers. Re-encoding strips
// untrusted metadata, scripts, appended payloads and original EXIF location data.
export function sanitizeImage(bytes, mime) {
  if (mime === "image/png") {
    if (
      bytes.length < 24 ||
      bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 4000000
    )
      throw Error("Image resolution exceeds four megapixels.");
    const image = decodePNG(bytes, { checkCrc: true });
    return Buffer.from(
      encodePNG({
        width: image.width,
        height: image.height,
        data: image.data,
        channels: image.channels,
        depth: image.depth,
        palette: image.palette,
        transparency: image.transparency,
      }),
    );
  }
  const image = jpeg.decode(bytes, {
    useTArray: true,
    formatAsRGBA: true,
    tolerantDecoding: false,
    maxResolutionInMP: 4,
    maxMemoryUsageInMB: 48,
  });
  return jpeg.encode(
    { width: image.width, height: image.height, data: image.data },
    85,
  ).data;
}

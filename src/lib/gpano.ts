"use client";

/**
 * Writes Google Photo Sphere (GPano) XMP metadata into a JPEG.
 *
 * Without it a panorama is just a wide picture. With it, Facebook shows the
 * interactive 360° player, Google Photos and Street View recognise the file,
 * and desktop viewers open it in sphere mode.
 *
 * The tag lives in an APP1 segment inserted right after the SOI marker.
 */

const XMP_NS = "http://ns.adobe.com/xap/1.0/\0";

function buildXmp(width: number, height: number, heading?: number) {
  const pose = heading === undefined ? "" : `\n     GPano:PoseHeadingDegrees="${heading}"`;
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
     xmlns:GPano="http://ns.google.com/photos/1.0/panorama/"
     GPano:ProjectionType="equirectangular"
     GPano:UsePanoramaViewer="True"
     GPano:CroppedAreaImageWidthPixels="${width}"
     GPano:CroppedAreaImageHeightPixels="${height}"
     GPano:FullPanoWidthPixels="${width}"
     GPano:FullPanoHeightPixels="${height}"
     GPano:CroppedAreaLeftPixels="0"
     GPano:CroppedAreaTopPixels="0"${pose}/>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/** Returns a copy of the JPEG with the GPano packet added. */
export async function addGPanoMetadata(
  jpeg: Blob,
  width: number,
  height: number,
  heading?: number,
): Promise<Blob> {
  try {
    const bytes = new Uint8Array(await jpeg.arrayBuffer());

    // sanity: must start with SOI
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return jpeg;

    const payload = new TextEncoder().encode(XMP_NS + buildXmp(width, height, heading));
    const length = payload.length + 2;                    // APP1 length includes itself
    if (length > 0xffff) return jpeg;                     // would not fit in one segment

    const segment = new Uint8Array(payload.length + 4);
    segment[0] = 0xff;
    segment[1] = 0xe1;                                    // APP1
    segment[2] = (length >> 8) & 0xff;
    segment[3] = length & 0xff;
    segment.set(payload, 4);

    // keep an existing JFIF/APP0 block first, then insert ours
    let insertAt = 2;
    if (bytes[2] === 0xff && bytes[3] === 0xe0) {
      insertAt = 4 + ((bytes[4] << 8) | bytes[5]) - 2 + 2;
    }

    const out = new Uint8Array(bytes.length + segment.length);
    out.set(bytes.subarray(0, insertAt), 0);
    out.set(segment, insertAt);
    out.set(bytes.subarray(insertAt), insertAt + segment.length);

    return new Blob([out], { type: "image/jpeg" });
  } catch {
    return jpeg;                                          // never lose the photo over metadata
  }
}

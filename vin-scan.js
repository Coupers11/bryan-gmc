/* VIN barcode scanning — locate the barcode first, then decode it big.
 *
 * Handing ZXing a whole camera frame does not work on a real door-jamb label, and
 * this was measured rather than guessed. On an actual photo of a Jeep door jamb the
 * full frame failed at every resolution, in both orientations, with and without
 * contrast normalisation. A hand-cut crop of the same barcode decoded on the first
 * try. Three things turned out to matter, in this order:
 *
 *   1. CROP. The label is a thin strip in a cluttered frame — printed warning text
 *      right beside it, weatherstrip, body reflections. All of that puts spurious
 *      edges into the very scan rows ZXing needs.
 *   2. LENGTH. A 17-character Code 39 VIN is ~304 modules. It needs roughly 1000px
 *      along the bars to survive binarisation. Downscaling the frame to 1280 before
 *      cropping throws that away and nothing decodes — so we crop from the source at
 *      native resolution and only then scale.
 *   3. CONTRAST. A glossy white sticker in a shaded door jamb is low-contrast. A
 *      global stretch over the crop alone (not the whole frame, where the dark paint
 *      dominates the histogram) is what tipped it over.
 *
 * Orientation matters too but is cheap: a door-jamb label read with the phone upright
 * presents the barcode vertically, and a 1D reader only scans horizontal lines, so
 * every crop is tried both ways round.
 *
 * Measured on the reference photo: correct VIN in ~120-200ms, and no false read on a
 * photo containing no barcode at all.
 */
(function (w, d) {
  "use strict";

  // Looked up on use, not at load. available() already reads w.ZXing live, so
  // binding the library here meant the two could disagree — a deferred or slow
  // CDN load would leave available() saying yes while every decode threw on an
  // undefined Z.
  function zx() { return w.ZXing; }
  var reader = null;

  function hints() {
    var Z = zx();
    var h = new Map();
    // A door-jamb VIN sticker is Code 39. Registrations and window stickers use
    // Code 128 or ITF. Naming the formats keeps the reader from spreading its
    // effort across 2D symbologies that will never be on a door jamb.
    h.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
      Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.ITF
    ]);
    h.set(Z.DecodeHintType.TRY_HARDER, true);
    return h;
  }

  /* ── VIN validation ──────────────────────────────────────────────────────
     Every vehicle sold in North America carries a check digit in position 9,
     so a 17-character string that satisfies it is almost certainly a real read
     rather than a lucky misdecode. That lets us accept a valid VIN instantly and
     demand a second, agreeing read for anything that fails. */
  var VAL = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,
              S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9 };
  var WGT = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];

  function validVin(v) {
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return false;
    var t = 0;
    for (var i = 0; i < 17; i++) {
      var c = v[i], n = c >= "0" && c <= "9" ? +c : VAL[c];
      if (n === undefined) return false;
      t += n * WGT[i];
    }
    t %= 11;
    return (t === 10 ? "X" : String(t)) === v[8];
  }

  function extractVin(t) {
    var m = (t || "").toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "")
              .match(/[A-HJ-NPR-Z0-9]{17}/);
    return m ? m[0] : "";
  }

  /* ── image plumbing ─────────────────────────────────────────────────────── */

  function grayscale(src, longEdge) {
    var s = longEdge / Math.max(src.width, src.height);
    var c = d.createElement("canvas");
    c.width = Math.max(1, Math.round(src.width * s));
    c.height = Math.max(1, Math.round(src.height * s));
    var g = c.getContext("2d");
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(src, 0, 0, c.width, c.height);
    var data = g.getImageData(0, 0, c.width, c.height).data;
    var a = new Float32Array(c.width * c.height);
    for (var i = 0, p = 0; i < data.length; i += 4, p++) {
      a[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    }
    return { a: a, w: c.width, h: c.height, scale: s };
  }

  var CELL = 14;

  /* Find the barcode: the one region with many edges along one axis and few along
     the other. Returns a box in SOURCE coordinates, or null. */
  function locate(src) {
    var G = grayscale(src, 700), a = G.a, w = G.w, h = G.h;
    var cx = Math.floor(w / CELL), cy = Math.floor(h / CELL);
    if (cx < 2 || cy < 2) return null;
    var hx = new Float32Array(cx * cy), hy = new Float32Array(cx * cy);

    for (var y = 1; y < h - 1; y++) {
      var row = (y / CELL) | 0; if (row >= cy) continue;
      for (var x = 1; x < w - 1; x++) {
        var col = (x / CELL) | 0; if (col >= cx) continue;
        if (Math.abs(a[y * w + x + 1] - a[y * w + x - 1]) > 40) hx[row * cx + col]++;
        if (Math.abs(a[(y + 1) * w + x] - a[(y - 1) * w + x]) > 40) hy[row * cx + col]++;
      }
    }

    var sc = new Float32Array(cx * cy), axis = new Int8Array(cx * cy), best = 0;
    for (var i = 0; i < cx * cy; i++) {
      var vert = hx[i] - hy[i], horz = hy[i] - hx[i];
      if (vert >= horz) { sc[i] = vert; axis[i] = 0; } else { sc[i] = horz; axis[i] = 1; }
      if (sc[i] > sc[best]) best = i;
    }
    if (sc[best] < CELL * CELL * 0.10) return null;

    var thr = sc[best] * 0.35, ax = axis[best];
    var x0 = best % cx, x1 = x0, y0 = (best / cx) | 0, y1 = y0;

    function agrees(r0, r1, c0, c1) {
      var n = 0, t = 0;
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
        if (r < 0 || c < 0 || r >= cy || c >= cx) continue;
        t++; if (sc[r * cx + c] > thr && axis[r * cx + c] === ax) n++;
      }
      return t && n / t >= 0.5;
    }
    for (var grew = true; grew;) {
      grew = false;
      if (y0 > 0      && agrees(y0 - 1, y0 - 1, x0, x1)) { y0--; grew = true; }
      if (y1 < cy - 1 && agrees(y1 + 1, y1 + 1, x0, x1)) { y1++; grew = true; }
      if (x0 > 0      && agrees(y0, y1, x0 - 1, x0 - 1)) { x0--; grew = true; }
      if (x1 < cx - 1 && agrees(y0, y1, x1 + 1, x1 + 1)) { x1++; grew = true; }
    }

    var inv = 1 / G.scale;
    return { x: x0 * CELL * inv, y: y0 * CELL * inv,
             w: (x1 - x0 + 1) * CELL * inv, h: (y1 - y0 + 1) * CELL * inv };
  }

  /* Stretch the crop's own histogram to full range. Done per-crop on purpose —
     across a whole frame the car's paint dominates and the label stays flat. */
  function normalise(c) {
    var g = c.getContext("2d"), img = g.getImageData(0, 0, c.width, c.height);
    var a = img.data, i, lo = 255, hi = 0, v;
    for (i = 0; i < a.length; i += 4) {
      v = (a[i] * 299 + a[i + 1] * 587 + a[i + 2] * 114) / 1000;
      if (v < lo) lo = v; if (v > hi) hi = v;
    }
    var sp = hi - lo || 1;
    for (i = 0; i < a.length; i += 4) {
      v = (a[i] * 299 + a[i + 1] * 587 + a[i + 2] * 114) / 1000;
      a[i] = a[i + 1] = a[i + 2] = v <= lo ? 0 : v >= hi ? 255 : (v - lo) * 255 / sp;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function crop(src, sx, sy, sw, sh, rot, longEdge) {
    var s = Math.min(1, longEdge / Math.max(sw, sh));
    var cw = Math.max(1, Math.round(sw * s)), ch = Math.max(1, Math.round(sh * s));
    var c = d.createElement("canvas");
    if (rot) { c.width = ch; c.height = cw; } else { c.width = cw; c.height = ch; }
    var g = c.getContext("2d");
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    if (rot) {
      g.translate(ch / 2, cw / 2); g.rotate(Math.PI / 2);
      g.drawImage(src, sx, sy, sw, sh, -cw / 2, -ch / 2, cw, ch);
    } else {
      g.drawImage(src, sx, sy, sw, sh, 0, 0, cw, ch);
    }
    return normalise(c);
  }

  function decodeCanvas(c) {
    var Z = zx();
    if (!Z) return null;
    if (!reader) { reader = new Z.MultiFormatReader(); reader.setHints(hints()); }
    try {
      return reader.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(
        new Z.HTMLCanvasElementLuminanceSource(c)))).getText();
    } catch (e) { return null; }
  }

  var WIDTHS = [1100, 1500, 800];

  /* scan(source) → { vin, valid } | null.  Source is anything drawImage takes:
     an <img>, a <canvas>, or a <video>. */
  function scan(src, opt) {
    opt = opt || {};
    var W = src.videoWidth || src.naturalWidth || src.width;
    var H = src.videoHeight || src.naturalHeight || src.height;
    if (!W || !H) return null;

    var boxes = [], b = locate(src);
    if (b) {
      // Pad outward in stages — the locator finds the bars themselves, but Code 39
      // needs its quiet zone, and a tight box clips the start/stop characters.
      [0.10, 0.30, 0.60].forEach(function (pad) {
        var px = b.w * pad, py = b.h * pad;
        var x = Math.max(0, b.x - px), y = Math.max(0, b.y - py);
        // Clamp against what is left from x, not against the full frame width. A
        // label near an edge padded out to 60% ran the crop off the end of the
        // source, and drawImage fills that overhang with transparent black — a
        // hard artificial edge sitting exactly where the quiet zone needs to be.
        boxes.push([x, y, Math.min(W - x, b.w + 2 * px), Math.min(H - y, b.h + 2 * py)]);
      });
    }
    if (!opt.cropOnly) boxes.push([0, 0, W, H]);

    for (var i = 0; i < boxes.length; i++) {
      for (var r = 0; r < 2; r++) {
        for (var s = 0; s < WIDTHS.length; s++) {
          var v = extractVin(decodeCanvas(
            crop(src, boxes[i][0], boxes[i][1], boxes[i][2], boxes[i][3], r === 1, WIDTHS[s])));
          if (v.length === 17) return { vin: v, valid: validVin(v) };
        }
      }
    }
    return null;
  }

  w.VinScan = {
    scan: scan,
    validVin: validVin,
    extractVin: extractVin,
    available: function () { return !!(w.ZXing && w.ZXing.MultiFormatReader); }
  };
})(window, document);

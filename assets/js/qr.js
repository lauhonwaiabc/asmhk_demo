/* ASM 2027 — dependency-free QR Code encoder
   Byte mode, versions 1–40, error-correction levels L/M/Q/H.
   Implements ISO/IEC 18004 (finder, timing and alignment patterns,
   Reed–Solomon blocks, interleaving, masking and penalty scoring).
   Exposes window.ASMQR: encode(), svg(), draw().
   No network access, no third-party code. */
(function (global) {
  "use strict";

  /* Reed–Solomon block table: [blocks, total codewords, data codewords]
     for L, M, Q, H for each version (1–40). Values from ISO/IEC 18004. */
  var RS_BLOCK_TABLE = [[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]];

  var ECC_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
  var ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  /* Galois field GF(256), primitive polynomial 0x11D --------------------- */
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function rsGenerator(degree) {
    var poly = [1];
    for (var i = 0; i < degree; i++) {
      var next = new Array(poly.length + 1);
      for (var k = 0; k < next.length; k++) next[k] = 0;
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsRemainder(data, generator) {
    var result = new Array(generator.length - 1);
    for (var i = 0; i < result.length; i++) result[i] = 0;
    for (var d = 0; d < data.length; d++) {
      var factor = data[d] ^ result[0];
      result.shift();
      result.push(0);
      for (var j = 0; j < result.length; j++) {
        result[j] ^= gfMul(generator[j + 1], factor);
      }
    }
    return result;
  }

  /* Helpers -------------------------------------------------------------- */
  function utf8Bytes(text) {
    if (typeof TextEncoder !== "undefined") {
      return Array.prototype.slice.call(new TextEncoder().encode(String(text)));
    }
    var out = [];
    var str = String(text);
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0xd800 || c >= 0xe000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else {
        i++;
        var cp = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      }
    }
    return out;
  }

  function blockInfo(version, ecc) {
    var row = RS_BLOCK_TABLE[(version - 1) * 4 + ECC_INDEX[ecc]];
    var groups = [];
    var totalData = 0;
    if (row.length === 3) {
      groups.push({ blocks: row[0], total: row[1], data: row[2] });
      totalData = row[0] * row[2];
    } else {
      groups.push({ blocks: row[0], total: row[1], data: row[2] });
      groups.push({ blocks: row[3], total: row[4], data: row[5] });
      totalData = row[0] * row[2] + row[3] * row[5];
    }
    return { groups: groups, totalData: totalData };
  }

  function pickVersion(byteLength, ecc) {
    for (var version = 1; version <= 40; version++) {
      var info = blockInfo(version, ecc);
      var countBits = version < 10 ? 8 : 16;
      /* 4-bit mode indicator + character count + payload */
      if (4 + countBits + byteLength * 8 <= info.totalData * 8) return version;
    }
    return 0;
  }

  function buildCodewords(bytes, version, ecc) {
    var info = blockInfo(version, ecc);
    var bits = [];
    function put(value, length) {
      for (var i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    }

    put(4, 4); // byte mode
    put(bytes.length, version < 10 ? 8 : 16);
    for (var i = 0; i < bytes.length; i++) put(bytes[i], 8);

    var capacityBits = info.totalData * 8;
    var terminator = Math.min(4, capacityBits - bits.length);
    put(0, terminator);
    while (bits.length % 8 !== 0) bits.push(0);

    var data = [];
    for (var b = 0; b < bits.length; b += 8) {
      var value = 0;
      for (var k = 0; k < 8; k++) value = (value << 1) | bits[b + k];
      data.push(value);
    }
    for (var pad = 0; data.length < info.totalData; pad++) data.push(pad % 2 === 0 ? 0xec : 0x11);

    /* Split into blocks, compute ECC, then interleave. */
    var blocks = [];
    var offset = 0;
    info.groups.forEach(function (group) {
      for (var n = 0; n < group.blocks; n++) {
        var chunk = data.slice(offset, offset + group.data);
        offset += group.data;
        blocks.push({
          data: chunk,
          ecc: rsRemainder(chunk, rsGenerator(group.total - group.data))
        });
      }
    });

    var maxData = Math.max.apply(null, blocks.map(function (x) { return x.data.length; }));
    var maxEcc = Math.max.apply(null, blocks.map(function (x) { return x.ecc.length; }));
    var out = [];
    for (var d = 0; d < maxData; d++) {
      blocks.forEach(function (block) { if (d < block.data.length) out.push(block.data[d]); });
    }
    for (var e = 0; e < maxEcc; e++) {
      blocks.forEach(function (block) { if (e < block.ecc.length) out.push(block.ecc[e]); });
    }
    return out;
  }

  function alignmentPositions(version) {
    if (version === 1) return [];
    var count = Math.floor(version / 7) + 2;
    var step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
    var result = [6];
    for (var pos = version * 4 + 10; result.length < count; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  function maskBit(mask, row, col) {
    switch (mask) {
      case 0: return (row + col) % 2 === 0;
      case 1: return row % 2 === 0;
      case 2: return col % 3 === 0;
      case 3: return (row + col) % 3 === 0;
      case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
      case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
      case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
      case 7: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
    }
    return false;
  }

  function penalty(modules, size) {
    var score = 0;
    var r, c, run, dark;

    /* Rule 1: five or more same-coloured modules in a line. */
    for (r = 0; r < size; r++) {
      run = 1;
      for (c = 1; c < size; c++) {
        if (modules[r * size + c] === modules[r * size + c - 1]) run++;
        else { if (run >= 5) score += 3 + run - 5; run = 1; }
      }
      if (run >= 5) score += 3 + run - 5;
    }
    for (c = 0; c < size; c++) {
      run = 1;
      for (r = 1; r < size; r++) {
        if (modules[r * size + c] === modules[(r - 1) * size + c]) run++;
        else { if (run >= 5) score += 3 + run - 5; run = 1; }
      }
      if (run >= 5) score += 3 + run - 5;
    }

    /* Rule 2: 2x2 blocks of the same colour. */
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        dark = modules[r * size + c];
        if (dark === modules[r * size + c + 1] &&
            dark === modules[(r + 1) * size + c] &&
            dark === modules[(r + 1) * size + c + 1]) score += 3;
      }
    }

    /* Rule 3: 1:1:3:1:1 finder-like pattern with four light modules. */
    var pattern = [1, 0, 1, 1, 1, 0, 1];
    function matches(line, start, step) {
      for (var i = 0; i < 7; i++) if (modules[line.start + (start + i) * step] !== pattern[i]) return false;
      return true;
    }
    function lightRun(line, start, step, length) {
      for (var i = 1; i <= 4; i++) {
        var idx = line.start + (start - i) * step;
        var off = start - i;
        if (off < 0 || idx < 0 || idx >= modules.length || modules[idx] !== 0) return false;
      }
      return true;
    }
    function lightRunAfter(line, start, step, length) {
      for (var i = 7; i < 7 + 4; i++) {
        var at = start + i;
        if (at >= length) return false;
        if (modules[line.start + at * step] !== 0) return false;
      }
      return true;
    }
    for (r = 0; r < size; r++) {
      for (c = 0; c + 7 <= size; c++) {
        if (matches({ start: r * size }, c, 1) && (lightRun({ start: r * size }, c, 1, size) || lightRunAfter({ start: r * size }, c, 1, size))) score += 40;
      }
    }
    for (c = 0; c < size; c++) {
      for (r = 0; r + 7 <= size; r++) {
        var line = { start: c };
        if (matches(line, r, size) && (lightRun(line, r, size, size) || lightRunAfter(line, r, size, size))) score += 40;
      }
    }

    /* Rule 4: balance of dark and light modules. */
    var darkCount = 0;
    for (var i = 0; i < modules.length; i++) if (modules[i]) darkCount++;
    var total = size * size;
    score += Math.floor(Math.abs(darkCount * 20 - total * 10) / total) * 10;
    return score;
  }

  function matrix(version, ecc, codewords, forcedMask) {
    var size = version * 4 + 17;
    var modules = new Uint8Array(size * size);
    var reserved = new Uint8Array(size * size);

    function set(row, col, dark, reserve) {
      if (row < 0 || col < 0 || row >= size || col >= size) return;
      modules[row * size + col] = dark ? 1 : 0;
      if (reserve) reserved[row * size + col] = 1;
    }

    function finder(row, col) {
      for (var r = -1; r <= 7; r++) {
        for (var c = -1; c <= 7; c++) {
          var inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
          var dark = inside && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          set(row + r, col + c, dark, true);
        }
      }
    }

    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);

    /* Timing patterns. */
    for (var i = 8; i < size - 8; i++) {
      set(6, i, i % 2 === 0, true);
      set(i, 6, i % 2 === 0, true);
    }

    /* Alignment patterns. */
    var align = alignmentPositions(version);
    align.forEach(function (row) {
      align.forEach(function (col) {
        if ((row === 6 && col === 6) || (row === 6 && col === size - 7) || (row === size - 7 && col === 6)) return;
        for (var r = -2; r <= 2; r++) {
          for (var c = -2; c <= 2; c++) {
            var dark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
            set(row + r, col + c, dark, true);
          }
        }
      });
    });

    /* Reserve format information areas (values drawn after masking). */
    for (i = 0; i <= 8; i++) {
      if (i !== 6) { set(8, i, false, true); set(i, 8, false, true); }
    }
    for (i = 0; i < 8; i++) {
      set(8, size - 1 - i, false, true);
      set(size - 1 - i, 8, false, true);
    }
    set(size - 8, 8, true, true); // permanently dark module

    /* Version information (versions 7 and above). */
    if (version >= 7) {
      var remainder = version;
      for (i = 0; i < 12; i++) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
      var versionBits = (version << 12) | remainder;
      for (i = 0; i < 18; i++) {
        var bit = (versionBits >>> i) & 1;
        var a = size - 11 + (i % 3);
        var b = Math.floor(i / 3);
        set(b, a, bit, true);
        set(a, b, bit, true);
      }
    }

    /* Place data bits in the two-column zig-zag, skipping function modules. */
    var bitIndex = 0;
    var totalBits = codewords.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      var upward = ((right + 1) & 2) === 0;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var col = right - j;
          var row = upward ? size - 1 - vert : vert;
          if (!reserved[row * size + col] && bitIndex < totalBits) {
            var value = (codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1;
            modules[row * size + col] = value;
            bitIndex++;
          }
        }
      }
    }

    function drawFormat(mask) {
      var data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
      var rem = data;
      for (var k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412;
      function bit(n) { return (bits >>> (14 - n)) & 1; }

      for (var n = 0; n <= 5; n++) set(8, n, bit(n), true);
      set(8, 7, bit(6), true);
      set(8, 8, bit(7), true);
      set(7, 8, bit(8), true);
      for (n = 9; n <= 14; n++) set(14 - n, 8, bit(n), true);

      for (n = 0; n <= 7; n++) set(size - 1 - n, 8, bit(n), true);
      for (n = 8; n <= 14; n++) set(8, size - 15 + n, bit(n), true);
      set(size - 8, 8, true, true);
    }

    function applyMask(mask) {
      for (var r = 0; r < size; r++) {
        for (var c = 0; c < size; c++) {
          if (!reserved[r * size + c] && maskBit(mask, r, c)) {
            modules[r * size + c] ^= 1;
          }
        }
      }
    }

    if (forcedMask != null) {
      applyMask(forcedMask);
      drawFormat(forcedMask);
      return { size: size, modules: modules, mask: forcedMask, version: version, ecc: ecc };
    }

    var best = null;
    var bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      var copy = new Uint8Array(modules);
      var copyReserved = reserved;
      var saved = modules;
      modules = copy;
      applyMask(mask);
      drawFormat(mask);
      var score = penalty(modules, size);
      if (score < bestScore) {
        bestScore = score;
        best = { size: size, modules: new Uint8Array(modules), mask: mask, version: version, ecc: ecc };
      }
      modules = saved;
      reserved = copyReserved;
    }
    return best;
  }

  function encode(text, options) {
    options = options || {};
    var ecc = String(options.ecc || "M").toUpperCase();
    if (!ECC_INDEX.hasOwnProperty(ecc)) ecc = "M";
    var bytes = utf8Bytes(text);
    var version = options.version || pickVersion(bytes.length, ecc);
    if (!version) throw new Error("QR payload is too long (" + bytes.length + " bytes)");
    var info = blockInfo(version, ecc);
    var countBits = version < 10 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 > info.totalData * 8) {
      throw new Error("QR payload does not fit version " + version);
    }
    var codewords = buildCodewords(bytes, version, ecc);
    var qr = matrix(version, ecc, codewords, options.mask);
    qr.bytes = bytes.length;
    qr.codewords = codewords.length;
    return qr;
  }

  function svg(text, options) {
    options = options || {};
    var qr = encode(text, options);
    var border = options.border == null ? 4 : Math.max(0, options.border);
    var dark = options.dark || "#123f63";
    var light = options.light || "#ffffff";
    var unit = options.unit || 1;
    var total = (qr.size + border * 2) * unit;
    var path = [];
    for (var r = 0; r < qr.size; r++) {
      var c = 0;
      while (c < qr.size) {
        if (!qr.modules[r * qr.size + c]) { c++; continue; }
        var start = c;
        while (c < qr.size && qr.modules[r * qr.size + c]) c++;
        path.push("M" + ((start + border) * unit) + " " + ((r + border) * unit) + "h" + ((c - start) * unit) + "v" + unit + "h-" + ((c - start) * unit) + "z");
      }
    }
    var label = options.label || "QR code";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + " " + total + '"' +
      (options.width ? ' width="' + options.width + '" height="' + options.height + '"' : "") +
      ' shape-rendering="crispEdges" role="img" aria-label="' + escapeAttr(label) + '">' +
      '<rect width="100%" height="100%" fill="' + escapeAttr(light) + '"/>' +
      '<path d="' + path.join("") + '" fill="' + escapeAttr(dark) + '"/>' +
      "</svg>";
  }

  function escapeAttr(value) {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function draw(canvas, text, options) {
    options = options || {};
    var qr = encode(text, options);
    var border = options.border == null ? 4 : options.border;
    var modules = qr.size + border * 2;
    var pixelSize = options.pixelSize || 1024;
    var unit = Math.max(1, Math.floor(pixelSize / modules));
    var size = unit * modules;
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = options.light || "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = options.dark || "#123f63";
    for (var r = 0; r < qr.size; r++) {
      for (var c = 0; c < qr.size; c++) {
        if (qr.modules[r * qr.size + c]) {
          ctx.fillRect((c + border) * unit, (r + border) * unit, unit, unit);
        }
      }
    }
    return qr;
  }

  global.ASMQR = {
    encode: encode,
    svg: svg,
    draw: draw
  };
})(typeof window !== "undefined" ? window : this);

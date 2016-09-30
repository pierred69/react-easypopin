var global = Function("return this;")();
/*!
  * Ender: open module JavaScript framework (client-lib)
  * copyright Dustin Diaz & Jacob Thornton 2011 (@ded @fat)
  * http://ender.no.de
  * License MIT
  */
!function (context) {

  // a global object for node.js module compatiblity
  // ============================================

  context['global'] = context

  // Implements simple module system
  // losely based on CommonJS Modules spec v1.1.1
  // ============================================

  var modules = {}
    , old = context.$

  function require (identifier) {
    // modules can be required from ender's build system, or found on the window
    var module = modules[identifier] || window[identifier]
    if (!module) throw new Error("Requested module '" + identifier + "' has not been defined.")
    return module
  }

  function provide (name, what) {
    return (modules[name] = what)
  }

  context['provide'] = provide
  context['require'] = require

  function aug(o, o2) {
    for (var k in o2) k != 'noConflict' && k != '_VERSION' && (o[k] = o2[k])
    return o
  }

  function boosh(s, r, els) {
    // string || node || nodelist || window
    if (typeof s == 'string' || s.nodeName || (s.length && 'item' in s) || s == window) {
      els = ender._select(s, r)
      els.selector = s
    } else els = isFinite(s.length) ? s : [s]
    return aug(els, boosh)
  }

  function ender(s, r) {
    return boosh(s, r)
  }

  aug(ender, {
      _VERSION: '0.3.6'
    , fn: boosh // for easy compat to jQuery plugins
    , ender: function (o, chain) {
        aug(chain ? boosh : ender, o)
      }
    , _select: function (s, r) {
        return (r || document).querySelectorAll(s)
      }
  })

  aug(boosh, {
    forEach: function (fn, scope, i) {
      // opt out of native forEach so we can intentionally call our own scope
      // defaulting to the current item and be able to return self
      for (i = 0, l = this.length; i < l; ++i) i in this && fn.call(scope || this[i], this[i], i, this)
      // return self for chaining
      return this
    },
    $: ender // handy reference to self
  })

  ender.noConflict = function () {
    context.$ = old
    return this
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = ender
  // use subscript notation as extern for Closure compilation
  context['ender'] = context['$'] = context['ender'] || ender

}(this);
// pakmanager:iconv-lite/encodings/internal
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict"
    
    // Export Node.js internal encodings.
    
    module.exports = {
        // Encodings
        utf8:   { type: "_internal", bomAware: true},
        cesu8:  { type: "_internal", bomAware: true},
        unicode11utf8: "utf8",
    
        ucs2:   { type: "_internal", bomAware: true},
        utf16le: "ucs2",
    
        binary: { type: "_internal" },
        base64: { type: "_internal" },
        hex:    { type: "_internal" },
    
        // Codec.
        _internal: InternalCodec,
    };
    
    //------------------------------------------------------------------------------
    
    function InternalCodec(codecOptions, iconv) {
        this.enc = codecOptions.encodingName;
        this.bomAware = codecOptions.bomAware;
    
        if (this.enc === "base64")
            this.encoder = InternalEncoderBase64;
        else if (this.enc === "cesu8") {
            this.enc = "utf8"; // Use utf8 for decoding.
            this.encoder = InternalEncoderCesu8;
    
            // Add decoder for versions of Node not supporting CESU-8
            if (new Buffer("eda080", 'hex').toString().length == 3) {
                this.decoder = InternalDecoderCesu8;
                this.defaultCharUnicode = iconv.defaultCharUnicode;
            }
        }
    }
    
    InternalCodec.prototype.encoder = InternalEncoder;
    InternalCodec.prototype.decoder = InternalDecoder;
    
    //------------------------------------------------------------------------------
    
    // We use node.js internal decoder. Its signature is the same as ours.
    var StringDecoder = require('string_decoder').StringDecoder;
    
    if (!StringDecoder.prototype.end) // Node v0.8 doesn't have this method.
        StringDecoder.prototype.end = function() {};
    
    
    function InternalDecoder(options, codec) {
        StringDecoder.call(this, codec.enc);
    }
    
    InternalDecoder.prototype = StringDecoder.prototype;
    
    
    //------------------------------------------------------------------------------
    // Encoder is mostly trivial
    
    function InternalEncoder(options, codec) {
        this.enc = codec.enc;
    }
    
    InternalEncoder.prototype.write = function(str) {
        return new Buffer(str, this.enc);
    }
    
    InternalEncoder.prototype.end = function() {
    }
    
    
    //------------------------------------------------------------------------------
    // Except base64 encoder, which must keep its state.
    
    function InternalEncoderBase64(options, codec) {
        this.prevStr = '';
    }
    
    InternalEncoderBase64.prototype.write = function(str) {
        str = this.prevStr + str;
        var completeQuads = str.length - (str.length % 4);
        this.prevStr = str.slice(completeQuads);
        str = str.slice(0, completeQuads);
    
        return new Buffer(str, "base64");
    }
    
    InternalEncoderBase64.prototype.end = function() {
        return new Buffer(this.prevStr, "base64");
    }
    
    
    //------------------------------------------------------------------------------
    // CESU-8 encoder is also special.
    
    function InternalEncoderCesu8(options, codec) {
    }
    
    InternalEncoderCesu8.prototype.write = function(str) {
        var buf = new Buffer(str.length * 3), bufIdx = 0;
        for (var i = 0; i < str.length; i++) {
            var charCode = str.charCodeAt(i);
            // Naive implementation, but it works because CESU-8 is especially easy
            // to convert from UTF-16 (which all JS strings are encoded in).
            if (charCode < 0x80)
                buf[bufIdx++] = charCode;
            else if (charCode < 0x800) {
                buf[bufIdx++] = 0xC0 + (charCode >>> 6);
                buf[bufIdx++] = 0x80 + (charCode & 0x3f);
            }
            else { // charCode will always be < 0x10000 in javascript.
                buf[bufIdx++] = 0xE0 + (charCode >>> 12);
                buf[bufIdx++] = 0x80 + ((charCode >>> 6) & 0x3f);
                buf[bufIdx++] = 0x80 + (charCode & 0x3f);
            }
        }
        return buf.slice(0, bufIdx);
    }
    
    InternalEncoderCesu8.prototype.end = function() {
    }
    
    //------------------------------------------------------------------------------
    // CESU-8 decoder is not implemented in Node v4.0+
    
    function InternalDecoderCesu8(options, codec) {
        this.acc = 0;
        this.contBytes = 0;
        this.accBytes = 0;
        this.defaultCharUnicode = codec.defaultCharUnicode;
    }
    
    InternalDecoderCesu8.prototype.write = function(buf) {
        var acc = this.acc, contBytes = this.contBytes, accBytes = this.accBytes, 
            res = '';
        for (var i = 0; i < buf.length; i++) {
            var curByte = buf[i];
            if ((curByte & 0xC0) !== 0x80) { // Leading byte
                if (contBytes > 0) { // Previous code is invalid
                    res += this.defaultCharUnicode;
                    contBytes = 0;
                }
    
                if (curByte < 0x80) { // Single-byte code
                    res += String.fromCharCode(curByte);
                } else if (curByte < 0xE0) { // Two-byte code
                    acc = curByte & 0x1F;
                    contBytes = 1; accBytes = 1;
                } else if (curByte < 0xF0) { // Three-byte code
                    acc = curByte & 0x0F;
                    contBytes = 2; accBytes = 1;
                } else { // Four or more are not supported for CESU-8.
                    res += this.defaultCharUnicode;
                }
            } else { // Continuation byte
                if (contBytes > 0) { // We're waiting for it.
                    acc = (acc << 6) | (curByte & 0x3f);
                    contBytes--; accBytes++;
                    if (contBytes === 0) {
                        // Check for overlong encoding, but support Modified UTF-8 (encoding NULL as C0 80)
                        if (accBytes === 2 && acc < 0x80 && acc > 0)
                            res += this.defaultCharUnicode;
                        else if (accBytes === 3 && acc < 0x800)
                            res += this.defaultCharUnicode;
                        else
                            // Actually add character.
                            res += String.fromCharCode(acc);
                    }
                } else { // Unexpected continuation byte
                    res += this.defaultCharUnicode;
                }
            }
        }
        this.acc = acc; this.contBytes = contBytes; this.accBytes = accBytes;
        return res;
    }
    
    InternalDecoderCesu8.prototype.end = function() {
        var res = 0;
        if (this.contBytes > 0)
            res += this.defaultCharUnicode;
        return res;
    }
    
  provide("iconv-lite/encodings/internal", module.exports);
}(global));

// pakmanager:iconv-lite/encodings/utf16
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict"
    
    // == UTF16-BE codec. ==========================================================
    
    exports.utf16be = Utf16BECodec;
    function Utf16BECodec() {
    }
    
    Utf16BECodec.prototype.encoder = Utf16BEEncoder;
    Utf16BECodec.prototype.decoder = Utf16BEDecoder;
    Utf16BECodec.prototype.bomAware = true;
    
    
    // -- Encoding
    
    function Utf16BEEncoder() {
    }
    
    Utf16BEEncoder.prototype.write = function(str) {
        var buf = new Buffer(str, 'ucs2');
        for (var i = 0; i < buf.length; i += 2) {
            var tmp = buf[i]; buf[i] = buf[i+1]; buf[i+1] = tmp;
        }
        return buf;
    }
    
    Utf16BEEncoder.prototype.end = function() {
    }
    
    
    // -- Decoding
    
    function Utf16BEDecoder() {
        this.overflowByte = -1;
    }
    
    Utf16BEDecoder.prototype.write = function(buf) {
        if (buf.length == 0)
            return '';
    
        var buf2 = new Buffer(buf.length + 1),
            i = 0, j = 0;
    
        if (this.overflowByte !== -1) {
            buf2[0] = buf[0];
            buf2[1] = this.overflowByte;
            i = 1; j = 2;
        }
    
        for (; i < buf.length-1; i += 2, j+= 2) {
            buf2[j] = buf[i+1];
            buf2[j+1] = buf[i];
        }
    
        this.overflowByte = (i == buf.length-1) ? buf[buf.length-1] : -1;
    
        return buf2.slice(0, j).toString('ucs2');
    }
    
    Utf16BEDecoder.prototype.end = function() {
    }
    
    
    // == UTF-16 codec =============================================================
    // Decoder chooses automatically from UTF-16LE and UTF-16BE using BOM and space-based heuristic.
    // Defaults to UTF-16LE, as it's prevalent and default in Node.
    // http://en.wikipedia.org/wiki/UTF-16 and http://encoding.spec.whatwg.org/#utf-16le
    // Decoder default can be changed: iconv.decode(buf, 'utf16', {defaultEncoding: 'utf-16be'});
    
    // Encoder uses UTF-16LE and prepends BOM (which can be overridden with addBOM: false).
    
    exports.utf16 = Utf16Codec;
    function Utf16Codec(codecOptions, iconv) {
        this.iconv = iconv;
    }
    
    Utf16Codec.prototype.encoder = Utf16Encoder;
    Utf16Codec.prototype.decoder = Utf16Decoder;
    
    
    // -- Encoding (pass-through)
    
    function Utf16Encoder(options, codec) {
        options = options || {};
        if (options.addBOM === undefined)
            options.addBOM = true;
        this.encoder = codec.iconv.getEncoder('utf-16le', options);
    }
    
    Utf16Encoder.prototype.write = function(str) {
        return this.encoder.write(str);
    }
    
    Utf16Encoder.prototype.end = function() {
        return this.encoder.end();
    }
    
    
    // -- Decoding
    
    function Utf16Decoder(options, codec) {
        this.decoder = null;
        this.initialBytes = [];
        this.initialBytesLen = 0;
    
        this.options = options || {};
        this.iconv = codec.iconv;
    }
    
    Utf16Decoder.prototype.write = function(buf) {
        if (!this.decoder) {
            // Codec is not chosen yet. Accumulate initial bytes.
            this.initialBytes.push(buf);
            this.initialBytesLen += buf.length;
            
            if (this.initialBytesLen < 16) // We need more bytes to use space heuristic (see below)
                return '';
    
            // We have enough bytes -> detect endianness.
            var buf = Buffer.concat(this.initialBytes),
                encoding = detectEncoding(buf, this.options.defaultEncoding);
            this.decoder = this.iconv.getDecoder(encoding, this.options);
            this.initialBytes.length = this.initialBytesLen = 0;
        }
    
        return this.decoder.write(buf);
    }
    
    Utf16Decoder.prototype.end = function() {
        if (!this.decoder) {
            var buf = Buffer.concat(this.initialBytes),
                encoding = detectEncoding(buf, this.options.defaultEncoding);
            this.decoder = this.iconv.getDecoder(encoding, this.options);
    
            var res = this.decoder.write(buf),
                trail = this.decoder.end();
    
            return trail ? (res + trail) : res;
        }
        return this.decoder.end();
    }
    
    function detectEncoding(buf, defaultEncoding) {
        var enc = defaultEncoding || 'utf-16le';
    
        if (buf.length >= 2) {
            // Check BOM.
            if (buf[0] == 0xFE && buf[1] == 0xFF) // UTF-16BE BOM
                enc = 'utf-16be';
            else if (buf[0] == 0xFF && buf[1] == 0xFE) // UTF-16LE BOM
                enc = 'utf-16le';
            else {
                // No BOM found. Try to deduce encoding from initial content.
                // Most of the time, the content has ASCII chars (U+00**), but the opposite (U+**00) is uncommon.
                // So, we count ASCII as if it was LE or BE, and decide from that.
                var asciiCharsLE = 0, asciiCharsBE = 0, // Counts of chars in both positions
                    _len = Math.min(buf.length - (buf.length % 2), 64); // Len is always even.
    
                for (var i = 0; i < _len; i += 2) {
                    if (buf[i] === 0 && buf[i+1] !== 0) asciiCharsBE++;
                    if (buf[i] !== 0 && buf[i+1] === 0) asciiCharsLE++;
                }
    
                if (asciiCharsBE > asciiCharsLE)
                    enc = 'utf-16be';
                else if (asciiCharsBE < asciiCharsLE)
                    enc = 'utf-16le';
            }
        }
    
        return enc;
    }
    
    
    
  provide("iconv-lite/encodings/utf16", module.exports);
}(global));

// pakmanager:iconv-lite/encodings/utf7
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict"
    
    // UTF-7 codec, according to https://tools.ietf.org/html/rfc2152
    // See also below a UTF-7-IMAP codec, according to http://tools.ietf.org/html/rfc3501#section-5.1.3
    
    exports.utf7 = Utf7Codec;
    exports.unicode11utf7 = 'utf7'; // Alias UNICODE-1-1-UTF-7
    function Utf7Codec(codecOptions, iconv) {
        this.iconv = iconv;
    };
    
    Utf7Codec.prototype.encoder = Utf7Encoder;
    Utf7Codec.prototype.decoder = Utf7Decoder;
    Utf7Codec.prototype.bomAware = true;
    
    
    // -- Encoding
    
    var nonDirectChars = /[^A-Za-z0-9'\(\),-\.\/:\? \n\r\t]+/g;
    
    function Utf7Encoder(options, codec) {
        this.iconv = codec.iconv;
    }
    
    Utf7Encoder.prototype.write = function(str) {
        // Naive implementation.
        // Non-direct chars are encoded as "+<base64>-"; single "+" char is encoded as "+-".
        return new Buffer(str.replace(nonDirectChars, function(chunk) {
            return "+" + (chunk === '+' ? '' : 
                this.iconv.encode(chunk, 'utf16-be').toString('base64').replace(/=+$/, '')) 
                + "-";
        }.bind(this)));
    }
    
    Utf7Encoder.prototype.end = function() {
    }
    
    
    // -- Decoding
    
    function Utf7Decoder(options, codec) {
        this.iconv = codec.iconv;
        this.inBase64 = false;
        this.base64Accum = '';
    }
    
    var base64Regex = /[A-Za-z0-9\/+]/;
    var base64Chars = [];
    for (var i = 0; i < 256; i++)
        base64Chars[i] = base64Regex.test(String.fromCharCode(i));
    
    var plusChar = '+'.charCodeAt(0), 
        minusChar = '-'.charCodeAt(0),
        andChar = '&'.charCodeAt(0);
    
    Utf7Decoder.prototype.write = function(buf) {
        var res = "", lastI = 0,
            inBase64 = this.inBase64,
            base64Accum = this.base64Accum;
    
        // The decoder is more involved as we must handle chunks in stream.
    
        for (var i = 0; i < buf.length; i++) {
            if (!inBase64) { // We're in direct mode.
                // Write direct chars until '+'
                if (buf[i] == plusChar) {
                    res += this.iconv.decode(buf.slice(lastI, i), "ascii"); // Write direct chars.
                    lastI = i+1;
                    inBase64 = true;
                }
            } else { // We decode base64.
                if (!base64Chars[buf[i]]) { // Base64 ended.
                    if (i == lastI && buf[i] == minusChar) {// "+-" -> "+"
                        res += "+";
                    } else {
                        var b64str = base64Accum + buf.slice(lastI, i).toString();
                        res += this.iconv.decode(new Buffer(b64str, 'base64'), "utf16-be");
                    }
    
                    if (buf[i] != minusChar) // Minus is absorbed after base64.
                        i--;
    
                    lastI = i+1;
                    inBase64 = false;
                    base64Accum = '';
                }
            }
        }
    
        if (!inBase64) {
            res += this.iconv.decode(buf.slice(lastI), "ascii"); // Write direct chars.
        } else {
            var b64str = base64Accum + buf.slice(lastI).toString();
    
            var canBeDecoded = b64str.length - (b64str.length % 8); // Minimal chunk: 2 quads -> 2x3 bytes -> 3 chars.
            base64Accum = b64str.slice(canBeDecoded); // The rest will be decoded in future.
            b64str = b64str.slice(0, canBeDecoded);
    
            res += this.iconv.decode(new Buffer(b64str, 'base64'), "utf16-be");
        }
    
        this.inBase64 = inBase64;
        this.base64Accum = base64Accum;
    
        return res;
    }
    
    Utf7Decoder.prototype.end = function() {
        var res = "";
        if (this.inBase64 && this.base64Accum.length > 0)
            res = this.iconv.decode(new Buffer(this.base64Accum, 'base64'), "utf16-be");
    
        this.inBase64 = false;
        this.base64Accum = '';
        return res;
    }
    
    
    // UTF-7-IMAP codec.
    // RFC3501 Sec. 5.1.3 Modified UTF-7 (http://tools.ietf.org/html/rfc3501#section-5.1.3)
    // Differences:
    //  * Base64 part is started by "&" instead of "+"
    //  * Direct characters are 0x20-0x7E, except "&" (0x26)
    //  * In Base64, "," is used instead of "/"
    //  * Base64 must not be used to represent direct characters.
    //  * No implicit shift back from Base64 (should always end with '-')
    //  * String must end in non-shifted position.
    //  * "-&" while in base64 is not allowed.
    
    
    exports.utf7imap = Utf7IMAPCodec;
    function Utf7IMAPCodec(codecOptions, iconv) {
        this.iconv = iconv;
    };
    
    Utf7IMAPCodec.prototype.encoder = Utf7IMAPEncoder;
    Utf7IMAPCodec.prototype.decoder = Utf7IMAPDecoder;
    Utf7IMAPCodec.prototype.bomAware = true;
    
    
    // -- Encoding
    
    function Utf7IMAPEncoder(options, codec) {
        this.iconv = codec.iconv;
        this.inBase64 = false;
        this.base64Accum = new Buffer(6);
        this.base64AccumIdx = 0;
    }
    
    Utf7IMAPEncoder.prototype.write = function(str) {
        var inBase64 = this.inBase64,
            base64Accum = this.base64Accum,
            base64AccumIdx = this.base64AccumIdx,
            buf = new Buffer(str.length*5 + 10), bufIdx = 0;
    
        for (var i = 0; i < str.length; i++) {
            var uChar = str.charCodeAt(i);
            if (0x20 <= uChar && uChar <= 0x7E) { // Direct character or '&'.
                if (inBase64) {
                    if (base64AccumIdx > 0) {
                        bufIdx += buf.write(base64Accum.slice(0, base64AccumIdx).toString('base64').replace(/\//g, ',').replace(/=+$/, ''), bufIdx);
                        base64AccumIdx = 0;
                    }
    
                    buf[bufIdx++] = minusChar; // Write '-', then go to direct mode.
                    inBase64 = false;
                }
    
                if (!inBase64) {
                    buf[bufIdx++] = uChar; // Write direct character
    
                    if (uChar === andChar)  // Ampersand -> '&-'
                        buf[bufIdx++] = minusChar;
                }
    
            } else { // Non-direct character
                if (!inBase64) {
                    buf[bufIdx++] = andChar; // Write '&', then go to base64 mode.
                    inBase64 = true;
                }
                if (inBase64) {
                    base64Accum[base64AccumIdx++] = uChar >> 8;
                    base64Accum[base64AccumIdx++] = uChar & 0xFF;
    
                    if (base64AccumIdx == base64Accum.length) {
                        bufIdx += buf.write(base64Accum.toString('base64').replace(/\//g, ','), bufIdx);
                        base64AccumIdx = 0;
                    }
                }
            }
        }
    
        this.inBase64 = inBase64;
        this.base64AccumIdx = base64AccumIdx;
    
        return buf.slice(0, bufIdx);
    }
    
    Utf7IMAPEncoder.prototype.end = function() {
        var buf = new Buffer(10), bufIdx = 0;
        if (this.inBase64) {
            if (this.base64AccumIdx > 0) {
                bufIdx += buf.write(this.base64Accum.slice(0, this.base64AccumIdx).toString('base64').replace(/\//g, ',').replace(/=+$/, ''), bufIdx);
                this.base64AccumIdx = 0;
            }
    
            buf[bufIdx++] = minusChar; // Write '-', then go to direct mode.
            this.inBase64 = false;
        }
    
        return buf.slice(0, bufIdx);
    }
    
    
    // -- Decoding
    
    function Utf7IMAPDecoder(options, codec) {
        this.iconv = codec.iconv;
        this.inBase64 = false;
        this.base64Accum = '';
    }
    
    var base64IMAPChars = base64Chars.slice();
    base64IMAPChars[','.charCodeAt(0)] = true;
    
    Utf7IMAPDecoder.prototype.write = function(buf) {
        var res = "", lastI = 0,
            inBase64 = this.inBase64,
            base64Accum = this.base64Accum;
    
        // The decoder is more involved as we must handle chunks in stream.
        // It is forgiving, closer to standard UTF-7 (for example, '-' is optional at the end).
    
        for (var i = 0; i < buf.length; i++) {
            if (!inBase64) { // We're in direct mode.
                // Write direct chars until '&'
                if (buf[i] == andChar) {
                    res += this.iconv.decode(buf.slice(lastI, i), "ascii"); // Write direct chars.
                    lastI = i+1;
                    inBase64 = true;
                }
            } else { // We decode base64.
                if (!base64IMAPChars[buf[i]]) { // Base64 ended.
                    if (i == lastI && buf[i] == minusChar) { // "&-" -> "&"
                        res += "&";
                    } else {
                        var b64str = base64Accum + buf.slice(lastI, i).toString().replace(/,/g, '/');
                        res += this.iconv.decode(new Buffer(b64str, 'base64'), "utf16-be");
                    }
    
                    if (buf[i] != minusChar) // Minus may be absorbed after base64.
                        i--;
    
                    lastI = i+1;
                    inBase64 = false;
                    base64Accum = '';
                }
            }
        }
    
        if (!inBase64) {
            res += this.iconv.decode(buf.slice(lastI), "ascii"); // Write direct chars.
        } else {
            var b64str = base64Accum + buf.slice(lastI).toString().replace(/,/g, '/');
    
            var canBeDecoded = b64str.length - (b64str.length % 8); // Minimal chunk: 2 quads -> 2x3 bytes -> 3 chars.
            base64Accum = b64str.slice(canBeDecoded); // The rest will be decoded in future.
            b64str = b64str.slice(0, canBeDecoded);
    
            res += this.iconv.decode(new Buffer(b64str, 'base64'), "utf16-be");
        }
    
        this.inBase64 = inBase64;
        this.base64Accum = base64Accum;
    
        return res;
    }
    
    Utf7IMAPDecoder.prototype.end = function() {
        var res = "";
        if (this.inBase64 && this.base64Accum.length > 0)
            res = this.iconv.decode(new Buffer(this.base64Accum, 'base64'), "utf16-be");
    
        this.inBase64 = false;
        this.base64Accum = '';
        return res;
    }
    
    
    
  provide("iconv-lite/encodings/utf7", module.exports);
}(global));

// pakmanager:iconv-lite/encodings/sbcs-codec
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict"
    
    // Single-byte codec. Needs a 'chars' string parameter that contains 256 or 128 chars that
    // correspond to encoded bytes (if 128 - then lower half is ASCII). 
    
    exports._sbcs = SBCSCodec;
    function SBCSCodec(codecOptions, iconv) {
        if (!codecOptions)
            throw new Error("SBCS codec is called without the data.")
        
        // Prepare char buffer for decoding.
        if (!codecOptions.chars || (codecOptions.chars.length !== 128 && codecOptions.chars.length !== 256))
            throw new Error("Encoding '"+codecOptions.type+"' has incorrect 'chars' (must be of len 128 or 256)");
        
        if (codecOptions.chars.length === 128) {
            var asciiString = "";
            for (var i = 0; i < 128; i++)
                asciiString += String.fromCharCode(i);
            codecOptions.chars = asciiString + codecOptions.chars;
        }
    
        this.decodeBuf = new Buffer(codecOptions.chars, 'ucs2');
        
        // Encoding buffer.
        var encodeBuf = new Buffer(65536);
        encodeBuf.fill(iconv.defaultCharSingleByte.charCodeAt(0));
    
        for (var i = 0; i < codecOptions.chars.length; i++)
            encodeBuf[codecOptions.chars.charCodeAt(i)] = i;
    
        this.encodeBuf = encodeBuf;
    }
    
    SBCSCodec.prototype.encoder = SBCSEncoder;
    SBCSCodec.prototype.decoder = SBCSDecoder;
    
    
    function SBCSEncoder(options, codec) {
        this.encodeBuf = codec.encodeBuf;
    }
    
    SBCSEncoder.prototype.write = function(str) {
        var buf = new Buffer(str.length);
        for (var i = 0; i < str.length; i++)
            buf[i] = this.encodeBuf[str.charCodeAt(i)];
        
        return buf;
    }
    
    SBCSEncoder.prototype.end = function() {
    }
    
    
    function SBCSDecoder(options, codec) {
        this.decodeBuf = codec.decodeBuf;
    }
    
    SBCSDecoder.prototype.write = function(buf) {
        // Strings are immutable in JS -> we use ucs2 buffer to speed up computations.
        var decodeBuf = this.decodeBuf;
        var newBuf = new Buffer(buf.length*2);
        var idx1 = 0, idx2 = 0;
        for (var i = 0; i < buf.length; i++) {
            idx1 = buf[i]*2; idx2 = i*2;
            newBuf[idx2] = decodeBuf[idx1];
            newBuf[idx2+1] = decodeBuf[idx1+1];
        }
        return newBuf.toString('ucs2');
    }
    
    SBCSDecoder.prototype.end = function() {
    }
    
  provide("iconv-lite/encodings/sbcs-codec", module.exports);
}(global));

// pakmanager:iconv-lite/encodings/sbcs-data
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict"
    
    // Manually added data to be used by sbcs codec in addition to generated one.
    
    module.exports = {
        // Not supported by iconv, not sure why.
        "10029": "maccenteuro",
        "maccenteuro": {
            "type": "_sbcs",
            "chars": "ÄĀāÉĄÖÜáąČäčĆćéŹźĎíďĒēĖóėôöõúĚěü†°Ę£§•¶ß®©™ę¨≠ģĮįĪ≤≥īĶ∂∑łĻļĽľĹĺŅņŃ¬√ńŇ∆«»… ňŐÕőŌ–—“”‘’÷◊ōŔŕŘ‹›řŖŗŠ‚„šŚśÁŤťÍŽžŪÓÔūŮÚůŰűŲųÝýķŻŁżĢˇ"
        },
    
        "808": "cp808",
        "ibm808": "cp808",
        "cp808": {
            "type": "_sbcs",
            "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№€■ "
        },
    
        // Aliases of generated encodings.
        "ascii8bit": "ascii",
        "usascii": "ascii",
        "ansix34": "ascii",
        "ansix341968": "ascii",
        "ansix341986": "ascii",
        "csascii": "ascii",
        "cp367": "ascii",
        "ibm367": "ascii",
        "isoir6": "ascii",
        "iso646us": "ascii",
        "iso646irv": "ascii",
        "us": "ascii",
    
        "latin1": "iso88591",
        "latin2": "iso88592",
        "latin3": "iso88593",
        "latin4": "iso88594",
        "latin5": "iso88599",
        "latin6": "iso885910",
        "latin7": "iso885913",
        "latin8": "iso885914",
        "latin9": "iso885915",
        "latin10": "iso885916",
    
        "csisolatin1": "iso88591",
        "csisolatin2": "iso88592",
        "csisolatin3": "iso88593",
        "csisolatin4": "iso88594",
        "csisolatincyrillic": "iso88595",
        "csisolatinarabic": "iso88596",
        "csisolatingreek" : "iso88597",
        "csisolatinhebrew": "iso88598",
        "csisolatin5": "iso88599",
        "csisolatin6": "iso885910",
    
        "l1": "iso88591",
        "l2": "iso88592",
        "l3": "iso88593",
        "l4": "iso88594",
        "l5": "iso88599",
        "l6": "iso885910",
        "l7": "iso885913",
        "l8": "iso885914",
        "l9": "iso885915",
        "l10": "iso885916",
    
        "isoir14": "iso646jp",
        "isoir57": "iso646cn",
        "isoir100": "iso88591",
        "isoir101": "iso88592",
        "isoir109": "iso88593",
        "isoir110": "iso88594",
        "isoir144": "iso88595",
        "isoir127": "iso88596",
        "isoir126": "iso88597",
        "isoir138": "iso88598",
        "isoir148": "iso88599",
        "isoir157": "iso885910",
        "isoir166": "tis620",
        "isoir179": "iso885913",
        "isoir199": "iso885914",
        "isoir203": "iso885915",
        "isoir226": "iso885916",
    
        "cp819": "iso88591",
        "ibm819": "iso88591",
    
        "cyrillic": "iso88595",
    
        "arabic": "iso88596",
        "arabic8": "iso88596",
        "ecma114": "iso88596",
        "asmo708": "iso88596",
    
        "greek" : "iso88597",
        "greek8" : "iso88597",
        "ecma118" : "iso88597",
        "elot928" : "iso88597",
    
        "hebrew": "iso88598",
        "hebrew8": "iso88598",
    
        "turkish": "iso88599",
        "turkish8": "iso88599",
    
        "thai": "iso885911",
        "thai8": "iso885911",
    
        "celtic": "iso885914",
        "celtic8": "iso885914",
        "isoceltic": "iso885914",
    
        "tis6200": "tis620",
        "tis62025291": "tis620",
        "tis62025330": "tis620",
    
        "10000": "macroman",
        "10006": "macgreek",
        "10007": "maccyrillic",
        "10079": "maciceland",
        "10081": "macturkish",
    
        "cspc8codepage437": "cp437",
        "cspc775baltic": "cp775",
        "cspc850multilingual": "cp850",
        "cspcp852": "cp852",
        "cspc862latinhebrew": "cp862",
        "cpgr": "cp869",
    
        "msee": "cp1250",
        "mscyrl": "cp1251",
        "msansi": "cp1252",
        "msgreek": "cp1253",
        "msturk": "cp1254",
        "mshebr": "cp1255",
        "msarab": "cp1256",
        "winbaltrim": "cp1257",
    
        "cp20866": "koi8r",
        "20866": "koi8r",
        "ibm878": "koi8r",
        "cskoi8r": "koi8r",
    
        "cp21866": "koi8u",
        "21866": "koi8u",
        "ibm1168": "koi8u",
    
        "strk10482002": "rk1048",
    
        "tcvn5712": "tcvn",
        "tcvn57121": "tcvn",
    
        "gb198880": "iso646cn",
        "cn": "iso646cn",
    
        "csiso14jisc6220ro": "iso646jp",
        "jisc62201969ro": "iso646jp",
        "jp": "iso646jp",
    
        "cshproman8": "hproman8",
        "r8": "hproman8",
        "roman8": "hproman8",
        "xroman8": "hproman8",
        "ibm1051": "hproman8",
    
        "mac": "macintosh",
        "csmacintosh": "macintosh",
    };
    
    
  provide("iconv-lite/encodings/sbcs-data", module.exports);
}(global));

// pakmanager:iconv-lite/encodings/sbcs-data-generated
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict"
    
    // Generated data for sbcs codec. Don't edit manually. Regenerate using generation/gen-sbcs.js script.
    module.exports = {
      "437": "cp437",
      "737": "cp737",
      "775": "cp775",
      "850": "cp850",
      "852": "cp852",
      "855": "cp855",
      "856": "cp856",
      "857": "cp857",
      "858": "cp858",
      "860": "cp860",
      "861": "cp861",
      "862": "cp862",
      "863": "cp863",
      "864": "cp864",
      "865": "cp865",
      "866": "cp866",
      "869": "cp869",
      "874": "windows874",
      "922": "cp922",
      "1046": "cp1046",
      "1124": "cp1124",
      "1125": "cp1125",
      "1129": "cp1129",
      "1133": "cp1133",
      "1161": "cp1161",
      "1162": "cp1162",
      "1163": "cp1163",
      "1250": "windows1250",
      "1251": "windows1251",
      "1252": "windows1252",
      "1253": "windows1253",
      "1254": "windows1254",
      "1255": "windows1255",
      "1256": "windows1256",
      "1257": "windows1257",
      "1258": "windows1258",
      "28591": "iso88591",
      "28592": "iso88592",
      "28593": "iso88593",
      "28594": "iso88594",
      "28595": "iso88595",
      "28596": "iso88596",
      "28597": "iso88597",
      "28598": "iso88598",
      "28599": "iso88599",
      "28600": "iso885910",
      "28601": "iso885911",
      "28603": "iso885913",
      "28604": "iso885914",
      "28605": "iso885915",
      "28606": "iso885916",
      "windows874": {
        "type": "_sbcs",
        "chars": "€����…�����������‘’“”•–—�������� กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
      },
      "win874": "windows874",
      "cp874": "windows874",
      "windows1250": {
        "type": "_sbcs",
        "chars": "€�‚�„…†‡�‰Š‹ŚŤŽŹ�‘’“”•–—�™š›śťžź ˇ˘Ł¤Ą¦§¨©Ş«¬­®Ż°±˛ł´µ¶·¸ąş»Ľ˝ľżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙"
      },
      "win1250": "windows1250",
      "cp1250": "windows1250",
      "windows1251": {
        "type": "_sbcs",
        "chars": "ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—�™љ›њќћџ ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕїАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
      },
      "win1251": "windows1251",
      "cp1251": "windows1251",
      "windows1252": {
        "type": "_sbcs",
        "chars": "€�‚ƒ„…†‡ˆ‰Š‹Œ�Ž��‘’“”•–—˜™š›œ�žŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
      },
      "win1252": "windows1252",
      "cp1252": "windows1252",
      "windows1253": {
        "type": "_sbcs",
        "chars": "€�‚ƒ„…†‡�‰�‹�����‘’“”•–—�™�›���� ΅Ά£¤¥¦§¨©�«¬­®―°±²³΄µ¶·ΈΉΊ»Ό½ΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�"
      },
      "win1253": "windows1253",
      "cp1253": "windows1253",
      "windows1254": {
        "type": "_sbcs",
        "chars": "€�‚ƒ„…†‡ˆ‰Š‹Œ����‘’“”•–—˜™š›œ��Ÿ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏĞÑÒÓÔÕÖ×ØÙÚÛÜİŞßàáâãäåæçèéêëìíîïğñòóôõö÷øùúûüışÿ"
      },
      "win1254": "windows1254",
      "cp1254": "windows1254",
      "windows1255": {
        "type": "_sbcs",
        "chars": "€�‚ƒ„…†‡ˆ‰�‹�����‘’“”•–—˜™�›���� ¡¢£₪¥¦§¨©×«¬­®¯°±²³´µ¶·¸¹÷»¼½¾¿ְֱֲֳִֵֶַָֹ�ֻּֽ־ֿ׀ׁׂ׃װױײ׳״�������אבגדהוזחטיךכלםמןנסעףפץצקרשת��‎‏�"
      },
      "win1255": "windows1255",
      "cp1255": "windows1255",
      "windows1256": {
        "type": "_sbcs",
        "chars": "€پ‚ƒ„…†‡ˆ‰ٹ‹Œچژڈگ‘’“”•–—ک™ڑ›œ‌‍ں ،¢£¤¥¦§¨©ھ«¬­®¯°±²³´µ¶·¸¹؛»¼½¾؟ہءآأؤإئابةتثجحخدذرزسشصض×طظعغـفقكàلâمنهوçèéêëىيîïًٌٍَôُِ÷ّùْûü‎‏ے"
      },
      "win1256": "windows1256",
      "cp1256": "windows1256",
      "windows1257": {
        "type": "_sbcs",
        "chars": "€�‚�„…†‡�‰�‹�¨ˇ¸�‘’“”•–—�™�›�¯˛� �¢£¤�¦§Ø©Ŗ«¬­®Æ°±²³´µ¶·ø¹ŗ»¼½¾æĄĮĀĆÄÅĘĒČÉŹĖĢĶĪĻŠŃŅÓŌÕÖ×ŲŁŚŪÜŻŽßąįāćäåęēčéźėģķīļšńņóōõö÷ųłśūüżž˙"
      },
      "win1257": "windows1257",
      "cp1257": "windows1257",
      "windows1258": {
        "type": "_sbcs",
        "chars": "€�‚ƒ„…†‡ˆ‰�‹Œ����‘’“”•–—˜™�›œ��Ÿ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
      },
      "win1258": "windows1258",
      "cp1258": "windows1258",
      "iso88591": {
        "type": "_sbcs",
        "chars": " ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
      },
      "cp28591": "iso88591",
      "iso88592": {
        "type": "_sbcs",
        "chars": " Ą˘Ł¤ĽŚ§¨ŠŞŤŹ­ŽŻ°ą˛ł´ľśˇ¸šşťź˝žżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙"
      },
      "cp28592": "iso88592",
      "iso88593": {
        "type": "_sbcs",
        "chars": " Ħ˘£¤�Ĥ§¨İŞĞĴ­�Ż°ħ²³´µĥ·¸ışğĵ½�żÀÁÂ�ÄĊĈÇÈÉÊËÌÍÎÏ�ÑÒÓÔĠÖ×ĜÙÚÛÜŬŜßàáâ�äċĉçèéêëìíîï�ñòóôġö÷ĝùúûüŭŝ˙"
      },
      "cp28593": "iso88593",
      "iso88594": {
        "type": "_sbcs",
        "chars": " ĄĸŖ¤ĨĻ§¨ŠĒĢŦ­Ž¯°ą˛ŗ´ĩļˇ¸šēģŧŊžŋĀÁÂÃÄÅÆĮČÉĘËĖÍÎĪĐŅŌĶÔÕÖ×ØŲÚÛÜŨŪßāáâãäåæįčéęëėíîīđņōķôõö÷øųúûüũū˙"
      },
      "cp28594": "iso88594",
      "iso88595": {
        "type": "_sbcs",
        "chars": " ЁЂЃЄЅІЇЈЉЊЋЌ­ЎЏАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя№ёђѓєѕіїјљњћќ§ўџ"
      },
      "cp28595": "iso88595",
      "iso88596": {
        "type": "_sbcs",
        "chars": " ���¤�������،­�������������؛���؟�ءآأؤإئابةتثجحخدذرزسشصضطظعغ�����ـفقكلمنهوىيًٌٍَُِّْ�������������"
      },
      "cp28596": "iso88596",
      "iso88597": {
        "type": "_sbcs",
        "chars": " ‘’£€₯¦§¨©ͺ«¬­�―°±²³΄΅Ά·ΈΉΊ»Ό½ΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�"
      },
      "cp28597": "iso88597",
      "iso88598": {
        "type": "_sbcs",
        "chars": " �¢£¤¥¦§¨©×«¬­®¯°±²³´µ¶·¸¹÷»¼½¾��������������������������������‗אבגדהוזחטיךכלםמןנסעףפץצקרשת��‎‏�"
      },
      "cp28598": "iso88598",
      "iso88599": {
        "type": "_sbcs",
        "chars": " ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏĞÑÒÓÔÕÖ×ØÙÚÛÜİŞßàáâãäåæçèéêëìíîïğñòóôõö÷øùúûüışÿ"
      },
      "cp28599": "iso88599",
      "iso885910": {
        "type": "_sbcs",
        "chars": " ĄĒĢĪĨĶ§ĻĐŠŦŽ­ŪŊ°ąēģīĩķ·ļđšŧž―ūŋĀÁÂÃÄÅÆĮČÉĘËĖÍÎÏÐŅŌÓÔÕÖŨØŲÚÛÜÝÞßāáâãäåæįčéęëėíîïðņōóôõöũøųúûüýþĸ"
      },
      "cp28600": "iso885910",
      "iso885911": {
        "type": "_sbcs",
        "chars": " กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
      },
      "cp28601": "iso885911",
      "iso885913": {
        "type": "_sbcs",
        "chars": " ”¢£¤„¦§Ø©Ŗ«¬­®Æ°±²³“µ¶·ø¹ŗ»¼½¾æĄĮĀĆÄÅĘĒČÉŹĖĢĶĪĻŠŃŅÓŌÕÖ×ŲŁŚŪÜŻŽßąįāćäåęēčéźėģķīļšńņóōõö÷ųłśūüżž’"
      },
      "cp28603": "iso885913",
      "iso885914": {
        "type": "_sbcs",
        "chars": " Ḃḃ£ĊċḊ§Ẁ©ẂḋỲ­®ŸḞḟĠġṀṁ¶ṖẁṗẃṠỳẄẅṡÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏŴÑÒÓÔÕÖṪØÙÚÛÜÝŶßàáâãäåæçèéêëìíîïŵñòóôõöṫøùúûüýŷÿ"
      },
      "cp28604": "iso885914",
      "iso885915": {
        "type": "_sbcs",
        "chars": " ¡¢£€¥Š§š©ª«¬­®¯°±²³Žµ¶·ž¹º»ŒœŸ¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
      },
      "cp28605": "iso885915",
      "iso885916": {
        "type": "_sbcs",
        "chars": " ĄąŁ€„Š§š©Ș«Ź­źŻ°±ČłŽ”¶·žčș»ŒœŸżÀÁÂĂÄĆÆÇÈÉÊËÌÍÎÏĐŃÒÓÔŐÖŚŰÙÚÛÜĘȚßàáâăäćæçèéêëìíîïđńòóôőöśűùúûüęțÿ"
      },
      "cp28606": "iso885916",
      "cp437": {
        "type": "_sbcs",
        "chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
      },
      "ibm437": "cp437",
      "csibm437": "cp437",
      "cp737": {
        "type": "_sbcs",
        "chars": "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρσςτυφχψ░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀ωάέήϊίόύϋώΆΈΉΊΌΎΏ±≥≤ΪΫ÷≈°∙·√ⁿ²■ "
      },
      "ibm737": "cp737",
      "csibm737": "cp737",
      "cp775": {
        "type": "_sbcs",
        "chars": "ĆüéāäģåćłēŖŗīŹÄÅÉæÆōöĢ¢ŚśÖÜø£Ø×¤ĀĪóŻżź”¦©®¬½¼Ł«»░▒▓│┤ĄČĘĖ╣║╗╝ĮŠ┐└┴┬├─┼ŲŪ╚╔╩╦╠═╬Žąčęėįšųūž┘┌█▄▌▐▀ÓßŌŃõÕµńĶķĻļņĒŅ’­±“¾¶§÷„°∙·¹³²■ "
      },
      "ibm775": "cp775",
      "csibm775": "cp775",
      "cp850": {
        "type": "_sbcs",
        "chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ "
      },
      "ibm850": "cp850",
      "csibm850": "cp850",
      "cp852": {
        "type": "_sbcs",
        "chars": "ÇüéâäůćçłëŐőîŹÄĆÉĹĺôöĽľŚśÖÜŤťŁ×čáíóúĄąŽžĘę¬źČş«»░▒▓│┤ÁÂĚŞ╣║╗╝Żż┐└┴┬├─┼Ăă╚╔╩╦╠═╬¤đĐĎËďŇÍÎě┘┌█▄ŢŮ▀ÓßÔŃńňŠšŔÚŕŰýÝţ´­˝˛ˇ˘§÷¸°¨˙űŘř■ "
      },
      "ibm852": "cp852",
      "csibm852": "cp852",
      "cp855": {
        "type": "_sbcs",
        "chars": "ђЂѓЃёЁєЄѕЅіІїЇјЈљЉњЊћЋќЌўЎџЏюЮъЪаАбБцЦдДеЕфФгГ«»░▒▓│┤хХиИ╣║╗╝йЙ┐└┴┬├─┼кК╚╔╩╦╠═╬¤лЛмМнНоОп┘┌█▄Пя▀ЯрРсСтТуУжЖвВьЬ№­ыЫзЗшШэЭщЩчЧ§■ "
      },
      "ibm855": "cp855",
      "csibm855": "cp855",
      "cp856": {
        "type": "_sbcs",
        "chars": "אבגדהוזחטיךכלםמןנסעףפץצקרשת�£�×����������®¬½¼�«»░▒▓│┤���©╣║╗╝¢¥┐└┴┬├─┼��╚╔╩╦╠═╬¤���������┘┌█▄¦�▀������µ�������¯´­±‗¾¶§÷¸°¨·¹³²■ "
      },
      "ibm856": "cp856",
      "csibm856": "cp856",
      "cp857": {
        "type": "_sbcs",
        "chars": "ÇüéâäàåçêëèïîıÄÅÉæÆôöòûùİÖÜø£ØŞşáíóúñÑĞğ¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ºªÊËÈ�ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµ�×ÚÛÙìÿ¯´­±�¾¶§÷¸°¨·¹³²■ "
      },
      "ibm857": "cp857",
      "csibm857": "cp857",
      "cp858": {
        "type": "_sbcs",
        "chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈ€ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ "
      },
      "ibm858": "cp858",
      "csibm858": "cp858",
      "cp860": {
        "type": "_sbcs",
        "chars": "ÇüéâãàÁçêÊèÍÔìÃÂÉÀÈôõòÚùÌÕÜ¢£Ù₧ÓáíóúñÑªº¿Ò¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
      },
      "ibm860": "cp860",
      "csibm860": "cp860",
      "cp861": {
        "type": "_sbcs",
        "chars": "ÇüéâäàåçêëèÐðÞÄÅÉæÆôöþûÝýÖÜø£Ø₧ƒáíóúÁÍÓÚ¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
      },
      "ibm861": "cp861",
      "csibm861": "cp861",
      "cp862": {
        "type": "_sbcs",
        "chars": "אבגדהוזחטיךכלםמןנסעףפץצקרשת¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
      },
      "ibm862": "cp862",
      "csibm862": "cp862",
      "cp863": {
        "type": "_sbcs",
        "chars": "ÇüéâÂà¶çêëèïî‗À§ÉÈÊôËÏûù¤ÔÜ¢£ÙÛƒ¦´óú¨¸³¯Î⌐¬½¼¾«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
      },
      "ibm863": "cp863",
      "csibm863": "cp863",
      "cp864": {
        "type": "_sbcs",
        "chars": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f !\"#$٪&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~°·∙√▒─│┼┤┬├┴┐┌└┘β∞φ±½¼≈«»ﻷﻸ��ﻻﻼ� ­ﺂ£¤ﺄ��ﺎﺏﺕﺙ،ﺝﺡﺥ٠١٢٣٤٥٦٧٨٩ﻑ؛ﺱﺵﺹ؟¢ﺀﺁﺃﺅﻊﺋﺍﺑﺓﺗﺛﺟﺣﺧﺩﺫﺭﺯﺳﺷﺻﺿﻁﻅﻋﻏ¦¬÷×ﻉـﻓﻗﻛﻟﻣﻧﻫﻭﻯﻳﺽﻌﻎﻍﻡﹽّﻥﻩﻬﻰﻲﻐﻕﻵﻶﻝﻙﻱ■�"
      },
      "ibm864": "cp864",
      "csibm864": "cp864",
      "cp865": {
        "type": "_sbcs",
        "chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø₧ƒáíóúñÑªº¿⌐¬½¼¡«¤░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
      },
      "ibm865": "cp865",
      "csibm865": "cp865",
      "cp866": {
        "type": "_sbcs",
        "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№¤■ "
      },
      "ibm866": "cp866",
      "csibm866": "cp866",
      "cp869": {
        "type": "_sbcs",
        "chars": "������Ά�·¬¦‘’Έ―ΉΊΪΌ��ΎΫ©Ώ²³ά£έήίϊΐόύΑΒΓΔΕΖΗ½ΘΙ«»░▒▓│┤ΚΛΜΝ╣║╗╝ΞΟ┐└┴┬├─┼ΠΡ╚╔╩╦╠═╬ΣΤΥΦΧΨΩαβγ┘┌█▄δε▀ζηθικλμνξοπρσςτ΄­±υφχ§ψ΅°¨ωϋΰώ■ "
      },
      "ibm869": "cp869",
      "csibm869": "cp869",
      "cp922": {
        "type": "_sbcs",
        "chars": " ¡¢£¤¥¦§¨©ª«¬­®‾°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏŠÑÒÓÔÕÖ×ØÙÚÛÜÝŽßàáâãäåæçèéêëìíîïšñòóôõö÷øùúûüýžÿ"
      },
      "ibm922": "cp922",
      "csibm922": "cp922",
      "cp1046": {
        "type": "_sbcs",
        "chars": "ﺈ×÷ﹱ■│─┐┌└┘ﹹﹻﹽﹿﹷﺊﻰﻳﻲﻎﻏﻐﻶﻸﻺﻼ ¤ﺋﺑﺗﺛﺟﺣ،­ﺧﺳ٠١٢٣٤٥٦٧٨٩ﺷ؛ﺻﺿﻊ؟ﻋءآأؤإئابةتثجحخدذرزسشصضطﻇعغﻌﺂﺄﺎﻓـفقكلمنهوىيًٌٍَُِّْﻗﻛﻟﻵﻷﻹﻻﻣﻧﻬﻩ�"
      },
      "ibm1046": "cp1046",
      "csibm1046": "cp1046",
      "cp1124": {
        "type": "_sbcs",
        "chars": " ЁЂҐЄЅІЇЈЉЊЋЌ­ЎЏАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя№ёђґєѕіїјљњћќ§ўџ"
      },
      "ibm1124": "cp1124",
      "csibm1124": "cp1124",
      "cp1125": {
        "type": "_sbcs",
        "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёҐґЄєІіЇї·√№¤■ "
      },
      "ibm1125": "cp1125",
      "csibm1125": "cp1125",
      "cp1129": {
        "type": "_sbcs",
        "chars": " ¡¢£¤¥¦§œ©ª«¬­®¯°±²³Ÿµ¶·Œ¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
      },
      "ibm1129": "cp1129",
      "csibm1129": "cp1129",
      "cp1133": {
        "type": "_sbcs",
        "chars": " ກຂຄງຈສຊຍດຕຖທນບປຜຝພຟມຢຣລວຫອຮ���ຯະາຳິີຶືຸູຼັົຽ���ເແໂໃໄ່້໊໋໌ໍໆ�ໜໝ₭����������������໐໑໒໓໔໕໖໗໘໙��¢¬¦�"
      },
      "ibm1133": "cp1133",
      "csibm1133": "cp1133",
      "cp1161": {
        "type": "_sbcs",
        "chars": "��������������������������������่กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู้๊๋€฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛¢¬¦ "
      },
      "ibm1161": "cp1161",
      "csibm1161": "cp1161",
      "cp1162": {
        "type": "_sbcs",
        "chars": "€…‘’“”•–— กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
      },
      "ibm1162": "cp1162",
      "csibm1162": "cp1162",
      "cp1163": {
        "type": "_sbcs",
        "chars": " ¡¢£€¥¦§œ©ª«¬­®¯°±²³Ÿµ¶·Œ¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
      },
      "ibm1163": "cp1163",
      "csibm1163": "cp1163",
      "maccroatian": {
        "type": "_sbcs",
        "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®Š™´¨≠ŽØ∞±≤≥∆µ∂∑∏š∫ªºΩžø¿¡¬√ƒ≈Ć«Č… ÀÃÕŒœĐ—“”‘’÷◊�©⁄¤‹›Æ»–·‚„‰ÂćÁčÈÍÎÏÌÓÔđÒÚÛÙıˆ˜¯πË˚¸Êæˇ"
      },
      "maccyrillic": {
        "type": "_sbcs",
        "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°¢£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµ∂ЈЄєЇїЉљЊњјЅ¬√ƒ≈∆«»… ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю¤"
      },
      "macgreek": {
        "type": "_sbcs",
        "chars": "Ä¹²É³ÖÜ΅àâä΄¨çéèêë£™îï•½‰ôö¦­ùûü†ΓΔΘΛΞΠß®©ΣΪ§≠°·Α±≤≥¥ΒΕΖΗΙΚΜΦΫΨΩάΝ¬ΟΡ≈Τ«»… ΥΧΆΈœ–―“”‘’÷ΉΊΌΎέήίόΏύαβψδεφγηιξκλμνοπώρστθωςχυζϊϋΐΰ�"
      },
      "maciceland": {
        "type": "_sbcs",
        "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûüÝ°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤ÐðÞþý·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
      },
      "macroman": {
        "type": "_sbcs",
        "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
      },
      "macromania": {
        "type": "_sbcs",
        "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ĂŞ∞±≤≥¥µ∂∑∏π∫ªºΩăş¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›Ţţ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
      },
      "macthai": {
        "type": "_sbcs",
        "chars": "«»…“”�•‘’� กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู﻿​–—฿เแโใไๅๆ็่้๊๋์ํ™๏๐๑๒๓๔๕๖๗๘๙®©����"
      },
      "macturkish": {
        "type": "_sbcs",
        "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸĞğİıŞş‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙ�ˆ˜¯˘˙˚¸˝˛ˇ"
      },
      "macukraine": {
        "type": "_sbcs",
        "chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°Ґ£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµґЈЄєЇїЉљЊњјЅ¬√ƒ≈∆«»… ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю¤"
      },
      "koi8r": {
        "type": "_sbcs",
        "chars": "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ё╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡Ё╢╣╤╥╦╧╨╩╪╫╬©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
      },
      "koi8u": {
        "type": "_sbcs",
        "chars": "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ёє╔ії╗╘╙╚╛ґ╝╞╟╠╡ЁЄ╣ІЇ╦╧╨╩╪Ґ╬©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
      },
      "koi8ru": {
        "type": "_sbcs",
        "chars": "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ёє╔ії╗╘╙╚╛ґў╞╟╠╡ЁЄ╣ІЇ╦╧╨╩╪ҐЎ©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
      },
      "koi8t": {
        "type": "_sbcs",
        "chars": "қғ‚Ғ„…†‡�‰ҳ‹ҲҷҶ�Қ‘’“”•–—�™�›�����ӯӮё¤ӣ¦§���«¬­®�°±²Ё�Ӣ¶·�№�»���©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
      },
      "armscii8": {
        "type": "_sbcs",
        "chars": " �և։)(»«—.՝,-֊…՜՛՞ԱաԲբԳգԴդԵեԶզԷէԸըԹթԺժԻիԼլԽխԾծԿկՀհՁձՂղՃճՄմՅյՆնՇշՈոՉչՊպՋջՌռՍսՎվՏտՐրՑցՒւՓփՔքՕօՖֆ՚�"
      },
      "rk1048": {
        "type": "_sbcs",
        "chars": "ЂЃ‚ѓ„…†‡€‰Љ‹ЊҚҺЏђ‘’“”•–—�™љ›њқһџ ҰұӘ¤Ө¦§Ё©Ғ«¬­®Ү°±Ііөµ¶·ё№ғ»әҢңүАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
      },
      "tcvn": {
        "type": "_sbcs",
        "chars": "\u0000ÚỤ\u0003ỪỬỮ\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010ỨỰỲỶỸÝỴ\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ÀẢÃÁẠẶẬÈẺẼÉẸỆÌỈĨÍỊÒỎÕÓỌỘỜỞỠỚỢÙỦŨ ĂÂÊÔƠƯĐăâêôơưđẶ̀̀̉̃́àảãáạẲằẳẵắẴẮẦẨẪẤỀặầẩẫấậèỂẻẽéẹềểễếệìỉỄẾỒĩíịòỔỏõóọồổỗốộờởỡớợùỖủũúụừửữứựỳỷỹýỵỐ"
      },
      "georgianacademy": {
        "type": "_sbcs",
        "chars": "‚ƒ„…†‡ˆ‰Š‹Œ‘’“”•–—˜™š›œŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰჱჲჳჴჵჶçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
      },
      "georgianps": {
        "type": "_sbcs",
        "chars": "‚ƒ„…†‡ˆ‰Š‹Œ‘’“”•–—˜™š›œŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿აბგდევზჱთიკლმნჲოპჟრსტჳუფქღყშჩცძწჭხჴჯჰჵæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
      },
      "pt154": {
        "type": "_sbcs",
        "chars": "ҖҒӮғ„…ҶҮҲүҠӢҢҚҺҸҗ‘’“”•–—ҳҷҡӣңқһҹ ЎўЈӨҘҰ§Ё©Ә«¬ӯ®Ҝ°ұІіҙө¶·ё№ә»јҪҫҝАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
      },
      "viscii": {
        "type": "_sbcs",
        "chars": "\u0000\u0001Ẳ\u0003\u0004ẴẪ\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013Ỷ\u0015\u0016\u0017\u0018Ỹ\u001a\u001b\u001c\u001dỴ\u001f !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ẠẮẰẶẤẦẨẬẼẸẾỀỂỄỆỐỒỔỖỘỢỚỜỞỊỎỌỈỦŨỤỲÕắằặấầẩậẽẹếềểễệốồổỗỠƠộờởịỰỨỪỬơớƯÀÁÂÃẢĂẳẵÈÉÊẺÌÍĨỳĐứÒÓÔạỷừửÙÚỹỵÝỡưàáâãảăữẫèéêẻìíĩỉđựòóôõỏọụùúũủýợỮ"
      },
      "iso646cn": {
        "type": "_sbcs",
        "chars": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f !\"#¥%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}‾��������������������������������������������������������������������������������������������������������������������������������"
      },
      "iso646jp": {
        "type": "_sbcs",
        "chars": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001a\u001b\u001c\u001d\u001e\u001f !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[¥]^_`abcdefghijklmnopqrstuvwxyz{|}‾��������������������������������������������������������������������������������������������������������������������������������"
      },
      "hproman8": {
        "type": "_sbcs",
        "chars": " ÀÂÈÊËÎÏ´ˋˆ¨˜ÙÛ₤¯Ýý°ÇçÑñ¡¿¤£¥§ƒ¢âêôûáéóúàèòùäëöüÅîØÆåíøæÄìÖÜÉïßÔÁÃãÐðÍÌÓÒÕõŠšÚŸÿÞþ·µ¶¾—¼½ªº«■»±�"
      },
      "macintosh": {
        "type": "_sbcs",
        "chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
      },
      "ascii": {
        "type": "_sbcs",
        "chars": "��������������������������������������������������������������������������������������������������������������������������������"
      },
      "tis620": {
        "type": "_sbcs",
        "chars": "���������������������������������กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
      }
    }
  provide("iconv-lite/encodings/sbcs-data-generated", module.exports);
}(global));

// pakmanager:iconv-lite/encodings/dbcs-codec
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict"
    
    // Multibyte codec. In this scheme, a character is represented by 1 or more bytes.
    // Our codec supports UTF-16 surrogates, extensions for GB18030 and unicode sequences.
    // To save memory and loading time, we read table files only when requested.
    
    exports._dbcs = DBCSCodec;
    
    var UNASSIGNED = -1,
        GB18030_CODE = -2,
        SEQ_START  = -10,
        NODE_START = -1000,
        UNASSIGNED_NODE = new Array(0x100),
        DEF_CHAR = -1;
    
    for (var i = 0; i < 0x100; i++)
        UNASSIGNED_NODE[i] = UNASSIGNED;
    
    
    // Class DBCSCodec reads and initializes mapping tables.
    function DBCSCodec(codecOptions, iconv) {
        this.encodingName = codecOptions.encodingName;
        if (!codecOptions)
            throw new Error("DBCS codec is called without the data.")
        if (!codecOptions.table)
            throw new Error("Encoding '" + this.encodingName + "' has no data.");
    
        // Load tables.
        var mappingTable = codecOptions.table();
    
    
        // Decode tables: MBCS -> Unicode.
    
        // decodeTables is a trie, encoded as an array of arrays of integers. Internal arrays are trie nodes and all have len = 256.
        // Trie root is decodeTables[0].
        // Values: >=  0 -> unicode character code. can be > 0xFFFF
        //         == UNASSIGNED -> unknown/unassigned sequence.
        //         == GB18030_CODE -> this is the end of a GB18030 4-byte sequence.
        //         <= NODE_START -> index of the next node in our trie to process next byte.
        //         <= SEQ_START  -> index of the start of a character code sequence, in decodeTableSeq.
        this.decodeTables = [];
        this.decodeTables[0] = UNASSIGNED_NODE.slice(0); // Create root node.
    
        // Sometimes a MBCS char corresponds to a sequence of unicode chars. We store them as arrays of integers here. 
        this.decodeTableSeq = [];
    
        // Actual mapping tables consist of chunks. Use them to fill up decode tables.
        for (var i = 0; i < mappingTable.length; i++)
            this._addDecodeChunk(mappingTable[i]);
    
        this.defaultCharUnicode = iconv.defaultCharUnicode;
    
        
        // Encode tables: Unicode -> DBCS.
    
        // `encodeTable` is array mapping from unicode char to encoded char. All its values are integers for performance.
        // Because it can be sparse, it is represented as array of buckets by 256 chars each. Bucket can be null.
        // Values: >=  0 -> it is a normal char. Write the value (if <=256 then 1 byte, if <=65536 then 2 bytes, etc.).
        //         == UNASSIGNED -> no conversion found. Output a default char.
        //         <= SEQ_START  -> it's an index in encodeTableSeq, see below. The character starts a sequence.
        this.encodeTable = [];
        
        // `encodeTableSeq` is used when a sequence of unicode characters is encoded as a single code. We use a tree of
        // objects where keys correspond to characters in sequence and leafs are the encoded dbcs values. A special DEF_CHAR key
        // means end of sequence (needed when one sequence is a strict subsequence of another).
        // Objects are kept separately from encodeTable to increase performance.
        this.encodeTableSeq = [];
    
        // Some chars can be decoded, but need not be encoded.
        var skipEncodeChars = {};
        if (codecOptions.encodeSkipVals)
            for (var i = 0; i < codecOptions.encodeSkipVals.length; i++) {
                var val = codecOptions.encodeSkipVals[i];
                if (typeof val === 'number')
                    skipEncodeChars[val] = true;
                else
                    for (var j = val.from; j <= val.to; j++)
                        skipEncodeChars[j] = true;
            }
            
        // Use decode trie to recursively fill out encode tables.
        this._fillEncodeTable(0, 0, skipEncodeChars);
    
        // Add more encoding pairs when needed.
        if (codecOptions.encodeAdd) {
            for (var uChar in codecOptions.encodeAdd)
                if (Object.prototype.hasOwnProperty.call(codecOptions.encodeAdd, uChar))
                    this._setEncodeChar(uChar.charCodeAt(0), codecOptions.encodeAdd[uChar]);
        }
    
        this.defCharSB  = this.encodeTable[0][iconv.defaultCharSingleByte.charCodeAt(0)];
        if (this.defCharSB === UNASSIGNED) this.defCharSB = this.encodeTable[0]['?'];
        if (this.defCharSB === UNASSIGNED) this.defCharSB = "?".charCodeAt(0);
    
    
        // Load & create GB18030 tables when needed.
        if (typeof codecOptions.gb18030 === 'function') {
            this.gb18030 = codecOptions.gb18030(); // Load GB18030 ranges.
    
            // Add GB18030 decode tables.
            var thirdByteNodeIdx = this.decodeTables.length;
            var thirdByteNode = this.decodeTables[thirdByteNodeIdx] = UNASSIGNED_NODE.slice(0);
    
            var fourthByteNodeIdx = this.decodeTables.length;
            var fourthByteNode = this.decodeTables[fourthByteNodeIdx] = UNASSIGNED_NODE.slice(0);
    
            for (var i = 0x81; i <= 0xFE; i++) {
                var secondByteNodeIdx = NODE_START - this.decodeTables[0][i];
                var secondByteNode = this.decodeTables[secondByteNodeIdx];
                for (var j = 0x30; j <= 0x39; j++)
                    secondByteNode[j] = NODE_START - thirdByteNodeIdx;
            }
            for (var i = 0x81; i <= 0xFE; i++)
                thirdByteNode[i] = NODE_START - fourthByteNodeIdx;
            for (var i = 0x30; i <= 0x39; i++)
                fourthByteNode[i] = GB18030_CODE
        }        
    }
    
    DBCSCodec.prototype.encoder = DBCSEncoder;
    DBCSCodec.prototype.decoder = DBCSDecoder;
    
    // Decoder helpers
    DBCSCodec.prototype._getDecodeTrieNode = function(addr) {
        var bytes = [];
        for (; addr > 0; addr >>= 8)
            bytes.push(addr & 0xFF);
        if (bytes.length == 0)
            bytes.push(0);
    
        var node = this.decodeTables[0];
        for (var i = bytes.length-1; i > 0; i--) { // Traverse nodes deeper into the trie.
            var val = node[bytes[i]];
    
            if (val == UNASSIGNED) { // Create new node.
                node[bytes[i]] = NODE_START - this.decodeTables.length;
                this.decodeTables.push(node = UNASSIGNED_NODE.slice(0));
            }
            else if (val <= NODE_START) { // Existing node.
                node = this.decodeTables[NODE_START - val];
            }
            else
                throw new Error("Overwrite byte in " + this.encodingName + ", addr: " + addr.toString(16));
        }
        return node;
    }
    
    
    DBCSCodec.prototype._addDecodeChunk = function(chunk) {
        // First element of chunk is the hex mbcs code where we start.
        var curAddr = parseInt(chunk[0], 16);
    
        // Choose the decoding node where we'll write our chars.
        var writeTable = this._getDecodeTrieNode(curAddr);
        curAddr = curAddr & 0xFF;
    
        // Write all other elements of the chunk to the table.
        for (var k = 1; k < chunk.length; k++) {
            var part = chunk[k];
            if (typeof part === "string") { // String, write as-is.
                for (var l = 0; l < part.length;) {
                    var code = part.charCodeAt(l++);
                    if (0xD800 <= code && code < 0xDC00) { // Decode surrogate
                        var codeTrail = part.charCodeAt(l++);
                        if (0xDC00 <= codeTrail && codeTrail < 0xE000)
                            writeTable[curAddr++] = 0x10000 + (code - 0xD800) * 0x400 + (codeTrail - 0xDC00);
                        else
                            throw new Error("Incorrect surrogate pair in "  + this.encodingName + " at chunk " + chunk[0]);
                    }
                    else if (0x0FF0 < code && code <= 0x0FFF) { // Character sequence (our own encoding used)
                        var len = 0xFFF - code + 2;
                        var seq = [];
                        for (var m = 0; m < len; m++)
                            seq.push(part.charCodeAt(l++)); // Simple variation: don't support surrogates or subsequences in seq.
    
                        writeTable[curAddr++] = SEQ_START - this.decodeTableSeq.length;
                        this.decodeTableSeq.push(seq);
                    }
                    else
                        writeTable[curAddr++] = code; // Basic char
                }
            } 
            else if (typeof part === "number") { // Integer, meaning increasing sequence starting with prev character.
                var charCode = writeTable[curAddr - 1] + 1;
                for (var l = 0; l < part; l++)
                    writeTable[curAddr++] = charCode++;
            }
            else
                throw new Error("Incorrect type '" + typeof part + "' given in "  + this.encodingName + " at chunk " + chunk[0]);
        }
        if (curAddr > 0xFF)
            throw new Error("Incorrect chunk in "  + this.encodingName + " at addr " + chunk[0] + ": too long" + curAddr);
    }
    
    // Encoder helpers
    DBCSCodec.prototype._getEncodeBucket = function(uCode) {
        var high = uCode >> 8; // This could be > 0xFF because of astral characters.
        if (this.encodeTable[high] === undefined)
            this.encodeTable[high] = UNASSIGNED_NODE.slice(0); // Create bucket on demand.
        return this.encodeTable[high];
    }
    
    DBCSCodec.prototype._setEncodeChar = function(uCode, dbcsCode) {
        var bucket = this._getEncodeBucket(uCode);
        var low = uCode & 0xFF;
        if (bucket[low] <= SEQ_START)
            this.encodeTableSeq[SEQ_START-bucket[low]][DEF_CHAR] = dbcsCode; // There's already a sequence, set a single-char subsequence of it.
        else if (bucket[low] == UNASSIGNED)
            bucket[low] = dbcsCode;
    }
    
    DBCSCodec.prototype._setEncodeSequence = function(seq, dbcsCode) {
        
        // Get the root of character tree according to first character of the sequence.
        var uCode = seq[0];
        var bucket = this._getEncodeBucket(uCode);
        var low = uCode & 0xFF;
    
        var node;
        if (bucket[low] <= SEQ_START) {
            // There's already a sequence with  - use it.
            node = this.encodeTableSeq[SEQ_START-bucket[low]];
        }
        else {
            // There was no sequence object - allocate a new one.
            node = {};
            if (bucket[low] !== UNASSIGNED) node[DEF_CHAR] = bucket[low]; // If a char was set before - make it a single-char subsequence.
            bucket[low] = SEQ_START - this.encodeTableSeq.length;
            this.encodeTableSeq.push(node);
        }
    
        // Traverse the character tree, allocating new nodes as needed.
        for (var j = 1; j < seq.length-1; j++) {
            var oldVal = node[uCode];
            if (typeof oldVal === 'object')
                node = oldVal;
            else {
                node = node[uCode] = {}
                if (oldVal !== undefined)
                    node[DEF_CHAR] = oldVal
            }
        }
    
        // Set the leaf to given dbcsCode.
        uCode = seq[seq.length-1];
        node[uCode] = dbcsCode;
    }
    
    DBCSCodec.prototype._fillEncodeTable = function(nodeIdx, prefix, skipEncodeChars) {
        var node = this.decodeTables[nodeIdx];
        for (var i = 0; i < 0x100; i++) {
            var uCode = node[i];
            var mbCode = prefix + i;
            if (skipEncodeChars[mbCode])
                continue;
    
            if (uCode >= 0)
                this._setEncodeChar(uCode, mbCode);
            else if (uCode <= NODE_START)
                this._fillEncodeTable(NODE_START - uCode, mbCode << 8, skipEncodeChars);
            else if (uCode <= SEQ_START)
                this._setEncodeSequence(this.decodeTableSeq[SEQ_START - uCode], mbCode);
        }
    }
    
    
    
    // == Encoder ==================================================================
    
    function DBCSEncoder(options, codec) {
        // Encoder state
        this.leadSurrogate = -1;
        this.seqObj = undefined;
        
        // Static data
        this.encodeTable = codec.encodeTable;
        this.encodeTableSeq = codec.encodeTableSeq;
        this.defaultCharSingleByte = codec.defCharSB;
        this.gb18030 = codec.gb18030;
    }
    
    DBCSEncoder.prototype.write = function(str) {
        var newBuf = new Buffer(str.length * (this.gb18030 ? 4 : 3)), 
            leadSurrogate = this.leadSurrogate,
            seqObj = this.seqObj, nextChar = -1,
            i = 0, j = 0;
    
        while (true) {
            // 0. Get next character.
            if (nextChar === -1) {
                if (i == str.length) break;
                var uCode = str.charCodeAt(i++);
            }
            else {
                var uCode = nextChar;
                nextChar = -1;    
            }
    
            // 1. Handle surrogates.
            if (0xD800 <= uCode && uCode < 0xE000) { // Char is one of surrogates.
                if (uCode < 0xDC00) { // We've got lead surrogate.
                    if (leadSurrogate === -1) {
                        leadSurrogate = uCode;
                        continue;
                    } else {
                        leadSurrogate = uCode;
                        // Double lead surrogate found.
                        uCode = UNASSIGNED;
                    }
                } else { // We've got trail surrogate.
                    if (leadSurrogate !== -1) {
                        uCode = 0x10000 + (leadSurrogate - 0xD800) * 0x400 + (uCode - 0xDC00);
                        leadSurrogate = -1;
                    } else {
                        // Incomplete surrogate pair - only trail surrogate found.
                        uCode = UNASSIGNED;
                    }
                    
                }
            }
            else if (leadSurrogate !== -1) {
                // Incomplete surrogate pair - only lead surrogate found.
                nextChar = uCode; uCode = UNASSIGNED; // Write an error, then current char.
                leadSurrogate = -1;
            }
    
            // 2. Convert uCode character.
            var dbcsCode = UNASSIGNED;
            if (seqObj !== undefined && uCode != UNASSIGNED) { // We are in the middle of the sequence
                var resCode = seqObj[uCode];
                if (typeof resCode === 'object') { // Sequence continues.
                    seqObj = resCode;
                    continue;
    
                } else if (typeof resCode == 'number') { // Sequence finished. Write it.
                    dbcsCode = resCode;
    
                } else if (resCode == undefined) { // Current character is not part of the sequence.
    
                    // Try default character for this sequence
                    resCode = seqObj[DEF_CHAR];
                    if (resCode !== undefined) {
                        dbcsCode = resCode; // Found. Write it.
                        nextChar = uCode; // Current character will be written too in the next iteration.
    
                    } else {
                        // TODO: What if we have no default? (resCode == undefined)
                        // Then, we should write first char of the sequence as-is and try the rest recursively.
                        // Didn't do it for now because no encoding has this situation yet.
                        // Currently, just skip the sequence and write current char.
                    }
                }
                seqObj = undefined;
            }
            else if (uCode >= 0) {  // Regular character
                var subtable = this.encodeTable[uCode >> 8];
                if (subtable !== undefined)
                    dbcsCode = subtable[uCode & 0xFF];
                
                if (dbcsCode <= SEQ_START) { // Sequence start
                    seqObj = this.encodeTableSeq[SEQ_START-dbcsCode];
                    continue;
                }
    
                if (dbcsCode == UNASSIGNED && this.gb18030) {
                    // Use GB18030 algorithm to find character(s) to write.
                    var idx = findIdx(this.gb18030.uChars, uCode);
                    if (idx != -1) {
                        var dbcsCode = this.gb18030.gbChars[idx] + (uCode - this.gb18030.uChars[idx]);
                        newBuf[j++] = 0x81 + Math.floor(dbcsCode / 12600); dbcsCode = dbcsCode % 12600;
                        newBuf[j++] = 0x30 + Math.floor(dbcsCode / 1260); dbcsCode = dbcsCode % 1260;
                        newBuf[j++] = 0x81 + Math.floor(dbcsCode / 10); dbcsCode = dbcsCode % 10;
                        newBuf[j++] = 0x30 + dbcsCode;
                        continue;
                    }
                }
            }
    
            // 3. Write dbcsCode character.
            if (dbcsCode === UNASSIGNED)
                dbcsCode = this.defaultCharSingleByte;
            
            if (dbcsCode < 0x100) {
                newBuf[j++] = dbcsCode;
            }
            else if (dbcsCode < 0x10000) {
                newBuf[j++] = dbcsCode >> 8;   // high byte
                newBuf[j++] = dbcsCode & 0xFF; // low byte
            }
            else {
                newBuf[j++] = dbcsCode >> 16;
                newBuf[j++] = (dbcsCode >> 8) & 0xFF;
                newBuf[j++] = dbcsCode & 0xFF;
            }
        }
    
        this.seqObj = seqObj;
        this.leadSurrogate = leadSurrogate;
        return newBuf.slice(0, j);
    }
    
    DBCSEncoder.prototype.end = function() {
        if (this.leadSurrogate === -1 && this.seqObj === undefined)
            return; // All clean. Most often case.
    
        var newBuf = new Buffer(10), j = 0;
    
        if (this.seqObj) { // We're in the sequence.
            var dbcsCode = this.seqObj[DEF_CHAR];
            if (dbcsCode !== undefined) { // Write beginning of the sequence.
                if (dbcsCode < 0x100) {
                    newBuf[j++] = dbcsCode;
                }
                else {
                    newBuf[j++] = dbcsCode >> 8;   // high byte
                    newBuf[j++] = dbcsCode & 0xFF; // low byte
                }
            } else {
                // See todo above.
            }
            this.seqObj = undefined;
        }
    
        if (this.leadSurrogate !== -1) {
            // Incomplete surrogate pair - only lead surrogate found.
            newBuf[j++] = this.defaultCharSingleByte;
            this.leadSurrogate = -1;
        }
        
        return newBuf.slice(0, j);
    }
    
    // Export for testing
    DBCSEncoder.prototype.findIdx = findIdx;
    
    
    // == Decoder ==================================================================
    
    function DBCSDecoder(options, codec) {
        // Decoder state
        this.nodeIdx = 0;
        this.prevBuf = new Buffer(0);
    
        // Static data
        this.decodeTables = codec.decodeTables;
        this.decodeTableSeq = codec.decodeTableSeq;
        this.defaultCharUnicode = codec.defaultCharUnicode;
        this.gb18030 = codec.gb18030;
    }
    
    DBCSDecoder.prototype.write = function(buf) {
        var newBuf = new Buffer(buf.length*2),
            nodeIdx = this.nodeIdx, 
            prevBuf = this.prevBuf, prevBufOffset = this.prevBuf.length,
            seqStart = -this.prevBuf.length, // idx of the start of current parsed sequence.
            uCode;
    
        if (prevBufOffset > 0) // Make prev buf overlap a little to make it easier to slice later.
            prevBuf = Buffer.concat([prevBuf, buf.slice(0, 10)]);
        
        for (var i = 0, j = 0; i < buf.length; i++) {
            var curByte = (i >= 0) ? buf[i] : prevBuf[i + prevBufOffset];
    
            // Lookup in current trie node.
            var uCode = this.decodeTables[nodeIdx][curByte];
    
            if (uCode >= 0) { 
                // Normal character, just use it.
            }
            else if (uCode === UNASSIGNED) { // Unknown char.
                // TODO: Callback with seq.
                //var curSeq = (seqStart >= 0) ? buf.slice(seqStart, i+1) : prevBuf.slice(seqStart + prevBufOffset, i+1 + prevBufOffset);
                i = seqStart; // Try to parse again, after skipping first byte of the sequence ('i' will be incremented by 'for' cycle).
                uCode = this.defaultCharUnicode.charCodeAt(0);
            }
            else if (uCode === GB18030_CODE) {
                var curSeq = (seqStart >= 0) ? buf.slice(seqStart, i+1) : prevBuf.slice(seqStart + prevBufOffset, i+1 + prevBufOffset);
                var ptr = (curSeq[0]-0x81)*12600 + (curSeq[1]-0x30)*1260 + (curSeq[2]-0x81)*10 + (curSeq[3]-0x30);
                var idx = findIdx(this.gb18030.gbChars, ptr);
                uCode = this.gb18030.uChars[idx] + ptr - this.gb18030.gbChars[idx];
            }
            else if (uCode <= NODE_START) { // Go to next trie node.
                nodeIdx = NODE_START - uCode;
                continue;
            }
            else if (uCode <= SEQ_START) { // Output a sequence of chars.
                var seq = this.decodeTableSeq[SEQ_START - uCode];
                for (var k = 0; k < seq.length - 1; k++) {
                    uCode = seq[k];
                    newBuf[j++] = uCode & 0xFF;
                    newBuf[j++] = uCode >> 8;
                }
                uCode = seq[seq.length-1];
            }
            else
                throw new Error("iconv-lite internal error: invalid decoding table value " + uCode + " at " + nodeIdx + "/" + curByte);
    
            // Write the character to buffer, handling higher planes using surrogate pair.
            if (uCode > 0xFFFF) { 
                uCode -= 0x10000;
                var uCodeLead = 0xD800 + Math.floor(uCode / 0x400);
                newBuf[j++] = uCodeLead & 0xFF;
                newBuf[j++] = uCodeLead >> 8;
    
                uCode = 0xDC00 + uCode % 0x400;
            }
            newBuf[j++] = uCode & 0xFF;
            newBuf[j++] = uCode >> 8;
    
            // Reset trie node.
            nodeIdx = 0; seqStart = i+1;
        }
    
        this.nodeIdx = nodeIdx;
        this.prevBuf = (seqStart >= 0) ? buf.slice(seqStart) : prevBuf.slice(seqStart + prevBufOffset);
        return newBuf.slice(0, j).toString('ucs2');
    }
    
    DBCSDecoder.prototype.end = function() {
        var ret = '';
    
        // Try to parse all remaining chars.
        while (this.prevBuf.length > 0) {
            // Skip 1 character in the buffer.
            ret += this.defaultCharUnicode;
            var buf = this.prevBuf.slice(1);
    
            // Parse remaining as usual.
            this.prevBuf = new Buffer(0);
            this.nodeIdx = 0;
            if (buf.length > 0)
                ret += this.write(buf);
        }
    
        this.nodeIdx = 0;
        return ret;
    }
    
    // Binary search for GB18030. Returns largest i such that table[i] <= val.
    function findIdx(table, val) {
        if (table[0] > val)
            return -1;
    
        var l = 0, r = table.length;
        while (l < r-1) { // always table[l] <= val < table[r]
            var mid = l + Math.floor((r-l+1)/2);
            if (table[mid] <= val)
                l = mid;
            else
                r = mid;
        }
        return l;
    }
    
    
  provide("iconv-lite/encodings/dbcs-codec", module.exports);
}(global));

// pakmanager:iconv-lite/encodings/dbcs-data
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict"
    
    // Description of supported double byte encodings and aliases.
    // Tables are not require()-d until they are needed to speed up library load.
    // require()-s are direct to support Browserify.
    
    module.exports = {
        
        // == Japanese/ShiftJIS ====================================================
        // All japanese encodings are based on JIS X set of standards:
        // JIS X 0201 - Single-byte encoding of ASCII + ¥ + Kana chars at 0xA1-0xDF.
        // JIS X 0208 - Main set of 6879 characters, placed in 94x94 plane, to be encoded by 2 bytes. 
        //              Has several variations in 1978, 1983, 1990 and 1997.
        // JIS X 0212 - Supplementary plane of 6067 chars in 94x94 plane. 1990. Effectively dead.
        // JIS X 0213 - Extension and modern replacement of 0208 and 0212. Total chars: 11233.
        //              2 planes, first is superset of 0208, second - revised 0212.
        //              Introduced in 2000, revised 2004. Some characters are in Unicode Plane 2 (0x2xxxx)
    
        // Byte encodings are:
        //  * Shift_JIS: Compatible with 0201, uses not defined chars in top half as lead bytes for double-byte
        //               encoding of 0208. Lead byte ranges: 0x81-0x9F, 0xE0-0xEF; Trail byte ranges: 0x40-0x7E, 0x80-0x9E, 0x9F-0xFC.
        //               Windows CP932 is a superset of Shift_JIS. Some companies added more chars, notably KDDI.
        //  * EUC-JP:    Up to 3 bytes per character. Used mostly on *nixes.
        //               0x00-0x7F       - lower part of 0201
        //               0x8E, 0xA1-0xDF - upper part of 0201
        //               (0xA1-0xFE)x2   - 0208 plane (94x94).
        //               0x8F, (0xA1-0xFE)x2 - 0212 plane (94x94).
        //  * JIS X 208: 7-bit, direct encoding of 0208. Byte ranges: 0x21-0x7E (94 values). Uncommon.
        //               Used as-is in ISO2022 family.
        //  * ISO2022-JP: Stateful encoding, with escape sequences to switch between ASCII, 
        //                0201-1976 Roman, 0208-1978, 0208-1983.
        //  * ISO2022-JP-1: Adds esc seq for 0212-1990.
        //  * ISO2022-JP-2: Adds esc seq for GB2313-1980, KSX1001-1992, ISO8859-1, ISO8859-7.
        //  * ISO2022-JP-3: Adds esc seq for 0201-1976 Kana set, 0213-2000 Planes 1, 2.
        //  * ISO2022-JP-2004: Adds 0213-2004 Plane 1.
        //
        // After JIS X 0213 appeared, Shift_JIS-2004, EUC-JISX0213 and ISO2022-JP-2004 followed, with just changing the planes.
        //
        // Overall, it seems that it's a mess :( http://www8.plala.or.jp/tkubota1/unicode-symbols-map2.html
    
    
        'shiftjis': {
            type: '_dbcs',
            table: function() { return require('./tables/shiftjis.json') },
            encodeAdd: {'\u00a5': 0x5C, '\u203E': 0x7E},
            encodeSkipVals: [{from: 0xED40, to: 0xF940}],
        },
        'csshiftjis': 'shiftjis',
        'mskanji': 'shiftjis',
        'sjis': 'shiftjis',
        'windows31j': 'shiftjis',
        'xsjis': 'shiftjis',
        'windows932': 'shiftjis',
        '932': 'shiftjis',
        'cp932': 'shiftjis',
    
        'eucjp': {
            type: '_dbcs',
            table: function() { return require('./tables/eucjp.json') },
            encodeAdd: {'\u00a5': 0x5C, '\u203E': 0x7E},
        },
    
        // TODO: KDDI extension to Shift_JIS
        // TODO: IBM CCSID 942 = CP932, but F0-F9 custom chars and other char changes.
        // TODO: IBM CCSID 943 = Shift_JIS = CP932 with original Shift_JIS lower 128 chars.
    
        // == Chinese/GBK ==========================================================
        // http://en.wikipedia.org/wiki/GBK
    
        // Oldest GB2312 (1981, ~7600 chars) is a subset of CP936
        'gb2312': 'cp936',
        'gb231280': 'cp936',
        'gb23121980': 'cp936',
        'csgb2312': 'cp936',
        'csiso58gb231280': 'cp936',
        'euccn': 'cp936',
        'isoir58': 'gbk',
    
        // Microsoft's CP936 is a subset and approximation of GBK.
        // TODO: Euro = 0x80 in cp936, but not in GBK (where it's valid but undefined)
        'windows936': 'cp936',
        '936': 'cp936',
        'cp936': {
            type: '_dbcs',
            table: function() { return require('./tables/cp936.json') },
        },
    
        // GBK (~22000 chars) is an extension of CP936 that added user-mapped chars and some other.
        'gbk': {
            type: '_dbcs',
            table: function() { return require('./tables/cp936.json').concat(require('./tables/gbk-added.json')) },
        },
        'xgbk': 'gbk',
    
        // GB18030 is an algorithmic extension of GBK.
        'gb18030': {
            type: '_dbcs',
            table: function() { return require('./tables/cp936.json').concat(require('./tables/gbk-added.json')) },
            gb18030: function() { return require('./tables/gb18030-ranges.json') },
        },
    
        'chinese': 'gb18030',
    
        // TODO: Support GB18030 (~27000 chars + whole unicode mapping, cp54936)
        // http://icu-project.org/docs/papers/gb18030.html
        // http://source.icu-project.org/repos/icu/data/trunk/charset/data/xml/gb-18030-2000.xml
        // http://www.khngai.com/chinese/charmap/tblgbk.php?page=0
    
        // == Korean ===============================================================
        // EUC-KR, KS_C_5601 and KS X 1001 are exactly the same.
        'windows949': 'cp949',
        '949': 'cp949',
        'cp949': {
            type: '_dbcs',
            table: function() { return require('./tables/cp949.json') },
        },
    
        'cseuckr': 'cp949',
        'csksc56011987': 'cp949',
        'euckr': 'cp949',
        'isoir149': 'cp949',
        'korean': 'cp949',
        'ksc56011987': 'cp949',
        'ksc56011989': 'cp949',
        'ksc5601': 'cp949',
    
    
        // == Big5/Taiwan/Hong Kong ================================================
        // There are lots of tables for Big5 and cp950. Please see the following links for history:
        // http://moztw.org/docs/big5/  http://www.haible.de/bruno/charsets/conversion-tables/Big5.html
        // Variations, in roughly number of defined chars:
        //  * Windows CP 950: Microsoft variant of Big5. Canonical: http://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP950.TXT
        //  * Windows CP 951: Microsoft variant of Big5-HKSCS-2001. Seems to be never public. http://me.abelcheung.org/articles/research/what-is-cp951/
        //  * Big5-2003 (Taiwan standard) almost superset of cp950.
        //  * Unicode-at-on (UAO) / Mozilla 1.8. Falling out of use on the Web. Not supported by other browsers.
        //  * Big5-HKSCS (-2001, -2004, -2008). Hong Kong standard. 
        //    many unicode code points moved from PUA to Supplementary plane (U+2XXXX) over the years.
        //    Plus, it has 4 combining sequences.
        //    Seems that Mozilla refused to support it for 10 yrs. https://bugzilla.mozilla.org/show_bug.cgi?id=162431 https://bugzilla.mozilla.org/show_bug.cgi?id=310299
        //    because big5-hkscs is the only encoding to include astral characters in non-algorithmic way.
        //    Implementations are not consistent within browsers; sometimes labeled as just big5.
        //    MS Internet Explorer switches from big5 to big5-hkscs when a patch applied.
        //    Great discussion & recap of what's going on https://bugzilla.mozilla.org/show_bug.cgi?id=912470#c31
        //    In the encoder, it might make sense to support encoding old PUA mappings to Big5 bytes seq-s.
        //    Official spec: http://www.ogcio.gov.hk/en/business/tech_promotion/ccli/terms/doc/2003cmp_2008.txt
        //                   http://www.ogcio.gov.hk/tc/business/tech_promotion/ccli/terms/doc/hkscs-2008-big5-iso.txt
        // 
        // Current understanding of how to deal with Big5(-HKSCS) is in the Encoding Standard, http://encoding.spec.whatwg.org/#big5-encoder
        // Unicode mapping (http://www.unicode.org/Public/MAPPINGS/OBSOLETE/EASTASIA/OTHER/BIG5.TXT) is said to be wrong.
    
        'windows950': 'cp950',
        '950': 'cp950',
        'cp950': {
            type: '_dbcs',
            table: function() { return require('./tables/cp950.json') },
        },
    
        // Big5 has many variations and is an extension of cp950. We use Encoding Standard's as a consensus.
        'big5': 'big5hkscs',
        'big5hkscs': {
            type: '_dbcs',
            table: function() { return require('./tables/cp950.json').concat(require('./tables/big5-added.json')) },
            encodeSkipVals: [0xa2cc],
        },
    
        'cnbig5': 'big5hkscs',
        'csbig5': 'big5hkscs',
        'xxbig5': 'big5hkscs',
    
    };
    
  provide("iconv-lite/encodings/dbcs-data", module.exports);
}(global));

// pakmanager:iconv-lite/lib/bom-handling
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict"
    
    var BOMChar = '\uFEFF';
    
    exports.PrependBOM = PrependBOMWrapper
    function PrependBOMWrapper(encoder, options) {
        this.encoder = encoder;
        this.addBOM = true;
    }
    
    PrependBOMWrapper.prototype.write = function(str) {
        if (this.addBOM) {
            str = BOMChar + str;
            this.addBOM = false;
        }
    
        return this.encoder.write(str);
    }
    
    PrependBOMWrapper.prototype.end = function() {
        return this.encoder.end();
    }
    
    
    //------------------------------------------------------------------------------
    
    exports.StripBOM = StripBOMWrapper;
    function StripBOMWrapper(decoder, options) {
        this.decoder = decoder;
        this.pass = false;
        this.options = options || {};
    }
    
    StripBOMWrapper.prototype.write = function(buf) {
        var res = this.decoder.write(buf);
        if (this.pass || !res)
            return res;
    
        if (res[0] === BOMChar) {
            res = res.slice(1);
            if (typeof this.options.stripBOM === 'function')
                this.options.stripBOM();
        }
    
        this.pass = true;
        return res;
    }
    
    StripBOMWrapper.prototype.end = function() {
        return this.decoder.end();
    }
    
    
  provide("iconv-lite/lib/bom-handling", module.exports);
}(global));

// pakmanager:iconv-lite/encodings
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict"
    
    // Update this array if you add/rename/remove files in this directory.
    // We support Browserify by skipping automatic module discovery and requiring modules directly.
    var modules = [
         require('iconv-lite/encodings/internal'),
         require('iconv-lite/encodings/utf16'),
         require('iconv-lite/encodings/utf7'),
         require('iconv-lite/encodings/sbcs-codec'),
         require('iconv-lite/encodings/sbcs-data'),
         require('iconv-lite/encodings/sbcs-data-generated'),
         require('iconv-lite/encodings/dbcs-codec'),
         require('iconv-lite/encodings/dbcs-data'),
    ];
    
    // Put all encoding/alias/codec definitions to single object and export it. 
    for (var i = 0; i < modules.length; i++) {
        var module = modules[i];
        for (var enc in module)
            if (Object.prototype.hasOwnProperty.call(module, enc))
                exports[enc] = module[enc];
    }
    
  provide("iconv-lite/encodings", module.exports);
}(global));

// pakmanager:iconv-lite/lib/streams
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict"
    
    var Transform = require("stream").Transform;
    
    
    // == Exports ==================================================================
    module.exports = function(iconv) {
        
        // Additional Public API.
        iconv.encodeStream = function encodeStream(encoding, options) {
            return new IconvLiteEncoderStream(iconv.getEncoder(encoding, options), options);
        }
    
        iconv.decodeStream = function decodeStream(encoding, options) {
            return new IconvLiteDecoderStream(iconv.getDecoder(encoding, options), options);
        }
    
        iconv.supportsStreams = true;
    
    
        // Not published yet.
        iconv.IconvLiteEncoderStream = IconvLiteEncoderStream;
        iconv.IconvLiteDecoderStream = IconvLiteDecoderStream;
        iconv._collect = IconvLiteDecoderStream.prototype.collect;
    };
    
    
    // == Encoder stream =======================================================
    function IconvLiteEncoderStream(conv, options) {
        this.conv = conv;
        options = options || {};
        options.decodeStrings = false; // We accept only strings, so we don't need to decode them.
        Transform.call(this, options);
    }
    
    IconvLiteEncoderStream.prototype = Object.create(Transform.prototype, {
        constructor: { value: IconvLiteEncoderStream }
    });
    
    IconvLiteEncoderStream.prototype._transform = function(chunk, encoding, done) {
        if (typeof chunk != 'string')
            return done(new Error("Iconv encoding stream needs strings as its input."));
        try {
            var res = this.conv.write(chunk);
            if (res && res.length) this.push(res);
            done();
        }
        catch (e) {
            done(e);
        }
    }
    
    IconvLiteEncoderStream.prototype._flush = function(done) {
        try {
            var res = this.conv.end();
            if (res && res.length) this.push(res);
            done();
        }
        catch (e) {
            done(e);
        }
    }
    
    IconvLiteEncoderStream.prototype.collect = function(cb) {
        var chunks = [];
        this.on('error', cb);
        this.on('data', function(chunk) { chunks.push(chunk); });
        this.on('end', function() {
            cb(null, Buffer.concat(chunks));
        });
        return this;
    }
    
    
    // == Decoder stream =======================================================
    function IconvLiteDecoderStream(conv, options) {
        this.conv = conv;
        options = options || {};
        options.encoding = this.encoding = 'utf8'; // We output strings.
        Transform.call(this, options);
    }
    
    IconvLiteDecoderStream.prototype = Object.create(Transform.prototype, {
        constructor: { value: IconvLiteDecoderStream }
    });
    
    IconvLiteDecoderStream.prototype._transform = function(chunk, encoding, done) {
        if (!Buffer.isBuffer(chunk))
            return done(new Error("Iconv decoding stream needs buffers as its input."));
        try {
            var res = this.conv.write(chunk);
            if (res && res.length) this.push(res, this.encoding);
            done();
        }
        catch (e) {
            done(e);
        }
    }
    
    IconvLiteDecoderStream.prototype._flush = function(done) {
        try {
            var res = this.conv.end();
            if (res && res.length) this.push(res, this.encoding);                
            done();
        }
        catch (e) {
            done(e);
        }
    }
    
    IconvLiteDecoderStream.prototype.collect = function(cb) {
        var res = '';
        this.on('error', cb);
        this.on('data', function(chunk) { res += chunk; });
        this.on('end', function() {
            cb(null, res);
        });
        return this;
    }
    
    
  provide("iconv-lite/lib/streams", module.exports);
}(global));

// pakmanager:iconv-lite/lib/extend-node
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict"
    
    // == Extend Node primitives to use iconv-lite =================================
    
    module.exports = function (iconv) {
        var original = undefined; // Place to keep original methods.
    
        // Node authors rewrote Buffer internals to make it compatible with
        // Uint8Array and we cannot patch key functions since then.
        iconv.supportsNodeEncodingsExtension = !(new Buffer(0) instanceof Uint8Array);
    
        iconv.extendNodeEncodings = function extendNodeEncodings() {
            if (original) return;
            original = {};
    
            if (!iconv.supportsNodeEncodingsExtension) {
                console.error("ACTION NEEDED:  require('iconv-lite').extendNodeEncodings() is not supported in your version of Node");
                console.error("See more info at https://github.com/ashtuchkin/iconv-lite/wiki/Node-v4-compatibility");
                return;
            }
    
            var nodeNativeEncodings = {
                'hex': true, 'utf8': true, 'utf-8': true, 'ascii': true, 'binary': true, 
                'base64': true, 'ucs2': true, 'ucs-2': true, 'utf16le': true, 'utf-16le': true,
            };
    
            Buffer.isNativeEncoding = function(enc) {
                return enc && nodeNativeEncodings[enc.toLowerCase()];
            }
    
            // -- SlowBuffer -----------------------------------------------------------
            var SlowBuffer = require('buffer').SlowBuffer;
    
            original.SlowBufferToString = SlowBuffer.prototype.toString;
            SlowBuffer.prototype.toString = function(encoding, start, end) {
                encoding = String(encoding || 'utf8').toLowerCase();
    
                // Use native conversion when possible
                if (Buffer.isNativeEncoding(encoding))
                    return original.SlowBufferToString.call(this, encoding, start, end);
    
                // Otherwise, use our decoding method.
                if (typeof start == 'undefined') start = 0;
                if (typeof end == 'undefined') end = this.length;
                return iconv.decode(this.slice(start, end), encoding);
            }
    
            original.SlowBufferWrite = SlowBuffer.prototype.write;
            SlowBuffer.prototype.write = function(string, offset, length, encoding) {
                // Support both (string, offset, length, encoding)
                // and the legacy (string, encoding, offset, length)
                if (isFinite(offset)) {
                    if (!isFinite(length)) {
                        encoding = length;
                        length = undefined;
                    }
                } else {  // legacy
                    var swap = encoding;
                    encoding = offset;
                    offset = length;
                    length = swap;
                }
    
                offset = +offset || 0;
                var remaining = this.length - offset;
                if (!length) {
                    length = remaining;
                } else {
                    length = +length;
                    if (length > remaining) {
                        length = remaining;
                    }
                }
                encoding = String(encoding || 'utf8').toLowerCase();
    
                // Use native conversion when possible
                if (Buffer.isNativeEncoding(encoding))
                    return original.SlowBufferWrite.call(this, string, offset, length, encoding);
    
                if (string.length > 0 && (length < 0 || offset < 0))
                    throw new RangeError('attempt to write beyond buffer bounds');
    
                // Otherwise, use our encoding method.
                var buf = iconv.encode(string, encoding);
                if (buf.length < length) length = buf.length;
                buf.copy(this, offset, 0, length);
                return length;
            }
    
            // -- Buffer ---------------------------------------------------------------
    
            original.BufferIsEncoding = Buffer.isEncoding;
            Buffer.isEncoding = function(encoding) {
                return Buffer.isNativeEncoding(encoding) || iconv.encodingExists(encoding);
            }
    
            original.BufferByteLength = Buffer.byteLength;
            Buffer.byteLength = SlowBuffer.byteLength = function(str, encoding) {
                encoding = String(encoding || 'utf8').toLowerCase();
    
                // Use native conversion when possible
                if (Buffer.isNativeEncoding(encoding))
                    return original.BufferByteLength.call(this, str, encoding);
    
                // Slow, I know, but we don't have a better way yet.
                return iconv.encode(str, encoding).length;
            }
    
            original.BufferToString = Buffer.prototype.toString;
            Buffer.prototype.toString = function(encoding, start, end) {
                encoding = String(encoding || 'utf8').toLowerCase();
    
                // Use native conversion when possible
                if (Buffer.isNativeEncoding(encoding))
                    return original.BufferToString.call(this, encoding, start, end);
    
                // Otherwise, use our decoding method.
                if (typeof start == 'undefined') start = 0;
                if (typeof end == 'undefined') end = this.length;
                return iconv.decode(this.slice(start, end), encoding);
            }
    
            original.BufferWrite = Buffer.prototype.write;
            Buffer.prototype.write = function(string, offset, length, encoding) {
                var _offset = offset, _length = length, _encoding = encoding;
                // Support both (string, offset, length, encoding)
                // and the legacy (string, encoding, offset, length)
                if (isFinite(offset)) {
                    if (!isFinite(length)) {
                        encoding = length;
                        length = undefined;
                    }
                } else {  // legacy
                    var swap = encoding;
                    encoding = offset;
                    offset = length;
                    length = swap;
                }
    
                encoding = String(encoding || 'utf8').toLowerCase();
    
                // Use native conversion when possible
                if (Buffer.isNativeEncoding(encoding))
                    return original.BufferWrite.call(this, string, _offset, _length, _encoding);
    
                offset = +offset || 0;
                var remaining = this.length - offset;
                if (!length) {
                    length = remaining;
                } else {
                    length = +length;
                    if (length > remaining) {
                        length = remaining;
                    }
                }
    
                if (string.length > 0 && (length < 0 || offset < 0))
                    throw new RangeError('attempt to write beyond buffer bounds');
    
                // Otherwise, use our encoding method.
                var buf = iconv.encode(string, encoding);
                if (buf.length < length) length = buf.length;
                buf.copy(this, offset, 0, length);
                return length;
    
                // TODO: Set _charsWritten.
            }
    
    
            // -- Readable -------------------------------------------------------------
            if (iconv.supportsStreams) {
                var Readable = require('stream').Readable;
    
                original.ReadableSetEncoding = Readable.prototype.setEncoding;
                Readable.prototype.setEncoding = function setEncoding(enc, options) {
                    // Use our own decoder, it has the same interface.
                    // We cannot use original function as it doesn't handle BOM-s.
                    this._readableState.decoder = iconv.getDecoder(enc, options);
                    this._readableState.encoding = enc;
                }
    
                Readable.prototype.collect = iconv._collect;
            }
        }
    
        // Remove iconv-lite Node primitive extensions.
        iconv.undoExtendNodeEncodings = function undoExtendNodeEncodings() {
            if (!iconv.supportsNodeEncodingsExtension)
                return;
            if (!original)
                throw new Error(" require('iconv-lite').undoExtendNodeEncodings(): Nothing to undo; extendNodeEncodings() is not called.")
    
            delete Buffer.isNativeEncoding;
    
            var SlowBuffer = require('buffer').SlowBuffer;
    
            SlowBuffer.prototype.toString = original.SlowBufferToString;
            SlowBuffer.prototype.write = original.SlowBufferWrite;
    
            Buffer.isEncoding = original.BufferIsEncoding;
            Buffer.byteLength = original.BufferByteLength;
            Buffer.prototype.toString = original.BufferToString;
            Buffer.prototype.write = original.BufferWrite;
    
            if (iconv.supportsStreams) {
                var Readable = require('stream').Readable;
    
                Readable.prototype.setEncoding = original.ReadableSetEncoding;
                delete Readable.prototype.collect;
            }
    
            original = undefined;
        }
    }
    
  provide("iconv-lite/lib/extend-node", module.exports);
}(global));

// pakmanager:iconv-lite
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict"
    
    var bomHandling =  require('iconv-lite/lib/bom-handling'),
        iconv = module.exports;
    
    // All codecs and aliases are kept here, keyed by encoding name/alias.
    // They are lazy loaded in `iconv.getCodec` from `encodings/index.js`.
    iconv.encodings = null;
    
    // Characters emitted in case of error.
    iconv.defaultCharUnicode = '�';
    iconv.defaultCharSingleByte = '?';
    
    // Public API.
    iconv.encode = function encode(str, encoding, options) {
        str = "" + (str || ""); // Ensure string.
    
        var encoder = iconv.getEncoder(encoding, options);
    
        var res = encoder.write(str);
        var trail = encoder.end();
        
        return (trail && trail.length > 0) ? Buffer.concat([res, trail]) : res;
    }
    
    iconv.decode = function decode(buf, encoding, options) {
        if (typeof buf === 'string') {
            if (!iconv.skipDecodeWarning) {
                console.error('Iconv-lite warning: decode()-ing strings is deprecated. Refer to https://github.com/ashtuchkin/iconv-lite/wiki/Use-Buffers-when-decoding');
                iconv.skipDecodeWarning = true;
            }
    
            buf = new Buffer("" + (buf || ""), "binary"); // Ensure buffer.
        }
    
        var decoder = iconv.getDecoder(encoding, options);
    
        var res = decoder.write(buf);
        var trail = decoder.end();
    
        return trail ? (res + trail) : res;
    }
    
    iconv.encodingExists = function encodingExists(enc) {
        try {
            iconv.getCodec(enc);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    // Legacy aliases to convert functions
    iconv.toEncoding = iconv.encode;
    iconv.fromEncoding = iconv.decode;
    
    // Search for a codec in iconv.encodings. Cache codec data in iconv._codecDataCache.
    iconv._codecDataCache = {};
    iconv.getCodec = function getCodec(encoding) {
        if (!iconv.encodings)
            iconv.encodings =  require('iconv-lite/encodings'); // Lazy load all encoding definitions.
        
        // Canonicalize encoding name: strip all non-alphanumeric chars and appended year.
        var enc = (''+encoding).toLowerCase().replace(/[^0-9a-z]|:\d{4}$/g, "");
    
        // Traverse iconv.encodings to find actual codec.
        var codecOptions = {};
        while (true) {
            var codec = iconv._codecDataCache[enc];
            if (codec)
                return codec;
    
            var codecDef = iconv.encodings[enc];
    
            switch (typeof codecDef) {
                case "string": // Direct alias to other encoding.
                    enc = codecDef;
                    break;
    
                case "object": // Alias with options. Can be layered.
                    for (var key in codecDef)
                        codecOptions[key] = codecDef[key];
    
                    if (!codecOptions.encodingName)
                        codecOptions.encodingName = enc;
                    
                    enc = codecDef.type;
                    break;
    
                case "function": // Codec itself.
                    if (!codecOptions.encodingName)
                        codecOptions.encodingName = enc;
    
                    // The codec function must load all tables and return object with .encoder and .decoder methods.
                    // It'll be called only once (for each different options object).
                    codec = new codecDef(codecOptions, iconv);
    
                    iconv._codecDataCache[codecOptions.encodingName] = codec; // Save it to be reused later.
                    return codec;
    
                default:
                    throw new Error("Encoding not recognized: '" + encoding + "' (searched as: '"+enc+"')");
            }
        }
    }
    
    iconv.getEncoder = function getEncoder(encoding, options) {
        var codec = iconv.getCodec(encoding),
            encoder = new codec.encoder(options, codec);
    
        if (codec.bomAware && options && options.addBOM)
            encoder = new bomHandling.PrependBOM(encoder, options);
    
        return encoder;
    }
    
    iconv.getDecoder = function getDecoder(encoding, options) {
        var codec = iconv.getCodec(encoding),
            decoder = new codec.decoder(options, codec);
    
        if (codec.bomAware && !(options && options.stripBOM === false))
            decoder = new bomHandling.StripBOM(decoder, options);
    
        return decoder;
    }
    
    
    // Load extensions in Node. All of them are omitted in Browserify build via 'browser' field in package.json.
    var nodeVer = typeof process !== 'undefined' && process.versions && process.versions.node;
    if (nodeVer) {
    
        // Load streaming support in Node v0.10+
        var nodeVerArr = nodeVer.split(".").map(Number);
        if (nodeVerArr[0] > 0 || nodeVerArr[1] >= 10) {
             require('iconv-lite/lib/streams')(iconv);
        }
    
        // Load Node primitive extensions.
         require('iconv-lite/lib/extend-node')(iconv);
    }
    
    
  provide("iconv-lite", module.exports);
}(global));

// pakmanager:encoding/lib/iconv-loader
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    var iconv_package;
    var Iconv;
    
    try {
        // this is to fool browserify so it doesn't try (in vain) to install iconv.
        iconv_package = 'iconv';
        Iconv = require(iconv_package).Iconv;
    } catch (E) {
        // node-iconv not present
    }
    
    module.exports = Iconv;
    
  provide("encoding/lib/iconv-loader", module.exports);
}(global));

// pakmanager:encoding
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    var iconvLite = require('iconv-lite');
    // Load Iconv from an external file to be able to disable Iconv for webpack
    // Add /\/iconv-loader$/ to webpack.IgnorePlugin to ignore it
    var Iconv =  require('encoding/lib/iconv-loader');
    
    // Expose to the world
    module.exports.convert = convert;
    
    /**
     * Convert encoding of an UTF-8 string or a buffer
     *
     * @param {String|Buffer} str String to be converted
     * @param {String} to Encoding to be converted to
     * @param {String} [from='UTF-8'] Encoding to be converted from
     * @param {Boolean} useLite If set to ture, force to use iconvLite
     * @return {Buffer} Encoded string
     */
    function convert(str, to, from, useLite) {
        from = checkEncoding(from || 'UTF-8');
        to = checkEncoding(to || 'UTF-8');
        str = str || '';
    
        var result;
    
        if (from !== 'UTF-8' && typeof str === 'string') {
            str = new Buffer(str, 'binary');
        }
    
        if (from === to) {
            if (typeof str === 'string') {
                result = new Buffer(str);
            } else {
                result = str;
            }
        } else if (Iconv && !useLite) {
            try {
                result = convertIconv(str, to, from);
            } catch (E) {
                console.error(E);
                try {
                    result = convertIconvLite(str, to, from);
                } catch (E) {
                    console.error(E);
                    result = str;
                }
            }
        } else {
            try {
                result = convertIconvLite(str, to, from);
            } catch (E) {
                console.error(E);
                result = str;
            }
        }
    
    
        if (typeof result === 'string') {
            result = new Buffer(result, 'utf-8');
        }
    
        return result;
    }
    
    /**
     * Convert encoding of a string with node-iconv (if available)
     *
     * @param {String|Buffer} str String to be converted
     * @param {String} to Encoding to be converted to
     * @param {String} [from='UTF-8'] Encoding to be converted from
     * @return {Buffer} Encoded string
     */
    function convertIconv(str, to, from) {
        var response, iconv;
        iconv = new Iconv(from, to + '//TRANSLIT//IGNORE');
        response = iconv.convert(str);
        return response.slice(0, response.length);
    }
    
    /**
     * Convert encoding of astring with iconv-lite
     *
     * @param {String|Buffer} str String to be converted
     * @param {String} to Encoding to be converted to
     * @param {String} [from='UTF-8'] Encoding to be converted from
     * @return {Buffer} Encoded string
     */
    function convertIconvLite(str, to, from) {
        if (to === 'UTF-8') {
            return iconvLite.decode(str, from);
        } else if (from === 'UTF-8') {
            return iconvLite.encode(str, to);
        } else {
            return iconvLite.encode(iconvLite.decode(str, from), to);
        }
    }
    
    /**
     * Converts charset name if needed
     *
     * @param {String} name Character set
     * @return {String} Character set name
     */
    function checkEncoding(name) {
        return (name || '').toString().trim().
        replace(/^latin[\-_]?(\d+)$/i, 'ISO-8859-$1').
        replace(/^win(?:dows)?[\-_]?(\d+)$/i, 'WINDOWS-$1').
        replace(/^utf[\-_]?(\d+)$/i, 'UTF-$1').
        replace(/^ks_c_5601\-1987$/i, 'CP949').
        replace(/^us[\-_]?ascii$/i, 'ASCII').
        toUpperCase();
    }
    
  provide("encoding", module.exports);
}(global));

// pakmanager:is-stream
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    var isStream = module.exports = function (stream) {
    	return stream !== null && typeof stream === 'object' && typeof stream.pipe === 'function';
    };
    
    isStream.writable = function (stream) {
    	return isStream(stream) && stream.writable !== false && typeof stream._write === 'function' && typeof stream._writableState === 'object';
    };
    
    isStream.readable = function (stream) {
    	return isStream(stream) && stream.readable !== false && typeof stream._read === 'function' && typeof stream._readableState === 'object';
    };
    
    isStream.duplex = function (stream) {
    	return isStream.writable(stream) && isStream.readable(stream);
    };
    
    isStream.transform = function (stream) {
    	return isStream.duplex(stream) && typeof stream._transform === 'function' && typeof stream._transformState === 'object';
    };
    
  provide("is-stream", module.exports);
}(global));

// pakmanager:node-fetch/lib/fetch-error
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  
    /**
     * fetch-error.js
     *
     * FetchError interface for operational errors
     */
    
    module.exports = FetchError;
    
    /**
     * Create FetchError instance
     *
     * @param   String      message      Error message for human
     * @param   String      type         Error type for machine
     * @param   String      systemError  For Node.js system error
     * @return  FetchError
     */
    function FetchError(message, type, systemError) {
    
    	// hide custom error implementation details from end-users
    	Error.captureStackTrace(this, this.constructor);
    
    	this.name = this.constructor.name;
    	this.message = message;
    	this.type = type;
    
    	// when err.type is `system`, err.code contains system error code
    	if (systemError) {
    		this.code = this.errno = systemError.code;
    	}
    
    }
    
    require('util').inherits(FetchError, Error);
    
  provide("node-fetch/lib/fetch-error", module.exports);
}(global));

// pakmanager:node-fetch/lib/headers
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  
    /**
     * headers.js
     *
     * Headers class offers convenient helpers
     */
    
    module.exports = Headers;
    
    /**
     * Headers class
     *
     * @param   Object  headers  Response headers
     * @return  Void
     */
    function Headers(headers) {
    
    	var self = this;
    	this._headers = {};
    
    	// Headers
    	if (headers instanceof Headers) {
    		headers = headers.raw();
    	}
    
    	// plain object
    	for (var prop in headers) {
    		if (!headers.hasOwnProperty(prop)) {
    			continue;
    		}
    
    		if (typeof headers[prop] === 'string') {
    			this.set(prop, headers[prop]);
    
    		} else if (typeof headers[prop] === 'number' && !isNaN(headers[prop])) {
    			this.set(prop, headers[prop].toString());
    
    		} else if (headers[prop] instanceof Array) {
    			headers[prop].forEach(function(item) {
    				self.append(prop, item.toString());
    			});
    		}
    	}
    
    }
    
    /**
     * Return first header value given name
     *
     * @param   String  name  Header name
     * @return  Mixed
     */
    Headers.prototype.get = function(name) {
    	var list = this._headers[name.toLowerCase()];
    	return list ? list[0] : null;
    };
    
    /**
     * Return all header values given name
     *
     * @param   String  name  Header name
     * @return  Array
     */
    Headers.prototype.getAll = function(name) {
    	if (!this.has(name)) {
    		return [];
    	}
    
    	return this._headers[name.toLowerCase()];
    };
    
    /**
     * Iterate over all headers
     *
     * @param   Function  callback  Executed for each item with parameters (value, name, thisArg)
     * @param   Boolean   thisArg   `this` context for callback function
     * @return  Void
     */
    Headers.prototype.forEach = function(callback, thisArg) {
    	Object.getOwnPropertyNames(this._headers).forEach(function(name) {
    		this._headers[name].forEach(function(value) {
    			callback.call(thisArg, value, name, this)
    		}, this)
    	}, this)
    }
    
    /**
     * Overwrite header values given name
     *
     * @param   String  name   Header name
     * @param   String  value  Header value
     * @return  Void
     */
    Headers.prototype.set = function(name, value) {
    	this._headers[name.toLowerCase()] = [value];
    };
    
    /**
     * Append a value onto existing header
     *
     * @param   String  name   Header name
     * @param   String  value  Header value
     * @return  Void
     */
    Headers.prototype.append = function(name, value) {
    	if (!this.has(name)) {
    		this.set(name, value);
    		return;
    	}
    
    	this._headers[name.toLowerCase()].push(value);
    };
    
    /**
     * Check for header name existence
     *
     * @param   String   name  Header name
     * @return  Boolean
     */
    Headers.prototype.has = function(name) {
    	return this._headers.hasOwnProperty(name.toLowerCase());
    };
    
    /**
     * Delete all header values given name
     *
     * @param   String  name  Header name
     * @return  Void
     */
    Headers.prototype['delete'] = function(name) {
    	delete this._headers[name.toLowerCase()];
    };
    
    /**
     * Return raw headers (non-spec api)
     *
     * @return  Object
     */
    Headers.prototype.raw = function() {
    	return this._headers;
    };
    
  provide("node-fetch/lib/headers", module.exports);
}(global));

// pakmanager:node-fetch/lib/body
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  
    /**
     * body.js
     *
     * Body interface provides common methods for Request and Response
     */
    
    var convert = require('encoding').convert;
    var bodyStream = require('is-stream');
    var PassThrough = require('stream').PassThrough;
    var FetchError =  require('node-fetch/lib/fetch-error');
    
    module.exports = Body;
    
    /**
     * Body class
     *
     * @param   Stream  body  Readable stream
     * @param   Object  opts  Response options
     * @return  Void
     */
    function Body(body, opts) {
    
    	opts = opts || {};
    
    	this.body = body;
    	this.bodyUsed = false;
    	this.size = opts.size || 0;
    	this.timeout = opts.timeout || 0;
    	this._raw = [];
    	this._abort = false;
    
    }
    
    /**
     * Decode response as json
     *
     * @return  Promise
     */
    Body.prototype.json = function() {
    
    	return this._decode().then(function(buffer) {
    		return JSON.parse(buffer.toString());
    	});
    
    };
    
    /**
     * Decode response as text
     *
     * @return  Promise
     */
    Body.prototype.text = function() {
    
    	return this._decode().then(function(buffer) {
    		return buffer.toString();
    	});
    
    };
    
    /**
     * Decode response as buffer (non-spec api)
     *
     * @return  Promise
     */
    Body.prototype.buffer = function() {
    
    	return this._decode();
    
    };
    
    /**
     * Decode buffers into utf-8 string
     *
     * @return  Promise
     */
    Body.prototype._decode = function() {
    
    	var self = this;
    
    	if (this.bodyUsed) {
    		return Body.Promise.reject(new Error('body used already for: ' + this.url));
    	}
    
    	this.bodyUsed = true;
    	this._bytes = 0;
    	this._abort = false;
    	this._raw = [];
    
    	return new Body.Promise(function(resolve, reject) {
    		var resTimeout;
    
    		// body is string
    		if (typeof self.body === 'string') {
    			self._bytes = self.body.length;
    			self._raw = [new Buffer(self.body)];
    			return resolve(self._convert());
    		}
    
    		// body is buffer
    		if (self.body instanceof Buffer) {
    			self._bytes = self.body.length;
    			self._raw = [self.body];
    			return resolve(self._convert());
    		}
    
    		// allow timeout on slow response body
    		if (self.timeout) {
    			resTimeout = setTimeout(function() {
    				self._abort = true;
    				reject(new FetchError('response timeout at ' + self.url + ' over limit: ' + self.timeout, 'body-timeout'));
    			}, self.timeout);
    		}
    
    		// handle stream error, such as incorrect content-encoding
    		self.body.on('error', function(err) {
    			reject(new FetchError('invalid response body at: ' + self.url + ' reason: ' + err.message, 'system', err));
    		});
    
    		// body is stream
    		self.body.on('data', function(chunk) {
    			if (self._abort || chunk === null) {
    				return;
    			}
    
    			if (self.size && self._bytes + chunk.length > self.size) {
    				self._abort = true;
    				reject(new FetchError('content size at ' + self.url + ' over limit: ' + self.size, 'max-size'));
    				return;
    			}
    
    			self._bytes += chunk.length;
    			self._raw.push(chunk);
    		});
    
    		self.body.on('end', function() {
    			if (self._abort) {
    				return;
    			}
    
    			clearTimeout(resTimeout);
    			resolve(self._convert());
    		});
    	});
    
    };
    
    /**
     * Detect buffer encoding and convert to target encoding
     * ref: http://www.w3.org/TR/2011/WD-html5-20110113/parsing.html#determining-the-character-encoding
     *
     * @param   String  encoding  Target encoding
     * @return  String
     */
    Body.prototype._convert = function(encoding) {
    
    	encoding = encoding || 'utf-8';
    
    	var ct = this.headers.get('content-type');
    	var charset = 'utf-8';
    	var res, str;
    
    	// header
    	if (ct) {
    		// skip encoding detection altogether if not html/xml/plain text
    		if (!/text\/html|text\/plain|\+xml|\/xml/i.test(ct)) {
    			return Buffer.concat(this._raw);
    		}
    
    		res = /charset=([^;]*)/i.exec(ct);
    	}
    
    	// no charset in content type, peek at response body for at most 1024 bytes
    	if (!res && this._raw.length > 0) {
    		for (var i = 0; i < this._raw.length; i++) {
    			str += this._raw[i].toString()
    			if (str.length > 1024) {
    				break;
    			}
    		}
    		str = str.substr(0, 1024);
    	}
    
    	// html5
    	if (!res && str) {
    		res = /<meta.+?charset=(['"])(.+?)\1/i.exec(str);
    	}
    
    	// html4
    	if (!res && str) {
    		res = /<meta[\s]+?http-equiv=(['"])content-type\1[\s]+?content=(['"])(.+?)\2/i.exec(str);
    
    		if (res) {
    			res = /charset=(.*)/i.exec(res.pop());
    		}
    	}
    
    	// xml
    	if (!res && str) {
    		res = /<\?xml.+?encoding=(['"])(.+?)\1/i.exec(str);
    	}
    
    	// found charset
    	if (res) {
    		charset = res.pop();
    
    		// prevent decode issues when sites use incorrect encoding
    		// ref: https://hsivonen.fi/encoding-menu/
    		if (charset === 'gb2312' || charset === 'gbk') {
    			charset = 'gb18030';
    		}
    	}
    
    	// turn raw buffers into a single utf-8 buffer
    	return convert(
    		Buffer.concat(this._raw)
    		, encoding
    		, charset
    	);
    
    };
    
    /**
     * Clone body given Res/Req instance
     *
     * @param   Mixed  instance  Response or Request instance
     * @return  Mixed
     */
    Body.prototype._clone = function(instance) {
    	var p1, p2;
    	var body = instance.body;
    
    	// don't allow cloning a used body
    	if (instance.bodyUsed) {
    		throw new Error('cannot clone body after it is used');
    	}
    
    	// check that body is a stream and not form-data object
    	// note: we can't clone the form-data object without having it as a dependency
    	if (bodyStream(body) && typeof body.getBoundary !== 'function') {
    		// tee instance body
    		p1 = new PassThrough();
    		p2 = new PassThrough();
    		body.pipe(p1);
    		body.pipe(p2);
    		// set instance body to teed body and return the other teed body
    		instance.body = p1;
    		body = p2;
    	}
    
    	return body;
    }
    
    // expose Promise
    Body.Promise = global.Promise;
    
  provide("node-fetch/lib/body", module.exports);
}(global));

// pakmanager:node-fetch/lib/response
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  
    /**
     * response.js
     *
     * Response class provides content decoding
     */
    
    var http = require('http');
    var Headers =  require('node-fetch/lib/headers');
    var Body =  require('node-fetch/lib/body');
    
    module.exports = Response;
    
    /**
     * Response class
     *
     * @param   Stream  body  Readable stream
     * @param   Object  opts  Response options
     * @return  Void
     */
    function Response(body, opts) {
    
    	opts = opts || {};
    
    	this.url = opts.url;
    	this.status = opts.status || 200;
    	this.statusText = opts.statusText || http.STATUS_CODES[this.status];
    	this.headers = new Headers(opts.headers);
    	this.ok = this.status >= 200 && this.status < 300;
    
    	Body.call(this, body, opts);
    
    }
    
    Response.prototype = Object.create(Body.prototype);
    
    /**
     * Clone this response
     *
     * @return  Response
     */
    Response.prototype.clone = function() {
    	return new Response(this._clone(this), {
    		url: this.url
    		, status: this.status
    		, statusText: this.statusText
    		, headers: this.headers
    		, ok: this.ok
    	});
    };
    
  provide("node-fetch/lib/response", module.exports);
}(global));

// pakmanager:node-fetch/lib/request
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  
    /**
     * request.js
     *
     * Request class contains server only options
     */
    
    var parse_url = require('url').parse;
    var Headers =  require('node-fetch/lib/headers');
    var Body =  require('node-fetch/lib/body');
    
    module.exports = Request;
    
    /**
     * Request class
     *
     * @param   Mixed   input  Url or Request instance
     * @param   Object  init   Custom options
     * @return  Void
     */
    function Request(input, init) {
    	var url, url_parsed;
    
    	// normalize input
    	if (!(input instanceof Request)) {
    		url = input;
    		url_parsed = parse_url(url);
    		input = {};
    	} else {
    		url = input.url;
    		url_parsed = parse_url(url);
    	}
    
    	// normalize init
    	init = init || {};
    
    	// fetch spec options
    	this.method = init.method || input.method || 'GET';
    	this.redirect = init.redirect || input.redirect || 'follow';
    	this.headers = new Headers(init.headers || input.headers || {});
    	this.url = url;
    
    	// server only options
    	this.follow = init.follow !== undefined ?
    		init.follow : input.follow !== undefined ?
    		input.follow : 20;
    	this.compress = init.compress !== undefined ?
    		init.compress : input.compress !== undefined ?
    		input.compress : true;
    	this.counter = init.counter || input.counter || 0;
    	this.agent = init.agent || input.agent;
    
    	Body.call(this, init.body || this._clone(input), {
    		timeout: init.timeout || input.timeout || 0,
    		size: init.size || input.size || 0
    	});
    
    	// server request options
    	this.protocol = url_parsed.protocol;
    	this.hostname = url_parsed.hostname;
    	this.port = url_parsed.port;
    	this.path = url_parsed.path;
    	this.auth = url_parsed.auth;
    }
    
    Request.prototype = Object.create(Body.prototype);
    
    /**
     * Clone this request
     *
     * @return  Request
     */
    Request.prototype.clone = function() {
    	return new Request(this);
    };
    
  provide("node-fetch/lib/request", module.exports);
}(global));

// pakmanager:node-fetch
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  
    /**
     * index.js
     *
     * a request API compatible with window.fetch
     */
    
    var parse_url = require('url').parse;
    var resolve_url = require('url').resolve;
    var http = require('http');
    var https = require('https');
    var zlib = require('zlib');
    var stream = require('stream');
    
    var Body =  require('node-fetch/lib/body');
    var Response =  require('node-fetch/lib/response');
    var Headers =  require('node-fetch/lib/headers');
    var Request =  require('node-fetch/lib/request');
    var FetchError =  require('node-fetch/lib/fetch-error');
    
    // commonjs
    module.exports = Fetch;
    // es6 default export compatibility
    module.exports.default = module.exports;
    
    /**
     * Fetch class
     *
     * @param   Mixed    url   Absolute url or Request instance
     * @param   Object   opts  Fetch options
     * @return  Promise
     */
    function Fetch(url, opts) {
    
    	// allow call as function
    	if (!(this instanceof Fetch))
    		return new Fetch(url, opts);
    
    	// allow custom promise
    	if (!Fetch.Promise) {
    		throw new Error('native promise missing, set Fetch.Promise to your favorite alternative');
    	}
    
    	Body.Promise = Fetch.Promise;
    
    	var self = this;
    
    	// wrap http.request into fetch
    	return new Fetch.Promise(function(resolve, reject) {
    		// build request object
    		var options = new Request(url, opts);
    
    		if (!options.protocol || !options.hostname) {
    			throw new Error('only absolute urls are supported');
    		}
    
    		if (options.protocol !== 'http:' && options.protocol !== 'https:') {
    			throw new Error('only http(s) protocols are supported');
    		}
    
    		var send;
    		if (options.protocol === 'https:') {
    			send = https.request;
    		} else {
    			send = http.request;
    		}
    
    		// normalize headers
    		var headers = new Headers(options.headers);
    
    		if (options.compress) {
    			headers.set('accept-encoding', 'gzip,deflate');
    		}
    
    		if (!headers.has('user-agent')) {
    			headers.set('user-agent', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)');
    		}
    
    		if (!headers.has('connection') && !options.agent) {
    			headers.set('connection', 'close');
    		}
    
    		if (!headers.has('accept')) {
    			headers.set('accept', '*/*');
    		}
    
    		// detect form data input from form-data module, this hack avoid the need to pass multipart header manually
    		if (!headers.has('content-type') && options.body && typeof options.body.getBoundary === 'function') {
    			headers.set('content-type', 'multipart/form-data; boundary=' + options.body.getBoundary());
    		}
    
    		// bring node-fetch closer to browser behavior by setting content-length automatically
    		if (!headers.has('content-length') && /post|put|patch|delete/i.test(options.method)) {
    			if (typeof options.body === 'string') {
    				headers.set('content-length', Buffer.byteLength(options.body));
    			// detect form data input from form-data module, this hack avoid the need to add content-length header manually
    			} else if (options.body && typeof options.body.getLengthSync === 'function' && options.body._lengthRetrievers.length == 0) {
    				headers.set('content-length', options.body.getLengthSync().toString());
    			// this is only necessary for older nodejs releases (before iojs merge)
    			} else if (options.body === undefined || options.body === null) {
    				headers.set('content-length', '0');
    			}
    		}
    
    		options.headers = headers.raw();
    
    		// http.request only support string as host header, this hack make custom host header possible
    		if (options.headers.host) {
    			options.headers.host = options.headers.host[0];
    		}
    
    		// send request
    		var req = send(options);
    		var reqTimeout;
    
    		if (options.timeout) {
    			req.once('socket', function(socket) {
    				reqTimeout = setTimeout(function() {
    					req.abort();
    					reject(new FetchError('network timeout at: ' + options.url, 'request-timeout'));
    				}, options.timeout);
    			});
    		}
    
    		req.on('error', function(err) {
    			clearTimeout(reqTimeout);
    			reject(new FetchError('request to ' + options.url + ' failed, reason: ' + err.message, 'system', err));
    		});
    
    		req.on('response', function(res) {
    			clearTimeout(reqTimeout);
    
    			// handle redirect
    			if (self.isRedirect(res.statusCode) && options.redirect !== 'manual') {
    				if (options.redirect === 'error') {
    					reject(new FetchError('redirect mode is set to error: ' + options.url, 'no-redirect'));
    					return;
    				}
    
    				if (options.counter >= options.follow) {
    					reject(new FetchError('maximum redirect reached at: ' + options.url, 'max-redirect'));
    					return;
    				}
    
    				if (!res.headers.location) {
    					reject(new FetchError('redirect location header missing at: ' + options.url, 'invalid-redirect'));
    					return;
    				}
    
    				// per fetch spec, for POST request with 301/302 response, or any request with 303 response, use GET when following redirect
    				if (res.statusCode === 303
    					|| ((res.statusCode === 301 || res.statusCode === 302) && options.method === 'POST'))
    				{
    					options.method = 'GET';
    					delete options.body;
    					delete options.headers['content-length'];
    				}
    
    				options.counter++;
    
    				resolve(Fetch(resolve_url(options.url, res.headers.location), options));
    				return;
    			}
    
    			// normalize location header for manual redirect mode
    			var headers = new Headers(res.headers);
    			if (options.redirect === 'manual' && headers.has('location')) {
    				headers.set('location', resolve_url(options.url, headers.get('location')));
    			}
    
    			// prepare response
    			var body = res.pipe(new stream.PassThrough());
    			var response_options = {
    				url: options.url
    				, status: res.statusCode
    				, statusText: res.statusMessage
    				, headers: headers
    				, size: options.size
    				, timeout: options.timeout
    			};
    
    			// response object
    			var output;
    
    			// in following scenarios we ignore compression support
    			// 1. compression support is disabled
    			// 2. HEAD request
    			// 3. no content-encoding header
    			// 4. no content response (204)
    			// 5. content not modified response (304)
    			if (!options.compress || options.method === 'HEAD' || !headers.has('content-encoding') || res.statusCode === 204 || res.statusCode === 304) {
    				output = new Response(body, response_options);
    				resolve(output);
    				return;
    			}
    
    			// otherwise, check for gzip or deflate
    			var name = headers.get('content-encoding');
    
    			// for gzip
    			if (name == 'gzip' || name == 'x-gzip') {
    				body = body.pipe(zlib.createGunzip());
    				output = new Response(body, response_options);
    				resolve(output);
    				return;
    
    			// for deflate
    			} else if (name == 'deflate' || name == 'x-deflate') {
    				// handle the infamous raw deflate response from old servers
    				// a hack for old IIS and Apache servers
    				var raw = res.pipe(new stream.PassThrough());
    				raw.once('data', function(chunk) {
    					// see http://stackoverflow.com/questions/37519828
    					if ((chunk[0] & 0x0F) === 0x08) {
    						body = body.pipe(zlib.createInflate());
    					} else {
    						body = body.pipe(zlib.createInflateRaw());
    					}
    					output = new Response(body, response_options);
    					resolve(output);
    				});
    				return;
    			}
    
    			// otherwise, use response as-is
    			output = new Response(body, response_options);
    			resolve(output);
    			return;
    		});
    
    		// accept string, buffer or readable stream as body
    		// per spec we will call tostring on non-stream objects
    		if (typeof options.body === 'string') {
    			req.write(options.body);
    			req.end();
    		} else if (options.body instanceof Buffer) {
    			req.write(options.body);
    			req.end()
    		} else if (typeof options.body === 'object' && options.body.pipe) {
    			options.body.pipe(req);
    		} else if (typeof options.body === 'object') {
    			req.write(options.body.toString());
    			req.end();
    		} else {
    			req.end();
    		}
    	});
    
    };
    
    /**
     * Redirect code matching
     *
     * @param   Number   code  Status code
     * @return  Boolean
     */
    Fetch.prototype.isRedirect = function(code) {
    	return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
    }
    
    // expose Promise
    Fetch.Promise = global.Promise;
    Fetch.Response = Response;
    Fetch.Headers = Headers;
    Fetch.Request = Request;
    
  provide("node-fetch", module.exports);
}(global));

// pakmanager:whatwg-fetch
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  (function(self) {
      'use strict';
    
      if (self.fetch) {
        return
      }
    
      var support = {
        searchParams: 'URLSearchParams' in self,
        iterable: 'Symbol' in self && 'iterator' in Symbol,
        blob: 'FileReader' in self && 'Blob' in self && (function() {
          try {
            new Blob()
            return true
          } catch(e) {
            return false
          }
        })(),
        formData: 'FormData' in self,
        arrayBuffer: 'ArrayBuffer' in self
      }
    
      function normalizeName(name) {
        if (typeof name !== 'string') {
          name = String(name)
        }
        if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
          throw new TypeError('Invalid character in header field name')
        }
        return name.toLowerCase()
      }
    
      function normalizeValue(value) {
        if (typeof value !== 'string') {
          value = String(value)
        }
        return value
      }
    
      // Build a destructive iterator for the value list
      function iteratorFor(items) {
        var iterator = {
          next: function() {
            var value = items.shift()
            return {done: value === undefined, value: value}
          }
        }
    
        if (support.iterable) {
          iterator[Symbol.iterator] = function() {
            return iterator
          }
        }
    
        return iterator
      }
    
      function Headers(headers) {
        this.map = {}
    
        if (headers instanceof Headers) {
          headers.forEach(function(value, name) {
            this.append(name, value)
          }, this)
    
        } else if (headers) {
          Object.getOwnPropertyNames(headers).forEach(function(name) {
            this.append(name, headers[name])
          }, this)
        }
      }
    
      Headers.prototype.append = function(name, value) {
        name = normalizeName(name)
        value = normalizeValue(value)
        var list = this.map[name]
        if (!list) {
          list = []
          this.map[name] = list
        }
        list.push(value)
      }
    
      Headers.prototype['delete'] = function(name) {
        delete this.map[normalizeName(name)]
      }
    
      Headers.prototype.get = function(name) {
        var values = this.map[normalizeName(name)]
        return values ? values[0] : null
      }
    
      Headers.prototype.getAll = function(name) {
        return this.map[normalizeName(name)] || []
      }
    
      Headers.prototype.has = function(name) {
        return this.map.hasOwnProperty(normalizeName(name))
      }
    
      Headers.prototype.set = function(name, value) {
        this.map[normalizeName(name)] = [normalizeValue(value)]
      }
    
      Headers.prototype.forEach = function(callback, thisArg) {
        Object.getOwnPropertyNames(this.map).forEach(function(name) {
          this.map[name].forEach(function(value) {
            callback.call(thisArg, value, name, this)
          }, this)
        }, this)
      }
    
      Headers.prototype.keys = function() {
        var items = []
        this.forEach(function(value, name) { items.push(name) })
        return iteratorFor(items)
      }
    
      Headers.prototype.values = function() {
        var items = []
        this.forEach(function(value) { items.push(value) })
        return iteratorFor(items)
      }
    
      Headers.prototype.entries = function() {
        var items = []
        this.forEach(function(value, name) { items.push([name, value]) })
        return iteratorFor(items)
      }
    
      if (support.iterable) {
        Headers.prototype[Symbol.iterator] = Headers.prototype.entries
      }
    
      function consumed(body) {
        if (body.bodyUsed) {
          return Promise.reject(new TypeError('Already read'))
        }
        body.bodyUsed = true
      }
    
      function fileReaderReady(reader) {
        return new Promise(function(resolve, reject) {
          reader.onload = function() {
            resolve(reader.result)
          }
          reader.onerror = function() {
            reject(reader.error)
          }
        })
      }
    
      function readBlobAsArrayBuffer(blob) {
        var reader = new FileReader()
        reader.readAsArrayBuffer(blob)
        return fileReaderReady(reader)
      }
    
      function readBlobAsText(blob) {
        var reader = new FileReader()
        reader.readAsText(blob)
        return fileReaderReady(reader)
      }
    
      function Body() {
        this.bodyUsed = false
    
        this._initBody = function(body) {
          this._bodyInit = body
          if (typeof body === 'string') {
            this._bodyText = body
          } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
            this._bodyBlob = body
          } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
            this._bodyFormData = body
          } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
            this._bodyText = body.toString()
          } else if (!body) {
            this._bodyText = ''
          } else if (support.arrayBuffer && ArrayBuffer.prototype.isPrototypeOf(body)) {
            // Only support ArrayBuffers for POST method.
            // Receiving ArrayBuffers happens via Blobs, instead.
          } else {
            throw new Error('unsupported BodyInit type')
          }
    
          if (!this.headers.get('content-type')) {
            if (typeof body === 'string') {
              this.headers.set('content-type', 'text/plain;charset=UTF-8')
            } else if (this._bodyBlob && this._bodyBlob.type) {
              this.headers.set('content-type', this._bodyBlob.type)
            } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
              this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
            }
          }
        }
    
        if (support.blob) {
          this.blob = function() {
            var rejected = consumed(this)
            if (rejected) {
              return rejected
            }
    
            if (this._bodyBlob) {
              return Promise.resolve(this._bodyBlob)
            } else if (this._bodyFormData) {
              throw new Error('could not read FormData body as blob')
            } else {
              return Promise.resolve(new Blob([this._bodyText]))
            }
          }
    
          this.arrayBuffer = function() {
            return this.blob().then(readBlobAsArrayBuffer)
          }
    
          this.text = function() {
            var rejected = consumed(this)
            if (rejected) {
              return rejected
            }
    
            if (this._bodyBlob) {
              return readBlobAsText(this._bodyBlob)
            } else if (this._bodyFormData) {
              throw new Error('could not read FormData body as text')
            } else {
              return Promise.resolve(this._bodyText)
            }
          }
        } else {
          this.text = function() {
            var rejected = consumed(this)
            return rejected ? rejected : Promise.resolve(this._bodyText)
          }
        }
    
        if (support.formData) {
          this.formData = function() {
            return this.text().then(decode)
          }
        }
    
        this.json = function() {
          return this.text().then(JSON.parse)
        }
    
        return this
      }
    
      // HTTP methods whose capitalization should be normalized
      var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']
    
      function normalizeMethod(method) {
        var upcased = method.toUpperCase()
        return (methods.indexOf(upcased) > -1) ? upcased : method
      }
    
      function Request(input, options) {
        options = options || {}
        var body = options.body
        if (Request.prototype.isPrototypeOf(input)) {
          if (input.bodyUsed) {
            throw new TypeError('Already read')
          }
          this.url = input.url
          this.credentials = input.credentials
          if (!options.headers) {
            this.headers = new Headers(input.headers)
          }
          this.method = input.method
          this.mode = input.mode
          if (!body) {
            body = input._bodyInit
            input.bodyUsed = true
          }
        } else {
          this.url = input
        }
    
        this.credentials = options.credentials || this.credentials || 'omit'
        if (options.headers || !this.headers) {
          this.headers = new Headers(options.headers)
        }
        this.method = normalizeMethod(options.method || this.method || 'GET')
        this.mode = options.mode || this.mode || null
        this.referrer = null
    
        if ((this.method === 'GET' || this.method === 'HEAD') && body) {
          throw new TypeError('Body not allowed for GET or HEAD requests')
        }
        this._initBody(body)
      }
    
      Request.prototype.clone = function() {
        return new Request(this)
      }
    
      function decode(body) {
        var form = new FormData()
        body.trim().split('&').forEach(function(bytes) {
          if (bytes) {
            var split = bytes.split('=')
            var name = split.shift().replace(/\+/g, ' ')
            var value = split.join('=').replace(/\+/g, ' ')
            form.append(decodeURIComponent(name), decodeURIComponent(value))
          }
        })
        return form
      }
    
      function headers(xhr) {
        var head = new Headers()
        var pairs = (xhr.getAllResponseHeaders() || '').trim().split('\n')
        pairs.forEach(function(header) {
          var split = header.trim().split(':')
          var key = split.shift().trim()
          var value = split.join(':').trim()
          head.append(key, value)
        })
        return head
      }
    
      Body.call(Request.prototype)
    
      function Response(bodyInit, options) {
        if (!options) {
          options = {}
        }
    
        this.type = 'default'
        this.status = options.status
        this.ok = this.status >= 200 && this.status < 300
        this.statusText = options.statusText
        this.headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers)
        this.url = options.url || ''
        this._initBody(bodyInit)
      }
    
      Body.call(Response.prototype)
    
      Response.prototype.clone = function() {
        return new Response(this._bodyInit, {
          status: this.status,
          statusText: this.statusText,
          headers: new Headers(this.headers),
          url: this.url
        })
      }
    
      Response.error = function() {
        var response = new Response(null, {status: 0, statusText: ''})
        response.type = 'error'
        return response
      }
    
      var redirectStatuses = [301, 302, 303, 307, 308]
    
      Response.redirect = function(url, status) {
        if (redirectStatuses.indexOf(status) === -1) {
          throw new RangeError('Invalid status code')
        }
    
        return new Response(null, {status: status, headers: {location: url}})
      }
    
      self.Headers = Headers
      self.Request = Request
      self.Response = Response
    
      self.fetch = function(input, init) {
        return new Promise(function(resolve, reject) {
          var request
          if (Request.prototype.isPrototypeOf(input) && !init) {
            request = input
          } else {
            request = new Request(input, init)
          }
    
          var xhr = new XMLHttpRequest()
    
          function responseURL() {
            if ('responseURL' in xhr) {
              return xhr.responseURL
            }
    
            // Avoid security warnings on getResponseHeader when not allowed by CORS
            if (/^X-Request-URL:/m.test(xhr.getAllResponseHeaders())) {
              return xhr.getResponseHeader('X-Request-URL')
            }
    
            return
          }
    
          xhr.onload = function() {
            var options = {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: headers(xhr),
              url: responseURL()
            }
            var body = 'response' in xhr ? xhr.response : xhr.responseText
            resolve(new Response(body, options))
          }
    
          xhr.onerror = function() {
            reject(new TypeError('Network request failed'))
          }
    
          xhr.ontimeout = function() {
            reject(new TypeError('Network request failed'))
          }
    
          xhr.open(request.method, request.url, true)
    
          if (request.credentials === 'include') {
            xhr.withCredentials = true
          }
    
          if ('responseType' in xhr && support.blob) {
            xhr.responseType = 'blob'
          }
    
          request.headers.forEach(function(value, name) {
            xhr.setRequestHeader(name, value)
          })
    
          xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
        })
      }
      self.fetch.polyfill = true
    })(typeof self !== 'undefined' ? self : this);
    
  provide("whatwg-fetch", module.exports);
}(global));

// pakmanager:js-tokens
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // Copyright 2014, 2015 Simon Lydell
    // X11 (“MIT”) Licensed. (See LICENSE.)
    
    // This regex comes from regex.coffee, and is inserted here by generate-index.js
    // (run `npm run build`).
    module.exports = /((['"])(?:(?!\2|\\).|\\(?:\r\n|[\s\S]))*(\2)?|`(?:[^`\\$]|\\[\s\S]|\$(?!\{)|\$\{(?:[^{}]|\{[^}]*\}?)*\}?)*(`)?)|(\/\/.*)|(\/\*(?:[^*]|\*(?!\/))*(\*\/)?)|(\/(?!\*)(?:\[(?:(?![\]\\]).|\\.)*\]|(?![\/\]\\]).|\\.)+\/(?:(?!\s*(?:\b|[\u0080-\uFFFF$\\'"~({]|[+\-!](?!=)|\.?\d))|[gmiyu]{1,5}\b(?![\u0080-\uFFFF$\\]|\s*(?:[+\-*%&|^<>!=?({]|\/(?![\/*])))))|((?:0[xX][\da-fA-F]+|0[oO][0-7]+|0[bB][01]+|(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?))|((?!\d)(?:(?!\s)[$\w\u0080-\uFFFF]|\\u[\da-fA-F]{4}|\\u\{[\da-fA-F]{1,6}\})+)|(--|\+\+|&&|\|\||=>|\.{3}|(?:[+\-*\/%&|^]|<{1,2}|>{1,3}|!=?|={1,2})=?|[?:~]|[;,.[\](){}])|(\s+)|(^$|[\s\S])/g
    
    module.exports.matchToToken = function(match) {
      var token = {type: "invalid", value: match[0]}
           if (match[ 1]) token.type = "string" , token.closed = !!(match[3] || match[4])
      else if (match[ 5]) token.type = "comment"
      else if (match[ 6]) token.type = "comment", token.closed = !!match[7]
      else if (match[ 8]) token.type = "regex"
      else if (match[ 9]) token.type = "number"
      else if (match[10]) token.type = "name"
      else if (match[11]) token.type = "punctuator"
      else if (match[12]) token.type = "whitespace"
      return token
    }
    
  provide("js-tokens", module.exports);
}(global));

// pakmanager:asap/raw
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict";
    
    var domain; // The domain module is executed on demand
    var hasSetImmediate = typeof setImmediate === "function";
    
    // Use the fastest means possible to execute a task in its own turn, with
    // priority over other events including network IO events in Node.js.
    //
    // An exception thrown by a task will permanently interrupt the processing of
    // subsequent tasks. The higher level `asap` function ensures that if an
    // exception is thrown by a task, that the task queue will continue flushing as
    // soon as possible, but if you use `rawAsap` directly, you are responsible to
    // either ensure that no exceptions are thrown from your task, or to manually
    // call `rawAsap.requestFlush` if an exception is thrown.
    module.exports = rawAsap;
    function rawAsap(task) {
        if (!queue.length) {
            requestFlush();
            flushing = true;
        }
        // Avoids a function call
        queue[queue.length] = task;
    }
    
    var queue = [];
    // Once a flush has been requested, no further calls to `requestFlush` are
    // necessary until the next `flush` completes.
    var flushing = false;
    // The position of the next task to execute in the task queue. This is
    // preserved between calls to `flush` so that it can be resumed if
    // a task throws an exception.
    var index = 0;
    // If a task schedules additional tasks recursively, the task queue can grow
    // unbounded. To prevent memory excaustion, the task queue will periodically
    // truncate already-completed tasks.
    var capacity = 1024;
    
    // The flush function processes all tasks that have been scheduled with
    // `rawAsap` unless and until one of those tasks throws an exception.
    // If a task throws an exception, `flush` ensures that its state will remain
    // consistent and will resume where it left off when called again.
    // However, `flush` does not make any arrangements to be called again if an
    // exception is thrown.
    function flush() {
        while (index < queue.length) {
            var currentIndex = index;
            // Advance the index before calling the task. This ensures that we will
            // begin flushing on the next task the task throws an error.
            index = index + 1;
            queue[currentIndex].call();
            // Prevent leaking memory for long chains of recursive calls to `asap`.
            // If we call `asap` within tasks scheduled by `asap`, the queue will
            // grow, but to avoid an O(n) walk for every task we execute, we don't
            // shift tasks off the queue after they have been executed.
            // Instead, we periodically shift 1024 tasks off the queue.
            if (index > capacity) {
                // Manually shift all values starting at the index back to the
                // beginning of the queue.
                for (var scan = 0, newLength = queue.length - index; scan < newLength; scan++) {
                    queue[scan] = queue[scan + index];
                }
                queue.length -= index;
                index = 0;
            }
        }
        queue.length = 0;
        index = 0;
        flushing = false;
    }
    
    rawAsap.requestFlush = requestFlush;
    function requestFlush() {
        // Ensure flushing is not bound to any domain.
        // It is not sufficient to exit the domain, because domains exist on a stack.
        // To execute code outside of any domain, the following dance is necessary.
        var parentDomain = process.domain;
        if (parentDomain) {
            if (!domain) {
                // Lazy execute the domain module.
                // Only employed if the user elects to use domains.
                domain = require("domain");
            }
            domain.active = process.domain = null;
        }
    
        // `setImmediate` is slower that `process.nextTick`, but `process.nextTick`
        // cannot handle recursion.
        // `requestFlush` will only be called recursively from `asap.js`, to resume
        // flushing after an error is thrown into a domain.
        // Conveniently, `setImmediate` was introduced in the same version
        // `process.nextTick` started throwing recursion errors.
        if (flushing && hasSetImmediate) {
            setImmediate(flush);
        } else {
            process.nextTick(flush);
        }
    
        if (parentDomain) {
            domain.active = process.domain = parentDomain;
        }
    }
    
  provide("asap/raw", module.exports);
}(global));

// pakmanager:asap
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict";
    
    var rawAsap =  require('asap/raw');
    var freeTasks = [];
    
    /**
     * Calls a task as soon as possible after returning, in its own event, with
     * priority over IO events. An exception thrown in a task can be handled by
     * `process.on("uncaughtException") or `domain.on("error")`, but will otherwise
     * crash the process. If the error is handled, all subsequent tasks will
     * resume.
     *
     * @param {{call}} task A callable object, typically a function that takes no
     * arguments.
     */
    module.exports = asap;
    function asap(task) {
        var rawTask;
        if (freeTasks.length) {
            rawTask = freeTasks.pop();
        } else {
            rawTask = new RawTask();
        }
        rawTask.task = task;
        rawTask.domain = process.domain;
        rawAsap(rawTask);
    }
    
    function RawTask() {
        this.task = null;
        this.domain = null;
    }
    
    RawTask.prototype.call = function () {
        if (this.domain) {
            this.domain.enter();
        }
        var threw = true;
        try {
            this.task.call();
            threw = false;
            // If the task throws an exception (presumably) Node.js restores the
            // domain stack for the next event.
            if (this.domain) {
                this.domain.exit();
            }
        } finally {
            // We use try/finally and a threw flag to avoid messing up stack traces
            // when we catch and release errors.
            if (threw) {
                // In Node.js, uncaught exceptions are considered fatal errors.
                // Re-throw them to interrupt flushing!
                // Ensure that flushing continues if an uncaught exception is
                // suppressed listening process.on("uncaughtException") or
                // domain.on("error").
                rawAsap.requestFlush();
            }
            // If the task threw an error, we do not want to exit the domain here.
            // Exiting the domain would prevent the domain from catching the error.
            this.task = null;
            this.domain = null;
            freeTasks.push(this);
        }
    };
    
    
  provide("asap", module.exports);
}(global));

// pakmanager:core-js/modules/$.fails
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  module.exports = function(exec){
      try {
        return !!exec();
      } catch(e){
        return true;
      }
    };
  provide("core-js/modules/$.fails", module.exports);
}(global));

// pakmanager:core-js/modules/$.global
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
    var global = module.exports = typeof window != 'undefined' && window.Math == Math
      ? window : typeof self != 'undefined' && self.Math == Math ? self : Function('return this')();
    if(typeof __g == 'number')__g = global; // eslint-disable-line no-undef
  provide("core-js/modules/$.global", module.exports);
}(global));

// pakmanager:core-js/modules/$.shared
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var global =  require('core-js/modules/$.global')
      , SHARED = '__core-js_shared__'
      , store  = global[SHARED] || (global[SHARED] = {});
    module.exports = function(key){
      return store[key] || (store[key] = {});
    };
  provide("core-js/modules/$.shared", module.exports);
}(global));

// pakmanager:core-js/modules/$.uid
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var id = 0
      , px = Math.random();
    module.exports = function(key){
      return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
    };
  provide("core-js/modules/$.uid", module.exports);
}(global));

// pakmanager:core-js/modules/$
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $Object = Object;
    module.exports = {
      create:     $Object.create,
      getProto:   $Object.getPrototypeOf,
      isEnum:     {}.propertyIsEnumerable,
      getDesc:    $Object.getOwnPropertyDescriptor,
      setDesc:    $Object.defineProperty,
      setDescs:   $Object.defineProperties,
      getKeys:    $Object.keys,
      getNames:   $Object.getOwnPropertyNames,
      getSymbols: $Object.getOwnPropertySymbols,
      each:       [].forEach
    };
  provide("core-js/modules/$", module.exports);
}(global));

// pakmanager:core-js/modules/$.property-desc
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  module.exports = function(bitmap, value){
      return {
        enumerable  : !(bitmap & 1),
        configurable: !(bitmap & 2),
        writable    : !(bitmap & 4),
        value       : value
      };
    };
  provide("core-js/modules/$.property-desc", module.exports);
}(global));

// pakmanager:core-js/modules/$.descriptors
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // Thank's IE8 for his funny defineProperty
    module.exports = ! require('core-js/modules/$.fails')(function(){
      return Object.defineProperty({}, 'a', {get: function(){ return 7; }}).a != 7;
    });
  provide("core-js/modules/$.descriptors", module.exports);
}(global));

// pakmanager:core-js/modules/$.is-object
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  module.exports = function(it){
      return typeof it === 'object' ? it !== null : typeof it === 'function';
    };
  provide("core-js/modules/$.is-object", module.exports);
}(global));

// pakmanager:core-js/modules/$.cof
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var toString = {}.toString;
    
    module.exports = function(it){
      return toString.call(it).slice(8, -1);
    };
  provide("core-js/modules/$.cof", module.exports);
}(global));

// pakmanager:core-js/modules/$.wks
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var store  =  require('core-js/modules/$.shared')('wks')
      , uid    =  require('core-js/modules/$.uid')
      , Symbol =  require('core-js/modules/$.global').Symbol;
    module.exports = function(name){
      return store[name] || (store[name] =
        Symbol && Symbol[name] || (Symbol || uid)('Symbol.' + name));
    };
  provide("core-js/modules/$.wks", module.exports);
}(global));

// pakmanager:core-js/modules/$.hide
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $          =  require('core-js/modules/
      , createDesc =  require('core-js/modules/$.property-desc');
    module.exports =  require('core-js/modules/$.descriptors') ? function(object, key, value){
      return $.setDesc(object, key, createDesc(1, value));
    } : function(object, key, value){
      object[key] = value;
      return object;
    };)
      , createDesc =  require('core-js/modules/$.property-desc');
    module.exports =  require('core-js/modules/$.descriptors') ? function(object, key, value){
      return $.setDesc(object, key, createDesc(1, value));
    } : function(object, key, value){
      object[key] = value;
      return object;
    };
  provide("core-js/modules/$.hide", module.exports);
}(global));

// pakmanager:core-js/modules/$.core
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var core = module.exports = {version: '1.2.6'};
    if(typeof __e == 'number')__e = core; // eslint-disable-line no-undef
  provide("core-js/modules/$.core", module.exports);
}(global));

// pakmanager:core-js/modules/$.a-function
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  module.exports = function(it){
      if(typeof it != 'function')throw TypeError(it + ' is not a function!');
      return it;
    };
  provide("core-js/modules/$.a-function", module.exports);
}(global));

// pakmanager:core-js/modules/$.has
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var hasOwnProperty = {}.hasOwnProperty;
    module.exports = function(it, key){
      return hasOwnProperty.call(it, key);
    };
  provide("core-js/modules/$.has", module.exports);
}(global));

// pakmanager:core-js/modules/$.an-object
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var isObject =  require('core-js/modules/$.is-object');
    module.exports = function(it){
      if(!isObject(it))throw TypeError(it + ' is not an object!');
      return it;
    };
  provide("core-js/modules/$.an-object", module.exports);
}(global));

// pakmanager:core-js/modules/$.iterators
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  module.exports = {};
  provide("core-js/modules/$.iterators", module.exports);
}(global));

// pakmanager:core-js/modules/$.to-integer
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 7.1.4 ToInteger
    var ceil  = Math.ceil
      , floor = Math.floor;
    module.exports = function(it){
      return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
    };
  provide("core-js/modules/$.to-integer", module.exports);
}(global));

// pakmanager:core-js/modules/$.classof
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // getting tag from 19.1.3.6 Object.prototype.toString()
    var cof =  require('core-js/modules/$.cof')
      , TAG =  require('core-js/modules/$.wks')('toStringTag')
      // ES3 wrong here
      , ARG = cof(function(){ return arguments; }()) == 'Arguments';
    
    module.exports = function(it){
      var O, T, B;
      return it === undefined ? 'Undefined' : it === null ? 'Null'
        // @@toStringTag case
        : typeof (T = (O = Object(it))[TAG]) == 'string' ? T
        // builtinTag case
        : ARG ? cof(O)
        // ES3 arguments fallback
        : (B = cof(O)) == 'Object' && typeof O.callee == 'function' ? 'Arguments' : B;
    };
  provide("core-js/modules/$.classof", module.exports);
}(global));

// pakmanager:core-js/modules/$.redefine
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // add fake Function#toString
    // for correct work wrapped methods / constructors with methods like LoDash isNative
    var global    =  require('core-js/modules/$.global')
      , hide      =  require('core-js/modules/$.hide')
      , SRC       =  require('core-js/modules/$.uid')('src')
      , TO_STRING = 'toString'
      , $toString = Function[TO_STRING]
      , TPL       = ('' + $toString).split(TO_STRING);
    
     require('core-js/modules/$.core').inspectSource = function(it){
      return $toString.call(it);
    };
    
    (module.exports = function(O, key, val, safe){
      if(typeof val == 'function'){
        val.hasOwnProperty(SRC) || hide(val, SRC, O[key] ? '' + O[key] : TPL.join(String(key)));
        val.hasOwnProperty('name') || hide(val, 'name', key);
      }
      if(O === global){
        O[key] = val;
      } else {
        if(!safe)delete O[key];
        hide(O, key, val);
      }
    })(Function.prototype, TO_STRING, function toString(){
      return typeof this == 'function' && this[SRC] || $toString.call(this);
    });
  provide("core-js/modules/$.redefine", module.exports);
}(global));

// pakmanager:core-js/modules/$.ctx
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // optional / simple context binding
    var aFunction =  require('core-js/modules/$.a-function');
    module.exports = function(fn, that, length){
      aFunction(fn);
      if(that === undefined)return fn;
      switch(length){
        case 1: return function(a){
          return fn.call(that, a);
        };
        case 2: return function(a, b){
          return fn.call(that, a, b);
        };
        case 3: return function(a, b, c){
          return fn.call(that, a, b, c);
        };
      }
      return function(/* ...args */){
        return fn.apply(that, arguments);
      };
    };
  provide("core-js/modules/$.ctx", module.exports);
}(global));

// pakmanager:core-js/modules/$.set-to-string-tag
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var def =  require('core-js/modules/.setDesc
      , has =  require('core-js/modules/$.has')
      , TAG =  require('core-js/modules/$.wks')('toStringTag');
    
    module.exports = function(it, tag, stat){
      if(it && !has(it = stat ? it : it.prototype, TAG))def(it, TAG, {configurable: true, value: tag});
    };).setDesc
      , has =  require('core-js/modules/$.has')
      , TAG =  require('core-js/modules/$.wks')('toStringTag');
    
    module.exports = function(it, tag, stat){
      if(it && !has(it = stat ? it : it.prototype, TAG))def(it, TAG, {configurable: true, value: tag});
    };
  provide("core-js/modules/$.set-to-string-tag", module.exports);
}(global));

// pakmanager:core-js/modules/$.defined
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 7.2.1 RequireObjectCoercible(argument)
    module.exports = function(it){
      if(it == undefined)throw TypeError("Can't call method on  " + it);
      return it;
    };
  provide("core-js/modules/$.defined", module.exports);
}(global));

// pakmanager:core-js/modules/$.is-array
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 7.2.2 IsArray(argument)
    var cof =  require('core-js/modules/$.cof');
    module.exports = Array.isArray || function(arg){
      return cof(arg) == 'Array';
    };
  provide("core-js/modules/$.is-array", module.exports);
}(global));

// pakmanager:core-js/modules/$.iobject
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // fallback for non-array-like ES3 and non-enumerable old V8 strings
    var cof =  require('core-js/modules/$.cof');
    module.exports = Object('z').propertyIsEnumerable(0) ? Object : function(it){
      return cof(it) == 'String' ? it.split('') : Object(it);
    };
  provide("core-js/modules/$.iobject", module.exports);
}(global));

// pakmanager:core-js/modules/$.invoke
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // fast apply, http://jsperf.lnkit.com/fast-apply/5
    module.exports = function(fn, args, that){
      var un = that === undefined;
      switch(args.length){
        case 0: return un ? fn()
                          : fn.call(that);
        case 1: return un ? fn(args[0])
                          : fn.call(that, args[0]);
        case 2: return un ? fn(args[0], args[1])
                          : fn.call(that, args[0], args[1]);
        case 3: return un ? fn(args[0], args[1], args[2])
                          : fn.call(that, args[0], args[1], args[2]);
        case 4: return un ? fn(args[0], args[1], args[2], args[3])
                          : fn.call(that, args[0], args[1], args[2], args[3]);
      } return              fn.apply(that, args);
    };
  provide("core-js/modules/$.invoke", module.exports);
}(global));

// pakmanager:core-js/modules/$.html
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  module.exports =  require('core-js/modules/$.global').document && document.documentElement;
  provide("core-js/modules/$.html", module.exports);
}(global));

// pakmanager:core-js/modules/$.dom-create
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var isObject =  require('core-js/modules/$.is-object')
      , document =  require('core-js/modules/$.global').document
      // in old IE typeof document.createElement is 'object'
      , is = isObject(document) && isObject(document.createElement);
    module.exports = function(it){
      return is ? document.createElement(it) : {};
    };
  provide("core-js/modules/$.dom-create", module.exports);
}(global));

// pakmanager:core-js/modules/$.iter-call
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // call something on iterator step with safe closing on error
    var anObject =  require('core-js/modules/$.an-object');
    module.exports = function(iterator, fn, value, entries){
      try {
        return entries ? fn(anObject(value)[0], value[1]) : fn(value);
      // 7.4.6 IteratorClose(iterator, completion)
      } catch(e){
        var ret = iterator['return'];
        if(ret !== undefined)anObject(ret.call(iterator));
        throw e;
      }
    };
  provide("core-js/modules/$.iter-call", module.exports);
}(global));

// pakmanager:core-js/modules/$.is-array-iter
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // check on default Array iterator
    var Iterators  =  require('core-js/modules/$.iterators')
      , ITERATOR   =  require('core-js/modules/$.wks')('iterator')
      , ArrayProto = Array.prototype;
    
    module.exports = function(it){
      return it !== undefined && (Iterators.Array === it || ArrayProto[ITERATOR] === it);
    };
  provide("core-js/modules/$.is-array-iter", module.exports);
}(global));

// pakmanager:core-js/modules/$.to-length
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 7.1.15 ToLength
    var toInteger =  require('core-js/modules/$.to-integer')
      , min       = Math.min;
    module.exports = function(it){
      return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0; // pow(2, 53) - 1 == 9007199254740991
    };
  provide("core-js/modules/$.to-length", module.exports);
}(global));

// pakmanager:core-js/modules/core.get-iterator-method
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var classof   =  require('core-js/modules/$.classof')
      , ITERATOR  =  require('core-js/modules/$.wks')('iterator')
      , Iterators =  require('core-js/modules/$.iterators');
    module.exports =  require('core-js/modules/$.core').getIteratorMethod = function(it){
      if(it != undefined)return it[ITERATOR]
        || it['@@iterator']
        || Iterators[classof(it)];
    };
  provide("core-js/modules/core.get-iterator-method", module.exports);
}(global));

// pakmanager:core-js/modules/$.library
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  module.exports = false;
  provide("core-js/modules/$.library", module.exports);
}(global));

// pakmanager:core-js/modules/$.export
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var global    =  require('core-js/modules/$.global')
      , core      =  require('core-js/modules/$.core')
      , hide      =  require('core-js/modules/$.hide')
      , redefine  =  require('core-js/modules/$.redefine')
      , ctx       =  require('core-js/modules/$.ctx')
      , PROTOTYPE = 'prototype';
    
    var $export = function(type, name, source){
      var IS_FORCED = type & $export.F
        , IS_GLOBAL = type & $export.G
        , IS_STATIC = type & $export.S
        , IS_PROTO  = type & $export.P
        , IS_BIND   = type & $export.B
        , target    = IS_GLOBAL ? global : IS_STATIC ? global[name] || (global[name] = {}) : (global[name] || {})[PROTOTYPE]
        , exports   = IS_GLOBAL ? core : core[name] || (core[name] = {})
        , expProto  = exports[PROTOTYPE] || (exports[PROTOTYPE] = {})
        , key, own, out, exp;
      if(IS_GLOBAL)source = name;
      for(key in source){
        // contains in native
        own = !IS_FORCED && target && key in target;
        // export native or passed
        out = (own ? target : source)[key];
        // bind timers to global for call from export context
        exp = IS_BIND && own ? ctx(out, global) : IS_PROTO && typeof out == 'function' ? ctx(Function.call, out) : out;
        // extend global
        if(target && !own)redefine(target, key, out);
        // export
        if(exports[key] != out)hide(exports, key, exp);
        if(IS_PROTO && expProto[key] != out)expProto[key] = out;
      }
    };
    global.core = core;
    // type bitmap
    $export.F = 1;  // forced
    $export.G = 2;  // global
    $export.S = 4;  // static
    $export.P = 8;  // proto
    $export.B = 16; // bind
    $export.W = 32; // wrap
    module.exports = $export;
  provide("core-js/modules/$.export", module.exports);
}(global));

// pakmanager:core-js/modules/$.iter-create
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $              =  require('core-js/modules/
      , descriptor     =  require('core-js/modules/$.property-desc')
      , setToStringTag =  require('core-js/modules/$.set-to-string-tag')
      , IteratorPrototype = {};
    
    // 25.1.2.1.1 %IteratorPrototype%[@@iterator]()
     require('core-js/modules/$.hide')(IteratorPrototype,  require('core-js/modules/$.wks')('iterator'), function(){ return this; });
    
    module.exports = function(Constructor, NAME, next){
      Constructor.prototype = $.create(IteratorPrototype, {next: descriptor(1, next)});
      setToStringTag(Constructor, NAME + ' Iterator');
    };)
      , descriptor     =  require('core-js/modules/$.property-desc')
      , setToStringTag =  require('core-js/modules/$.set-to-string-tag')
      , IteratorPrototype = {};
    
    // 25.1.2.1.1 %IteratorPrototype%[@@iterator]()
     require('core-js/modules/$.hide')(IteratorPrototype,  require('core-js/modules/$.wks')('iterator'), function(){ return this; });
    
    module.exports = function(Constructor, NAME, next){
      Constructor.prototype = $.create(IteratorPrototype, {next: descriptor(1, next)});
      setToStringTag(Constructor, NAME + ' Iterator');
    };
  provide("core-js/modules/$.iter-create", module.exports);
}(global));

// pakmanager:core-js/modules/$.to-object
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 7.1.13 ToObject(argument)
    var defined =  require('core-js/modules/$.defined');
    module.exports = function(it){
      return Object(defined(it));
    };
  provide("core-js/modules/$.to-object", module.exports);
}(global));

// pakmanager:core-js/modules/$.array-species-create
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 9.4.2.3 ArraySpeciesCreate(originalArray, length)
    var isObject =  require('core-js/modules/$.is-object')
      , isArray  =  require('core-js/modules/$.is-array')
      , SPECIES  =  require('core-js/modules/$.wks')('species');
    module.exports = function(original, length){
      var C;
      if(isArray(original)){
        C = original.constructor;
        // cross-realm fallback
        if(typeof C == 'function' && (C === Array || isArray(C.prototype)))C = undefined;
        if(isObject(C)){
          C = C[SPECIES];
          if(C === null)C = undefined;
        }
      } return new (C === undefined ? Array : C)(length);
    };
  provide("core-js/modules/$.array-species-create", module.exports);
}(global));

// pakmanager:core-js/modules/$.to-iobject
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // to indexed object, toObject with fallback for non-array-like ES3 strings
    var IObject =  require('core-js/modules/$.iobject')
      , defined =  require('core-js/modules/$.defined');
    module.exports = function(it){
      return IObject(defined(it));
    };
  provide("core-js/modules/$.to-iobject", module.exports);
}(global));

// pakmanager:core-js/modules/$.to-index
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var toInteger =  require('core-js/modules/$.to-integer')
      , max       = Math.max
      , min       = Math.min;
    module.exports = function(index, length){
      index = toInteger(index);
      return index < 0 ? max(index + length, 0) : min(index, length);
    };
  provide("core-js/modules/$.to-index", module.exports);
}(global));

// pakmanager:core-js/modules/$.is-regexp
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 7.2.8 IsRegExp(argument)
    var isObject =  require('core-js/modules/$.is-object')
      , cof      =  require('core-js/modules/$.cof')
      , MATCH    =  require('core-js/modules/$.wks')('match');
    module.exports = function(it){
      var isRegExp;
      return isObject(it) && ((isRegExp = it[MATCH]) !== undefined ? !!isRegExp : cof(it) == 'RegExp');
    };
  provide("core-js/modules/$.is-regexp", module.exports);
}(global));

// pakmanager:core-js/modules/$.task
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var ctx                =  require('core-js/modules/$.ctx')
      , invoke             =  require('core-js/modules/$.invoke')
      , html               =  require('core-js/modules/$.html')
      , cel                =  require('core-js/modules/$.dom-create')
      , global             =  require('core-js/modules/$.global')
      , process            = global.process
      , setTask            = global.setImmediate
      , clearTask          = global.clearImmediate
      , MessageChannel     = global.MessageChannel
      , counter            = 0
      , queue              = {}
      , ONREADYSTATECHANGE = 'onreadystatechange'
      , defer, channel, port;
    var run = function(){
      var id = +this;
      if(queue.hasOwnProperty(id)){
        var fn = queue[id];
        delete queue[id];
        fn();
      }
    };
    var listner = function(event){
      run.call(event.data);
    };
    // Node.js 0.9+ & IE10+ has setImmediate, otherwise:
    if(!setTask || !clearTask){
      setTask = function setImmediate(fn){
        var args = [], i = 1;
        while(arguments.length > i)args.push(arguments[i++]);
        queue[++counter] = function(){
          invoke(typeof fn == 'function' ? fn : Function(fn), args);
        };
        defer(counter);
        return counter;
      };
      clearTask = function clearImmediate(id){
        delete queue[id];
      };
      // Node.js 0.8-
      if( require('core-js/modules/$.cof')(process) == 'process'){
        defer = function(id){
          process.nextTick(ctx(run, id, 1));
        };
      // Browsers with MessageChannel, includes WebWorkers
      } else if(MessageChannel){
        channel = new MessageChannel;
        port    = channel.port2;
        channel.port1.onmessage = listner;
        defer = ctx(port.postMessage, port, 1);
      // Browsers with postMessage, skip WebWorkers
      // IE8 has postMessage, but it's sync & typeof its postMessage is 'object'
      } else if(global.addEventListener && typeof postMessage == 'function' && !global.importScripts){
        defer = function(id){
          global.postMessage(id + '', '*');
        };
        global.addEventListener('message', listner, false);
      // IE8-
      } else if(ONREADYSTATECHANGE in cel('script')){
        defer = function(id){
          html.appendChild(cel('script'))[ONREADYSTATECHANGE] = function(){
            html.removeChild(this);
            run.call(id);
          };
        };
      // Rest old browsers
      } else {
        defer = function(id){
          setTimeout(ctx(run, id, 1), 0);
        };
      }
    }
    module.exports = {
      set:   setTask,
      clear: clearTask
    };
  provide("core-js/modules/$.task", module.exports);
}(global));

// pakmanager:core-js/modules/$.redefine-all
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var redefine =  require('core-js/modules/$.redefine');
    module.exports = function(target, src){
      for(var key in src)redefine(target, key, src[key]);
      return target;
    };
  provide("core-js/modules/$.redefine-all", module.exports);
}(global));

// pakmanager:core-js/modules/$.strict-new
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  module.exports = function(it, Constructor, name){
      if(!(it instanceof Constructor))throw TypeError(name + ": use the 'new' operator!");
      return it;
    };
  provide("core-js/modules/$.strict-new", module.exports);
}(global));

// pakmanager:core-js/modules/$.for-of
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var ctx         =  require('core-js/modules/$.ctx')
      , call        =  require('core-js/modules/$.iter-call')
      , isArrayIter =  require('core-js/modules/$.is-array-iter')
      , anObject    =  require('core-js/modules/$.an-object')
      , toLength    =  require('core-js/modules/$.to-length')
      , getIterFn   =  require('core-js/modules/core.get-iterator-method');
    module.exports = function(iterable, entries, fn, that){
      var iterFn = getIterFn(iterable)
        , f      = ctx(fn, that, entries ? 2 : 1)
        , index  = 0
        , length, step, iterator;
      if(typeof iterFn != 'function')throw TypeError(iterable + ' is not iterable!');
      // fast case for arrays with default iterator
      if(isArrayIter(iterFn))for(length = toLength(iterable.length); length > index; index++){
        entries ? f(anObject(step = iterable[index])[0], step[1]) : f(iterable[index]);
      } else for(iterator = iterFn.call(iterable); !(step = iterator.next()).done; ){
        call(iterator, f, step.value, entries);
      }
    };
  provide("core-js/modules/$.for-of", module.exports);
}(global));

// pakmanager:core-js/modules/$.iter-define
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var LIBRARY        =  require('core-js/modules/$.library')
      , $export        =  require('core-js/modules/$.export')
      , redefine       =  require('core-js/modules/$.redefine')
      , hide           =  require('core-js/modules/$.hide')
      , has            =  require('core-js/modules/$.has')
      , Iterators      =  require('core-js/modules/$.iterators')
      , $iterCreate    =  require('core-js/modules/$.iter-create')
      , setToStringTag =  require('core-js/modules/$.set-to-string-tag')
      , getProto       =  require('core-js/modules/.getProto
      , ITERATOR       =  require('core-js/modules/$.wks')('iterator')
      , BUGGY          = !([].keys && 'next' in [].keys()) // Safari has buggy iterators w/o `next`
      , FF_ITERATOR    = '@@iterator'
      , KEYS           = 'keys'
      , VALUES         = 'values';
    
    var returnThis = function(){ return this; };
    
    module.exports = function(Base, NAME, Constructor, next, DEFAULT, IS_SET, FORCED){
      $iterCreate(Constructor, NAME, next);
      var getMethod = function(kind){
        if(!BUGGY && kind in proto)return proto[kind];
        switch(kind){
          case KEYS: return function keys(){ return new Constructor(this, kind); };
          case VALUES: return function values(){ return new Constructor(this, kind); };
        } return function entries(){ return new Constructor(this, kind); };
      };
      var TAG        = NAME + ' Iterator'
        , DEF_VALUES = DEFAULT == VALUES
        , VALUES_BUG = false
        , proto      = Base.prototype
        , $native    = proto[ITERATOR] || proto[FF_ITERATOR] || DEFAULT && proto[DEFAULT]
        , $default   = $native || getMethod(DEFAULT)
        , methods, key;
      // Fix native
      if($native){
        var IteratorPrototype = getProto($default.call(new Base));
        // Set @@toStringTag to native iterators
        setToStringTag(IteratorPrototype, TAG, true);
        // FF fix
        if(!LIBRARY && has(proto, FF_ITERATOR))hide(IteratorPrototype, ITERATOR, returnThis);
        // fix Array#{values, @@iterator}.name in V8 / FF
        if(DEF_VALUES && $native.name !== VALUES){
          VALUES_BUG = true;
          $default = function values(){ return $native.call(this); };
        }
      }
      // Define iterator
      if((!LIBRARY || FORCED) && (BUGGY || VALUES_BUG || !proto[ITERATOR])){
        hide(proto, ITERATOR, $default);
      }
      // Plug for library
      Iterators[NAME] = $default;
      Iterators[TAG]  = returnThis;
      if(DEFAULT){
        methods = {
          values:  DEF_VALUES  ? $default : getMethod(VALUES),
          keys:    IS_SET      ? $default : getMethod(KEYS),
          entries: !DEF_VALUES ? $default : getMethod('entries')
        };
        if(FORCED)for(key in methods){
          if(!(key in proto))redefine(proto, key, methods[key]);
        } else $export($export.P + $export.F * (BUGGY || VALUES_BUG), NAME, methods);
      }
      return methods;
    };).getProto
      , ITERATOR       =  require('core-js/modules/$.wks')('iterator')
      , BUGGY          = !([].keys && 'next' in [].keys()) // Safari has buggy iterators w/o `next`
      , FF_ITERATOR    = '@@iterator'
      , KEYS           = 'keys'
      , VALUES         = 'values';
    
    var returnThis = function(){ return this; };
    
    module.exports = function(Base, NAME, Constructor, next, DEFAULT, IS_SET, FORCED){
      $iterCreate(Constructor, NAME, next);
      var getMethod = function(kind){
        if(!BUGGY && kind in proto)return proto[kind];
        switch(kind){
          case KEYS: return function keys(){ return new Constructor(this, kind); };
          case VALUES: return function values(){ return new Constructor(this, kind); };
        } return function entries(){ return new Constructor(this, kind); };
      };
      var TAG        = NAME + ' Iterator'
        , DEF_VALUES = DEFAULT == VALUES
        , VALUES_BUG = false
        , proto      = Base.prototype
        , $native    = proto[ITERATOR] || proto[FF_ITERATOR] || DEFAULT && proto[DEFAULT]
        , $default   = $native || getMethod(DEFAULT)
        , methods, key;
      // Fix native
      if($native){
        var IteratorPrototype = getProto($default.call(new Base));
        // Set @@toStringTag to native iterators
        setToStringTag(IteratorPrototype, TAG, true);
        // FF fix
        if(!LIBRARY && has(proto, FF_ITERATOR))hide(IteratorPrototype, ITERATOR, returnThis);
        // fix Array#{values, @@iterator}.name in V8 / FF
        if(DEF_VALUES && $native.name !== VALUES){
          VALUES_BUG = true;
          $default = function values(){ return $native.call(this); };
        }
      }
      // Define iterator
      if((!LIBRARY || FORCED) && (BUGGY || VALUES_BUG || !proto[ITERATOR])){
        hide(proto, ITERATOR, $default);
      }
      // Plug for library
      Iterators[NAME] = $default;
      Iterators[TAG]  = returnThis;
      if(DEFAULT){
        methods = {
          values:  DEF_VALUES  ? $default : getMethod(VALUES),
          keys:    IS_SET      ? $default : getMethod(KEYS),
          entries: !DEF_VALUES ? $default : getMethod('entries')
        };
        if(FORCED)for(key in methods){
          if(!(key in proto))redefine(proto, key, methods[key]);
        } else $export($export.P + $export.F * (BUGGY || VALUES_BUG), NAME, methods);
      }
      return methods;
    };
  provide("core-js/modules/$.iter-define", module.exports);
}(global));

// pakmanager:core-js/modules/$.iter-step
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  module.exports = function(done, value){
      return {value: value, done: !!done};
    };
  provide("core-js/modules/$.iter-step", module.exports);
}(global));

// pakmanager:core-js/modules/$.set-species
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var global      =  require('core-js/modules/$.global')
      , $           =  require('core-js/modules/
      , DESCRIPTORS =  require('core-js/modules/$.descriptors')
      , SPECIES     =  require('core-js/modules/$.wks')('species');
    
    module.exports = function(KEY){
      var C = global[KEY];
      if(DESCRIPTORS && C && !C[SPECIES])$.setDesc(C, SPECIES, {
        configurable: true,
        get: function(){ return this; }
      });
    };)
      , DESCRIPTORS =  require('core-js/modules/$.descriptors')
      , SPECIES     =  require('core-js/modules/$.wks')('species');
    
    module.exports = function(KEY){
      var C = global[KEY];
      if(DESCRIPTORS && C && !C[SPECIES])$.setDesc(C, SPECIES, {
        configurable: true,
        get: function(){ return this; }
      });
    };
  provide("core-js/modules/$.set-species", module.exports);
}(global));

// pakmanager:core-js/modules/$.iter-detect
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var ITERATOR     =  require('core-js/modules/$.wks')('iterator')
      , SAFE_CLOSING = false;
    
    try {
      var riter = [7][ITERATOR]();
      riter['return'] = function(){ SAFE_CLOSING = true; };
      Array.from(riter, function(){ throw 2; });
    } catch(e){ /* empty */ }
    
    module.exports = function(exec, skipClosing){
      if(!skipClosing && !SAFE_CLOSING)return false;
      var safe = false;
      try {
        var arr  = [7]
          , iter = arr[ITERATOR]();
        iter.next = function(){ return {done: safe = true}; };
        arr[ITERATOR] = function(){ return iter; };
        exec(arr);
      } catch(e){ /* empty */ }
      return safe;
    };
  provide("core-js/modules/$.iter-detect", module.exports);
}(global));

// pakmanager:core-js/modules/$.array-methods
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 0 -> Array#forEach
    // 1 -> Array#map
    // 2 -> Array#filter
    // 3 -> Array#some
    // 4 -> Array#every
    // 5 -> Array#find
    // 6 -> Array#findIndex
    var ctx      =  require('core-js/modules/$.ctx')
      , IObject  =  require('core-js/modules/$.iobject')
      , toObject =  require('core-js/modules/$.to-object')
      , toLength =  require('core-js/modules/$.to-length')
      , asc      =  require('core-js/modules/$.array-species-create');
    module.exports = function(TYPE){
      var IS_MAP        = TYPE == 1
        , IS_FILTER     = TYPE == 2
        , IS_SOME       = TYPE == 3
        , IS_EVERY      = TYPE == 4
        , IS_FIND_INDEX = TYPE == 6
        , NO_HOLES      = TYPE == 5 || IS_FIND_INDEX;
      return function($this, callbackfn, that){
        var O      = toObject($this)
          , self   = IObject(O)
          , f      = ctx(callbackfn, that, 3)
          , length = toLength(self.length)
          , index  = 0
          , result = IS_MAP ? asc($this, length) : IS_FILTER ? asc($this, 0) : undefined
          , val, res;
        for(;length > index; index++)if(NO_HOLES || index in self){
          val = self[index];
          res = f(val, index, O);
          if(TYPE){
            if(IS_MAP)result[index] = res;            // map
            else if(res)switch(TYPE){
              case 3: return true;                    // some
              case 5: return val;                     // find
              case 6: return index;                   // findIndex
              case 2: result.push(val);               // filter
            } else if(IS_EVERY)return false;          // every
          }
        }
        return IS_FIND_INDEX ? -1 : IS_SOME || IS_EVERY ? IS_EVERY : result;
      };
    };
  provide("core-js/modules/$.array-methods", module.exports);
}(global));

// pakmanager:core-js/modules/$.string-repeat
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var toInteger =  require('core-js/modules/$.to-integer')
      , defined   =  require('core-js/modules/$.defined');
    
    module.exports = function repeat(count){
      var str = String(defined(this))
        , res = ''
        , n   = toInteger(count);
      if(n < 0 || n == Infinity)throw RangeError("Count can't be negative");
      for(;n > 0; (n >>>= 1) && (str += str))if(n & 1)res += str;
      return res;
    };
  provide("core-js/modules/$.string-repeat", module.exports);
}(global));

// pakmanager:core-js/modules/$.path
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  module.exports =  require('core-js/modules/$.global');
  provide("core-js/modules/$.path", module.exports);
}(global));

// pakmanager:core-js/modules/$.add-to-unscopables
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 22.1.3.31 Array.prototype[@@unscopables]
    var UNSCOPABLES =  require('core-js/modules/$.wks')('unscopables')
      , ArrayProto  = Array.prototype;
    if(ArrayProto[UNSCOPABLES] == undefined) require('core-js/modules/$.hide')(ArrayProto, UNSCOPABLES, {});
    module.exports = function(key){
      ArrayProto[UNSCOPABLES][key] = true;
    };
  provide("core-js/modules/$.add-to-unscopables", module.exports);
}(global));

// pakmanager:core-js/modules/$.array-includes
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // false -> Array#indexOf
    // true  -> Array#includes
    var toIObject =  require('core-js/modules/$.to-iobject')
      , toLength  =  require('core-js/modules/$.to-length')
      , toIndex   =  require('core-js/modules/$.to-index');
    module.exports = function(IS_INCLUDES){
      return function($this, el, fromIndex){
        var O      = toIObject($this)
          , length = toLength(O.length)
          , index  = toIndex(fromIndex, length)
          , value;
        // Array#includes uses SameValueZero equality algorithm
        if(IS_INCLUDES && el != el)while(length > index){
          value = O[index++];
          if(value != value)return true;
        // Array#toIndex ignores holes, Array#includes - not
        } else for(;length > index; index++)if(IS_INCLUDES || index in O){
          if(O[index] === el)return IS_INCLUDES || index;
        } return !IS_INCLUDES && -1;
      };
    };
  provide("core-js/modules/$.array-includes", module.exports);
}(global));

// pakmanager:core-js/modules/$.keyof
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $         =  require('core-js/modules/
      , toIObject =  require('core-js/modules/$.to-iobject');
    module.exports = function(object, el){
      var O      = toIObject(object)
        , keys   = $.getKeys(O)
        , length = keys.length
        , index  = 0
        , key;
      while(length > index)if(O[key = keys[index++]] === el)return key;
    };)
      , toIObject =  require('core-js/modules/$.to-iobject');
    module.exports = function(object, el){
      var O      = toIObject(object)
        , keys   = $.getKeys(O)
        , length = keys.length
        , index  = 0
        , key;
      while(length > index)if(O[key = keys[index++]] === el)return key;
    };
  provide("core-js/modules/$.keyof", module.exports);
}(global));

// pakmanager:core-js/modules/$.get-names
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // fallback for IE11 buggy Object.getOwnPropertyNames with iframe and window
    var toIObject =  require('core-js/modules/$.to-iobject')
      , getNames  =  require('core-js/modules/.getNames
      , toString  = {}.toString;
    
    var windowNames = typeof window == 'object' && Object.getOwnPropertyNames
      ? Object.getOwnPropertyNames(window) : [];
    
    var getWindowNames = function(it){
      try {
        return getNames(it);
      } catch(e){
        return windowNames.slice();
      }
    };
    
    module.exports.get = function getOwnPropertyNames(it){
      if(windowNames && toString.call(it) == '[object Window]')return getWindowNames(it);
      return getNames(toIObject(it));
    };).getNames
      , toString  = {}.toString;
    
    var windowNames = typeof window == 'object' && Object.getOwnPropertyNames
      ? Object.getOwnPropertyNames(window) : [];
    
    var getWindowNames = function(it){
      try {
        return getNames(it);
      } catch(e){
        return windowNames.slice();
      }
    };
    
    module.exports.get = function getOwnPropertyNames(it){
      if(windowNames && toString.call(it) == '[object Window]')return getWindowNames(it);
      return getNames(toIObject(it));
    };
  provide("core-js/modules/$.get-names", module.exports);
}(global));

// pakmanager:core-js/modules/$.enum-keys
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // all enumerable object keys, includes symbols
    var $ =  require('core-js/modules/;
    module.exports = function(it){
      var keys       = $.getKeys(it)
        , getSymbols = $.getSymbols;
      if(getSymbols){
        var symbols = getSymbols(it)
          , isEnum  = $.isEnum
          , i       = 0
          , key;
        while(symbols.length > i)if(isEnum.call(it, key = symbols[i++]))keys.push(key);
      }
      return keys;
    };);
    module.exports = function(it){
      var keys       = $.getKeys(it)
        , getSymbols = $.getSymbols;
      if(getSymbols){
        var symbols = getSymbols(it)
          , isEnum  = $.isEnum
          , i       = 0
          , key;
        while(symbols.length > i)if(isEnum.call(it, key = symbols[i++]))keys.push(key);
      }
      return keys;
    };
  provide("core-js/modules/$.enum-keys", module.exports);
}(global));

// pakmanager:core-js/modules/$.object-assign
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 19.1.2.1 Object.assign(target, source, ...)
    var $        =  require('core-js/modules/
      , toObject =  require('core-js/modules/$.to-object')
      , IObject  =  require('core-js/modules/$.iobject');
    
    // should work with symbols and should have deterministic property order (V8 bug)
    module.exports =  require('core-js/modules/$.fails')(function(){
      var a = Object.assign
        , A = {}
        , B = {}
        , S = Symbol()
        , K = 'abcdefghijklmnopqrst';
      A[S] = 7;
      K.split('').forEach(function(k){ B[k] = k; });
      return a({}, A)[S] != 7 || Object.keys(a({}, B)).join('') != K;
    }) ? function assign(target, source){ // eslint-disable-line no-unused-vars
      var T     = toObject(target)
        , $$    = arguments
        , $$len = $$.length
        , index = 1
        , getKeys    = $.getKeys
        , getSymbols = $.getSymbols
        , isEnum     = $.isEnum;
      while($$len > index){
        var S      = IObject($$[index++])
          , keys   = getSymbols ? getKeys(S).concat(getSymbols(S)) : getKeys(S)
          , length = keys.length
          , j      = 0
          , key;
        while(length > j)if(isEnum.call(S, key = keys[j++]))T[key] = S[key];
      }
      return T;
    } : Object.assign;)
      , toObject =  require('core-js/modules/$.to-object')
      , IObject  =  require('core-js/modules/$.iobject');
    
    // should work with symbols and should have deterministic property order (V8 bug)
    module.exports =  require('core-js/modules/$.fails')(function(){
      var a = Object.assign
        , A = {}
        , B = {}
        , S = Symbol()
        , K = 'abcdefghijklmnopqrst';
      A[S] = 7;
      K.split('').forEach(function(k){ B[k] = k; });
      return a({}, A)[S] != 7 || Object.keys(a({}, B)).join('') != K;
    }) ? function assign(target, source){ // eslint-disable-line no-unused-vars
      var T     = toObject(target)
        , $$    = arguments
        , $$len = $$.length
        , index = 1
        , getKeys    = $.getKeys
        , getSymbols = $.getSymbols
        , isEnum     = $.isEnum;
      while($$len > index){
        var S      = IObject($$[index++])
          , keys   = getSymbols ? getKeys(S).concat(getSymbols(S)) : getKeys(S)
          , length = keys.length
          , j      = 0
          , key;
        while(length > j)if(isEnum.call(S, key = keys[j++]))T[key] = S[key];
      }
      return T;
    } : Object.assign;
  provide("core-js/modules/$.object-assign", module.exports);
}(global));

// pakmanager:core-js/modules/$.same-value
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 7.2.9 SameValue(x, y)
    module.exports = Object.is || function is(x, y){
      return x === y ? x !== 0 || 1 / x === 1 / y : x != x && y != y;
    };
  provide("core-js/modules/$.same-value", module.exports);
}(global));

// pakmanager:core-js/modules/$.set-proto
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // Works with __proto__ only. Old v8 can't work with null proto objects.
    /* eslint-disable no-proto */
    var getDesc  =  require('core-js/modules/.getDesc
      , isObject =  require('core-js/modules/$.is-object')
      , anObject =  require('core-js/modules/$.an-object');
    var check = function(O, proto){
      anObject(O);
      if(!isObject(proto) && proto !== null)throw TypeError(proto + ": can't set as prototype!");
    };
    module.exports = {
      set: Object.setPrototypeOf || ('__proto__' in {} ? // eslint-disable-line
        function(test, buggy, set){
          try {
            set =  require('core-js/modules/$.ctx')(Function.call, getDesc(Object.prototype, '__proto__').set, 2);
            set(test, []);
            buggy = !(test instanceof Array);
          } catch(e){ buggy = true; }
          return function setPrototypeOf(O, proto){
            check(O, proto);
            if(buggy)O.__proto__ = proto;
            else set(O, proto);
            return O;
          };
        }({}, false) : undefined),
      check: check
    };).getDesc
      , isObject =  require('core-js/modules/$.is-object')
      , anObject =  require('core-js/modules/$.an-object');
    var check = function(O, proto){
      anObject(O);
      if(!isObject(proto) && proto !== null)throw TypeError(proto + ": can't set as prototype!");
    };
    module.exports = {
      set: Object.setPrototypeOf || ('__proto__' in {} ? // eslint-disable-line
        function(test, buggy, set){
          try {
            set =  require('core-js/modules/$.ctx')(Function.call, getDesc(Object.prototype, '__proto__').set, 2);
            set(test, []);
            buggy = !(test instanceof Array);
          } catch(e){ buggy = true; }
          return function setPrototypeOf(O, proto){
            check(O, proto);
            if(buggy)O.__proto__ = proto;
            else set(O, proto);
            return O;
          };
        }({}, false) : undefined),
      check: check
    };
  provide("core-js/modules/$.set-proto", module.exports);
}(global));

// pakmanager:core-js/modules/$.object-sap
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // most Object methods by ES6 should accept primitives
    var $export =  require('core-js/modules/$.export')
      , core    =  require('core-js/modules/$.core')
      , fails   =  require('core-js/modules/$.fails');
    module.exports = function(KEY, exec){
      var fn  = (core.Object || {})[KEY] || Object[KEY]
        , exp = {};
      exp[KEY] = exec(fn);
      $export($export.S + $export.F * fails(function(){ fn(1); }), 'Object', exp);
    };
  provide("core-js/modules/$.object-sap", module.exports);
}(global));

// pakmanager:core-js/modules/$.to-primitive
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 7.1.1 ToPrimitive(input [, PreferredType])
    var isObject =  require('core-js/modules/$.is-object');
    // instead of the ES6 spec version, we didn't implement @@toPrimitive case
    // and the second argument - flag - preferred type is a string
    module.exports = function(it, S){
      if(!isObject(it))return it;
      var fn, val;
      if(S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it)))return val;
      if(typeof (fn = it.valueOf) == 'function' && !isObject(val = fn.call(it)))return val;
      if(!S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it)))return val;
      throw TypeError("Can't convert object to primitive value");
    };
  provide("core-js/modules/$.to-primitive", module.exports);
}(global));

// pakmanager:core-js/modules/$.string-trim
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $export =  require('core-js/modules/$.export')
      , defined =  require('core-js/modules/$.defined')
      , fails   =  require('core-js/modules/$.fails')
      , spaces  = '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003' +
          '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF'
      , space   = '[' + spaces + ']'
      , non     = '\u200b\u0085'
      , ltrim   = RegExp('^' + space + space + '*')
      , rtrim   = RegExp(space + space + '*$');
    
    var exporter = function(KEY, exec){
      var exp  = {};
      exp[KEY] = exec(trim);
      $export($export.P + $export.F * fails(function(){
        return !!spaces[KEY]() || non[KEY]() != non;
      }), 'String', exp);
    };
    
    // 1 -> String#trimLeft
    // 2 -> String#trimRight
    // 3 -> String#trim
    var trim = exporter.trim = function(string, TYPE){
      string = String(defined(string));
      if(TYPE & 1)string = string.replace(ltrim, '');
      if(TYPE & 2)string = string.replace(rtrim, '');
      return string;
    };
    
    module.exports = exporter;
  provide("core-js/modules/$.string-trim", module.exports);
}(global));

// pakmanager:core-js/modules/$.is-integer
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.1.2.3 Number.isInteger(number)
    var isObject =  require('core-js/modules/$.is-object')
      , floor    = Math.floor;
    module.exports = function isInteger(it){
      return !isObject(it) && isFinite(it) && floor(it) === it;
    };
  provide("core-js/modules/$.is-integer", module.exports);
}(global));

// pakmanager:core-js/modules/$.math-log1p
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.20 Math.log1p(x)
    module.exports = Math.log1p || function log1p(x){
      return (x = +x) > -1e-8 && x < 1e-8 ? x - x * x / 2 : Math.log(1 + x);
    };
  provide("core-js/modules/$.math-log1p", module.exports);
}(global));

// pakmanager:core-js/modules/$.math-sign
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.28 Math.sign(x)
    module.exports = Math.sign || function sign(x){
      return (x = +x) == 0 || x != x ? x : x < 0 ? -1 : 1;
    };
  provide("core-js/modules/$.math-sign", module.exports);
}(global));

// pakmanager:core-js/modules/$.math-expm1
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.14 Math.expm1(x)
    module.exports = Math.expm1 || function expm1(x){
      return (x = +x) == 0 ? x : x > -1e-6 && x < 1e-6 ? x + x * x / 2 : Math.exp(x) - 1;
    };
  provide("core-js/modules/$.math-expm1", module.exports);
}(global));

// pakmanager:core-js/modules/$.string-at
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var toInteger =  require('core-js/modules/$.to-integer')
      , defined   =  require('core-js/modules/$.defined');
    // true  -> String#at
    // false -> String#codePointAt
    module.exports = function(TO_STRING){
      return function(that, pos){
        var s = String(defined(that))
          , i = toInteger(pos)
          , l = s.length
          , a, b;
        if(i < 0 || i >= l)return TO_STRING ? '' : undefined;
        a = s.charCodeAt(i);
        return a < 0xd800 || a > 0xdbff || i + 1 === l || (b = s.charCodeAt(i + 1)) < 0xdc00 || b > 0xdfff
          ? TO_STRING ? s.charAt(i) : a
          : TO_STRING ? s.slice(i, i + 2) : (a - 0xd800 << 10) + (b - 0xdc00) + 0x10000;
      };
    };
  provide("core-js/modules/$.string-at", module.exports);
}(global));

// pakmanager:core-js/modules/$.string-context
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // helper for String#{startsWith, endsWith, includes}
    var isRegExp =  require('core-js/modules/$.is-regexp')
      , defined  =  require('core-js/modules/$.defined');
    
    module.exports = function(that, searchString, NAME){
      if(isRegExp(searchString))throw TypeError('String#' + NAME + " doesn't accept regex!");
      return String(defined(that));
    };
  provide("core-js/modules/$.string-context", module.exports);
}(global));

// pakmanager:core-js/modules/$.fails-is-regexp
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var MATCH =  require('core-js/modules/$.wks')('match');
    module.exports = function(KEY){
      var re = /./;
      try {
        '/./'[KEY](re);
      } catch(e){
        try {
          re[MATCH] = false;
          return !'/./'[KEY](re);
        } catch(f){ /* empty */ }
      } return true;
    };
  provide("core-js/modules/$.fails-is-regexp", module.exports);
}(global));

// pakmanager:core-js/modules/$.array-copy-within
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 22.1.3.3 Array.prototype.copyWithin(target, start, end = this.length)
    'use strict';
    var toObject =  require('core-js/modules/$.to-object')
      , toIndex  =  require('core-js/modules/$.to-index')
      , toLength =  require('core-js/modules/$.to-length');
    
    module.exports = [].copyWithin || function copyWithin(target/*= 0*/, start/*= 0, end = @length*/){
      var O     = toObject(this)
        , len   = toLength(O.length)
        , to    = toIndex(target, len)
        , from  = toIndex(start, len)
        , $$    = arguments
        , end   = $$.length > 2 ? $$[2] : undefined
        , count = Math.min((end === undefined ? len : toIndex(end, len)) - from, len - to)
        , inc   = 1;
      if(from < to && to < from + count){
        inc  = -1;
        from += count - 1;
        to   += count - 1;
      }
      while(count-- > 0){
        if(from in O)O[to] = O[from];
        else delete O[to];
        to   += inc;
        from += inc;
      } return O;
    };
  provide("core-js/modules/$.array-copy-within", module.exports);
}(global));

// pakmanager:core-js/modules/$.array-fill
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 22.1.3.6 Array.prototype.fill(value, start = 0, end = this.length)
    'use strict';
    var toObject =  require('core-js/modules/$.to-object')
      , toIndex  =  require('core-js/modules/$.to-index')
      , toLength =  require('core-js/modules/$.to-length');
    module.exports = [].fill || function fill(value /*, start = 0, end = @length */){
      var O      = toObject(this)
        , length = toLength(O.length)
        , $$     = arguments
        , $$len  = $$.length
        , index  = toIndex($$len > 1 ? $$[1] : undefined, length)
        , end    = $$len > 2 ? $$[2] : undefined
        , endPos = end === undefined ? length : toIndex(end, length);
      while(endPos > index)O[index++] = value;
      return O;
    };
  provide("core-js/modules/$.array-fill", module.exports);
}(global));

// pakmanager:core-js/modules/$.flags
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    // 21.2.5.3 get RegExp.prototype.flags
    var anObject =  require('core-js/modules/$.an-object');
    module.exports = function(){
      var that   = anObject(this)
        , result = '';
      if(that.global)     result += 'g';
      if(that.ignoreCase) result += 'i';
      if(that.multiline)  result += 'm';
      if(that.unicode)    result += 'u';
      if(that.sticky)     result += 'y';
      return result;
    };
  provide("core-js/modules/$.flags", module.exports);
}(global));

// pakmanager:core-js/modules/$.fix-re-wks
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var hide     =  require('core-js/modules/$.hide')
      , redefine =  require('core-js/modules/$.redefine')
      , fails    =  require('core-js/modules/$.fails')
      , defined  =  require('core-js/modules/$.defined')
      , wks      =  require('core-js/modules/$.wks');
    
    module.exports = function(KEY, length, exec){
      var SYMBOL   = wks(KEY)
        , original = ''[KEY];
      if(fails(function(){
        var O = {};
        O[SYMBOL] = function(){ return 7; };
        return ''[KEY](O) != 7;
      })){
        redefine(String.prototype, KEY, exec(defined, SYMBOL, original));
        hide(RegExp.prototype, SYMBOL, length == 2
          // 21.2.5.8 RegExp.prototype[@@replace](string, replaceValue)
          // 21.2.5.11 RegExp.prototype[@@split](string, limit)
          ? function(string, arg){ return original.call(string, this, arg); }
          // 21.2.5.6 RegExp.prototype[@@match](string)
          // 21.2.5.9 RegExp.prototype[@@search](string)
          : function(string){ return original.call(string, this); }
        );
      }
    };
  provide("core-js/modules/$.fix-re-wks", module.exports);
}(global));

// pakmanager:core-js/modules/$.species-constructor
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 7.3.20 SpeciesConstructor(O, defaultConstructor)
    var anObject  =  require('core-js/modules/$.an-object')
      , aFunction =  require('core-js/modules/$.a-function')
      , SPECIES   =  require('core-js/modules/$.wks')('species');
    module.exports = function(O, D){
      var C = anObject(O).constructor, S;
      return C === undefined || (S = anObject(C)[SPECIES]) == undefined ? D : aFunction(S);
    };
  provide("core-js/modules/$.species-constructor", module.exports);
}(global));

// pakmanager:core-js/modules/$.microtask
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var global    =  require('core-js/modules/$.global')
      , macrotask =  require('core-js/modules/$.task').set
      , Observer  = global.MutationObserver || global.WebKitMutationObserver
      , process   = global.process
      , Promise   = global.Promise
      , isNode    =  require('core-js/modules/$.cof')(process) == 'process'
      , head, last, notify;
    
    var flush = function(){
      var parent, domain, fn;
      if(isNode && (parent = process.domain)){
        process.domain = null;
        parent.exit();
      }
      while(head){
        domain = head.domain;
        fn     = head.fn;
        if(domain)domain.enter();
        fn(); // <- currently we use it only for Promise - try / catch not required
        if(domain)domain.exit();
        head = head.next;
      } last = undefined;
      if(parent)parent.enter();
    };
    
    // Node.js
    if(isNode){
      notify = function(){
        process.nextTick(flush);
      };
    // browsers with MutationObserver
    } else if(Observer){
      var toggle = 1
        , node   = document.createTextNode('');
      new Observer(flush).observe(node, {characterData: true}); // eslint-disable-line no-new
      notify = function(){
        node.data = toggle = -toggle;
      };
    // environments with maybe non-completely correct, but existent Promise
    } else if(Promise && Promise.resolve){
      notify = function(){
        Promise.resolve().then(flush);
      };
    // for other environments - macrotask based on:
    // - setImmediate
    // - MessageChannel
    // - window.postMessag
    // - onreadystatechange
    // - setTimeout
    } else {
      notify = function(){
        // strange IE + webpack dev server bug - use .call(global)
        macrotask.call(global, flush);
      };
    }
    
    module.exports = function asap(fn){
      var task = {fn: fn, next: undefined, domain: isNode && process.domain};
      if(last)last.next = task;
      if(!head){
        head = task;
        notify();
      } last = task;
    };
  provide("core-js/modules/$.microtask", module.exports);
}(global));

// pakmanager:core-js/modules/$.collection-strong
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $            =  require('core-js/modules/
      , hide         =  require('core-js/modules/$.hide')
      , redefineAll  =  require('core-js/modules/$.redefine-all')
      , ctx          =  require('core-js/modules/$.ctx')
      , strictNew    =  require('core-js/modules/$.strict-new')
      , defined      =  require('core-js/modules/$.defined')
      , forOf        =  require('core-js/modules/$.for-of')
      , $iterDefine  =  require('core-js/modules/$.iter-define')
      , step         =  require('core-js/modules/$.iter-step')
      , ID           =  require('core-js/modules/$.uid')('id')
      , $has         =  require('core-js/modules/$.has')
      , isObject     =  require('core-js/modules/$.is-object')
      , setSpecies   =  require('core-js/modules/$.set-species')
      , DESCRIPTORS  =  require('core-js/modules/$.descriptors')
      , isExtensible = Object.isExtensible || isObject
      , SIZE         = DESCRIPTORS ? '_s' : 'size'
      , id           = 0;
    
    var fastKey = function(it, create){
      // return primitive with prefix
      if(!isObject(it))return typeof it == 'symbol' ? it : (typeof it == 'string' ? 'S' : 'P') + it;
      if(!$has(it, ID)){
        // can't set id to frozen object
        if(!isExtensible(it))return 'F';
        // not necessary to add id
        if(!create)return 'E';
        // add missing object id
        hide(it, ID, ++id);
      // return object id with prefix
      } return 'O' + it[ID];
    };
    
    var getEntry = function(that, key){
      // fast case
      var index = fastKey(key), entry;
      if(index !== 'F')return that._i[index];
      // frozen object case
      for(entry = that._f; entry; entry = entry.n){
        if(entry.k == key)return entry;
      }
    };
    
    module.exports = {
      getConstructor: function(wrapper, NAME, IS_MAP, ADDER){
        var C = wrapper(function(that, iterable){
          strictNew(that, C, NAME);
          that._i = $.create(null); // index
          that._f = undefined;      // first entry
          that._l = undefined;      // last entry
          that[SIZE] = 0;           // size
          if(iterable != undefined)forOf(iterable, IS_MAP, that[ADDER], that);
        });
        redefineAll(C.prototype, {
          // 23.1.3.1 Map.prototype.clear()
          // 23.2.3.2 Set.prototype.clear()
          clear: function clear(){
            for(var that = this, data = that._i, entry = that._f; entry; entry = entry.n){
              entry.r = true;
              if(entry.p)entry.p = entry.p.n = undefined;
              delete data[entry.i];
            }
            that._f = that._l = undefined;
            that[SIZE] = 0;
          },
          // 23.1.3.3 Map.prototype.delete(key)
          // 23.2.3.4 Set.prototype.delete(value)
          'delete': function(key){
            var that  = this
              , entry = getEntry(that, key);
            if(entry){
              var next = entry.n
                , prev = entry.p;
              delete that._i[entry.i];
              entry.r = true;
              if(prev)prev.n = next;
              if(next)next.p = prev;
              if(that._f == entry)that._f = next;
              if(that._l == entry)that._l = prev;
              that[SIZE]--;
            } return !!entry;
          },
          // 23.2.3.6 Set.prototype.forEach(callbackfn, thisArg = undefined)
          // 23.1.3.5 Map.prototype.forEach(callbackfn, thisArg = undefined)
          forEach: function forEach(callbackfn /*, that = undefined */){
            var f = ctx(callbackfn, arguments.length > 1 ? arguments[1] : undefined, 3)
              , entry;
            while(entry = entry ? entry.n : this._f){
              f(entry.v, entry.k, this);
              // revert to the last existing entry
              while(entry && entry.r)entry = entry.p;
            }
          },
          // 23.1.3.7 Map.prototype.has(key)
          // 23.2.3.7 Set.prototype.has(value)
          has: function has(key){
            return !!getEntry(this, key);
          }
        });
        if(DESCRIPTORS)$.setDesc(C.prototype, 'size', {
          get: function(){
            return defined(this[SIZE]);
          }
        });
        return C;
      },
      def: function(that, key, value){
        var entry = getEntry(that, key)
          , prev, index;
        // change existing entry
        if(entry){
          entry.v = value;
        // create new entry
        } else {
          that._l = entry = {
            i: index = fastKey(key, true), // <- index
            k: key,                        // <- key
            v: value,                      // <- value
            p: prev = that._l,             // <- previous entry
            n: undefined,                  // <- next entry
            r: false                       // <- removed
          };
          if(!that._f)that._f = entry;
          if(prev)prev.n = entry;
          that[SIZE]++;
          // add to index
          if(index !== 'F')that._i[index] = entry;
        } return that;
      },
      getEntry: getEntry,
      setStrong: function(C, NAME, IS_MAP){
        // add .keys, .values, .entries, [@@iterator]
        // 23.1.3.4, 23.1.3.8, 23.1.3.11, 23.1.3.12, 23.2.3.5, 23.2.3.8, 23.2.3.10, 23.2.3.11
        $iterDefine(C, NAME, function(iterated, kind){
          this._t = iterated;  // target
          this._k = kind;      // kind
          this._l = undefined; // previous
        }, function(){
          var that  = this
            , kind  = that._k
            , entry = that._l;
          // revert to the last existing entry
          while(entry && entry.r)entry = entry.p;
          // get next entry
          if(!that._t || !(that._l = entry = entry ? entry.n : that._t._f)){
            // or finish the iteration
            that._t = undefined;
            return step(1);
          }
          // return step by kind
          if(kind == 'keys'  )return step(0, entry.k);
          if(kind == 'values')return step(0, entry.v);
          return step(0, [entry.k, entry.v]);
        }, IS_MAP ? 'entries' : 'values' , !IS_MAP, true);
    
        // add [@@species], 23.1.2.2, 23.2.2.2
        setSpecies(NAME);
      }
    };)
      , hide         =  require('core-js/modules/$.hide')
      , redefineAll  =  require('core-js/modules/$.redefine-all')
      , ctx          =  require('core-js/modules/$.ctx')
      , strictNew    =  require('core-js/modules/$.strict-new')
      , defined      =  require('core-js/modules/$.defined')
      , forOf        =  require('core-js/modules/$.for-of')
      , $iterDefine  =  require('core-js/modules/$.iter-define')
      , step         =  require('core-js/modules/$.iter-step')
      , ID           =  require('core-js/modules/$.uid')('id')
      , $has         =  require('core-js/modules/$.has')
      , isObject     =  require('core-js/modules/$.is-object')
      , setSpecies   =  require('core-js/modules/$.set-species')
      , DESCRIPTORS  =  require('core-js/modules/$.descriptors')
      , isExtensible = Object.isExtensible || isObject
      , SIZE         = DESCRIPTORS ? '_s' : 'size'
      , id           = 0;
    
    var fastKey = function(it, create){
      // return primitive with prefix
      if(!isObject(it))return typeof it == 'symbol' ? it : (typeof it == 'string' ? 'S' : 'P') + it;
      if(!$has(it, ID)){
        // can't set id to frozen object
        if(!isExtensible(it))return 'F';
        // not necessary to add id
        if(!create)return 'E';
        // add missing object id
        hide(it, ID, ++id);
      // return object id with prefix
      } return 'O' + it[ID];
    };
    
    var getEntry = function(that, key){
      // fast case
      var index = fastKey(key), entry;
      if(index !== 'F')return that._i[index];
      // frozen object case
      for(entry = that._f; entry; entry = entry.n){
        if(entry.k == key)return entry;
      }
    };
    
    module.exports = {
      getConstructor: function(wrapper, NAME, IS_MAP, ADDER){
        var C = wrapper(function(that, iterable){
          strictNew(that, C, NAME);
          that._i = $.create(null); // index
          that._f = undefined;      // first entry
          that._l = undefined;      // last entry
          that[SIZE] = 0;           // size
          if(iterable != undefined)forOf(iterable, IS_MAP, that[ADDER], that);
        });
        redefineAll(C.prototype, {
          // 23.1.3.1 Map.prototype.clear()
          // 23.2.3.2 Set.prototype.clear()
          clear: function clear(){
            for(var that = this, data = that._i, entry = that._f; entry; entry = entry.n){
              entry.r = true;
              if(entry.p)entry.p = entry.p.n = undefined;
              delete data[entry.i];
            }
            that._f = that._l = undefined;
            that[SIZE] = 0;
          },
          // 23.1.3.3 Map.prototype.delete(key)
          // 23.2.3.4 Set.prototype.delete(value)
          'delete': function(key){
            var that  = this
              , entry = getEntry(that, key);
            if(entry){
              var next = entry.n
                , prev = entry.p;
              delete that._i[entry.i];
              entry.r = true;
              if(prev)prev.n = next;
              if(next)next.p = prev;
              if(that._f == entry)that._f = next;
              if(that._l == entry)that._l = prev;
              that[SIZE]--;
            } return !!entry;
          },
          // 23.2.3.6 Set.prototype.forEach(callbackfn, thisArg = undefined)
          // 23.1.3.5 Map.prototype.forEach(callbackfn, thisArg = undefined)
          forEach: function forEach(callbackfn /*, that = undefined */){
            var f = ctx(callbackfn, arguments.length > 1 ? arguments[1] : undefined, 3)
              , entry;
            while(entry = entry ? entry.n : this._f){
              f(entry.v, entry.k, this);
              // revert to the last existing entry
              while(entry && entry.r)entry = entry.p;
            }
          },
          // 23.1.3.7 Map.prototype.has(key)
          // 23.2.3.7 Set.prototype.has(value)
          has: function has(key){
            return !!getEntry(this, key);
          }
        });
        if(DESCRIPTORS)$.setDesc(C.prototype, 'size', {
          get: function(){
            return defined(this[SIZE]);
          }
        });
        return C;
      },
      def: function(that, key, value){
        var entry = getEntry(that, key)
          , prev, index;
        // change existing entry
        if(entry){
          entry.v = value;
        // create new entry
        } else {
          that._l = entry = {
            i: index = fastKey(key, true), // <- index
            k: key,                        // <- key
            v: value,                      // <- value
            p: prev = that._l,             // <- previous entry
            n: undefined,                  // <- next entry
            r: false                       // <- removed
          };
          if(!that._f)that._f = entry;
          if(prev)prev.n = entry;
          that[SIZE]++;
          // add to index
          if(index !== 'F')that._i[index] = entry;
        } return that;
      },
      getEntry: getEntry,
      setStrong: function(C, NAME, IS_MAP){
        // add .keys, .values, .entries, [@@iterator]
        // 23.1.3.4, 23.1.3.8, 23.1.3.11, 23.1.3.12, 23.2.3.5, 23.2.3.8, 23.2.3.10, 23.2.3.11
        $iterDefine(C, NAME, function(iterated, kind){
          this._t = iterated;  // target
          this._k = kind;      // kind
          this._l = undefined; // previous
        }, function(){
          var that  = this
            , kind  = that._k
            , entry = that._l;
          // revert to the last existing entry
          while(entry && entry.r)entry = entry.p;
          // get next entry
          if(!that._t || !(that._l = entry = entry ? entry.n : that._t._f)){
            // or finish the iteration
            that._t = undefined;
            return step(1);
          }
          // return step by kind
          if(kind == 'keys'  )return step(0, entry.k);
          if(kind == 'values')return step(0, entry.v);
          return step(0, [entry.k, entry.v]);
        }, IS_MAP ? 'entries' : 'values' , !IS_MAP, true);
    
        // add [@@species], 23.1.2.2, 23.2.2.2
        setSpecies(NAME);
      }
    };
  provide("core-js/modules/$.collection-strong", module.exports);
}(global));

// pakmanager:core-js/modules/$.collection
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var global         =  require('core-js/modules/$.global')
      , $export        =  require('core-js/modules/$.export')
      , redefine       =  require('core-js/modules/$.redefine')
      , redefineAll    =  require('core-js/modules/$.redefine-all')
      , forOf          =  require('core-js/modules/$.for-of')
      , strictNew      =  require('core-js/modules/$.strict-new')
      , isObject       =  require('core-js/modules/$.is-object')
      , fails          =  require('core-js/modules/$.fails')
      , $iterDetect    =  require('core-js/modules/$.iter-detect')
      , setToStringTag =  require('core-js/modules/$.set-to-string-tag');
    
    module.exports = function(NAME, wrapper, methods, common, IS_MAP, IS_WEAK){
      var Base  = global[NAME]
        , C     = Base
        , ADDER = IS_MAP ? 'set' : 'add'
        , proto = C && C.prototype
        , O     = {};
      var fixMethod = function(KEY){
        var fn = proto[KEY];
        redefine(proto, KEY,
          KEY == 'delete' ? function(a){
            return IS_WEAK && !isObject(a) ? false : fn.call(this, a === 0 ? 0 : a);
          } : KEY == 'has' ? function has(a){
            return IS_WEAK && !isObject(a) ? false : fn.call(this, a === 0 ? 0 : a);
          } : KEY == 'get' ? function get(a){
            return IS_WEAK && !isObject(a) ? undefined : fn.call(this, a === 0 ? 0 : a);
          } : KEY == 'add' ? function add(a){ fn.call(this, a === 0 ? 0 : a); return this; }
            : function set(a, b){ fn.call(this, a === 0 ? 0 : a, b); return this; }
        );
      };
      if(typeof C != 'function' || !(IS_WEAK || proto.forEach && !fails(function(){
        new C().entries().next();
      }))){
        // create collection constructor
        C = common.getConstructor(wrapper, NAME, IS_MAP, ADDER);
        redefineAll(C.prototype, methods);
      } else {
        var instance             = new C
          // early implementations not supports chaining
          , HASNT_CHAINING       = instance[ADDER](IS_WEAK ? {} : -0, 1) != instance
          // V8 ~  Chromium 40- weak-collections throws on primitives, but should return false
          , THROWS_ON_PRIMITIVES = fails(function(){ instance.has(1); })
          // most early implementations doesn't supports iterables, most modern - not close it correctly
          , ACCEPT_ITERABLES     = $iterDetect(function(iter){ new C(iter); }) // eslint-disable-line no-new
          // for early implementations -0 and +0 not the same
          , BUGGY_ZERO;
        if(!ACCEPT_ITERABLES){ 
          C = wrapper(function(target, iterable){
            strictNew(target, C, NAME);
            var that = new Base;
            if(iterable != undefined)forOf(iterable, IS_MAP, that[ADDER], that);
            return that;
          });
          C.prototype = proto;
          proto.constructor = C;
        }
        IS_WEAK || instance.forEach(function(val, key){
          BUGGY_ZERO = 1 / key === -Infinity;
        });
        if(THROWS_ON_PRIMITIVES || BUGGY_ZERO){
          fixMethod('delete');
          fixMethod('has');
          IS_MAP && fixMethod('get');
        }
        if(BUGGY_ZERO || HASNT_CHAINING)fixMethod(ADDER);
        // weak collections should not contains .clear method
        if(IS_WEAK && proto.clear)delete proto.clear;
      }
    
      setToStringTag(C, NAME);
    
      O[NAME] = C;
      $export($export.G + $export.W + $export.F * (C != Base), O);
    
      if(!IS_WEAK)common.setStrong(C, NAME, IS_MAP);
    
      return C;
    };
  provide("core-js/modules/$.collection", module.exports);
}(global));

// pakmanager:core-js/modules/$.collection-weak
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var hide              =  require('core-js/modules/$.hide')
      , redefineAll       =  require('core-js/modules/$.redefine-all')
      , anObject          =  require('core-js/modules/$.an-object')
      , isObject          =  require('core-js/modules/$.is-object')
      , strictNew         =  require('core-js/modules/$.strict-new')
      , forOf             =  require('core-js/modules/$.for-of')
      , createArrayMethod =  require('core-js/modules/$.array-methods')
      , $has              =  require('core-js/modules/$.has')
      , WEAK              =  require('core-js/modules/$.uid')('weak')
      , isExtensible      = Object.isExtensible || isObject
      , arrayFind         = createArrayMethod(5)
      , arrayFindIndex    = createArrayMethod(6)
      , id                = 0;
    
    // fallback for frozen keys
    var frozenStore = function(that){
      return that._l || (that._l = new FrozenStore);
    };
    var FrozenStore = function(){
      this.a = [];
    };
    var findFrozen = function(store, key){
      return arrayFind(store.a, function(it){
        return it[0] === key;
      });
    };
    FrozenStore.prototype = {
      get: function(key){
        var entry = findFrozen(this, key);
        if(entry)return entry[1];
      },
      has: function(key){
        return !!findFrozen(this, key);
      },
      set: function(key, value){
        var entry = findFrozen(this, key);
        if(entry)entry[1] = value;
        else this.a.push([key, value]);
      },
      'delete': function(key){
        var index = arrayFindIndex(this.a, function(it){
          return it[0] === key;
        });
        if(~index)this.a.splice(index, 1);
        return !!~index;
      }
    };
    
    module.exports = {
      getConstructor: function(wrapper, NAME, IS_MAP, ADDER){
        var C = wrapper(function(that, iterable){
          strictNew(that, C, NAME);
          that._i = id++;      // collection id
          that._l = undefined; // leak store for frozen objects
          if(iterable != undefined)forOf(iterable, IS_MAP, that[ADDER], that);
        });
        redefineAll(C.prototype, {
          // 23.3.3.2 WeakMap.prototype.delete(key)
          // 23.4.3.3 WeakSet.prototype.delete(value)
          'delete': function(key){
            if(!isObject(key))return false;
            if(!isExtensible(key))return frozenStore(this)['delete'](key);
            return $has(key, WEAK) && $has(key[WEAK], this._i) && delete key[WEAK][this._i];
          },
          // 23.3.3.4 WeakMap.prototype.has(key)
          // 23.4.3.4 WeakSet.prototype.has(value)
          has: function has(key){
            if(!isObject(key))return false;
            if(!isExtensible(key))return frozenStore(this).has(key);
            return $has(key, WEAK) && $has(key[WEAK], this._i);
          }
        });
        return C;
      },
      def: function(that, key, value){
        if(!isExtensible(anObject(key))){
          frozenStore(that).set(key, value);
        } else {
          $has(key, WEAK) || hide(key, WEAK, {});
          key[WEAK][that._i] = value;
        } return that;
      },
      frozenStore: frozenStore,
      WEAK: WEAK
    };
  provide("core-js/modules/$.collection-weak", module.exports);
}(global));

// pakmanager:core-js/modules/$.own-keys
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // all object keys, includes non-enumerable and symbols
    var $        =  require('core-js/modules/
      , anObject =  require('core-js/modules/$.an-object')
      , Reflect  =  require('core-js/modules/$.global').Reflect;
    module.exports = Reflect && Reflect.ownKeys || function ownKeys(it){
      var keys       = $.getNames(anObject(it))
        , getSymbols = $.getSymbols;
      return getSymbols ? keys.concat(getSymbols(it)) : keys;
    };)
      , anObject =  require('core-js/modules/$.an-object')
      , Reflect  =  require('core-js/modules/$.global').Reflect;
    module.exports = Reflect && Reflect.ownKeys || function ownKeys(it){
      var keys       = $.getNames(anObject(it))
        , getSymbols = $.getSymbols;
      return getSymbols ? keys.concat(getSymbols(it)) : keys;
    };
  provide("core-js/modules/$.own-keys", module.exports);
}(global));

// pakmanager:core-js/modules/$.string-pad
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // https://github.com/ljharb/proposal-string-pad-left-right
    var toLength =  require('core-js/modules/$.to-length')
      , repeat   =  require('core-js/modules/$.string-repeat')
      , defined  =  require('core-js/modules/$.defined');
    
    module.exports = function(that, maxLength, fillString, left){
      var S            = String(defined(that))
        , stringLength = S.length
        , fillStr      = fillString === undefined ? ' ' : String(fillString)
        , intMaxLength = toLength(maxLength);
      if(intMaxLength <= stringLength)return S;
      if(fillStr == '')fillStr = ' ';
      var fillLen = intMaxLength - stringLength
        , stringFiller = repeat.call(fillStr, Math.ceil(fillLen / fillStr.length));
      if(stringFiller.length > fillLen)stringFiller = stringFiller.slice(0, fillLen);
      return left ? stringFiller + S : S + stringFiller;
    };
  provide("core-js/modules/$.string-pad", module.exports);
}(global));

// pakmanager:core-js/modules/$.replacer
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  module.exports = function(regExp, replace){
      var replacer = replace === Object(replace) ? function(part){
        return replace[part];
      } : replace;
      return function(it){
        return String(it).replace(regExp, replacer);
      };
    };
  provide("core-js/modules/$.replacer", module.exports);
}(global));

// pakmanager:core-js/modules/$.object-to-array
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $         =  require('core-js/modules/
      , toIObject =  require('core-js/modules/$.to-iobject')
      , isEnum    = $.isEnum;
    module.exports = function(isEntries){
      return function(it){
        var O      = toIObject(it)
          , keys   = $.getKeys(O)
          , length = keys.length
          , i      = 0
          , result = []
          , key;
        while(length > i)if(isEnum.call(O, key = keys[i++])){
          result.push(isEntries ? [key, O[key]] : O[key]);
        } return result;
      };
    };)
      , toIObject =  require('core-js/modules/$.to-iobject')
      , isEnum    = $.isEnum;
    module.exports = function(isEntries){
      return function(it){
        var O      = toIObject(it)
          , keys   = $.getKeys(O)
          , length = keys.length
          , i      = 0
          , result = []
          , key;
        while(length > i)if(isEnum.call(O, key = keys[i++])){
          result.push(isEntries ? [key, O[key]] : O[key]);
        } return result;
      };
    };
  provide("core-js/modules/$.object-to-array", module.exports);
}(global));

// pakmanager:core-js/modules/$.collection-to-json
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // https://github.com/DavidBruant/Map-Set.prototype.toJSON
    var forOf   =  require('core-js/modules/$.for-of')
      , classof =  require('core-js/modules/$.classof');
    module.exports = function(NAME){
      return function toJSON(){
        if(classof(this) != NAME)throw TypeError(NAME + "#toJSON isn't generic");
        var arr = [];
        forOf(this, false, arr.push, arr);
        return arr;
      };
    };
  provide("core-js/modules/$.collection-to-json", module.exports);
}(global));

// pakmanager:core-js/modules/$.partial
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var path      =  require('core-js/modules/$.path')
      , invoke    =  require('core-js/modules/$.invoke')
      , aFunction =  require('core-js/modules/$.a-function');
    module.exports = function(/* ...pargs */){
      var fn     = aFunction(this)
        , length = arguments.length
        , pargs  = Array(length)
        , i      = 0
        , _      = path._
        , holder = false;
      while(length > i)if((pargs[i] = arguments[i++]) === _)holder = true;
      return function(/* ...args */){
        var that  = this
          , $$    = arguments
          , $$len = $$.length
          , j = 0, k = 0, args;
        if(!holder && !$$len)return invoke(fn, pargs, that);
        args = pargs.slice();
        if(holder)for(;length > j; j++)if(args[j] === _)args[j] = $$[k++];
        while($$len > k)args.push($$[k++]);
        return invoke(fn, args, that);
      };
    };
  provide("core-js/modules/$.partial", module.exports);
}(global));

// pakmanager:core-js/modules/es6.array.iterator
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var addToUnscopables =  require('core-js/modules/$.add-to-unscopables')
      , step             =  require('core-js/modules/$.iter-step')
      , Iterators        =  require('core-js/modules/$.iterators')
      , toIObject        =  require('core-js/modules/$.to-iobject');
    
    // 22.1.3.4 Array.prototype.entries()
    // 22.1.3.13 Array.prototype.keys()
    // 22.1.3.29 Array.prototype.values()
    // 22.1.3.30 Array.prototype[@@iterator]()
    module.exports =  require('core-js/modules/$.iter-define')(Array, 'Array', function(iterated, kind){
      this._t = toIObject(iterated); // target
      this._i = 0;                   // next index
      this._k = kind;                // kind
    // 22.1.5.2.1 %ArrayIteratorPrototype%.next()
    }, function(){
      var O     = this._t
        , kind  = this._k
        , index = this._i++;
      if(!O || index >= O.length){
        this._t = undefined;
        return step(1);
      }
      if(kind == 'keys'  )return step(0, index);
      if(kind == 'values')return step(0, O[index]);
      return step(0, [index, O[index]]);
    }, 'values');
    
    // argumentsList[@@iterator] is %ArrayProto_values% (9.4.4.6, 9.4.4.7)
    Iterators.Arguments = Iterators.Array;
    
    addToUnscopables('keys');
    addToUnscopables('values');
    addToUnscopables('entries');
  provide("core-js/modules/es6.array.iterator", module.exports);
}(global));

// pakmanager:core-js/modules/es5
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $                 =  require('core-js/modules/
      , $export           =  require('core-js/modules/$.export')
      , DESCRIPTORS       =  require('core-js/modules/$.descriptors')
      , createDesc        =  require('core-js/modules/$.property-desc')
      , html              =  require('core-js/modules/$.html')
      , cel               =  require('core-js/modules/$.dom-create')
      , has               =  require('core-js/modules/$.has')
      , cof               =  require('core-js/modules/$.cof')
      , invoke            =  require('core-js/modules/$.invoke')
      , fails             =  require('core-js/modules/$.fails')
      , anObject          =  require('core-js/modules/$.an-object')
      , aFunction         =  require('core-js/modules/$.a-function')
      , isObject          =  require('core-js/modules/$.is-object')
      , toObject          =  require('core-js/modules/$.to-object')
      , toIObject         =  require('core-js/modules/$.to-iobject')
      , toInteger         =  require('core-js/modules/$.to-integer')
      , toIndex           =  require('core-js/modules/$.to-index')
      , toLength          =  require('core-js/modules/$.to-length')
      , IObject           =  require('core-js/modules/$.iobject')
      , IE_PROTO          =  require('core-js/modules/$.uid')('__proto__')
      , createArrayMethod =  require('core-js/modules/$.array-methods')
      , arrayIndexOf      =  require('core-js/modules/$.array-includes')(false)
      , ObjectProto       = Object.prototype
      , ArrayProto        = Array.prototype
      , arraySlice        = ArrayProto.slice
      , arrayJoin         = ArrayProto.join
      , defineProperty    = $.setDesc
      , getOwnDescriptor  = $.getDesc
      , defineProperties  = $.setDescs
      , factories         = {}
      , IE8_DOM_DEFINE;
    
    if(!DESCRIPTORS){
      IE8_DOM_DEFINE = !fails(function(){
        return defineProperty(cel('div'), 'a', {get: function(){ return 7; }}).a != 7;
      });
      $.setDesc = function(O, P, Attributes){
        if(IE8_DOM_DEFINE)try {
          return defineProperty(O, P, Attributes);
        } catch(e){ /* empty */ }
        if('get' in Attributes || 'set' in Attributes)throw TypeError('Accessors not supported!');
        if('value' in Attributes)anObject(O)[P] = Attributes.value;
        return O;
      };
      $.getDesc = function(O, P){
        if(IE8_DOM_DEFINE)try {
          return getOwnDescriptor(O, P);
        } catch(e){ /* empty */ }
        if(has(O, P))return createDesc(!ObjectProto.propertyIsEnumerable.call(O, P), O[P]);
      };
      $.setDescs = defineProperties = function(O, Properties){
        anObject(O);
        var keys   = $.getKeys(Properties)
          , length = keys.length
          , i = 0
          , P;
        while(length > i)$.setDesc(O, P = keys[i++], Properties[P]);
        return O;
      };
    }
    $export($export.S + $export.F * !DESCRIPTORS, 'Object', {
      // 19.1.2.6 / 15.2.3.3 Object.getOwnPropertyDescriptor(O, P)
      getOwnPropertyDescriptor: $.getDesc,
      // 19.1.2.4 / 15.2.3.6 Object.defineProperty(O, P, Attributes)
      defineProperty: $.setDesc,
      // 19.1.2.3 / 15.2.3.7 Object.defineProperties(O, Properties)
      defineProperties: defineProperties
    });
    
      // IE 8- don't enum bug keys
    var keys1 = ('constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,' +
                'toLocaleString,toString,valueOf').split(',')
      // Additional keys for getOwnPropertyNames
      , keys2 = keys1.concat('length', 'prototype')
      , keysLen1 = keys1.length;
    
    // Create object with `null` prototype: use iframe Object with cleared prototype
    var createDict = function(){
      // Thrash, waste and sodomy: IE GC bug
      var iframe = cel('iframe')
        , i      = keysLen1
        , gt     = '>'
        , iframeDocument;
      iframe.style.display = 'none';
      html.appendChild(iframe);
      iframe.src = 'javascript:'; // eslint-disable-line no-script-url
      // createDict = iframe.contentWindow.Object;
      // html.removeChild(iframe);
      iframeDocument = iframe.contentWindow.document;
      iframeDocument.open();
      iframeDocument.write('<script>document.F=Object</script' + gt);
      iframeDocument.close();
      createDict = iframeDocument.F;
      while(i--)delete createDict.prototype[keys1[i]];
      return createDict();
    };
    var createGetKeys = function(names, length){
      return function(object){
        var O      = toIObject(object)
          , i      = 0
          , result = []
          , key;
        for(key in O)if(key != IE_PROTO)has(O, key) && result.push(key);
        // Don't enum bug & hidden keys
        while(length > i)if(has(O, key = names[i++])){
          ~arrayIndexOf(result, key) || result.push(key);
        }
        return result;
      };
    };
    var Empty = function(){};
    $export($export.S, 'Object', {
      // 19.1.2.9 / 15.2.3.2 Object.getPrototypeOf(O)
      getPrototypeOf: $.getProto = $.getProto || function(O){
        O = toObject(O);
        if(has(O, IE_PROTO))return O[IE_PROTO];
        if(typeof O.constructor == 'function' && O instanceof O.constructor){
          return O.constructor.prototype;
        } return O instanceof Object ? ObjectProto : null;
      },
      // 19.1.2.7 / 15.2.3.4 Object.getOwnPropertyNames(O)
      getOwnPropertyNames: $.getNames = $.getNames || createGetKeys(keys2, keys2.length, true),
      // 19.1.2.2 / 15.2.3.5 Object.create(O [, Properties])
      create: $.create = $.create || function(O, /*?*/Properties){
        var result;
        if(O !== null){
          Empty.prototype = anObject(O);
          result = new Empty();
          Empty.prototype = null;
          // add "__proto__" for Object.getPrototypeOf shim
          result[IE_PROTO] = O;
        } else result = createDict();
        return Properties === undefined ? result : defineProperties(result, Properties);
      },
      // 19.1.2.14 / 15.2.3.14 Object.keys(O)
      keys: $.getKeys = $.getKeys || createGetKeys(keys1, keysLen1, false)
    });
    
    var construct = function(F, len, args){
      if(!(len in factories)){
        for(var n = [], i = 0; i < len; i++)n[i] = 'a[' + i + ']';
        factories[len] = Function('F,a', 'return new F(' + n.join(',') + ')');
      }
      return factories[len](F, args);
    };
    
    // 19.2.3.2 / 15.3.4.5 Function.prototype.bind(thisArg, args...)
    $export($export.P, 'Function', {
      bind: function bind(that /*, args... */){
        var fn       = aFunction(this)
          , partArgs = arraySlice.call(arguments, 1);
        var bound = function(/* args... */){
          var args = partArgs.concat(arraySlice.call(arguments));
          return this instanceof bound ? construct(fn, args.length, args) : invoke(fn, args, that);
        };
        if(isObject(fn.prototype))bound.prototype = fn.prototype;
        return bound;
      }
    });
    
    // fallback for not array-like ES3 strings and DOM objects
    $export($export.P + $export.F * fails(function(){
      if(html)arraySlice.call(html);
    }), 'Array', {
      slice: function(begin, end){
        var len   = toLength(this.length)
          , klass = cof(this);
        end = end === undefined ? len : end;
        if(klass == 'Array')return arraySlice.call(this, begin, end);
        var start  = toIndex(begin, len)
          , upTo   = toIndex(end, len)
          , size   = toLength(upTo - start)
          , cloned = Array(size)
          , i      = 0;
        for(; i < size; i++)cloned[i] = klass == 'String'
          ? this.charAt(start + i)
          : this[start + i];
        return cloned;
      }
    });
    $export($export.P + $export.F * (IObject != Object), 'Array', {
      join: function join(separator){
        return arrayJoin.call(IObject(this), separator === undefined ? ',' : separator);
      }
    });
    
    // 22.1.2.2 / 15.4.3.2 Array.isArray(arg)
    $export($export.S, 'Array', {isArray:  require('core-js/modules/$.is-array')});
    
    var createArrayReduce = function(isRight){
      return function(callbackfn, memo){
        aFunction(callbackfn);
        var O      = IObject(this)
          , length = toLength(O.length)
          , index  = isRight ? length - 1 : 0
          , i      = isRight ? -1 : 1;
        if(arguments.length < 2)for(;;){
          if(index in O){
            memo = O[index];
            index += i;
            break;
          }
          index += i;
          if(isRight ? index < 0 : length <= index){
            throw TypeError('Reduce of empty array with no initial value');
          }
        }
        for(;isRight ? index >= 0 : length > index; index += i)if(index in O){
          memo = callbackfn(memo, O[index], index, this);
        }
        return memo;
      };
    };
    
    var methodize = function($fn){
      return function(arg1/*, arg2 = undefined */){
        return $fn(this, arg1, arguments[1]);
      };
    };
    
    $export($export.P, 'Array', {
      // 22.1.3.10 / 15.4.4.18 Array.prototype.forEach(callbackfn [, thisArg])
      forEach: $.each = $.each || methodize(createArrayMethod(0)),
      // 22.1.3.15 / 15.4.4.19 Array.prototype.map(callbackfn [, thisArg])
      map: methodize(createArrayMethod(1)),
      // 22.1.3.7 / 15.4.4.20 Array.prototype.filter(callbackfn [, thisArg])
      filter: methodize(createArrayMethod(2)),
      // 22.1.3.23 / 15.4.4.17 Array.prototype.some(callbackfn [, thisArg])
      some: methodize(createArrayMethod(3)),
      // 22.1.3.5 / 15.4.4.16 Array.prototype.every(callbackfn [, thisArg])
      every: methodize(createArrayMethod(4)),
      // 22.1.3.18 / 15.4.4.21 Array.prototype.reduce(callbackfn [, initialValue])
      reduce: createArrayReduce(false),
      // 22.1.3.19 / 15.4.4.22 Array.prototype.reduceRight(callbackfn [, initialValue])
      reduceRight: createArrayReduce(true),
      // 22.1.3.11 / 15.4.4.14 Array.prototype.indexOf(searchElement [, fromIndex])
      indexOf: methodize(arrayIndexOf),
      // 22.1.3.14 / 15.4.4.15 Array.prototype.lastIndexOf(searchElement [, fromIndex])
      lastIndexOf: function(el, fromIndex /* = @[*-1] */){
        var O      = toIObject(this)
          , length = toLength(O.length)
          , index  = length - 1;
        if(arguments.length > 1)index = Math.min(index, toInteger(fromIndex));
        if(index < 0)index = toLength(length + index);
        for(;index >= 0; index--)if(index in O)if(O[index] === el)return index;
        return -1;
      }
    });
    
    // 20.3.3.1 / 15.9.4.4 Date.now()
    $export($export.S, 'Date', {now: function(){ return +new Date; }});
    
    var lz = function(num){
      return num > 9 ? num : '0' + num;
    };
    
    // 20.3.4.36 / 15.9.5.43 Date.prototype.toISOString()
    // PhantomJS / old WebKit has a broken implementations
    $export($export.P + $export.F * (fails(function(){
      return new Date(-5e13 - 1).toISOString() != '0385-07-25T07:06:39.999Z';
    }) || !fails(function(){
      new Date(NaN).toISOString();
    })), 'Date', {
      toISOString: function toISOString(){
        if(!isFinite(this))throw RangeError('Invalid time value');
        var d = this
          , y = d.getUTCFullYear()
          , m = d.getUTCMilliseconds()
          , s = y < 0 ? '-' : y > 9999 ? '+' : '';
        return s + ('00000' + Math.abs(y)).slice(s ? -6 : -4) +
          '-' + lz(d.getUTCMonth() + 1) + '-' + lz(d.getUTCDate()) +
          'T' + lz(d.getUTCHours()) + ':' + lz(d.getUTCMinutes()) +
          ':' + lz(d.getUTCSeconds()) + '.' + (m > 99 ? m : '0' + lz(m)) + 'Z';
      }
    });)
      , $export           =  require('core-js/modules/$.export')
      , DESCRIPTORS       =  require('core-js/modules/$.descriptors')
      , createDesc        =  require('core-js/modules/$.property-desc')
      , html              =  require('core-js/modules/$.html')
      , cel               =  require('core-js/modules/$.dom-create')
      , has               =  require('core-js/modules/$.has')
      , cof               =  require('core-js/modules/$.cof')
      , invoke            =  require('core-js/modules/$.invoke')
      , fails             =  require('core-js/modules/$.fails')
      , anObject          =  require('core-js/modules/$.an-object')
      , aFunction         =  require('core-js/modules/$.a-function')
      , isObject          =  require('core-js/modules/$.is-object')
      , toObject          =  require('core-js/modules/$.to-object')
      , toIObject         =  require('core-js/modules/$.to-iobject')
      , toInteger         =  require('core-js/modules/$.to-integer')
      , toIndex           =  require('core-js/modules/$.to-index')
      , toLength          =  require('core-js/modules/$.to-length')
      , IObject           =  require('core-js/modules/$.iobject')
      , IE_PROTO          =  require('core-js/modules/$.uid')('__proto__')
      , createArrayMethod =  require('core-js/modules/$.array-methods')
      , arrayIndexOf      =  require('core-js/modules/$.array-includes')(false)
      , ObjectProto       = Object.prototype
      , ArrayProto        = Array.prototype
      , arraySlice        = ArrayProto.slice
      , arrayJoin         = ArrayProto.join
      , defineProperty    = $.setDesc
      , getOwnDescriptor  = $.getDesc
      , defineProperties  = $.setDescs
      , factories         = {}
      , IE8_DOM_DEFINE;
    
    if(!DESCRIPTORS){
      IE8_DOM_DEFINE = !fails(function(){
        return defineProperty(cel('div'), 'a', {get: function(){ return 7; }}).a != 7;
      });
      $.setDesc = function(O, P, Attributes){
        if(IE8_DOM_DEFINE)try {
          return defineProperty(O, P, Attributes);
        } catch(e){ /* empty */ }
        if('get' in Attributes || 'set' in Attributes)throw TypeError('Accessors not supported!');
        if('value' in Attributes)anObject(O)[P] = Attributes.value;
        return O;
      };
      $.getDesc = function(O, P){
        if(IE8_DOM_DEFINE)try {
          return getOwnDescriptor(O, P);
        } catch(e){ /* empty */ }
        if(has(O, P))return createDesc(!ObjectProto.propertyIsEnumerable.call(O, P), O[P]);
      };
      $.setDescs = defineProperties = function(O, Properties){
        anObject(O);
        var keys   = $.getKeys(Properties)
          , length = keys.length
          , i = 0
          , P;
        while(length > i)$.setDesc(O, P = keys[i++], Properties[P]);
        return O;
      };
    }
    $export($export.S + $export.F * !DESCRIPTORS, 'Object', {
      // 19.1.2.6 / 15.2.3.3 Object.getOwnPropertyDescriptor(O, P)
      getOwnPropertyDescriptor: $.getDesc,
      // 19.1.2.4 / 15.2.3.6 Object.defineProperty(O, P, Attributes)
      defineProperty: $.setDesc,
      // 19.1.2.3 / 15.2.3.7 Object.defineProperties(O, Properties)
      defineProperties: defineProperties
    });
    
      // IE 8- don't enum bug keys
    var keys1 = ('constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,' +
                'toLocaleString,toString,valueOf').split(',')
      // Additional keys for getOwnPropertyNames
      , keys2 = keys1.concat('length', 'prototype')
      , keysLen1 = keys1.length;
    
    // Create object with `null` prototype: use iframe Object with cleared prototype
    var createDict = function(){
      // Thrash, waste and sodomy: IE GC bug
      var iframe = cel('iframe')
        , i      = keysLen1
        , gt     = '>'
        , iframeDocument;
      iframe.style.display = 'none';
      html.appendChild(iframe);
      iframe.src = 'javascript:'; // eslint-disable-line no-script-url
      // createDict = iframe.contentWindow.Object;
      // html.removeChild(iframe);
      iframeDocument = iframe.contentWindow.document;
      iframeDocument.open();
      iframeDocument.write('<script>document.F=Object</script' + gt);
      iframeDocument.close();
      createDict = iframeDocument.F;
      while(i--)delete createDict.prototype[keys1[i]];
      return createDict();
    };
    var createGetKeys = function(names, length){
      return function(object){
        var O      = toIObject(object)
          , i      = 0
          , result = []
          , key;
        for(key in O)if(key != IE_PROTO)has(O, key) && result.push(key);
        // Don't enum bug & hidden keys
        while(length > i)if(has(O, key = names[i++])){
          ~arrayIndexOf(result, key) || result.push(key);
        }
        return result;
      };
    };
    var Empty = function(){};
    $export($export.S, 'Object', {
      // 19.1.2.9 / 15.2.3.2 Object.getPrototypeOf(O)
      getPrototypeOf: $.getProto = $.getProto || function(O){
        O = toObject(O);
        if(has(O, IE_PROTO))return O[IE_PROTO];
        if(typeof O.constructor == 'function' && O instanceof O.constructor){
          return O.constructor.prototype;
        } return O instanceof Object ? ObjectProto : null;
      },
      // 19.1.2.7 / 15.2.3.4 Object.getOwnPropertyNames(O)
      getOwnPropertyNames: $.getNames = $.getNames || createGetKeys(keys2, keys2.length, true),
      // 19.1.2.2 / 15.2.3.5 Object.create(O [, Properties])
      create: $.create = $.create || function(O, /*?*/Properties){
        var result;
        if(O !== null){
          Empty.prototype = anObject(O);
          result = new Empty();
          Empty.prototype = null;
          // add "__proto__" for Object.getPrototypeOf shim
          result[IE_PROTO] = O;
        } else result = createDict();
        return Properties === undefined ? result : defineProperties(result, Properties);
      },
      // 19.1.2.14 / 15.2.3.14 Object.keys(O)
      keys: $.getKeys = $.getKeys || createGetKeys(keys1, keysLen1, false)
    });
    
    var construct = function(F, len, args){
      if(!(len in factories)){
        for(var n = [], i = 0; i < len; i++)n[i] = 'a[' + i + ']';
        factories[len] = Function('F,a', 'return new F(' + n.join(',') + ')');
      }
      return factories[len](F, args);
    };
    
    // 19.2.3.2 / 15.3.4.5 Function.prototype.bind(thisArg, args...)
    $export($export.P, 'Function', {
      bind: function bind(that /*, args... */){
        var fn       = aFunction(this)
          , partArgs = arraySlice.call(arguments, 1);
        var bound = function(/* args... */){
          var args = partArgs.concat(arraySlice.call(arguments));
          return this instanceof bound ? construct(fn, args.length, args) : invoke(fn, args, that);
        };
        if(isObject(fn.prototype))bound.prototype = fn.prototype;
        return bound;
      }
    });
    
    // fallback for not array-like ES3 strings and DOM objects
    $export($export.P + $export.F * fails(function(){
      if(html)arraySlice.call(html);
    }), 'Array', {
      slice: function(begin, end){
        var len   = toLength(this.length)
          , klass = cof(this);
        end = end === undefined ? len : end;
        if(klass == 'Array')return arraySlice.call(this, begin, end);
        var start  = toIndex(begin, len)
          , upTo   = toIndex(end, len)
          , size   = toLength(upTo - start)
          , cloned = Array(size)
          , i      = 0;
        for(; i < size; i++)cloned[i] = klass == 'String'
          ? this.charAt(start + i)
          : this[start + i];
        return cloned;
      }
    });
    $export($export.P + $export.F * (IObject != Object), 'Array', {
      join: function join(separator){
        return arrayJoin.call(IObject(this), separator === undefined ? ',' : separator);
      }
    });
    
    // 22.1.2.2 / 15.4.3.2 Array.isArray(arg)
    $export($export.S, 'Array', {isArray:  require('core-js/modules/$.is-array')});
    
    var createArrayReduce = function(isRight){
      return function(callbackfn, memo){
        aFunction(callbackfn);
        var O      = IObject(this)
          , length = toLength(O.length)
          , index  = isRight ? length - 1 : 0
          , i      = isRight ? -1 : 1;
        if(arguments.length < 2)for(;;){
          if(index in O){
            memo = O[index];
            index += i;
            break;
          }
          index += i;
          if(isRight ? index < 0 : length <= index){
            throw TypeError('Reduce of empty array with no initial value');
          }
        }
        for(;isRight ? index >= 0 : length > index; index += i)if(index in O){
          memo = callbackfn(memo, O[index], index, this);
        }
        return memo;
      };
    };
    
    var methodize = function($fn){
      return function(arg1/*, arg2 = undefined */){
        return $fn(this, arg1, arguments[1]);
      };
    };
    
    $export($export.P, 'Array', {
      // 22.1.3.10 / 15.4.4.18 Array.prototype.forEach(callbackfn [, thisArg])
      forEach: $.each = $.each || methodize(createArrayMethod(0)),
      // 22.1.3.15 / 15.4.4.19 Array.prototype.map(callbackfn [, thisArg])
      map: methodize(createArrayMethod(1)),
      // 22.1.3.7 / 15.4.4.20 Array.prototype.filter(callbackfn [, thisArg])
      filter: methodize(createArrayMethod(2)),
      // 22.1.3.23 / 15.4.4.17 Array.prototype.some(callbackfn [, thisArg])
      some: methodize(createArrayMethod(3)),
      // 22.1.3.5 / 15.4.4.16 Array.prototype.every(callbackfn [, thisArg])
      every: methodize(createArrayMethod(4)),
      // 22.1.3.18 / 15.4.4.21 Array.prototype.reduce(callbackfn [, initialValue])
      reduce: createArrayReduce(false),
      // 22.1.3.19 / 15.4.4.22 Array.prototype.reduceRight(callbackfn [, initialValue])
      reduceRight: createArrayReduce(true),
      // 22.1.3.11 / 15.4.4.14 Array.prototype.indexOf(searchElement [, fromIndex])
      indexOf: methodize(arrayIndexOf),
      // 22.1.3.14 / 15.4.4.15 Array.prototype.lastIndexOf(searchElement [, fromIndex])
      lastIndexOf: function(el, fromIndex /* = @[*-1] */){
        var O      = toIObject(this)
          , length = toLength(O.length)
          , index  = length - 1;
        if(arguments.length > 1)index = Math.min(index, toInteger(fromIndex));
        if(index < 0)index = toLength(length + index);
        for(;index >= 0; index--)if(index in O)if(O[index] === el)return index;
        return -1;
      }
    });
    
    // 20.3.3.1 / 15.9.4.4 Date.now()
    $export($export.S, 'Date', {now: function(){ return +new Date; }});
    
    var lz = function(num){
      return num > 9 ? num : '0' + num;
    };
    
    // 20.3.4.36 / 15.9.5.43 Date.prototype.toISOString()
    // PhantomJS / old WebKit has a broken implementations
    $export($export.P + $export.F * (fails(function(){
      return new Date(-5e13 - 1).toISOString() != '0385-07-25T07:06:39.999Z';
    }) || !fails(function(){
      new Date(NaN).toISOString();
    })), 'Date', {
      toISOString: function toISOString(){
        if(!isFinite(this))throw RangeError('Invalid time value');
        var d = this
          , y = d.getUTCFullYear()
          , m = d.getUTCMilliseconds()
          , s = y < 0 ? '-' : y > 9999 ? '+' : '';
        return s + ('00000' + Math.abs(y)).slice(s ? -6 : -4) +
          '-' + lz(d.getUTCMonth() + 1) + '-' + lz(d.getUTCDate()) +
          'T' + lz(d.getUTCHours()) + ':' + lz(d.getUTCMinutes()) +
          ':' + lz(d.getUTCSeconds()) + '.' + (m > 99 ? m : '0' + lz(m)) + 'Z';
      }
    });
  provide("core-js/modules/es5", module.exports);
}(global));

// pakmanager:core-js/modules/es6.symbol
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    // ECMAScript 6 symbols shim
    var $              =  require('core-js/modules/
      , global         =  require('core-js/modules/$.global')
      , has            =  require('core-js/modules/$.has')
      , DESCRIPTORS    =  require('core-js/modules/$.descriptors')
      , $export        =  require('core-js/modules/$.export')
      , redefine       =  require('core-js/modules/$.redefine')
      , $fails         =  require('core-js/modules/$.fails')
      , shared         =  require('core-js/modules/$.shared')
      , setToStringTag =  require('core-js/modules/$.set-to-string-tag')
      , uid            =  require('core-js/modules/$.uid')
      , wks            =  require('core-js/modules/$.wks')
      , keyOf          =  require('core-js/modules/$.keyof')
      , $names         =  require('core-js/modules/$.get-names')
      , enumKeys       =  require('core-js/modules/$.enum-keys')
      , isArray        =  require('core-js/modules/$.is-array')
      , anObject       =  require('core-js/modules/$.an-object')
      , toIObject      =  require('core-js/modules/$.to-iobject')
      , createDesc     =  require('core-js/modules/$.property-desc')
      , getDesc        = $.getDesc
      , setDesc        = $.setDesc
      , _create        = $.create
      , getNames       = $names.get
      , $Symbol        = global.Symbol
      , $JSON          = global.JSON
      , _stringify     = $JSON && $JSON.stringify
      , setter         = false
      , HIDDEN         = wks('_hidden')
      , isEnum         = $.isEnum
      , SymbolRegistry = shared('symbol-registry')
      , AllSymbols     = shared('symbols')
      , useNative      = typeof $Symbol == 'function'
      , ObjectProto    = Object.prototype;
    
    // fallback for old Android, https://code.google.com/p/v8/issues/detail?id=687
    var setSymbolDesc = DESCRIPTORS && $fails(function(){
      return _create(setDesc({}, 'a', {
        get: function(){ return setDesc(this, 'a', {value: 7}).a; }
      })).a != 7;
    }) ? function(it, key, D){
      var protoDesc = getDesc(ObjectProto, key);
      if(protoDesc)delete ObjectProto[key];
      setDesc(it, key, D);
      if(protoDesc && it !== ObjectProto)setDesc(ObjectProto, key, protoDesc);
    } : setDesc;
    
    var wrap = function(tag){
      var sym = AllSymbols[tag] = _create($Symbol.prototype);
      sym._k = tag;
      DESCRIPTORS && setter && setSymbolDesc(ObjectProto, tag, {
        configurable: true,
        set: function(value){
          if(has(this, HIDDEN) && has(this[HIDDEN], tag))this[HIDDEN][tag] = false;
          setSymbolDesc(this, tag, createDesc(1, value));
        }
      });
      return sym;
    };
    
    var isSymbol = function(it){
      return typeof it == 'symbol';
    };
    
    var $defineProperty = function defineProperty(it, key, D){
      if(D && has(AllSymbols, key)){
        if(!D.enumerable){
          if(!has(it, HIDDEN))setDesc(it, HIDDEN, createDesc(1, {}));
          it[HIDDEN][key] = true;
        } else {
          if(has(it, HIDDEN) && it[HIDDEN][key])it[HIDDEN][key] = false;
          D = _create(D, {enumerable: createDesc(0, false)});
        } return setSymbolDesc(it, key, D);
      } return setDesc(it, key, D);
    };
    var $defineProperties = function defineProperties(it, P){
      anObject(it);
      var keys = enumKeys(P = toIObject(P))
        , i    = 0
        , l = keys.length
        , key;
      while(l > i)$defineProperty(it, key = keys[i++], P[key]);
      return it;
    };
    var $create = function create(it, P){
      return P === undefined ? _create(it) : $defineProperties(_create(it), P);
    };
    var $propertyIsEnumerable = function propertyIsEnumerable(key){
      var E = isEnum.call(this, key);
      return E || !has(this, key) || !has(AllSymbols, key) || has(this, HIDDEN) && this[HIDDEN][key]
        ? E : true;
    };
    var $getOwnPropertyDescriptor = function getOwnPropertyDescriptor(it, key){
      var D = getDesc(it = toIObject(it), key);
      if(D && has(AllSymbols, key) && !(has(it, HIDDEN) && it[HIDDEN][key]))D.enumerable = true;
      return D;
    };
    var $getOwnPropertyNames = function getOwnPropertyNames(it){
      var names  = getNames(toIObject(it))
        , result = []
        , i      = 0
        , key;
      while(names.length > i)if(!has(AllSymbols, key = names[i++]) && key != HIDDEN)result.push(key);
      return result;
    };
    var $getOwnPropertySymbols = function getOwnPropertySymbols(it){
      var names  = getNames(toIObject(it))
        , result = []
        , i      = 0
        , key;
      while(names.length > i)if(has(AllSymbols, key = names[i++]))result.push(AllSymbols[key]);
      return result;
    };
    var $stringify = function stringify(it){
      if(it === undefined || isSymbol(it))return; // IE8 returns string on undefined
      var args = [it]
        , i    = 1
        , $$   = arguments
        , replacer, $replacer;
      while($$.length > i)args.push($$[i++]);
      replacer = args[1];
      if(typeof replacer == 'function')$replacer = replacer;
      if($replacer || !isArray(replacer))replacer = function(key, value){
        if($replacer)value = $replacer.call(this, key, value);
        if(!isSymbol(value))return value;
      };
      args[1] = replacer;
      return _stringify.apply($JSON, args);
    };
    var buggyJSON = $fails(function(){
      var S = $Symbol();
      // MS Edge converts symbol values to JSON as {}
      // WebKit converts symbol values to JSON as null
      // V8 throws on boxed symbols
      return _stringify([S]) != '[null]' || _stringify({a: S}) != '{}' || _stringify(Object(S)) != '{}';
    });
    
    // 19.4.1.1 Symbol([description])
    if(!useNative){
      $Symbol = function Symbol(){
        if(isSymbol(this))throw TypeError('Symbol is not a constructor');
        return wrap(uid(arguments.length > 0 ? arguments[0] : undefined));
      };
      redefine($Symbol.prototype, 'toString', function toString(){
        return this._k;
      });
    
      isSymbol = function(it){
        return it instanceof $Symbol;
      };
    
      $.create     = $create;
      $.isEnum     = $propertyIsEnumerable;
      $.getDesc    = $getOwnPropertyDescriptor;
      $.setDesc    = $defineProperty;
      $.setDescs   = $defineProperties;
      $.getNames   = $names.get = $getOwnPropertyNames;
      $.getSymbols = $getOwnPropertySymbols;
    
      if(DESCRIPTORS && ! require('core-js/modules/$.library')){
        redefine(ObjectProto, 'propertyIsEnumerable', $propertyIsEnumerable, true);
      }
    }
    
    var symbolStatics = {
      // 19.4.2.1 Symbol.for(key)
      'for': function(key){
        return has(SymbolRegistry, key += '')
          ? SymbolRegistry[key]
          : SymbolRegistry[key] = $Symbol(key);
      },
      // 19.4.2.5 Symbol.keyFor(sym)
      keyFor: function keyFor(key){
        return keyOf(SymbolRegistry, key);
      },
      useSetter: function(){ setter = true; },
      useSimple: function(){ setter = false; }
    };
    // 19.4.2.2 Symbol.hasInstance
    // 19.4.2.3 Symbol.isConcatSpreadable
    // 19.4.2.4 Symbol.iterator
    // 19.4.2.6 Symbol.match
    // 19.4.2.8 Symbol.replace
    // 19.4.2.9 Symbol.search
    // 19.4.2.10 Symbol.species
    // 19.4.2.11 Symbol.split
    // 19.4.2.12 Symbol.toPrimitive
    // 19.4.2.13 Symbol.toStringTag
    // 19.4.2.14 Symbol.unscopables
    $.each.call((
      'hasInstance,isConcatSpreadable,iterator,match,replace,search,' +
      'species,split,toPrimitive,toStringTag,unscopables'
    ).split(','), function(it){
      var sym = wks(it);
      symbolStatics[it] = useNative ? sym : wrap(sym);
    });
    
    setter = true;
    
    $export($export.G + $export.W, {Symbol: $Symbol});
    
    $export($export.S, 'Symbol', symbolStatics);
    
    $export($export.S + $export.F * !useNative, 'Object', {
      // 19.1.2.2 Object.create(O [, Properties])
      create: $create,
      // 19.1.2.4 Object.defineProperty(O, P, Attributes)
      defineProperty: $defineProperty,
      // 19.1.2.3 Object.defineProperties(O, Properties)
      defineProperties: $defineProperties,
      // 19.1.2.6 Object.getOwnPropertyDescriptor(O, P)
      getOwnPropertyDescriptor: $getOwnPropertyDescriptor,
      // 19.1.2.7 Object.getOwnPropertyNames(O)
      getOwnPropertyNames: $getOwnPropertyNames,
      // 19.1.2.8 Object.getOwnPropertySymbols(O)
      getOwnPropertySymbols: $getOwnPropertySymbols
    });
    
    // 24.3.2 JSON.stringify(value [, replacer [, space]])
    $JSON && $export($export.S + $export.F * (!useNative || buggyJSON), 'JSON', {stringify: $stringify});
    
    // 19.4.3.5 Symbol.prototype[@@toStringTag]
    setToStringTag($Symbol, 'Symbol');
    // 20.2.1.9 Math[@@toStringTag]
    setToStringTag(Math, 'Math', true);
    // 24.3.3 JSON[@@toStringTag]
    setToStringTag(global.JSON, 'JSON', true);)
      , global         =  require('core-js/modules/$.global')
      , has            =  require('core-js/modules/$.has')
      , DESCRIPTORS    =  require('core-js/modules/$.descriptors')
      , $export        =  require('core-js/modules/$.export')
      , redefine       =  require('core-js/modules/$.redefine')
      , $fails         =  require('core-js/modules/$.fails')
      , shared         =  require('core-js/modules/$.shared')
      , setToStringTag =  require('core-js/modules/$.set-to-string-tag')
      , uid            =  require('core-js/modules/$.uid')
      , wks            =  require('core-js/modules/$.wks')
      , keyOf          =  require('core-js/modules/$.keyof')
      , $names         =  require('core-js/modules/$.get-names')
      , enumKeys       =  require('core-js/modules/$.enum-keys')
      , isArray        =  require('core-js/modules/$.is-array')
      , anObject       =  require('core-js/modules/$.an-object')
      , toIObject      =  require('core-js/modules/$.to-iobject')
      , createDesc     =  require('core-js/modules/$.property-desc')
      , getDesc        = $.getDesc
      , setDesc        = $.setDesc
      , _create        = $.create
      , getNames       = $names.get
      , $Symbol        = global.Symbol
      , $JSON          = global.JSON
      , _stringify     = $JSON && $JSON.stringify
      , setter         = false
      , HIDDEN         = wks('_hidden')
      , isEnum         = $.isEnum
      , SymbolRegistry = shared('symbol-registry')
      , AllSymbols     = shared('symbols')
      , useNative      = typeof $Symbol == 'function'
      , ObjectProto    = Object.prototype;
    
    // fallback for old Android, https://code.google.com/p/v8/issues/detail?id=687
    var setSymbolDesc = DESCRIPTORS && $fails(function(){
      return _create(setDesc({}, 'a', {
        get: function(){ return setDesc(this, 'a', {value: 7}).a; }
      })).a != 7;
    }) ? function(it, key, D){
      var protoDesc = getDesc(ObjectProto, key);
      if(protoDesc)delete ObjectProto[key];
      setDesc(it, key, D);
      if(protoDesc && it !== ObjectProto)setDesc(ObjectProto, key, protoDesc);
    } : setDesc;
    
    var wrap = function(tag){
      var sym = AllSymbols[tag] = _create($Symbol.prototype);
      sym._k = tag;
      DESCRIPTORS && setter && setSymbolDesc(ObjectProto, tag, {
        configurable: true,
        set: function(value){
          if(has(this, HIDDEN) && has(this[HIDDEN], tag))this[HIDDEN][tag] = false;
          setSymbolDesc(this, tag, createDesc(1, value));
        }
      });
      return sym;
    };
    
    var isSymbol = function(it){
      return typeof it == 'symbol';
    };
    
    var $defineProperty = function defineProperty(it, key, D){
      if(D && has(AllSymbols, key)){
        if(!D.enumerable){
          if(!has(it, HIDDEN))setDesc(it, HIDDEN, createDesc(1, {}));
          it[HIDDEN][key] = true;
        } else {
          if(has(it, HIDDEN) && it[HIDDEN][key])it[HIDDEN][key] = false;
          D = _create(D, {enumerable: createDesc(0, false)});
        } return setSymbolDesc(it, key, D);
      } return setDesc(it, key, D);
    };
    var $defineProperties = function defineProperties(it, P){
      anObject(it);
      var keys = enumKeys(P = toIObject(P))
        , i    = 0
        , l = keys.length
        , key;
      while(l > i)$defineProperty(it, key = keys[i++], P[key]);
      return it;
    };
    var $create = function create(it, P){
      return P === undefined ? _create(it) : $defineProperties(_create(it), P);
    };
    var $propertyIsEnumerable = function propertyIsEnumerable(key){
      var E = isEnum.call(this, key);
      return E || !has(this, key) || !has(AllSymbols, key) || has(this, HIDDEN) && this[HIDDEN][key]
        ? E : true;
    };
    var $getOwnPropertyDescriptor = function getOwnPropertyDescriptor(it, key){
      var D = getDesc(it = toIObject(it), key);
      if(D && has(AllSymbols, key) && !(has(it, HIDDEN) && it[HIDDEN][key]))D.enumerable = true;
      return D;
    };
    var $getOwnPropertyNames = function getOwnPropertyNames(it){
      var names  = getNames(toIObject(it))
        , result = []
        , i      = 0
        , key;
      while(names.length > i)if(!has(AllSymbols, key = names[i++]) && key != HIDDEN)result.push(key);
      return result;
    };
    var $getOwnPropertySymbols = function getOwnPropertySymbols(it){
      var names  = getNames(toIObject(it))
        , result = []
        , i      = 0
        , key;
      while(names.length > i)if(has(AllSymbols, key = names[i++]))result.push(AllSymbols[key]);
      return result;
    };
    var $stringify = function stringify(it){
      if(it === undefined || isSymbol(it))return; // IE8 returns string on undefined
      var args = [it]
        , i    = 1
        , $$   = arguments
        , replacer, $replacer;
      while($$.length > i)args.push($$[i++]);
      replacer = args[1];
      if(typeof replacer == 'function')$replacer = replacer;
      if($replacer || !isArray(replacer))replacer = function(key, value){
        if($replacer)value = $replacer.call(this, key, value);
        if(!isSymbol(value))return value;
      };
      args[1] = replacer;
      return _stringify.apply($JSON, args);
    };
    var buggyJSON = $fails(function(){
      var S = $Symbol();
      // MS Edge converts symbol values to JSON as {}
      // WebKit converts symbol values to JSON as null
      // V8 throws on boxed symbols
      return _stringify([S]) != '[null]' || _stringify({a: S}) != '{}' || _stringify(Object(S)) != '{}';
    });
    
    // 19.4.1.1 Symbol([description])
    if(!useNative){
      $Symbol = function Symbol(){
        if(isSymbol(this))throw TypeError('Symbol is not a constructor');
        return wrap(uid(arguments.length > 0 ? arguments[0] : undefined));
      };
      redefine($Symbol.prototype, 'toString', function toString(){
        return this._k;
      });
    
      isSymbol = function(it){
        return it instanceof $Symbol;
      };
    
      $.create     = $create;
      $.isEnum     = $propertyIsEnumerable;
      $.getDesc    = $getOwnPropertyDescriptor;
      $.setDesc    = $defineProperty;
      $.setDescs   = $defineProperties;
      $.getNames   = $names.get = $getOwnPropertyNames;
      $.getSymbols = $getOwnPropertySymbols;
    
      if(DESCRIPTORS && ! require('core-js/modules/$.library')){
        redefine(ObjectProto, 'propertyIsEnumerable', $propertyIsEnumerable, true);
      }
    }
    
    var symbolStatics = {
      // 19.4.2.1 Symbol.for(key)
      'for': function(key){
        return has(SymbolRegistry, key += '')
          ? SymbolRegistry[key]
          : SymbolRegistry[key] = $Symbol(key);
      },
      // 19.4.2.5 Symbol.keyFor(sym)
      keyFor: function keyFor(key){
        return keyOf(SymbolRegistry, key);
      },
      useSetter: function(){ setter = true; },
      useSimple: function(){ setter = false; }
    };
    // 19.4.2.2 Symbol.hasInstance
    // 19.4.2.3 Symbol.isConcatSpreadable
    // 19.4.2.4 Symbol.iterator
    // 19.4.2.6 Symbol.match
    // 19.4.2.8 Symbol.replace
    // 19.4.2.9 Symbol.search
    // 19.4.2.10 Symbol.species
    // 19.4.2.11 Symbol.split
    // 19.4.2.12 Symbol.toPrimitive
    // 19.4.2.13 Symbol.toStringTag
    // 19.4.2.14 Symbol.unscopables
    $.each.call((
      'hasInstance,isConcatSpreadable,iterator,match,replace,search,' +
      'species,split,toPrimitive,toStringTag,unscopables'
    ).split(','), function(it){
      var sym = wks(it);
      symbolStatics[it] = useNative ? sym : wrap(sym);
    });
    
    setter = true;
    
    $export($export.G + $export.W, {Symbol: $Symbol});
    
    $export($export.S, 'Symbol', symbolStatics);
    
    $export($export.S + $export.F * !useNative, 'Object', {
      // 19.1.2.2 Object.create(O [, Properties])
      create: $create,
      // 19.1.2.4 Object.defineProperty(O, P, Attributes)
      defineProperty: $defineProperty,
      // 19.1.2.3 Object.defineProperties(O, Properties)
      defineProperties: $defineProperties,
      // 19.1.2.6 Object.getOwnPropertyDescriptor(O, P)
      getOwnPropertyDescriptor: $getOwnPropertyDescriptor,
      // 19.1.2.7 Object.getOwnPropertyNames(O)
      getOwnPropertyNames: $getOwnPropertyNames,
      // 19.1.2.8 Object.getOwnPropertySymbols(O)
      getOwnPropertySymbols: $getOwnPropertySymbols
    });
    
    // 24.3.2 JSON.stringify(value [, replacer [, space]])
    $JSON && $export($export.S + $export.F * (!useNative || buggyJSON), 'JSON', {stringify: $stringify});
    
    // 19.4.3.5 Symbol.prototype[@@toStringTag]
    setToStringTag($Symbol, 'Symbol');
    // 20.2.1.9 Math[@@toStringTag]
    setToStringTag(Math, 'Math', true);
    // 24.3.3 JSON[@@toStringTag]
    setToStringTag(global.JSON, 'JSON', true);
  provide("core-js/modules/es6.symbol", module.exports);
}(global));

// pakmanager:core-js/modules/es6.object.assign
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 19.1.3.1 Object.assign(target, source)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S + $export.F, 'Object', {assign:  require('core-js/modules/$.object-assign')});
  provide("core-js/modules/es6.object.assign", module.exports);
}(global));

// pakmanager:core-js/modules/es6.object.is
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 19.1.3.10 Object.is(value1, value2)
    var $export =  require('core-js/modules/$.export');
    $export($export.S, 'Object', {is:  require('core-js/modules/$.same-value')});
  provide("core-js/modules/es6.object.is", module.exports);
}(global));

// pakmanager:core-js/modules/es6.object.set-prototype-of
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 19.1.3.19 Object.setPrototypeOf(O, proto)
    var $export =  require('core-js/modules/$.export');
    $export($export.S, 'Object', {setPrototypeOf:  require('core-js/modules/$.set-proto').set});
  provide("core-js/modules/es6.object.set-prototype-of", module.exports);
}(global));

// pakmanager:core-js/modules/es6.object.to-string
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    // 19.1.3.6 Object.prototype.toString()
    var classof =  require('core-js/modules/$.classof')
      , test    = {};
    test[ require('core-js/modules/$.wks')('toStringTag')] = 'z';
    if(test + '' != '[object z]'){
       require('core-js/modules/$.redefine')(Object.prototype, 'toString', function toString(){
        return '[object ' + classof(this) + ']';
      }, true);
    }
  provide("core-js/modules/es6.object.to-string", module.exports);
}(global));

// pakmanager:core-js/modules/es6.object.freeze
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 19.1.2.5 Object.freeze(O)
    var isObject =  require('core-js/modules/$.is-object');
    
     require('core-js/modules/$.object-sap')('freeze', function($freeze){
      return function freeze(it){
        return $freeze && isObject(it) ? $freeze(it) : it;
      };
    });
  provide("core-js/modules/es6.object.freeze", module.exports);
}(global));

// pakmanager:core-js/modules/es6.object.seal
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 19.1.2.17 Object.seal(O)
    var isObject =  require('core-js/modules/$.is-object');
    
     require('core-js/modules/$.object-sap')('seal', function($seal){
      return function seal(it){
        return $seal && isObject(it) ? $seal(it) : it;
      };
    });
  provide("core-js/modules/es6.object.seal", module.exports);
}(global));

// pakmanager:core-js/modules/es6.object.prevent-extensions
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 19.1.2.15 Object.preventExtensions(O)
    var isObject =  require('core-js/modules/$.is-object');
    
     require('core-js/modules/$.object-sap')('preventExtensions', function($preventExtensions){
      return function preventExtensions(it){
        return $preventExtensions && isObject(it) ? $preventExtensions(it) : it;
      };
    });
  provide("core-js/modules/es6.object.prevent-extensions", module.exports);
}(global));

// pakmanager:core-js/modules/es6.object.is-frozen
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 19.1.2.12 Object.isFrozen(O)
    var isObject =  require('core-js/modules/$.is-object');
    
     require('core-js/modules/$.object-sap')('isFrozen', function($isFrozen){
      return function isFrozen(it){
        return isObject(it) ? $isFrozen ? $isFrozen(it) : false : true;
      };
    });
  provide("core-js/modules/es6.object.is-frozen", module.exports);
}(global));

// pakmanager:core-js/modules/es6.object.is-sealed
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 19.1.2.13 Object.isSealed(O)
    var isObject =  require('core-js/modules/$.is-object');
    
     require('core-js/modules/$.object-sap')('isSealed', function($isSealed){
      return function isSealed(it){
        return isObject(it) ? $isSealed ? $isSealed(it) : false : true;
      };
    });
  provide("core-js/modules/es6.object.is-sealed", module.exports);
}(global));

// pakmanager:core-js/modules/es6.object.is-extensible
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 19.1.2.11 Object.isExtensible(O)
    var isObject =  require('core-js/modules/$.is-object');
    
     require('core-js/modules/$.object-sap')('isExtensible', function($isExtensible){
      return function isExtensible(it){
        return isObject(it) ? $isExtensible ? $isExtensible(it) : true : false;
      };
    });
  provide("core-js/modules/es6.object.is-extensible", module.exports);
}(global));

// pakmanager:core-js/modules/es6.object.get-own-property-descriptor
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 19.1.2.6 Object.getOwnPropertyDescriptor(O, P)
    var toIObject =  require('core-js/modules/$.to-iobject');
    
     require('core-js/modules/$.object-sap')('getOwnPropertyDescriptor', function($getOwnPropertyDescriptor){
      return function getOwnPropertyDescriptor(it, key){
        return $getOwnPropertyDescriptor(toIObject(it), key);
      };
    });
  provide("core-js/modules/es6.object.get-own-property-descriptor", module.exports);
}(global));

// pakmanager:core-js/modules/es6.object.get-prototype-of
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 19.1.2.9 Object.getPrototypeOf(O)
    var toObject =  require('core-js/modules/$.to-object');
    
     require('core-js/modules/$.object-sap')('getPrototypeOf', function($getPrototypeOf){
      return function getPrototypeOf(it){
        return $getPrototypeOf(toObject(it));
      };
    });
  provide("core-js/modules/es6.object.get-prototype-of", module.exports);
}(global));

// pakmanager:core-js/modules/es6.object.keys
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 19.1.2.14 Object.keys(O)
    var toObject =  require('core-js/modules/$.to-object');
    
     require('core-js/modules/$.object-sap')('keys', function($keys){
      return function keys(it){
        return $keys(toObject(it));
      };
    });
  provide("core-js/modules/es6.object.keys", module.exports);
}(global));

// pakmanager:core-js/modules/es6.object.get-own-property-names
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 19.1.2.7 Object.getOwnPropertyNames(O)
     require('core-js/modules/$.object-sap')('getOwnPropertyNames', function(){
      return  require('core-js/modules/$.get-names').get;
    });
  provide("core-js/modules/es6.object.get-own-property-names", module.exports);
}(global));

// pakmanager:core-js/modules/es6.function.name
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var setDesc    =  require('core-js/modules/.setDesc
      , createDesc =  require('core-js/modules/$.property-desc')
      , has        =  require('core-js/modules/$.has')
      , FProto     = Function.prototype
      , nameRE     = /^\s*function ([^ (]*)/
      , NAME       = 'name';
    // 19.2.4.2 name
    NAME in FProto ||  require('core-js/modules/$.descriptors') && setDesc(FProto, NAME, {
      configurable: true,
      get: function(){
        var match = ('' + this).match(nameRE)
          , name  = match ? match[1] : '';
        has(this, NAME) || setDesc(this, NAME, createDesc(5, name));
        return name;
      }
    });).setDesc
      , createDesc =  require('core-js/modules/$.property-desc')
      , has        =  require('core-js/modules/$.has')
      , FProto     = Function.prototype
      , nameRE     = /^\s*function ([^ (]*)/
      , NAME       = 'name';
    // 19.2.4.2 name
    NAME in FProto ||  require('core-js/modules/$.descriptors') && setDesc(FProto, NAME, {
      configurable: true,
      get: function(){
        var match = ('' + this).match(nameRE)
          , name  = match ? match[1] : '';
        has(this, NAME) || setDesc(this, NAME, createDesc(5, name));
        return name;
      }
    });
  provide("core-js/modules/es6.function.name", module.exports);
}(global));

// pakmanager:core-js/modules/es6.function.has-instance
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $             =  require('core-js/modules/
      , isObject      =  require('core-js/modules/$.is-object')
      , HAS_INSTANCE  =  require('core-js/modules/$.wks')('hasInstance')
      , FunctionProto = Function.prototype;
    // 19.2.3.6 Function.prototype[@@hasInstance](V)
    if(!(HAS_INSTANCE in FunctionProto))$.setDesc(FunctionProto, HAS_INSTANCE, {value: function(O){
      if(typeof this != 'function' || !isObject(O))return false;
      if(!isObject(this.prototype))return O instanceof this;
      // for environment w/o native `@@hasInstance` logic enough `instanceof`, but add this:
      while(O = $.getProto(O))if(this.prototype === O)return true;
      return false;
    }});)
      , isObject      =  require('core-js/modules/$.is-object')
      , HAS_INSTANCE  =  require('core-js/modules/$.wks')('hasInstance')
      , FunctionProto = Function.prototype;
    // 19.2.3.6 Function.prototype[@@hasInstance](V)
    if(!(HAS_INSTANCE in FunctionProto))$.setDesc(FunctionProto, HAS_INSTANCE, {value: function(O){
      if(typeof this != 'function' || !isObject(O))return false;
      if(!isObject(this.prototype))return O instanceof this;
      // for environment w/o native `@@hasInstance` logic enough `instanceof`, but add this:
      while(O = $.getProto(O))if(this.prototype === O)return true;
      return false;
    }});
  provide("core-js/modules/es6.function.has-instance", module.exports);
}(global));

// pakmanager:core-js/modules/es6.number.constructor
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $           =  require('core-js/modules/
      , global      =  require('core-js/modules/$.global')
      , has         =  require('core-js/modules/$.has')
      , cof         =  require('core-js/modules/$.cof')
      , toPrimitive =  require('core-js/modules/$.to-primitive')
      , fails       =  require('core-js/modules/$.fails')
      , $trim       =  require('core-js/modules/$.string-trim').trim
      , NUMBER      = 'Number'
      , $Number     = global[NUMBER]
      , Base        = $Number
      , proto       = $Number.prototype
      // Opera ~12 has broken Object#toString
      , BROKEN_COF  = cof($.create(proto)) == NUMBER
      , TRIM        = 'trim' in String.prototype;
    
    // 7.1.3 ToNumber(argument)
    var toNumber = function(argument){
      var it = toPrimitive(argument, false);
      if(typeof it == 'string' && it.length > 2){
        it = TRIM ? it.trim() : $trim(it, 3);
        var first = it.charCodeAt(0)
          , third, radix, maxCode;
        if(first === 43 || first === 45){
          third = it.charCodeAt(2);
          if(third === 88 || third === 120)return NaN; // Number('+0x1') should be NaN, old V8 fix
        } else if(first === 48){
          switch(it.charCodeAt(1)){
            case 66 : case 98  : radix = 2; maxCode = 49; break; // fast equal /^0b[01]+$/i
            case 79 : case 111 : radix = 8; maxCode = 55; break; // fast equal /^0o[0-7]+$/i
            default : return +it;
          }
          for(var digits = it.slice(2), i = 0, l = digits.length, code; i < l; i++){
            code = digits.charCodeAt(i);
            // parseInt parses a string to a first unavailable symbol
            // but ToNumber should return NaN if a string contains unavailable symbols
            if(code < 48 || code > maxCode)return NaN;
          } return parseInt(digits, radix);
        }
      } return +it;
    };
    
    if(!$Number(' 0o1') || !$Number('0b1') || $Number('+0x1')){
      $Number = function Number(value){
        var it = arguments.length < 1 ? 0 : value
          , that = this;
        return that instanceof $Number
          // check on 1..constructor(foo) case
          && (BROKEN_COF ? fails(function(){ proto.valueOf.call(that); }) : cof(that) != NUMBER)
            ? new Base(toNumber(it)) : toNumber(it);
      };
      $.each.call( require('core-js/modules/$.descriptors') ? $.getNames(Base) : (
        // ES3:
        'MAX_VALUE,MIN_VALUE,NaN,NEGATIVE_INFINITY,POSITIVE_INFINITY,' +
        // ES6 (in case, if modules with ES6 Number statics required before):
        'EPSILON,isFinite,isInteger,isNaN,isSafeInteger,MAX_SAFE_INTEGER,' +
        'MIN_SAFE_INTEGER,parseFloat,parseInt,isInteger'
      ).split(','), function(key){
        if(has(Base, key) && !has($Number, key)){
          $.setDesc($Number, key, $.getDesc(Base, key));
        }
      });
      $Number.prototype = proto;
      proto.constructor = $Number;
       require('core-js/modules/$.redefine')(global, NUMBER, $Number);
    })
      , global      =  require('core-js/modules/$.global')
      , has         =  require('core-js/modules/$.has')
      , cof         =  require('core-js/modules/$.cof')
      , toPrimitive =  require('core-js/modules/$.to-primitive')
      , fails       =  require('core-js/modules/$.fails')
      , $trim       =  require('core-js/modules/$.string-trim').trim
      , NUMBER      = 'Number'
      , $Number     = global[NUMBER]
      , Base        = $Number
      , proto       = $Number.prototype
      // Opera ~12 has broken Object#toString
      , BROKEN_COF  = cof($.create(proto)) == NUMBER
      , TRIM        = 'trim' in String.prototype;
    
    // 7.1.3 ToNumber(argument)
    var toNumber = function(argument){
      var it = toPrimitive(argument, false);
      if(typeof it == 'string' && it.length > 2){
        it = TRIM ? it.trim() : $trim(it, 3);
        var first = it.charCodeAt(0)
          , third, radix, maxCode;
        if(first === 43 || first === 45){
          third = it.charCodeAt(2);
          if(third === 88 || third === 120)return NaN; // Number('+0x1') should be NaN, old V8 fix
        } else if(first === 48){
          switch(it.charCodeAt(1)){
            case 66 : case 98  : radix = 2; maxCode = 49; break; // fast equal /^0b[01]+$/i
            case 79 : case 111 : radix = 8; maxCode = 55; break; // fast equal /^0o[0-7]+$/i
            default : return +it;
          }
          for(var digits = it.slice(2), i = 0, l = digits.length, code; i < l; i++){
            code = digits.charCodeAt(i);
            // parseInt parses a string to a first unavailable symbol
            // but ToNumber should return NaN if a string contains unavailable symbols
            if(code < 48 || code > maxCode)return NaN;
          } return parseInt(digits, radix);
        }
      } return +it;
    };
    
    if(!$Number(' 0o1') || !$Number('0b1') || $Number('+0x1')){
      $Number = function Number(value){
        var it = arguments.length < 1 ? 0 : value
          , that = this;
        return that instanceof $Number
          // check on 1..constructor(foo) case
          && (BROKEN_COF ? fails(function(){ proto.valueOf.call(that); }) : cof(that) != NUMBER)
            ? new Base(toNumber(it)) : toNumber(it);
      };
      $.each.call( require('core-js/modules/$.descriptors') ? $.getNames(Base) : (
        // ES3:
        'MAX_VALUE,MIN_VALUE,NaN,NEGATIVE_INFINITY,POSITIVE_INFINITY,' +
        // ES6 (in case, if modules with ES6 Number statics required before):
        'EPSILON,isFinite,isInteger,isNaN,isSafeInteger,MAX_SAFE_INTEGER,' +
        'MIN_SAFE_INTEGER,parseFloat,parseInt,isInteger'
      ).split(','), function(key){
        if(has(Base, key) && !has($Number, key)){
          $.setDesc($Number, key, $.getDesc(Base, key));
        }
      });
      $Number.prototype = proto;
      proto.constructor = $Number;
       require('core-js/modules/$.redefine')(global, NUMBER, $Number);
    }
  provide("core-js/modules/es6.number.constructor", module.exports);
}(global));

// pakmanager:core-js/modules/es6.number.epsilon
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.1.2.1 Number.EPSILON
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Number', {EPSILON: Math.pow(2, -52)});
  provide("core-js/modules/es6.number.epsilon", module.exports);
}(global));

// pakmanager:core-js/modules/es6.number.is-finite
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.1.2.2 Number.isFinite(number)
    var $export   =  require('core-js/modules/$.export')
      , _isFinite =  require('core-js/modules/$.global').isFinite;
    
    $export($export.S, 'Number', {
      isFinite: function isFinite(it){
        return typeof it == 'number' && _isFinite(it);
      }
    });
  provide("core-js/modules/es6.number.is-finite", module.exports);
}(global));

// pakmanager:core-js/modules/es6.number.is-integer
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.1.2.3 Number.isInteger(number)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Number', {isInteger:  require('core-js/modules/$.is-integer')});
  provide("core-js/modules/es6.number.is-integer", module.exports);
}(global));

// pakmanager:core-js/modules/es6.number.is-nan
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.1.2.4 Number.isNaN(number)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Number', {
      isNaN: function isNaN(number){
        return number != number;
      }
    });
  provide("core-js/modules/es6.number.is-nan", module.exports);
}(global));

// pakmanager:core-js/modules/es6.number.is-safe-integer
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.1.2.5 Number.isSafeInteger(number)
    var $export   =  require('core-js/modules/$.export')
      , isInteger =  require('core-js/modules/$.is-integer')
      , abs       = Math.abs;
    
    $export($export.S, 'Number', {
      isSafeInteger: function isSafeInteger(number){
        return isInteger(number) && abs(number) <= 0x1fffffffffffff;
      }
    });
  provide("core-js/modules/es6.number.is-safe-integer", module.exports);
}(global));

// pakmanager:core-js/modules/es6.number.max-safe-integer
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.1.2.6 Number.MAX_SAFE_INTEGER
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Number', {MAX_SAFE_INTEGER: 0x1fffffffffffff});
  provide("core-js/modules/es6.number.max-safe-integer", module.exports);
}(global));

// pakmanager:core-js/modules/es6.number.min-safe-integer
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.1.2.10 Number.MIN_SAFE_INTEGER
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Number', {MIN_SAFE_INTEGER: -0x1fffffffffffff});
  provide("core-js/modules/es6.number.min-safe-integer", module.exports);
}(global));

// pakmanager:core-js/modules/es6.number.parse-float
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.1.2.12 Number.parseFloat(string)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Number', {parseFloat: parseFloat});
  provide("core-js/modules/es6.number.parse-float", module.exports);
}(global));

// pakmanager:core-js/modules/es6.number.parse-int
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.1.2.13 Number.parseInt(string, radix)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Number', {parseInt: parseInt});
  provide("core-js/modules/es6.number.parse-int", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.acosh
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.3 Math.acosh(x)
    var $export =  require('core-js/modules/$.export')
      , log1p   =  require('core-js/modules/$.math-log1p')
      , sqrt    = Math.sqrt
      , $acosh  = Math.acosh;
    
    // V8 bug https://code.google.com/p/v8/issues/detail?id=3509
    $export($export.S + $export.F * !($acosh && Math.floor($acosh(Number.MAX_VALUE)) == 710), 'Math', {
      acosh: function acosh(x){
        return (x = +x) < 1 ? NaN : x > 94906265.62425156
          ? Math.log(x) + Math.LN2
          : log1p(x - 1 + sqrt(x - 1) * sqrt(x + 1));
      }
    });
  provide("core-js/modules/es6.math.acosh", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.asinh
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.5 Math.asinh(x)
    var $export =  require('core-js/modules/$.export');
    
    function asinh(x){
      return !isFinite(x = +x) || x == 0 ? x : x < 0 ? -asinh(-x) : Math.log(x + Math.sqrt(x * x + 1));
    }
    
    $export($export.S, 'Math', {asinh: asinh});
  provide("core-js/modules/es6.math.asinh", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.atanh
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.7 Math.atanh(x)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Math', {
      atanh: function atanh(x){
        return (x = +x) == 0 ? x : Math.log((1 + x) / (1 - x)) / 2;
      }
    });
  provide("core-js/modules/es6.math.atanh", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.cbrt
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.9 Math.cbrt(x)
    var $export =  require('core-js/modules/$.export')
      , sign    =  require('core-js/modules/$.math-sign');
    
    $export($export.S, 'Math', {
      cbrt: function cbrt(x){
        return sign(x = +x) * Math.pow(Math.abs(x), 1 / 3);
      }
    });
  provide("core-js/modules/es6.math.cbrt", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.clz32
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.11 Math.clz32(x)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Math', {
      clz32: function clz32(x){
        return (x >>>= 0) ? 31 - Math.floor(Math.log(x + 0.5) * Math.LOG2E) : 32;
      }
    });
  provide("core-js/modules/es6.math.clz32", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.cosh
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.12 Math.cosh(x)
    var $export =  require('core-js/modules/$.export')
      , exp     = Math.exp;
    
    $export($export.S, 'Math', {
      cosh: function cosh(x){
        return (exp(x = +x) + exp(-x)) / 2;
      }
    });
  provide("core-js/modules/es6.math.cosh", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.expm1
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.14 Math.expm1(x)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Math', {expm1:  require('core-js/modules/$.math-expm1')});
  provide("core-js/modules/es6.math.expm1", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.fround
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.16 Math.fround(x)
    var $export   =  require('core-js/modules/$.export')
      , sign      =  require('core-js/modules/$.math-sign')
      , pow       = Math.pow
      , EPSILON   = pow(2, -52)
      , EPSILON32 = pow(2, -23)
      , MAX32     = pow(2, 127) * (2 - EPSILON32)
      , MIN32     = pow(2, -126);
    
    var roundTiesToEven = function(n){
      return n + 1 / EPSILON - 1 / EPSILON;
    };
    
    
    $export($export.S, 'Math', {
      fround: function fround(x){
        var $abs  = Math.abs(x)
          , $sign = sign(x)
          , a, result;
        if($abs < MIN32)return $sign * roundTiesToEven($abs / MIN32 / EPSILON32) * MIN32 * EPSILON32;
        a = (1 + EPSILON32 / EPSILON) * $abs;
        result = a - (a - $abs);
        if(result > MAX32 || result != result)return $sign * Infinity;
        return $sign * result;
      }
    });
  provide("core-js/modules/es6.math.fround", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.hypot
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.17 Math.hypot([value1[, value2[, … ]]])
    var $export =  require('core-js/modules/$.export')
      , abs     = Math.abs;
    
    $export($export.S, 'Math', {
      hypot: function hypot(value1, value2){ // eslint-disable-line no-unused-vars
        var sum   = 0
          , i     = 0
          , $$    = arguments
          , $$len = $$.length
          , larg  = 0
          , arg, div;
        while(i < $$len){
          arg = abs($$[i++]);
          if(larg < arg){
            div  = larg / arg;
            sum  = sum * div * div + 1;
            larg = arg;
          } else if(arg > 0){
            div  = arg / larg;
            sum += div * div;
          } else sum += arg;
        }
        return larg === Infinity ? Infinity : larg * Math.sqrt(sum);
      }
    });
  provide("core-js/modules/es6.math.hypot", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.imul
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.18 Math.imul(x, y)
    var $export =  require('core-js/modules/$.export')
      , $imul   = Math.imul;
    
    // some WebKit versions fails with big numbers, some has wrong arity
    $export($export.S + $export.F *  require('core-js/modules/$.fails')(function(){
      return $imul(0xffffffff, 5) != -5 || $imul.length != 2;
    }), 'Math', {
      imul: function imul(x, y){
        var UINT16 = 0xffff
          , xn = +x
          , yn = +y
          , xl = UINT16 & xn
          , yl = UINT16 & yn;
        return 0 | xl * yl + ((UINT16 & xn >>> 16) * yl + xl * (UINT16 & yn >>> 16) << 16 >>> 0);
      }
    });
  provide("core-js/modules/es6.math.imul", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.log10
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.21 Math.log10(x)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Math', {
      log10: function log10(x){
        return Math.log(x) / Math.LN10;
      }
    });
  provide("core-js/modules/es6.math.log10", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.log1p
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.20 Math.log1p(x)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Math', {log1p:  require('core-js/modules/$.math-log1p')});
  provide("core-js/modules/es6.math.log1p", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.log2
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.22 Math.log2(x)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Math', {
      log2: function log2(x){
        return Math.log(x) / Math.LN2;
      }
    });
  provide("core-js/modules/es6.math.log2", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.sign
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.28 Math.sign(x)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Math', {sign:  require('core-js/modules/$.math-sign')});
  provide("core-js/modules/es6.math.sign", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.sinh
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.30 Math.sinh(x)
    var $export =  require('core-js/modules/$.export')
      , expm1   =  require('core-js/modules/$.math-expm1')
      , exp     = Math.exp;
    
    // V8 near Chromium 38 has a problem with very small numbers
    $export($export.S + $export.F *  require('core-js/modules/$.fails')(function(){
      return !Math.sinh(-2e-17) != -2e-17;
    }), 'Math', {
      sinh: function sinh(x){
        return Math.abs(x = +x) < 1
          ? (expm1(x) - expm1(-x)) / 2
          : (exp(x - 1) - exp(-x - 1)) * (Math.E / 2);
      }
    });
  provide("core-js/modules/es6.math.sinh", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.tanh
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.33 Math.tanh(x)
    var $export =  require('core-js/modules/$.export')
      , expm1   =  require('core-js/modules/$.math-expm1')
      , exp     = Math.exp;
    
    $export($export.S, 'Math', {
      tanh: function tanh(x){
        var a = expm1(x = +x)
          , b = expm1(-x);
        return a == Infinity ? 1 : b == Infinity ? -1 : (a - b) / (exp(x) + exp(-x));
      }
    });
  provide("core-js/modules/es6.math.tanh", module.exports);
}(global));

// pakmanager:core-js/modules/es6.math.trunc
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 20.2.2.34 Math.trunc(x)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Math', {
      trunc: function trunc(it){
        return (it > 0 ? Math.floor : Math.ceil)(it);
      }
    });
  provide("core-js/modules/es6.math.trunc", module.exports);
}(global));

// pakmanager:core-js/modules/es6.string.from-code-point
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $export        =  require('core-js/modules/$.export')
      , toIndex        =  require('core-js/modules/$.to-index')
      , fromCharCode   = String.fromCharCode
      , $fromCodePoint = String.fromCodePoint;
    
    // length should be 1, old FF problem
    $export($export.S + $export.F * (!!$fromCodePoint && $fromCodePoint.length != 1), 'String', {
      // 21.1.2.2 String.fromCodePoint(...codePoints)
      fromCodePoint: function fromCodePoint(x){ // eslint-disable-line no-unused-vars
        var res   = []
          , $$    = arguments
          , $$len = $$.length
          , i     = 0
          , code;
        while($$len > i){
          code = +$$[i++];
          if(toIndex(code, 0x10ffff) !== code)throw RangeError(code + ' is not a valid code point');
          res.push(code < 0x10000
            ? fromCharCode(code)
            : fromCharCode(((code -= 0x10000) >> 10) + 0xd800, code % 0x400 + 0xdc00)
          );
        } return res.join('');
      }
    });
  provide("core-js/modules/es6.string.from-code-point", module.exports);
}(global));

// pakmanager:core-js/modules/es6.string.raw
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $export   =  require('core-js/modules/$.export')
      , toIObject =  require('core-js/modules/$.to-iobject')
      , toLength  =  require('core-js/modules/$.to-length');
    
    $export($export.S, 'String', {
      // 21.1.2.4 String.raw(callSite, ...substitutions)
      raw: function raw(callSite){
        var tpl   = toIObject(callSite.raw)
          , len   = toLength(tpl.length)
          , $$    = arguments
          , $$len = $$.length
          , res   = []
          , i     = 0;
        while(len > i){
          res.push(String(tpl[i++]));
          if(i < $$len)res.push(String($$[i]));
        } return res.join('');
      }
    });
  provide("core-js/modules/es6.string.raw", module.exports);
}(global));

// pakmanager:core-js/modules/es6.string.trim
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    // 21.1.3.25 String.prototype.trim()
     require('core-js/modules/$.string-trim')('trim', function($trim){
      return function trim(){
        return $trim(this, 3);
      };
    });
  provide("core-js/modules/es6.string.trim", module.exports);
}(global));

// pakmanager:core-js/modules/es6.string.iterator
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $at  =  require('core-js/modules/$.string-at')(true);
    
    // 21.1.3.27 String.prototype[@@iterator]()
     require('core-js/modules/$.iter-define')(String, 'String', function(iterated){
      this._t = String(iterated); // target
      this._i = 0;                // next index
    // 21.1.5.2.1 %StringIteratorPrototype%.next()
    }, function(){
      var O     = this._t
        , index = this._i
        , point;
      if(index >= O.length)return {value: undefined, done: true};
      point = $at(O, index);
      this._i += point.length;
      return {value: point, done: false};
    });
  provide("core-js/modules/es6.string.iterator", module.exports);
}(global));

// pakmanager:core-js/modules/es6.string.code-point-at
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $export =  require('core-js/modules/$.export')
      , $at     =  require('core-js/modules/$.string-at')(false);
    $export($export.P, 'String', {
      // 21.1.3.3 String.prototype.codePointAt(pos)
      codePointAt: function codePointAt(pos){
        return $at(this, pos);
      }
    });
  provide("core-js/modules/es6.string.code-point-at", module.exports);
}(global));

// pakmanager:core-js/modules/es6.string.ends-with
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 21.1.3.6 String.prototype.endsWith(searchString [, endPosition])
    'use strict';
    var $export   =  require('core-js/modules/$.export')
      , toLength  =  require('core-js/modules/$.to-length')
      , context   =  require('core-js/modules/$.string-context')
      , ENDS_WITH = 'endsWith'
      , $endsWith = ''[ENDS_WITH];
    
    $export($export.P + $export.F *  require('core-js/modules/$.fails-is-regexp')(ENDS_WITH), 'String', {
      endsWith: function endsWith(searchString /*, endPosition = @length */){
        var that = context(this, searchString, ENDS_WITH)
          , $$   = arguments
          , endPosition = $$.length > 1 ? $$[1] : undefined
          , len    = toLength(that.length)
          , end    = endPosition === undefined ? len : Math.min(toLength(endPosition), len)
          , search = String(searchString);
        return $endsWith
          ? $endsWith.call(that, search, end)
          : that.slice(end - search.length, end) === search;
      }
    });
  provide("core-js/modules/es6.string.ends-with", module.exports);
}(global));

// pakmanager:core-js/modules/es6.string.includes
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 21.1.3.7 String.prototype.includes(searchString, position = 0)
    'use strict';
    var $export  =  require('core-js/modules/$.export')
      , context  =  require('core-js/modules/$.string-context')
      , INCLUDES = 'includes';
    
    $export($export.P + $export.F *  require('core-js/modules/$.fails-is-regexp')(INCLUDES), 'String', {
      includes: function includes(searchString /*, position = 0 */){
        return !!~context(this, searchString, INCLUDES)
          .indexOf(searchString, arguments.length > 1 ? arguments[1] : undefined);
      }
    });
  provide("core-js/modules/es6.string.includes", module.exports);
}(global));

// pakmanager:core-js/modules/es6.string.repeat
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $export =  require('core-js/modules/$.export');
    
    $export($export.P, 'String', {
      // 21.1.3.13 String.prototype.repeat(count)
      repeat:  require('core-js/modules/$.string-repeat')
    });
  provide("core-js/modules/es6.string.repeat", module.exports);
}(global));

// pakmanager:core-js/modules/es6.string.starts-with
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 21.1.3.18 String.prototype.startsWith(searchString [, position ])
    'use strict';
    var $export     =  require('core-js/modules/$.export')
      , toLength    =  require('core-js/modules/$.to-length')
      , context     =  require('core-js/modules/$.string-context')
      , STARTS_WITH = 'startsWith'
      , $startsWith = ''[STARTS_WITH];
    
    $export($export.P + $export.F *  require('core-js/modules/$.fails-is-regexp')(STARTS_WITH), 'String', {
      startsWith: function startsWith(searchString /*, position = 0 */){
        var that   = context(this, searchString, STARTS_WITH)
          , $$     = arguments
          , index  = toLength(Math.min($$.length > 1 ? $$[1] : undefined, that.length))
          , search = String(searchString);
        return $startsWith
          ? $startsWith.call(that, search, index)
          : that.slice(index, index + search.length) === search;
      }
    });
  provide("core-js/modules/es6.string.starts-with", module.exports);
}(global));

// pakmanager:core-js/modules/es6.array.from
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var ctx         =  require('core-js/modules/$.ctx')
      , $export     =  require('core-js/modules/$.export')
      , toObject    =  require('core-js/modules/$.to-object')
      , call        =  require('core-js/modules/$.iter-call')
      , isArrayIter =  require('core-js/modules/$.is-array-iter')
      , toLength    =  require('core-js/modules/$.to-length')
      , getIterFn   =  require('core-js/modules/core.get-iterator-method');
    $export($export.S + $export.F * ! require('core-js/modules/$.iter-detect')(function(iter){ Array.from(iter); }), 'Array', {
      // 22.1.2.1 Array.from(arrayLike, mapfn = undefined, thisArg = undefined)
      from: function from(arrayLike/*, mapfn = undefined, thisArg = undefined*/){
        var O       = toObject(arrayLike)
          , C       = typeof this == 'function' ? this : Array
          , $$      = arguments
          , $$len   = $$.length
          , mapfn   = $$len > 1 ? $$[1] : undefined
          , mapping = mapfn !== undefined
          , index   = 0
          , iterFn  = getIterFn(O)
          , length, result, step, iterator;
        if(mapping)mapfn = ctx(mapfn, $$len > 2 ? $$[2] : undefined, 2);
        // if object isn't iterable or it's array with default iterator - use simple case
        if(iterFn != undefined && !(C == Array && isArrayIter(iterFn))){
          for(iterator = iterFn.call(O), result = new C; !(step = iterator.next()).done; index++){
            result[index] = mapping ? call(iterator, mapfn, [step.value, index], true) : step.value;
          }
        } else {
          length = toLength(O.length);
          for(result = new C(length); length > index; index++){
            result[index] = mapping ? mapfn(O[index], index) : O[index];
          }
        }
        result.length = index;
        return result;
      }
    });
    
  provide("core-js/modules/es6.array.from", module.exports);
}(global));

// pakmanager:core-js/modules/es6.array.of
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $export =  require('core-js/modules/$.export');
    
    // WebKit Array.of isn't generic
    $export($export.S + $export.F *  require('core-js/modules/$.fails')(function(){
      function F(){}
      return !(Array.of.call(F) instanceof F);
    }), 'Array', {
      // 22.1.2.3 Array.of( ...items)
      of: function of(/* ...args */){
        var index  = 0
          , $$     = arguments
          , $$len  = $$.length
          , result = new (typeof this == 'function' ? this : Array)($$len);
        while($$len > index)result[index] = $$[index++];
        result.length = $$len;
        return result;
      }
    });
  provide("core-js/modules/es6.array.of", module.exports);
}(global));

// pakmanager:core-js/modules/es6.array.species
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
   require('core-js/modules/$.set-species')('Array');
  provide("core-js/modules/es6.array.species", module.exports);
}(global));

// pakmanager:core-js/modules/es6.array.copy-within
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 22.1.3.3 Array.prototype.copyWithin(target, start, end = this.length)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.P, 'Array', {copyWithin:  require('core-js/modules/$.array-copy-within')});
    
     require('core-js/modules/$.add-to-unscopables')('copyWithin');
  provide("core-js/modules/es6.array.copy-within", module.exports);
}(global));

// pakmanager:core-js/modules/es6.array.fill
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 22.1.3.6 Array.prototype.fill(value, start = 0, end = this.length)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.P, 'Array', {fill:  require('core-js/modules/$.array-fill')});
    
     require('core-js/modules/$.add-to-unscopables')('fill');
  provide("core-js/modules/es6.array.fill", module.exports);
}(global));

// pakmanager:core-js/modules/es6.array.find
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    // 22.1.3.8 Array.prototype.find(predicate, thisArg = undefined)
    var $export =  require('core-js/modules/$.export')
      , $find   =  require('core-js/modules/$.array-methods')(5)
      , KEY     = 'find'
      , forced  = true;
    // Shouldn't skip holes
    if(KEY in [])Array(1)[KEY](function(){ forced = false; });
    $export($export.P + $export.F * forced, 'Array', {
      find: function find(callbackfn/*, that = undefined */){
        return $find(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
      }
    });
     require('core-js/modules/$.add-to-unscopables')(KEY);
  provide("core-js/modules/es6.array.find", module.exports);
}(global));

// pakmanager:core-js/modules/es6.array.find-index
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    // 22.1.3.9 Array.prototype.findIndex(predicate, thisArg = undefined)
    var $export =  require('core-js/modules/$.export')
      , $find   =  require('core-js/modules/$.array-methods')(6)
      , KEY     = 'findIndex'
      , forced  = true;
    // Shouldn't skip holes
    if(KEY in [])Array(1)[KEY](function(){ forced = false; });
    $export($export.P + $export.F * forced, 'Array', {
      findIndex: function findIndex(callbackfn/*, that = undefined */){
        return $find(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
      }
    });
     require('core-js/modules/$.add-to-unscopables')(KEY);
  provide("core-js/modules/es6.array.find-index", module.exports);
}(global));

// pakmanager:core-js/modules/es6.regexp.constructor
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $        =  require('core-js/modules/
      , global   =  require('core-js/modules/$.global')
      , isRegExp =  require('core-js/modules/$.is-regexp')
      , $flags   =  require('core-js/modules/$.flags')
      , $RegExp  = global.RegExp
      , Base     = $RegExp
      , proto    = $RegExp.prototype
      , re1      = /a/g
      , re2      = /a/g
      // "new" creates a new object, old webkit buggy here
      , CORRECT_NEW = new $RegExp(re1) !== re1;
    
    if( require('core-js/modules/$.descriptors') && (!CORRECT_NEW ||  require('core-js/modules/$.fails')(function(){
      re2[ require('core-js/modules/$.wks')('match')] = false;
      // RegExp constructor can alter flags and IsRegExp works correct with @@match
      return $RegExp(re1) != re1 || $RegExp(re2) == re2 || $RegExp(re1, 'i') != '/a/i';
    }))){
      $RegExp = function RegExp(p, f){
        var piRE = isRegExp(p)
          , fiU  = f === undefined;
        return !(this instanceof $RegExp) && piRE && p.constructor === $RegExp && fiU ? p
          : CORRECT_NEW
            ? new Base(piRE && !fiU ? p.source : p, f)
            : Base((piRE = p instanceof $RegExp) ? p.source : p, piRE && fiU ? $flags.call(p) : f);
      };
      $.each.call($.getNames(Base), function(key){
        key in $RegExp || $.setDesc($RegExp, key, {
          configurable: true,
          get: function(){ return Base[key]; },
          set: function(it){ Base[key] = it; }
        });
      });
      proto.constructor = $RegExp;
      $RegExp.prototype = proto;
       require('core-js/modules/$.redefine')(global, 'RegExp', $RegExp);
    }
    
     require('core-js/modules/$.set-species')('RegExp');)
      , global   =  require('core-js/modules/$.global')
      , isRegExp =  require('core-js/modules/$.is-regexp')
      , $flags   =  require('core-js/modules/$.flags')
      , $RegExp  = global.RegExp
      , Base     = $RegExp
      , proto    = $RegExp.prototype
      , re1      = /a/g
      , re2      = /a/g
      // "new" creates a new object, old webkit buggy here
      , CORRECT_NEW = new $RegExp(re1) !== re1;
    
    if( require('core-js/modules/$.descriptors') && (!CORRECT_NEW ||  require('core-js/modules/$.fails')(function(){
      re2[ require('core-js/modules/$.wks')('match')] = false;
      // RegExp constructor can alter flags and IsRegExp works correct with @@match
      return $RegExp(re1) != re1 || $RegExp(re2) == re2 || $RegExp(re1, 'i') != '/a/i';
    }))){
      $RegExp = function RegExp(p, f){
        var piRE = isRegExp(p)
          , fiU  = f === undefined;
        return !(this instanceof $RegExp) && piRE && p.constructor === $RegExp && fiU ? p
          : CORRECT_NEW
            ? new Base(piRE && !fiU ? p.source : p, f)
            : Base((piRE = p instanceof $RegExp) ? p.source : p, piRE && fiU ? $flags.call(p) : f);
      };
      $.each.call($.getNames(Base), function(key){
        key in $RegExp || $.setDesc($RegExp, key, {
          configurable: true,
          get: function(){ return Base[key]; },
          set: function(it){ Base[key] = it; }
        });
      });
      proto.constructor = $RegExp;
      $RegExp.prototype = proto;
       require('core-js/modules/$.redefine')(global, 'RegExp', $RegExp);
    }
    
     require('core-js/modules/$.set-species')('RegExp');
  provide("core-js/modules/es6.regexp.constructor", module.exports);
}(global));

// pakmanager:core-js/modules/es6.regexp.flags
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 21.2.5.3 get RegExp.prototype.flags()
    var $ =  require('core-js/modules/;
    if( require('core-js/modules/$.descriptors') && /./g.flags != 'g')$.setDesc(RegExp.prototype, 'flags', {
      configurable: true,
      get:  require('core-js/modules/$.flags')
    }););
    if( require('core-js/modules/$.descriptors') && /./g.flags != 'g')$.setDesc(RegExp.prototype, 'flags', {
      configurable: true,
      get:  require('core-js/modules/$.flags')
    });
  provide("core-js/modules/es6.regexp.flags", module.exports);
}(global));

// pakmanager:core-js/modules/es6.regexp.match
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // @@match logic
     require('core-js/modules/$.fix-re-wks')('match', 1, function(defined, MATCH){
      // 21.1.3.11 String.prototype.match(regexp)
      return function match(regexp){
        'use strict';
        var O  = defined(this)
          , fn = regexp == undefined ? undefined : regexp[MATCH];
        return fn !== undefined ? fn.call(regexp, O) : new RegExp(regexp)[MATCH](String(O));
      };
    });
  provide("core-js/modules/es6.regexp.match", module.exports);
}(global));

// pakmanager:core-js/modules/es6.regexp.replace
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // @@replace logic
     require('core-js/modules/$.fix-re-wks')('replace', 2, function(defined, REPLACE, $replace){
      // 21.1.3.14 String.prototype.replace(searchValue, replaceValue)
      return function replace(searchValue, replaceValue){
        'use strict';
        var O  = defined(this)
          , fn = searchValue == undefined ? undefined : searchValue[REPLACE];
        return fn !== undefined
          ? fn.call(searchValue, O, replaceValue)
          : $replace.call(String(O), searchValue, replaceValue);
      };
    });
  provide("core-js/modules/es6.regexp.replace", module.exports);
}(global));

// pakmanager:core-js/modules/es6.regexp.search
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // @@search logic
     require('core-js/modules/$.fix-re-wks')('search', 1, function(defined, SEARCH){
      // 21.1.3.15 String.prototype.search(regexp)
      return function search(regexp){
        'use strict';
        var O  = defined(this)
          , fn = regexp == undefined ? undefined : regexp[SEARCH];
        return fn !== undefined ? fn.call(regexp, O) : new RegExp(regexp)[SEARCH](String(O));
      };
    });
  provide("core-js/modules/es6.regexp.search", module.exports);
}(global));

// pakmanager:core-js/modules/es6.regexp.split
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // @@split logic
     require('core-js/modules/$.fix-re-wks')('split', 2, function(defined, SPLIT, $split){
      // 21.1.3.17 String.prototype.split(separator, limit)
      return function split(separator, limit){
        'use strict';
        var O  = defined(this)
          , fn = separator == undefined ? undefined : separator[SPLIT];
        return fn !== undefined
          ? fn.call(separator, O, limit)
          : $split.call(String(O), separator, limit);
      };
    });
  provide("core-js/modules/es6.regexp.split", module.exports);
}(global));

// pakmanager:core-js/modules/es6.promise
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $          =  require('core-js/modules/
      , LIBRARY    =  require('core-js/modules/$.library')
      , global     =  require('core-js/modules/$.global')
      , ctx        =  require('core-js/modules/$.ctx')
      , classof    =  require('core-js/modules/$.classof')
      , $export    =  require('core-js/modules/$.export')
      , isObject   =  require('core-js/modules/$.is-object')
      , anObject   =  require('core-js/modules/$.an-object')
      , aFunction  =  require('core-js/modules/$.a-function')
      , strictNew  =  require('core-js/modules/$.strict-new')
      , forOf      =  require('core-js/modules/$.for-of')
      , setProto   =  require('core-js/modules/$.set-proto').set
      , same       =  require('core-js/modules/$.same-value')
      , SPECIES    =  require('core-js/modules/$.wks')('species')
      , speciesConstructor =  require('core-js/modules/$.species-constructor')
      , asap       =  require('core-js/modules/$.microtask')
      , PROMISE    = 'Promise'
      , process    = global.process
      , isNode     = classof(process) == 'process'
      , P          = global[PROMISE]
      , empty      = function(){ /* empty */ }
      , Wrapper;
    
    var testResolve = function(sub){
      var test = new P(empty), promise;
      if(sub)test.constructor = function(exec){
        exec(empty, empty);
      };
      (promise = P.resolve(test))['catch'](empty);
      return promise === test;
    };
    
    var USE_NATIVE = function(){
      var works = false;
      function P2(x){
        var self = new P(x);
        setProto(self, P2.prototype);
        return self;
      }
      try {
        works = P && P.resolve && testResolve();
        setProto(P2, P);
        P2.prototype = $.create(P.prototype, {constructor: {value: P2}});
        // actual Firefox has broken subclass support, test that
        if(!(P2.resolve(5).then(function(){}) instanceof P2)){
          works = false;
        }
        // actual V8 bug, https://code.google.com/p/v8/issues/detail?id=4162
        if(works &&  require('core-js/modules/$.descriptors')){
          var thenableThenGotten = false;
          P.resolve($.setDesc({}, 'then', {
            get: function(){ thenableThenGotten = true; }
          }));
          works = thenableThenGotten;
        }
      } catch(e){ works = false; }
      return works;
    }();
    
    // helpers
    var sameConstructor = function(a, b){
      // library wrapper special case
      if(LIBRARY && a === P && b === Wrapper)return true;
      return same(a, b);
    };
    var getConstructor = function(C){
      var S = anObject(C)[SPECIES];
      return S != undefined ? S : C;
    };
    var isThenable = function(it){
      var then;
      return isObject(it) && typeof (then = it.then) == 'function' ? then : false;
    };
    var PromiseCapability = function(C){
      var resolve, reject;
      this.promise = new C(function($$resolve, $$reject){
        if(resolve !== undefined || reject !== undefined)throw TypeError('Bad Promise constructor');
        resolve = $$resolve;
        reject  = $$reject;
      });
      this.resolve = aFunction(resolve),
      this.reject  = aFunction(reject)
    };
    var perform = function(exec){
      try {
        exec();
      } catch(e){
        return {error: e};
      }
    };
    var notify = function(record, isReject){
      if(record.n)return;
      record.n = true;
      var chain = record.c;
      asap(function(){
        var value = record.v
          , ok    = record.s == 1
          , i     = 0;
        var run = function(reaction){
          var handler = ok ? reaction.ok : reaction.fail
            , resolve = reaction.resolve
            , reject  = reaction.reject
            , result, then;
          try {
            if(handler){
              if(!ok)record.h = true;
              result = handler === true ? value : handler(value);
              if(result === reaction.promise){
                reject(TypeError('Promise-chain cycle'));
              } else if(then = isThenable(result)){
                then.call(result, resolve, reject);
              } else resolve(result);
            } else reject(value);
          } catch(e){
            reject(e);
          }
        };
        while(chain.length > i)run(chain[i++]); // variable length - can't use forEach
        chain.length = 0;
        record.n = false;
        if(isReject)setTimeout(function(){
          var promise = record.p
            , handler, console;
          if(isUnhandled(promise)){
            if(isNode){
              process.emit('unhandledRejection', value, promise);
            } else if(handler = global.onunhandledrejection){
              handler({promise: promise, reason: value});
            } else if((console = global.console) && console.error){
              console.error('Unhandled promise rejection', value);
            }
          } record.a = undefined;
        }, 1);
      });
    };
    var isUnhandled = function(promise){
      var record = promise._d
        , chain  = record.a || record.c
        , i      = 0
        , reaction;
      if(record.h)return false;
      while(chain.length > i){
        reaction = chain[i++];
        if(reaction.fail || !isUnhandled(reaction.promise))return false;
      } return true;
    };
    var $reject = function(value){
      var record = this;
      if(record.d)return;
      record.d = true;
      record = record.r || record; // unwrap
      record.v = value;
      record.s = 2;
      record.a = record.c.slice();
      notify(record, true);
    };
    var $resolve = function(value){
      var record = this
        , then;
      if(record.d)return;
      record.d = true;
      record = record.r || record; // unwrap
      try {
        if(record.p === value)throw TypeError("Promise can't be resolved itself");
        if(then = isThenable(value)){
          asap(function(){
            var wrapper = {r: record, d: false}; // wrap
            try {
              then.call(value, ctx($resolve, wrapper, 1), ctx($reject, wrapper, 1));
            } catch(e){
              $reject.call(wrapper, e);
            }
          });
        } else {
          record.v = value;
          record.s = 1;
          notify(record, false);
        }
      } catch(e){
        $reject.call({r: record, d: false}, e); // wrap
      }
    };
    
    // constructor polyfill
    if(!USE_NATIVE){
      // 25.4.3.1 Promise(executor)
      P = function Promise(executor){
        aFunction(executor);
        var record = this._d = {
          p: strictNew(this, P, PROMISE),         // <- promise
          c: [],                                  // <- awaiting reactions
          a: undefined,                           // <- checked in isUnhandled reactions
          s: 0,                                   // <- state
          d: false,                               // <- done
          v: undefined,                           // <- value
          h: false,                               // <- handled rejection
          n: false                                // <- notify
        };
        try {
          executor(ctx($resolve, record, 1), ctx($reject, record, 1));
        } catch(err){
          $reject.call(record, err);
        }
      };
       require('core-js/modules/$.redefine-all')(P.prototype, {
        // 25.4.5.3 Promise.prototype.then(onFulfilled, onRejected)
        then: function then(onFulfilled, onRejected){
          var reaction = new PromiseCapability(speciesConstructor(this, P))
            , promise  = reaction.promise
            , record   = this._d;
          reaction.ok   = typeof onFulfilled == 'function' ? onFulfilled : true;
          reaction.fail = typeof onRejected == 'function' && onRejected;
          record.c.push(reaction);
          if(record.a)record.a.push(reaction);
          if(record.s)notify(record, false);
          return promise;
        },
        // 25.4.5.1 Promise.prototype.catch(onRejected)
        'catch': function(onRejected){
          return this.then(undefined, onRejected);
        }
      });
    }
    
    $export($export.G + $export.W + $export.F * !USE_NATIVE, {Promise: P});
     require('core-js/modules/$.set-to-string-tag')(P, PROMISE);
     require('core-js/modules/$.set-species')(PROMISE);
    Wrapper =  require('core-js/modules/$.core')[PROMISE];
    
    // statics
    $export($export.S + $export.F * !USE_NATIVE, PROMISE, {
      // 25.4.4.5 Promise.reject(r)
      reject: function reject(r){
        var capability = new PromiseCapability(this)
          , $$reject   = capability.reject;
        $$reject(r);
        return capability.promise;
      }
    });
    $export($export.S + $export.F * (!USE_NATIVE || testResolve(true)), PROMISE, {
      // 25.4.4.6 Promise.resolve(x)
      resolve: function resolve(x){
        // instanceof instead of internal slot check because we should fix it without replacement native Promise core
        if(x instanceof P && sameConstructor(x.constructor, this))return x;
        var capability = new PromiseCapability(this)
          , $$resolve  = capability.resolve;
        $$resolve(x);
        return capability.promise;
      }
    });
    $export($export.S + $export.F * !(USE_NATIVE &&  require('core-js/modules/$.iter-detect')(function(iter){
      P.all(iter)['catch'](function(){});
    })), PROMISE, {
      // 25.4.4.1 Promise.all(iterable)
      all: function all(iterable){
        var C          = getConstructor(this)
          , capability = new PromiseCapability(C)
          , resolve    = capability.resolve
          , reject     = capability.reject
          , values     = [];
        var abrupt = perform(function(){
          forOf(iterable, false, values.push, values);
          var remaining = values.length
            , results   = Array(remaining);
          if(remaining)$.each.call(values, function(promise, index){
            var alreadyCalled = false;
            C.resolve(promise).then(function(value){
              if(alreadyCalled)return;
              alreadyCalled = true;
              results[index] = value;
              --remaining || resolve(results);
            }, reject);
          });
          else resolve(results);
        });
        if(abrupt)reject(abrupt.error);
        return capability.promise;
      },
      // 25.4.4.4 Promise.race(iterable)
      race: function race(iterable){
        var C          = getConstructor(this)
          , capability = new PromiseCapability(C)
          , reject     = capability.reject;
        var abrupt = perform(function(){
          forOf(iterable, false, function(promise){
            C.resolve(promise).then(capability.resolve, reject);
          });
        });
        if(abrupt)reject(abrupt.error);
        return capability.promise;
      }
    });)
      , LIBRARY    =  require('core-js/modules/$.library')
      , global     =  require('core-js/modules/$.global')
      , ctx        =  require('core-js/modules/$.ctx')
      , classof    =  require('core-js/modules/$.classof')
      , $export    =  require('core-js/modules/$.export')
      , isObject   =  require('core-js/modules/$.is-object')
      , anObject   =  require('core-js/modules/$.an-object')
      , aFunction  =  require('core-js/modules/$.a-function')
      , strictNew  =  require('core-js/modules/$.strict-new')
      , forOf      =  require('core-js/modules/$.for-of')
      , setProto   =  require('core-js/modules/$.set-proto').set
      , same       =  require('core-js/modules/$.same-value')
      , SPECIES    =  require('core-js/modules/$.wks')('species')
      , speciesConstructor =  require('core-js/modules/$.species-constructor')
      , asap       =  require('core-js/modules/$.microtask')
      , PROMISE    = 'Promise'
      , process    = global.process
      , isNode     = classof(process) == 'process'
      , P          = global[PROMISE]
      , empty      = function(){ /* empty */ }
      , Wrapper;
    
    var testResolve = function(sub){
      var test = new P(empty), promise;
      if(sub)test.constructor = function(exec){
        exec(empty, empty);
      };
      (promise = P.resolve(test))['catch'](empty);
      return promise === test;
    };
    
    var USE_NATIVE = function(){
      var works = false;
      function P2(x){
        var self = new P(x);
        setProto(self, P2.prototype);
        return self;
      }
      try {
        works = P && P.resolve && testResolve();
        setProto(P2, P);
        P2.prototype = $.create(P.prototype, {constructor: {value: P2}});
        // actual Firefox has broken subclass support, test that
        if(!(P2.resolve(5).then(function(){}) instanceof P2)){
          works = false;
        }
        // actual V8 bug, https://code.google.com/p/v8/issues/detail?id=4162
        if(works &&  require('core-js/modules/$.descriptors')){
          var thenableThenGotten = false;
          P.resolve($.setDesc({}, 'then', {
            get: function(){ thenableThenGotten = true; }
          }));
          works = thenableThenGotten;
        }
      } catch(e){ works = false; }
      return works;
    }();
    
    // helpers
    var sameConstructor = function(a, b){
      // library wrapper special case
      if(LIBRARY && a === P && b === Wrapper)return true;
      return same(a, b);
    };
    var getConstructor = function(C){
      var S = anObject(C)[SPECIES];
      return S != undefined ? S : C;
    };
    var isThenable = function(it){
      var then;
      return isObject(it) && typeof (then = it.then) == 'function' ? then : false;
    };
    var PromiseCapability = function(C){
      var resolve, reject;
      this.promise = new C(function($$resolve, $$reject){
        if(resolve !== undefined || reject !== undefined)throw TypeError('Bad Promise constructor');
        resolve = $$resolve;
        reject  = $$reject;
      });
      this.resolve = aFunction(resolve),
      this.reject  = aFunction(reject)
    };
    var perform = function(exec){
      try {
        exec();
      } catch(e){
        return {error: e};
      }
    };
    var notify = function(record, isReject){
      if(record.n)return;
      record.n = true;
      var chain = record.c;
      asap(function(){
        var value = record.v
          , ok    = record.s == 1
          , i     = 0;
        var run = function(reaction){
          var handler = ok ? reaction.ok : reaction.fail
            , resolve = reaction.resolve
            , reject  = reaction.reject
            , result, then;
          try {
            if(handler){
              if(!ok)record.h = true;
              result = handler === true ? value : handler(value);
              if(result === reaction.promise){
                reject(TypeError('Promise-chain cycle'));
              } else if(then = isThenable(result)){
                then.call(result, resolve, reject);
              } else resolve(result);
            } else reject(value);
          } catch(e){
            reject(e);
          }
        };
        while(chain.length > i)run(chain[i++]); // variable length - can't use forEach
        chain.length = 0;
        record.n = false;
        if(isReject)setTimeout(function(){
          var promise = record.p
            , handler, console;
          if(isUnhandled(promise)){
            if(isNode){
              process.emit('unhandledRejection', value, promise);
            } else if(handler = global.onunhandledrejection){
              handler({promise: promise, reason: value});
            } else if((console = global.console) && console.error){
              console.error('Unhandled promise rejection', value);
            }
          } record.a = undefined;
        }, 1);
      });
    };
    var isUnhandled = function(promise){
      var record = promise._d
        , chain  = record.a || record.c
        , i      = 0
        , reaction;
      if(record.h)return false;
      while(chain.length > i){
        reaction = chain[i++];
        if(reaction.fail || !isUnhandled(reaction.promise))return false;
      } return true;
    };
    var $reject = function(value){
      var record = this;
      if(record.d)return;
      record.d = true;
      record = record.r || record; // unwrap
      record.v = value;
      record.s = 2;
      record.a = record.c.slice();
      notify(record, true);
    };
    var $resolve = function(value){
      var record = this
        , then;
      if(record.d)return;
      record.d = true;
      record = record.r || record; // unwrap
      try {
        if(record.p === value)throw TypeError("Promise can't be resolved itself");
        if(then = isThenable(value)){
          asap(function(){
            var wrapper = {r: record, d: false}; // wrap
            try {
              then.call(value, ctx($resolve, wrapper, 1), ctx($reject, wrapper, 1));
            } catch(e){
              $reject.call(wrapper, e);
            }
          });
        } else {
          record.v = value;
          record.s = 1;
          notify(record, false);
        }
      } catch(e){
        $reject.call({r: record, d: false}, e); // wrap
      }
    };
    
    // constructor polyfill
    if(!USE_NATIVE){
      // 25.4.3.1 Promise(executor)
      P = function Promise(executor){
        aFunction(executor);
        var record = this._d = {
          p: strictNew(this, P, PROMISE),         // <- promise
          c: [],                                  // <- awaiting reactions
          a: undefined,                           // <- checked in isUnhandled reactions
          s: 0,                                   // <- state
          d: false,                               // <- done
          v: undefined,                           // <- value
          h: false,                               // <- handled rejection
          n: false                                // <- notify
        };
        try {
          executor(ctx($resolve, record, 1), ctx($reject, record, 1));
        } catch(err){
          $reject.call(record, err);
        }
      };
       require('core-js/modules/$.redefine-all')(P.prototype, {
        // 25.4.5.3 Promise.prototype.then(onFulfilled, onRejected)
        then: function then(onFulfilled, onRejected){
          var reaction = new PromiseCapability(speciesConstructor(this, P))
            , promise  = reaction.promise
            , record   = this._d;
          reaction.ok   = typeof onFulfilled == 'function' ? onFulfilled : true;
          reaction.fail = typeof onRejected == 'function' && onRejected;
          record.c.push(reaction);
          if(record.a)record.a.push(reaction);
          if(record.s)notify(record, false);
          return promise;
        },
        // 25.4.5.1 Promise.prototype.catch(onRejected)
        'catch': function(onRejected){
          return this.then(undefined, onRejected);
        }
      });
    }
    
    $export($export.G + $export.W + $export.F * !USE_NATIVE, {Promise: P});
     require('core-js/modules/$.set-to-string-tag')(P, PROMISE);
     require('core-js/modules/$.set-species')(PROMISE);
    Wrapper =  require('core-js/modules/$.core')[PROMISE];
    
    // statics
    $export($export.S + $export.F * !USE_NATIVE, PROMISE, {
      // 25.4.4.5 Promise.reject(r)
      reject: function reject(r){
        var capability = new PromiseCapability(this)
          , $$reject   = capability.reject;
        $$reject(r);
        return capability.promise;
      }
    });
    $export($export.S + $export.F * (!USE_NATIVE || testResolve(true)), PROMISE, {
      // 25.4.4.6 Promise.resolve(x)
      resolve: function resolve(x){
        // instanceof instead of internal slot check because we should fix it without replacement native Promise core
        if(x instanceof P && sameConstructor(x.constructor, this))return x;
        var capability = new PromiseCapability(this)
          , $$resolve  = capability.resolve;
        $$resolve(x);
        return capability.promise;
      }
    });
    $export($export.S + $export.F * !(USE_NATIVE &&  require('core-js/modules/$.iter-detect')(function(iter){
      P.all(iter)['catch'](function(){});
    })), PROMISE, {
      // 25.4.4.1 Promise.all(iterable)
      all: function all(iterable){
        var C          = getConstructor(this)
          , capability = new PromiseCapability(C)
          , resolve    = capability.resolve
          , reject     = capability.reject
          , values     = [];
        var abrupt = perform(function(){
          forOf(iterable, false, values.push, values);
          var remaining = values.length
            , results   = Array(remaining);
          if(remaining)$.each.call(values, function(promise, index){
            var alreadyCalled = false;
            C.resolve(promise).then(function(value){
              if(alreadyCalled)return;
              alreadyCalled = true;
              results[index] = value;
              --remaining || resolve(results);
            }, reject);
          });
          else resolve(results);
        });
        if(abrupt)reject(abrupt.error);
        return capability.promise;
      },
      // 25.4.4.4 Promise.race(iterable)
      race: function race(iterable){
        var C          = getConstructor(this)
          , capability = new PromiseCapability(C)
          , reject     = capability.reject;
        var abrupt = perform(function(){
          forOf(iterable, false, function(promise){
            C.resolve(promise).then(capability.resolve, reject);
          });
        });
        if(abrupt)reject(abrupt.error);
        return capability.promise;
      }
    });
  provide("core-js/modules/es6.promise", module.exports);
}(global));

// pakmanager:core-js/modules/es6.map
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var strong =  require('core-js/modules/$.collection-strong');
    
    // 23.1 Map Objects
     require('core-js/modules/$.collection')('Map', function(get){
      return function Map(){ return get(this, arguments.length > 0 ? arguments[0] : undefined); };
    }, {
      // 23.1.3.6 Map.prototype.get(key)
      get: function get(key){
        var entry = strong.getEntry(this, key);
        return entry && entry.v;
      },
      // 23.1.3.9 Map.prototype.set(key, value)
      set: function set(key, value){
        return strong.def(this, key === 0 ? 0 : key, value);
      }
    }, strong, true);
  provide("core-js/modules/es6.map", module.exports);
}(global));

// pakmanager:core-js/modules/es6.set
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var strong =  require('core-js/modules/$.collection-strong');
    
    // 23.2 Set Objects
     require('core-js/modules/$.collection')('Set', function(get){
      return function Set(){ return get(this, arguments.length > 0 ? arguments[0] : undefined); };
    }, {
      // 23.2.3.1 Set.prototype.add(value)
      add: function add(value){
        return strong.def(this, value = value === 0 ? 0 : value, value);
      }
    }, strong);
  provide("core-js/modules/es6.set", module.exports);
}(global));

// pakmanager:core-js/modules/es6.weak-map
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $            =  require('core-js/modules/
      , redefine     =  require('core-js/modules/$.redefine')
      , weak         =  require('core-js/modules/$.collection-weak')
      , isObject     =  require('core-js/modules/$.is-object')
      , has          =  require('core-js/modules/$.has')
      , frozenStore  = weak.frozenStore
      , WEAK         = weak.WEAK
      , isExtensible = Object.isExtensible || isObject
      , tmp          = {};
    
    // 23.3 WeakMap Objects
    var $WeakMap =  require('core-js/modules/$.collection')('WeakMap', function(get){
      return function WeakMap(){ return get(this, arguments.length > 0 ? arguments[0] : undefined); };
    }, {
      // 23.3.3.3 WeakMap.prototype.get(key)
      get: function get(key){
        if(isObject(key)){
          if(!isExtensible(key))return frozenStore(this).get(key);
          if(has(key, WEAK))return key[WEAK][this._i];
        }
      },
      // 23.3.3.5 WeakMap.prototype.set(key, value)
      set: function set(key, value){
        return weak.def(this, key, value);
      }
    }, weak, true, true);
    
    // IE11 WeakMap frozen keys fix
    if(new $WeakMap().set((Object.freeze || Object)(tmp), 7).get(tmp) != 7){
      $.each.call(['delete', 'has', 'get', 'set'], function(key){
        var proto  = $WeakMap.prototype
          , method = proto[key];
        redefine(proto, key, function(a, b){
          // store frozen objects on leaky map
          if(isObject(a) && !isExtensible(a)){
            var result = frozenStore(this)[key](a, b);
            return key == 'set' ? this : result;
          // store all the rest on native weakmap
          } return method.call(this, a, b);
        });
      });
    })
      , redefine     =  require('core-js/modules/$.redefine')
      , weak         =  require('core-js/modules/$.collection-weak')
      , isObject     =  require('core-js/modules/$.is-object')
      , has          =  require('core-js/modules/$.has')
      , frozenStore  = weak.frozenStore
      , WEAK         = weak.WEAK
      , isExtensible = Object.isExtensible || isObject
      , tmp          = {};
    
    // 23.3 WeakMap Objects
    var $WeakMap =  require('core-js/modules/$.collection')('WeakMap', function(get){
      return function WeakMap(){ return get(this, arguments.length > 0 ? arguments[0] : undefined); };
    }, {
      // 23.3.3.3 WeakMap.prototype.get(key)
      get: function get(key){
        if(isObject(key)){
          if(!isExtensible(key))return frozenStore(this).get(key);
          if(has(key, WEAK))return key[WEAK][this._i];
        }
      },
      // 23.3.3.5 WeakMap.prototype.set(key, value)
      set: function set(key, value){
        return weak.def(this, key, value);
      }
    }, weak, true, true);
    
    // IE11 WeakMap frozen keys fix
    if(new $WeakMap().set((Object.freeze || Object)(tmp), 7).get(tmp) != 7){
      $.each.call(['delete', 'has', 'get', 'set'], function(key){
        var proto  = $WeakMap.prototype
          , method = proto[key];
        redefine(proto, key, function(a, b){
          // store frozen objects on leaky map
          if(isObject(a) && !isExtensible(a)){
            var result = frozenStore(this)[key](a, b);
            return key == 'set' ? this : result;
          // store all the rest on native weakmap
          } return method.call(this, a, b);
        });
      });
    }
  provide("core-js/modules/es6.weak-map", module.exports);
}(global));

// pakmanager:core-js/modules/es6.weak-set
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var weak =  require('core-js/modules/$.collection-weak');
    
    // 23.4 WeakSet Objects
     require('core-js/modules/$.collection')('WeakSet', function(get){
      return function WeakSet(){ return get(this, arguments.length > 0 ? arguments[0] : undefined); };
    }, {
      // 23.4.3.1 WeakSet.prototype.add(value)
      add: function add(value){
        return weak.def(this, value, true);
      }
    }, weak, false, true);
  provide("core-js/modules/es6.weak-set", module.exports);
}(global));

// pakmanager:core-js/modules/es6.reflect.apply
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 26.1.1 Reflect.apply(target, thisArgument, argumentsList)
    var $export  =  require('core-js/modules/$.export')
      , _apply   = Function.apply
      , anObject =  require('core-js/modules/$.an-object');
    
    $export($export.S, 'Reflect', {
      apply: function apply(target, thisArgument, argumentsList){
        return _apply.call(target, thisArgument, anObject(argumentsList));
      }
    });
  provide("core-js/modules/es6.reflect.apply", module.exports);
}(global));

// pakmanager:core-js/modules/es6.reflect.construct
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 26.1.2 Reflect.construct(target, argumentsList [, newTarget])
    var $         =  require('core-js/modules/
      , $export   =  require('core-js/modules/$.export')
      , aFunction =  require('core-js/modules/$.a-function')
      , anObject  =  require('core-js/modules/$.an-object')
      , isObject  =  require('core-js/modules/$.is-object')
      , bind      = Function.bind ||  require('core-js/modules/$.core').Function.prototype.bind;
    
    // MS Edge supports only 2 arguments
    // FF Nightly sets third argument as `new.target`, but does not create `this` from it
    $export($export.S + $export.F *  require('core-js/modules/$.fails')(function(){
      function F(){}
      return !(Reflect.construct(function(){}, [], F) instanceof F);
    }), 'Reflect', {
      construct: function construct(Target, args /*, newTarget*/){
        aFunction(Target);
        anObject(args);
        var newTarget = arguments.length < 3 ? Target : aFunction(arguments[2]);
        if(Target == newTarget){
          // w/o altered newTarget, optimization for 0-4 arguments
          switch(args.length){
            case 0: return new Target;
            case 1: return new Target(args[0]);
            case 2: return new Target(args[0], args[1]);
            case 3: return new Target(args[0], args[1], args[2]);
            case 4: return new Target(args[0], args[1], args[2], args[3]);
          }
          // w/o altered newTarget, lot of arguments case
          var $args = [null];
          $args.push.apply($args, args);
          return new (bind.apply(Target, $args));
        }
        // with altered newTarget, not support built-in constructors
        var proto    = newTarget.prototype
          , instance = $.create(isObject(proto) ? proto : Object.prototype)
          , result   = Function.apply.call(Target, instance, args);
        return isObject(result) ? result : instance;
      }
    });)
      , $export   =  require('core-js/modules/$.export')
      , aFunction =  require('core-js/modules/$.a-function')
      , anObject  =  require('core-js/modules/$.an-object')
      , isObject  =  require('core-js/modules/$.is-object')
      , bind      = Function.bind ||  require('core-js/modules/$.core').Function.prototype.bind;
    
    // MS Edge supports only 2 arguments
    // FF Nightly sets third argument as `new.target`, but does not create `this` from it
    $export($export.S + $export.F *  require('core-js/modules/$.fails')(function(){
      function F(){}
      return !(Reflect.construct(function(){}, [], F) instanceof F);
    }), 'Reflect', {
      construct: function construct(Target, args /*, newTarget*/){
        aFunction(Target);
        anObject(args);
        var newTarget = arguments.length < 3 ? Target : aFunction(arguments[2]);
        if(Target == newTarget){
          // w/o altered newTarget, optimization for 0-4 arguments
          switch(args.length){
            case 0: return new Target;
            case 1: return new Target(args[0]);
            case 2: return new Target(args[0], args[1]);
            case 3: return new Target(args[0], args[1], args[2]);
            case 4: return new Target(args[0], args[1], args[2], args[3]);
          }
          // w/o altered newTarget, lot of arguments case
          var $args = [null];
          $args.push.apply($args, args);
          return new (bind.apply(Target, $args));
        }
        // with altered newTarget, not support built-in constructors
        var proto    = newTarget.prototype
          , instance = $.create(isObject(proto) ? proto : Object.prototype)
          , result   = Function.apply.call(Target, instance, args);
        return isObject(result) ? result : instance;
      }
    });
  provide("core-js/modules/es6.reflect.construct", module.exports);
}(global));

// pakmanager:core-js/modules/es6.reflect.define-property
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 26.1.3 Reflect.defineProperty(target, propertyKey, attributes)
    var $        =  require('core-js/modules/
      , $export  =  require('core-js/modules/$.export')
      , anObject =  require('core-js/modules/$.an-object');
    
    // MS Edge has broken Reflect.defineProperty - throwing instead of returning false
    $export($export.S + $export.F *  require('core-js/modules/$.fails')(function(){
      Reflect.defineProperty($.setDesc({}, 1, {value: 1}), 1, {value: 2});
    }), 'Reflect', {
      defineProperty: function defineProperty(target, propertyKey, attributes){
        anObject(target);
        try {
          $.setDesc(target, propertyKey, attributes);
          return true;
        } catch(e){
          return false;
        }
      }
    });)
      , $export  =  require('core-js/modules/$.export')
      , anObject =  require('core-js/modules/$.an-object');
    
    // MS Edge has broken Reflect.defineProperty - throwing instead of returning false
    $export($export.S + $export.F *  require('core-js/modules/$.fails')(function(){
      Reflect.defineProperty($.setDesc({}, 1, {value: 1}), 1, {value: 2});
    }), 'Reflect', {
      defineProperty: function defineProperty(target, propertyKey, attributes){
        anObject(target);
        try {
          $.setDesc(target, propertyKey, attributes);
          return true;
        } catch(e){
          return false;
        }
      }
    });
  provide("core-js/modules/es6.reflect.define-property", module.exports);
}(global));

// pakmanager:core-js/modules/es6.reflect.delete-property
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 26.1.4 Reflect.deleteProperty(target, propertyKey)
    var $export  =  require('core-js/modules/$.export')
      , getDesc  =  require('core-js/modules/.getDesc
      , anObject =  require('core-js/modules/$.an-object');
    
    $export($export.S, 'Reflect', {
      deleteProperty: function deleteProperty(target, propertyKey){
        var desc = getDesc(anObject(target), propertyKey);
        return desc && !desc.configurable ? false : delete target[propertyKey];
      }
    });).getDesc
      , anObject =  require('core-js/modules/$.an-object');
    
    $export($export.S, 'Reflect', {
      deleteProperty: function deleteProperty(target, propertyKey){
        var desc = getDesc(anObject(target), propertyKey);
        return desc && !desc.configurable ? false : delete target[propertyKey];
      }
    });
  provide("core-js/modules/es6.reflect.delete-property", module.exports);
}(global));

// pakmanager:core-js/modules/es6.reflect.enumerate
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    // 26.1.5 Reflect.enumerate(target)
    var $export  =  require('core-js/modules/$.export')
      , anObject =  require('core-js/modules/$.an-object');
    var Enumerate = function(iterated){
      this._t = anObject(iterated); // target
      this._i = 0;                  // next index
      var keys = this._k = []       // keys
        , key;
      for(key in iterated)keys.push(key);
    };
     require('core-js/modules/$.iter-create')(Enumerate, 'Object', function(){
      var that = this
        , keys = that._k
        , key;
      do {
        if(that._i >= keys.length)return {value: undefined, done: true};
      } while(!((key = keys[that._i++]) in that._t));
      return {value: key, done: false};
    });
    
    $export($export.S, 'Reflect', {
      enumerate: function enumerate(target){
        return new Enumerate(target);
      }
    });
  provide("core-js/modules/es6.reflect.enumerate", module.exports);
}(global));

// pakmanager:core-js/modules/es6.reflect.get
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 26.1.6 Reflect.get(target, propertyKey [, receiver])
    var $        =  require('core-js/modules/
      , has      =  require('core-js/modules/$.has')
      , $export  =  require('core-js/modules/$.export')
      , isObject =  require('core-js/modules/$.is-object')
      , anObject =  require('core-js/modules/$.an-object');
    
    function get(target, propertyKey/*, receiver*/){
      var receiver = arguments.length < 3 ? target : arguments[2]
        , desc, proto;
      if(anObject(target) === receiver)return target[propertyKey];
      if(desc = $.getDesc(target, propertyKey))return has(desc, 'value')
        ? desc.value
        : desc.get !== undefined
          ? desc.get.call(receiver)
          : undefined;
      if(isObject(proto = $.getProto(target)))return get(proto, propertyKey, receiver);
    }
    
    $export($export.S, 'Reflect', {get: get});)
      , has      =  require('core-js/modules/$.has')
      , $export  =  require('core-js/modules/$.export')
      , isObject =  require('core-js/modules/$.is-object')
      , anObject =  require('core-js/modules/$.an-object');
    
    function get(target, propertyKey/*, receiver*/){
      var receiver = arguments.length < 3 ? target : arguments[2]
        , desc, proto;
      if(anObject(target) === receiver)return target[propertyKey];
      if(desc = $.getDesc(target, propertyKey))return has(desc, 'value')
        ? desc.value
        : desc.get !== undefined
          ? desc.get.call(receiver)
          : undefined;
      if(isObject(proto = $.getProto(target)))return get(proto, propertyKey, receiver);
    }
    
    $export($export.S, 'Reflect', {get: get});
  provide("core-js/modules/es6.reflect.get", module.exports);
}(global));

// pakmanager:core-js/modules/es6.reflect.get-own-property-descriptor
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 26.1.7 Reflect.getOwnPropertyDescriptor(target, propertyKey)
    var $        =  require('core-js/modules/
      , $export  =  require('core-js/modules/$.export')
      , anObject =  require('core-js/modules/$.an-object');
    
    $export($export.S, 'Reflect', {
      getOwnPropertyDescriptor: function getOwnPropertyDescriptor(target, propertyKey){
        return $.getDesc(anObject(target), propertyKey);
      }
    });)
      , $export  =  require('core-js/modules/$.export')
      , anObject =  require('core-js/modules/$.an-object');
    
    $export($export.S, 'Reflect', {
      getOwnPropertyDescriptor: function getOwnPropertyDescriptor(target, propertyKey){
        return $.getDesc(anObject(target), propertyKey);
      }
    });
  provide("core-js/modules/es6.reflect.get-own-property-descriptor", module.exports);
}(global));

// pakmanager:core-js/modules/es6.reflect.get-prototype-of
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 26.1.8 Reflect.getPrototypeOf(target)
    var $export  =  require('core-js/modules/$.export')
      , getProto =  require('core-js/modules/.getProto
      , anObject =  require('core-js/modules/$.an-object');
    
    $export($export.S, 'Reflect', {
      getPrototypeOf: function getPrototypeOf(target){
        return getProto(anObject(target));
      }
    });).getProto
      , anObject =  require('core-js/modules/$.an-object');
    
    $export($export.S, 'Reflect', {
      getPrototypeOf: function getPrototypeOf(target){
        return getProto(anObject(target));
      }
    });
  provide("core-js/modules/es6.reflect.get-prototype-of", module.exports);
}(global));

// pakmanager:core-js/modules/es6.reflect.has
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 26.1.9 Reflect.has(target, propertyKey)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Reflect', {
      has: function has(target, propertyKey){
        return propertyKey in target;
      }
    });
  provide("core-js/modules/es6.reflect.has", module.exports);
}(global));

// pakmanager:core-js/modules/es6.reflect.is-extensible
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 26.1.10 Reflect.isExtensible(target)
    var $export       =  require('core-js/modules/$.export')
      , anObject      =  require('core-js/modules/$.an-object')
      , $isExtensible = Object.isExtensible;
    
    $export($export.S, 'Reflect', {
      isExtensible: function isExtensible(target){
        anObject(target);
        return $isExtensible ? $isExtensible(target) : true;
      }
    });
  provide("core-js/modules/es6.reflect.is-extensible", module.exports);
}(global));

// pakmanager:core-js/modules/es6.reflect.own-keys
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 26.1.11 Reflect.ownKeys(target)
    var $export =  require('core-js/modules/$.export');
    
    $export($export.S, 'Reflect', {ownKeys:  require('core-js/modules/$.own-keys')});
  provide("core-js/modules/es6.reflect.own-keys", module.exports);
}(global));

// pakmanager:core-js/modules/es6.reflect.prevent-extensions
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 26.1.12 Reflect.preventExtensions(target)
    var $export            =  require('core-js/modules/$.export')
      , anObject           =  require('core-js/modules/$.an-object')
      , $preventExtensions = Object.preventExtensions;
    
    $export($export.S, 'Reflect', {
      preventExtensions: function preventExtensions(target){
        anObject(target);
        try {
          if($preventExtensions)$preventExtensions(target);
          return true;
        } catch(e){
          return false;
        }
      }
    });
  provide("core-js/modules/es6.reflect.prevent-extensions", module.exports);
}(global));

// pakmanager:core-js/modules/es6.reflect.set
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 26.1.13 Reflect.set(target, propertyKey, V [, receiver])
    var $          =  require('core-js/modules/
      , has        =  require('core-js/modules/$.has')
      , $export    =  require('core-js/modules/$.export')
      , createDesc =  require('core-js/modules/$.property-desc')
      , anObject   =  require('core-js/modules/$.an-object')
      , isObject   =  require('core-js/modules/$.is-object');
    
    function set(target, propertyKey, V/*, receiver*/){
      var receiver = arguments.length < 4 ? target : arguments[3]
        , ownDesc  = $.getDesc(anObject(target), propertyKey)
        , existingDescriptor, proto;
      if(!ownDesc){
        if(isObject(proto = $.getProto(target))){
          return set(proto, propertyKey, V, receiver);
        }
        ownDesc = createDesc(0);
      }
      if(has(ownDesc, 'value')){
        if(ownDesc.writable === false || !isObject(receiver))return false;
        existingDescriptor = $.getDesc(receiver, propertyKey) || createDesc(0);
        existingDescriptor.value = V;
        $.setDesc(receiver, propertyKey, existingDescriptor);
        return true;
      }
      return ownDesc.set === undefined ? false : (ownDesc.set.call(receiver, V), true);
    }
    
    $export($export.S, 'Reflect', {set: set});)
      , has        =  require('core-js/modules/$.has')
      , $export    =  require('core-js/modules/$.export')
      , createDesc =  require('core-js/modules/$.property-desc')
      , anObject   =  require('core-js/modules/$.an-object')
      , isObject   =  require('core-js/modules/$.is-object');
    
    function set(target, propertyKey, V/*, receiver*/){
      var receiver = arguments.length < 4 ? target : arguments[3]
        , ownDesc  = $.getDesc(anObject(target), propertyKey)
        , existingDescriptor, proto;
      if(!ownDesc){
        if(isObject(proto = $.getProto(target))){
          return set(proto, propertyKey, V, receiver);
        }
        ownDesc = createDesc(0);
      }
      if(has(ownDesc, 'value')){
        if(ownDesc.writable === false || !isObject(receiver))return false;
        existingDescriptor = $.getDesc(receiver, propertyKey) || createDesc(0);
        existingDescriptor.value = V;
        $.setDesc(receiver, propertyKey, existingDescriptor);
        return true;
      }
      return ownDesc.set === undefined ? false : (ownDesc.set.call(receiver, V), true);
    }
    
    $export($export.S, 'Reflect', {set: set});
  provide("core-js/modules/es6.reflect.set", module.exports);
}(global));

// pakmanager:core-js/modules/es6.reflect.set-prototype-of
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // 26.1.14 Reflect.setPrototypeOf(target, proto)
    var $export  =  require('core-js/modules/$.export')
      , setProto =  require('core-js/modules/$.set-proto');
    
    if(setProto)$export($export.S, 'Reflect', {
      setPrototypeOf: function setPrototypeOf(target, proto){
        setProto.check(target, proto);
        try {
          setProto.set(target, proto);
          return true;
        } catch(e){
          return false;
        }
      }
    });
  provide("core-js/modules/es6.reflect.set-prototype-of", module.exports);
}(global));

// pakmanager:core-js/modules/es7.array.includes
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $export   =  require('core-js/modules/$.export')
      , $includes =  require('core-js/modules/$.array-includes')(true);
    
    $export($export.P, 'Array', {
      // https://github.com/domenic/Array.prototype.includes
      includes: function includes(el /*, fromIndex = 0 */){
        return $includes(this, el, arguments.length > 1 ? arguments[1] : undefined);
      }
    });
    
     require('core-js/modules/$.add-to-unscopables')('includes');
  provide("core-js/modules/es7.array.includes", module.exports);
}(global));

// pakmanager:core-js/modules/es7.string.at
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    // https://github.com/mathiasbynens/String.prototype.at
    var $export =  require('core-js/modules/$.export')
      , $at     =  require('core-js/modules/$.string-at')(true);
    
    $export($export.P, 'String', {
      at: function at(pos){
        return $at(this, pos);
      }
    });
  provide("core-js/modules/es7.string.at", module.exports);
}(global));

// pakmanager:core-js/modules/es7.string.pad-left
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $export =  require('core-js/modules/$.export')
      , $pad    =  require('core-js/modules/$.string-pad');
    
    $export($export.P, 'String', {
      padLeft: function padLeft(maxLength /*, fillString = ' ' */){
        return $pad(this, maxLength, arguments.length > 1 ? arguments[1] : undefined, true);
      }
    });
  provide("core-js/modules/es7.string.pad-left", module.exports);
}(global));

// pakmanager:core-js/modules/es7.string.pad-right
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $export =  require('core-js/modules/$.export')
      , $pad    =  require('core-js/modules/$.string-pad');
    
    $export($export.P, 'String', {
      padRight: function padRight(maxLength /*, fillString = ' ' */){
        return $pad(this, maxLength, arguments.length > 1 ? arguments[1] : undefined, false);
      }
    });
  provide("core-js/modules/es7.string.pad-right", module.exports);
}(global));

// pakmanager:core-js/modules/es7.string.trim-left
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    // https://github.com/sebmarkbage/ecmascript-string-left-right-trim
     require('core-js/modules/$.string-trim')('trimLeft', function($trim){
      return function trimLeft(){
        return $trim(this, 1);
      };
    });
  provide("core-js/modules/es7.string.trim-left", module.exports);
}(global));

// pakmanager:core-js/modules/es7.string.trim-right
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    // https://github.com/sebmarkbage/ecmascript-string-left-right-trim
     require('core-js/modules/$.string-trim')('trimRight', function($trim){
      return function trimRight(){
        return $trim(this, 2);
      };
    });
  provide("core-js/modules/es7.string.trim-right", module.exports);
}(global));

// pakmanager:core-js/modules/es7.regexp.escape
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // https://github.com/benjamingr/RexExp.escape
    var $export =  require('core-js/modules/$.export')
      , $re     =  require('core-js/modules/$.replacer')(/[\\^$*+?.()|[\]{}]/g, '\\$&');
    
    $export($export.S, 'RegExp', {escape: function escape(it){ return $re(it); }});
    
  provide("core-js/modules/es7.regexp.escape", module.exports);
}(global));

// pakmanager:core-js/modules/es7.object.get-own-property-descriptors
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // https://gist.github.com/WebReflection/9353781
    var $          =  require('core-js/modules/
      , $export    =  require('core-js/modules/$.export')
      , ownKeys    =  require('core-js/modules/$.own-keys')
      , toIObject  =  require('core-js/modules/$.to-iobject')
      , createDesc =  require('core-js/modules/$.property-desc');
    
    $export($export.S, 'Object', {
      getOwnPropertyDescriptors: function getOwnPropertyDescriptors(object){
        var O       = toIObject(object)
          , setDesc = $.setDesc
          , getDesc = $.getDesc
          , keys    = ownKeys(O)
          , result  = {}
          , i       = 0
          , key, D;
        while(keys.length > i){
          D = getDesc(O, key = keys[i++]);
          if(key in result)setDesc(result, key, createDesc(0, D));
          else result[key] = D;
        } return result;
      }
    });)
      , $export    =  require('core-js/modules/$.export')
      , ownKeys    =  require('core-js/modules/$.own-keys')
      , toIObject  =  require('core-js/modules/$.to-iobject')
      , createDesc =  require('core-js/modules/$.property-desc');
    
    $export($export.S, 'Object', {
      getOwnPropertyDescriptors: function getOwnPropertyDescriptors(object){
        var O       = toIObject(object)
          , setDesc = $.setDesc
          , getDesc = $.getDesc
          , keys    = ownKeys(O)
          , result  = {}
          , i       = 0
          , key, D;
        while(keys.length > i){
          D = getDesc(O, key = keys[i++]);
          if(key in result)setDesc(result, key, createDesc(0, D));
          else result[key] = D;
        } return result;
      }
    });
  provide("core-js/modules/es7.object.get-own-property-descriptors", module.exports);
}(global));

// pakmanager:core-js/modules/es7.object.values
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // http://goo.gl/XkBrjD
    var $export =  require('core-js/modules/$.export')
      , $values =  require('core-js/modules/$.object-to-array')(false);
    
    $export($export.S, 'Object', {
      values: function values(it){
        return $values(it);
      }
    });
  provide("core-js/modules/es7.object.values", module.exports);
}(global));

// pakmanager:core-js/modules/es7.object.entries
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // http://goo.gl/XkBrjD
    var $export  =  require('core-js/modules/$.export')
      , $entries =  require('core-js/modules/$.object-to-array')(true);
    
    $export($export.S, 'Object', {
      entries: function entries(it){
        return $entries(it);
      }
    });
  provide("core-js/modules/es7.object.entries", module.exports);
}(global));

// pakmanager:core-js/modules/es7.map.to-json
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // https://github.com/DavidBruant/Map-Set.prototype.toJSON
    var $export  =  require('core-js/modules/$.export');
    
    $export($export.P, 'Map', {toJSON:  require('core-js/modules/$.collection-to-json')('Map')});
  provide("core-js/modules/es7.map.to-json", module.exports);
}(global));

// pakmanager:core-js/modules/es7.set.to-json
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // https://github.com/DavidBruant/Map-Set.prototype.toJSON
    var $export  =  require('core-js/modules/$.export');
    
    $export($export.P, 'Set', {toJSON:  require('core-js/modules/$.collection-to-json')('Set')});
  provide("core-js/modules/es7.set.to-json", module.exports);
}(global));

// pakmanager:core-js/modules/js.array.statics
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // JavaScript 1.6 / Strawman array statics shim
    var $       =  require('core-js/modules/
      , $export =  require('core-js/modules/$.export')
      , $ctx    =  require('core-js/modules/$.ctx')
      , $Array  =  require('core-js/modules/$.core').Array || Array
      , statics = {};
    var setStatics = function(keys, length){
      $.each.call(keys.split(','), function(key){
        if(length == undefined && key in $Array)statics[key] = $Array[key];
        else if(key in [])statics[key] = $ctx(Function.call, [][key], length);
      });
    };
    setStatics('pop,reverse,shift,keys,values,entries', 1);
    setStatics('indexOf,every,some,forEach,map,filter,find,findIndex,includes', 3);
    setStatics('join,slice,concat,push,splice,unshift,sort,lastIndexOf,' +
               'reduce,reduceRight,copyWithin,fill');
    $export($export.S, 'Array', statics);)
      , $export =  require('core-js/modules/$.export')
      , $ctx    =  require('core-js/modules/$.ctx')
      , $Array  =  require('core-js/modules/$.core').Array || Array
      , statics = {};
    var setStatics = function(keys, length){
      $.each.call(keys.split(','), function(key){
        if(length == undefined && key in $Array)statics[key] = $Array[key];
        else if(key in [])statics[key] = $ctx(Function.call, [][key], length);
      });
    };
    setStatics('pop,reverse,shift,keys,values,entries', 1);
    setStatics('indexOf,every,some,forEach,map,filter,find,findIndex,includes', 3);
    setStatics('join,slice,concat,push,splice,unshift,sort,lastIndexOf,' +
               'reduce,reduceRight,copyWithin,fill');
    $export($export.S, 'Array', statics);
  provide("core-js/modules/js.array.statics", module.exports);
}(global));

// pakmanager:core-js/modules/web.timers
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  // ie9- setTimeout & setInterval additional parameters fix
    var global     =  require('core-js/modules/$.global')
      , $export    =  require('core-js/modules/$.export')
      , invoke     =  require('core-js/modules/$.invoke')
      , partial    =  require('core-js/modules/$.partial')
      , navigator  = global.navigator
      , MSIE       = !!navigator && /MSIE .\./.test(navigator.userAgent); // <- dirty ie9- check
    var wrap = function(set){
      return MSIE ? function(fn, time /*, ...args */){
        return set(invoke(
          partial,
          [].slice.call(arguments, 2),
          typeof fn == 'function' ? fn : Function(fn)
        ), time);
      } : set;
    };
    $export($export.G + $export.B + $export.F * MSIE, {
      setTimeout:  wrap(global.setTimeout),
      setInterval: wrap(global.setInterval)
    });
  provide("core-js/modules/web.timers", module.exports);
}(global));

// pakmanager:core-js/modules/web.immediate
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $export =  require('core-js/modules/$.export')
      , $task   =  require('core-js/modules/$.task');
    $export($export.G + $export.B, {
      setImmediate:   $task.set,
      clearImmediate: $task.clear
    });
  provide("core-js/modules/web.immediate", module.exports);
}(global));

// pakmanager:core-js/modules/web.dom.iterable
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
   require('core-js/modules/es6.array.iterator');
    var global      =  require('core-js/modules/$.global')
      , hide        =  require('core-js/modules/$.hide')
      , Iterators   =  require('core-js/modules/$.iterators')
      , ITERATOR    =  require('core-js/modules/$.wks')('iterator')
      , NL          = global.NodeList
      , HTC         = global.HTMLCollection
      , NLProto     = NL && NL.prototype
      , HTCProto    = HTC && HTC.prototype
      , ArrayValues = Iterators.NodeList = Iterators.HTMLCollection = Iterators.Array;
    if(NLProto && !NLProto[ITERATOR])hide(NLProto, ITERATOR, ArrayValues);
    if(HTCProto && !HTCProto[ITERATOR])hide(HTCProto, ITERATOR, ArrayValues);
  provide("core-js/modules/web.dom.iterable", module.exports);
}(global));

// pakmanager:core-js/modules/core.is-iterable
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var classof   =  require('core-js/modules/$.classof')
      , ITERATOR  =  require('core-js/modules/$.wks')('iterator')
      , Iterators =  require('core-js/modules/$.iterators');
    module.exports =  require('core-js/modules/$.core').isIterable = function(it){
      var O = Object(it);
      return O[ITERATOR] !== undefined
        || '@@iterator' in O
        || Iterators.hasOwnProperty(classof(O));
    };
  provide("core-js/modules/core.is-iterable", module.exports);
}(global));

// pakmanager:core-js/modules/$.object-define
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $         =  require('core-js/modules/
      , ownKeys   =  require('core-js/modules/$.own-keys')
      , toIObject =  require('core-js/modules/$.to-iobject');
    
    module.exports = function define(target, mixin){
      var keys   = ownKeys(toIObject(mixin))
        , length = keys.length
        , i = 0, key;
      while(length > i)$.setDesc(target, key = keys[i++], $.getDesc(mixin, key));
      return target;
    };)
      , ownKeys   =  require('core-js/modules/$.own-keys')
      , toIObject =  require('core-js/modules/$.to-iobject');
    
    module.exports = function define(target, mixin){
      var keys   = ownKeys(toIObject(mixin))
        , length = keys.length
        , i = 0, key;
      while(length > i)$.setDesc(target, key = keys[i++], $.getDesc(mixin, key));
      return target;
    };
  provide("core-js/modules/$.object-define", module.exports);
}(global));

// pakmanager:core-js/shim
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
   require('core-js/modules/es5');
     require('core-js/modules/es6.symbol');
     require('core-js/modules/es6.object.assign');
     require('core-js/modules/es6.object.is');
     require('core-js/modules/es6.object.set-prototype-of');
     require('core-js/modules/es6.object.to-string');
     require('core-js/modules/es6.object.freeze');
     require('core-js/modules/es6.object.seal');
     require('core-js/modules/es6.object.prevent-extensions');
     require('core-js/modules/es6.object.is-frozen');
     require('core-js/modules/es6.object.is-sealed');
     require('core-js/modules/es6.object.is-extensible');
     require('core-js/modules/es6.object.get-own-property-descriptor');
     require('core-js/modules/es6.object.get-prototype-of');
     require('core-js/modules/es6.object.keys');
     require('core-js/modules/es6.object.get-own-property-names');
     require('core-js/modules/es6.function.name');
     require('core-js/modules/es6.function.has-instance');
     require('core-js/modules/es6.number.constructor');
     require('core-js/modules/es6.number.epsilon');
     require('core-js/modules/es6.number.is-finite');
     require('core-js/modules/es6.number.is-integer');
     require('core-js/modules/es6.number.is-nan');
     require('core-js/modules/es6.number.is-safe-integer');
     require('core-js/modules/es6.number.max-safe-integer');
     require('core-js/modules/es6.number.min-safe-integer');
     require('core-js/modules/es6.number.parse-float');
     require('core-js/modules/es6.number.parse-int');
     require('core-js/modules/es6.math.acosh');
     require('core-js/modules/es6.math.asinh');
     require('core-js/modules/es6.math.atanh');
     require('core-js/modules/es6.math.cbrt');
     require('core-js/modules/es6.math.clz32');
     require('core-js/modules/es6.math.cosh');
     require('core-js/modules/es6.math.expm1');
     require('core-js/modules/es6.math.fround');
     require('core-js/modules/es6.math.hypot');
     require('core-js/modules/es6.math.imul');
     require('core-js/modules/es6.math.log10');
     require('core-js/modules/es6.math.log1p');
     require('core-js/modules/es6.math.log2');
     require('core-js/modules/es6.math.sign');
     require('core-js/modules/es6.math.sinh');
     require('core-js/modules/es6.math.tanh');
     require('core-js/modules/es6.math.trunc');
     require('core-js/modules/es6.string.from-code-point');
     require('core-js/modules/es6.string.raw');
     require('core-js/modules/es6.string.trim');
     require('core-js/modules/es6.string.iterator');
     require('core-js/modules/es6.string.code-point-at');
     require('core-js/modules/es6.string.ends-with');
     require('core-js/modules/es6.string.includes');
     require('core-js/modules/es6.string.repeat');
     require('core-js/modules/es6.string.starts-with');
     require('core-js/modules/es6.array.from');
     require('core-js/modules/es6.array.of');
     require('core-js/modules/es6.array.iterator');
     require('core-js/modules/es6.array.species');
     require('core-js/modules/es6.array.copy-within');
     require('core-js/modules/es6.array.fill');
     require('core-js/modules/es6.array.find');
     require('core-js/modules/es6.array.find-index');
     require('core-js/modules/es6.regexp.constructor');
     require('core-js/modules/es6.regexp.flags');
     require('core-js/modules/es6.regexp.match');
     require('core-js/modules/es6.regexp.replace');
     require('core-js/modules/es6.regexp.search');
     require('core-js/modules/es6.regexp.split');
     require('core-js/modules/es6.promise');
     require('core-js/modules/es6.map');
     require('core-js/modules/es6.set');
     require('core-js/modules/es6.weak-map');
     require('core-js/modules/es6.weak-set');
     require('core-js/modules/es6.reflect.apply');
     require('core-js/modules/es6.reflect.construct');
     require('core-js/modules/es6.reflect.define-property');
     require('core-js/modules/es6.reflect.delete-property');
     require('core-js/modules/es6.reflect.enumerate');
     require('core-js/modules/es6.reflect.get');
     require('core-js/modules/es6.reflect.get-own-property-descriptor');
     require('core-js/modules/es6.reflect.get-prototype-of');
     require('core-js/modules/es6.reflect.has');
     require('core-js/modules/es6.reflect.is-extensible');
     require('core-js/modules/es6.reflect.own-keys');
     require('core-js/modules/es6.reflect.prevent-extensions');
     require('core-js/modules/es6.reflect.set');
     require('core-js/modules/es6.reflect.set-prototype-of');
     require('core-js/modules/es7.array.includes');
     require('core-js/modules/es7.string.at');
     require('core-js/modules/es7.string.pad-left');
     require('core-js/modules/es7.string.pad-right');
     require('core-js/modules/es7.string.trim-left');
     require('core-js/modules/es7.string.trim-right');
     require('core-js/modules/es7.regexp.escape');
     require('core-js/modules/es7.object.get-own-property-descriptors');
     require('core-js/modules/es7.object.values');
     require('core-js/modules/es7.object.entries');
     require('core-js/modules/es7.map.to-json');
     require('core-js/modules/es7.set.to-json');
     require('core-js/modules/js.array.statics');
     require('core-js/modules/web.timers');
     require('core-js/modules/web.immediate');
     require('core-js/modules/web.dom.iterable');
    module.exports =  require('core-js/modules/$.core');
  provide("core-js/shim", module.exports);
}(global));

// pakmanager:core-js/modules/core.dict
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $           =  require('core-js/modules/
      , ctx         =  require('core-js/modules/$.ctx')
      , $export     =  require('core-js/modules/$.export')
      , createDesc  =  require('core-js/modules/$.property-desc')
      , assign      =  require('core-js/modules/$.object-assign')
      , keyOf       =  require('core-js/modules/$.keyof')
      , aFunction   =  require('core-js/modules/$.a-function')
      , forOf       =  require('core-js/modules/$.for-of')
      , isIterable  =  require('core-js/modules/core.is-iterable')
      , $iterCreate =  require('core-js/modules/$.iter-create')
      , step        =  require('core-js/modules/$.iter-step')
      , isObject    =  require('core-js/modules/$.is-object')
      , toIObject   =  require('core-js/modules/$.to-iobject')
      , DESCRIPTORS =  require('core-js/modules/$.descriptors')
      , has         =  require('core-js/modules/$.has')
      , getKeys     = $.getKeys;
    
    // 0 -> Dict.forEach
    // 1 -> Dict.map
    // 2 -> Dict.filter
    // 3 -> Dict.some
    // 4 -> Dict.every
    // 5 -> Dict.find
    // 6 -> Dict.findKey
    // 7 -> Dict.mapPairs
    var createDictMethod = function(TYPE){
      var IS_MAP   = TYPE == 1
        , IS_EVERY = TYPE == 4;
      return function(object, callbackfn, that /* = undefined */){
        var f      = ctx(callbackfn, that, 3)
          , O      = toIObject(object)
          , result = IS_MAP || TYPE == 7 || TYPE == 2
              ? new (typeof this == 'function' ? this : Dict) : undefined
          , key, val, res;
        for(key in O)if(has(O, key)){
          val = O[key];
          res = f(val, key, object);
          if(TYPE){
            if(IS_MAP)result[key] = res;            // map
            else if(res)switch(TYPE){
              case 2: result[key] = val; break;     // filter
              case 3: return true;                  // some
              case 5: return val;                   // find
              case 6: return key;                   // findKey
              case 7: result[res[0]] = res[1];      // mapPairs
            } else if(IS_EVERY)return false;        // every
          }
        }
        return TYPE == 3 || IS_EVERY ? IS_EVERY : result;
      };
    };
    var findKey = createDictMethod(6);
    
    var createDictIter = function(kind){
      return function(it){
        return new DictIterator(it, kind);
      };
    };
    var DictIterator = function(iterated, kind){
      this._t = toIObject(iterated); // target
      this._a = getKeys(iterated);   // keys
      this._i = 0;                   // next index
      this._k = kind;                // kind
    };
    $iterCreate(DictIterator, 'Dict', function(){
      var that = this
        , O    = that._t
        , keys = that._a
        , kind = that._k
        , key;
      do {
        if(that._i >= keys.length){
          that._t = undefined;
          return step(1);
        }
      } while(!has(O, key = keys[that._i++]));
      if(kind == 'keys'  )return step(0, key);
      if(kind == 'values')return step(0, O[key]);
      return step(0, [key, O[key]]);
    });
    
    function Dict(iterable){
      var dict = $.create(null);
      if(iterable != undefined){
        if(isIterable(iterable)){
          forOf(iterable, true, function(key, value){
            dict[key] = value;
          });
        } else assign(dict, iterable);
      }
      return dict;
    }
    Dict.prototype = null;
    
    function reduce(object, mapfn, init){
      aFunction(mapfn);
      var O      = toIObject(object)
        , keys   = getKeys(O)
        , length = keys.length
        , i      = 0
        , memo, key;
      if(arguments.length < 3){
        if(!length)throw TypeError('Reduce of empty object with no initial value');
        memo = O[keys[i++]];
      } else memo = Object(init);
      while(length > i)if(has(O, key = keys[i++])){
        memo = mapfn(memo, O[key], key, object);
      }
      return memo;
    }
    
    function includes(object, el){
      return (el == el ? keyOf(object, el) : findKey(object, function(it){
        return it != it;
      })) !== undefined;
    }
    
    function get(object, key){
      if(has(object, key))return object[key];
    }
    function set(object, key, value){
      if(DESCRIPTORS && key in Object)$.setDesc(object, key, createDesc(0, value));
      else object[key] = value;
      return object;
    }
    
    function isDict(it){
      return isObject(it) && $.getProto(it) === Dict.prototype;
    }
    
    $export($export.G + $export.F, {Dict: Dict});
    
    $export($export.S, 'Dict', {
      keys:     createDictIter('keys'),
      values:   createDictIter('values'),
      entries:  createDictIter('entries'),
      forEach:  createDictMethod(0),
      map:      createDictMethod(1),
      filter:   createDictMethod(2),
      some:     createDictMethod(3),
      every:    createDictMethod(4),
      find:     createDictMethod(5),
      findKey:  findKey,
      mapPairs: createDictMethod(7),
      reduce:   reduce,
      keyOf:    keyOf,
      includes: includes,
      has:      has,
      get:      get,
      set:      set,
      isDict:   isDict
    });)
      , ctx         =  require('core-js/modules/$.ctx')
      , $export     =  require('core-js/modules/$.export')
      , createDesc  =  require('core-js/modules/$.property-desc')
      , assign      =  require('core-js/modules/$.object-assign')
      , keyOf       =  require('core-js/modules/$.keyof')
      , aFunction   =  require('core-js/modules/$.a-function')
      , forOf       =  require('core-js/modules/$.for-of')
      , isIterable  =  require('core-js/modules/core.is-iterable')
      , $iterCreate =  require('core-js/modules/$.iter-create')
      , step        =  require('core-js/modules/$.iter-step')
      , isObject    =  require('core-js/modules/$.is-object')
      , toIObject   =  require('core-js/modules/$.to-iobject')
      , DESCRIPTORS =  require('core-js/modules/$.descriptors')
      , has         =  require('core-js/modules/$.has')
      , getKeys     = $.getKeys;
    
    // 0 -> Dict.forEach
    // 1 -> Dict.map
    // 2 -> Dict.filter
    // 3 -> Dict.some
    // 4 -> Dict.every
    // 5 -> Dict.find
    // 6 -> Dict.findKey
    // 7 -> Dict.mapPairs
    var createDictMethod = function(TYPE){
      var IS_MAP   = TYPE == 1
        , IS_EVERY = TYPE == 4;
      return function(object, callbackfn, that /* = undefined */){
        var f      = ctx(callbackfn, that, 3)
          , O      = toIObject(object)
          , result = IS_MAP || TYPE == 7 || TYPE == 2
              ? new (typeof this == 'function' ? this : Dict) : undefined
          , key, val, res;
        for(key in O)if(has(O, key)){
          val = O[key];
          res = f(val, key, object);
          if(TYPE){
            if(IS_MAP)result[key] = res;            // map
            else if(res)switch(TYPE){
              case 2: result[key] = val; break;     // filter
              case 3: return true;                  // some
              case 5: return val;                   // find
              case 6: return key;                   // findKey
              case 7: result[res[0]] = res[1];      // mapPairs
            } else if(IS_EVERY)return false;        // every
          }
        }
        return TYPE == 3 || IS_EVERY ? IS_EVERY : result;
      };
    };
    var findKey = createDictMethod(6);
    
    var createDictIter = function(kind){
      return function(it){
        return new DictIterator(it, kind);
      };
    };
    var DictIterator = function(iterated, kind){
      this._t = toIObject(iterated); // target
      this._a = getKeys(iterated);   // keys
      this._i = 0;                   // next index
      this._k = kind;                // kind
    };
    $iterCreate(DictIterator, 'Dict', function(){
      var that = this
        , O    = that._t
        , keys = that._a
        , kind = that._k
        , key;
      do {
        if(that._i >= keys.length){
          that._t = undefined;
          return step(1);
        }
      } while(!has(O, key = keys[that._i++]));
      if(kind == 'keys'  )return step(0, key);
      if(kind == 'values')return step(0, O[key]);
      return step(0, [key, O[key]]);
    });
    
    function Dict(iterable){
      var dict = $.create(null);
      if(iterable != undefined){
        if(isIterable(iterable)){
          forOf(iterable, true, function(key, value){
            dict[key] = value;
          });
        } else assign(dict, iterable);
      }
      return dict;
    }
    Dict.prototype = null;
    
    function reduce(object, mapfn, init){
      aFunction(mapfn);
      var O      = toIObject(object)
        , keys   = getKeys(O)
        , length = keys.length
        , i      = 0
        , memo, key;
      if(arguments.length < 3){
        if(!length)throw TypeError('Reduce of empty object with no initial value');
        memo = O[keys[i++]];
      } else memo = Object(init);
      while(length > i)if(has(O, key = keys[i++])){
        memo = mapfn(memo, O[key], key, object);
      }
      return memo;
    }
    
    function includes(object, el){
      return (el == el ? keyOf(object, el) : findKey(object, function(it){
        return it != it;
      })) !== undefined;
    }
    
    function get(object, key){
      if(has(object, key))return object[key];
    }
    function set(object, key, value){
      if(DESCRIPTORS && key in Object)$.setDesc(object, key, createDesc(0, value));
      else object[key] = value;
      return object;
    }
    
    function isDict(it){
      return isObject(it) && $.getProto(it) === Dict.prototype;
    }
    
    $export($export.G + $export.F, {Dict: Dict});
    
    $export($export.S, 'Dict', {
      keys:     createDictIter('keys'),
      values:   createDictIter('values'),
      entries:  createDictIter('entries'),
      forEach:  createDictMethod(0),
      map:      createDictMethod(1),
      filter:   createDictMethod(2),
      some:     createDictMethod(3),
      every:    createDictMethod(4),
      find:     createDictMethod(5),
      findKey:  findKey,
      mapPairs: createDictMethod(7),
      reduce:   reduce,
      keyOf:    keyOf,
      includes: includes,
      has:      has,
      get:      get,
      set:      set,
      isDict:   isDict
    });
  provide("core-js/modules/core.dict", module.exports);
}(global));

// pakmanager:core-js/modules/core.get-iterator
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var anObject =  require('core-js/modules/$.an-object')
      , get      =  require('core-js/modules/core.get-iterator-method');
    module.exports =  require('core-js/modules/$.core').getIterator = function(it){
      var iterFn = get(it);
      if(typeof iterFn != 'function')throw TypeError(it + ' is not iterable!');
      return anObject(iterFn.call(it));
    };
  provide("core-js/modules/core.get-iterator", module.exports);
}(global));

// pakmanager:core-js/modules/core.delay
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var global  =  require('core-js/modules/$.global')
      , core    =  require('core-js/modules/$.core')
      , $export =  require('core-js/modules/$.export')
      , partial =  require('core-js/modules/$.partial');
    // https://esdiscuss.org/topic/promise-returning-delay-function
    $export($export.G + $export.F, {
      delay: function delay(time){
        return new (core.Promise || global.Promise)(function(resolve){
          setTimeout(partial.call(resolve, true), time);
        });
      }
    });
  provide("core-js/modules/core.delay", module.exports);
}(global));

// pakmanager:core-js/modules/core.function.part
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var path    =  require('core-js/modules/$.path')
      , $export =  require('core-js/modules/$.export');
    
    // Placeholder
     require('core-js/modules/$.core')._ = path._ = path._ || {};
    
    $export($export.P + $export.F, 'Function', {part:  require('core-js/modules/$.partial')});
  provide("core-js/modules/core.function.part", module.exports);
}(global));

// pakmanager:core-js/modules/core.object.is-object
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $export =  require('core-js/modules/$.export');
    
    $export($export.S + $export.F, 'Object', {isObject:  require('core-js/modules/$.is-object')});
  provide("core-js/modules/core.object.is-object", module.exports);
}(global));

// pakmanager:core-js/modules/core.object.classof
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $export =  require('core-js/modules/$.export');
    
    $export($export.S + $export.F, 'Object', {classof:  require('core-js/modules/$.classof')});
  provide("core-js/modules/core.object.classof", module.exports);
}(global));

// pakmanager:core-js/modules/core.object.define
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $export =  require('core-js/modules/$.export')
      , define  =  require('core-js/modules/$.object-define');
    
    $export($export.S + $export.F, 'Object', {define: define});
  provide("core-js/modules/core.object.define", module.exports);
}(global));

// pakmanager:core-js/modules/core.object.make
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $export =  require('core-js/modules/$.export')
      , define  =  require('core-js/modules/$.object-define')
      , create  =  require('core-js/modules/.create;
    
    $export($export.S + $export.F, 'Object', {
      make: function(proto, mixin){
        return define(create(proto), mixin);
      }
    });).create;
    
    $export($export.S + $export.F, 'Object', {
      make: function(proto, mixin){
        return define(create(proto), mixin);
      }
    });
  provide("core-js/modules/core.object.make", module.exports);
}(global));

// pakmanager:core-js/modules/core.number.iterator
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
     require('core-js/modules/$.iter-define')(Number, 'Number', function(iterated){
      this._l = +iterated;
      this._i = 0;
    }, function(){
      var i    = this._i++
        , done = !(i < this._l);
      return {done: done, value: done ? undefined : i};
    });
  provide("core-js/modules/core.number.iterator", module.exports);
}(global));

// pakmanager:core-js/modules/core.string.escape-html
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $export =  require('core-js/modules/$.export');
    var $re =  require('core-js/modules/$.replacer')(/[&<>"']/g, {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;'
    });
    
    $export($export.P + $export.F, 'String', {escapeHTML: function escapeHTML(){ return $re(this); }});
  provide("core-js/modules/core.string.escape-html", module.exports);
}(global));

// pakmanager:core-js/modules/core.string.unescape-html
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    var $export =  require('core-js/modules/$.export');
    var $re =  require('core-js/modules/$.replacer')(/&(?:amp|lt|gt|quot|apos);/g, {
      '&amp;':  '&',
      '&lt;':   '<',
      '&gt;':   '>',
      '&quot;': '"',
      '&apos;': "'"
    });
    
    $export($export.P + $export.F, 'String', {unescapeHTML:  function unescapeHTML(){ return $re(this); }});
  provide("core-js/modules/core.string.unescape-html", module.exports);
}(global));

// pakmanager:core-js/modules/core.log
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  var $       =  require('core-js/modules/
      , global  =  require('core-js/modules/$.global')
      , $export =  require('core-js/modules/$.export')
      , log     = {}
      , enabled = true;
    // Methods from https://github.com/DeveloperToolsWG/console-object/blob/master/api.md
    $.each.call((
      'assert,clear,count,debug,dir,dirxml,error,exception,group,groupCollapsed,groupEnd,' +
      'info,isIndependentlyComposed,log,markTimeline,profile,profileEnd,table,' +
      'time,timeEnd,timeline,timelineEnd,timeStamp,trace,warn'
    ).split(','), function(key){
      log[key] = function(){
        var $console = global.console;
        if(enabled && $console && $console[key]){
          return Function.apply.call($console[key], $console, arguments);
        }
      };
    });
    $export($export.G + $export.F, {log:  require('core-js/modules/$.object-assign')(log.log, log, {
      enable: function(){
        enabled = true;
      },
      disable: function(){
        enabled = false;
      }
    })});)
      , global  =  require('core-js/modules/$.global')
      , $export =  require('core-js/modules/$.export')
      , log     = {}
      , enabled = true;
    // Methods from https://github.com/DeveloperToolsWG/console-object/blob/master/api.md
    $.each.call((
      'assert,clear,count,debug,dir,dirxml,error,exception,group,groupCollapsed,groupEnd,' +
      'info,isIndependentlyComposed,log,markTimeline,profile,profileEnd,table,' +
      'time,timeEnd,timeline,timelineEnd,timeStamp,trace,warn'
    ).split(','), function(key){
      log[key] = function(){
        var $console = global.console;
        if(enabled && $console && $console[key]){
          return Function.apply.call($console[key], $console, arguments);
        }
      };
    });
    $export($export.G + $export.F, {log:  require('core-js/modules/$.object-assign')(log.log, log, {
      enable: function(){
        enabled = true;
      },
      disable: function(){
        enabled = false;
      }
    })});
  provide("core-js/modules/core.log", module.exports);
}(global));

// pakmanager:core-js
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
   require('core-js/shim');
     require('core-js/modules/core.dict');
     require('core-js/modules/core.get-iterator-method');
     require('core-js/modules/core.get-iterator');
     require('core-js/modules/core.is-iterable');
     require('core-js/modules/core.delay');
     require('core-js/modules/core.function.part');
     require('core-js/modules/core.object.is-object');
     require('core-js/modules/core.object.classof');
     require('core-js/modules/core.object.define');
     require('core-js/modules/core.object.make');
     require('core-js/modules/core.number.iterator');
     require('core-js/modules/core.string.escape-html');
     require('core-js/modules/core.string.unescape-html');
     require('core-js/modules/core.log');
    module.exports =  require('core-js/modules/$.core');
  provide("core-js", module.exports);
}(global));

// pakmanager:immutable
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     *  Copyright (c) 2014-2015, Facebook, Inc.
     *  All rights reserved.
     *
     *  This source code is licensed under the BSD-style license found in the
     *  LICENSE file in the root directory of this source tree. An additional grant
     *  of patent rights can be found in the PATENTS file in the same directory.
     */
    
    (function (global, factory) {
      typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
      typeof define === 'function' && define.amd ? define(factory) :
      (global.Immutable = factory());
    }(this, function () { 'use strict';var SLICE$0 = Array.prototype.slice;
    
      function createClass(ctor, superClass) {
        if (superClass) {
          ctor.prototype = Object.create(superClass.prototype);
        }
        ctor.prototype.constructor = ctor;
      }
    
      function Iterable(value) {
          return isIterable(value) ? value : Seq(value);
        }
    
    
      createClass(KeyedIterable, Iterable);
        function KeyedIterable(value) {
          return isKeyed(value) ? value : KeyedSeq(value);
        }
    
    
      createClass(IndexedIterable, Iterable);
        function IndexedIterable(value) {
          return isIndexed(value) ? value : IndexedSeq(value);
        }
    
    
      createClass(SetIterable, Iterable);
        function SetIterable(value) {
          return isIterable(value) && !isAssociative(value) ? value : SetSeq(value);
        }
    
    
    
      function isIterable(maybeIterable) {
        return !!(maybeIterable && maybeIterable[IS_ITERABLE_SENTINEL]);
      }
    
      function isKeyed(maybeKeyed) {
        return !!(maybeKeyed && maybeKeyed[IS_KEYED_SENTINEL]);
      }
    
      function isIndexed(maybeIndexed) {
        return !!(maybeIndexed && maybeIndexed[IS_INDEXED_SENTINEL]);
      }
    
      function isAssociative(maybeAssociative) {
        return isKeyed(maybeAssociative) || isIndexed(maybeAssociative);
      }
    
      function isOrdered(maybeOrdered) {
        return !!(maybeOrdered && maybeOrdered[IS_ORDERED_SENTINEL]);
      }
    
      Iterable.isIterable = isIterable;
      Iterable.isKeyed = isKeyed;
      Iterable.isIndexed = isIndexed;
      Iterable.isAssociative = isAssociative;
      Iterable.isOrdered = isOrdered;
    
      Iterable.Keyed = KeyedIterable;
      Iterable.Indexed = IndexedIterable;
      Iterable.Set = SetIterable;
    
    
      var IS_ITERABLE_SENTINEL = '@@__IMMUTABLE_ITERABLE__@@';
      var IS_KEYED_SENTINEL = '@@__IMMUTABLE_KEYED__@@';
      var IS_INDEXED_SENTINEL = '@@__IMMUTABLE_INDEXED__@@';
      var IS_ORDERED_SENTINEL = '@@__IMMUTABLE_ORDERED__@@';
    
      // Used for setting prototype methods that IE8 chokes on.
      var DELETE = 'delete';
    
      // Constants describing the size of trie nodes.
      var SHIFT = 5; // Resulted in best performance after ______?
      var SIZE = 1 << SHIFT;
      var MASK = SIZE - 1;
    
      // A consistent shared value representing "not set" which equals nothing other
      // than itself, and nothing that could be provided externally.
      var NOT_SET = {};
    
      // Boolean references, Rough equivalent of `bool &`.
      var CHANGE_LENGTH = { value: false };
      var DID_ALTER = { value: false };
    
      function MakeRef(ref) {
        ref.value = false;
        return ref;
      }
    
      function SetRef(ref) {
        ref && (ref.value = true);
      }
    
      // A function which returns a value representing an "owner" for transient writes
      // to tries. The return value will only ever equal itself, and will not equal
      // the return of any subsequent call of this function.
      function OwnerID() {}
    
      // http://jsperf.com/copy-array-inline
      function arrCopy(arr, offset) {
        offset = offset || 0;
        var len = Math.max(0, arr.length - offset);
        var newArr = new Array(len);
        for (var ii = 0; ii < len; ii++) {
          newArr[ii] = arr[ii + offset];
        }
        return newArr;
      }
    
      function ensureSize(iter) {
        if (iter.size === undefined) {
          iter.size = iter.__iterate(returnTrue);
        }
        return iter.size;
      }
    
      function wrapIndex(iter, index) {
        // This implements "is array index" which the ECMAString spec defines as:
        //
        //     A String property name P is an array index if and only if
        //     ToString(ToUint32(P)) is equal to P and ToUint32(P) is not equal
        //     to 2^32−1.
        //
        // http://www.ecma-international.org/ecma-262/6.0/#sec-array-exotic-objects
        if (typeof index !== 'number') {
          var uint32Index = index >>> 0; // N >>> 0 is shorthand for ToUint32
          if ('' + uint32Index !== index || uint32Index === 4294967295) {
            return NaN;
          }
          index = uint32Index;
        }
        return index < 0 ? ensureSize(iter) + index : index;
      }
    
      function returnTrue() {
        return true;
      }
    
      function wholeSlice(begin, end, size) {
        return (begin === 0 || (size !== undefined && begin <= -size)) &&
          (end === undefined || (size !== undefined && end >= size));
      }
    
      function resolveBegin(begin, size) {
        return resolveIndex(begin, size, 0);
      }
    
      function resolveEnd(end, size) {
        return resolveIndex(end, size, size);
      }
    
      function resolveIndex(index, size, defaultIndex) {
        return index === undefined ?
          defaultIndex :
          index < 0 ?
            Math.max(0, size + index) :
            size === undefined ?
              index :
              Math.min(size, index);
      }
    
      /* global Symbol */
    
      var ITERATE_KEYS = 0;
      var ITERATE_VALUES = 1;
      var ITERATE_ENTRIES = 2;
    
      var REAL_ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
      var FAUX_ITERATOR_SYMBOL = '@@iterator';
    
      var ITERATOR_SYMBOL = REAL_ITERATOR_SYMBOL || FAUX_ITERATOR_SYMBOL;
    
    
      function Iterator(next) {
          this.next = next;
        }
    
        Iterator.prototype.toString = function() {
          return '[Iterator]';
        };
    
    
      Iterator.KEYS = ITERATE_KEYS;
      Iterator.VALUES = ITERATE_VALUES;
      Iterator.ENTRIES = ITERATE_ENTRIES;
    
      Iterator.prototype.inspect =
      Iterator.prototype.toSource = function () { return this.toString(); }
      Iterator.prototype[ITERATOR_SYMBOL] = function () {
        return this;
      };
    
    
      function iteratorValue(type, k, v, iteratorResult) {
        var value = type === 0 ? k : type === 1 ? v : [k, v];
        iteratorResult ? (iteratorResult.value = value) : (iteratorResult = {
          value: value, done: false
        });
        return iteratorResult;
      }
    
      function iteratorDone() {
        return { value: undefined, done: true };
      }
    
      function hasIterator(maybeIterable) {
        return !!getIteratorFn(maybeIterable);
      }
    
      function isIterator(maybeIterator) {
        return maybeIterator && typeof maybeIterator.next === 'function';
      }
    
      function getIterator(iterable) {
        var iteratorFn = getIteratorFn(iterable);
        return iteratorFn && iteratorFn.call(iterable);
      }
    
      function getIteratorFn(iterable) {
        var iteratorFn = iterable && (
          (REAL_ITERATOR_SYMBOL && iterable[REAL_ITERATOR_SYMBOL]) ||
          iterable[FAUX_ITERATOR_SYMBOL]
        );
        if (typeof iteratorFn === 'function') {
          return iteratorFn;
        }
      }
    
      function isArrayLike(value) {
        return value && typeof value.length === 'number';
      }
    
      createClass(Seq, Iterable);
        function Seq(value) {
          return value === null || value === undefined ? emptySequence() :
            isIterable(value) ? value.toSeq() : seqFromValue(value);
        }
    
        Seq.of = function(/*...values*/) {
          return Seq(arguments);
        };
    
        Seq.prototype.toSeq = function() {
          return this;
        };
    
        Seq.prototype.toString = function() {
          return this.__toString('Seq {', '}');
        };
    
        Seq.prototype.cacheResult = function() {
          if (!this._cache && this.__iterateUncached) {
            this._cache = this.entrySeq().toArray();
            this.size = this._cache.length;
          }
          return this;
        };
    
        // abstract __iterateUncached(fn, reverse)
    
        Seq.prototype.__iterate = function(fn, reverse) {
          return seqIterate(this, fn, reverse, true);
        };
    
        // abstract __iteratorUncached(type, reverse)
    
        Seq.prototype.__iterator = function(type, reverse) {
          return seqIterator(this, type, reverse, true);
        };
    
    
    
      createClass(KeyedSeq, Seq);
        function KeyedSeq(value) {
          return value === null || value === undefined ?
            emptySequence().toKeyedSeq() :
            isIterable(value) ?
              (isKeyed(value) ? value.toSeq() : value.fromEntrySeq()) :
              keyedSeqFromValue(value);
        }
    
        KeyedSeq.prototype.toKeyedSeq = function() {
          return this;
        };
    
    
    
      createClass(IndexedSeq, Seq);
        function IndexedSeq(value) {
          return value === null || value === undefined ? emptySequence() :
            !isIterable(value) ? indexedSeqFromValue(value) :
            isKeyed(value) ? value.entrySeq() : value.toIndexedSeq();
        }
    
        IndexedSeq.of = function(/*...values*/) {
          return IndexedSeq(arguments);
        };
    
        IndexedSeq.prototype.toIndexedSeq = function() {
          return this;
        };
    
        IndexedSeq.prototype.toString = function() {
          return this.__toString('Seq [', ']');
        };
    
        IndexedSeq.prototype.__iterate = function(fn, reverse) {
          return seqIterate(this, fn, reverse, false);
        };
    
        IndexedSeq.prototype.__iterator = function(type, reverse) {
          return seqIterator(this, type, reverse, false);
        };
    
    
    
      createClass(SetSeq, Seq);
        function SetSeq(value) {
          return (
            value === null || value === undefined ? emptySequence() :
            !isIterable(value) ? indexedSeqFromValue(value) :
            isKeyed(value) ? value.entrySeq() : value
          ).toSetSeq();
        }
    
        SetSeq.of = function(/*...values*/) {
          return SetSeq(arguments);
        };
    
        SetSeq.prototype.toSetSeq = function() {
          return this;
        };
    
    
    
      Seq.isSeq = isSeq;
      Seq.Keyed = KeyedSeq;
      Seq.Set = SetSeq;
      Seq.Indexed = IndexedSeq;
    
      var IS_SEQ_SENTINEL = '@@__IMMUTABLE_SEQ__@@';
    
      Seq.prototype[IS_SEQ_SENTINEL] = true;
    
    
    
      createClass(ArraySeq, IndexedSeq);
        function ArraySeq(array) {
          this._array = array;
          this.size = array.length;
        }
    
        ArraySeq.prototype.get = function(index, notSetValue) {
          return this.has(index) ? this._array[wrapIndex(this, index)] : notSetValue;
        };
    
        ArraySeq.prototype.__iterate = function(fn, reverse) {
          var array = this._array;
          var maxIndex = array.length - 1;
          for (var ii = 0; ii <= maxIndex; ii++) {
            if (fn(array[reverse ? maxIndex - ii : ii], ii, this) === false) {
              return ii + 1;
            }
          }
          return ii;
        };
    
        ArraySeq.prototype.__iterator = function(type, reverse) {
          var array = this._array;
          var maxIndex = array.length - 1;
          var ii = 0;
          return new Iterator(function() 
            {return ii > maxIndex ?
              iteratorDone() :
              iteratorValue(type, ii, array[reverse ? maxIndex - ii++ : ii++])}
          );
        };
    
    
    
      createClass(ObjectSeq, KeyedSeq);
        function ObjectSeq(object) {
          var keys = Object.keys(object);
          this._object = object;
          this._keys = keys;
          this.size = keys.length;
        }
    
        ObjectSeq.prototype.get = function(key, notSetValue) {
          if (notSetValue !== undefined && !this.has(key)) {
            return notSetValue;
          }
          return this._object[key];
        };
    
        ObjectSeq.prototype.has = function(key) {
          return this._object.hasOwnProperty(key);
        };
    
        ObjectSeq.prototype.__iterate = function(fn, reverse) {
          var object = this._object;
          var keys = this._keys;
          var maxIndex = keys.length - 1;
          for (var ii = 0; ii <= maxIndex; ii++) {
            var key = keys[reverse ? maxIndex - ii : ii];
            if (fn(object[key], key, this) === false) {
              return ii + 1;
            }
          }
          return ii;
        };
    
        ObjectSeq.prototype.__iterator = function(type, reverse) {
          var object = this._object;
          var keys = this._keys;
          var maxIndex = keys.length - 1;
          var ii = 0;
          return new Iterator(function()  {
            var key = keys[reverse ? maxIndex - ii : ii];
            return ii++ > maxIndex ?
              iteratorDone() :
              iteratorValue(type, key, object[key]);
          });
        };
    
      ObjectSeq.prototype[IS_ORDERED_SENTINEL] = true;
    
    
      createClass(IterableSeq, IndexedSeq);
        function IterableSeq(iterable) {
          this._iterable = iterable;
          this.size = iterable.length || iterable.size;
        }
    
        IterableSeq.prototype.__iterateUncached = function(fn, reverse) {
          if (reverse) {
            return this.cacheResult().__iterate(fn, reverse);
          }
          var iterable = this._iterable;
          var iterator = getIterator(iterable);
          var iterations = 0;
          if (isIterator(iterator)) {
            var step;
            while (!(step = iterator.next()).done) {
              if (fn(step.value, iterations++, this) === false) {
                break;
              }
            }
          }
          return iterations;
        };
    
        IterableSeq.prototype.__iteratorUncached = function(type, reverse) {
          if (reverse) {
            return this.cacheResult().__iterator(type, reverse);
          }
          var iterable = this._iterable;
          var iterator = getIterator(iterable);
          if (!isIterator(iterator)) {
            return new Iterator(iteratorDone);
          }
          var iterations = 0;
          return new Iterator(function()  {
            var step = iterator.next();
            return step.done ? step : iteratorValue(type, iterations++, step.value);
          });
        };
    
    
    
      createClass(IteratorSeq, IndexedSeq);
        function IteratorSeq(iterator) {
          this._iterator = iterator;
          this._iteratorCache = [];
        }
    
        IteratorSeq.prototype.__iterateUncached = function(fn, reverse) {
          if (reverse) {
            return this.cacheResult().__iterate(fn, reverse);
          }
          var iterator = this._iterator;
          var cache = this._iteratorCache;
          var iterations = 0;
          while (iterations < cache.length) {
            if (fn(cache[iterations], iterations++, this) === false) {
              return iterations;
            }
          }
          var step;
          while (!(step = iterator.next()).done) {
            var val = step.value;
            cache[iterations] = val;
            if (fn(val, iterations++, this) === false) {
              break;
            }
          }
          return iterations;
        };
    
        IteratorSeq.prototype.__iteratorUncached = function(type, reverse) {
          if (reverse) {
            return this.cacheResult().__iterator(type, reverse);
          }
          var iterator = this._iterator;
          var cache = this._iteratorCache;
          var iterations = 0;
          return new Iterator(function()  {
            if (iterations >= cache.length) {
              var step = iterator.next();
              if (step.done) {
                return step;
              }
              cache[iterations] = step.value;
            }
            return iteratorValue(type, iterations, cache[iterations++]);
          });
        };
    
    
    
    
      // # pragma Helper functions
    
      function isSeq(maybeSeq) {
        return !!(maybeSeq && maybeSeq[IS_SEQ_SENTINEL]);
      }
    
      var EMPTY_SEQ;
    
      function emptySequence() {
        return EMPTY_SEQ || (EMPTY_SEQ = new ArraySeq([]));
      }
    
      function keyedSeqFromValue(value) {
        var seq =
          Array.isArray(value) ? new ArraySeq(value).fromEntrySeq() :
          isIterator(value) ? new IteratorSeq(value).fromEntrySeq() :
          hasIterator(value) ? new IterableSeq(value).fromEntrySeq() :
          typeof value === 'object' ? new ObjectSeq(value) :
          undefined;
        if (!seq) {
          throw new TypeError(
            'Expected Array or iterable object of [k, v] entries, '+
            'or keyed object: ' + value
          );
        }
        return seq;
      }
    
      function indexedSeqFromValue(value) {
        var seq = maybeIndexedSeqFromValue(value);
        if (!seq) {
          throw new TypeError(
            'Expected Array or iterable object of values: ' + value
          );
        }
        return seq;
      }
    
      function seqFromValue(value) {
        var seq = maybeIndexedSeqFromValue(value) ||
          (typeof value === 'object' && new ObjectSeq(value));
        if (!seq) {
          throw new TypeError(
            'Expected Array or iterable object of values, or keyed object: ' + value
          );
        }
        return seq;
      }
    
      function maybeIndexedSeqFromValue(value) {
        return (
          isArrayLike(value) ? new ArraySeq(value) :
          isIterator(value) ? new IteratorSeq(value) :
          hasIterator(value) ? new IterableSeq(value) :
          undefined
        );
      }
    
      function seqIterate(seq, fn, reverse, useKeys) {
        var cache = seq._cache;
        if (cache) {
          var maxIndex = cache.length - 1;
          for (var ii = 0; ii <= maxIndex; ii++) {
            var entry = cache[reverse ? maxIndex - ii : ii];
            if (fn(entry[1], useKeys ? entry[0] : ii, seq) === false) {
              return ii + 1;
            }
          }
          return ii;
        }
        return seq.__iterateUncached(fn, reverse);
      }
    
      function seqIterator(seq, type, reverse, useKeys) {
        var cache = seq._cache;
        if (cache) {
          var maxIndex = cache.length - 1;
          var ii = 0;
          return new Iterator(function()  {
            var entry = cache[reverse ? maxIndex - ii : ii];
            return ii++ > maxIndex ?
              iteratorDone() :
              iteratorValue(type, useKeys ? entry[0] : ii - 1, entry[1]);
          });
        }
        return seq.__iteratorUncached(type, reverse);
      }
    
      function fromJS(json, converter) {
        return converter ?
          fromJSWith(converter, json, '', {'': json}) :
          fromJSDefault(json);
      }
    
      function fromJSWith(converter, json, key, parentJSON) {
        if (Array.isArray(json)) {
          return converter.call(parentJSON, key, IndexedSeq(json).map(function(v, k)  {return fromJSWith(converter, v, k, json)}));
        }
        if (isPlainObj(json)) {
          return converter.call(parentJSON, key, KeyedSeq(json).map(function(v, k)  {return fromJSWith(converter, v, k, json)}));
        }
        return json;
      }
    
      function fromJSDefault(json) {
        if (Array.isArray(json)) {
          return IndexedSeq(json).map(fromJSDefault).toList();
        }
        if (isPlainObj(json)) {
          return KeyedSeq(json).map(fromJSDefault).toMap();
        }
        return json;
      }
    
      function isPlainObj(value) {
        return value && (value.constructor === Object || value.constructor === undefined);
      }
    
      /**
       * An extension of the "same-value" algorithm as [described for use by ES6 Map
       * and Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map#Key_equality)
       *
       * NaN is considered the same as NaN, however -0 and 0 are considered the same
       * value, which is different from the algorithm described by
       * [`Object.is`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is).
       *
       * This is extended further to allow Objects to describe the values they
       * represent, by way of `valueOf` or `equals` (and `hashCode`).
       *
       * Note: because of this extension, the key equality of Immutable.Map and the
       * value equality of Immutable.Set will differ from ES6 Map and Set.
       *
       * ### Defining custom values
       *
       * The easiest way to describe the value an object represents is by implementing
       * `valueOf`. For example, `Date` represents a value by returning a unix
       * timestamp for `valueOf`:
       *
       *     var date1 = new Date(1234567890000); // Fri Feb 13 2009 ...
       *     var date2 = new Date(1234567890000);
       *     date1.valueOf(); // 1234567890000
       *     assert( date1 !== date2 );
       *     assert( Immutable.is( date1, date2 ) );
       *
       * Note: overriding `valueOf` may have other implications if you use this object
       * where JavaScript expects a primitive, such as implicit string coercion.
       *
       * For more complex types, especially collections, implementing `valueOf` may
       * not be performant. An alternative is to implement `equals` and `hashCode`.
       *
       * `equals` takes another object, presumably of similar type, and returns true
       * if the it is equal. Equality is symmetrical, so the same result should be
       * returned if this and the argument are flipped.
       *
       *     assert( a.equals(b) === b.equals(a) );
       *
       * `hashCode` returns a 32bit integer number representing the object which will
       * be used to determine how to store the value object in a Map or Set. You must
       * provide both or neither methods, one must not exist without the other.
       *
       * Also, an important relationship between these methods must be upheld: if two
       * values are equal, they *must* return the same hashCode. If the values are not
       * equal, they might have the same hashCode; this is called a hash collision,
       * and while undesirable for performance reasons, it is acceptable.
       *
       *     if (a.equals(b)) {
       *       assert( a.hashCode() === b.hashCode() );
       *     }
       *
       * All Immutable collections implement `equals` and `hashCode`.
       *
       */
      function is(valueA, valueB) {
        if (valueA === valueB || (valueA !== valueA && valueB !== valueB)) {
          return true;
        }
        if (!valueA || !valueB) {
          return false;
        }
        if (typeof valueA.valueOf === 'function' &&
            typeof valueB.valueOf === 'function') {
          valueA = valueA.valueOf();
          valueB = valueB.valueOf();
          if (valueA === valueB || (valueA !== valueA && valueB !== valueB)) {
            return true;
          }
          if (!valueA || !valueB) {
            return false;
          }
        }
        if (typeof valueA.equals === 'function' &&
            typeof valueB.equals === 'function' &&
            valueA.equals(valueB)) {
          return true;
        }
        return false;
      }
    
      function deepEqual(a, b) {
        if (a === b) {
          return true;
        }
    
        if (
          !isIterable(b) ||
          a.size !== undefined && b.size !== undefined && a.size !== b.size ||
          a.__hash !== undefined && b.__hash !== undefined && a.__hash !== b.__hash ||
          isKeyed(a) !== isKeyed(b) ||
          isIndexed(a) !== isIndexed(b) ||
          isOrdered(a) !== isOrdered(b)
        ) {
          return false;
        }
    
        if (a.size === 0 && b.size === 0) {
          return true;
        }
    
        var notAssociative = !isAssociative(a);
    
        if (isOrdered(a)) {
          var entries = a.entries();
          return b.every(function(v, k)  {
            var entry = entries.next().value;
            return entry && is(entry[1], v) && (notAssociative || is(entry[0], k));
          }) && entries.next().done;
        }
    
        var flipped = false;
    
        if (a.size === undefined) {
          if (b.size === undefined) {
            if (typeof a.cacheResult === 'function') {
              a.cacheResult();
            }
          } else {
            flipped = true;
            var _ = a;
            a = b;
            b = _;
          }
        }
    
        var allEqual = true;
        var bSize = b.__iterate(function(v, k)  {
          if (notAssociative ? !a.has(v) :
              flipped ? !is(v, a.get(k, NOT_SET)) : !is(a.get(k, NOT_SET), v)) {
            allEqual = false;
            return false;
          }
        });
    
        return allEqual && a.size === bSize;
      }
    
      createClass(Repeat, IndexedSeq);
    
        function Repeat(value, times) {
          if (!(this instanceof Repeat)) {
            return new Repeat(value, times);
          }
          this._value = value;
          this.size = times === undefined ? Infinity : Math.max(0, times);
          if (this.size === 0) {
            if (EMPTY_REPEAT) {
              return EMPTY_REPEAT;
            }
            EMPTY_REPEAT = this;
          }
        }
    
        Repeat.prototype.toString = function() {
          if (this.size === 0) {
            return 'Repeat []';
          }
          return 'Repeat [ ' + this._value + ' ' + this.size + ' times ]';
        };
    
        Repeat.prototype.get = function(index, notSetValue) {
          return this.has(index) ? this._value : notSetValue;
        };
    
        Repeat.prototype.includes = function(searchValue) {
          return is(this._value, searchValue);
        };
    
        Repeat.prototype.slice = function(begin, end) {
          var size = this.size;
          return wholeSlice(begin, end, size) ? this :
            new Repeat(this._value, resolveEnd(end, size) - resolveBegin(begin, size));
        };
    
        Repeat.prototype.reverse = function() {
          return this;
        };
    
        Repeat.prototype.indexOf = function(searchValue) {
          if (is(this._value, searchValue)) {
            return 0;
          }
          return -1;
        };
    
        Repeat.prototype.lastIndexOf = function(searchValue) {
          if (is(this._value, searchValue)) {
            return this.size;
          }
          return -1;
        };
    
        Repeat.prototype.__iterate = function(fn, reverse) {
          for (var ii = 0; ii < this.size; ii++) {
            if (fn(this._value, ii, this) === false) {
              return ii + 1;
            }
          }
          return ii;
        };
    
        Repeat.prototype.__iterator = function(type, reverse) {var this$0 = this;
          var ii = 0;
          return new Iterator(function() 
            {return ii < this$0.size ? iteratorValue(type, ii++, this$0._value) : iteratorDone()}
          );
        };
    
        Repeat.prototype.equals = function(other) {
          return other instanceof Repeat ?
            is(this._value, other._value) :
            deepEqual(other);
        };
    
    
      var EMPTY_REPEAT;
    
      function invariant(condition, error) {
        if (!condition) throw new Error(error);
      }
    
      createClass(Range, IndexedSeq);
    
        function Range(start, end, step) {
          if (!(this instanceof Range)) {
            return new Range(start, end, step);
          }
          invariant(step !== 0, 'Cannot step a Range by 0');
          start = start || 0;
          if (end === undefined) {
            end = Infinity;
          }
          step = step === undefined ? 1 : Math.abs(step);
          if (end < start) {
            step = -step;
          }
          this._start = start;
          this._end = end;
          this._step = step;
          this.size = Math.max(0, Math.ceil((end - start) / step - 1) + 1);
          if (this.size === 0) {
            if (EMPTY_RANGE) {
              return EMPTY_RANGE;
            }
            EMPTY_RANGE = this;
          }
        }
    
        Range.prototype.toString = function() {
          if (this.size === 0) {
            return 'Range []';
          }
          return 'Range [ ' +
            this._start + '...' + this._end +
            (this._step !== 1 ? ' by ' + this._step : '') +
          ' ]';
        };
    
        Range.prototype.get = function(index, notSetValue) {
          return this.has(index) ?
            this._start + wrapIndex(this, index) * this._step :
            notSetValue;
        };
    
        Range.prototype.includes = function(searchValue) {
          var possibleIndex = (searchValue - this._start) / this._step;
          return possibleIndex >= 0 &&
            possibleIndex < this.size &&
            possibleIndex === Math.floor(possibleIndex);
        };
    
        Range.prototype.slice = function(begin, end) {
          if (wholeSlice(begin, end, this.size)) {
            return this;
          }
          begin = resolveBegin(begin, this.size);
          end = resolveEnd(end, this.size);
          if (end <= begin) {
            return new Range(0, 0);
          }
          return new Range(this.get(begin, this._end), this.get(end, this._end), this._step);
        };
    
        Range.prototype.indexOf = function(searchValue) {
          var offsetValue = searchValue - this._start;
          if (offsetValue % this._step === 0) {
            var index = offsetValue / this._step;
            if (index >= 0 && index < this.size) {
              return index
            }
          }
          return -1;
        };
    
        Range.prototype.lastIndexOf = function(searchValue) {
          return this.indexOf(searchValue);
        };
    
        Range.prototype.__iterate = function(fn, reverse) {
          var maxIndex = this.size - 1;
          var step = this._step;
          var value = reverse ? this._start + maxIndex * step : this._start;
          for (var ii = 0; ii <= maxIndex; ii++) {
            if (fn(value, ii, this) === false) {
              return ii + 1;
            }
            value += reverse ? -step : step;
          }
          return ii;
        };
    
        Range.prototype.__iterator = function(type, reverse) {
          var maxIndex = this.size - 1;
          var step = this._step;
          var value = reverse ? this._start + maxIndex * step : this._start;
          var ii = 0;
          return new Iterator(function()  {
            var v = value;
            value += reverse ? -step : step;
            return ii > maxIndex ? iteratorDone() : iteratorValue(type, ii++, v);
          });
        };
    
        Range.prototype.equals = function(other) {
          return other instanceof Range ?
            this._start === other._start &&
            this._end === other._end &&
            this._step === other._step :
            deepEqual(this, other);
        };
    
    
      var EMPTY_RANGE;
    
      createClass(Collection, Iterable);
        function Collection() {
          throw TypeError('Abstract');
        }
    
    
      createClass(KeyedCollection, Collection);function KeyedCollection() {}
    
      createClass(IndexedCollection, Collection);function IndexedCollection() {}
    
      createClass(SetCollection, Collection);function SetCollection() {}
    
    
      Collection.Keyed = KeyedCollection;
      Collection.Indexed = IndexedCollection;
      Collection.Set = SetCollection;
    
      var imul =
        typeof Math.imul === 'function' && Math.imul(0xffffffff, 2) === -2 ?
        Math.imul :
        function imul(a, b) {
          a = a | 0; // int
          b = b | 0; // int
          var c = a & 0xffff;
          var d = b & 0xffff;
          // Shift by 0 fixes the sign on the high part.
          return (c * d) + ((((a >>> 16) * d + c * (b >>> 16)) << 16) >>> 0) | 0; // int
        };
    
      // v8 has an optimization for storing 31-bit signed numbers.
      // Values which have either 00 or 11 as the high order bits qualify.
      // This function drops the highest order bit in a signed number, maintaining
      // the sign bit.
      function smi(i32) {
        return ((i32 >>> 1) & 0x40000000) | (i32 & 0xBFFFFFFF);
      }
    
      function hash(o) {
        if (o === false || o === null || o === undefined) {
          return 0;
        }
        if (typeof o.valueOf === 'function') {
          o = o.valueOf();
          if (o === false || o === null || o === undefined) {
            return 0;
          }
        }
        if (o === true) {
          return 1;
        }
        var type = typeof o;
        if (type === 'number') {
          if (o !== o || o === Infinity) {
            return 0;
          }
          var h = o | 0;
          if (h !== o) {
            h ^= o * 0xFFFFFFFF;
          }
          while (o > 0xFFFFFFFF) {
            o /= 0xFFFFFFFF;
            h ^= o;
          }
          return smi(h);
        }
        if (type === 'string') {
          return o.length > STRING_HASH_CACHE_MIN_STRLEN ? cachedHashString(o) : hashString(o);
        }
        if (typeof o.hashCode === 'function') {
          return o.hashCode();
        }
        if (type === 'object') {
          return hashJSObj(o);
        }
        if (typeof o.toString === 'function') {
          return hashString(o.toString());
        }
        throw new Error('Value type ' + type + ' cannot be hashed.');
      }
    
      function cachedHashString(string) {
        var hash = stringHashCache[string];
        if (hash === undefined) {
          hash = hashString(string);
          if (STRING_HASH_CACHE_SIZE === STRING_HASH_CACHE_MAX_SIZE) {
            STRING_HASH_CACHE_SIZE = 0;
            stringHashCache = {};
          }
          STRING_HASH_CACHE_SIZE++;
          stringHashCache[string] = hash;
        }
        return hash;
      }
    
      // http://jsperf.com/hashing-strings
      function hashString(string) {
        // This is the hash from JVM
        // The hash code for a string is computed as
        // s[0] * 31 ^ (n - 1) + s[1] * 31 ^ (n - 2) + ... + s[n - 1],
        // where s[i] is the ith character of the string and n is the length of
        // the string. We "mod" the result to make it between 0 (inclusive) and 2^31
        // (exclusive) by dropping high bits.
        var hash = 0;
        for (var ii = 0; ii < string.length; ii++) {
          hash = 31 * hash + string.charCodeAt(ii) | 0;
        }
        return smi(hash);
      }
    
      function hashJSObj(obj) {
        var hash;
        if (usingWeakMap) {
          hash = weakMap.get(obj);
          if (hash !== undefined) {
            return hash;
          }
        }
    
        hash = obj[UID_HASH_KEY];
        if (hash !== undefined) {
          return hash;
        }
    
        if (!canDefineProperty) {
          hash = obj.propertyIsEnumerable && obj.propertyIsEnumerable[UID_HASH_KEY];
          if (hash !== undefined) {
            return hash;
          }
    
          hash = getIENodeHash(obj);
          if (hash !== undefined) {
            return hash;
          }
        }
    
        hash = ++objHashUID;
        if (objHashUID & 0x40000000) {
          objHashUID = 0;
        }
    
        if (usingWeakMap) {
          weakMap.set(obj, hash);
        } else if (isExtensible !== undefined && isExtensible(obj) === false) {
          throw new Error('Non-extensible objects are not allowed as keys.');
        } else if (canDefineProperty) {
          Object.defineProperty(obj, UID_HASH_KEY, {
            'enumerable': false,
            'configurable': false,
            'writable': false,
            'value': hash
          });
        } else if (obj.propertyIsEnumerable !== undefined &&
                   obj.propertyIsEnumerable === obj.constructor.prototype.propertyIsEnumerable) {
          // Since we can't define a non-enumerable property on the object
          // we'll hijack one of the less-used non-enumerable properties to
          // save our hash on it. Since this is a function it will not show up in
          // `JSON.stringify` which is what we want.
          obj.propertyIsEnumerable = function() {
            return this.constructor.prototype.propertyIsEnumerable.apply(this, arguments);
          };
          obj.propertyIsEnumerable[UID_HASH_KEY] = hash;
        } else if (obj.nodeType !== undefined) {
          // At this point we couldn't get the IE `uniqueID` to use as a hash
          // and we couldn't use a non-enumerable property to exploit the
          // dontEnum bug so we simply add the `UID_HASH_KEY` on the node
          // itself.
          obj[UID_HASH_KEY] = hash;
        } else {
          throw new Error('Unable to set a non-enumerable property on object.');
        }
    
        return hash;
      }
    
      // Get references to ES5 object methods.
      var isExtensible = Object.isExtensible;
    
      // True if Object.defineProperty works as expected. IE8 fails this test.
      var canDefineProperty = (function() {
        try {
          Object.defineProperty({}, '@', {});
          return true;
        } catch (e) {
          return false;
        }
      }());
    
      // IE has a `uniqueID` property on DOM nodes. We can construct the hash from it
      // and avoid memory leaks from the IE cloneNode bug.
      function getIENodeHash(node) {
        if (node && node.nodeType > 0) {
          switch (node.nodeType) {
            case 1: // Element
              return node.uniqueID;
            case 9: // Document
              return node.documentElement && node.documentElement.uniqueID;
          }
        }
      }
    
      // If possible, use a WeakMap.
      var usingWeakMap = typeof WeakMap === 'function';
      var weakMap;
      if (usingWeakMap) {
        weakMap = new WeakMap();
      }
    
      var objHashUID = 0;
    
      var UID_HASH_KEY = '__immutablehash__';
      if (typeof Symbol === 'function') {
        UID_HASH_KEY = Symbol(UID_HASH_KEY);
      }
    
      var STRING_HASH_CACHE_MIN_STRLEN = 16;
      var STRING_HASH_CACHE_MAX_SIZE = 255;
      var STRING_HASH_CACHE_SIZE = 0;
      var stringHashCache = {};
    
      function assertNotInfinite(size) {
        invariant(
          size !== Infinity,
          'Cannot perform this action with an infinite size.'
        );
      }
    
      createClass(Map, KeyedCollection);
    
        // @pragma Construction
    
        function Map(value) {
          return value === null || value === undefined ? emptyMap() :
            isMap(value) && !isOrdered(value) ? value :
            emptyMap().withMutations(function(map ) {
              var iter = KeyedIterable(value);
              assertNotInfinite(iter.size);
              iter.forEach(function(v, k)  {return map.set(k, v)});
            });
        }
    
        Map.of = function() {var keyValues = SLICE$0.call(arguments, 0);
          return emptyMap().withMutations(function(map ) {
            for (var i = 0; i < keyValues.length; i += 2) {
              if (i + 1 >= keyValues.length) {
                throw new Error('Missing value for key: ' + keyValues[i]);
              }
              map.set(keyValues[i], keyValues[i + 1]);
            }
          });
        };
    
        Map.prototype.toString = function() {
          return this.__toString('Map {', '}');
        };
    
        // @pragma Access
    
        Map.prototype.get = function(k, notSetValue) {
          return this._root ?
            this._root.get(0, undefined, k, notSetValue) :
            notSetValue;
        };
    
        // @pragma Modification
    
        Map.prototype.set = function(k, v) {
          return updateMap(this, k, v);
        };
    
        Map.prototype.setIn = function(keyPath, v) {
          return this.updateIn(keyPath, NOT_SET, function()  {return v});
        };
    
        Map.prototype.remove = function(k) {
          return updateMap(this, k, NOT_SET);
        };
    
        Map.prototype.deleteIn = function(keyPath) {
          return this.updateIn(keyPath, function()  {return NOT_SET});
        };
    
        Map.prototype.update = function(k, notSetValue, updater) {
          return arguments.length === 1 ?
            k(this) :
            this.updateIn([k], notSetValue, updater);
        };
    
        Map.prototype.updateIn = function(keyPath, notSetValue, updater) {
          if (!updater) {
            updater = notSetValue;
            notSetValue = undefined;
          }
          var updatedValue = updateInDeepMap(
            this,
            forceIterator(keyPath),
            notSetValue,
            updater
          );
          return updatedValue === NOT_SET ? undefined : updatedValue;
        };
    
        Map.prototype.clear = function() {
          if (this.size === 0) {
            return this;
          }
          if (this.__ownerID) {
            this.size = 0;
            this._root = null;
            this.__hash = undefined;
            this.__altered = true;
            return this;
          }
          return emptyMap();
        };
    
        // @pragma Composition
    
        Map.prototype.merge = function(/*...iters*/) {
          return mergeIntoMapWith(this, undefined, arguments);
        };
    
        Map.prototype.mergeWith = function(merger) {var iters = SLICE$0.call(arguments, 1);
          return mergeIntoMapWith(this, merger, iters);
        };
    
        Map.prototype.mergeIn = function(keyPath) {var iters = SLICE$0.call(arguments, 1);
          return this.updateIn(
            keyPath,
            emptyMap(),
            function(m ) {return typeof m.merge === 'function' ?
              m.merge.apply(m, iters) :
              iters[iters.length - 1]}
          );
        };
    
        Map.prototype.mergeDeep = function(/*...iters*/) {
          return mergeIntoMapWith(this, deepMerger, arguments);
        };
    
        Map.prototype.mergeDeepWith = function(merger) {var iters = SLICE$0.call(arguments, 1);
          return mergeIntoMapWith(this, deepMergerWith(merger), iters);
        };
    
        Map.prototype.mergeDeepIn = function(keyPath) {var iters = SLICE$0.call(arguments, 1);
          return this.updateIn(
            keyPath,
            emptyMap(),
            function(m ) {return typeof m.mergeDeep === 'function' ?
              m.mergeDeep.apply(m, iters) :
              iters[iters.length - 1]}
          );
        };
    
        Map.prototype.sort = function(comparator) {
          // Late binding
          return OrderedMap(sortFactory(this, comparator));
        };
    
        Map.prototype.sortBy = function(mapper, comparator) {
          // Late binding
          return OrderedMap(sortFactory(this, comparator, mapper));
        };
    
        // @pragma Mutability
    
        Map.prototype.withMutations = function(fn) {
          var mutable = this.asMutable();
          fn(mutable);
          return mutable.wasAltered() ? mutable.__ensureOwner(this.__ownerID) : this;
        };
    
        Map.prototype.asMutable = function() {
          return this.__ownerID ? this : this.__ensureOwner(new OwnerID());
        };
    
        Map.prototype.asImmutable = function() {
          return this.__ensureOwner();
        };
    
        Map.prototype.wasAltered = function() {
          return this.__altered;
        };
    
        Map.prototype.__iterator = function(type, reverse) {
          return new MapIterator(this, type, reverse);
        };
    
        Map.prototype.__iterate = function(fn, reverse) {var this$0 = this;
          var iterations = 0;
          this._root && this._root.iterate(function(entry ) {
            iterations++;
            return fn(entry[1], entry[0], this$0);
          }, reverse);
          return iterations;
        };
    
        Map.prototype.__ensureOwner = function(ownerID) {
          if (ownerID === this.__ownerID) {
            return this;
          }
          if (!ownerID) {
            this.__ownerID = ownerID;
            this.__altered = false;
            return this;
          }
          return makeMap(this.size, this._root, ownerID, this.__hash);
        };
    
    
      function isMap(maybeMap) {
        return !!(maybeMap && maybeMap[IS_MAP_SENTINEL]);
      }
    
      Map.isMap = isMap;
    
      var IS_MAP_SENTINEL = '@@__IMMUTABLE_MAP__@@';
    
      var MapPrototype = Map.prototype;
      MapPrototype[IS_MAP_SENTINEL] = true;
      MapPrototype[DELETE] = MapPrototype.remove;
      MapPrototype.removeIn = MapPrototype.deleteIn;
    
    
      // #pragma Trie Nodes
    
    
    
        function ArrayMapNode(ownerID, entries) {
          this.ownerID = ownerID;
          this.entries = entries;
        }
    
        ArrayMapNode.prototype.get = function(shift, keyHash, key, notSetValue) {
          var entries = this.entries;
          for (var ii = 0, len = entries.length; ii < len; ii++) {
            if (is(key, entries[ii][0])) {
              return entries[ii][1];
            }
          }
          return notSetValue;
        };
    
        ArrayMapNode.prototype.update = function(ownerID, shift, keyHash, key, value, didChangeSize, didAlter) {
          var removed = value === NOT_SET;
    
          var entries = this.entries;
          var idx = 0;
          for (var len = entries.length; idx < len; idx++) {
            if (is(key, entries[idx][0])) {
              break;
            }
          }
          var exists = idx < len;
    
          if (exists ? entries[idx][1] === value : removed) {
            return this;
          }
    
          SetRef(didAlter);
          (removed || !exists) && SetRef(didChangeSize);
    
          if (removed && entries.length === 1) {
            return; // undefined
          }
    
          if (!exists && !removed && entries.length >= MAX_ARRAY_MAP_SIZE) {
            return createNodes(ownerID, entries, key, value);
          }
    
          var isEditable = ownerID && ownerID === this.ownerID;
          var newEntries = isEditable ? entries : arrCopy(entries);
    
          if (exists) {
            if (removed) {
              idx === len - 1 ? newEntries.pop() : (newEntries[idx] = newEntries.pop());
            } else {
              newEntries[idx] = [key, value];
            }
          } else {
            newEntries.push([key, value]);
          }
    
          if (isEditable) {
            this.entries = newEntries;
            return this;
          }
    
          return new ArrayMapNode(ownerID, newEntries);
        };
    
    
    
    
        function BitmapIndexedNode(ownerID, bitmap, nodes) {
          this.ownerID = ownerID;
          this.bitmap = bitmap;
          this.nodes = nodes;
        }
    
        BitmapIndexedNode.prototype.get = function(shift, keyHash, key, notSetValue) {
          if (keyHash === undefined) {
            keyHash = hash(key);
          }
          var bit = (1 << ((shift === 0 ? keyHash : keyHash >>> shift) & MASK));
          var bitmap = this.bitmap;
          return (bitmap & bit) === 0 ? notSetValue :
            this.nodes[popCount(bitmap & (bit - 1))].get(shift + SHIFT, keyHash, key, notSetValue);
        };
    
        BitmapIndexedNode.prototype.update = function(ownerID, shift, keyHash, key, value, didChangeSize, didAlter) {
          if (keyHash === undefined) {
            keyHash = hash(key);
          }
          var keyHashFrag = (shift === 0 ? keyHash : keyHash >>> shift) & MASK;
          var bit = 1 << keyHashFrag;
          var bitmap = this.bitmap;
          var exists = (bitmap & bit) !== 0;
    
          if (!exists && value === NOT_SET) {
            return this;
          }
    
          var idx = popCount(bitmap & (bit - 1));
          var nodes = this.nodes;
          var node = exists ? nodes[idx] : undefined;
          var newNode = updateNode(node, ownerID, shift + SHIFT, keyHash, key, value, didChangeSize, didAlter);
    
          if (newNode === node) {
            return this;
          }
    
          if (!exists && newNode && nodes.length >= MAX_BITMAP_INDEXED_SIZE) {
            return expandNodes(ownerID, nodes, bitmap, keyHashFrag, newNode);
          }
    
          if (exists && !newNode && nodes.length === 2 && isLeafNode(nodes[idx ^ 1])) {
            return nodes[idx ^ 1];
          }
    
          if (exists && newNode && nodes.length === 1 && isLeafNode(newNode)) {
            return newNode;
          }
    
          var isEditable = ownerID && ownerID === this.ownerID;
          var newBitmap = exists ? newNode ? bitmap : bitmap ^ bit : bitmap | bit;
          var newNodes = exists ? newNode ?
            setIn(nodes, idx, newNode, isEditable) :
            spliceOut(nodes, idx, isEditable) :
            spliceIn(nodes, idx, newNode, isEditable);
    
          if (isEditable) {
            this.bitmap = newBitmap;
            this.nodes = newNodes;
            return this;
          }
    
          return new BitmapIndexedNode(ownerID, newBitmap, newNodes);
        };
    
    
    
    
        function HashArrayMapNode(ownerID, count, nodes) {
          this.ownerID = ownerID;
          this.count = count;
          this.nodes = nodes;
        }
    
        HashArrayMapNode.prototype.get = function(shift, keyHash, key, notSetValue) {
          if (keyHash === undefined) {
            keyHash = hash(key);
          }
          var idx = (shift === 0 ? keyHash : keyHash >>> shift) & MASK;
          var node = this.nodes[idx];
          return node ? node.get(shift + SHIFT, keyHash, key, notSetValue) : notSetValue;
        };
    
        HashArrayMapNode.prototype.update = function(ownerID, shift, keyHash, key, value, didChangeSize, didAlter) {
          if (keyHash === undefined) {
            keyHash = hash(key);
          }
          var idx = (shift === 0 ? keyHash : keyHash >>> shift) & MASK;
          var removed = value === NOT_SET;
          var nodes = this.nodes;
          var node = nodes[idx];
    
          if (removed && !node) {
            return this;
          }
    
          var newNode = updateNode(node, ownerID, shift + SHIFT, keyHash, key, value, didChangeSize, didAlter);
          if (newNode === node) {
            return this;
          }
    
          var newCount = this.count;
          if (!node) {
            newCount++;
          } else if (!newNode) {
            newCount--;
            if (newCount < MIN_HASH_ARRAY_MAP_SIZE) {
              return packNodes(ownerID, nodes, newCount, idx);
            }
          }
    
          var isEditable = ownerID && ownerID === this.ownerID;
          var newNodes = setIn(nodes, idx, newNode, isEditable);
    
          if (isEditable) {
            this.count = newCount;
            this.nodes = newNodes;
            return this;
          }
    
          return new HashArrayMapNode(ownerID, newCount, newNodes);
        };
    
    
    
    
        function HashCollisionNode(ownerID, keyHash, entries) {
          this.ownerID = ownerID;
          this.keyHash = keyHash;
          this.entries = entries;
        }
    
        HashCollisionNode.prototype.get = function(shift, keyHash, key, notSetValue) {
          var entries = this.entries;
          for (var ii = 0, len = entries.length; ii < len; ii++) {
            if (is(key, entries[ii][0])) {
              return entries[ii][1];
            }
          }
          return notSetValue;
        };
    
        HashCollisionNode.prototype.update = function(ownerID, shift, keyHash, key, value, didChangeSize, didAlter) {
          if (keyHash === undefined) {
            keyHash = hash(key);
          }
    
          var removed = value === NOT_SET;
    
          if (keyHash !== this.keyHash) {
            if (removed) {
              return this;
            }
            SetRef(didAlter);
            SetRef(didChangeSize);
            return mergeIntoNode(this, ownerID, shift, keyHash, [key, value]);
          }
    
          var entries = this.entries;
          var idx = 0;
          for (var len = entries.length; idx < len; idx++) {
            if (is(key, entries[idx][0])) {
              break;
            }
          }
          var exists = idx < len;
    
          if (exists ? entries[idx][1] === value : removed) {
            return this;
          }
    
          SetRef(didAlter);
          (removed || !exists) && SetRef(didChangeSize);
    
          if (removed && len === 2) {
            return new ValueNode(ownerID, this.keyHash, entries[idx ^ 1]);
          }
    
          var isEditable = ownerID && ownerID === this.ownerID;
          var newEntries = isEditable ? entries : arrCopy(entries);
    
          if (exists) {
            if (removed) {
              idx === len - 1 ? newEntries.pop() : (newEntries[idx] = newEntries.pop());
            } else {
              newEntries[idx] = [key, value];
            }
          } else {
            newEntries.push([key, value]);
          }
    
          if (isEditable) {
            this.entries = newEntries;
            return this;
          }
    
          return new HashCollisionNode(ownerID, this.keyHash, newEntries);
        };
    
    
    
    
        function ValueNode(ownerID, keyHash, entry) {
          this.ownerID = ownerID;
          this.keyHash = keyHash;
          this.entry = entry;
        }
    
        ValueNode.prototype.get = function(shift, keyHash, key, notSetValue) {
          return is(key, this.entry[0]) ? this.entry[1] : notSetValue;
        };
    
        ValueNode.prototype.update = function(ownerID, shift, keyHash, key, value, didChangeSize, didAlter) {
          var removed = value === NOT_SET;
          var keyMatch = is(key, this.entry[0]);
          if (keyMatch ? value === this.entry[1] : removed) {
            return this;
          }
    
          SetRef(didAlter);
    
          if (removed) {
            SetRef(didChangeSize);
            return; // undefined
          }
    
          if (keyMatch) {
            if (ownerID && ownerID === this.ownerID) {
              this.entry[1] = value;
              return this;
            }
            return new ValueNode(ownerID, this.keyHash, [key, value]);
          }
    
          SetRef(didChangeSize);
          return mergeIntoNode(this, ownerID, shift, hash(key), [key, value]);
        };
    
    
    
      // #pragma Iterators
    
      ArrayMapNode.prototype.iterate =
      HashCollisionNode.prototype.iterate = function (fn, reverse) {
        var entries = this.entries;
        for (var ii = 0, maxIndex = entries.length - 1; ii <= maxIndex; ii++) {
          if (fn(entries[reverse ? maxIndex - ii : ii]) === false) {
            return false;
          }
        }
      }
    
      BitmapIndexedNode.prototype.iterate =
      HashArrayMapNode.prototype.iterate = function (fn, reverse) {
        var nodes = this.nodes;
        for (var ii = 0, maxIndex = nodes.length - 1; ii <= maxIndex; ii++) {
          var node = nodes[reverse ? maxIndex - ii : ii];
          if (node && node.iterate(fn, reverse) === false) {
            return false;
          }
        }
      }
    
      ValueNode.prototype.iterate = function (fn, reverse) {
        return fn(this.entry);
      }
    
      createClass(MapIterator, Iterator);
    
        function MapIterator(map, type, reverse) {
          this._type = type;
          this._reverse = reverse;
          this._stack = map._root && mapIteratorFrame(map._root);
        }
    
        MapIterator.prototype.next = function() {
          var type = this._type;
          var stack = this._stack;
          while (stack) {
            var node = stack.node;
            var index = stack.index++;
            var maxIndex;
            if (node.entry) {
              if (index === 0) {
                return mapIteratorValue(type, node.entry);
              }
            } else if (node.entries) {
              maxIndex = node.entries.length - 1;
              if (index <= maxIndex) {
                return mapIteratorValue(type, node.entries[this._reverse ? maxIndex - index : index]);
              }
            } else {
              maxIndex = node.nodes.length - 1;
              if (index <= maxIndex) {
                var subNode = node.nodes[this._reverse ? maxIndex - index : index];
                if (subNode) {
                  if (subNode.entry) {
                    return mapIteratorValue(type, subNode.entry);
                  }
                  stack = this._stack = mapIteratorFrame(subNode, stack);
                }
                continue;
              }
            }
            stack = this._stack = this._stack.__prev;
          }
          return iteratorDone();
        };
    
    
      function mapIteratorValue(type, entry) {
        return iteratorValue(type, entry[0], entry[1]);
      }
    
      function mapIteratorFrame(node, prev) {
        return {
          node: node,
          index: 0,
          __prev: prev
        };
      }
    
      function makeMap(size, root, ownerID, hash) {
        var map = Object.create(MapPrototype);
        map.size = size;
        map._root = root;
        map.__ownerID = ownerID;
        map.__hash = hash;
        map.__altered = false;
        return map;
      }
    
      var EMPTY_MAP;
      function emptyMap() {
        return EMPTY_MAP || (EMPTY_MAP = makeMap(0));
      }
    
      function updateMap(map, k, v) {
        var newRoot;
        var newSize;
        if (!map._root) {
          if (v === NOT_SET) {
            return map;
          }
          newSize = 1;
          newRoot = new ArrayMapNode(map.__ownerID, [[k, v]]);
        } else {
          var didChangeSize = MakeRef(CHANGE_LENGTH);
          var didAlter = MakeRef(DID_ALTER);
          newRoot = updateNode(map._root, map.__ownerID, 0, undefined, k, v, didChangeSize, didAlter);
          if (!didAlter.value) {
            return map;
          }
          newSize = map.size + (didChangeSize.value ? v === NOT_SET ? -1 : 1 : 0);
        }
        if (map.__ownerID) {
          map.size = newSize;
          map._root = newRoot;
          map.__hash = undefined;
          map.__altered = true;
          return map;
        }
        return newRoot ? makeMap(newSize, newRoot) : emptyMap();
      }
    
      function updateNode(node, ownerID, shift, keyHash, key, value, didChangeSize, didAlter) {
        if (!node) {
          if (value === NOT_SET) {
            return node;
          }
          SetRef(didAlter);
          SetRef(didChangeSize);
          return new ValueNode(ownerID, keyHash, [key, value]);
        }
        return node.update(ownerID, shift, keyHash, key, value, didChangeSize, didAlter);
      }
    
      function isLeafNode(node) {
        return node.constructor === ValueNode || node.constructor === HashCollisionNode;
      }
    
      function mergeIntoNode(node, ownerID, shift, keyHash, entry) {
        if (node.keyHash === keyHash) {
          return new HashCollisionNode(ownerID, keyHash, [node.entry, entry]);
        }
    
        var idx1 = (shift === 0 ? node.keyHash : node.keyHash >>> shift) & MASK;
        var idx2 = (shift === 0 ? keyHash : keyHash >>> shift) & MASK;
    
        var newNode;
        var nodes = idx1 === idx2 ?
          [mergeIntoNode(node, ownerID, shift + SHIFT, keyHash, entry)] :
          ((newNode = new ValueNode(ownerID, keyHash, entry)), idx1 < idx2 ? [node, newNode] : [newNode, node]);
    
        return new BitmapIndexedNode(ownerID, (1 << idx1) | (1 << idx2), nodes);
      }
    
      function createNodes(ownerID, entries, key, value) {
        if (!ownerID) {
          ownerID = new OwnerID();
        }
        var node = new ValueNode(ownerID, hash(key), [key, value]);
        for (var ii = 0; ii < entries.length; ii++) {
          var entry = entries[ii];
          node = node.update(ownerID, 0, undefined, entry[0], entry[1]);
        }
        return node;
      }
    
      function packNodes(ownerID, nodes, count, excluding) {
        var bitmap = 0;
        var packedII = 0;
        var packedNodes = new Array(count);
        for (var ii = 0, bit = 1, len = nodes.length; ii < len; ii++, bit <<= 1) {
          var node = nodes[ii];
          if (node !== undefined && ii !== excluding) {
            bitmap |= bit;
            packedNodes[packedII++] = node;
          }
        }
        return new BitmapIndexedNode(ownerID, bitmap, packedNodes);
      }
    
      function expandNodes(ownerID, nodes, bitmap, including, node) {
        var count = 0;
        var expandedNodes = new Array(SIZE);
        for (var ii = 0; bitmap !== 0; ii++, bitmap >>>= 1) {
          expandedNodes[ii] = bitmap & 1 ? nodes[count++] : undefined;
        }
        expandedNodes[including] = node;
        return new HashArrayMapNode(ownerID, count + 1, expandedNodes);
      }
    
      function mergeIntoMapWith(map, merger, iterables) {
        var iters = [];
        for (var ii = 0; ii < iterables.length; ii++) {
          var value = iterables[ii];
          var iter = KeyedIterable(value);
          if (!isIterable(value)) {
            iter = iter.map(function(v ) {return fromJS(v)});
          }
          iters.push(iter);
        }
        return mergeIntoCollectionWith(map, merger, iters);
      }
    
      function deepMerger(existing, value, key) {
        return existing && existing.mergeDeep && isIterable(value) ?
          existing.mergeDeep(value) :
          is(existing, value) ? existing : value;
      }
    
      function deepMergerWith(merger) {
        return function(existing, value, key)  {
          if (existing && existing.mergeDeepWith && isIterable(value)) {
            return existing.mergeDeepWith(merger, value);
          }
          var nextValue = merger(existing, value, key);
          return is(existing, nextValue) ? existing : nextValue;
        };
      }
    
      function mergeIntoCollectionWith(collection, merger, iters) {
        iters = iters.filter(function(x ) {return x.size !== 0});
        if (iters.length === 0) {
          return collection;
        }
        if (collection.size === 0 && !collection.__ownerID && iters.length === 1) {
          return collection.constructor(iters[0]);
        }
        return collection.withMutations(function(collection ) {
          var mergeIntoMap = merger ?
            function(value, key)  {
              collection.update(key, NOT_SET, function(existing )
                {return existing === NOT_SET ? value : merger(existing, value, key)}
              );
            } :
            function(value, key)  {
              collection.set(key, value);
            }
          for (var ii = 0; ii < iters.length; ii++) {
            iters[ii].forEach(mergeIntoMap);
          }
        });
      }
    
      function updateInDeepMap(existing, keyPathIter, notSetValue, updater) {
        var isNotSet = existing === NOT_SET;
        var step = keyPathIter.next();
        if (step.done) {
          var existingValue = isNotSet ? notSetValue : existing;
          var newValue = updater(existingValue);
          return newValue === existingValue ? existing : newValue;
        }
        invariant(
          isNotSet || (existing && existing.set),
          'invalid keyPath'
        );
        var key = step.value;
        var nextExisting = isNotSet ? NOT_SET : existing.get(key, NOT_SET);
        var nextUpdated = updateInDeepMap(
          nextExisting,
          keyPathIter,
          notSetValue,
          updater
        );
        return nextUpdated === nextExisting ? existing :
          nextUpdated === NOT_SET ? existing.remove(key) :
          (isNotSet ? emptyMap() : existing).set(key, nextUpdated);
      }
    
      function popCount(x) {
        x = x - ((x >> 1) & 0x55555555);
        x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
        x = (x + (x >> 4)) & 0x0f0f0f0f;
        x = x + (x >> 8);
        x = x + (x >> 16);
        return x & 0x7f;
      }
    
      function setIn(array, idx, val, canEdit) {
        var newArray = canEdit ? array : arrCopy(array);
        newArray[idx] = val;
        return newArray;
      }
    
      function spliceIn(array, idx, val, canEdit) {
        var newLen = array.length + 1;
        if (canEdit && idx + 1 === newLen) {
          array[idx] = val;
          return array;
        }
        var newArray = new Array(newLen);
        var after = 0;
        for (var ii = 0; ii < newLen; ii++) {
          if (ii === idx) {
            newArray[ii] = val;
            after = -1;
          } else {
            newArray[ii] = array[ii + after];
          }
        }
        return newArray;
      }
    
      function spliceOut(array, idx, canEdit) {
        var newLen = array.length - 1;
        if (canEdit && idx === newLen) {
          array.pop();
          return array;
        }
        var newArray = new Array(newLen);
        var after = 0;
        for (var ii = 0; ii < newLen; ii++) {
          if (ii === idx) {
            after = 1;
          }
          newArray[ii] = array[ii + after];
        }
        return newArray;
      }
    
      var MAX_ARRAY_MAP_SIZE = SIZE / 4;
      var MAX_BITMAP_INDEXED_SIZE = SIZE / 2;
      var MIN_HASH_ARRAY_MAP_SIZE = SIZE / 4;
    
      createClass(List, IndexedCollection);
    
        // @pragma Construction
    
        function List(value) {
          var empty = emptyList();
          if (value === null || value === undefined) {
            return empty;
          }
          if (isList(value)) {
            return value;
          }
          var iter = IndexedIterable(value);
          var size = iter.size;
          if (size === 0) {
            return empty;
          }
          assertNotInfinite(size);
          if (size > 0 && size < SIZE) {
            return makeList(0, size, SHIFT, null, new VNode(iter.toArray()));
          }
          return empty.withMutations(function(list ) {
            list.setSize(size);
            iter.forEach(function(v, i)  {return list.set(i, v)});
          });
        }
    
        List.of = function(/*...values*/) {
          return this(arguments);
        };
    
        List.prototype.toString = function() {
          return this.__toString('List [', ']');
        };
    
        // @pragma Access
    
        List.prototype.get = function(index, notSetValue) {
          index = wrapIndex(this, index);
          if (index >= 0 && index < this.size) {
            index += this._origin;
            var node = listNodeFor(this, index);
            return node && node.array[index & MASK];
          }
          return notSetValue;
        };
    
        // @pragma Modification
    
        List.prototype.set = function(index, value) {
          return updateList(this, index, value);
        };
    
        List.prototype.remove = function(index) {
          return !this.has(index) ? this :
            index === 0 ? this.shift() :
            index === this.size - 1 ? this.pop() :
            this.splice(index, 1);
        };
    
        List.prototype.insert = function(index, value) {
          return this.splice(index, 0, value);
        };
    
        List.prototype.clear = function() {
          if (this.size === 0) {
            return this;
          }
          if (this.__ownerID) {
            this.size = this._origin = this._capacity = 0;
            this._level = SHIFT;
            this._root = this._tail = null;
            this.__hash = undefined;
            this.__altered = true;
            return this;
          }
          return emptyList();
        };
    
        List.prototype.push = function(/*...values*/) {
          var values = arguments;
          var oldSize = this.size;
          return this.withMutations(function(list ) {
            setListBounds(list, 0, oldSize + values.length);
            for (var ii = 0; ii < values.length; ii++) {
              list.set(oldSize + ii, values[ii]);
            }
          });
        };
    
        List.prototype.pop = function() {
          return setListBounds(this, 0, -1);
        };
    
        List.prototype.unshift = function(/*...values*/) {
          var values = arguments;
          return this.withMutations(function(list ) {
            setListBounds(list, -values.length);
            for (var ii = 0; ii < values.length; ii++) {
              list.set(ii, values[ii]);
            }
          });
        };
    
        List.prototype.shift = function() {
          return setListBounds(this, 1);
        };
    
        // @pragma Composition
    
        List.prototype.merge = function(/*...iters*/) {
          return mergeIntoListWith(this, undefined, arguments);
        };
    
        List.prototype.mergeWith = function(merger) {var iters = SLICE$0.call(arguments, 1);
          return mergeIntoListWith(this, merger, iters);
        };
    
        List.prototype.mergeDeep = function(/*...iters*/) {
          return mergeIntoListWith(this, deepMerger, arguments);
        };
    
        List.prototype.mergeDeepWith = function(merger) {var iters = SLICE$0.call(arguments, 1);
          return mergeIntoListWith(this, deepMergerWith(merger), iters);
        };
    
        List.prototype.setSize = function(size) {
          return setListBounds(this, 0, size);
        };
    
        // @pragma Iteration
    
        List.prototype.slice = function(begin, end) {
          var size = this.size;
          if (wholeSlice(begin, end, size)) {
            return this;
          }
          return setListBounds(
            this,
            resolveBegin(begin, size),
            resolveEnd(end, size)
          );
        };
    
        List.prototype.__iterator = function(type, reverse) {
          var index = 0;
          var values = iterateList(this, reverse);
          return new Iterator(function()  {
            var value = values();
            return value === DONE ?
              iteratorDone() :
              iteratorValue(type, index++, value);
          });
        };
    
        List.prototype.__iterate = function(fn, reverse) {
          var index = 0;
          var values = iterateList(this, reverse);
          var value;
          while ((value = values()) !== DONE) {
            if (fn(value, index++, this) === false) {
              break;
            }
          }
          return index;
        };
    
        List.prototype.__ensureOwner = function(ownerID) {
          if (ownerID === this.__ownerID) {
            return this;
          }
          if (!ownerID) {
            this.__ownerID = ownerID;
            return this;
          }
          return makeList(this._origin, this._capacity, this._level, this._root, this._tail, ownerID, this.__hash);
        };
    
    
      function isList(maybeList) {
        return !!(maybeList && maybeList[IS_LIST_SENTINEL]);
      }
    
      List.isList = isList;
    
      var IS_LIST_SENTINEL = '@@__IMMUTABLE_LIST__@@';
    
      var ListPrototype = List.prototype;
      ListPrototype[IS_LIST_SENTINEL] = true;
      ListPrototype[DELETE] = ListPrototype.remove;
      ListPrototype.setIn = MapPrototype.setIn;
      ListPrototype.deleteIn =
      ListPrototype.removeIn = MapPrototype.removeIn;
      ListPrototype.update = MapPrototype.update;
      ListPrototype.updateIn = MapPrototype.updateIn;
      ListPrototype.mergeIn = MapPrototype.mergeIn;
      ListPrototype.mergeDeepIn = MapPrototype.mergeDeepIn;
      ListPrototype.withMutations = MapPrototype.withMutations;
      ListPrototype.asMutable = MapPrototype.asMutable;
      ListPrototype.asImmutable = MapPrototype.asImmutable;
      ListPrototype.wasAltered = MapPrototype.wasAltered;
    
    
    
        function VNode(array, ownerID) {
          this.array = array;
          this.ownerID = ownerID;
        }
    
        // TODO: seems like these methods are very similar
    
        VNode.prototype.removeBefore = function(ownerID, level, index) {
          if (index === level ? 1 << level : 0 || this.array.length === 0) {
            return this;
          }
          var originIndex = (index >>> level) & MASK;
          if (originIndex >= this.array.length) {
            return new VNode([], ownerID);
          }
          var removingFirst = originIndex === 0;
          var newChild;
          if (level > 0) {
            var oldChild = this.array[originIndex];
            newChild = oldChild && oldChild.removeBefore(ownerID, level - SHIFT, index);
            if (newChild === oldChild && removingFirst) {
              return this;
            }
          }
          if (removingFirst && !newChild) {
            return this;
          }
          var editable = editableVNode(this, ownerID);
          if (!removingFirst) {
            for (var ii = 0; ii < originIndex; ii++) {
              editable.array[ii] = undefined;
            }
          }
          if (newChild) {
            editable.array[originIndex] = newChild;
          }
          return editable;
        };
    
        VNode.prototype.removeAfter = function(ownerID, level, index) {
          if (index === (level ? 1 << level : 0) || this.array.length === 0) {
            return this;
          }
          var sizeIndex = ((index - 1) >>> level) & MASK;
          if (sizeIndex >= this.array.length) {
            return this;
          }
    
          var newChild;
          if (level > 0) {
            var oldChild = this.array[sizeIndex];
            newChild = oldChild && oldChild.removeAfter(ownerID, level - SHIFT, index);
            if (newChild === oldChild && sizeIndex === this.array.length - 1) {
              return this;
            }
          }
    
          var editable = editableVNode(this, ownerID);
          editable.array.splice(sizeIndex + 1);
          if (newChild) {
            editable.array[sizeIndex] = newChild;
          }
          return editable;
        };
    
    
    
      var DONE = {};
    
      function iterateList(list, reverse) {
        var left = list._origin;
        var right = list._capacity;
        var tailPos = getTailOffset(right);
        var tail = list._tail;
    
        return iterateNodeOrLeaf(list._root, list._level, 0);
    
        function iterateNodeOrLeaf(node, level, offset) {
          return level === 0 ?
            iterateLeaf(node, offset) :
            iterateNode(node, level, offset);
        }
    
        function iterateLeaf(node, offset) {
          var array = offset === tailPos ? tail && tail.array : node && node.array;
          var from = offset > left ? 0 : left - offset;
          var to = right - offset;
          if (to > SIZE) {
            to = SIZE;
          }
          return function()  {
            if (from === to) {
              return DONE;
            }
            var idx = reverse ? --to : from++;
            return array && array[idx];
          };
        }
    
        function iterateNode(node, level, offset) {
          var values;
          var array = node && node.array;
          var from = offset > left ? 0 : (left - offset) >> level;
          var to = ((right - offset) >> level) + 1;
          if (to > SIZE) {
            to = SIZE;
          }
          return function()  {
            do {
              if (values) {
                var value = values();
                if (value !== DONE) {
                  return value;
                }
                values = null;
              }
              if (from === to) {
                return DONE;
              }
              var idx = reverse ? --to : from++;
              values = iterateNodeOrLeaf(
                array && array[idx], level - SHIFT, offset + (idx << level)
              );
            } while (true);
          };
        }
      }
    
      function makeList(origin, capacity, level, root, tail, ownerID, hash) {
        var list = Object.create(ListPrototype);
        list.size = capacity - origin;
        list._origin = origin;
        list._capacity = capacity;
        list._level = level;
        list._root = root;
        list._tail = tail;
        list.__ownerID = ownerID;
        list.__hash = hash;
        list.__altered = false;
        return list;
      }
    
      var EMPTY_LIST;
      function emptyList() {
        return EMPTY_LIST || (EMPTY_LIST = makeList(0, 0, SHIFT));
      }
    
      function updateList(list, index, value) {
        index = wrapIndex(list, index);
    
        if (index !== index) {
          return list;
        }
    
        if (index >= list.size || index < 0) {
          return list.withMutations(function(list ) {
            index < 0 ?
              setListBounds(list, index).set(0, value) :
              setListBounds(list, 0, index + 1).set(index, value)
          });
        }
    
        index += list._origin;
    
        var newTail = list._tail;
        var newRoot = list._root;
        var didAlter = MakeRef(DID_ALTER);
        if (index >= getTailOffset(list._capacity)) {
          newTail = updateVNode(newTail, list.__ownerID, 0, index, value, didAlter);
        } else {
          newRoot = updateVNode(newRoot, list.__ownerID, list._level, index, value, didAlter);
        }
    
        if (!didAlter.value) {
          return list;
        }
    
        if (list.__ownerID) {
          list._root = newRoot;
          list._tail = newTail;
          list.__hash = undefined;
          list.__altered = true;
          return list;
        }
        return makeList(list._origin, list._capacity, list._level, newRoot, newTail);
      }
    
      function updateVNode(node, ownerID, level, index, value, didAlter) {
        var idx = (index >>> level) & MASK;
        var nodeHas = node && idx < node.array.length;
        if (!nodeHas && value === undefined) {
          return node;
        }
    
        var newNode;
    
        if (level > 0) {
          var lowerNode = node && node.array[idx];
          var newLowerNode = updateVNode(lowerNode, ownerID, level - SHIFT, index, value, didAlter);
          if (newLowerNode === lowerNode) {
            return node;
          }
          newNode = editableVNode(node, ownerID);
          newNode.array[idx] = newLowerNode;
          return newNode;
        }
    
        if (nodeHas && node.array[idx] === value) {
          return node;
        }
    
        SetRef(didAlter);
    
        newNode = editableVNode(node, ownerID);
        if (value === undefined && idx === newNode.array.length - 1) {
          newNode.array.pop();
        } else {
          newNode.array[idx] = value;
        }
        return newNode;
      }
    
      function editableVNode(node, ownerID) {
        if (ownerID && node && ownerID === node.ownerID) {
          return node;
        }
        return new VNode(node ? node.array.slice() : [], ownerID);
      }
    
      function listNodeFor(list, rawIndex) {
        if (rawIndex >= getTailOffset(list._capacity)) {
          return list._tail;
        }
        if (rawIndex < 1 << (list._level + SHIFT)) {
          var node = list._root;
          var level = list._level;
          while (node && level > 0) {
            node = node.array[(rawIndex >>> level) & MASK];
            level -= SHIFT;
          }
          return node;
        }
      }
    
      function setListBounds(list, begin, end) {
        // Sanitize begin & end using this shorthand for ToInt32(argument)
        // http://www.ecma-international.org/ecma-262/6.0/#sec-toint32
        if (begin !== undefined) {
          begin = begin | 0;
        }
        if (end !== undefined) {
          end = end | 0;
        }
        var owner = list.__ownerID || new OwnerID();
        var oldOrigin = list._origin;
        var oldCapacity = list._capacity;
        var newOrigin = oldOrigin + begin;
        var newCapacity = end === undefined ? oldCapacity : end < 0 ? oldCapacity + end : oldOrigin + end;
        if (newOrigin === oldOrigin && newCapacity === oldCapacity) {
          return list;
        }
    
        // If it's going to end after it starts, it's empty.
        if (newOrigin >= newCapacity) {
          return list.clear();
        }
    
        var newLevel = list._level;
        var newRoot = list._root;
    
        // New origin might need creating a higher root.
        var offsetShift = 0;
        while (newOrigin + offsetShift < 0) {
          newRoot = new VNode(newRoot && newRoot.array.length ? [undefined, newRoot] : [], owner);
          newLevel += SHIFT;
          offsetShift += 1 << newLevel;
        }
        if (offsetShift) {
          newOrigin += offsetShift;
          oldOrigin += offsetShift;
          newCapacity += offsetShift;
          oldCapacity += offsetShift;
        }
    
        var oldTailOffset = getTailOffset(oldCapacity);
        var newTailOffset = getTailOffset(newCapacity);
    
        // New size might need creating a higher root.
        while (newTailOffset >= 1 << (newLevel + SHIFT)) {
          newRoot = new VNode(newRoot && newRoot.array.length ? [newRoot] : [], owner);
          newLevel += SHIFT;
        }
    
        // Locate or create the new tail.
        var oldTail = list._tail;
        var newTail = newTailOffset < oldTailOffset ?
          listNodeFor(list, newCapacity - 1) :
          newTailOffset > oldTailOffset ? new VNode([], owner) : oldTail;
    
        // Merge Tail into tree.
        if (oldTail && newTailOffset > oldTailOffset && newOrigin < oldCapacity && oldTail.array.length) {
          newRoot = editableVNode(newRoot, owner);
          var node = newRoot;
          for (var level = newLevel; level > SHIFT; level -= SHIFT) {
            var idx = (oldTailOffset >>> level) & MASK;
            node = node.array[idx] = editableVNode(node.array[idx], owner);
          }
          node.array[(oldTailOffset >>> SHIFT) & MASK] = oldTail;
        }
    
        // If the size has been reduced, there's a chance the tail needs to be trimmed.
        if (newCapacity < oldCapacity) {
          newTail = newTail && newTail.removeAfter(owner, 0, newCapacity);
        }
    
        // If the new origin is within the tail, then we do not need a root.
        if (newOrigin >= newTailOffset) {
          newOrigin -= newTailOffset;
          newCapacity -= newTailOffset;
          newLevel = SHIFT;
          newRoot = null;
          newTail = newTail && newTail.removeBefore(owner, 0, newOrigin);
    
        // Otherwise, if the root has been trimmed, garbage collect.
        } else if (newOrigin > oldOrigin || newTailOffset < oldTailOffset) {
          offsetShift = 0;
    
          // Identify the new top root node of the subtree of the old root.
          while (newRoot) {
            var beginIndex = (newOrigin >>> newLevel) & MASK;
            if (beginIndex !== (newTailOffset >>> newLevel) & MASK) {
              break;
            }
            if (beginIndex) {
              offsetShift += (1 << newLevel) * beginIndex;
            }
            newLevel -= SHIFT;
            newRoot = newRoot.array[beginIndex];
          }
    
          // Trim the new sides of the new root.
          if (newRoot && newOrigin > oldOrigin) {
            newRoot = newRoot.removeBefore(owner, newLevel, newOrigin - offsetShift);
          }
          if (newRoot && newTailOffset < oldTailOffset) {
            newRoot = newRoot.removeAfter(owner, newLevel, newTailOffset - offsetShift);
          }
          if (offsetShift) {
            newOrigin -= offsetShift;
            newCapacity -= offsetShift;
          }
        }
    
        if (list.__ownerID) {
          list.size = newCapacity - newOrigin;
          list._origin = newOrigin;
          list._capacity = newCapacity;
          list._level = newLevel;
          list._root = newRoot;
          list._tail = newTail;
          list.__hash = undefined;
          list.__altered = true;
          return list;
        }
        return makeList(newOrigin, newCapacity, newLevel, newRoot, newTail);
      }
    
      function mergeIntoListWith(list, merger, iterables) {
        var iters = [];
        var maxSize = 0;
        for (var ii = 0; ii < iterables.length; ii++) {
          var value = iterables[ii];
          var iter = IndexedIterable(value);
          if (iter.size > maxSize) {
            maxSize = iter.size;
          }
          if (!isIterable(value)) {
            iter = iter.map(function(v ) {return fromJS(v)});
          }
          iters.push(iter);
        }
        if (maxSize > list.size) {
          list = list.setSize(maxSize);
        }
        return mergeIntoCollectionWith(list, merger, iters);
      }
    
      function getTailOffset(size) {
        return size < SIZE ? 0 : (((size - 1) >>> SHIFT) << SHIFT);
      }
    
      createClass(OrderedMap, Map);
    
        // @pragma Construction
    
        function OrderedMap(value) {
          return value === null || value === undefined ? emptyOrderedMap() :
            isOrderedMap(value) ? value :
            emptyOrderedMap().withMutations(function(map ) {
              var iter = KeyedIterable(value);
              assertNotInfinite(iter.size);
              iter.forEach(function(v, k)  {return map.set(k, v)});
            });
        }
    
        OrderedMap.of = function(/*...values*/) {
          return this(arguments);
        };
    
        OrderedMap.prototype.toString = function() {
          return this.__toString('OrderedMap {', '}');
        };
    
        // @pragma Access
    
        OrderedMap.prototype.get = function(k, notSetValue) {
          var index = this._map.get(k);
          return index !== undefined ? this._list.get(index)[1] : notSetValue;
        };
    
        // @pragma Modification
    
        OrderedMap.prototype.clear = function() {
          if (this.size === 0) {
            return this;
          }
          if (this.__ownerID) {
            this.size = 0;
            this._map.clear();
            this._list.clear();
            return this;
          }
          return emptyOrderedMap();
        };
    
        OrderedMap.prototype.set = function(k, v) {
          return updateOrderedMap(this, k, v);
        };
    
        OrderedMap.prototype.remove = function(k) {
          return updateOrderedMap(this, k, NOT_SET);
        };
    
        OrderedMap.prototype.wasAltered = function() {
          return this._map.wasAltered() || this._list.wasAltered();
        };
    
        OrderedMap.prototype.__iterate = function(fn, reverse) {var this$0 = this;
          return this._list.__iterate(
            function(entry ) {return entry && fn(entry[1], entry[0], this$0)},
            reverse
          );
        };
    
        OrderedMap.prototype.__iterator = function(type, reverse) {
          return this._list.fromEntrySeq().__iterator(type, reverse);
        };
    
        OrderedMap.prototype.__ensureOwner = function(ownerID) {
          if (ownerID === this.__ownerID) {
            return this;
          }
          var newMap = this._map.__ensureOwner(ownerID);
          var newList = this._list.__ensureOwner(ownerID);
          if (!ownerID) {
            this.__ownerID = ownerID;
            this._map = newMap;
            this._list = newList;
            return this;
          }
          return makeOrderedMap(newMap, newList, ownerID, this.__hash);
        };
    
    
      function isOrderedMap(maybeOrderedMap) {
        return isMap(maybeOrderedMap) && isOrdered(maybeOrderedMap);
      }
    
      OrderedMap.isOrderedMap = isOrderedMap;
    
      OrderedMap.prototype[IS_ORDERED_SENTINEL] = true;
      OrderedMap.prototype[DELETE] = OrderedMap.prototype.remove;
    
    
    
      function makeOrderedMap(map, list, ownerID, hash) {
        var omap = Object.create(OrderedMap.prototype);
        omap.size = map ? map.size : 0;
        omap._map = map;
        omap._list = list;
        omap.__ownerID = ownerID;
        omap.__hash = hash;
        return omap;
      }
    
      var EMPTY_ORDERED_MAP;
      function emptyOrderedMap() {
        return EMPTY_ORDERED_MAP || (EMPTY_ORDERED_MAP = makeOrderedMap(emptyMap(), emptyList()));
      }
    
      function updateOrderedMap(omap, k, v) {
        var map = omap._map;
        var list = omap._list;
        var i = map.get(k);
        var has = i !== undefined;
        var newMap;
        var newList;
        if (v === NOT_SET) { // removed
          if (!has) {
            return omap;
          }
          if (list.size >= SIZE && list.size >= map.size * 2) {
            newList = list.filter(function(entry, idx)  {return entry !== undefined && i !== idx});
            newMap = newList.toKeyedSeq().map(function(entry ) {return entry[0]}).flip().toMap();
            if (omap.__ownerID) {
              newMap.__ownerID = newList.__ownerID = omap.__ownerID;
            }
          } else {
            newMap = map.remove(k);
            newList = i === list.size - 1 ? list.pop() : list.set(i, undefined);
          }
        } else {
          if (has) {
            if (v === list.get(i)[1]) {
              return omap;
            }
            newMap = map;
            newList = list.set(i, [k, v]);
          } else {
            newMap = map.set(k, list.size);
            newList = list.set(list.size, [k, v]);
          }
        }
        if (omap.__ownerID) {
          omap.size = newMap.size;
          omap._map = newMap;
          omap._list = newList;
          omap.__hash = undefined;
          return omap;
        }
        return makeOrderedMap(newMap, newList);
      }
    
      createClass(ToKeyedSequence, KeyedSeq);
        function ToKeyedSequence(indexed, useKeys) {
          this._iter = indexed;
          this._useKeys = useKeys;
          this.size = indexed.size;
        }
    
        ToKeyedSequence.prototype.get = function(key, notSetValue) {
          return this._iter.get(key, notSetValue);
        };
    
        ToKeyedSequence.prototype.has = function(key) {
          return this._iter.has(key);
        };
    
        ToKeyedSequence.prototype.valueSeq = function() {
          return this._iter.valueSeq();
        };
    
        ToKeyedSequence.prototype.reverse = function() {var this$0 = this;
          var reversedSequence = reverseFactory(this, true);
          if (!this._useKeys) {
            reversedSequence.valueSeq = function()  {return this$0._iter.toSeq().reverse()};
          }
          return reversedSequence;
        };
    
        ToKeyedSequence.prototype.map = function(mapper, context) {var this$0 = this;
          var mappedSequence = mapFactory(this, mapper, context);
          if (!this._useKeys) {
            mappedSequence.valueSeq = function()  {return this$0._iter.toSeq().map(mapper, context)};
          }
          return mappedSequence;
        };
    
        ToKeyedSequence.prototype.__iterate = function(fn, reverse) {var this$0 = this;
          var ii;
          return this._iter.__iterate(
            this._useKeys ?
              function(v, k)  {return fn(v, k, this$0)} :
              ((ii = reverse ? resolveSize(this) : 0),
                function(v ) {return fn(v, reverse ? --ii : ii++, this$0)}),
            reverse
          );
        };
    
        ToKeyedSequence.prototype.__iterator = function(type, reverse) {
          if (this._useKeys) {
            return this._iter.__iterator(type, reverse);
          }
          var iterator = this._iter.__iterator(ITERATE_VALUES, reverse);
          var ii = reverse ? resolveSize(this) : 0;
          return new Iterator(function()  {
            var step = iterator.next();
            return step.done ? step :
              iteratorValue(type, reverse ? --ii : ii++, step.value, step);
          });
        };
    
      ToKeyedSequence.prototype[IS_ORDERED_SENTINEL] = true;
    
    
      createClass(ToIndexedSequence, IndexedSeq);
        function ToIndexedSequence(iter) {
          this._iter = iter;
          this.size = iter.size;
        }
    
        ToIndexedSequence.prototype.includes = function(value) {
          return this._iter.includes(value);
        };
    
        ToIndexedSequence.prototype.__iterate = function(fn, reverse) {var this$0 = this;
          var iterations = 0;
          return this._iter.__iterate(function(v ) {return fn(v, iterations++, this$0)}, reverse);
        };
    
        ToIndexedSequence.prototype.__iterator = function(type, reverse) {
          var iterator = this._iter.__iterator(ITERATE_VALUES, reverse);
          var iterations = 0;
          return new Iterator(function()  {
            var step = iterator.next();
            return step.done ? step :
              iteratorValue(type, iterations++, step.value, step)
          });
        };
    
    
    
      createClass(ToSetSequence, SetSeq);
        function ToSetSequence(iter) {
          this._iter = iter;
          this.size = iter.size;
        }
    
        ToSetSequence.prototype.has = function(key) {
          return this._iter.includes(key);
        };
    
        ToSetSequence.prototype.__iterate = function(fn, reverse) {var this$0 = this;
          return this._iter.__iterate(function(v ) {return fn(v, v, this$0)}, reverse);
        };
    
        ToSetSequence.prototype.__iterator = function(type, reverse) {
          var iterator = this._iter.__iterator(ITERATE_VALUES, reverse);
          return new Iterator(function()  {
            var step = iterator.next();
            return step.done ? step :
              iteratorValue(type, step.value, step.value, step);
          });
        };
    
    
    
      createClass(FromEntriesSequence, KeyedSeq);
        function FromEntriesSequence(entries) {
          this._iter = entries;
          this.size = entries.size;
        }
    
        FromEntriesSequence.prototype.entrySeq = function() {
          return this._iter.toSeq();
        };
    
        FromEntriesSequence.prototype.__iterate = function(fn, reverse) {var this$0 = this;
          return this._iter.__iterate(function(entry ) {
            // Check if entry exists first so array access doesn't throw for holes
            // in the parent iteration.
            if (entry) {
              validateEntry(entry);
              var indexedIterable = isIterable(entry);
              return fn(
                indexedIterable ? entry.get(1) : entry[1],
                indexedIterable ? entry.get(0) : entry[0],
                this$0
              );
            }
          }, reverse);
        };
    
        FromEntriesSequence.prototype.__iterator = function(type, reverse) {
          var iterator = this._iter.__iterator(ITERATE_VALUES, reverse);
          return new Iterator(function()  {
            while (true) {
              var step = iterator.next();
              if (step.done) {
                return step;
              }
              var entry = step.value;
              // Check if entry exists first so array access doesn't throw for holes
              // in the parent iteration.
              if (entry) {
                validateEntry(entry);
                var indexedIterable = isIterable(entry);
                return iteratorValue(
                  type,
                  indexedIterable ? entry.get(0) : entry[0],
                  indexedIterable ? entry.get(1) : entry[1],
                  step
                );
              }
            }
          });
        };
    
    
      ToIndexedSequence.prototype.cacheResult =
      ToKeyedSequence.prototype.cacheResult =
      ToSetSequence.prototype.cacheResult =
      FromEntriesSequence.prototype.cacheResult =
        cacheResultThrough;
    
    
      function flipFactory(iterable) {
        var flipSequence = makeSequence(iterable);
        flipSequence._iter = iterable;
        flipSequence.size = iterable.size;
        flipSequence.flip = function()  {return iterable};
        flipSequence.reverse = function () {
          var reversedSequence = iterable.reverse.apply(this); // super.reverse()
          reversedSequence.flip = function()  {return iterable.reverse()};
          return reversedSequence;
        };
        flipSequence.has = function(key ) {return iterable.includes(key)};
        flipSequence.includes = function(key ) {return iterable.has(key)};
        flipSequence.cacheResult = cacheResultThrough;
        flipSequence.__iterateUncached = function (fn, reverse) {var this$0 = this;
          return iterable.__iterate(function(v, k)  {return fn(k, v, this$0) !== false}, reverse);
        }
        flipSequence.__iteratorUncached = function(type, reverse) {
          if (type === ITERATE_ENTRIES) {
            var iterator = iterable.__iterator(type, reverse);
            return new Iterator(function()  {
              var step = iterator.next();
              if (!step.done) {
                var k = step.value[0];
                step.value[0] = step.value[1];
                step.value[1] = k;
              }
              return step;
            });
          }
          return iterable.__iterator(
            type === ITERATE_VALUES ? ITERATE_KEYS : ITERATE_VALUES,
            reverse
          );
        }
        return flipSequence;
      }
    
    
      function mapFactory(iterable, mapper, context) {
        var mappedSequence = makeSequence(iterable);
        mappedSequence.size = iterable.size;
        mappedSequence.has = function(key ) {return iterable.has(key)};
        mappedSequence.get = function(key, notSetValue)  {
          var v = iterable.get(key, NOT_SET);
          return v === NOT_SET ?
            notSetValue :
            mapper.call(context, v, key, iterable);
        };
        mappedSequence.__iterateUncached = function (fn, reverse) {var this$0 = this;
          return iterable.__iterate(
            function(v, k, c)  {return fn(mapper.call(context, v, k, c), k, this$0) !== false},
            reverse
          );
        }
        mappedSequence.__iteratorUncached = function (type, reverse) {
          var iterator = iterable.__iterator(ITERATE_ENTRIES, reverse);
          return new Iterator(function()  {
            var step = iterator.next();
            if (step.done) {
              return step;
            }
            var entry = step.value;
            var key = entry[0];
            return iteratorValue(
              type,
              key,
              mapper.call(context, entry[1], key, iterable),
              step
            );
          });
        }
        return mappedSequence;
      }
    
    
      function reverseFactory(iterable, useKeys) {
        var reversedSequence = makeSequence(iterable);
        reversedSequence._iter = iterable;
        reversedSequence.size = iterable.size;
        reversedSequence.reverse = function()  {return iterable};
        if (iterable.flip) {
          reversedSequence.flip = function () {
            var flipSequence = flipFactory(iterable);
            flipSequence.reverse = function()  {return iterable.flip()};
            return flipSequence;
          };
        }
        reversedSequence.get = function(key, notSetValue) 
          {return iterable.get(useKeys ? key : -1 - key, notSetValue)};
        reversedSequence.has = function(key )
          {return iterable.has(useKeys ? key : -1 - key)};
        reversedSequence.includes = function(value ) {return iterable.includes(value)};
        reversedSequence.cacheResult = cacheResultThrough;
        reversedSequence.__iterate = function (fn, reverse) {var this$0 = this;
          return iterable.__iterate(function(v, k)  {return fn(v, k, this$0)}, !reverse);
        };
        reversedSequence.__iterator =
          function(type, reverse)  {return iterable.__iterator(type, !reverse)};
        return reversedSequence;
      }
    
    
      function filterFactory(iterable, predicate, context, useKeys) {
        var filterSequence = makeSequence(iterable);
        if (useKeys) {
          filterSequence.has = function(key ) {
            var v = iterable.get(key, NOT_SET);
            return v !== NOT_SET && !!predicate.call(context, v, key, iterable);
          };
          filterSequence.get = function(key, notSetValue)  {
            var v = iterable.get(key, NOT_SET);
            return v !== NOT_SET && predicate.call(context, v, key, iterable) ?
              v : notSetValue;
          };
        }
        filterSequence.__iterateUncached = function (fn, reverse) {var this$0 = this;
          var iterations = 0;
          iterable.__iterate(function(v, k, c)  {
            if (predicate.call(context, v, k, c)) {
              iterations++;
              return fn(v, useKeys ? k : iterations - 1, this$0);
            }
          }, reverse);
          return iterations;
        };
        filterSequence.__iteratorUncached = function (type, reverse) {
          var iterator = iterable.__iterator(ITERATE_ENTRIES, reverse);
          var iterations = 0;
          return new Iterator(function()  {
            while (true) {
              var step = iterator.next();
              if (step.done) {
                return step;
              }
              var entry = step.value;
              var key = entry[0];
              var value = entry[1];
              if (predicate.call(context, value, key, iterable)) {
                return iteratorValue(type, useKeys ? key : iterations++, value, step);
              }
            }
          });
        }
        return filterSequence;
      }
    
    
      function countByFactory(iterable, grouper, context) {
        var groups = Map().asMutable();
        iterable.__iterate(function(v, k)  {
          groups.update(
            grouper.call(context, v, k, iterable),
            0,
            function(a ) {return a + 1}
          );
        });
        return groups.asImmutable();
      }
    
    
      function groupByFactory(iterable, grouper, context) {
        var isKeyedIter = isKeyed(iterable);
        var groups = (isOrdered(iterable) ? OrderedMap() : Map()).asMutable();
        iterable.__iterate(function(v, k)  {
          groups.update(
            grouper.call(context, v, k, iterable),
            function(a ) {return (a = a || [], a.push(isKeyedIter ? [k, v] : v), a)}
          );
        });
        var coerce = iterableClass(iterable);
        return groups.map(function(arr ) {return reify(iterable, coerce(arr))});
      }
    
    
      function sliceFactory(iterable, begin, end, useKeys) {
        var originalSize = iterable.size;
    
        // Sanitize begin & end using this shorthand for ToInt32(argument)
        // http://www.ecma-international.org/ecma-262/6.0/#sec-toint32
        if (begin !== undefined) {
          begin = begin | 0;
        }
        if (end !== undefined) {
          if (end === Infinity) {
            end = originalSize;
          } else {
            end = end | 0;
          }
        }
    
        if (wholeSlice(begin, end, originalSize)) {
          return iterable;
        }
    
        var resolvedBegin = resolveBegin(begin, originalSize);
        var resolvedEnd = resolveEnd(end, originalSize);
    
        // begin or end will be NaN if they were provided as negative numbers and
        // this iterable's size is unknown. In that case, cache first so there is
        // a known size and these do not resolve to NaN.
        if (resolvedBegin !== resolvedBegin || resolvedEnd !== resolvedEnd) {
          return sliceFactory(iterable.toSeq().cacheResult(), begin, end, useKeys);
        }
    
        // Note: resolvedEnd is undefined when the original sequence's length is
        // unknown and this slice did not supply an end and should contain all
        // elements after resolvedBegin.
        // In that case, resolvedSize will be NaN and sliceSize will remain undefined.
        var resolvedSize = resolvedEnd - resolvedBegin;
        var sliceSize;
        if (resolvedSize === resolvedSize) {
          sliceSize = resolvedSize < 0 ? 0 : resolvedSize;
        }
    
        var sliceSeq = makeSequence(iterable);
    
        // If iterable.size is undefined, the size of the realized sliceSeq is
        // unknown at this point unless the number of items to slice is 0
        sliceSeq.size = sliceSize === 0 ? sliceSize : iterable.size && sliceSize || undefined;
    
        if (!useKeys && isSeq(iterable) && sliceSize >= 0) {
          sliceSeq.get = function (index, notSetValue) {
            index = wrapIndex(this, index);
            return index >= 0 && index < sliceSize ?
              iterable.get(index + resolvedBegin, notSetValue) :
              notSetValue;
          }
        }
    
        sliceSeq.__iterateUncached = function(fn, reverse) {var this$0 = this;
          if (sliceSize === 0) {
            return 0;
          }
          if (reverse) {
            return this.cacheResult().__iterate(fn, reverse);
          }
          var skipped = 0;
          var isSkipping = true;
          var iterations = 0;
          iterable.__iterate(function(v, k)  {
            if (!(isSkipping && (isSkipping = skipped++ < resolvedBegin))) {
              iterations++;
              return fn(v, useKeys ? k : iterations - 1, this$0) !== false &&
                     iterations !== sliceSize;
            }
          });
          return iterations;
        };
    
        sliceSeq.__iteratorUncached = function(type, reverse) {
          if (sliceSize !== 0 && reverse) {
            return this.cacheResult().__iterator(type, reverse);
          }
          // Don't bother instantiating parent iterator if taking 0.
          var iterator = sliceSize !== 0 && iterable.__iterator(type, reverse);
          var skipped = 0;
          var iterations = 0;
          return new Iterator(function()  {
            while (skipped++ < resolvedBegin) {
              iterator.next();
            }
            if (++iterations > sliceSize) {
              return iteratorDone();
            }
            var step = iterator.next();
            if (useKeys || type === ITERATE_VALUES) {
              return step;
            } else if (type === ITERATE_KEYS) {
              return iteratorValue(type, iterations - 1, undefined, step);
            } else {
              return iteratorValue(type, iterations - 1, step.value[1], step);
            }
          });
        }
    
        return sliceSeq;
      }
    
    
      function takeWhileFactory(iterable, predicate, context) {
        var takeSequence = makeSequence(iterable);
        takeSequence.__iterateUncached = function(fn, reverse) {var this$0 = this;
          if (reverse) {
            return this.cacheResult().__iterate(fn, reverse);
          }
          var iterations = 0;
          iterable.__iterate(function(v, k, c) 
            {return predicate.call(context, v, k, c) && ++iterations && fn(v, k, this$0)}
          );
          return iterations;
        };
        takeSequence.__iteratorUncached = function(type, reverse) {var this$0 = this;
          if (reverse) {
            return this.cacheResult().__iterator(type, reverse);
          }
          var iterator = iterable.__iterator(ITERATE_ENTRIES, reverse);
          var iterating = true;
          return new Iterator(function()  {
            if (!iterating) {
              return iteratorDone();
            }
            var step = iterator.next();
            if (step.done) {
              return step;
            }
            var entry = step.value;
            var k = entry[0];
            var v = entry[1];
            if (!predicate.call(context, v, k, this$0)) {
              iterating = false;
              return iteratorDone();
            }
            return type === ITERATE_ENTRIES ? step :
              iteratorValue(type, k, v, step);
          });
        };
        return takeSequence;
      }
    
    
      function skipWhileFactory(iterable, predicate, context, useKeys) {
        var skipSequence = makeSequence(iterable);
        skipSequence.__iterateUncached = function (fn, reverse) {var this$0 = this;
          if (reverse) {
            return this.cacheResult().__iterate(fn, reverse);
          }
          var isSkipping = true;
          var iterations = 0;
          iterable.__iterate(function(v, k, c)  {
            if (!(isSkipping && (isSkipping = predicate.call(context, v, k, c)))) {
              iterations++;
              return fn(v, useKeys ? k : iterations - 1, this$0);
            }
          });
          return iterations;
        };
        skipSequence.__iteratorUncached = function(type, reverse) {var this$0 = this;
          if (reverse) {
            return this.cacheResult().__iterator(type, reverse);
          }
          var iterator = iterable.__iterator(ITERATE_ENTRIES, reverse);
          var skipping = true;
          var iterations = 0;
          return new Iterator(function()  {
            var step, k, v;
            do {
              step = iterator.next();
              if (step.done) {
                if (useKeys || type === ITERATE_VALUES) {
                  return step;
                } else if (type === ITERATE_KEYS) {
                  return iteratorValue(type, iterations++, undefined, step);
                } else {
                  return iteratorValue(type, iterations++, step.value[1], step);
                }
              }
              var entry = step.value;
              k = entry[0];
              v = entry[1];
              skipping && (skipping = predicate.call(context, v, k, this$0));
            } while (skipping);
            return type === ITERATE_ENTRIES ? step :
              iteratorValue(type, k, v, step);
          });
        };
        return skipSequence;
      }
    
    
      function concatFactory(iterable, values) {
        var isKeyedIterable = isKeyed(iterable);
        var iters = [iterable].concat(values).map(function(v ) {
          if (!isIterable(v)) {
            v = isKeyedIterable ?
              keyedSeqFromValue(v) :
              indexedSeqFromValue(Array.isArray(v) ? v : [v]);
          } else if (isKeyedIterable) {
            v = KeyedIterable(v);
          }
          return v;
        }).filter(function(v ) {return v.size !== 0});
    
        if (iters.length === 0) {
          return iterable;
        }
    
        if (iters.length === 1) {
          var singleton = iters[0];
          if (singleton === iterable ||
              isKeyedIterable && isKeyed(singleton) ||
              isIndexed(iterable) && isIndexed(singleton)) {
            return singleton;
          }
        }
    
        var concatSeq = new ArraySeq(iters);
        if (isKeyedIterable) {
          concatSeq = concatSeq.toKeyedSeq();
        } else if (!isIndexed(iterable)) {
          concatSeq = concatSeq.toSetSeq();
        }
        concatSeq = concatSeq.flatten(true);
        concatSeq.size = iters.reduce(
          function(sum, seq)  {
            if (sum !== undefined) {
              var size = seq.size;
              if (size !== undefined) {
                return sum + size;
              }
            }
          },
          0
        );
        return concatSeq;
      }
    
    
      function flattenFactory(iterable, depth, useKeys) {
        var flatSequence = makeSequence(iterable);
        flatSequence.__iterateUncached = function(fn, reverse) {
          var iterations = 0;
          var stopped = false;
          function flatDeep(iter, currentDepth) {var this$0 = this;
            iter.__iterate(function(v, k)  {
              if ((!depth || currentDepth < depth) && isIterable(v)) {
                flatDeep(v, currentDepth + 1);
              } else if (fn(v, useKeys ? k : iterations++, this$0) === false) {
                stopped = true;
              }
              return !stopped;
            }, reverse);
          }
          flatDeep(iterable, 0);
          return iterations;
        }
        flatSequence.__iteratorUncached = function(type, reverse) {
          var iterator = iterable.__iterator(type, reverse);
          var stack = [];
          var iterations = 0;
          return new Iterator(function()  {
            while (iterator) {
              var step = iterator.next();
              if (step.done !== false) {
                iterator = stack.pop();
                continue;
              }
              var v = step.value;
              if (type === ITERATE_ENTRIES) {
                v = v[1];
              }
              if ((!depth || stack.length < depth) && isIterable(v)) {
                stack.push(iterator);
                iterator = v.__iterator(type, reverse);
              } else {
                return useKeys ? step : iteratorValue(type, iterations++, v, step);
              }
            }
            return iteratorDone();
          });
        }
        return flatSequence;
      }
    
    
      function flatMapFactory(iterable, mapper, context) {
        var coerce = iterableClass(iterable);
        return iterable.toSeq().map(
          function(v, k)  {return coerce(mapper.call(context, v, k, iterable))}
        ).flatten(true);
      }
    
    
      function interposeFactory(iterable, separator) {
        var interposedSequence = makeSequence(iterable);
        interposedSequence.size = iterable.size && iterable.size * 2 -1;
        interposedSequence.__iterateUncached = function(fn, reverse) {var this$0 = this;
          var iterations = 0;
          iterable.__iterate(function(v, k) 
            {return (!iterations || fn(separator, iterations++, this$0) !== false) &&
            fn(v, iterations++, this$0) !== false},
            reverse
          );
          return iterations;
        };
        interposedSequence.__iteratorUncached = function(type, reverse) {
          var iterator = iterable.__iterator(ITERATE_VALUES, reverse);
          var iterations = 0;
          var step;
          return new Iterator(function()  {
            if (!step || iterations % 2) {
              step = iterator.next();
              if (step.done) {
                return step;
              }
            }
            return iterations % 2 ?
              iteratorValue(type, iterations++, separator) :
              iteratorValue(type, iterations++, step.value, step);
          });
        };
        return interposedSequence;
      }
    
    
      function sortFactory(iterable, comparator, mapper) {
        if (!comparator) {
          comparator = defaultComparator;
        }
        var isKeyedIterable = isKeyed(iterable);
        var index = 0;
        var entries = iterable.toSeq().map(
          function(v, k)  {return [k, v, index++, mapper ? mapper(v, k, iterable) : v]}
        ).toArray();
        entries.sort(function(a, b)  {return comparator(a[3], b[3]) || a[2] - b[2]}).forEach(
          isKeyedIterable ?
          function(v, i)  { entries[i].length = 2; } :
          function(v, i)  { entries[i] = v[1]; }
        );
        return isKeyedIterable ? KeyedSeq(entries) :
          isIndexed(iterable) ? IndexedSeq(entries) :
          SetSeq(entries);
      }
    
    
      function maxFactory(iterable, comparator, mapper) {
        if (!comparator) {
          comparator = defaultComparator;
        }
        if (mapper) {
          var entry = iterable.toSeq()
            .map(function(v, k)  {return [v, mapper(v, k, iterable)]})
            .reduce(function(a, b)  {return maxCompare(comparator, a[1], b[1]) ? b : a});
          return entry && entry[0];
        } else {
          return iterable.reduce(function(a, b)  {return maxCompare(comparator, a, b) ? b : a});
        }
      }
    
      function maxCompare(comparator, a, b) {
        var comp = comparator(b, a);
        // b is considered the new max if the comparator declares them equal, but
        // they are not equal and b is in fact a nullish value.
        return (comp === 0 && b !== a && (b === undefined || b === null || b !== b)) || comp > 0;
      }
    
    
      function zipWithFactory(keyIter, zipper, iters) {
        var zipSequence = makeSequence(keyIter);
        zipSequence.size = new ArraySeq(iters).map(function(i ) {return i.size}).min();
        // Note: this a generic base implementation of __iterate in terms of
        // __iterator which may be more generically useful in the future.
        zipSequence.__iterate = function(fn, reverse) {
          /* generic:
          var iterator = this.__iterator(ITERATE_ENTRIES, reverse);
          var step;
          var iterations = 0;
          while (!(step = iterator.next()).done) {
            iterations++;
            if (fn(step.value[1], step.value[0], this) === false) {
              break;
            }
          }
          return iterations;
          */
          // indexed:
          var iterator = this.__iterator(ITERATE_VALUES, reverse);
          var step;
          var iterations = 0;
          while (!(step = iterator.next()).done) {
            if (fn(step.value, iterations++, this) === false) {
              break;
            }
          }
          return iterations;
        };
        zipSequence.__iteratorUncached = function(type, reverse) {
          var iterators = iters.map(function(i )
            {return (i = Iterable(i), getIterator(reverse ? i.reverse() : i))}
          );
          var iterations = 0;
          var isDone = false;
          return new Iterator(function()  {
            var steps;
            if (!isDone) {
              steps = iterators.map(function(i ) {return i.next()});
              isDone = steps.some(function(s ) {return s.done});
            }
            if (isDone) {
              return iteratorDone();
            }
            return iteratorValue(
              type,
              iterations++,
              zipper.apply(null, steps.map(function(s ) {return s.value}))
            );
          });
        };
        return zipSequence
      }
    
    
      // #pragma Helper Functions
    
      function reify(iter, seq) {
        return isSeq(iter) ? seq : iter.constructor(seq);
      }
    
      function validateEntry(entry) {
        if (entry !== Object(entry)) {
          throw new TypeError('Expected [K, V] tuple: ' + entry);
        }
      }
    
      function resolveSize(iter) {
        assertNotInfinite(iter.size);
        return ensureSize(iter);
      }
    
      function iterableClass(iterable) {
        return isKeyed(iterable) ? KeyedIterable :
          isIndexed(iterable) ? IndexedIterable :
          SetIterable;
      }
    
      function makeSequence(iterable) {
        return Object.create(
          (
            isKeyed(iterable) ? KeyedSeq :
            isIndexed(iterable) ? IndexedSeq :
            SetSeq
          ).prototype
        );
      }
    
      function cacheResultThrough() {
        if (this._iter.cacheResult) {
          this._iter.cacheResult();
          this.size = this._iter.size;
          return this;
        } else {
          return Seq.prototype.cacheResult.call(this);
        }
      }
    
      function defaultComparator(a, b) {
        return a > b ? 1 : a < b ? -1 : 0;
      }
    
      function forceIterator(keyPath) {
        var iter = getIterator(keyPath);
        if (!iter) {
          // Array might not be iterable in this environment, so we need a fallback
          // to our wrapped type.
          if (!isArrayLike(keyPath)) {
            throw new TypeError('Expected iterable or array-like: ' + keyPath);
          }
          iter = getIterator(Iterable(keyPath));
        }
        return iter;
      }
    
      createClass(Record, KeyedCollection);
    
        function Record(defaultValues, name) {
          var hasInitialized;
    
          var RecordType = function Record(values) {
            if (values instanceof RecordType) {
              return values;
            }
            if (!(this instanceof RecordType)) {
              return new RecordType(values);
            }
            if (!hasInitialized) {
              hasInitialized = true;
              var keys = Object.keys(defaultValues);
              setProps(RecordTypePrototype, keys);
              RecordTypePrototype.size = keys.length;
              RecordTypePrototype._name = name;
              RecordTypePrototype._keys = keys;
              RecordTypePrototype._defaultValues = defaultValues;
            }
            this._map = Map(values);
          };
    
          var RecordTypePrototype = RecordType.prototype = Object.create(RecordPrototype);
          RecordTypePrototype.constructor = RecordType;
    
          return RecordType;
        }
    
        Record.prototype.toString = function() {
          return this.__toString(recordName(this) + ' {', '}');
        };
    
        // @pragma Access
    
        Record.prototype.has = function(k) {
          return this._defaultValues.hasOwnProperty(k);
        };
    
        Record.prototype.get = function(k, notSetValue) {
          if (!this.has(k)) {
            return notSetValue;
          }
          var defaultVal = this._defaultValues[k];
          return this._map ? this._map.get(k, defaultVal) : defaultVal;
        };
    
        // @pragma Modification
    
        Record.prototype.clear = function() {
          if (this.__ownerID) {
            this._map && this._map.clear();
            return this;
          }
          var RecordType = this.constructor;
          return RecordType._empty || (RecordType._empty = makeRecord(this, emptyMap()));
        };
    
        Record.prototype.set = function(k, v) {
          if (!this.has(k)) {
            throw new Error('Cannot set unknown key "' + k + '" on ' + recordName(this));
          }
          if (this._map && !this._map.has(k)) {
            var defaultVal = this._defaultValues[k];
            if (v === defaultVal) {
              return this;
            }
          }
          var newMap = this._map && this._map.set(k, v);
          if (this.__ownerID || newMap === this._map) {
            return this;
          }
          return makeRecord(this, newMap);
        };
    
        Record.prototype.remove = function(k) {
          if (!this.has(k)) {
            return this;
          }
          var newMap = this._map && this._map.remove(k);
          if (this.__ownerID || newMap === this._map) {
            return this;
          }
          return makeRecord(this, newMap);
        };
    
        Record.prototype.wasAltered = function() {
          return this._map.wasAltered();
        };
    
        Record.prototype.__iterator = function(type, reverse) {var this$0 = this;
          return KeyedIterable(this._defaultValues).map(function(_, k)  {return this$0.get(k)}).__iterator(type, reverse);
        };
    
        Record.prototype.__iterate = function(fn, reverse) {var this$0 = this;
          return KeyedIterable(this._defaultValues).map(function(_, k)  {return this$0.get(k)}).__iterate(fn, reverse);
        };
    
        Record.prototype.__ensureOwner = function(ownerID) {
          if (ownerID === this.__ownerID) {
            return this;
          }
          var newMap = this._map && this._map.__ensureOwner(ownerID);
          if (!ownerID) {
            this.__ownerID = ownerID;
            this._map = newMap;
            return this;
          }
          return makeRecord(this, newMap, ownerID);
        };
    
    
      var RecordPrototype = Record.prototype;
      RecordPrototype[DELETE] = RecordPrototype.remove;
      RecordPrototype.deleteIn =
      RecordPrototype.removeIn = MapPrototype.removeIn;
      RecordPrototype.merge = MapPrototype.merge;
      RecordPrototype.mergeWith = MapPrototype.mergeWith;
      RecordPrototype.mergeIn = MapPrototype.mergeIn;
      RecordPrototype.mergeDeep = MapPrototype.mergeDeep;
      RecordPrototype.mergeDeepWith = MapPrototype.mergeDeepWith;
      RecordPrototype.mergeDeepIn = MapPrototype.mergeDeepIn;
      RecordPrototype.setIn = MapPrototype.setIn;
      RecordPrototype.update = MapPrototype.update;
      RecordPrototype.updateIn = MapPrototype.updateIn;
      RecordPrototype.withMutations = MapPrototype.withMutations;
      RecordPrototype.asMutable = MapPrototype.asMutable;
      RecordPrototype.asImmutable = MapPrototype.asImmutable;
    
    
      function makeRecord(likeRecord, map, ownerID) {
        var record = Object.create(Object.getPrototypeOf(likeRecord));
        record._map = map;
        record.__ownerID = ownerID;
        return record;
      }
    
      function recordName(record) {
        return record._name || record.constructor.name || 'Record';
      }
    
      function setProps(prototype, names) {
        try {
          names.forEach(setProp.bind(undefined, prototype));
        } catch (error) {
          // Object.defineProperty failed. Probably IE8.
        }
      }
    
      function setProp(prototype, name) {
        Object.defineProperty(prototype, name, {
          get: function() {
            return this.get(name);
          },
          set: function(value) {
            invariant(this.__ownerID, 'Cannot set on an immutable record.');
            this.set(name, value);
          }
        });
      }
    
      createClass(Set, SetCollection);
    
        // @pragma Construction
    
        function Set(value) {
          return value === null || value === undefined ? emptySet() :
            isSet(value) && !isOrdered(value) ? value :
            emptySet().withMutations(function(set ) {
              var iter = SetIterable(value);
              assertNotInfinite(iter.size);
              iter.forEach(function(v ) {return set.add(v)});
            });
        }
    
        Set.of = function(/*...values*/) {
          return this(arguments);
        };
    
        Set.fromKeys = function(value) {
          return this(KeyedIterable(value).keySeq());
        };
    
        Set.prototype.toString = function() {
          return this.__toString('Set {', '}');
        };
    
        // @pragma Access
    
        Set.prototype.has = function(value) {
          return this._map.has(value);
        };
    
        // @pragma Modification
    
        Set.prototype.add = function(value) {
          return updateSet(this, this._map.set(value, true));
        };
    
        Set.prototype.remove = function(value) {
          return updateSet(this, this._map.remove(value));
        };
    
        Set.prototype.clear = function() {
          return updateSet(this, this._map.clear());
        };
    
        // @pragma Composition
    
        Set.prototype.union = function() {var iters = SLICE$0.call(arguments, 0);
          iters = iters.filter(function(x ) {return x.size !== 0});
          if (iters.length === 0) {
            return this;
          }
          if (this.size === 0 && !this.__ownerID && iters.length === 1) {
            return this.constructor(iters[0]);
          }
          return this.withMutations(function(set ) {
            for (var ii = 0; ii < iters.length; ii++) {
              SetIterable(iters[ii]).forEach(function(value ) {return set.add(value)});
            }
          });
        };
    
        Set.prototype.intersect = function() {var iters = SLICE$0.call(arguments, 0);
          if (iters.length === 0) {
            return this;
          }
          iters = iters.map(function(iter ) {return SetIterable(iter)});
          var originalSet = this;
          return this.withMutations(function(set ) {
            originalSet.forEach(function(value ) {
              if (!iters.every(function(iter ) {return iter.includes(value)})) {
                set.remove(value);
              }
            });
          });
        };
    
        Set.prototype.subtract = function() {var iters = SLICE$0.call(arguments, 0);
          if (iters.length === 0) {
            return this;
          }
          iters = iters.map(function(iter ) {return SetIterable(iter)});
          var originalSet = this;
          return this.withMutations(function(set ) {
            originalSet.forEach(function(value ) {
              if (iters.some(function(iter ) {return iter.includes(value)})) {
                set.remove(value);
              }
            });
          });
        };
    
        Set.prototype.merge = function() {
          return this.union.apply(this, arguments);
        };
    
        Set.prototype.mergeWith = function(merger) {var iters = SLICE$0.call(arguments, 1);
          return this.union.apply(this, iters);
        };
    
        Set.prototype.sort = function(comparator) {
          // Late binding
          return OrderedSet(sortFactory(this, comparator));
        };
    
        Set.prototype.sortBy = function(mapper, comparator) {
          // Late binding
          return OrderedSet(sortFactory(this, comparator, mapper));
        };
    
        Set.prototype.wasAltered = function() {
          return this._map.wasAltered();
        };
    
        Set.prototype.__iterate = function(fn, reverse) {var this$0 = this;
          return this._map.__iterate(function(_, k)  {return fn(k, k, this$0)}, reverse);
        };
    
        Set.prototype.__iterator = function(type, reverse) {
          return this._map.map(function(_, k)  {return k}).__iterator(type, reverse);
        };
    
        Set.prototype.__ensureOwner = function(ownerID) {
          if (ownerID === this.__ownerID) {
            return this;
          }
          var newMap = this._map.__ensureOwner(ownerID);
          if (!ownerID) {
            this.__ownerID = ownerID;
            this._map = newMap;
            return this;
          }
          return this.__make(newMap, ownerID);
        };
    
    
      function isSet(maybeSet) {
        return !!(maybeSet && maybeSet[IS_SET_SENTINEL]);
      }
    
      Set.isSet = isSet;
    
      var IS_SET_SENTINEL = '@@__IMMUTABLE_SET__@@';
    
      var SetPrototype = Set.prototype;
      SetPrototype[IS_SET_SENTINEL] = true;
      SetPrototype[DELETE] = SetPrototype.remove;
      SetPrototype.mergeDeep = SetPrototype.merge;
      SetPrototype.mergeDeepWith = SetPrototype.mergeWith;
      SetPrototype.withMutations = MapPrototype.withMutations;
      SetPrototype.asMutable = MapPrototype.asMutable;
      SetPrototype.asImmutable = MapPrototype.asImmutable;
    
      SetPrototype.__empty = emptySet;
      SetPrototype.__make = makeSet;
    
      function updateSet(set, newMap) {
        if (set.__ownerID) {
          set.size = newMap.size;
          set._map = newMap;
          return set;
        }
        return newMap === set._map ? set :
          newMap.size === 0 ? set.__empty() :
          set.__make(newMap);
      }
    
      function makeSet(map, ownerID) {
        var set = Object.create(SetPrototype);
        set.size = map ? map.size : 0;
        set._map = map;
        set.__ownerID = ownerID;
        return set;
      }
    
      var EMPTY_SET;
      function emptySet() {
        return EMPTY_SET || (EMPTY_SET = makeSet(emptyMap()));
      }
    
      createClass(OrderedSet, Set);
    
        // @pragma Construction
    
        function OrderedSet(value) {
          return value === null || value === undefined ? emptyOrderedSet() :
            isOrderedSet(value) ? value :
            emptyOrderedSet().withMutations(function(set ) {
              var iter = SetIterable(value);
              assertNotInfinite(iter.size);
              iter.forEach(function(v ) {return set.add(v)});
            });
        }
    
        OrderedSet.of = function(/*...values*/) {
          return this(arguments);
        };
    
        OrderedSet.fromKeys = function(value) {
          return this(KeyedIterable(value).keySeq());
        };
    
        OrderedSet.prototype.toString = function() {
          return this.__toString('OrderedSet {', '}');
        };
    
    
      function isOrderedSet(maybeOrderedSet) {
        return isSet(maybeOrderedSet) && isOrdered(maybeOrderedSet);
      }
    
      OrderedSet.isOrderedSet = isOrderedSet;
    
      var OrderedSetPrototype = OrderedSet.prototype;
      OrderedSetPrototype[IS_ORDERED_SENTINEL] = true;
    
      OrderedSetPrototype.__empty = emptyOrderedSet;
      OrderedSetPrototype.__make = makeOrderedSet;
    
      function makeOrderedSet(map, ownerID) {
        var set = Object.create(OrderedSetPrototype);
        set.size = map ? map.size : 0;
        set._map = map;
        set.__ownerID = ownerID;
        return set;
      }
    
      var EMPTY_ORDERED_SET;
      function emptyOrderedSet() {
        return EMPTY_ORDERED_SET || (EMPTY_ORDERED_SET = makeOrderedSet(emptyOrderedMap()));
      }
    
      createClass(Stack, IndexedCollection);
    
        // @pragma Construction
    
        function Stack(value) {
          return value === null || value === undefined ? emptyStack() :
            isStack(value) ? value :
            emptyStack().unshiftAll(value);
        }
    
        Stack.of = function(/*...values*/) {
          return this(arguments);
        };
    
        Stack.prototype.toString = function() {
          return this.__toString('Stack [', ']');
        };
    
        // @pragma Access
    
        Stack.prototype.get = function(index, notSetValue) {
          var head = this._head;
          index = wrapIndex(this, index);
          while (head && index--) {
            head = head.next;
          }
          return head ? head.value : notSetValue;
        };
    
        Stack.prototype.peek = function() {
          return this._head && this._head.value;
        };
    
        // @pragma Modification
    
        Stack.prototype.push = function(/*...values*/) {
          if (arguments.length === 0) {
            return this;
          }
          var newSize = this.size + arguments.length;
          var head = this._head;
          for (var ii = arguments.length - 1; ii >= 0; ii--) {
            head = {
              value: arguments[ii],
              next: head
            };
          }
          if (this.__ownerID) {
            this.size = newSize;
            this._head = head;
            this.__hash = undefined;
            this.__altered = true;
            return this;
          }
          return makeStack(newSize, head);
        };
    
        Stack.prototype.pushAll = function(iter) {
          iter = IndexedIterable(iter);
          if (iter.size === 0) {
            return this;
          }
          assertNotInfinite(iter.size);
          var newSize = this.size;
          var head = this._head;
          iter.reverse().forEach(function(value ) {
            newSize++;
            head = {
              value: value,
              next: head
            };
          });
          if (this.__ownerID) {
            this.size = newSize;
            this._head = head;
            this.__hash = undefined;
            this.__altered = true;
            return this;
          }
          return makeStack(newSize, head);
        };
    
        Stack.prototype.pop = function() {
          return this.slice(1);
        };
    
        Stack.prototype.unshift = function(/*...values*/) {
          return this.push.apply(this, arguments);
        };
    
        Stack.prototype.unshiftAll = function(iter) {
          return this.pushAll(iter);
        };
    
        Stack.prototype.shift = function() {
          return this.pop.apply(this, arguments);
        };
    
        Stack.prototype.clear = function() {
          if (this.size === 0) {
            return this;
          }
          if (this.__ownerID) {
            this.size = 0;
            this._head = undefined;
            this.__hash = undefined;
            this.__altered = true;
            return this;
          }
          return emptyStack();
        };
    
        Stack.prototype.slice = function(begin, end) {
          if (wholeSlice(begin, end, this.size)) {
            return this;
          }
          var resolvedBegin = resolveBegin(begin, this.size);
          var resolvedEnd = resolveEnd(end, this.size);
          if (resolvedEnd !== this.size) {
            // super.slice(begin, end);
            return IndexedCollection.prototype.slice.call(this, begin, end);
          }
          var newSize = this.size - resolvedBegin;
          var head = this._head;
          while (resolvedBegin--) {
            head = head.next;
          }
          if (this.__ownerID) {
            this.size = newSize;
            this._head = head;
            this.__hash = undefined;
            this.__altered = true;
            return this;
          }
          return makeStack(newSize, head);
        };
    
        // @pragma Mutability
    
        Stack.prototype.__ensureOwner = function(ownerID) {
          if (ownerID === this.__ownerID) {
            return this;
          }
          if (!ownerID) {
            this.__ownerID = ownerID;
            this.__altered = false;
            return this;
          }
          return makeStack(this.size, this._head, ownerID, this.__hash);
        };
    
        // @pragma Iteration
    
        Stack.prototype.__iterate = function(fn, reverse) {
          if (reverse) {
            return this.reverse().__iterate(fn);
          }
          var iterations = 0;
          var node = this._head;
          while (node) {
            if (fn(node.value, iterations++, this) === false) {
              break;
            }
            node = node.next;
          }
          return iterations;
        };
    
        Stack.prototype.__iterator = function(type, reverse) {
          if (reverse) {
            return this.reverse().__iterator(type);
          }
          var iterations = 0;
          var node = this._head;
          return new Iterator(function()  {
            if (node) {
              var value = node.value;
              node = node.next;
              return iteratorValue(type, iterations++, value);
            }
            return iteratorDone();
          });
        };
    
    
      function isStack(maybeStack) {
        return !!(maybeStack && maybeStack[IS_STACK_SENTINEL]);
      }
    
      Stack.isStack = isStack;
    
      var IS_STACK_SENTINEL = '@@__IMMUTABLE_STACK__@@';
    
      var StackPrototype = Stack.prototype;
      StackPrototype[IS_STACK_SENTINEL] = true;
      StackPrototype.withMutations = MapPrototype.withMutations;
      StackPrototype.asMutable = MapPrototype.asMutable;
      StackPrototype.asImmutable = MapPrototype.asImmutable;
      StackPrototype.wasAltered = MapPrototype.wasAltered;
    
    
      function makeStack(size, head, ownerID, hash) {
        var map = Object.create(StackPrototype);
        map.size = size;
        map._head = head;
        map.__ownerID = ownerID;
        map.__hash = hash;
        map.__altered = false;
        return map;
      }
    
      var EMPTY_STACK;
      function emptyStack() {
        return EMPTY_STACK || (EMPTY_STACK = makeStack(0));
      }
    
      /**
       * Contributes additional methods to a constructor
       */
      function mixin(ctor, methods) {
        var keyCopier = function(key ) { ctor.prototype[key] = methods[key]; };
        Object.keys(methods).forEach(keyCopier);
        Object.getOwnPropertySymbols &&
          Object.getOwnPropertySymbols(methods).forEach(keyCopier);
        return ctor;
      }
    
      Iterable.Iterator = Iterator;
    
      mixin(Iterable, {
    
        // ### Conversion to other types
    
        toArray: function() {
          assertNotInfinite(this.size);
          var array = new Array(this.size || 0);
          this.valueSeq().__iterate(function(v, i)  { array[i] = v; });
          return array;
        },
    
        toIndexedSeq: function() {
          return new ToIndexedSequence(this);
        },
    
        toJS: function() {
          return this.toSeq().map(
            function(value ) {return value && typeof value.toJS === 'function' ? value.toJS() : value}
          ).__toJS();
        },
    
        toJSON: function() {
          return this.toSeq().map(
            function(value ) {return value && typeof value.toJSON === 'function' ? value.toJSON() : value}
          ).__toJS();
        },
    
        toKeyedSeq: function() {
          return new ToKeyedSequence(this, true);
        },
    
        toMap: function() {
          // Use Late Binding here to solve the circular dependency.
          return Map(this.toKeyedSeq());
        },
    
        toObject: function() {
          assertNotInfinite(this.size);
          var object = {};
          this.__iterate(function(v, k)  { object[k] = v; });
          return object;
        },
    
        toOrderedMap: function() {
          // Use Late Binding here to solve the circular dependency.
          return OrderedMap(this.toKeyedSeq());
        },
    
        toOrderedSet: function() {
          // Use Late Binding here to solve the circular dependency.
          return OrderedSet(isKeyed(this) ? this.valueSeq() : this);
        },
    
        toSet: function() {
          // Use Late Binding here to solve the circular dependency.
          return Set(isKeyed(this) ? this.valueSeq() : this);
        },
    
        toSetSeq: function() {
          return new ToSetSequence(this);
        },
    
        toSeq: function() {
          return isIndexed(this) ? this.toIndexedSeq() :
            isKeyed(this) ? this.toKeyedSeq() :
            this.toSetSeq();
        },
    
        toStack: function() {
          // Use Late Binding here to solve the circular dependency.
          return Stack(isKeyed(this) ? this.valueSeq() : this);
        },
    
        toList: function() {
          // Use Late Binding here to solve the circular dependency.
          return List(isKeyed(this) ? this.valueSeq() : this);
        },
    
    
        // ### Common JavaScript methods and properties
    
        toString: function() {
          return '[Iterable]';
        },
    
        __toString: function(head, tail) {
          if (this.size === 0) {
            return head + tail;
          }
          return head + ' ' + this.toSeq().map(this.__toStringMapper).join(', ') + ' ' + tail;
        },
    
    
        // ### ES6 Collection methods (ES6 Array and Map)
    
        concat: function() {var values = SLICE$0.call(arguments, 0);
          return reify(this, concatFactory(this, values));
        },
    
        includes: function(searchValue) {
          return this.some(function(value ) {return is(value, searchValue)});
        },
    
        entries: function() {
          return this.__iterator(ITERATE_ENTRIES);
        },
    
        every: function(predicate, context) {
          assertNotInfinite(this.size);
          var returnValue = true;
          this.__iterate(function(v, k, c)  {
            if (!predicate.call(context, v, k, c)) {
              returnValue = false;
              return false;
            }
          });
          return returnValue;
        },
    
        filter: function(predicate, context) {
          return reify(this, filterFactory(this, predicate, context, true));
        },
    
        find: function(predicate, context, notSetValue) {
          var entry = this.findEntry(predicate, context);
          return entry ? entry[1] : notSetValue;
        },
    
        forEach: function(sideEffect, context) {
          assertNotInfinite(this.size);
          return this.__iterate(context ? sideEffect.bind(context) : sideEffect);
        },
    
        join: function(separator) {
          assertNotInfinite(this.size);
          separator = separator !== undefined ? '' + separator : ',';
          var joined = '';
          var isFirst = true;
          this.__iterate(function(v ) {
            isFirst ? (isFirst = false) : (joined += separator);
            joined += v !== null && v !== undefined ? v.toString() : '';
          });
          return joined;
        },
    
        keys: function() {
          return this.__iterator(ITERATE_KEYS);
        },
    
        map: function(mapper, context) {
          return reify(this, mapFactory(this, mapper, context));
        },
    
        reduce: function(reducer, initialReduction, context) {
          assertNotInfinite(this.size);
          var reduction;
          var useFirst;
          if (arguments.length < 2) {
            useFirst = true;
          } else {
            reduction = initialReduction;
          }
          this.__iterate(function(v, k, c)  {
            if (useFirst) {
              useFirst = false;
              reduction = v;
            } else {
              reduction = reducer.call(context, reduction, v, k, c);
            }
          });
          return reduction;
        },
    
        reduceRight: function(reducer, initialReduction, context) {
          var reversed = this.toKeyedSeq().reverse();
          return reversed.reduce.apply(reversed, arguments);
        },
    
        reverse: function() {
          return reify(this, reverseFactory(this, true));
        },
    
        slice: function(begin, end) {
          return reify(this, sliceFactory(this, begin, end, true));
        },
    
        some: function(predicate, context) {
          return !this.every(not(predicate), context);
        },
    
        sort: function(comparator) {
          return reify(this, sortFactory(this, comparator));
        },
    
        values: function() {
          return this.__iterator(ITERATE_VALUES);
        },
    
    
        // ### More sequential methods
    
        butLast: function() {
          return this.slice(0, -1);
        },
    
        isEmpty: function() {
          return this.size !== undefined ? this.size === 0 : !this.some(function()  {return true});
        },
    
        count: function(predicate, context) {
          return ensureSize(
            predicate ? this.toSeq().filter(predicate, context) : this
          );
        },
    
        countBy: function(grouper, context) {
          return countByFactory(this, grouper, context);
        },
    
        equals: function(other) {
          return deepEqual(this, other);
        },
    
        entrySeq: function() {
          var iterable = this;
          if (iterable._cache) {
            // We cache as an entries array, so we can just return the cache!
            return new ArraySeq(iterable._cache);
          }
          var entriesSequence = iterable.toSeq().map(entryMapper).toIndexedSeq();
          entriesSequence.fromEntrySeq = function()  {return iterable.toSeq()};
          return entriesSequence;
        },
    
        filterNot: function(predicate, context) {
          return this.filter(not(predicate), context);
        },
    
        findEntry: function(predicate, context, notSetValue) {
          var found = notSetValue;
          this.__iterate(function(v, k, c)  {
            if (predicate.call(context, v, k, c)) {
              found = [k, v];
              return false;
            }
          });
          return found;
        },
    
        findKey: function(predicate, context) {
          var entry = this.findEntry(predicate, context);
          return entry && entry[0];
        },
    
        findLast: function(predicate, context, notSetValue) {
          return this.toKeyedSeq().reverse().find(predicate, context, notSetValue);
        },
    
        findLastEntry: function(predicate, context, notSetValue) {
          return this.toKeyedSeq().reverse().findEntry(predicate, context, notSetValue);
        },
    
        findLastKey: function(predicate, context) {
          return this.toKeyedSeq().reverse().findKey(predicate, context);
        },
    
        first: function() {
          return this.find(returnTrue);
        },
    
        flatMap: function(mapper, context) {
          return reify(this, flatMapFactory(this, mapper, context));
        },
    
        flatten: function(depth) {
          return reify(this, flattenFactory(this, depth, true));
        },
    
        fromEntrySeq: function() {
          return new FromEntriesSequence(this);
        },
    
        get: function(searchKey, notSetValue) {
          return this.find(function(_, key)  {return is(key, searchKey)}, undefined, notSetValue);
        },
    
        getIn: function(searchKeyPath, notSetValue) {
          var nested = this;
          // Note: in an ES6 environment, we would prefer:
          // for (var key of searchKeyPath) {
          var iter = forceIterator(searchKeyPath);
          var step;
          while (!(step = iter.next()).done) {
            var key = step.value;
            nested = nested && nested.get ? nested.get(key, NOT_SET) : NOT_SET;
            if (nested === NOT_SET) {
              return notSetValue;
            }
          }
          return nested;
        },
    
        groupBy: function(grouper, context) {
          return groupByFactory(this, grouper, context);
        },
    
        has: function(searchKey) {
          return this.get(searchKey, NOT_SET) !== NOT_SET;
        },
    
        hasIn: function(searchKeyPath) {
          return this.getIn(searchKeyPath, NOT_SET) !== NOT_SET;
        },
    
        isSubset: function(iter) {
          iter = typeof iter.includes === 'function' ? iter : Iterable(iter);
          return this.every(function(value ) {return iter.includes(value)});
        },
    
        isSuperset: function(iter) {
          iter = typeof iter.isSubset === 'function' ? iter : Iterable(iter);
          return iter.isSubset(this);
        },
    
        keyOf: function(searchValue) {
          return this.findKey(function(value ) {return is(value, searchValue)});
        },
    
        keySeq: function() {
          return this.toSeq().map(keyMapper).toIndexedSeq();
        },
    
        last: function() {
          return this.toSeq().reverse().first();
        },
    
        lastKeyOf: function(searchValue) {
          return this.toKeyedSeq().reverse().keyOf(searchValue);
        },
    
        max: function(comparator) {
          return maxFactory(this, comparator);
        },
    
        maxBy: function(mapper, comparator) {
          return maxFactory(this, comparator, mapper);
        },
    
        min: function(comparator) {
          return maxFactory(this, comparator ? neg(comparator) : defaultNegComparator);
        },
    
        minBy: function(mapper, comparator) {
          return maxFactory(this, comparator ? neg(comparator) : defaultNegComparator, mapper);
        },
    
        rest: function() {
          return this.slice(1);
        },
    
        skip: function(amount) {
          return this.slice(Math.max(0, amount));
        },
    
        skipLast: function(amount) {
          return reify(this, this.toSeq().reverse().skip(amount).reverse());
        },
    
        skipWhile: function(predicate, context) {
          return reify(this, skipWhileFactory(this, predicate, context, true));
        },
    
        skipUntil: function(predicate, context) {
          return this.skipWhile(not(predicate), context);
        },
    
        sortBy: function(mapper, comparator) {
          return reify(this, sortFactory(this, comparator, mapper));
        },
    
        take: function(amount) {
          return this.slice(0, Math.max(0, amount));
        },
    
        takeLast: function(amount) {
          return reify(this, this.toSeq().reverse().take(amount).reverse());
        },
    
        takeWhile: function(predicate, context) {
          return reify(this, takeWhileFactory(this, predicate, context));
        },
    
        takeUntil: function(predicate, context) {
          return this.takeWhile(not(predicate), context);
        },
    
        valueSeq: function() {
          return this.toIndexedSeq();
        },
    
    
        // ### Hashable Object
    
        hashCode: function() {
          return this.__hash || (this.__hash = hashIterable(this));
        }
    
    
        // ### Internal
    
        // abstract __iterate(fn, reverse)
    
        // abstract __iterator(type, reverse)
      });
    
      // var IS_ITERABLE_SENTINEL = '@@__IMMUTABLE_ITERABLE__@@';
      // var IS_KEYED_SENTINEL = '@@__IMMUTABLE_KEYED__@@';
      // var IS_INDEXED_SENTINEL = '@@__IMMUTABLE_INDEXED__@@';
      // var IS_ORDERED_SENTINEL = '@@__IMMUTABLE_ORDERED__@@';
    
      var IterablePrototype = Iterable.prototype;
      IterablePrototype[IS_ITERABLE_SENTINEL] = true;
      IterablePrototype[ITERATOR_SYMBOL] = IterablePrototype.values;
      IterablePrototype.__toJS = IterablePrototype.toArray;
      IterablePrototype.__toStringMapper = quoteString;
      IterablePrototype.inspect =
      IterablePrototype.toSource = function() { return this.toString(); };
      IterablePrototype.chain = IterablePrototype.flatMap;
      IterablePrototype.contains = IterablePrototype.includes;
    
      mixin(KeyedIterable, {
    
        // ### More sequential methods
    
        flip: function() {
          return reify(this, flipFactory(this));
        },
    
        mapEntries: function(mapper, context) {var this$0 = this;
          var iterations = 0;
          return reify(this,
            this.toSeq().map(
              function(v, k)  {return mapper.call(context, [k, v], iterations++, this$0)}
            ).fromEntrySeq()
          );
        },
    
        mapKeys: function(mapper, context) {var this$0 = this;
          return reify(this,
            this.toSeq().flip().map(
              function(k, v)  {return mapper.call(context, k, v, this$0)}
            ).flip()
          );
        }
    
      });
    
      var KeyedIterablePrototype = KeyedIterable.prototype;
      KeyedIterablePrototype[IS_KEYED_SENTINEL] = true;
      KeyedIterablePrototype[ITERATOR_SYMBOL] = IterablePrototype.entries;
      KeyedIterablePrototype.__toJS = IterablePrototype.toObject;
      KeyedIterablePrototype.__toStringMapper = function(v, k)  {return JSON.stringify(k) + ': ' + quoteString(v)};
    
    
    
      mixin(IndexedIterable, {
    
        // ### Conversion to other types
    
        toKeyedSeq: function() {
          return new ToKeyedSequence(this, false);
        },
    
    
        // ### ES6 Collection methods (ES6 Array and Map)
    
        filter: function(predicate, context) {
          return reify(this, filterFactory(this, predicate, context, false));
        },
    
        findIndex: function(predicate, context) {
          var entry = this.findEntry(predicate, context);
          return entry ? entry[0] : -1;
        },
    
        indexOf: function(searchValue) {
          var key = this.keyOf(searchValue);
          return key === undefined ? -1 : key;
        },
    
        lastIndexOf: function(searchValue) {
          var key = this.lastKeyOf(searchValue);
          return key === undefined ? -1 : key;
        },
    
        reverse: function() {
          return reify(this, reverseFactory(this, false));
        },
    
        slice: function(begin, end) {
          return reify(this, sliceFactory(this, begin, end, false));
        },
    
        splice: function(index, removeNum /*, ...values*/) {
          var numArgs = arguments.length;
          removeNum = Math.max(removeNum | 0, 0);
          if (numArgs === 0 || (numArgs === 2 && !removeNum)) {
            return this;
          }
          // If index is negative, it should resolve relative to the size of the
          // collection. However size may be expensive to compute if not cached, so
          // only call count() if the number is in fact negative.
          index = resolveBegin(index, index < 0 ? this.count() : this.size);
          var spliced = this.slice(0, index);
          return reify(
            this,
            numArgs === 1 ?
              spliced :
              spliced.concat(arrCopy(arguments, 2), this.slice(index + removeNum))
          );
        },
    
    
        // ### More collection methods
    
        findLastIndex: function(predicate, context) {
          var entry = this.findLastEntry(predicate, context);
          return entry ? entry[0] : -1;
        },
    
        first: function() {
          return this.get(0);
        },
    
        flatten: function(depth) {
          return reify(this, flattenFactory(this, depth, false));
        },
    
        get: function(index, notSetValue) {
          index = wrapIndex(this, index);
          return (index < 0 || (this.size === Infinity ||
              (this.size !== undefined && index > this.size))) ?
            notSetValue :
            this.find(function(_, key)  {return key === index}, undefined, notSetValue);
        },
    
        has: function(index) {
          index = wrapIndex(this, index);
          return index >= 0 && (this.size !== undefined ?
            this.size === Infinity || index < this.size :
            this.indexOf(index) !== -1
          );
        },
    
        interpose: function(separator) {
          return reify(this, interposeFactory(this, separator));
        },
    
        interleave: function(/*...iterables*/) {
          var iterables = [this].concat(arrCopy(arguments));
          var zipped = zipWithFactory(this.toSeq(), IndexedSeq.of, iterables);
          var interleaved = zipped.flatten(true);
          if (zipped.size) {
            interleaved.size = zipped.size * iterables.length;
          }
          return reify(this, interleaved);
        },
    
        keySeq: function() {
          return Range(0, this.size);
        },
    
        last: function() {
          return this.get(-1);
        },
    
        skipWhile: function(predicate, context) {
          return reify(this, skipWhileFactory(this, predicate, context, false));
        },
    
        zip: function(/*, ...iterables */) {
          var iterables = [this].concat(arrCopy(arguments));
          return reify(this, zipWithFactory(this, defaultZipper, iterables));
        },
    
        zipWith: function(zipper/*, ...iterables */) {
          var iterables = arrCopy(arguments);
          iterables[0] = this;
          return reify(this, zipWithFactory(this, zipper, iterables));
        }
    
      });
    
      IndexedIterable.prototype[IS_INDEXED_SENTINEL] = true;
      IndexedIterable.prototype[IS_ORDERED_SENTINEL] = true;
    
    
    
      mixin(SetIterable, {
    
        // ### ES6 Collection methods (ES6 Array and Map)
    
        get: function(value, notSetValue) {
          return this.has(value) ? value : notSetValue;
        },
    
        includes: function(value) {
          return this.has(value);
        },
    
    
        // ### More sequential methods
    
        keySeq: function() {
          return this.valueSeq();
        }
    
      });
    
      SetIterable.prototype.has = IterablePrototype.includes;
      SetIterable.prototype.contains = SetIterable.prototype.includes;
    
    
      // Mixin subclasses
    
      mixin(KeyedSeq, KeyedIterable.prototype);
      mixin(IndexedSeq, IndexedIterable.prototype);
      mixin(SetSeq, SetIterable.prototype);
    
      mixin(KeyedCollection, KeyedIterable.prototype);
      mixin(IndexedCollection, IndexedIterable.prototype);
      mixin(SetCollection, SetIterable.prototype);
    
    
      // #pragma Helper functions
    
      function keyMapper(v, k) {
        return k;
      }
    
      function entryMapper(v, k) {
        return [k, v];
      }
    
      function not(predicate) {
        return function() {
          return !predicate.apply(this, arguments);
        }
      }
    
      function neg(predicate) {
        return function() {
          return -predicate.apply(this, arguments);
        }
      }
    
      function quoteString(value) {
        return typeof value === 'string' ? JSON.stringify(value) : String(value);
      }
    
      function defaultZipper() {
        return arrCopy(arguments);
      }
    
      function defaultNegComparator(a, b) {
        return a < b ? 1 : a > b ? -1 : 0;
      }
    
      function hashIterable(iterable) {
        if (iterable.size === Infinity) {
          return 0;
        }
        var ordered = isOrdered(iterable);
        var keyed = isKeyed(iterable);
        var h = ordered ? 1 : 0;
        var size = iterable.__iterate(
          keyed ?
            ordered ?
              function(v, k)  { h = 31 * h + hashMerge(hash(v), hash(k)) | 0; } :
              function(v, k)  { h = h + hashMerge(hash(v), hash(k)) | 0; } :
            ordered ?
              function(v ) { h = 31 * h + hash(v) | 0; } :
              function(v ) { h = h + hash(v) | 0; }
        );
        return murmurHashOfSize(size, h);
      }
    
      function murmurHashOfSize(size, h) {
        h = imul(h, 0xCC9E2D51);
        h = imul(h << 15 | h >>> -15, 0x1B873593);
        h = imul(h << 13 | h >>> -13, 5);
        h = (h + 0xE6546B64 | 0) ^ size;
        h = imul(h ^ h >>> 16, 0x85EBCA6B);
        h = imul(h ^ h >>> 13, 0xC2B2AE35);
        h = smi(h ^ h >>> 16);
        return h;
      }
    
      function hashMerge(a, b) {
        return a ^ b + 0x9E3779B9 + (a << 6) + (a >> 2) | 0; // int
      }
    
      var Immutable = {
    
        Iterable: Iterable,
    
        Seq: Seq,
        Collection: Collection,
        Map: Map,
        OrderedMap: OrderedMap,
        List: List,
        Stack: Stack,
        Set: Set,
        OrderedSet: OrderedSet,
    
        Record: Record,
        Range: Range,
        Repeat: Repeat,
    
        is: is,
        fromJS: fromJS
    
      };
    
      return Immutable;
    
    }));
  provide("immutable", module.exports);
}(global));

// pakmanager:isomorphic-fetch
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  "use strict";
    
    var realFetch = require('node-fetch');
    module.exports = function(url, options) {
    	if (/^\/\//.test(url)) {
    		url = 'https:' + url;
    	}
    	return realFetch.call(this, url, options);
    };
    
    if (!global.fetch) {
    	global.fetch = module.exports;
    	global.Response = realFetch.Response;
    	global.Headers = realFetch.Headers;
    	global.Request = realFetch.Request;
    }
    
  provide("isomorphic-fetch", module.exports);
}(global));

// pakmanager:loose-envify
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  module.exports =   require('loose-envify')(process.env);
    
  provide("loose-envify", module.exports);
}(global));

// pakmanager:object-assign
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    function ToObject(val) {
    	if (val == null) {
    		throw new TypeError('Object.assign cannot be called with null or undefined');
    	}
    
    	return Object(val);
    }
    
    module.exports = Object.assign || function (target, source) {
    	var from;
    	var keys;
    	var to = ToObject(target);
    
    	for (var s = 1; s < arguments.length; s++) {
    		from = arguments[s];
    		keys = Object.keys(Object(from));
    
    		for (var i = 0; i < keys.length; i++) {
    			to[keys[i]] = from[keys[i]];
    		}
    	}
    
    	return to;
    };
    
  provide("object-assign", module.exports);
}(global));

// pakmanager:promise/lib/core.js
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    var asap = require('asap/raw');
    
    function noop() {}
    
    // States:
    //
    // 0 - pending
    // 1 - fulfilled with _value
    // 2 - rejected with _value
    // 3 - adopted the state of another promise, _value
    //
    // once the state is no longer pending (0) it is immutable
    
    // All `_` prefixed properties will be reduced to `_{random number}`
    // at build time to obfuscate them and discourage their use.
    // We don't use symbols or Object.defineProperty to fully hide them
    // because the performance isn't good enough.
    
    
    // to avoid using try/catch inside critical functions, we
    // extract them to here.
    var LAST_ERROR = null;
    var IS_ERROR = {};
    function getThen(obj) {
      try {
        return obj.then;
      } catch (ex) {
        LAST_ERROR = ex;
        return IS_ERROR;
      }
    }
    
    function tryCallOne(fn, a) {
      try {
        return fn(a);
      } catch (ex) {
        LAST_ERROR = ex;
        return IS_ERROR;
      }
    }
    function tryCallTwo(fn, a, b) {
      try {
        fn(a, b);
      } catch (ex) {
        LAST_ERROR = ex;
        return IS_ERROR;
      }
    }
    
    module.exports = Promise;
    
    function Promise(fn) {
      if (typeof this !== 'object') {
        throw new TypeError('Promises must be constructed via new');
      }
      if (typeof fn !== 'function') {
        throw new TypeError('not a function');
      }
      this._45 = 0;
      this._81 = 0;
      this._65 = null;
      this._54 = null;
      if (fn === noop) return;
      doResolve(fn, this);
    }
    Promise._10 = null;
    Promise._97 = null;
    Promise._61 = noop;
    
    Promise.prototype.then = function(onFulfilled, onRejected) {
      if (this.constructor !== Promise) {
        return safeThen(this, onFulfilled, onRejected);
      }
      var res = new Promise(noop);
      handle(this, new Handler(onFulfilled, onRejected, res));
      return res;
    };
    
    function safeThen(self, onFulfilled, onRejected) {
      return new self.constructor(function (resolve, reject) {
        var res = new Promise(noop);
        res.then(resolve, reject);
        handle(self, new Handler(onFulfilled, onRejected, res));
      });
    };
    function handle(self, deferred) {
      while (self._81 === 3) {
        self = self._65;
      }
      if (Promise._10) {
        Promise._10(self);
      }
      if (self._81 === 0) {
        if (self._45 === 0) {
          self._45 = 1;
          self._54 = deferred;
          return;
        }
        if (self._45 === 1) {
          self._45 = 2;
          self._54 = [self._54, deferred];
          return;
        }
        self._54.push(deferred);
        return;
      }
      handleResolved(self, deferred);
    }
    
    function handleResolved(self, deferred) {
      asap(function() {
        var cb = self._81 === 1 ? deferred.onFulfilled : deferred.onRejected;
        if (cb === null) {
          if (self._81 === 1) {
            resolve(deferred.promise, self._65);
          } else {
            reject(deferred.promise, self._65);
          }
          return;
        }
        var ret = tryCallOne(cb, self._65);
        if (ret === IS_ERROR) {
          reject(deferred.promise, LAST_ERROR);
        } else {
          resolve(deferred.promise, ret);
        }
      });
    }
    function resolve(self, newValue) {
      // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) {
        return reject(
          self,
          new TypeError('A promise cannot be resolved with itself.')
        );
      }
      if (
        newValue &&
        (typeof newValue === 'object' || typeof newValue === 'function')
      ) {
        var then = getThen(newValue);
        if (then === IS_ERROR) {
          return reject(self, LAST_ERROR);
        }
        if (
          then === self.then &&
          newValue instanceof Promise
        ) {
          self._81 = 3;
          self._65 = newValue;
          finale(self);
          return;
        } else if (typeof then === 'function') {
          doResolve(then.bind(newValue), self);
          return;
        }
      }
      self._81 = 1;
      self._65 = newValue;
      finale(self);
    }
    
    function reject(self, newValue) {
      self._81 = 2;
      self._65 = newValue;
      if (Promise._97) {
        Promise._97(self, newValue);
      }
      finale(self);
    }
    function finale(self) {
      if (self._45 === 1) {
        handle(self, self._54);
        self._54 = null;
      }
      if (self._45 === 2) {
        for (var i = 0; i < self._54.length; i++) {
          handle(self, self._54[i]);
        }
        self._54 = null;
      }
    }
    
    function Handler(onFulfilled, onRejected, promise){
      this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
      this.onRejected = typeof onRejected === 'function' ? onRejected : null;
      this.promise = promise;
    }
    
    /**
     * Take a potentially misbehaving resolver function and make sure
     * onFulfilled and onRejected are only called once.
     *
     * Makes no guarantees about asynchrony.
     */
    function doResolve(fn, promise) {
      var done = false;
      var res = tryCallTwo(fn, function (value) {
        if (done) return;
        done = true;
        resolve(promise, value);
      }, function (reason) {
        if (done) return;
        done = true;
        reject(promise, reason);
      })
      if (!done && res === IS_ERROR) {
        done = true;
        reject(promise, LAST_ERROR);
      }
    }
    
  provide("promise/lib/core.js", module.exports);
}(global));

// pakmanager:promise/lib/done.js
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    var Promise =  require('promise/lib/core.js');
    
    module.exports = Promise;
    Promise.prototype.done = function (onFulfilled, onRejected) {
      var self = arguments.length ? this.then.apply(this, arguments) : this;
      self.then(null, function (err) {
        setTimeout(function () {
          throw err;
        }, 0);
      });
    };
    
  provide("promise/lib/done.js", module.exports);
}(global));

// pakmanager:promise/lib/finally.js
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    var Promise =  require('promise/lib/core.js');
    
    module.exports = Promise;
    Promise.prototype['finally'] = function (f) {
      return this.then(function (value) {
        return Promise.resolve(f()).then(function () {
          return value;
        });
      }, function (err) {
        return Promise.resolve(f()).then(function () {
          throw err;
        });
      });
    };
    
  provide("promise/lib/finally.js", module.exports);
}(global));

// pakmanager:promise/lib/es6-extensions.js
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    //This file contains the ES6 extensions to the core Promises/A+ API
    
    var Promise =  require('promise/lib/core.js');
    
    module.exports = Promise;
    
    /* Static Functions */
    
    var TRUE = valuePromise(true);
    var FALSE = valuePromise(false);
    var NULL = valuePromise(null);
    var UNDEFINED = valuePromise(undefined);
    var ZERO = valuePromise(0);
    var EMPTYSTRING = valuePromise('');
    
    function valuePromise(value) {
      var p = new Promise(Promise._61);
      p._81 = 1;
      p._65 = value;
      return p;
    }
    Promise.resolve = function (value) {
      if (value instanceof Promise) return value;
    
      if (value === null) return NULL;
      if (value === undefined) return UNDEFINED;
      if (value === true) return TRUE;
      if (value === false) return FALSE;
      if (value === 0) return ZERO;
      if (value === '') return EMPTYSTRING;
    
      if (typeof value === 'object' || typeof value === 'function') {
        try {
          var then = value.then;
          if (typeof then === 'function') {
            return new Promise(then.bind(value));
          }
        } catch (ex) {
          return new Promise(function (resolve, reject) {
            reject(ex);
          });
        }
      }
      return valuePromise(value);
    };
    
    Promise.all = function (arr) {
      var args = Array.prototype.slice.call(arr);
    
      return new Promise(function (resolve, reject) {
        if (args.length === 0) return resolve([]);
        var remaining = args.length;
        function res(i, val) {
          if (val && (typeof val === 'object' || typeof val === 'function')) {
            if (val instanceof Promise && val.then === Promise.prototype.then) {
              while (val._81 === 3) {
                val = val._65;
              }
              if (val._81 === 1) return res(i, val._65);
              if (val._81 === 2) reject(val._65);
              val.then(function (val) {
                res(i, val);
              }, reject);
              return;
            } else {
              var then = val.then;
              if (typeof then === 'function') {
                var p = new Promise(then.bind(val));
                p.then(function (val) {
                  res(i, val);
                }, reject);
                return;
              }
            }
          }
          args[i] = val;
          if (--remaining === 0) {
            resolve(args);
          }
        }
        for (var i = 0; i < args.length; i++) {
          res(i, args[i]);
        }
      });
    };
    
    Promise.reject = function (value) {
      return new Promise(function (resolve, reject) {
        reject(value);
      });
    };
    
    Promise.race = function (values) {
      return new Promise(function (resolve, reject) {
        values.forEach(function(value){
          Promise.resolve(value).then(resolve, reject);
        });
      });
    };
    
    /* Prototype Methods */
    
    Promise.prototype['catch'] = function (onRejected) {
      return this.then(null, onRejected);
    };
    
  provide("promise/lib/es6-extensions.js", module.exports);
}(global));

// pakmanager:promise/lib/node-extensions.js
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    // This file contains then/promise specific extensions that are only useful
    // for node.js interop
    
    var Promise =  require('promise/lib/core.js');
    var asap = require('asap');
    
    module.exports = Promise;
    
    /* Static Functions */
    
    Promise.denodeify = function (fn, argumentCount) {
      if (
        typeof argumentCount === 'number' && argumentCount !== Infinity
      ) {
        return denodeifyWithCount(fn, argumentCount);
      } else {
        return denodeifyWithoutCount(fn);
      }
    }
    
    var callbackFn = (
      'function (err, res) {' +
      'if (err) { rj(err); } else { rs(res); }' +
      '}'
    );
    function denodeifyWithCount(fn, argumentCount) {
      var args = [];
      for (var i = 0; i < argumentCount; i++) {
        args.push('a' + i);
      }
      var body = [
        'return function (' + args.join(',') + ') {',
        'var self = this;',
        'return new Promise(function (rs, rj) {',
        'var res = fn.call(',
        ['self'].concat(args).concat([callbackFn]).join(','),
        ');',
        'if (res &&',
        '(typeof res === "object" || typeof res === "function") &&',
        'typeof res.then === "function"',
        ') {rs(res);}',
        '});',
        '};'
      ].join('');
      return Function(['Promise', 'fn'], body)(Promise, fn);
    }
    function denodeifyWithoutCount(fn) {
      var fnLength = Math.max(fn.length - 1, 3);
      var args = [];
      for (var i = 0; i < fnLength; i++) {
        args.push('a' + i);
      }
      var body = [
        'return function (' + args.join(',') + ') {',
        'var self = this;',
        'var args;',
        'var argLength = arguments.length;',
        'if (arguments.length > ' + fnLength + ') {',
        'args = new Array(arguments.length + 1);',
        'for (var i = 0; i < arguments.length; i++) {',
        'args[i] = arguments[i];',
        '}',
        '}',
        'return new Promise(function (rs, rj) {',
        'var cb = ' + callbackFn + ';',
        'var res;',
        'switch (argLength) {',
        args.concat(['extra']).map(function (_, index) {
          return (
            'case ' + (index) + ':' +
            'res = fn.call(' + ['self'].concat(args.slice(0, index)).concat('cb').join(',') + ');' +
            'break;'
          );
        }).join(''),
        'default:',
        'args[argLength] = cb;',
        'res = fn.apply(self, args);',
        '}',
        
        'if (res &&',
        '(typeof res === "object" || typeof res === "function") &&',
        'typeof res.then === "function"',
        ') {rs(res);}',
        '});',
        '};'
      ].join('');
    
      return Function(
        ['Promise', 'fn'],
        body
      )(Promise, fn);
    }
    
    Promise.nodeify = function (fn) {
      return function () {
        var args = Array.prototype.slice.call(arguments);
        var callback =
          typeof args[args.length - 1] === 'function' ? args.pop() : null;
        var ctx = this;
        try {
          return fn.apply(this, arguments).nodeify(callback, ctx);
        } catch (ex) {
          if (callback === null || typeof callback == 'undefined') {
            return new Promise(function (resolve, reject) {
              reject(ex);
            });
          } else {
            asap(function () {
              callback.call(ctx, ex);
            })
          }
        }
      }
    }
    
    Promise.prototype.nodeify = function (callback, ctx) {
      if (typeof callback != 'function') return this;
    
      this.then(function (value) {
        asap(function () {
          callback.call(ctx, null, value);
        });
      }, function (err) {
        asap(function () {
          callback.call(ctx, err);
        });
      });
    }
    
  provide("promise/lib/node-extensions.js", module.exports);
}(global));

// pakmanager:promise/lib/synchronous.js
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    var Promise =  require('promise/lib/core.js');
    
    module.exports = Promise;
    Promise.enableSynchronous = function () {
      Promise.prototype.isPending = function() {
        return this.getState() == 0;
      };
    
      Promise.prototype.isFulfilled = function() {
        return this.getState() == 1;
      };
    
      Promise.prototype.isRejected = function() {
        return this.getState() == 2;
      };
    
      Promise.prototype.getValue = function () {
        if (this._81 === 3) {
          return this._65.getValue();
        }
    
        if (!this.isFulfilled()) {
          throw new Error('Cannot get a value of an unfulfilled promise.');
        }
    
        return this._65;
      };
    
      Promise.prototype.getReason = function () {
        if (this._81 === 3) {
          return this._65.getReason();
        }
    
        if (!this.isRejected()) {
          throw new Error('Cannot get a rejection reason of a non-rejected promise.');
        }
    
        return this._65;
      };
    
      Promise.prototype.getState = function () {
        if (this._81 === 3) {
          return this._65.getState();
        }
        if (this._81 === -1 || this._81 === -2) {
          return 0;
        }
    
        return this._81;
      };
    };
    
    Promise.disableSynchronous = function() {
      Promise.prototype.isPending = undefined;
      Promise.prototype.isFulfilled = undefined;
      Promise.prototype.isRejected = undefined;
      Promise.prototype.getValue = undefined;
      Promise.prototype.getReason = undefined;
      Promise.prototype.getState = undefined;
    };
    
  provide("promise/lib/synchronous.js", module.exports);
}(global));

// pakmanager:promise/lib
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    module.exports =  require('promise/lib/core.js');
     require('promise/lib/done.js');
     require('promise/lib/finally.js');
     require('promise/lib/es6-extensions.js');
     require('promise/lib/node-extensions.js');
     require('promise/lib/synchronous.js');
    
  provide("promise/lib", module.exports);
}(global));

// pakmanager:promise
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    module.exports =  require('promise/lib')
    
  provide("promise", module.exports);
}(global));

// pakmanager:ua-parser-js
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * UAParser.js v0.7.10
     * Lightweight JavaScript-based User-Agent string parser
     * https://github.com/faisalman/ua-parser-js
     *
     * Copyright © 2012-2015 Faisal Salman <fyzlman@gmail.com>
     * Dual licensed under GPLv2 & MIT
     */
    
    (function (window, undefined) {
    
        'use strict';
    
        //////////////
        // Constants
        /////////////
    
    
        var LIBVERSION  = '0.7.10',
            EMPTY       = '',
            UNKNOWN     = '?',
            FUNC_TYPE   = 'function',
            UNDEF_TYPE  = 'undefined',
            OBJ_TYPE    = 'object',
            STR_TYPE    = 'string',
            MAJOR       = 'major', // deprecated
            MODEL       = 'model',
            NAME        = 'name',
            TYPE        = 'type',
            VENDOR      = 'vendor',
            VERSION     = 'version',
            ARCHITECTURE= 'architecture',
            CONSOLE     = 'console',
            MOBILE      = 'mobile',
            TABLET      = 'tablet',
            SMARTTV     = 'smarttv',
            WEARABLE    = 'wearable',
            EMBEDDED    = 'embedded';
    
    
        ///////////
        // Helper
        //////////
    
    
        var util = {
            extend : function (regexes, extensions) {
                for (var i in extensions) {
                    if ("browser cpu device engine os".indexOf(i) !== -1 && extensions[i].length % 2 === 0) {
                        regexes[i] = extensions[i].concat(regexes[i]);
                    }
                }
                return regexes;
            },
            has : function (str1, str2) {
              if (typeof str1 === "string") {
                return str2.toLowerCase().indexOf(str1.toLowerCase()) !== -1;
              } else {
                return false;
              }
            },
            lowerize : function (str) {
                return str.toLowerCase();
            },
            major : function (version) {
                return typeof(version) === STR_TYPE ? version.split(".")[0] : undefined;
            }
        };
    
    
        ///////////////
        // Map helper
        //////////////
    
    
        var mapper = {
    
            rgx : function () {
    
                var result, i = 0, j, k, p, q, matches, match, args = arguments;
    
                // loop through all regexes maps
                while (i < args.length && !matches) {
    
                    var regex = args[i],       // even sequence (0,2,4,..)
                        props = args[i + 1];   // odd sequence (1,3,5,..)
    
                    // construct object barebones
                    if (typeof result === UNDEF_TYPE) {
                        result = {};
                        for (p in props) {
                            if (props.hasOwnProperty(p)){
                                q = props[p];
                                if (typeof q === OBJ_TYPE) {
                                    result[q[0]] = undefined;
                                } else {
                                    result[q] = undefined;
                                }
                            }
                        }
                    }
    
                    // try matching uastring with regexes
                    j = k = 0;
                    while (j < regex.length && !matches) {
                        matches = regex[j++].exec(this.getUA());
                        if (!!matches) {
                            for (p = 0; p < props.length; p++) {
                                match = matches[++k];
                                q = props[p];
                                // check if given property is actually array
                                if (typeof q === OBJ_TYPE && q.length > 0) {
                                    if (q.length == 2) {
                                        if (typeof q[1] == FUNC_TYPE) {
                                            // assign modified match
                                            result[q[0]] = q[1].call(this, match);
                                        } else {
                                            // assign given value, ignore regex match
                                            result[q[0]] = q[1];
                                        }
                                    } else if (q.length == 3) {
                                        // check whether function or regex
                                        if (typeof q[1] === FUNC_TYPE && !(q[1].exec && q[1].test)) {
                                            // call function (usually string mapper)
                                            result[q[0]] = match ? q[1].call(this, match, q[2]) : undefined;
                                        } else {
                                            // sanitize match using given regex
                                            result[q[0]] = match ? match.replace(q[1], q[2]) : undefined;
                                        }
                                    } else if (q.length == 4) {
                                            result[q[0]] = match ? q[3].call(this, match.replace(q[1], q[2])) : undefined;
                                    }
                                } else {
                                    result[q] = match ? match : undefined;
                                }
                            }
                        }
                    }
                    i += 2;
                }
                return result;
            },
    
            str : function (str, map) {
    
                for (var i in map) {
                    // check if array
                    if (typeof map[i] === OBJ_TYPE && map[i].length > 0) {
                        for (var j = 0; j < map[i].length; j++) {
                            if (util.has(map[i][j], str)) {
                                return (i === UNKNOWN) ? undefined : i;
                            }
                        }
                    } else if (util.has(map[i], str)) {
                        return (i === UNKNOWN) ? undefined : i;
                    }
                }
                return str;
            }
        };
    
    
        ///////////////
        // String map
        //////////////
    
    
        var maps = {
    
            browser : {
                oldsafari : {
                    version : {
                        '1.0'   : '/8',
                        '1.2'   : '/1',
                        '1.3'   : '/3',
                        '2.0'   : '/412',
                        '2.0.2' : '/416',
                        '2.0.3' : '/417',
                        '2.0.4' : '/419',
                        '?'     : '/'
                    }
                }
            },
    
            device : {
                amazon : {
                    model : {
                        'Fire Phone' : ['SD', 'KF']
                    }
                },
                sprint : {
                    model : {
                        'Evo Shift 4G' : '7373KT'
                    },
                    vendor : {
                        'HTC'       : 'APA',
                        'Sprint'    : 'Sprint'
                    }
                }
            },
    
            os : {
                windows : {
                    version : {
                        'ME'        : '4.90',
                        'NT 3.11'   : 'NT3.51',
                        'NT 4.0'    : 'NT4.0',
                        '2000'      : 'NT 5.0',
                        'XP'        : ['NT 5.1', 'NT 5.2'],
                        'Vista'     : 'NT 6.0',
                        '7'         : 'NT 6.1',
                        '8'         : 'NT 6.2',
                        '8.1'       : 'NT 6.3',
                        '10'        : ['NT 6.4', 'NT 10.0'],
                        'RT'        : 'ARM'
                    }
                }
            }
        };
    
    
        //////////////
        // Regex map
        /////////////
    
    
        var regexes = {
    
            browser : [[
    
                // Presto based
                /(opera\smini)\/([\w\.-]+)/i,                                       // Opera Mini
                /(opera\s[mobiletab]+).+version\/([\w\.-]+)/i,                      // Opera Mobi/Tablet
                /(opera).+version\/([\w\.]+)/i,                                     // Opera > 9.80
                /(opera)[\/\s]+([\w\.]+)/i                                          // Opera < 9.80
    
                ], [NAME, VERSION], [
    
                /\s(opr)\/([\w\.]+)/i                                               // Opera Webkit
                ], [[NAME, 'Opera'], VERSION], [
    
                // Mixed
                /(kindle)\/([\w\.]+)/i,                                             // Kindle
                /(lunascape|maxthon|netfront|jasmine|blazer)[\/\s]?([\w\.]+)*/i,
                                                                                    // Lunascape/Maxthon/Netfront/Jasmine/Blazer
    
                // Trident based
                /(avant\s|iemobile|slim|baidu)(?:browser)?[\/\s]?([\w\.]*)/i,
                                                                                    // Avant/IEMobile/SlimBrowser/Baidu
                /(?:ms|\()(ie)\s([\w\.]+)/i,                                        // Internet Explorer
    
                // Webkit/KHTML based
                /(rekonq)\/([\w\.]+)*/i,                                            // Rekonq
                /(chromium|flock|rockmelt|midori|epiphany|silk|skyfire|ovibrowser|bolt|iron|vivaldi|iridium|phantomjs)\/([\w\.-]+)/i
                                                                                    // Chromium/Flock/RockMelt/Midori/Epiphany/Silk/Skyfire/Bolt/Iron/Iridium/PhantomJS
                ], [NAME, VERSION], [
    
                /(trident).+rv[:\s]([\w\.]+).+like\sgecko/i                         // IE11
                ], [[NAME, 'IE'], VERSION], [
    
                /(edge)\/((\d+)?[\w\.]+)/i                                          // Microsoft Edge
                ], [NAME, VERSION], [
    
                /(yabrowser)\/([\w\.]+)/i                                           // Yandex
                ], [[NAME, 'Yandex'], VERSION], [
    
                /(comodo_dragon)\/([\w\.]+)/i                                       // Comodo Dragon
                ], [[NAME, /_/g, ' '], VERSION], [
    
                /(chrome|omniweb|arora|[tizenoka]{5}\s?browser)\/v?([\w\.]+)/i,
                                                                                    // Chrome/OmniWeb/Arora/Tizen/Nokia
                /(qqbrowser)[\/\s]?([\w\.]+)/i
                                                                                    // QQBrowser
                ], [NAME, VERSION], [
    
                /(uc\s?browser)[\/\s]?([\w\.]+)/i,
                /ucweb.+(ucbrowser)[\/\s]?([\w\.]+)/i,
                /JUC.+(ucweb)[\/\s]?([\w\.]+)/i
                                                                                    // UCBrowser
                ], [[NAME, 'UCBrowser'], VERSION], [
    
                /(dolfin)\/([\w\.]+)/i                                              // Dolphin
                ], [[NAME, 'Dolphin'], VERSION], [
    
                /((?:android.+)crmo|crios)\/([\w\.]+)/i                             // Chrome for Android/iOS
                ], [[NAME, 'Chrome'], VERSION], [
    
                /XiaoMi\/MiuiBrowser\/([\w\.]+)/i                                   // MIUI Browser
                ], [VERSION, [NAME, 'MIUI Browser']], [
    
                /android.+version\/([\w\.]+)\s+(?:mobile\s?safari|safari)/i         // Android Browser
                ], [VERSION, [NAME, 'Android Browser']], [
    
                /FBAV\/([\w\.]+);/i                                                 // Facebook App for iOS
                ], [VERSION, [NAME, 'Facebook']], [
    
                /fxios\/([\w\.-]+)/i                                                // Firefox for iOS
                ], [VERSION, [NAME, 'Firefox']], [
    
                /version\/([\w\.]+).+?mobile\/\w+\s(safari)/i                       // Mobile Safari
                ], [VERSION, [NAME, 'Mobile Safari']], [
    
                /version\/([\w\.]+).+?(mobile\s?safari|safari)/i                    // Safari & Safari Mobile
                ], [VERSION, NAME], [
    
                /webkit.+?(mobile\s?safari|safari)(\/[\w\.]+)/i                     // Safari < 3.0
                ], [NAME, [VERSION, mapper.str, maps.browser.oldsafari.version]], [
    
                /(konqueror)\/([\w\.]+)/i,                                          // Konqueror
                /(webkit|khtml)\/([\w\.]+)/i
                ], [NAME, VERSION], [
    
                // Gecko based
                /(navigator|netscape)\/([\w\.-]+)/i                                 // Netscape
                ], [[NAME, 'Netscape'], VERSION], [
                /(swiftfox)/i,                                                      // Swiftfox
                /(icedragon|iceweasel|camino|chimera|fennec|maemo\sbrowser|minimo|conkeror)[\/\s]?([\w\.\+]+)/i,
                                                                                    // IceDragon/Iceweasel/Camino/Chimera/Fennec/Maemo/Minimo/Conkeror
                /(firefox|seamonkey|k-meleon|icecat|iceape|firebird|phoenix)\/([\w\.-]+)/i,
                                                                                    // Firefox/SeaMonkey/K-Meleon/IceCat/IceApe/Firebird/Phoenix
                /(mozilla)\/([\w\.]+).+rv\:.+gecko\/\d+/i,                          // Mozilla
    
                // Other
                /(polaris|lynx|dillo|icab|doris|amaya|w3m|netsurf|sleipnir)[\/\s]?([\w\.]+)/i,
                                                                                    // Polaris/Lynx/Dillo/iCab/Doris/Amaya/w3m/NetSurf/Sleipnir
                /(links)\s\(([\w\.]+)/i,                                            // Links
                /(gobrowser)\/?([\w\.]+)*/i,                                        // GoBrowser
                /(ice\s?browser)\/v?([\w\._]+)/i,                                   // ICE Browser
                /(mosaic)[\/\s]([\w\.]+)/i                                          // Mosaic
                ], [NAME, VERSION]
    
                /* /////////////////////
                // Media players BEGIN
                ////////////////////////
    
                , [
    
                /(apple(?:coremedia|))\/((\d+)[\w\._]+)/i,                          // Generic Apple CoreMedia
                /(coremedia) v((\d+)[\w\._]+)/i
                ], [NAME, VERSION], [
    
                /(aqualung|lyssna|bsplayer)\/((\d+)?[\w\.-]+)/i                     // Aqualung/Lyssna/BSPlayer
                ], [NAME, VERSION], [
    
                /(ares|ossproxy)\s((\d+)[\w\.-]+)/i                                 // Ares/OSSProxy
                ], [NAME, VERSION], [
    
                /(audacious|audimusicstream|amarok|bass|core|dalvik|gnomemplayer|music on console|nsplayer|psp-internetradioplayer|videos)\/((\d+)[\w\.-]+)/i,
                                                                                    // Audacious/AudiMusicStream/Amarok/BASS/OpenCORE/Dalvik/GnomeMplayer/MoC
                                                                                    // NSPlayer/PSP-InternetRadioPlayer/Videos
                /(clementine|music player daemon)\s((\d+)[\w\.-]+)/i,               // Clementine/MPD
                /(lg player|nexplayer)\s((\d+)[\d\.]+)/i,
                /player\/(nexplayer|lg player)\s((\d+)[\w\.-]+)/i                   // NexPlayer/LG Player
                ], [NAME, VERSION], [
                /(nexplayer)\s((\d+)[\w\.-]+)/i                                     // Nexplayer
                ], [NAME, VERSION], [
    
                /(flrp)\/((\d+)[\w\.-]+)/i                                          // Flip Player
                ], [[NAME, 'Flip Player'], VERSION], [
    
                /(fstream|nativehost|queryseekspider|ia-archiver|facebookexternalhit)/i
                                                                                    // FStream/NativeHost/QuerySeekSpider/IA Archiver/facebookexternalhit
                ], [NAME], [
    
                /(gstreamer) souphttpsrc (?:\([^\)]+\)){0,1} libsoup\/((\d+)[\w\.-]+)/i
                                                                                    // Gstreamer
                ], [NAME, VERSION], [
    
                /(htc streaming player)\s[\w_]+\s\/\s((\d+)[\d\.]+)/i,              // HTC Streaming Player
                /(java|python-urllib|python-requests|wget|libcurl)\/((\d+)[\w\.-_]+)/i,
                                                                                    // Java/urllib/requests/wget/cURL
                /(lavf)((\d+)[\d\.]+)/i                                             // Lavf (FFMPEG)
                ], [NAME, VERSION], [
    
                /(htc_one_s)\/((\d+)[\d\.]+)/i                                      // HTC One S
                ], [[NAME, /_/g, ' '], VERSION], [
    
                /(mplayer)(?:\s|\/)(?:(?:sherpya-){0,1}svn)(?:-|\s)(r\d+(?:-\d+[\w\.-]+){0,1})/i
                                                                                    // MPlayer SVN
                ], [NAME, VERSION], [
    
                /(mplayer)(?:\s|\/|[unkow-]+)((\d+)[\w\.-]+)/i                      // MPlayer
                ], [NAME, VERSION], [
    
                /(mplayer)/i,                                                       // MPlayer (no other info)
                /(yourmuze)/i,                                                      // YourMuze
                /(media player classic|nero showtime)/i                             // Media Player Classic/Nero ShowTime
                ], [NAME], [
    
                /(nero (?:home|scout))\/((\d+)[\w\.-]+)/i                           // Nero Home/Nero Scout
                ], [NAME, VERSION], [
    
                /(nokia\d+)\/((\d+)[\w\.-]+)/i                                      // Nokia
                ], [NAME, VERSION], [
    
                /\s(songbird)\/((\d+)[\w\.-]+)/i                                    // Songbird/Philips-Songbird
                ], [NAME, VERSION], [
    
                /(winamp)3 version ((\d+)[\w\.-]+)/i,                               // Winamp
                /(winamp)\s((\d+)[\w\.-]+)/i,
                /(winamp)mpeg\/((\d+)[\w\.-]+)/i
                ], [NAME, VERSION], [
    
                /(ocms-bot|tapinradio|tunein radio|unknown|winamp|inlight radio)/i  // OCMS-bot/tap in radio/tunein/unknown/winamp (no other info)
                                                                                    // inlight radio
                ], [NAME], [
    
                /(quicktime|rma|radioapp|radioclientapplication|soundtap|totem|stagefright|streamium)\/((\d+)[\w\.-]+)/i
                                                                                    // QuickTime/RealMedia/RadioApp/RadioClientApplication/
                                                                                    // SoundTap/Totem/Stagefright/Streamium
                ], [NAME, VERSION], [
    
                /(smp)((\d+)[\d\.]+)/i                                              // SMP
                ], [NAME, VERSION], [
    
                /(vlc) media player - version ((\d+)[\w\.]+)/i,                     // VLC Videolan
                /(vlc)\/((\d+)[\w\.-]+)/i,
                /(xbmc|gvfs|xine|xmms|irapp)\/((\d+)[\w\.-]+)/i,                    // XBMC/gvfs/Xine/XMMS/irapp
                /(foobar2000)\/((\d+)[\d\.]+)/i,                                    // Foobar2000
                /(itunes)\/((\d+)[\d\.]+)/i                                         // iTunes
                ], [NAME, VERSION], [
    
                /(wmplayer)\/((\d+)[\w\.-]+)/i,                                     // Windows Media Player
                /(windows-media-player)\/((\d+)[\w\.-]+)/i
                ], [[NAME, /-/g, ' '], VERSION], [
    
                /windows\/((\d+)[\w\.-]+) upnp\/[\d\.]+ dlnadoc\/[\d\.]+ (home media server)/i
                                                                                    // Windows Media Server
                ], [VERSION, [NAME, 'Windows']], [
    
                /(com\.riseupradioalarm)\/((\d+)[\d\.]*)/i                          // RiseUP Radio Alarm
                ], [NAME, VERSION], [
    
                /(rad.io)\s((\d+)[\d\.]+)/i,                                        // Rad.io
                /(radio.(?:de|at|fr))\s((\d+)[\d\.]+)/i
                ], [[NAME, 'rad.io'], VERSION]
    
                //////////////////////
                // Media players END
                ////////////////////*/
    
            ],
    
            cpu : [[
    
                /(?:(amd|x(?:(?:86|64)[_-])?|wow|win)64)[;\)]/i                     // AMD64
                ], [[ARCHITECTURE, 'amd64']], [
    
                /(ia32(?=;))/i                                                      // IA32 (quicktime)
                ], [[ARCHITECTURE, util.lowerize]], [
    
                /((?:i[346]|x)86)[;\)]/i                                            // IA32
                ], [[ARCHITECTURE, 'ia32']], [
    
                // PocketPC mistakenly identified as PowerPC
                /windows\s(ce|mobile);\sppc;/i
                ], [[ARCHITECTURE, 'arm']], [
    
                /((?:ppc|powerpc)(?:64)?)(?:\smac|;|\))/i                           // PowerPC
                ], [[ARCHITECTURE, /ower/, '', util.lowerize]], [
    
                /(sun4\w)[;\)]/i                                                    // SPARC
                ], [[ARCHITECTURE, 'sparc']], [
    
                /((?:avr32|ia64(?=;))|68k(?=\))|arm(?:64|(?=v\d+;))|(?=atmel\s)avr|(?:irix|mips|sparc)(?:64)?(?=;)|pa-risc)/i
                                                                                    // IA64, 68K, ARM/64, AVR/32, IRIX/64, MIPS/64, SPARC/64, PA-RISC
                ], [[ARCHITECTURE, util.lowerize]]
            ],
    
            device : [[
    
                /\((ipad|playbook);[\w\s\);-]+(rim|apple)/i                         // iPad/PlayBook
                ], [MODEL, VENDOR, [TYPE, TABLET]], [
    
                /applecoremedia\/[\w\.]+ \((ipad)/                                  // iPad
                ], [MODEL, [VENDOR, 'Apple'], [TYPE, TABLET]], [
    
                /(apple\s{0,1}tv)/i                                                 // Apple TV
                ], [[MODEL, 'Apple TV'], [VENDOR, 'Apple']], [
    
                /(archos)\s(gamepad2?)/i,                                           // Archos
                /(hp).+(touchpad)/i,                                                // HP TouchPad
                /(kindle)\/([\w\.]+)/i,                                             // Kindle
                /\s(nook)[\w\s]+build\/(\w+)/i,                                     // Nook
                /(dell)\s(strea[kpr\s\d]*[\dko])/i                                  // Dell Streak
                ], [VENDOR, MODEL, [TYPE, TABLET]], [
    
                /(kf[A-z]+)\sbuild\/[\w\.]+.*silk\//i                               // Kindle Fire HD
                ], [MODEL, [VENDOR, 'Amazon'], [TYPE, TABLET]], [
                /(sd|kf)[0349hijorstuw]+\sbuild\/[\w\.]+.*silk\//i                  // Fire Phone
                ], [[MODEL, mapper.str, maps.device.amazon.model], [VENDOR, 'Amazon'], [TYPE, MOBILE]], [
    
                /\((ip[honed|\s\w*]+);.+(apple)/i                                   // iPod/iPhone
                ], [MODEL, VENDOR, [TYPE, MOBILE]], [
                /\((ip[honed|\s\w*]+);/i                                            // iPod/iPhone
                ], [MODEL, [VENDOR, 'Apple'], [TYPE, MOBILE]], [
    
                /(blackberry)[\s-]?(\w+)/i,                                         // BlackBerry
                /(blackberry|benq|palm(?=\-)|sonyericsson|acer|asus|dell|huawei|meizu|motorola|polytron)[\s_-]?([\w-]+)*/i,
                                                                                    // BenQ/Palm/Sony-Ericsson/Acer/Asus/Dell/Huawei/Meizu/Motorola/Polytron
                /(hp)\s([\w\s]+\w)/i,                                               // HP iPAQ
                /(asus)-?(\w+)/i                                                    // Asus
                ], [VENDOR, MODEL, [TYPE, MOBILE]], [
                /\(bb10;\s(\w+)/i                                                   // BlackBerry 10
                ], [MODEL, [VENDOR, 'BlackBerry'], [TYPE, MOBILE]], [
                                                                                    // Asus Tablets
                /android.+(transfo[prime\s]{4,10}\s\w+|eeepc|slider\s\w+|nexus 7)/i
                ], [MODEL, [VENDOR, 'Asus'], [TYPE, TABLET]], [
    
                /(sony)\s(tablet\s[ps])\sbuild\//i,                                  // Sony
                /(sony)?(?:sgp.+)\sbuild\//i
                ], [[VENDOR, 'Sony'], [MODEL, 'Xperia Tablet'], [TYPE, TABLET]], [
                /(?:sony)?(?:(?:(?:c|d)\d{4})|(?:so[-l].+))\sbuild\//i
                ], [[VENDOR, 'Sony'], [MODEL, 'Xperia Phone'], [TYPE, MOBILE]], [
    
                /\s(ouya)\s/i,                                                      // Ouya
                /(nintendo)\s([wids3u]+)/i                                          // Nintendo
                ], [VENDOR, MODEL, [TYPE, CONSOLE]], [
    
                /android.+;\s(shield)\sbuild/i                                      // Nvidia
                ], [MODEL, [VENDOR, 'Nvidia'], [TYPE, CONSOLE]], [
    
                /(playstation\s[34portablevi]+)/i                                   // Playstation
                ], [MODEL, [VENDOR, 'Sony'], [TYPE, CONSOLE]], [
    
                /(sprint\s(\w+))/i                                                  // Sprint Phones
                ], [[VENDOR, mapper.str, maps.device.sprint.vendor], [MODEL, mapper.str, maps.device.sprint.model], [TYPE, MOBILE]], [
    
                /(lenovo)\s?(S(?:5000|6000)+(?:[-][\w+]))/i                         // Lenovo tablets
                ], [VENDOR, MODEL, [TYPE, TABLET]], [
    
                /(htc)[;_\s-]+([\w\s]+(?=\))|\w+)*/i,                               // HTC
                /(zte)-(\w+)*/i,                                                    // ZTE
                /(alcatel|geeksphone|huawei|lenovo|nexian|panasonic|(?=;\s)sony)[_\s-]?([\w-]+)*/i
                                                                                    // Alcatel/GeeksPhone/Huawei/Lenovo/Nexian/Panasonic/Sony
                ], [VENDOR, [MODEL, /_/g, ' '], [TYPE, MOBILE]], [
                    
                /(nexus\s9)/i                                                       // HTC Nexus 9
                ], [MODEL, [VENDOR, 'HTC'], [TYPE, TABLET]], [
    
                /[\s\(;](xbox(?:\sone)?)[\s\);]/i                                   // Microsoft Xbox
                ], [MODEL, [VENDOR, 'Microsoft'], [TYPE, CONSOLE]], [
                /(kin\.[onetw]{3})/i                                                // Microsoft Kin
                ], [[MODEL, /\./g, ' '], [VENDOR, 'Microsoft'], [TYPE, MOBILE]], [
    
                                                                                    // Motorola
                /\s(milestone|droid(?:[2-4x]|\s(?:bionic|x2|pro|razr))?(:?\s4g)?)[\w\s]+build\//i,
                /mot[\s-]?(\w+)*/i,
                /(XT\d{3,4}) build\//i,
                /(nexus\s[6])/i
                ], [MODEL, [VENDOR, 'Motorola'], [TYPE, MOBILE]], [
                /android.+\s(mz60\d|xoom[\s2]{0,2})\sbuild\//i
                ], [MODEL, [VENDOR, 'Motorola'], [TYPE, TABLET]], [
    
                /android.+((sch-i[89]0\d|shw-m380s|gt-p\d{4}|gt-n8000|sgh-t8[56]9|nexus 10))/i,
                /((SM-T\w+))/i
                ], [[VENDOR, 'Samsung'], MODEL, [TYPE, TABLET]], [                  // Samsung
                /((s[cgp]h-\w+|gt-\w+|galaxy\snexus|sm-n900))/i,
                /(sam[sung]*)[\s-]*(\w+-?[\w-]*)*/i,
                /sec-((sgh\w+))/i
                ], [[VENDOR, 'Samsung'], MODEL, [TYPE, MOBILE]], [
                /(samsung);smarttv/i
                ], [VENDOR, MODEL, [TYPE, SMARTTV]], [
    
                /\(dtv[\);].+(aquos)/i                                              // Sharp
                ], [MODEL, [VENDOR, 'Sharp'], [TYPE, SMARTTV]], [
                /sie-(\w+)*/i                                                       // Siemens
                ], [MODEL, [VENDOR, 'Siemens'], [TYPE, MOBILE]], [
    
                /(maemo|nokia).*(n900|lumia\s\d+)/i,                                // Nokia
                /(nokia)[\s_-]?([\w-]+)*/i
                ], [[VENDOR, 'Nokia'], MODEL, [TYPE, MOBILE]], [
    
                /android\s3\.[\s\w;-]{10}(a\d{3})/i                                 // Acer
                ], [MODEL, [VENDOR, 'Acer'], [TYPE, TABLET]], [
    
                /android\s3\.[\s\w;-]{10}(lg?)-([06cv9]{3,4})/i                     // LG Tablet
                ], [[VENDOR, 'LG'], MODEL, [TYPE, TABLET]], [
                /(lg) netcast\.tv/i                                                 // LG SmartTV
                ], [VENDOR, MODEL, [TYPE, SMARTTV]], [
                /(nexus\s[45])/i,                                                   // LG
                /lg[e;\s\/-]+(\w+)*/i
                ], [MODEL, [VENDOR, 'LG'], [TYPE, MOBILE]], [
    
                /android.+(ideatab[a-z0-9\-\s]+)/i                                  // Lenovo
                ], [MODEL, [VENDOR, 'Lenovo'], [TYPE, TABLET]], [
    
                /linux;.+((jolla));/i                                               // Jolla
                ], [VENDOR, MODEL, [TYPE, MOBILE]], [
    
                /((pebble))app\/[\d\.]+\s/i                                         // Pebble
                ], [VENDOR, MODEL, [TYPE, WEARABLE]], [
    
                /android.+;\s(glass)\s\d/i                                          // Google Glass
                ], [MODEL, [VENDOR, 'Google'], [TYPE, WEARABLE]], [
    
                /android.+(\w+)\s+build\/hm\1/i,                                        // Xiaomi Hongmi 'numeric' models
                /android.+(hm[\s\-_]*note?[\s_]*(?:\d\w)?)\s+build/i,                   // Xiaomi Hongmi
                /android.+(mi[\s\-_]*(?:one|one[\s_]plus)?[\s_]*(?:\d\w)?)\s+build/i    // Xiaomi Mi
                ], [[MODEL, /_/g, ' '], [VENDOR, 'Xiaomi'], [TYPE, MOBILE]], [
    
                /\s(tablet)[;\/\s]/i,                                               // Unidentifiable Tablet
                /\s(mobile)[;\/\s]/i                                                // Unidentifiable Mobile
                ], [[TYPE, util.lowerize], VENDOR, MODEL]
    
                /*//////////////////////////
                // TODO: move to string map
                ////////////////////////////
    
                /(C6603)/i                                                          // Sony Xperia Z C6603
                ], [[MODEL, 'Xperia Z C6603'], [VENDOR, 'Sony'], [TYPE, MOBILE]], [
                /(C6903)/i                                                          // Sony Xperia Z 1
                ], [[MODEL, 'Xperia Z 1'], [VENDOR, 'Sony'], [TYPE, MOBILE]], [
    
                /(SM-G900[F|H])/i                                                   // Samsung Galaxy S5
                ], [[MODEL, 'Galaxy S5'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
                /(SM-G7102)/i                                                       // Samsung Galaxy Grand 2
                ], [[MODEL, 'Galaxy Grand 2'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
                /(SM-G530H)/i                                                       // Samsung Galaxy Grand Prime
                ], [[MODEL, 'Galaxy Grand Prime'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
                /(SM-G313HZ)/i                                                      // Samsung Galaxy V
                ], [[MODEL, 'Galaxy V'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
                /(SM-T805)/i                                                        // Samsung Galaxy Tab S 10.5
                ], [[MODEL, 'Galaxy Tab S 10.5'], [VENDOR, 'Samsung'], [TYPE, TABLET]], [
                /(SM-G800F)/i                                                       // Samsung Galaxy S5 Mini
                ], [[MODEL, 'Galaxy S5 Mini'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
                /(SM-T311)/i                                                        // Samsung Galaxy Tab 3 8.0
                ], [[MODEL, 'Galaxy Tab 3 8.0'], [VENDOR, 'Samsung'], [TYPE, TABLET]], [
    
                /(R1001)/i                                                          // Oppo R1001
                ], [MODEL, [VENDOR, 'OPPO'], [TYPE, MOBILE]], [
                /(X9006)/i                                                          // Oppo Find 7a
                ], [[MODEL, 'Find 7a'], [VENDOR, 'Oppo'], [TYPE, MOBILE]], [
                /(R2001)/i                                                          // Oppo YOYO R2001
                ], [[MODEL, 'Yoyo R2001'], [VENDOR, 'Oppo'], [TYPE, MOBILE]], [
                /(R815)/i                                                           // Oppo Clover R815
                ], [[MODEL, 'Clover R815'], [VENDOR, 'Oppo'], [TYPE, MOBILE]], [
                 /(U707)/i                                                          // Oppo Find Way S
                ], [[MODEL, 'Find Way S'], [VENDOR, 'Oppo'], [TYPE, MOBILE]], [
    
                /(T3C)/i                                                            // Advan Vandroid T3C
                ], [MODEL, [VENDOR, 'Advan'], [TYPE, TABLET]], [
                /(ADVAN T1J\+)/i                                                    // Advan Vandroid T1J+
                ], [[MODEL, 'Vandroid T1J+'], [VENDOR, 'Advan'], [TYPE, TABLET]], [
                /(ADVAN S4A)/i                                                      // Advan Vandroid S4A
                ], [[MODEL, 'Vandroid S4A'], [VENDOR, 'Advan'], [TYPE, MOBILE]], [
    
                /(V972M)/i                                                          // ZTE V972M
                ], [MODEL, [VENDOR, 'ZTE'], [TYPE, MOBILE]], [
    
                /(i-mobile)\s(IQ\s[\d\.]+)/i                                        // i-mobile IQ
                ], [VENDOR, MODEL, [TYPE, MOBILE]], [
                /(IQ6.3)/i                                                          // i-mobile IQ IQ 6.3
                ], [[MODEL, 'IQ 6.3'], [VENDOR, 'i-mobile'], [TYPE, MOBILE]], [
                /(i-mobile)\s(i-style\s[\d\.]+)/i                                   // i-mobile i-STYLE
                ], [VENDOR, MODEL, [TYPE, MOBILE]], [
                /(i-STYLE2.1)/i                                                     // i-mobile i-STYLE 2.1
                ], [[MODEL, 'i-STYLE 2.1'], [VENDOR, 'i-mobile'], [TYPE, MOBILE]], [
                
                /(mobiistar touch LAI 512)/i                                        // mobiistar touch LAI 512
                ], [[MODEL, 'Touch LAI 512'], [VENDOR, 'mobiistar'], [TYPE, MOBILE]], [
    
                /////////////
                // END TODO
                ///////////*/
    
            ],
    
            engine : [[
    
                /windows.+\sedge\/([\w\.]+)/i                                       // EdgeHTML
                ], [VERSION, [NAME, 'EdgeHTML']], [
    
                /(presto)\/([\w\.]+)/i,                                             // Presto
                /(webkit|trident|netfront|netsurf|amaya|lynx|w3m)\/([\w\.]+)/i,     // WebKit/Trident/NetFront/NetSurf/Amaya/Lynx/w3m
                /(khtml|tasman|links)[\/\s]\(?([\w\.]+)/i,                          // KHTML/Tasman/Links
                /(icab)[\/\s]([23]\.[\d\.]+)/i                                      // iCab
                ], [NAME, VERSION], [
    
                /rv\:([\w\.]+).*(gecko)/i                                           // Gecko
                ], [VERSION, NAME]
            ],
    
            os : [[
    
                // Windows based
                /microsoft\s(windows)\s(vista|xp)/i                                 // Windows (iTunes)
                ], [NAME, VERSION], [
                /(windows)\snt\s6\.2;\s(arm)/i,                                     // Windows RT
                /(windows\sphone(?:\sos)*|windows\smobile|windows)[\s\/]?([ntce\d\.\s]+\w)/i
                ], [NAME, [VERSION, mapper.str, maps.os.windows.version]], [
                /(win(?=3|9|n)|win\s9x\s)([nt\d\.]+)/i
                ], [[NAME, 'Windows'], [VERSION, mapper.str, maps.os.windows.version]], [
    
                // Mobile/Embedded OS
                /\((bb)(10);/i                                                      // BlackBerry 10
                ], [[NAME, 'BlackBerry'], VERSION], [
                /(blackberry)\w*\/?([\w\.]+)*/i,                                    // Blackberry
                /(tizen)[\/\s]([\w\.]+)/i,                                          // Tizen
                /(android|webos|palm\sos|qnx|bada|rim\stablet\sos|meego|contiki)[\/\s-]?([\w\.]+)*/i,
                                                                                    // Android/WebOS/Palm/QNX/Bada/RIM/MeeGo/Contiki
                /linux;.+(sailfish);/i                                              // Sailfish OS
                ], [NAME, VERSION], [
                /(symbian\s?os|symbos|s60(?=;))[\/\s-]?([\w\.]+)*/i                 // Symbian
                ], [[NAME, 'Symbian'], VERSION], [
                /\((series40);/i                                                    // Series 40
                ], [NAME], [
                /mozilla.+\(mobile;.+gecko.+firefox/i                               // Firefox OS
                ], [[NAME, 'Firefox OS'], VERSION], [
    
                // Console
                /(nintendo|playstation)\s([wids34portablevu]+)/i,                   // Nintendo/Playstation
    
                // GNU/Linux based
                /(mint)[\/\s\(]?(\w+)*/i,                                           // Mint
                /(mageia|vectorlinux)[;\s]/i,                                       // Mageia/VectorLinux
                /(joli|[kxln]?ubuntu|debian|[open]*suse|gentoo|(?=\s)arch|slackware|fedora|mandriva|centos|pclinuxos|redhat|zenwalk|linpus)[\/\s-]?([\w\.-]+)*/i,
                                                                                    // Joli/Ubuntu/Debian/SUSE/Gentoo/Arch/Slackware
                                                                                    // Fedora/Mandriva/CentOS/PCLinuxOS/RedHat/Zenwalk/Linpus
                /(hurd|linux)\s?([\w\.]+)*/i,                                       // Hurd/Linux
                /(gnu)\s?([\w\.]+)*/i                                               // GNU
                ], [NAME, VERSION], [
    
                /(cros)\s[\w]+\s([\w\.]+\w)/i                                       // Chromium OS
                ], [[NAME, 'Chromium OS'], VERSION],[
    
                // Solaris
                /(sunos)\s?([\w\.]+\d)*/i                                           // Solaris
                ], [[NAME, 'Solaris'], VERSION], [
    
                // BSD based
                /\s([frentopc-]{0,4}bsd|dragonfly)\s?([\w\.]+)*/i                   // FreeBSD/NetBSD/OpenBSD/PC-BSD/DragonFly
                ], [NAME, VERSION],[
    
                /(ip[honead]+)(?:.*os\s([\w]+)*\slike\smac|;\sopera)/i              // iOS
                ], [[NAME, 'iOS'], [VERSION, /_/g, '.']], [
    
                /(mac\sos\sx)\s?([\w\s\.]+\w)*/i,
                /(macintosh|mac(?=_powerpc)\s)/i                                    // Mac OS
                ], [[NAME, 'Mac OS'], [VERSION, /_/g, '.']], [
    
                // Other
                /((?:open)?solaris)[\/\s-]?([\w\.]+)*/i,                            // Solaris
                /(haiku)\s(\w+)/i,                                                  // Haiku
                /(aix)\s((\d)(?=\.|\)|\s)[\w\.]*)*/i,                               // AIX
                /(plan\s9|minix|beos|os\/2|amigaos|morphos|risc\sos|openvms)/i,
                                                                                    // Plan9/Minix/BeOS/OS2/AmigaOS/MorphOS/RISCOS/OpenVMS
                /(unix)\s?([\w\.]+)*/i                                              // UNIX
                ], [NAME, VERSION]
            ]
        };
    
    
        /////////////////
        // Constructor
        ////////////////
    
    
        var UAParser = function (uastring, extensions) {
    
            if (!(this instanceof UAParser)) {
                return new UAParser(uastring, extensions).getResult();
            }
    
            var ua = uastring || ((window && window.navigator && window.navigator.userAgent) ? window.navigator.userAgent : EMPTY);
            var rgxmap = extensions ? util.extend(regexes, extensions) : regexes;
    
            this.getBrowser = function () {
                var browser = mapper.rgx.apply(this, rgxmap.browser);
                browser.major = util.major(browser.version);
                return browser;
            };
            this.getCPU = function () {
                return mapper.rgx.apply(this, rgxmap.cpu);
            };
            this.getDevice = function () {
                return mapper.rgx.apply(this, rgxmap.device);
            };
            this.getEngine = function () {
                return mapper.rgx.apply(this, rgxmap.engine);
            };
            this.getOS = function () {
                return mapper.rgx.apply(this, rgxmap.os);
            };
            this.getResult = function() {
                return {
                    ua      : this.getUA(),
                    browser : this.getBrowser(),
                    engine  : this.getEngine(),
                    os      : this.getOS(),
                    device  : this.getDevice(),
                    cpu     : this.getCPU()
                };
            };
            this.getUA = function () {
                return ua;
            };
            this.setUA = function (uastring) {
                ua = uastring;
                return this;
            };
            this.setUA(ua);
            return this;
        };
    
        UAParser.VERSION = LIBVERSION;
        UAParser.BROWSER = {
            NAME    : NAME,
            MAJOR   : MAJOR, // deprecated
            VERSION : VERSION
        };
        UAParser.CPU = {
            ARCHITECTURE : ARCHITECTURE
        };
        UAParser.DEVICE = {
            MODEL   : MODEL,
            VENDOR  : VENDOR,
            TYPE    : TYPE,
            CONSOLE : CONSOLE,
            MOBILE  : MOBILE,
            SMARTTV : SMARTTV,
            TABLET  : TABLET,
            WEARABLE: WEARABLE,
            EMBEDDED: EMBEDDED
        };
        UAParser.ENGINE = {
            NAME    : NAME,
            VERSION : VERSION
        };
        UAParser.OS = {
            NAME    : NAME,
            VERSION : VERSION
        };
    
    
        ///////////
        // Export
        //////////
    
    
        // check js environment
        if (typeof(exports) !== UNDEF_TYPE) {
            // nodejs env
            if (typeof module !== UNDEF_TYPE && module.exports) {
                exports = module.exports = UAParser;
            }
            exports.UAParser = UAParser;
        } else {
            // requirejs env (optional)
            if (typeof(define) === FUNC_TYPE && define.amd) {
                define(function () {
                    return UAParser;
                });
            } else {
                // browser env
                window.UAParser = UAParser;
            }
        }
    
        // jQuery/Zepto specific (optional)
        // Note: 
        //   In AMD env the global scope should be kept clean, but jQuery is an exception.
        //   jQuery always exports to global scope, unless jQuery.noConflict(true) is used,
        //   and we should catch that.
        var $ = window.jQuery || window.Zepto;
        if (typeof $ !== UNDEF_TYPE) {
            var parser = new UAParser();
            $.ua = parser.getResult();
            $.ua.get = function() {
                return parser.getUA();
            };
            $.ua.set = function (uastring) {
                parser.setUA(uastring);
                var result = parser.getResult();
                for (var prop in result) {
                    $.ua[prop] = result[prop];
                }
            };
        }
    
    })(typeof window === 'object' ? window : this);
    
  provide("ua-parser-js", module.exports);
}(global));

// pakmanager:fbjs
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright (c) 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     */
    
    'use strict';
    
    throw new Error('The fbjs package should not be required without a full path.');
    
  provide("fbjs", module.exports);
}(global));

// pakmanager:classnames
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /*!
      Copyright (c) 2016 Jed Watson.
      Licensed under the MIT License (MIT), see
      http://jedwatson.github.io/classnames
    */
    /* global define */
    
    (function () {
    	'use strict';
    
    	var hasOwn = {}.hasOwnProperty;
    
    	function classNames () {
    		var classes = [];
    
    		for (var i = 0; i < arguments.length; i++) {
    			var arg = arguments[i];
    			if (!arg) continue;
    
    			var argType = typeof arg;
    
    			if (argType === 'string' || argType === 'number') {
    				classes.push(arg);
    			} else if (Array.isArray(arg)) {
    				classes.push(classNames.apply(null, arg));
    			} else if (argType === 'object') {
    				for (var key in arg) {
    					if (hasOwn.call(arg, key) && arg[key]) {
    						classes.push(key);
    					}
    				}
    			}
    		}
    
    		return classes.join(' ');
    	}
    
    	if (typeof module !== 'undefined' && module.exports) {
    		module.exports = classNames;
    	} else if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {
    		// register as 'classnames', consistent with npm package name
    		define('classnames', [], function () {
    			return classNames;
    		});
    	} else {
    		window.classNames = classNames;
    	}
    }());
    
  provide("classnames", module.exports);
}(global));

// pakmanager:react/lib/reactProdInvariant
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright (c) 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule reactProdInvariant
     * 
     */
    'use strict';
    
    /**
     * WARNING: DO NOT manually require this module.
     * This is a replacement for `invariant(...)` used by the error code system
     * and will _only_ be required by the corresponding babel pass.
     * It always throws.
     */
    
    function reactProdInvariant(code) {
      var argCount = arguments.length - 1;
    
      var message = 'Minified React error #' + code + '; visit ' + 'http://facebook.github.io/react/docs/error-decoder.html?invariant=' + code;
    
      for (var argIdx = 0; argIdx < argCount; argIdx++) {
        message += '&args[]=' + encodeURIComponent(arguments[argIdx + 1]);
      }
    
      message += ' for the full message or use the non-minified dev environment' + ' for full errors and additional helpful warnings.';
    
      var error = new Error(message);
      error.name = 'Invariant Violation';
      error.framesToPop = 1; // we don't care about reactProdInvariant's own frame
    
      throw error;
    }
    
    module.exports = reactProdInvariant;
  provide("react/lib/reactProdInvariant", module.exports);
}(global));

// pakmanager:react/lib/ReactCurrentOwner
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactCurrentOwner
     */
    
    'use strict';
    
    /**
     * Keeps track of the current owner.
     *
     * The current owner is the component who should own any components that are
     * currently being constructed.
     */
    
    var ReactCurrentOwner = {
    
      /**
       * @internal
       * @type {ReactComponent}
       */
      current: null
    
    };
    
    module.exports = ReactCurrentOwner;
  provide("react/lib/ReactCurrentOwner", module.exports);
}(global));

// pakmanager:react/lib/canDefineProperty
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule canDefineProperty
     */
    
    'use strict';
    
    var canDefineProperty = false;
    if (process.env.NODE_ENV !== 'production') {
      try {
        Object.defineProperty({}, 'x', { get: function () {} });
        canDefineProperty = true;
      } catch (x) {
        // IE will fail on defineProperty
      }
    }
    
    module.exports = canDefineProperty;
  provide("react/lib/canDefineProperty", module.exports);
}(global));

// pakmanager:react/lib/ReactPropTypeLocationNames
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactPropTypeLocationNames
     */
    
    'use strict';
    
    var ReactPropTypeLocationNames = {};
    
    if (process.env.NODE_ENV !== 'production') {
      ReactPropTypeLocationNames = {
        prop: 'prop',
        context: 'context',
        childContext: 'child context'
      };
    }
    
    module.exports = ReactPropTypeLocationNames;
  provide("react/lib/ReactPropTypeLocationNames", module.exports);
}(global));

// pakmanager:react/lib/ReactPropTypesSecret
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactPropTypesSecret
     */
    
    'use strict';
    
    var ReactPropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';
    
    module.exports = ReactPropTypesSecret;
  provide("react/lib/ReactPropTypesSecret", module.exports);
}(global));

// pakmanager:react/lib/ReactComponentTreeHook
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2016-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactComponentTreeHook
     */
    
    'use strict';
    
    var _prodInvariant =  require('react/lib/reactProdInvariant');
    
    var ReactCurrentOwner =  require('react/lib/ReactCurrentOwner');
    
    var invariant = require('fbjs/lib/invariant');
    var warning = require('fbjs/lib/warning');
    
    function isNative(fn) {
      // Based on isNative() from Lodash
      var funcToString = Function.prototype.toString;
      var hasOwnProperty = Object.prototype.hasOwnProperty;
      var reIsNative = RegExp('^' + funcToString
      // Take an example native function source for comparison
      .call(hasOwnProperty)
      // Strip regex characters so we can use it for regex
      .replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
      // Remove hasOwnProperty from the template to make it generic
      .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$');
      try {
        var source = funcToString.call(fn);
        return reIsNative.test(source);
      } catch (err) {
        return false;
      }
    }
    
    var canUseCollections =
    // Array.from
    typeof Array.from === 'function' &&
    // Map
    typeof Map === 'function' && isNative(Map) &&
    // Map.prototype.keys
    Map.prototype != null && typeof Map.prototype.keys === 'function' && isNative(Map.prototype.keys) &&
    // Set
    typeof Set === 'function' && isNative(Set) &&
    // Set.prototype.keys
    Set.prototype != null && typeof Set.prototype.keys === 'function' && isNative(Set.prototype.keys);
    
    var itemMap;
    var rootIDSet;
    
    var itemByKey;
    var rootByKey;
    
    if (canUseCollections) {
      itemMap = new Map();
      rootIDSet = new Set();
    } else {
      itemByKey = {};
      rootByKey = {};
    }
    
    var unmountedIDs = [];
    
    // Use non-numeric keys to prevent V8 performance issues:
    // https://github.com/facebook/react/pull/7232
    function getKeyFromID(id) {
      return '.' + id;
    }
    function getIDFromKey(key) {
      return parseInt(key.substr(1), 10);
    }
    
    function get(id) {
      if (canUseCollections) {
        return itemMap.get(id);
      } else {
        var key = getKeyFromID(id);
        return itemByKey[key];
      }
    }
    
    function remove(id) {
      if (canUseCollections) {
        itemMap['delete'](id);
      } else {
        var key = getKeyFromID(id);
        delete itemByKey[key];
      }
    }
    
    function create(id, element, parentID) {
      var item = {
        element: element,
        parentID: parentID,
        text: null,
        childIDs: [],
        isMounted: false,
        updateCount: 0
      };
    
      if (canUseCollections) {
        itemMap.set(id, item);
      } else {
        var key = getKeyFromID(id);
        itemByKey[key] = item;
      }
    }
    
    function addRoot(id) {
      if (canUseCollections) {
        rootIDSet.add(id);
      } else {
        var key = getKeyFromID(id);
        rootByKey[key] = true;
      }
    }
    
    function removeRoot(id) {
      if (canUseCollections) {
        rootIDSet['delete'](id);
      } else {
        var key = getKeyFromID(id);
        delete rootByKey[key];
      }
    }
    
    function getRegisteredIDs() {
      if (canUseCollections) {
        return Array.from(itemMap.keys());
      } else {
        return Object.keys(itemByKey).map(getIDFromKey);
      }
    }
    
    function getRootIDs() {
      if (canUseCollections) {
        return Array.from(rootIDSet.keys());
      } else {
        return Object.keys(rootByKey).map(getIDFromKey);
      }
    }
    
    function purgeDeep(id) {
      var item = get(id);
      if (item) {
        var childIDs = item.childIDs;
    
        remove(id);
        childIDs.forEach(purgeDeep);
      }
    }
    
    function describeComponentFrame(name, source, ownerName) {
      return '\n    in ' + name + (source ? ' (at ' + source.fileName.replace(/^.*[\\\/]/, '') + ':' + source.lineNumber + ')' : ownerName ? ' (created by ' + ownerName + ')' : '');
    }
    
    function getDisplayName(element) {
      if (element == null) {
        return '#empty';
      } else if (typeof element === 'string' || typeof element === 'number') {
        return '#text';
      } else if (typeof element.type === 'string') {
        return element.type;
      } else {
        return element.type.displayName || element.type.name || 'Unknown';
      }
    }
    
    function describeID(id) {
      var name = ReactComponentTreeHook.getDisplayName(id);
      var element = ReactComponentTreeHook.getElement(id);
      var ownerID = ReactComponentTreeHook.getOwnerID(id);
      var ownerName;
      if (ownerID) {
        ownerName = ReactComponentTreeHook.getDisplayName(ownerID);
      }
      process.env.NODE_ENV !== 'production' ? warning(element, 'ReactComponentTreeHook: Missing React element for debugID %s when ' + 'building stack', id) : void 0;
      return describeComponentFrame(name, element && element._source, ownerName);
    }
    
    var ReactComponentTreeHook = {
      onSetChildren: function (id, nextChildIDs) {
        var item = get(id);
        item.childIDs = nextChildIDs;
    
        for (var i = 0; i < nextChildIDs.length; i++) {
          var nextChildID = nextChildIDs[i];
          var nextChild = get(nextChildID);
          !nextChild ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Expected hook events to fire for the child before its parent includes it in onSetChildren().') : _prodInvariant('140') : void 0;
          !(nextChild.childIDs != null || typeof nextChild.element !== 'object' || nextChild.element == null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Expected onSetChildren() to fire for a container child before its parent includes it in onSetChildren().') : _prodInvariant('141') : void 0;
          !nextChild.isMounted ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Expected onMountComponent() to fire for the child before its parent includes it in onSetChildren().') : _prodInvariant('71') : void 0;
          if (nextChild.parentID == null) {
            nextChild.parentID = id;
            // TODO: This shouldn't be necessary but mounting a new root during in
            // componentWillMount currently causes not-yet-mounted components to
            // be purged from our tree data so their parent ID is missing.
          }
          !(nextChild.parentID === id) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Expected onBeforeMountComponent() parent and onSetChildren() to be consistent (%s has parents %s and %s).', nextChildID, nextChild.parentID, id) : _prodInvariant('142', nextChildID, nextChild.parentID, id) : void 0;
        }
      },
      onBeforeMountComponent: function (id, element, parentID) {
        create(id, element, parentID);
      },
      onBeforeUpdateComponent: function (id, element) {
        var item = get(id);
        if (!item || !item.isMounted) {
          // We may end up here as a result of setState() in componentWillUnmount().
          // In this case, ignore the element.
          return;
        }
        item.element = element;
      },
      onMountComponent: function (id) {
        var item = get(id);
        item.isMounted = true;
        var isRoot = item.parentID === 0;
        if (isRoot) {
          addRoot(id);
        }
      },
      onUpdateComponent: function (id) {
        var item = get(id);
        if (!item || !item.isMounted) {
          // We may end up here as a result of setState() in componentWillUnmount().
          // In this case, ignore the element.
          return;
        }
        item.updateCount++;
      },
      onUnmountComponent: function (id) {
        var item = get(id);
        if (item) {
          // We need to check if it exists.
          // `item` might not exist if it is inside an error boundary, and a sibling
          // error boundary child threw while mounting. Then this instance never
          // got a chance to mount, but it still gets an unmounting event during
          // the error boundary cleanup.
          item.isMounted = false;
          var isRoot = item.parentID === 0;
          if (isRoot) {
            removeRoot(id);
          }
        }
        unmountedIDs.push(id);
      },
      purgeUnmountedComponents: function () {
        if (ReactComponentTreeHook._preventPurging) {
          // Should only be used for testing.
          return;
        }
    
        for (var i = 0; i < unmountedIDs.length; i++) {
          var id = unmountedIDs[i];
          purgeDeep(id);
        }
        unmountedIDs.length = 0;
      },
      isMounted: function (id) {
        var item = get(id);
        return item ? item.isMounted : false;
      },
      getCurrentStackAddendum: function (topElement) {
        var info = '';
        if (topElement) {
          var type = topElement.type;
          var name = typeof type === 'function' ? type.displayName || type.name : type;
          var owner = topElement._owner;
          info += describeComponentFrame(name || 'Unknown', topElement._source, owner && owner.getName());
        }
    
        var currentOwner = ReactCurrentOwner.current;
        var id = currentOwner && currentOwner._debugID;
    
        info += ReactComponentTreeHook.getStackAddendumByID(id);
        return info;
      },
      getStackAddendumByID: function (id) {
        var info = '';
        while (id) {
          info += describeID(id);
          id = ReactComponentTreeHook.getParentID(id);
        }
        return info;
      },
      getChildIDs: function (id) {
        var item = get(id);
        return item ? item.childIDs : [];
      },
      getDisplayName: function (id) {
        var element = ReactComponentTreeHook.getElement(id);
        if (!element) {
          return null;
        }
        return getDisplayName(element);
      },
      getElement: function (id) {
        var item = get(id);
        return item ? item.element : null;
      },
      getOwnerID: function (id) {
        var element = ReactComponentTreeHook.getElement(id);
        if (!element || !element._owner) {
          return null;
        }
        return element._owner._debugID;
      },
      getParentID: function (id) {
        var item = get(id);
        return item ? item.parentID : null;
      },
      getSource: function (id) {
        var item = get(id);
        var element = item ? item.element : null;
        var source = element != null ? element._source : null;
        return source;
      },
      getText: function (id) {
        var element = ReactComponentTreeHook.getElement(id);
        if (typeof element === 'string') {
          return element;
        } else if (typeof element === 'number') {
          return '' + element;
        } else {
          return null;
        }
      },
      getUpdateCount: function (id) {
        var item = get(id);
        return item ? item.updateCount : 0;
      },
    
    
      getRegisteredIDs: getRegisteredIDs,
    
      getRootIDs: getRootIDs
    };
    
    module.exports = ReactComponentTreeHook;
  provide("react/lib/ReactComponentTreeHook", module.exports);
}(global));

// pakmanager:react/lib/ReactElement
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2014-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactElement
     */
    
    'use strict';
    
    var _assign = require('object-assign');
    
    var ReactCurrentOwner =  require('react/lib/ReactCurrentOwner');
    
    var warning = require('fbjs/lib/warning');
    var canDefineProperty =  require('react/lib/canDefineProperty');
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    
    // The Symbol used to tag the ReactElement type. If there is no native Symbol
    // nor polyfill, then a plain number is used for performance.
    var REACT_ELEMENT_TYPE = typeof Symbol === 'function' && Symbol['for'] && Symbol['for']('react.element') || 0xeac7;
    
    var RESERVED_PROPS = {
      key: true,
      ref: true,
      __self: true,
      __source: true
    };
    
    var specialPropKeyWarningShown, specialPropRefWarningShown;
    
    function hasValidRef(config) {
      if (process.env.NODE_ENV !== 'production') {
        if (hasOwnProperty.call(config, 'ref')) {
          var getter = Object.getOwnPropertyDescriptor(config, 'ref').get;
          if (getter && getter.isReactWarning) {
            return false;
          }
        }
      }
      return config.ref !== undefined;
    }
    
    function hasValidKey(config) {
      if (process.env.NODE_ENV !== 'production') {
        if (hasOwnProperty.call(config, 'key')) {
          var getter = Object.getOwnPropertyDescriptor(config, 'key').get;
          if (getter && getter.isReactWarning) {
            return false;
          }
        }
      }
      return config.key !== undefined;
    }
    
    function defineKeyPropWarningGetter(props, displayName) {
      var warnAboutAccessingKey = function () {
        if (!specialPropKeyWarningShown) {
          specialPropKeyWarningShown = true;
          process.env.NODE_ENV !== 'production' ? warning(false, '%s: `key` is not a prop. Trying to access it will result ' + 'in `undefined` being returned. If you need to access the same ' + 'value within the child component, you should pass it as a different ' + 'prop. (https://fb.me/react-special-props)', displayName) : void 0;
        }
      };
      warnAboutAccessingKey.isReactWarning = true;
      Object.defineProperty(props, 'key', {
        get: warnAboutAccessingKey,
        configurable: true
      });
    }
    
    function defineRefPropWarningGetter(props, displayName) {
      var warnAboutAccessingRef = function () {
        if (!specialPropRefWarningShown) {
          specialPropRefWarningShown = true;
          process.env.NODE_ENV !== 'production' ? warning(false, '%s: `ref` is not a prop. Trying to access it will result ' + 'in `undefined` being returned. If you need to access the same ' + 'value within the child component, you should pass it as a different ' + 'prop. (https://fb.me/react-special-props)', displayName) : void 0;
        }
      };
      warnAboutAccessingRef.isReactWarning = true;
      Object.defineProperty(props, 'ref', {
        get: warnAboutAccessingRef,
        configurable: true
      });
    }
    
    /**
     * Factory method to create a new React element. This no longer adheres to
     * the class pattern, so do not use new to call it. Also, no instanceof check
     * will work. Instead test $$typeof field against Symbol.for('react.element') to check
     * if something is a React Element.
     *
     * @param {*} type
     * @param {*} key
     * @param {string|object} ref
     * @param {*} self A *temporary* helper to detect places where `this` is
     * different from the `owner` when React.createElement is called, so that we
     * can warn. We want to get rid of owner and replace string `ref`s with arrow
     * functions, and as long as `this` and owner are the same, there will be no
     * change in behavior.
     * @param {*} source An annotation object (added by a transpiler or otherwise)
     * indicating filename, line number, and/or other information.
     * @param {*} owner
     * @param {*} props
     * @internal
     */
    var ReactElement = function (type, key, ref, self, source, owner, props) {
      var element = {
        // This tag allow us to uniquely identify this as a React Element
        $$typeof: REACT_ELEMENT_TYPE,
    
        // Built-in properties that belong on the element
        type: type,
        key: key,
        ref: ref,
        props: props,
    
        // Record the component responsible for creating this element.
        _owner: owner
      };
    
      if (process.env.NODE_ENV !== 'production') {
        // The validation flag is currently mutative. We put it on
        // an external backing store so that we can freeze the whole object.
        // This can be replaced with a WeakMap once they are implemented in
        // commonly used development environments.
        element._store = {};
        var shadowChildren = Array.isArray(props.children) ? props.children.slice(0) : props.children;
    
        // To make comparing ReactElements easier for testing purposes, we make
        // the validation flag non-enumerable (where possible, which should
        // include every environment we run tests in), so the test framework
        // ignores it.
        if (canDefineProperty) {
          Object.defineProperty(element._store, 'validated', {
            configurable: false,
            enumerable: false,
            writable: true,
            value: false
          });
          // self and source are DEV only properties.
          Object.defineProperty(element, '_self', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: self
          });
          Object.defineProperty(element, '_shadowChildren', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: shadowChildren
          });
          // Two elements created in two different places should be considered
          // equal for testing purposes and therefore we hide it from enumeration.
          Object.defineProperty(element, '_source', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: source
          });
        } else {
          element._store.validated = false;
          element._self = self;
          element._shadowChildren = shadowChildren;
          element._source = source;
        }
        if (Object.freeze) {
          Object.freeze(element.props);
          Object.freeze(element);
        }
      }
    
      return element;
    };
    
    /**
     * Create and return a new ReactElement of the given type.
     * See https://facebook.github.io/react/docs/top-level-api.html#react.createelement
     */
    ReactElement.createElement = function (type, config, children) {
      var propName;
    
      // Reserved names are extracted
      var props = {};
    
      var key = null;
      var ref = null;
      var self = null;
      var source = null;
    
      if (config != null) {
        if (process.env.NODE_ENV !== 'production') {
          process.env.NODE_ENV !== 'production' ? warning(
          /* eslint-disable no-proto */
          config.__proto__ == null || config.__proto__ === Object.prototype,
          /* eslint-enable no-proto */
          'React.createElement(...): Expected props argument to be a plain object. ' + 'Properties defined in its prototype chain will be ignored.') : void 0;
        }
    
        if (hasValidRef(config)) {
          ref = config.ref;
        }
        if (hasValidKey(config)) {
          key = '' + config.key;
        }
    
        self = config.__self === undefined ? null : config.__self;
        source = config.__source === undefined ? null : config.__source;
        // Remaining properties are added to a new props object
        for (propName in config) {
          if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
            props[propName] = config[propName];
          }
        }
      }
    
      // Children can be more than one argument, and those are transferred onto
      // the newly allocated props object.
      var childrenLength = arguments.length - 2;
      if (childrenLength === 1) {
        props.children = children;
      } else if (childrenLength > 1) {
        var childArray = Array(childrenLength);
        for (var i = 0; i < childrenLength; i++) {
          childArray[i] = arguments[i + 2];
        }
        props.children = childArray;
      }
    
      // Resolve default props
      if (type && type.defaultProps) {
        var defaultProps = type.defaultProps;
        for (propName in defaultProps) {
          if (props[propName] === undefined) {
            props[propName] = defaultProps[propName];
          }
        }
      }
      if (process.env.NODE_ENV !== 'production') {
        if (key || ref) {
          if (typeof props.$$typeof === 'undefined' || props.$$typeof !== REACT_ELEMENT_TYPE) {
            var displayName = typeof type === 'function' ? type.displayName || type.name || 'Unknown' : type;
            if (key) {
              defineKeyPropWarningGetter(props, displayName);
            }
            if (ref) {
              defineRefPropWarningGetter(props, displayName);
            }
          }
        }
      }
      return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
    };
    
    /**
     * Return a function that produces ReactElements of a given type.
     * See https://facebook.github.io/react/docs/top-level-api.html#react.createfactory
     */
    ReactElement.createFactory = function (type) {
      var factory = ReactElement.createElement.bind(null, type);
      // Expose the type on the factory and the prototype so that it can be
      // easily accessed on elements. E.g. `<Foo />.type === Foo`.
      // This should not be named `constructor` since this may not be the function
      // that created the element, and it may not even be a constructor.
      // Legacy hook TODO: Warn if this is accessed
      factory.type = type;
      return factory;
    };
    
    ReactElement.cloneAndReplaceKey = function (oldElement, newKey) {
      var newElement = ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);
    
      return newElement;
    };
    
    /**
     * Clone and return a new ReactElement using element as the starting point.
     * See https://facebook.github.io/react/docs/top-level-api.html#react.cloneelement
     */
    ReactElement.cloneElement = function (element, config, children) {
      var propName;
    
      // Original props are copied
      var props = _assign({}, element.props);
    
      // Reserved names are extracted
      var key = element.key;
      var ref = element.ref;
      // Self is preserved since the owner is preserved.
      var self = element._self;
      // Source is preserved since cloneElement is unlikely to be targeted by a
      // transpiler, and the original source is probably a better indicator of the
      // true owner.
      var source = element._source;
    
      // Owner will be preserved, unless ref is overridden
      var owner = element._owner;
    
      if (config != null) {
        if (process.env.NODE_ENV !== 'production') {
          process.env.NODE_ENV !== 'production' ? warning(
          /* eslint-disable no-proto */
          config.__proto__ == null || config.__proto__ === Object.prototype,
          /* eslint-enable no-proto */
          'React.cloneElement(...): Expected props argument to be a plain object. ' + 'Properties defined in its prototype chain will be ignored.') : void 0;
        }
    
        if (hasValidRef(config)) {
          // Silently steal the ref from the parent.
          ref = config.ref;
          owner = ReactCurrentOwner.current;
        }
        if (hasValidKey(config)) {
          key = '' + config.key;
        }
    
        // Remaining properties override existing props
        var defaultProps;
        if (element.type && element.type.defaultProps) {
          defaultProps = element.type.defaultProps;
        }
        for (propName in config) {
          if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
            if (config[propName] === undefined && defaultProps !== undefined) {
              // Resolve default props
              props[propName] = defaultProps[propName];
            } else {
              props[propName] = config[propName];
            }
          }
        }
      }
    
      // Children can be more than one argument, and those are transferred onto
      // the newly allocated props object.
      var childrenLength = arguments.length - 2;
      if (childrenLength === 1) {
        props.children = children;
      } else if (childrenLength > 1) {
        var childArray = Array(childrenLength);
        for (var i = 0; i < childrenLength; i++) {
          childArray[i] = arguments[i + 2];
        }
        props.children = childArray;
      }
    
      return ReactElement(element.type, key, ref, self, source, owner, props);
    };
    
    /**
     * Verifies the object is a ReactElement.
     * See https://facebook.github.io/react/docs/top-level-api.html#react.isvalidelement
     * @param {?object} object
     * @return {boolean} True if `object` is a valid component.
     * @final
     */
    ReactElement.isValidElement = function (object) {
      return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
    };
    
    ReactElement.REACT_ELEMENT_TYPE = REACT_ELEMENT_TYPE;
    
    module.exports = ReactElement;
  provide("react/lib/ReactElement", module.exports);
}(global));

// pakmanager:react/lib/getIteratorFn
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule getIteratorFn
     * 
     */
    
    'use strict';
    
    /* global Symbol */
    
    var ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
    var FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.
    
    /**
     * Returns the iterator method function contained on the iterable object.
     *
     * Be sure to invoke the function with the iterable as context:
     *
     *     var iteratorFn = getIteratorFn(myIterable);
     *     if (iteratorFn) {
     *       var iterator = iteratorFn.call(myIterable);
     *       ...
     *     }
     *
     * @param {?object} maybeIterable
     * @return {?function}
     */
    function getIteratorFn(maybeIterable) {
      var iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);
      if (typeof iteratorFn === 'function') {
        return iteratorFn;
      }
    }
    
    module.exports = getIteratorFn;
  provide("react/lib/getIteratorFn", module.exports);
}(global));

// pakmanager:react/lib/KeyEscapeUtils
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule KeyEscapeUtils
     * 
     */
    
    'use strict';
    
    /**
     * Escape and wrap key so it is safe to use as a reactid
     *
     * @param {string} key to be escaped.
     * @return {string} the escaped key.
     */
    
    function escape(key) {
      var escapeRegex = /[=:]/g;
      var escaperLookup = {
        '=': '=0',
        ':': '=2'
      };
      var escapedString = ('' + key).replace(escapeRegex, function (match) {
        return escaperLookup[match];
      });
    
      return '$' + escapedString;
    }
    
    /**
     * Unescape and unwrap key for human-readable display
     *
     * @param {string} key to unescape.
     * @return {string} the unescaped key.
     */
    function unescape(key) {
      var unescapeRegex = /(=0|=2)/g;
      var unescaperLookup = {
        '=0': '=',
        '=2': ':'
      };
      var keySubstring = key[0] === '.' && key[1] === '$' ? key.substring(2) : key.substring(1);
    
      return ('' + keySubstring).replace(unescapeRegex, function (match) {
        return unescaperLookup[match];
      });
    }
    
    var KeyEscapeUtils = {
      escape: escape,
      unescape: unescape
    };
    
    module.exports = KeyEscapeUtils;
  provide("react/lib/KeyEscapeUtils", module.exports);
}(global));

// pakmanager:react/lib/ReactNoopUpdateQueue
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2015-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactNoopUpdateQueue
     */
    
    'use strict';
    
    var warning = require('fbjs/lib/warning');
    
    function warnNoop(publicInstance, callerName) {
      if (process.env.NODE_ENV !== 'production') {
        var constructor = publicInstance.constructor;
        process.env.NODE_ENV !== 'production' ? warning(false, '%s(...): Can only update a mounted or mounting component. ' + 'This usually means you called %s() on an unmounted component. ' + 'This is a no-op. Please check the code for the %s component.', callerName, callerName, constructor && (constructor.displayName || constructor.name) || 'ReactClass') : void 0;
      }
    }
    
    /**
     * This is the abstract API for an update queue.
     */
    var ReactNoopUpdateQueue = {
    
      /**
       * Checks whether or not this composite component is mounted.
       * @param {ReactClass} publicInstance The instance we want to test.
       * @return {boolean} True if mounted, false otherwise.
       * @protected
       * @final
       */
      isMounted: function (publicInstance) {
        return false;
      },
    
      /**
       * Enqueue a callback that will be executed after all the pending updates
       * have processed.
       *
       * @param {ReactClass} publicInstance The instance to use as `this` context.
       * @param {?function} callback Called after state is updated.
       * @internal
       */
      enqueueCallback: function (publicInstance, callback) {},
    
      /**
       * Forces an update. This should only be invoked when it is known with
       * certainty that we are **not** in a DOM transaction.
       *
       * You may want to call this when you know that some deeper aspect of the
       * component's state has changed but `setState` was not called.
       *
       * This will not invoke `shouldComponentUpdate`, but it will invoke
       * `componentWillUpdate` and `componentDidUpdate`.
       *
       * @param {ReactClass} publicInstance The instance that should rerender.
       * @internal
       */
      enqueueForceUpdate: function (publicInstance) {
        warnNoop(publicInstance, 'forceUpdate');
      },
    
      /**
       * Replaces all of the state. Always use this or `setState` to mutate state.
       * You should treat `this.state` as immutable.
       *
       * There is no guarantee that `this.state` will be immediately updated, so
       * accessing `this.state` after calling this method may return the old value.
       *
       * @param {ReactClass} publicInstance The instance that should rerender.
       * @param {object} completeState Next state.
       * @internal
       */
      enqueueReplaceState: function (publicInstance, completeState) {
        warnNoop(publicInstance, 'replaceState');
      },
    
      /**
       * Sets a subset of the state. This only exists because _pendingState is
       * internal. This provides a merging strategy that is not available to deep
       * properties which is confusing. TODO: Expose pendingState or don't use it
       * during the merge.
       *
       * @param {ReactClass} publicInstance The instance that should rerender.
       * @param {object} partialState Next partial state to be merged with state.
       * @internal
       */
      enqueueSetState: function (publicInstance, partialState) {
        warnNoop(publicInstance, 'setState');
      }
    };
    
    module.exports = ReactNoopUpdateQueue;
  provide("react/lib/ReactNoopUpdateQueue", module.exports);
}(global));

// pakmanager:react/lib/ReactPropTypeLocations
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactPropTypeLocations
     */
    
    'use strict';
    
    var keyMirror = require('fbjs/lib/keyMirror');
    
    var ReactPropTypeLocations = keyMirror({
      prop: null,
      context: null,
      childContext: null
    });
    
    module.exports = ReactPropTypeLocations;
  provide("react/lib/ReactPropTypeLocations", module.exports);
}(global));

// pakmanager:react/lib/checkReactTypeSpec
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule checkReactTypeSpec
     */
    
    'use strict';
    
    var _prodInvariant =  require('react/lib/reactProdInvariant');
    
    var ReactPropTypeLocationNames =  require('react/lib/ReactPropTypeLocationNames');
    var ReactPropTypesSecret =  require('react/lib/ReactPropTypesSecret');
    
    var invariant = require('fbjs/lib/invariant');
    var warning = require('fbjs/lib/warning');
    
    var ReactComponentTreeHook;
    
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
      // Temporary hack.
      // Inline requires don't work well with Jest:
      // https://github.com/facebook/react/issues/7240
      // Remove the inline requires when we don't need them anymore:
      // https://github.com/facebook/react/pull/7178
      ReactComponentTreeHook =  require('react/lib/ReactComponentTreeHook');
    }
    
    var loggedTypeFailures = {};
    
    /**
     * Assert that the values match with the type specs.
     * Error messages are memorized and will only be shown once.
     *
     * @param {object} typeSpecs Map of name to a ReactPropType
     * @param {object} values Runtime values that need to be type-checked
     * @param {string} location e.g. "prop", "context", "child context"
     * @param {string} componentName Name of the component for error messages.
     * @param {?object} element The React element that is being type-checked
     * @param {?number} debugID The React component instance that is being type-checked
     * @private
     */
    function checkReactTypeSpec(typeSpecs, values, location, componentName, element, debugID) {
      for (var typeSpecName in typeSpecs) {
        if (typeSpecs.hasOwnProperty(typeSpecName)) {
          var error;
          // Prop type validation may throw. In case they do, we don't want to
          // fail the render phase where it didn't fail before. So we log it.
          // After these have been cleaned up, we'll let them throw.
          try {
            // This is intentionally an invariant that gets caught. It's the same
            // behavior as without this statement except with a better message.
            !(typeof typeSpecs[typeSpecName] === 'function') ? process.env.NODE_ENV !== 'production' ? invariant(false, '%s: %s type `%s` is invalid; it must be a function, usually from React.PropTypes.', componentName || 'React class', ReactPropTypeLocationNames[location], typeSpecName) : _prodInvariant('84', componentName || 'React class', ReactPropTypeLocationNames[location], typeSpecName) : void 0;
            error = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, ReactPropTypesSecret);
          } catch (ex) {
            error = ex;
          }
          process.env.NODE_ENV !== 'production' ? warning(!error || error instanceof Error, '%s: type specification of %s `%s` is invalid; the type checker ' + 'function must return `null` or an `Error` but returned a %s. ' + 'You may have forgotten to pass an argument to the type checker ' + 'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' + 'shape all require an argument).', componentName || 'React class', ReactPropTypeLocationNames[location], typeSpecName, typeof error) : void 0;
          if (error instanceof Error && !(error.message in loggedTypeFailures)) {
            // Only monitor this failure once because there tends to be a lot of the
            // same error.
            loggedTypeFailures[error.message] = true;
    
            var componentStackInfo = '';
    
            if (process.env.NODE_ENV !== 'production') {
              if (!ReactComponentTreeHook) {
                ReactComponentTreeHook =  require('react/lib/ReactComponentTreeHook');
              }
              if (debugID !== null) {
                componentStackInfo = ReactComponentTreeHook.getStackAddendumByID(debugID);
              } else if (element !== null) {
                componentStackInfo = ReactComponentTreeHook.getCurrentStackAddendum(element);
              }
            }
    
            process.env.NODE_ENV !== 'production' ? warning(false, 'Failed %s type: %s%s', location, error.message, componentStackInfo) : void 0;
          }
        }
      }
    }
    
    module.exports = checkReactTypeSpec;
  provide("react/lib/checkReactTypeSpec", module.exports);
}(global));

// pakmanager:react/lib/PooledClass
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule PooledClass
     */
    
    'use strict';
    
    var _prodInvariant =  require('react/lib/reactProdInvariant');
    
    var invariant = require('fbjs/lib/invariant');
    
    /**
     * Static poolers. Several custom versions for each potential number of
     * arguments. A completely generic pooler is easy to implement, but would
     * require accessing the `arguments` object. In each of these, `this` refers to
     * the Class itself, not an instance. If any others are needed, simply add them
     * here, or in their own files.
     */
    var oneArgumentPooler = function (copyFieldsFrom) {
      var Klass = this;
      if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        Klass.call(instance, copyFieldsFrom);
        return instance;
      } else {
        return new Klass(copyFieldsFrom);
      }
    };
    
    var twoArgumentPooler = function (a1, a2) {
      var Klass = this;
      if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        Klass.call(instance, a1, a2);
        return instance;
      } else {
        return new Klass(a1, a2);
      }
    };
    
    var threeArgumentPooler = function (a1, a2, a3) {
      var Klass = this;
      if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        Klass.call(instance, a1, a2, a3);
        return instance;
      } else {
        return new Klass(a1, a2, a3);
      }
    };
    
    var fourArgumentPooler = function (a1, a2, a3, a4) {
      var Klass = this;
      if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        Klass.call(instance, a1, a2, a3, a4);
        return instance;
      } else {
        return new Klass(a1, a2, a3, a4);
      }
    };
    
    var fiveArgumentPooler = function (a1, a2, a3, a4, a5) {
      var Klass = this;
      if (Klass.instancePool.length) {
        var instance = Klass.instancePool.pop();
        Klass.call(instance, a1, a2, a3, a4, a5);
        return instance;
      } else {
        return new Klass(a1, a2, a3, a4, a5);
      }
    };
    
    var standardReleaser = function (instance) {
      var Klass = this;
      !(instance instanceof Klass) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Trying to release an instance into a pool of a different type.') : _prodInvariant('25') : void 0;
      instance.destructor();
      if (Klass.instancePool.length < Klass.poolSize) {
        Klass.instancePool.push(instance);
      }
    };
    
    var DEFAULT_POOL_SIZE = 10;
    var DEFAULT_POOLER = oneArgumentPooler;
    
    /**
     * Augments `CopyConstructor` to be a poolable class, augmenting only the class
     * itself (statically) not adding any prototypical fields. Any CopyConstructor
     * you give this may have a `poolSize` property, and will look for a
     * prototypical `destructor` on instances.
     *
     * @param {Function} CopyConstructor Constructor that can be used to reset.
     * @param {Function} pooler Customizable pooler.
     */
    var addPoolingTo = function (CopyConstructor, pooler) {
      var NewKlass = CopyConstructor;
      NewKlass.instancePool = [];
      NewKlass.getPooled = pooler || DEFAULT_POOLER;
      if (!NewKlass.poolSize) {
        NewKlass.poolSize = DEFAULT_POOL_SIZE;
      }
      NewKlass.release = standardReleaser;
      return NewKlass;
    };
    
    var PooledClass = {
      addPoolingTo: addPoolingTo,
      oneArgumentPooler: oneArgumentPooler,
      twoArgumentPooler: twoArgumentPooler,
      threeArgumentPooler: threeArgumentPooler,
      fourArgumentPooler: fourArgumentPooler,
      fiveArgumentPooler: fiveArgumentPooler
    };
    
    module.exports = PooledClass;
  provide("react/lib/PooledClass", module.exports);
}(global));

// pakmanager:react/lib/traverseAllChildren
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule traverseAllChildren
     */
    
    'use strict';
    
    var _prodInvariant =  require('react/lib/reactProdInvariant');
    
    var ReactCurrentOwner =  require('react/lib/ReactCurrentOwner');
    var ReactElement =  require('react/lib/ReactElement');
    
    var getIteratorFn =  require('react/lib/getIteratorFn');
    var invariant = require('fbjs/lib/invariant');
    var KeyEscapeUtils =  require('react/lib/KeyEscapeUtils');
    var warning = require('fbjs/lib/warning');
    
    var SEPARATOR = '.';
    var SUBSEPARATOR = ':';
    
    /**
     * TODO: Test that a single child and an array with one item have the same key
     * pattern.
     */
    
    var didWarnAboutMaps = false;
    
    /**
     * Generate a key string that identifies a component within a set.
     *
     * @param {*} component A component that could contain a manual key.
     * @param {number} index Index that is used if a manual key is not provided.
     * @return {string}
     */
    function getComponentKey(component, index) {
      // Do some typechecking here since we call this blindly. We want to ensure
      // that we don't block potential future ES APIs.
      if (component && typeof component === 'object' && component.key != null) {
        // Explicit key
        return KeyEscapeUtils.escape(component.key);
      }
      // Implicit key determined by the index in the set
      return index.toString(36);
    }
    
    /**
     * @param {?*} children Children tree container.
     * @param {!string} nameSoFar Name of the key path so far.
     * @param {!function} callback Callback to invoke with each child found.
     * @param {?*} traverseContext Used to pass information throughout the traversal
     * process.
     * @return {!number} The number of children in this subtree.
     */
    function traverseAllChildrenImpl(children, nameSoFar, callback, traverseContext) {
      var type = typeof children;
    
      if (type === 'undefined' || type === 'boolean') {
        // All of the above are perceived as null.
        children = null;
      }
    
      if (children === null || type === 'string' || type === 'number' || ReactElement.isValidElement(children)) {
        callback(traverseContext, children,
        // If it's the only child, treat the name as if it was wrapped in an array
        // so that it's consistent if the number of children grows.
        nameSoFar === '' ? SEPARATOR + getComponentKey(children, 0) : nameSoFar);
        return 1;
      }
    
      var child;
      var nextName;
      var subtreeCount = 0; // Count of children found in the current subtree.
      var nextNamePrefix = nameSoFar === '' ? SEPARATOR : nameSoFar + SUBSEPARATOR;
    
      if (Array.isArray(children)) {
        for (var i = 0; i < children.length; i++) {
          child = children[i];
          nextName = nextNamePrefix + getComponentKey(child, i);
          subtreeCount += traverseAllChildrenImpl(child, nextName, callback, traverseContext);
        }
      } else {
        var iteratorFn = getIteratorFn(children);
        if (iteratorFn) {
          var iterator = iteratorFn.call(children);
          var step;
          if (iteratorFn !== children.entries) {
            var ii = 0;
            while (!(step = iterator.next()).done) {
              child = step.value;
              nextName = nextNamePrefix + getComponentKey(child, ii++);
              subtreeCount += traverseAllChildrenImpl(child, nextName, callback, traverseContext);
            }
          } else {
            if (process.env.NODE_ENV !== 'production') {
              var mapsAsChildrenAddendum = '';
              if (ReactCurrentOwner.current) {
                var mapsAsChildrenOwnerName = ReactCurrentOwner.current.getName();
                if (mapsAsChildrenOwnerName) {
                  mapsAsChildrenAddendum = ' Check the render method of `' + mapsAsChildrenOwnerName + '`.';
                }
              }
              process.env.NODE_ENV !== 'production' ? warning(didWarnAboutMaps, 'Using Maps as children is not yet fully supported. It is an ' + 'experimental feature that might be removed. Convert it to a ' + 'sequence / iterable of keyed ReactElements instead.%s', mapsAsChildrenAddendum) : void 0;
              didWarnAboutMaps = true;
            }
            // Iterator will provide entry [k,v] tuples rather than values.
            while (!(step = iterator.next()).done) {
              var entry = step.value;
              if (entry) {
                child = entry[1];
                nextName = nextNamePrefix + KeyEscapeUtils.escape(entry[0]) + SUBSEPARATOR + getComponentKey(child, 0);
                subtreeCount += traverseAllChildrenImpl(child, nextName, callback, traverseContext);
              }
            }
          }
        } else if (type === 'object') {
          var addendum = '';
          if (process.env.NODE_ENV !== 'production') {
            addendum = ' If you meant to render a collection of children, use an array ' + 'instead or wrap the object using createFragment(object) from the ' + 'React add-ons.';
            if (children._isReactElement) {
              addendum = ' It looks like you\'re using an element created by a different ' + 'version of React. Make sure to use only one copy of React.';
            }
            if (ReactCurrentOwner.current) {
              var name = ReactCurrentOwner.current.getName();
              if (name) {
                addendum += ' Check the render method of `' + name + '`.';
              }
            }
          }
          var childrenString = String(children);
          !false ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Objects are not valid as a React child (found: %s).%s', childrenString === '[object Object]' ? 'object with keys {' + Object.keys(children).join(', ') + '}' : childrenString, addendum) : _prodInvariant('31', childrenString === '[object Object]' ? 'object with keys {' + Object.keys(children).join(', ') + '}' : childrenString, addendum) : void 0;
        }
      }
    
      return subtreeCount;
    }
    
    /**
     * Traverses children that are typically specified as `props.children`, but
     * might also be specified through attributes:
     *
     * - `traverseAllChildren(this.props.children, ...)`
     * - `traverseAllChildren(this.props.leftPanelChildren, ...)`
     *
     * The `traverseContext` is an optional argument that is passed through the
     * entire traversal. It can be used to store accumulations or anything else that
     * the callback might find relevant.
     *
     * @param {?*} children Children tree object.
     * @param {!function} callback To invoke upon traversing each child.
     * @param {?*} traverseContext Context for traversal.
     * @return {!number} The number of children in this subtree.
     */
    function traverseAllChildren(children, callback, traverseContext) {
      if (children == null) {
        return 0;
      }
    
      return traverseAllChildrenImpl(children, '', callback, traverseContext);
    }
    
    module.exports = traverseAllChildren;
  provide("react/lib/traverseAllChildren", module.exports);
}(global));

// pakmanager:react/lib/ReactComponent
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactComponent
     */
    
    'use strict';
    
    var _prodInvariant =  require('react/lib/reactProdInvariant');
    
    var ReactNoopUpdateQueue =  require('react/lib/ReactNoopUpdateQueue');
    
    var canDefineProperty =  require('react/lib/canDefineProperty');
    var emptyObject = require('fbjs/lib/emptyObject');
    var invariant = require('fbjs/lib/invariant');
    var warning = require('fbjs/lib/warning');
    
    /**
     * Base class helpers for the updating state of a component.
     */
    function ReactComponent(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      // We initialize the default updater but the real one gets injected by the
      // renderer.
      this.updater = updater || ReactNoopUpdateQueue;
    }
    
    ReactComponent.prototype.isReactComponent = {};
    
    /**
     * Sets a subset of the state. Always use this to mutate
     * state. You should treat `this.state` as immutable.
     *
     * There is no guarantee that `this.state` will be immediately updated, so
     * accessing `this.state` after calling this method may return the old value.
     *
     * There is no guarantee that calls to `setState` will run synchronously,
     * as they may eventually be batched together.  You can provide an optional
     * callback that will be executed when the call to setState is actually
     * completed.
     *
     * When a function is provided to setState, it will be called at some point in
     * the future (not synchronously). It will be called with the up to date
     * component arguments (state, props, context). These values can be different
     * from this.* because your function may be called after receiveProps but before
     * shouldComponentUpdate, and this new state, props, and context will not yet be
     * assigned to this.
     *
     * @param {object|function} partialState Next partial state or function to
     *        produce next partial state to be merged with current state.
     * @param {?function} callback Called after state is updated.
     * @final
     * @protected
     */
    ReactComponent.prototype.setState = function (partialState, callback) {
      !(typeof partialState === 'object' || typeof partialState === 'function' || partialState == null) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'setState(...): takes an object of state variables to update or a function which returns an object of state variables.') : _prodInvariant('85') : void 0;
      this.updater.enqueueSetState(this, partialState);
      if (callback) {
        this.updater.enqueueCallback(this, callback, 'setState');
      }
    };
    
    /**
     * Forces an update. This should only be invoked when it is known with
     * certainty that we are **not** in a DOM transaction.
     *
     * You may want to call this when you know that some deeper aspect of the
     * component's state has changed but `setState` was not called.
     *
     * This will not invoke `shouldComponentUpdate`, but it will invoke
     * `componentWillUpdate` and `componentDidUpdate`.
     *
     * @param {?function} callback Called after update is complete.
     * @final
     * @protected
     */
    ReactComponent.prototype.forceUpdate = function (callback) {
      this.updater.enqueueForceUpdate(this);
      if (callback) {
        this.updater.enqueueCallback(this, callback, 'forceUpdate');
      }
    };
    
    /**
     * Deprecated APIs. These APIs used to exist on classic React classes but since
     * we would like to deprecate them, we're not going to move them over to this
     * modern base class. Instead, we define a getter that warns if it's accessed.
     */
    if (process.env.NODE_ENV !== 'production') {
      var deprecatedAPIs = {
        isMounted: ['isMounted', 'Instead, make sure to clean up subscriptions and pending requests in ' + 'componentWillUnmount to prevent memory leaks.'],
        replaceState: ['replaceState', 'Refactor your code to use setState instead (see ' + 'https://github.com/facebook/react/issues/3236).']
      };
      var defineDeprecationWarning = function (methodName, info) {
        if (canDefineProperty) {
          Object.defineProperty(ReactComponent.prototype, methodName, {
            get: function () {
              process.env.NODE_ENV !== 'production' ? warning(false, '%s(...) is deprecated in plain JavaScript React classes. %s', info[0], info[1]) : void 0;
              return undefined;
            }
          });
        }
      };
      for (var fnName in deprecatedAPIs) {
        if (deprecatedAPIs.hasOwnProperty(fnName)) {
          defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
        }
      }
    }
    
    module.exports = ReactComponent;
  provide("react/lib/ReactComponent", module.exports);
}(global));

// pakmanager:react/lib/ReactElementValidator
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2014-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactElementValidator
     */
    
    /**
     * ReactElementValidator provides a wrapper around a element factory
     * which validates the props passed to the element. This is intended to be
     * used only in DEV and could be replaced by a static type checker for languages
     * that support it.
     */
    
    'use strict';
    
    var ReactCurrentOwner =  require('react/lib/ReactCurrentOwner');
    var ReactComponentTreeHook =  require('react/lib/ReactComponentTreeHook');
    var ReactElement =  require('react/lib/ReactElement');
    var ReactPropTypeLocations =  require('react/lib/ReactPropTypeLocations');
    
    var checkReactTypeSpec =  require('react/lib/checkReactTypeSpec');
    
    var canDefineProperty =  require('react/lib/canDefineProperty');
    var getIteratorFn =  require('react/lib/getIteratorFn');
    var warning = require('fbjs/lib/warning');
    
    function getDeclarationErrorAddendum() {
      if (ReactCurrentOwner.current) {
        var name = ReactCurrentOwner.current.getName();
        if (name) {
          return ' Check the render method of `' + name + '`.';
        }
      }
      return '';
    }
    
    /**
     * Warn if there's no key explicitly set on dynamic arrays of children or
     * object keys are not valid. This allows us to keep track of children between
     * updates.
     */
    var ownerHasKeyUseWarning = {};
    
    function getCurrentComponentErrorInfo(parentType) {
      var info = getDeclarationErrorAddendum();
    
      if (!info) {
        var parentName = typeof parentType === 'string' ? parentType : parentType.displayName || parentType.name;
        if (parentName) {
          info = ' Check the top-level render call using <' + parentName + '>.';
        }
      }
      return info;
    }
    
    /**
     * Warn if the element doesn't have an explicit key assigned to it.
     * This element is in an array. The array could grow and shrink or be
     * reordered. All children that haven't already been validated are required to
     * have a "key" property assigned to it. Error statuses are cached so a warning
     * will only be shown once.
     *
     * @internal
     * @param {ReactElement} element Element that requires a key.
     * @param {*} parentType element's parent's type.
     */
    function validateExplicitKey(element, parentType) {
      if (!element._store || element._store.validated || element.key != null) {
        return;
      }
      element._store.validated = true;
    
      var memoizer = ownerHasKeyUseWarning.uniqueKey || (ownerHasKeyUseWarning.uniqueKey = {});
    
      var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
      if (memoizer[currentComponentErrorInfo]) {
        return;
      }
      memoizer[currentComponentErrorInfo] = true;
    
      // Usually the current owner is the offender, but if it accepts children as a
      // property, it may be the creator of the child that's responsible for
      // assigning it a key.
      var childOwner = '';
      if (element && element._owner && element._owner !== ReactCurrentOwner.current) {
        // Give the component that originally created this child.
        childOwner = ' It was passed a child from ' + element._owner.getName() + '.';
      }
    
      process.env.NODE_ENV !== 'production' ? warning(false, 'Each child in an array or iterator should have a unique "key" prop.' + '%s%s See https://fb.me/react-warning-keys for more information.%s', currentComponentErrorInfo, childOwner, ReactComponentTreeHook.getCurrentStackAddendum(element)) : void 0;
    }
    
    /**
     * Ensure that every element either is passed in a static location, in an
     * array with an explicit keys property defined, or in an object literal
     * with valid key property.
     *
     * @internal
     * @param {ReactNode} node Statically passed child of any type.
     * @param {*} parentType node's parent's type.
     */
    function validateChildKeys(node, parentType) {
      if (typeof node !== 'object') {
        return;
      }
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) {
          var child = node[i];
          if (ReactElement.isValidElement(child)) {
            validateExplicitKey(child, parentType);
          }
        }
      } else if (ReactElement.isValidElement(node)) {
        // This element was passed in a valid location.
        if (node._store) {
          node._store.validated = true;
        }
      } else if (node) {
        var iteratorFn = getIteratorFn(node);
        // Entry iterators provide implicit keys.
        if (iteratorFn) {
          if (iteratorFn !== node.entries) {
            var iterator = iteratorFn.call(node);
            var step;
            while (!(step = iterator.next()).done) {
              if (ReactElement.isValidElement(step.value)) {
                validateExplicitKey(step.value, parentType);
              }
            }
          }
        }
      }
    }
    
    /**
     * Given an element, validate that its props follow the propTypes definition,
     * provided by the type.
     *
     * @param {ReactElement} element
     */
    function validatePropTypes(element) {
      var componentClass = element.type;
      if (typeof componentClass !== 'function') {
        return;
      }
      var name = componentClass.displayName || componentClass.name;
      if (componentClass.propTypes) {
        checkReactTypeSpec(componentClass.propTypes, element.props, ReactPropTypeLocations.prop, name, element, null);
      }
      if (typeof componentClass.getDefaultProps === 'function') {
        process.env.NODE_ENV !== 'production' ? warning(componentClass.getDefaultProps.isReactClassApproved, 'getDefaultProps is only used on classic React.createClass ' + 'definitions. Use a static property named `defaultProps` instead.') : void 0;
      }
    }
    
    var ReactElementValidator = {
    
      createElement: function (type, props, children) {
        var validType = typeof type === 'string' || typeof type === 'function';
        // We warn in this case but don't throw. We expect the element creation to
        // succeed and there will likely be errors in render.
        if (!validType) {
          process.env.NODE_ENV !== 'production' ? warning(false, 'React.createElement: type should not be null, undefined, boolean, or ' + 'number. It should be a string (for DOM elements) or a ReactClass ' + '(for composite components).%s', getDeclarationErrorAddendum()) : void 0;
        }
    
        var element = ReactElement.createElement.apply(this, arguments);
    
        // The result can be nullish if a mock or a custom function is used.
        // TODO: Drop this when these are no longer allowed as the type argument.
        if (element == null) {
          return element;
        }
    
        // Skip key warning if the type isn't valid since our key validation logic
        // doesn't expect a non-string/function type and can throw confusing errors.
        // We don't want exception behavior to differ between dev and prod.
        // (Rendering will throw with a helpful message and as soon as the type is
        // fixed, the key warnings will appear.)
        if (validType) {
          for (var i = 2; i < arguments.length; i++) {
            validateChildKeys(arguments[i], type);
          }
        }
    
        validatePropTypes(element);
    
        return element;
      },
    
      createFactory: function (type) {
        var validatedFactory = ReactElementValidator.createElement.bind(null, type);
        // Legacy hook TODO: Warn if this is accessed
        validatedFactory.type = type;
    
        if (process.env.NODE_ENV !== 'production') {
          if (canDefineProperty) {
            Object.defineProperty(validatedFactory, 'type', {
              enumerable: false,
              get: function () {
                process.env.NODE_ENV !== 'production' ? warning(false, 'Factory.type is deprecated. Access the class directly ' + 'before passing it to createFactory.') : void 0;
                Object.defineProperty(this, 'type', {
                  value: type
                });
                return type;
              }
            });
          }
        }
    
        return validatedFactory;
      },
    
      cloneElement: function (element, props, children) {
        var newElement = ReactElement.cloneElement.apply(this, arguments);
        for (var i = 2; i < arguments.length; i++) {
          validateChildKeys(arguments[i], newElement.type);
        }
        validatePropTypes(newElement);
        return newElement;
      }
    
    };
    
    module.exports = ReactElementValidator;
  provide("react/lib/ReactElementValidator", module.exports);
}(global));

// pakmanager:react/lib/ReactChildren
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactChildren
     */
    
    'use strict';
    
    var PooledClass =  require('react/lib/PooledClass');
    var ReactElement =  require('react/lib/ReactElement');
    
    var emptyFunction = require('fbjs/lib/emptyFunction');
    var traverseAllChildren =  require('react/lib/traverseAllChildren');
    
    var twoArgumentPooler = PooledClass.twoArgumentPooler;
    var fourArgumentPooler = PooledClass.fourArgumentPooler;
    
    var userProvidedKeyEscapeRegex = /\/+/g;
    function escapeUserProvidedKey(text) {
      return ('' + text).replace(userProvidedKeyEscapeRegex, '$&/');
    }
    
    /**
     * PooledClass representing the bookkeeping associated with performing a child
     * traversal. Allows avoiding binding callbacks.
     *
     * @constructor ForEachBookKeeping
     * @param {!function} forEachFunction Function to perform traversal with.
     * @param {?*} forEachContext Context to perform context with.
     */
    function ForEachBookKeeping(forEachFunction, forEachContext) {
      this.func = forEachFunction;
      this.context = forEachContext;
      this.count = 0;
    }
    ForEachBookKeeping.prototype.destructor = function () {
      this.func = null;
      this.context = null;
      this.count = 0;
    };
    PooledClass.addPoolingTo(ForEachBookKeeping, twoArgumentPooler);
    
    function forEachSingleChild(bookKeeping, child, name) {
      var func = bookKeeping.func;
      var context = bookKeeping.context;
    
      func.call(context, child, bookKeeping.count++);
    }
    
    /**
     * Iterates through children that are typically specified as `props.children`.
     *
     * See https://facebook.github.io/react/docs/top-level-api.html#react.children.foreach
     *
     * The provided forEachFunc(child, index) will be called for each
     * leaf child.
     *
     * @param {?*} children Children tree container.
     * @param {function(*, int)} forEachFunc
     * @param {*} forEachContext Context for forEachContext.
     */
    function forEachChildren(children, forEachFunc, forEachContext) {
      if (children == null) {
        return children;
      }
      var traverseContext = ForEachBookKeeping.getPooled(forEachFunc, forEachContext);
      traverseAllChildren(children, forEachSingleChild, traverseContext);
      ForEachBookKeeping.release(traverseContext);
    }
    
    /**
     * PooledClass representing the bookkeeping associated with performing a child
     * mapping. Allows avoiding binding callbacks.
     *
     * @constructor MapBookKeeping
     * @param {!*} mapResult Object containing the ordered map of results.
     * @param {!function} mapFunction Function to perform mapping with.
     * @param {?*} mapContext Context to perform mapping with.
     */
    function MapBookKeeping(mapResult, keyPrefix, mapFunction, mapContext) {
      this.result = mapResult;
      this.keyPrefix = keyPrefix;
      this.func = mapFunction;
      this.context = mapContext;
      this.count = 0;
    }
    MapBookKeeping.prototype.destructor = function () {
      this.result = null;
      this.keyPrefix = null;
      this.func = null;
      this.context = null;
      this.count = 0;
    };
    PooledClass.addPoolingTo(MapBookKeeping, fourArgumentPooler);
    
    function mapSingleChildIntoContext(bookKeeping, child, childKey) {
      var result = bookKeeping.result;
      var keyPrefix = bookKeeping.keyPrefix;
      var func = bookKeeping.func;
      var context = bookKeeping.context;
    
    
      var mappedChild = func.call(context, child, bookKeeping.count++);
      if (Array.isArray(mappedChild)) {
        mapIntoWithKeyPrefixInternal(mappedChild, result, childKey, emptyFunction.thatReturnsArgument);
      } else if (mappedChild != null) {
        if (ReactElement.isValidElement(mappedChild)) {
          mappedChild = ReactElement.cloneAndReplaceKey(mappedChild,
          // Keep both the (mapped) and old keys if they differ, just as
          // traverseAllChildren used to do for objects as children
          keyPrefix + (mappedChild.key && (!child || child.key !== mappedChild.key) ? escapeUserProvidedKey(mappedChild.key) + '/' : '') + childKey);
        }
        result.push(mappedChild);
      }
    }
    
    function mapIntoWithKeyPrefixInternal(children, array, prefix, func, context) {
      var escapedPrefix = '';
      if (prefix != null) {
        escapedPrefix = escapeUserProvidedKey(prefix) + '/';
      }
      var traverseContext = MapBookKeeping.getPooled(array, escapedPrefix, func, context);
      traverseAllChildren(children, mapSingleChildIntoContext, traverseContext);
      MapBookKeeping.release(traverseContext);
    }
    
    /**
     * Maps children that are typically specified as `props.children`.
     *
     * See https://facebook.github.io/react/docs/top-level-api.html#react.children.map
     *
     * The provided mapFunction(child, key, index) will be called for each
     * leaf child.
     *
     * @param {?*} children Children tree container.
     * @param {function(*, int)} func The map function.
     * @param {*} context Context for mapFunction.
     * @return {object} Object containing the ordered map of results.
     */
    function mapChildren(children, func, context) {
      if (children == null) {
        return children;
      }
      var result = [];
      mapIntoWithKeyPrefixInternal(children, result, null, func, context);
      return result;
    }
    
    function forEachSingleChildDummy(traverseContext, child, name) {
      return null;
    }
    
    /**
     * Count the number of children that are typically specified as
     * `props.children`.
     *
     * See https://facebook.github.io/react/docs/top-level-api.html#react.children.count
     *
     * @param {?*} children Children tree container.
     * @return {number} The number of children.
     */
    function countChildren(children, context) {
      return traverseAllChildren(children, forEachSingleChildDummy, null);
    }
    
    /**
     * Flatten a children object (typically specified as `props.children`) and
     * return an array with appropriately re-keyed children.
     *
     * See https://facebook.github.io/react/docs/top-level-api.html#react.children.toarray
     */
    function toArray(children) {
      var result = [];
      mapIntoWithKeyPrefixInternal(children, result, null, emptyFunction.thatReturnsArgument);
      return result;
    }
    
    var ReactChildren = {
      forEach: forEachChildren,
      map: mapChildren,
      mapIntoWithKeyPrefixInternal: mapIntoWithKeyPrefixInternal,
      count: countChildren,
      toArray: toArray
    };
    
    module.exports = ReactChildren;
  provide("react/lib/ReactChildren", module.exports);
}(global));

// pakmanager:react/lib/ReactPureComponent
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactPureComponent
     */
    
    'use strict';
    
    var _assign = require('object-assign');
    
    var ReactComponent =  require('react/lib/ReactComponent');
    var ReactNoopUpdateQueue =  require('react/lib/ReactNoopUpdateQueue');
    
    var emptyObject = require('fbjs/lib/emptyObject');
    
    /**
     * Base class helpers for the updating state of a component.
     */
    function ReactPureComponent(props, context, updater) {
      // Duplicated from ReactComponent.
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      // We initialize the default updater but the real one gets injected by the
      // renderer.
      this.updater = updater || ReactNoopUpdateQueue;
    }
    
    function ComponentDummy() {}
    ComponentDummy.prototype = ReactComponent.prototype;
    ReactPureComponent.prototype = new ComponentDummy();
    ReactPureComponent.prototype.constructor = ReactPureComponent;
    // Avoid an extra prototype jump for these methods.
    _assign(ReactPureComponent.prototype, ReactComponent.prototype);
    ReactPureComponent.prototype.isPureReactComponent = true;
    
    module.exports = ReactPureComponent;
  provide("react/lib/ReactPureComponent", module.exports);
}(global));

// pakmanager:react/lib/ReactClass
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactClass
     */
    
    'use strict';
    
    var _prodInvariant =  require('react/lib/reactProdInvariant'),
        _assign = require('object-assign');
    
    var ReactComponent =  require('react/lib/ReactComponent');
    var ReactElement =  require('react/lib/ReactElement');
    var ReactPropTypeLocations =  require('react/lib/ReactPropTypeLocations');
    var ReactPropTypeLocationNames =  require('react/lib/ReactPropTypeLocationNames');
    var ReactNoopUpdateQueue =  require('react/lib/ReactNoopUpdateQueue');
    
    var emptyObject = require('fbjs/lib/emptyObject');
    var invariant = require('fbjs/lib/invariant');
    var keyMirror = require('fbjs/lib/keyMirror');
    var keyOf = require('fbjs/lib/keyOf');
    var warning = require('fbjs/lib/warning');
    
    var MIXINS_KEY = keyOf({ mixins: null });
    
    /**
     * Policies that describe methods in `ReactClassInterface`.
     */
    var SpecPolicy = keyMirror({
      /**
       * These methods may be defined only once by the class specification or mixin.
       */
      DEFINE_ONCE: null,
      /**
       * These methods may be defined by both the class specification and mixins.
       * Subsequent definitions will be chained. These methods must return void.
       */
      DEFINE_MANY: null,
      /**
       * These methods are overriding the base class.
       */
      OVERRIDE_BASE: null,
      /**
       * These methods are similar to DEFINE_MANY, except we assume they return
       * objects. We try to merge the keys of the return values of all the mixed in
       * functions. If there is a key conflict we throw.
       */
      DEFINE_MANY_MERGED: null
    });
    
    var injectedMixins = [];
    
    /**
     * Composite components are higher-level components that compose other composite
     * or host components.
     *
     * To create a new type of `ReactClass`, pass a specification of
     * your new class to `React.createClass`. The only requirement of your class
     * specification is that you implement a `render` method.
     *
     *   var MyComponent = React.createClass({
     *     render: function() {
     *       return <div>Hello World</div>;
     *     }
     *   });
     *
     * The class specification supports a specific protocol of methods that have
     * special meaning (e.g. `render`). See `ReactClassInterface` for
     * more the comprehensive protocol. Any other properties and methods in the
     * class specification will be available on the prototype.
     *
     * @interface ReactClassInterface
     * @internal
     */
    var ReactClassInterface = {
    
      /**
       * An array of Mixin objects to include when defining your component.
       *
       * @type {array}
       * @optional
       */
      mixins: SpecPolicy.DEFINE_MANY,
    
      /**
       * An object containing properties and methods that should be defined on
       * the component's constructor instead of its prototype (static methods).
       *
       * @type {object}
       * @optional
       */
      statics: SpecPolicy.DEFINE_MANY,
    
      /**
       * Definition of prop types for this component.
       *
       * @type {object}
       * @optional
       */
      propTypes: SpecPolicy.DEFINE_MANY,
    
      /**
       * Definition of context types for this component.
       *
       * @type {object}
       * @optional
       */
      contextTypes: SpecPolicy.DEFINE_MANY,
    
      /**
       * Definition of context types this component sets for its children.
       *
       * @type {object}
       * @optional
       */
      childContextTypes: SpecPolicy.DEFINE_MANY,
    
      // ==== Definition methods ====
    
      /**
       * Invoked when the component is mounted. Values in the mapping will be set on
       * `this.props` if that prop is not specified (i.e. using an `in` check).
       *
       * This method is invoked before `getInitialState` and therefore cannot rely
       * on `this.state` or use `this.setState`.
       *
       * @return {object}
       * @optional
       */
      getDefaultProps: SpecPolicy.DEFINE_MANY_MERGED,
    
      /**
       * Invoked once before the component is mounted. The return value will be used
       * as the initial value of `this.state`.
       *
       *   getInitialState: function() {
       *     return {
       *       isOn: false,
       *       fooBaz: new BazFoo()
       *     }
       *   }
       *
       * @return {object}
       * @optional
       */
      getInitialState: SpecPolicy.DEFINE_MANY_MERGED,
    
      /**
       * @return {object}
       * @optional
       */
      getChildContext: SpecPolicy.DEFINE_MANY_MERGED,
    
      /**
       * Uses props from `this.props` and state from `this.state` to render the
       * structure of the component.
       *
       * No guarantees are made about when or how often this method is invoked, so
       * it must not have side effects.
       *
       *   render: function() {
       *     var name = this.props.name;
       *     return <div>Hello, {name}!</div>;
       *   }
       *
       * @return {ReactComponent}
       * @nosideeffects
       * @required
       */
      render: SpecPolicy.DEFINE_ONCE,
    
      // ==== Delegate methods ====
    
      /**
       * Invoked when the component is initially created and about to be mounted.
       * This may have side effects, but any external subscriptions or data created
       * by this method must be cleaned up in `componentWillUnmount`.
       *
       * @optional
       */
      componentWillMount: SpecPolicy.DEFINE_MANY,
    
      /**
       * Invoked when the component has been mounted and has a DOM representation.
       * However, there is no guarantee that the DOM node is in the document.
       *
       * Use this as an opportunity to operate on the DOM when the component has
       * been mounted (initialized and rendered) for the first time.
       *
       * @param {DOMElement} rootNode DOM element representing the component.
       * @optional
       */
      componentDidMount: SpecPolicy.DEFINE_MANY,
    
      /**
       * Invoked before the component receives new props.
       *
       * Use this as an opportunity to react to a prop transition by updating the
       * state using `this.setState`. Current props are accessed via `this.props`.
       *
       *   componentWillReceiveProps: function(nextProps, nextContext) {
       *     this.setState({
       *       likesIncreasing: nextProps.likeCount > this.props.likeCount
       *     });
       *   }
       *
       * NOTE: There is no equivalent `componentWillReceiveState`. An incoming prop
       * transition may cause a state change, but the opposite is not true. If you
       * need it, you are probably looking for `componentWillUpdate`.
       *
       * @param {object} nextProps
       * @optional
       */
      componentWillReceiveProps: SpecPolicy.DEFINE_MANY,
    
      /**
       * Invoked while deciding if the component should be updated as a result of
       * receiving new props, state and/or context.
       *
       * Use this as an opportunity to `return false` when you're certain that the
       * transition to the new props/state/context will not require a component
       * update.
       *
       *   shouldComponentUpdate: function(nextProps, nextState, nextContext) {
       *     return !equal(nextProps, this.props) ||
       *       !equal(nextState, this.state) ||
       *       !equal(nextContext, this.context);
       *   }
       *
       * @param {object} nextProps
       * @param {?object} nextState
       * @param {?object} nextContext
       * @return {boolean} True if the component should update.
       * @optional
       */
      shouldComponentUpdate: SpecPolicy.DEFINE_ONCE,
    
      /**
       * Invoked when the component is about to update due to a transition from
       * `this.props`, `this.state` and `this.context` to `nextProps`, `nextState`
       * and `nextContext`.
       *
       * Use this as an opportunity to perform preparation before an update occurs.
       *
       * NOTE: You **cannot** use `this.setState()` in this method.
       *
       * @param {object} nextProps
       * @param {?object} nextState
       * @param {?object} nextContext
       * @param {ReactReconcileTransaction} transaction
       * @optional
       */
      componentWillUpdate: SpecPolicy.DEFINE_MANY,
    
      /**
       * Invoked when the component's DOM representation has been updated.
       *
       * Use this as an opportunity to operate on the DOM when the component has
       * been updated.
       *
       * @param {object} prevProps
       * @param {?object} prevState
       * @param {?object} prevContext
       * @param {DOMElement} rootNode DOM element representing the component.
       * @optional
       */
      componentDidUpdate: SpecPolicy.DEFINE_MANY,
    
      /**
       * Invoked when the component is about to be removed from its parent and have
       * its DOM representation destroyed.
       *
       * Use this as an opportunity to deallocate any external resources.
       *
       * NOTE: There is no `componentDidUnmount` since your component will have been
       * destroyed by that point.
       *
       * @optional
       */
      componentWillUnmount: SpecPolicy.DEFINE_MANY,
    
      // ==== Advanced methods ====
    
      /**
       * Updates the component's currently mounted DOM representation.
       *
       * By default, this implements React's rendering and reconciliation algorithm.
       * Sophisticated clients may wish to override this.
       *
       * @param {ReactReconcileTransaction} transaction
       * @internal
       * @overridable
       */
      updateComponent: SpecPolicy.OVERRIDE_BASE
    
    };
    
    /**
     * Mapping from class specification keys to special processing functions.
     *
     * Although these are declared like instance properties in the specification
     * when defining classes using `React.createClass`, they are actually static
     * and are accessible on the constructor instead of the prototype. Despite
     * being static, they must be defined outside of the "statics" key under
     * which all other static methods are defined.
     */
    var RESERVED_SPEC_KEYS = {
      displayName: function (Constructor, displayName) {
        Constructor.displayName = displayName;
      },
      mixins: function (Constructor, mixins) {
        if (mixins) {
          for (var i = 0; i < mixins.length; i++) {
            mixSpecIntoComponent(Constructor, mixins[i]);
          }
        }
      },
      childContextTypes: function (Constructor, childContextTypes) {
        if (process.env.NODE_ENV !== 'production') {
          validateTypeDef(Constructor, childContextTypes, ReactPropTypeLocations.childContext);
        }
        Constructor.childContextTypes = _assign({}, Constructor.childContextTypes, childContextTypes);
      },
      contextTypes: function (Constructor, contextTypes) {
        if (process.env.NODE_ENV !== 'production') {
          validateTypeDef(Constructor, contextTypes, ReactPropTypeLocations.context);
        }
        Constructor.contextTypes = _assign({}, Constructor.contextTypes, contextTypes);
      },
      /**
       * Special case getDefaultProps which should move into statics but requires
       * automatic merging.
       */
      getDefaultProps: function (Constructor, getDefaultProps) {
        if (Constructor.getDefaultProps) {
          Constructor.getDefaultProps = createMergedResultFunction(Constructor.getDefaultProps, getDefaultProps);
        } else {
          Constructor.getDefaultProps = getDefaultProps;
        }
      },
      propTypes: function (Constructor, propTypes) {
        if (process.env.NODE_ENV !== 'production') {
          validateTypeDef(Constructor, propTypes, ReactPropTypeLocations.prop);
        }
        Constructor.propTypes = _assign({}, Constructor.propTypes, propTypes);
      },
      statics: function (Constructor, statics) {
        mixStaticSpecIntoComponent(Constructor, statics);
      },
      autobind: function () {} };
    
    // noop
    function validateTypeDef(Constructor, typeDef, location) {
      for (var propName in typeDef) {
        if (typeDef.hasOwnProperty(propName)) {
          // use a warning instead of an invariant so components
          // don't show up in prod but only in __DEV__
          process.env.NODE_ENV !== 'production' ? warning(typeof typeDef[propName] === 'function', '%s: %s type `%s` is invalid; it must be a function, usually from ' + 'React.PropTypes.', Constructor.displayName || 'ReactClass', ReactPropTypeLocationNames[location], propName) : void 0;
        }
      }
    }
    
    function validateMethodOverride(isAlreadyDefined, name) {
      var specPolicy = ReactClassInterface.hasOwnProperty(name) ? ReactClassInterface[name] : null;
    
      // Disallow overriding of base class methods unless explicitly allowed.
      if (ReactClassMixin.hasOwnProperty(name)) {
        !(specPolicy === SpecPolicy.OVERRIDE_BASE) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactClassInterface: You are attempting to override `%s` from your class specification. Ensure that your method names do not overlap with React methods.', name) : _prodInvariant('73', name) : void 0;
      }
    
      // Disallow defining methods more than once unless explicitly allowed.
      if (isAlreadyDefined) {
        !(specPolicy === SpecPolicy.DEFINE_MANY || specPolicy === SpecPolicy.DEFINE_MANY_MERGED) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactClassInterface: You are attempting to define `%s` on your component more than once. This conflict may be due to a mixin.', name) : _prodInvariant('74', name) : void 0;
      }
    }
    
    /**
     * Mixin helper which handles policy validation and reserved
     * specification keys when building React classes.
     */
    function mixSpecIntoComponent(Constructor, spec) {
      if (!spec) {
        if (process.env.NODE_ENV !== 'production') {
          var typeofSpec = typeof spec;
          var isMixinValid = typeofSpec === 'object' && spec !== null;
    
          process.env.NODE_ENV !== 'production' ? warning(isMixinValid, '%s: You\'re attempting to include a mixin that is either null ' + 'or not an object. Check the mixins included by the component, ' + 'as well as any mixins they include themselves. ' + 'Expected object but got %s.', Constructor.displayName || 'ReactClass', spec === null ? null : typeofSpec) : void 0;
        }
    
        return;
      }
    
      !(typeof spec !== 'function') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactClass: You\'re attempting to use a component class or function as a mixin. Instead, just use a regular object.') : _prodInvariant('75') : void 0;
      !!ReactElement.isValidElement(spec) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactClass: You\'re attempting to use a component as a mixin. Instead, just use a regular object.') : _prodInvariant('76') : void 0;
    
      var proto = Constructor.prototype;
      var autoBindPairs = proto.__reactAutoBindPairs;
    
      // By handling mixins before any other properties, we ensure the same
      // chaining order is applied to methods with DEFINE_MANY policy, whether
      // mixins are listed before or after these methods in the spec.
      if (spec.hasOwnProperty(MIXINS_KEY)) {
        RESERVED_SPEC_KEYS.mixins(Constructor, spec.mixins);
      }
    
      for (var name in spec) {
        if (!spec.hasOwnProperty(name)) {
          continue;
        }
    
        if (name === MIXINS_KEY) {
          // We have already handled mixins in a special case above.
          continue;
        }
    
        var property = spec[name];
        var isAlreadyDefined = proto.hasOwnProperty(name);
        validateMethodOverride(isAlreadyDefined, name);
    
        if (RESERVED_SPEC_KEYS.hasOwnProperty(name)) {
          RESERVED_SPEC_KEYS[name](Constructor, property);
        } else {
          // Setup methods on prototype:
          // The following member methods should not be automatically bound:
          // 1. Expected ReactClass methods (in the "interface").
          // 2. Overridden methods (that were mixed in).
          var isReactClassMethod = ReactClassInterface.hasOwnProperty(name);
          var isFunction = typeof property === 'function';
          var shouldAutoBind = isFunction && !isReactClassMethod && !isAlreadyDefined && spec.autobind !== false;
    
          if (shouldAutoBind) {
            autoBindPairs.push(name, property);
            proto[name] = property;
          } else {
            if (isAlreadyDefined) {
              var specPolicy = ReactClassInterface[name];
    
              // These cases should already be caught by validateMethodOverride.
              !(isReactClassMethod && (specPolicy === SpecPolicy.DEFINE_MANY_MERGED || specPolicy === SpecPolicy.DEFINE_MANY)) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactClass: Unexpected spec policy %s for key %s when mixing in component specs.', specPolicy, name) : _prodInvariant('77', specPolicy, name) : void 0;
    
              // For methods which are defined more than once, call the existing
              // methods before calling the new property, merging if appropriate.
              if (specPolicy === SpecPolicy.DEFINE_MANY_MERGED) {
                proto[name] = createMergedResultFunction(proto[name], property);
              } else if (specPolicy === SpecPolicy.DEFINE_MANY) {
                proto[name] = createChainedFunction(proto[name], property);
              }
            } else {
              proto[name] = property;
              if (process.env.NODE_ENV !== 'production') {
                // Add verbose displayName to the function, which helps when looking
                // at profiling tools.
                if (typeof property === 'function' && spec.displayName) {
                  proto[name].displayName = spec.displayName + '_' + name;
                }
              }
            }
          }
        }
      }
    }
    
    function mixStaticSpecIntoComponent(Constructor, statics) {
      if (!statics) {
        return;
      }
      for (var name in statics) {
        var property = statics[name];
        if (!statics.hasOwnProperty(name)) {
          continue;
        }
    
        var isReserved = name in RESERVED_SPEC_KEYS;
        !!isReserved ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactClass: You are attempting to define a reserved property, `%s`, that shouldn\'t be on the "statics" key. Define it as an instance property instead; it will still be accessible on the constructor.', name) : _prodInvariant('78', name) : void 0;
    
        var isInherited = name in Constructor;
        !!isInherited ? process.env.NODE_ENV !== 'production' ? invariant(false, 'ReactClass: You are attempting to define `%s` on your component more than once. This conflict may be due to a mixin.', name) : _prodInvariant('79', name) : void 0;
        Constructor[name] = property;
      }
    }
    
    /**
     * Merge two objects, but throw if both contain the same key.
     *
     * @param {object} one The first object, which is mutated.
     * @param {object} two The second object
     * @return {object} one after it has been mutated to contain everything in two.
     */
    function mergeIntoWithNoDuplicateKeys(one, two) {
      !(one && two && typeof one === 'object' && typeof two === 'object') ? process.env.NODE_ENV !== 'production' ? invariant(false, 'mergeIntoWithNoDuplicateKeys(): Cannot merge non-objects.') : _prodInvariant('80') : void 0;
    
      for (var key in two) {
        if (two.hasOwnProperty(key)) {
          !(one[key] === undefined) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'mergeIntoWithNoDuplicateKeys(): Tried to merge two objects with the same key: `%s`. This conflict may be due to a mixin; in particular, this may be caused by two getInitialState() or getDefaultProps() methods returning objects with clashing keys.', key) : _prodInvariant('81', key) : void 0;
          one[key] = two[key];
        }
      }
      return one;
    }
    
    /**
     * Creates a function that invokes two functions and merges their return values.
     *
     * @param {function} one Function to invoke first.
     * @param {function} two Function to invoke second.
     * @return {function} Function that invokes the two argument functions.
     * @private
     */
    function createMergedResultFunction(one, two) {
      return function mergedResult() {
        var a = one.apply(this, arguments);
        var b = two.apply(this, arguments);
        if (a == null) {
          return b;
        } else if (b == null) {
          return a;
        }
        var c = {};
        mergeIntoWithNoDuplicateKeys(c, a);
        mergeIntoWithNoDuplicateKeys(c, b);
        return c;
      };
    }
    
    /**
     * Creates a function that invokes two functions and ignores their return vales.
     *
     * @param {function} one Function to invoke first.
     * @param {function} two Function to invoke second.
     * @return {function} Function that invokes the two argument functions.
     * @private
     */
    function createChainedFunction(one, two) {
      return function chainedFunction() {
        one.apply(this, arguments);
        two.apply(this, arguments);
      };
    }
    
    /**
     * Binds a method to the component.
     *
     * @param {object} component Component whose method is going to be bound.
     * @param {function} method Method to be bound.
     * @return {function} The bound method.
     */
    function bindAutoBindMethod(component, method) {
      var boundMethod = method.bind(component);
      if (process.env.NODE_ENV !== 'production') {
        boundMethod.__reactBoundContext = component;
        boundMethod.__reactBoundMethod = method;
        boundMethod.__reactBoundArguments = null;
        var componentName = component.constructor.displayName;
        var _bind = boundMethod.bind;
        boundMethod.bind = function (newThis) {
          for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
            args[_key - 1] = arguments[_key];
          }
    
          // User is trying to bind() an autobound method; we effectively will
          // ignore the value of "this" that the user is trying to use, so
          // let's warn.
          if (newThis !== component && newThis !== null) {
            process.env.NODE_ENV !== 'production' ? warning(false, 'bind(): React component methods may only be bound to the ' + 'component instance. See %s', componentName) : void 0;
          } else if (!args.length) {
            process.env.NODE_ENV !== 'production' ? warning(false, 'bind(): You are binding a component method to the component. ' + 'React does this for you automatically in a high-performance ' + 'way, so you can safely remove this call. See %s', componentName) : void 0;
            return boundMethod;
          }
          var reboundMethod = _bind.apply(boundMethod, arguments);
          reboundMethod.__reactBoundContext = component;
          reboundMethod.__reactBoundMethod = method;
          reboundMethod.__reactBoundArguments = args;
          return reboundMethod;
        };
      }
      return boundMethod;
    }
    
    /**
     * Binds all auto-bound methods in a component.
     *
     * @param {object} component Component whose method is going to be bound.
     */
    function bindAutoBindMethods(component) {
      var pairs = component.__reactAutoBindPairs;
      for (var i = 0; i < pairs.length; i += 2) {
        var autoBindKey = pairs[i];
        var method = pairs[i + 1];
        component[autoBindKey] = bindAutoBindMethod(component, method);
      }
    }
    
    /**
     * Add more to the ReactClass base class. These are all legacy features and
     * therefore not already part of the modern ReactComponent.
     */
    var ReactClassMixin = {
    
      /**
       * TODO: This will be deprecated because state should always keep a consistent
       * type signature and the only use case for this, is to avoid that.
       */
      replaceState: function (newState, callback) {
        this.updater.enqueueReplaceState(this, newState);
        if (callback) {
          this.updater.enqueueCallback(this, callback, 'replaceState');
        }
      },
    
      /**
       * Checks whether or not this composite component is mounted.
       * @return {boolean} True if mounted, false otherwise.
       * @protected
       * @final
       */
      isMounted: function () {
        return this.updater.isMounted(this);
      }
    };
    
    var ReactClassComponent = function () {};
    _assign(ReactClassComponent.prototype, ReactComponent.prototype, ReactClassMixin);
    
    /**
     * Module for creating composite components.
     *
     * @class ReactClass
     */
    var ReactClass = {
    
      /**
       * Creates a composite component class given a class specification.
       * See https://facebook.github.io/react/docs/top-level-api.html#react.createclass
       *
       * @param {object} spec Class specification (which must define `render`).
       * @return {function} Component constructor function.
       * @public
       */
      createClass: function (spec) {
        var Constructor = function (props, context, updater) {
          // This constructor gets overridden by mocks. The argument is used
          // by mocks to assert on what gets mounted.
    
          if (process.env.NODE_ENV !== 'production') {
            process.env.NODE_ENV !== 'production' ? warning(this instanceof Constructor, 'Something is calling a React component directly. Use a factory or ' + 'JSX instead. See: https://fb.me/react-legacyfactory') : void 0;
          }
    
          // Wire up auto-binding
          if (this.__reactAutoBindPairs.length) {
            bindAutoBindMethods(this);
          }
    
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
    
          this.state = null;
    
          // ReactClasses doesn't have constructors. Instead, they use the
          // getInitialState and componentWillMount methods for initialization.
    
          var initialState = this.getInitialState ? this.getInitialState() : null;
          if (process.env.NODE_ENV !== 'production') {
            // We allow auto-mocks to proceed as if they're returning null.
            if (initialState === undefined && this.getInitialState._isMockFunction) {
              // This is probably bad practice. Consider warning here and
              // deprecating this convenience.
              initialState = null;
            }
          }
          !(typeof initialState === 'object' && !Array.isArray(initialState)) ? process.env.NODE_ENV !== 'production' ? invariant(false, '%s.getInitialState(): must return an object or null', Constructor.displayName || 'ReactCompositeComponent') : _prodInvariant('82', Constructor.displayName || 'ReactCompositeComponent') : void 0;
    
          this.state = initialState;
        };
        Constructor.prototype = new ReactClassComponent();
        Constructor.prototype.constructor = Constructor;
        Constructor.prototype.__reactAutoBindPairs = [];
    
        injectedMixins.forEach(mixSpecIntoComponent.bind(null, Constructor));
    
        mixSpecIntoComponent(Constructor, spec);
    
        // Initialize the defaultProps property after all mixins have been merged.
        if (Constructor.getDefaultProps) {
          Constructor.defaultProps = Constructor.getDefaultProps();
        }
    
        if (process.env.NODE_ENV !== 'production') {
          // This is a tag to indicate that the use of these method names is ok,
          // since it's used with createClass. If it's not, then it's likely a
          // mistake so we'll warn you to use the static property, property
          // initializer or constructor respectively.
          if (Constructor.getDefaultProps) {
            Constructor.getDefaultProps.isReactClassApproved = {};
          }
          if (Constructor.prototype.getInitialState) {
            Constructor.prototype.getInitialState.isReactClassApproved = {};
          }
        }
    
        !Constructor.prototype.render ? process.env.NODE_ENV !== 'production' ? invariant(false, 'createClass(...): Class specification must implement a `render` method.') : _prodInvariant('83') : void 0;
    
        if (process.env.NODE_ENV !== 'production') {
          process.env.NODE_ENV !== 'production' ? warning(!Constructor.prototype.componentShouldUpdate, '%s has a method called ' + 'componentShouldUpdate(). Did you mean shouldComponentUpdate()? ' + 'The name is phrased as a question because the function is ' + 'expected to return a value.', spec.displayName || 'A component') : void 0;
          process.env.NODE_ENV !== 'production' ? warning(!Constructor.prototype.componentWillRecieveProps, '%s has a method called ' + 'componentWillRecieveProps(). Did you mean componentWillReceiveProps()?', spec.displayName || 'A component') : void 0;
        }
    
        // Reduce time spent doing lookups by setting these on the prototype.
        for (var methodName in ReactClassInterface) {
          if (!Constructor.prototype[methodName]) {
            Constructor.prototype[methodName] = null;
          }
        }
    
        return Constructor;
      },
    
      injection: {
        injectMixin: function (mixin) {
          injectedMixins.push(mixin);
        }
      }
    
    };
    
    module.exports = ReactClass;
  provide("react/lib/ReactClass", module.exports);
}(global));

// pakmanager:react/lib/ReactDOMFactories
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactDOMFactories
     */
    
    'use strict';
    
    var ReactElement =  require('react/lib/ReactElement');
    
    /**
     * Create a factory that creates HTML tag elements.
     *
     * @private
     */
    var createDOMFactory = ReactElement.createFactory;
    if (process.env.NODE_ENV !== 'production') {
      var ReactElementValidator =  require('react/lib/ReactElementValidator');
      createDOMFactory = ReactElementValidator.createFactory;
    }
    
    /**
     * Creates a mapping from supported HTML tags to `ReactDOMComponent` classes.
     * This is also accessible via `React.DOM`.
     *
     * @public
     */
    var ReactDOMFactories = {
      a: createDOMFactory('a'),
      abbr: createDOMFactory('abbr'),
      address: createDOMFactory('address'),
      area: createDOMFactory('area'),
      article: createDOMFactory('article'),
      aside: createDOMFactory('aside'),
      audio: createDOMFactory('audio'),
      b: createDOMFactory('b'),
      base: createDOMFactory('base'),
      bdi: createDOMFactory('bdi'),
      bdo: createDOMFactory('bdo'),
      big: createDOMFactory('big'),
      blockquote: createDOMFactory('blockquote'),
      body: createDOMFactory('body'),
      br: createDOMFactory('br'),
      button: createDOMFactory('button'),
      canvas: createDOMFactory('canvas'),
      caption: createDOMFactory('caption'),
      cite: createDOMFactory('cite'),
      code: createDOMFactory('code'),
      col: createDOMFactory('col'),
      colgroup: createDOMFactory('colgroup'),
      data: createDOMFactory('data'),
      datalist: createDOMFactory('datalist'),
      dd: createDOMFactory('dd'),
      del: createDOMFactory('del'),
      details: createDOMFactory('details'),
      dfn: createDOMFactory('dfn'),
      dialog: createDOMFactory('dialog'),
      div: createDOMFactory('div'),
      dl: createDOMFactory('dl'),
      dt: createDOMFactory('dt'),
      em: createDOMFactory('em'),
      embed: createDOMFactory('embed'),
      fieldset: createDOMFactory('fieldset'),
      figcaption: createDOMFactory('figcaption'),
      figure: createDOMFactory('figure'),
      footer: createDOMFactory('footer'),
      form: createDOMFactory('form'),
      h1: createDOMFactory('h1'),
      h2: createDOMFactory('h2'),
      h3: createDOMFactory('h3'),
      h4: createDOMFactory('h4'),
      h5: createDOMFactory('h5'),
      h6: createDOMFactory('h6'),
      head: createDOMFactory('head'),
      header: createDOMFactory('header'),
      hgroup: createDOMFactory('hgroup'),
      hr: createDOMFactory('hr'),
      html: createDOMFactory('html'),
      i: createDOMFactory('i'),
      iframe: createDOMFactory('iframe'),
      img: createDOMFactory('img'),
      input: createDOMFactory('input'),
      ins: createDOMFactory('ins'),
      kbd: createDOMFactory('kbd'),
      keygen: createDOMFactory('keygen'),
      label: createDOMFactory('label'),
      legend: createDOMFactory('legend'),
      li: createDOMFactory('li'),
      link: createDOMFactory('link'),
      main: createDOMFactory('main'),
      map: createDOMFactory('map'),
      mark: createDOMFactory('mark'),
      menu: createDOMFactory('menu'),
      menuitem: createDOMFactory('menuitem'),
      meta: createDOMFactory('meta'),
      meter: createDOMFactory('meter'),
      nav: createDOMFactory('nav'),
      noscript: createDOMFactory('noscript'),
      object: createDOMFactory('object'),
      ol: createDOMFactory('ol'),
      optgroup: createDOMFactory('optgroup'),
      option: createDOMFactory('option'),
      output: createDOMFactory('output'),
      p: createDOMFactory('p'),
      param: createDOMFactory('param'),
      picture: createDOMFactory('picture'),
      pre: createDOMFactory('pre'),
      progress: createDOMFactory('progress'),
      q: createDOMFactory('q'),
      rp: createDOMFactory('rp'),
      rt: createDOMFactory('rt'),
      ruby: createDOMFactory('ruby'),
      s: createDOMFactory('s'),
      samp: createDOMFactory('samp'),
      script: createDOMFactory('script'),
      section: createDOMFactory('section'),
      select: createDOMFactory('select'),
      small: createDOMFactory('small'),
      source: createDOMFactory('source'),
      span: createDOMFactory('span'),
      strong: createDOMFactory('strong'),
      style: createDOMFactory('style'),
      sub: createDOMFactory('sub'),
      summary: createDOMFactory('summary'),
      sup: createDOMFactory('sup'),
      table: createDOMFactory('table'),
      tbody: createDOMFactory('tbody'),
      td: createDOMFactory('td'),
      textarea: createDOMFactory('textarea'),
      tfoot: createDOMFactory('tfoot'),
      th: createDOMFactory('th'),
      thead: createDOMFactory('thead'),
      time: createDOMFactory('time'),
      title: createDOMFactory('title'),
      tr: createDOMFactory('tr'),
      track: createDOMFactory('track'),
      u: createDOMFactory('u'),
      ul: createDOMFactory('ul'),
      'var': createDOMFactory('var'),
      video: createDOMFactory('video'),
      wbr: createDOMFactory('wbr'),
    
      // SVG
      circle: createDOMFactory('circle'),
      clipPath: createDOMFactory('clipPath'),
      defs: createDOMFactory('defs'),
      ellipse: createDOMFactory('ellipse'),
      g: createDOMFactory('g'),
      image: createDOMFactory('image'),
      line: createDOMFactory('line'),
      linearGradient: createDOMFactory('linearGradient'),
      mask: createDOMFactory('mask'),
      path: createDOMFactory('path'),
      pattern: createDOMFactory('pattern'),
      polygon: createDOMFactory('polygon'),
      polyline: createDOMFactory('polyline'),
      radialGradient: createDOMFactory('radialGradient'),
      rect: createDOMFactory('rect'),
      stop: createDOMFactory('stop'),
      svg: createDOMFactory('svg'),
      text: createDOMFactory('text'),
      tspan: createDOMFactory('tspan')
    };
    
    module.exports = ReactDOMFactories;
  provide("react/lib/ReactDOMFactories", module.exports);
}(global));

// pakmanager:react/lib/ReactPropTypes
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactPropTypes
     */
    
    'use strict';
    
    var ReactElement =  require('react/lib/ReactElement');
    var ReactPropTypeLocationNames =  require('react/lib/ReactPropTypeLocationNames');
    var ReactPropTypesSecret =  require('react/lib/ReactPropTypesSecret');
    
    var emptyFunction = require('fbjs/lib/emptyFunction');
    var getIteratorFn =  require('react/lib/getIteratorFn');
    var warning = require('fbjs/lib/warning');
    
    /**
     * Collection of methods that allow declaration and validation of props that are
     * supplied to React components. Example usage:
     *
     *   var Props = require('ReactPropTypes');
     *   var MyArticle = React.createClass({
     *     propTypes: {
     *       // An optional string prop named "description".
     *       description: Props.string,
     *
     *       // A required enum prop named "category".
     *       category: Props.oneOf(['News','Photos']).isRequired,
     *
     *       // A prop named "dialog" that requires an instance of Dialog.
     *       dialog: Props.instanceOf(Dialog).isRequired
     *     },
     *     render: function() { ... }
     *   });
     *
     * A more formal specification of how these methods are used:
     *
     *   type := array|bool|func|object|number|string|oneOf([...])|instanceOf(...)
     *   decl := ReactPropTypes.{type}(.isRequired)?
     *
     * Each and every declaration produces a function with the same signature. This
     * allows the creation of custom validation functions. For example:
     *
     *  var MyLink = React.createClass({
     *    propTypes: {
     *      // An optional string or URI prop named "href".
     *      href: function(props, propName, componentName) {
     *        var propValue = props[propName];
     *        if (propValue != null && typeof propValue !== 'string' &&
     *            !(propValue instanceof URI)) {
     *          return new Error(
     *            'Expected a string or an URI for ' + propName + ' in ' +
     *            componentName
     *          );
     *        }
     *      }
     *    },
     *    render: function() {...}
     *  });
     *
     * @internal
     */
    
    var ANONYMOUS = '<<anonymous>>';
    
    var ReactPropTypes = {
      array: createPrimitiveTypeChecker('array'),
      bool: createPrimitiveTypeChecker('boolean'),
      func: createPrimitiveTypeChecker('function'),
      number: createPrimitiveTypeChecker('number'),
      object: createPrimitiveTypeChecker('object'),
      string: createPrimitiveTypeChecker('string'),
      symbol: createPrimitiveTypeChecker('symbol'),
    
      any: createAnyTypeChecker(),
      arrayOf: createArrayOfTypeChecker,
      element: createElementTypeChecker(),
      instanceOf: createInstanceTypeChecker,
      node: createNodeChecker(),
      objectOf: createObjectOfTypeChecker,
      oneOf: createEnumTypeChecker,
      oneOfType: createUnionTypeChecker,
      shape: createShapeTypeChecker
    };
    
    /**
     * inlined Object.is polyfill to avoid requiring consumers ship their own
     * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
     */
    /*eslint-disable no-self-compare*/
    function is(x, y) {
      // SameValue algorithm
      if (x === y) {
        // Steps 1-5, 7-10
        // Steps 6.b-6.e: +0 != -0
        return x !== 0 || 1 / x === 1 / y;
      } else {
        // Step 6.a: NaN == NaN
        return x !== x && y !== y;
      }
    }
    /*eslint-enable no-self-compare*/
    
    /**
     * We use an Error-like object for backward compatibility as people may call
     * PropTypes directly and inspect their output. However we don't use real
     * Errors anymore. We don't inspect their stack anyway, and creating them
     * is prohibitively expensive if they are created too often, such as what
     * happens in oneOfType() for any type before the one that matched.
     */
    function PropTypeError(message) {
      this.message = message;
      this.stack = '';
    }
    // Make `instanceof Error` still work for returned errors.
    PropTypeError.prototype = Error.prototype;
    
    function createChainableTypeChecker(validate) {
      if (process.env.NODE_ENV !== 'production') {
        var manualPropTypeCallCache = {};
      }
      function checkType(isRequired, props, propName, componentName, location, propFullName, secret) {
        componentName = componentName || ANONYMOUS;
        propFullName = propFullName || propName;
        if (process.env.NODE_ENV !== 'production') {
          if (secret !== ReactPropTypesSecret && typeof console !== 'undefined') {
            var cacheKey = componentName + ':' + propName;
            if (!manualPropTypeCallCache[cacheKey]) {
              process.env.NODE_ENV !== 'production' ? warning(false, 'You are manually calling a React.PropTypes validation ' + 'function for the `%s` prop on `%s`. This is deprecated ' + 'and will not work in the next major version. You may be ' + 'seeing this warning due to a third-party PropTypes library. ' + 'See https://fb.me/react-warning-dont-call-proptypes for details.', propFullName, componentName) : void 0;
              manualPropTypeCallCache[cacheKey] = true;
            }
          }
        }
        if (props[propName] == null) {
          var locationName = ReactPropTypeLocationNames[location];
          if (isRequired) {
            return new PropTypeError('Required ' + locationName + ' `' + propFullName + '` was not specified in ' + ('`' + componentName + '`.'));
          }
          return null;
        } else {
          return validate(props, propName, componentName, location, propFullName);
        }
      }
    
      var chainedCheckType = checkType.bind(null, false);
      chainedCheckType.isRequired = checkType.bind(null, true);
    
      return chainedCheckType;
    }
    
    function createPrimitiveTypeChecker(expectedType) {
      function validate(props, propName, componentName, location, propFullName, secret) {
        var propValue = props[propName];
        var propType = getPropType(propValue);
        if (propType !== expectedType) {
          var locationName = ReactPropTypeLocationNames[location];
          // `propValue` being instance of, say, date/regexp, pass the 'object'
          // check, but we can offer a more precise error message here rather than
          // 'of type `object`'.
          var preciseType = getPreciseType(propValue);
    
          return new PropTypeError('Invalid ' + locationName + ' `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedType + '`.'));
        }
        return null;
      }
      return createChainableTypeChecker(validate);
    }
    
    function createAnyTypeChecker() {
      return createChainableTypeChecker(emptyFunction.thatReturns(null));
    }
    
    function createArrayOfTypeChecker(typeChecker) {
      function validate(props, propName, componentName, location, propFullName) {
        if (typeof typeChecker !== 'function') {
          return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside arrayOf.');
        }
        var propValue = props[propName];
        if (!Array.isArray(propValue)) {
          var locationName = ReactPropTypeLocationNames[location];
          var propType = getPropType(propValue);
          return new PropTypeError('Invalid ' + locationName + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));
        }
        for (var i = 0; i < propValue.length; i++) {
          var error = typeChecker(propValue, i, componentName, location, propFullName + '[' + i + ']', ReactPropTypesSecret);
          if (error instanceof Error) {
            return error;
          }
        }
        return null;
      }
      return createChainableTypeChecker(validate);
    }
    
    function createElementTypeChecker() {
      function validate(props, propName, componentName, location, propFullName) {
        var propValue = props[propName];
        if (!ReactElement.isValidElement(propValue)) {
          var locationName = ReactPropTypeLocationNames[location];
          var propType = getPropType(propValue);
          return new PropTypeError('Invalid ' + locationName + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement.'));
        }
        return null;
      }
      return createChainableTypeChecker(validate);
    }
    
    function createInstanceTypeChecker(expectedClass) {
      function validate(props, propName, componentName, location, propFullName) {
        if (!(props[propName] instanceof expectedClass)) {
          var locationName = ReactPropTypeLocationNames[location];
          var expectedClassName = expectedClass.name || ANONYMOUS;
          var actualClassName = getClassName(props[propName]);
          return new PropTypeError('Invalid ' + locationName + ' `' + propFullName + '` of type ' + ('`' + actualClassName + '` supplied to `' + componentName + '`, expected ') + ('instance of `' + expectedClassName + '`.'));
        }
        return null;
      }
      return createChainableTypeChecker(validate);
    }
    
    function createEnumTypeChecker(expectedValues) {
      if (!Array.isArray(expectedValues)) {
        process.env.NODE_ENV !== 'production' ? warning(false, 'Invalid argument supplied to oneOf, expected an instance of array.') : void 0;
        return emptyFunction.thatReturnsNull;
      }
    
      function validate(props, propName, componentName, location, propFullName) {
        var propValue = props[propName];
        for (var i = 0; i < expectedValues.length; i++) {
          if (is(propValue, expectedValues[i])) {
            return null;
          }
        }
    
        var locationName = ReactPropTypeLocationNames[location];
        var valuesString = JSON.stringify(expectedValues);
        return new PropTypeError('Invalid ' + locationName + ' `' + propFullName + '` of value `' + propValue + '` ' + ('supplied to `' + componentName + '`, expected one of ' + valuesString + '.'));
      }
      return createChainableTypeChecker(validate);
    }
    
    function createObjectOfTypeChecker(typeChecker) {
      function validate(props, propName, componentName, location, propFullName) {
        if (typeof typeChecker !== 'function') {
          return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside objectOf.');
        }
        var propValue = props[propName];
        var propType = getPropType(propValue);
        if (propType !== 'object') {
          var locationName = ReactPropTypeLocationNames[location];
          return new PropTypeError('Invalid ' + locationName + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));
        }
        for (var key in propValue) {
          if (propValue.hasOwnProperty(key)) {
            var error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
            if (error instanceof Error) {
              return error;
            }
          }
        }
        return null;
      }
      return createChainableTypeChecker(validate);
    }
    
    function createUnionTypeChecker(arrayOfTypeCheckers) {
      if (!Array.isArray(arrayOfTypeCheckers)) {
        process.env.NODE_ENV !== 'production' ? warning(false, 'Invalid argument supplied to oneOfType, expected an instance of array.') : void 0;
        return emptyFunction.thatReturnsNull;
      }
    
      function validate(props, propName, componentName, location, propFullName) {
        for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
          var checker = arrayOfTypeCheckers[i];
          if (checker(props, propName, componentName, location, propFullName, ReactPropTypesSecret) == null) {
            return null;
          }
        }
    
        var locationName = ReactPropTypeLocationNames[location];
        return new PropTypeError('Invalid ' + locationName + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`.'));
      }
      return createChainableTypeChecker(validate);
    }
    
    function createNodeChecker() {
      function validate(props, propName, componentName, location, propFullName) {
        if (!isNode(props[propName])) {
          var locationName = ReactPropTypeLocationNames[location];
          return new PropTypeError('Invalid ' + locationName + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a ReactNode.'));
        }
        return null;
      }
      return createChainableTypeChecker(validate);
    }
    
    function createShapeTypeChecker(shapeTypes) {
      function validate(props, propName, componentName, location, propFullName) {
        var propValue = props[propName];
        var propType = getPropType(propValue);
        if (propType !== 'object') {
          var locationName = ReactPropTypeLocationNames[location];
          return new PropTypeError('Invalid ' + locationName + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
        }
        for (var key in shapeTypes) {
          var checker = shapeTypes[key];
          if (!checker) {
            continue;
          }
          var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
          if (error) {
            return error;
          }
        }
        return null;
      }
      return createChainableTypeChecker(validate);
    }
    
    function isNode(propValue) {
      switch (typeof propValue) {
        case 'number':
        case 'string':
        case 'undefined':
          return true;
        case 'boolean':
          return !propValue;
        case 'object':
          if (Array.isArray(propValue)) {
            return propValue.every(isNode);
          }
          if (propValue === null || ReactElement.isValidElement(propValue)) {
            return true;
          }
    
          var iteratorFn = getIteratorFn(propValue);
          if (iteratorFn) {
            var iterator = iteratorFn.call(propValue);
            var step;
            if (iteratorFn !== propValue.entries) {
              while (!(step = iterator.next()).done) {
                if (!isNode(step.value)) {
                  return false;
                }
              }
            } else {
              // Iterator will provide entry [k,v] tuples rather than values.
              while (!(step = iterator.next()).done) {
                var entry = step.value;
                if (entry) {
                  if (!isNode(entry[1])) {
                    return false;
                  }
                }
              }
            }
          } else {
            return false;
          }
    
          return true;
        default:
          return false;
      }
    }
    
    function isSymbol(propType, propValue) {
      // Native Symbol.
      if (propType === 'symbol') {
        return true;
      }
    
      // 19.4.3.5 Symbol.prototype[@@toStringTag] === 'Symbol'
      if (propValue['@@toStringTag'] === 'Symbol') {
        return true;
      }
    
      // Fallback for non-spec compliant Symbols which are polyfilled.
      if (typeof Symbol === 'function' && propValue instanceof Symbol) {
        return true;
      }
    
      return false;
    }
    
    // Equivalent of `typeof` but with special handling for array and regexp.
    function getPropType(propValue) {
      var propType = typeof propValue;
      if (Array.isArray(propValue)) {
        return 'array';
      }
      if (propValue instanceof RegExp) {
        // Old webkits (at least until Android 4.0) return 'function' rather than
        // 'object' for typeof a RegExp. We'll normalize this here so that /bla/
        // passes PropTypes.object.
        return 'object';
      }
      if (isSymbol(propType, propValue)) {
        return 'symbol';
      }
      return propType;
    }
    
    // This handles more types than `getPropType`. Only used for error messages.
    // See `createPrimitiveTypeChecker`.
    function getPreciseType(propValue) {
      var propType = getPropType(propValue);
      if (propType === 'object') {
        if (propValue instanceof Date) {
          return 'date';
        } else if (propValue instanceof RegExp) {
          return 'regexp';
        }
      }
      return propType;
    }
    
    // Returns class name of the object, if any.
    function getClassName(propValue) {
      if (!propValue.constructor || !propValue.constructor.name) {
        return ANONYMOUS;
      }
      return propValue.constructor.name;
    }
    
    module.exports = ReactPropTypes;
  provide("react/lib/ReactPropTypes", module.exports);
}(global));

// pakmanager:react/lib/ReactVersion
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule ReactVersion
     */
    
    'use strict';
    
    module.exports = '15.3.1';
  provide("react/lib/ReactVersion", module.exports);
}(global));

// pakmanager:react/lib/onlyChild
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule onlyChild
     */
    'use strict';
    
    var _prodInvariant =  require('react/lib/reactProdInvariant');
    
    var ReactElement =  require('react/lib/ReactElement');
    
    var invariant = require('fbjs/lib/invariant');
    
    /**
     * Returns the first child in a collection of children and verifies that there
     * is only one child in the collection.
     *
     * See https://facebook.github.io/react/docs/top-level-api.html#react.children.only
     *
     * The current implementation of this function assumes that a single child gets
     * passed without a wrapper, but the purpose of this helper function is to
     * abstract away the particular structure of children.
     *
     * @param {?object} children Child collection structure.
     * @return {ReactElement} The first and only `ReactElement` contained in the
     * structure.
     */
    function onlyChild(children) {
      !ReactElement.isValidElement(children) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'React.Children.only expected to receive a single React element child.') : _prodInvariant('143') : void 0;
      return children;
    }
    
    module.exports = onlyChild;
  provide("react/lib/onlyChild", module.exports);
}(global));

// pakmanager:react/lib/React
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  /**
     * Copyright 2013-present, Facebook, Inc.
     * All rights reserved.
     *
     * This source code is licensed under the BSD-style license found in the
     * LICENSE file in the root directory of this source tree. An additional grant
     * of patent rights can be found in the PATENTS file in the same directory.
     *
     * @providesModule React
     */
    
    'use strict';
    
    var _assign = require('object-assign');
    
    var ReactChildren =  require('react/lib/ReactChildren');
    var ReactComponent =  require('react/lib/ReactComponent');
    var ReactPureComponent =  require('react/lib/ReactPureComponent');
    var ReactClass =  require('react/lib/ReactClass');
    var ReactDOMFactories =  require('react/lib/ReactDOMFactories');
    var ReactElement =  require('react/lib/ReactElement');
    var ReactPropTypes =  require('react/lib/ReactPropTypes');
    var ReactVersion =  require('react/lib/ReactVersion');
    
    var onlyChild =  require('react/lib/onlyChild');
    var warning = require('fbjs/lib/warning');
    
    var createElement = ReactElement.createElement;
    var createFactory = ReactElement.createFactory;
    var cloneElement = ReactElement.cloneElement;
    
    if (process.env.NODE_ENV !== 'production') {
      var ReactElementValidator =  require('react/lib/ReactElementValidator');
      createElement = ReactElementValidator.createElement;
      createFactory = ReactElementValidator.createFactory;
      cloneElement = ReactElementValidator.cloneElement;
    }
    
    var __spread = _assign;
    
    if (process.env.NODE_ENV !== 'production') {
      var warned = false;
      __spread = function () {
        process.env.NODE_ENV !== 'production' ? warning(warned, 'React.__spread is deprecated and should not be used. Use ' + 'Object.assign directly or another helper function with similar ' + 'semantics. You may be seeing this warning due to your compiler. ' + 'See https://fb.me/react-spread-deprecation for more details.') : void 0;
        warned = true;
        return _assign.apply(null, arguments);
      };
    }
    
    var React = {
    
      // Modern
    
      Children: {
        map: ReactChildren.map,
        forEach: ReactChildren.forEach,
        count: ReactChildren.count,
        toArray: ReactChildren.toArray,
        only: onlyChild
      },
    
      Component: ReactComponent,
      PureComponent: ReactPureComponent,
    
      createElement: createElement,
      cloneElement: cloneElement,
      isValidElement: ReactElement.isValidElement,
    
      // Classic
    
      PropTypes: ReactPropTypes,
      createClass: ReactClass.createClass,
      createFactory: createFactory,
      createMixin: function (mixin) {
        // Currently a noop. Will be used to validate and trace mixins.
        return mixin;
      },
    
      // This looks DOM specific but these are actually isomorphic helpers
      // since they are just generating DOM strings.
      DOM: ReactDOMFactories,
    
      version: ReactVersion,
    
      // Deprecated hook for JSX spread, don't use this for anything.
      __spread: __spread
    };
    
    module.exports = React;
  provide("react/lib/React", module.exports);
}(global));

// pakmanager:react
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  'use strict';
    
    module.exports =  require('react/lib/React');
    
  provide("react", module.exports);
}(global));

// pakmanager:react-easypopin
(function (context) {
  
  var module = { exports: {} }, exports = module.exports
    , $ = require("ender")
    ;
  
  !function(t,e){"object"==typeof exports&&"object"==typeof module?module.exports=e(require("React")):"function"==typeof define&&define.amd?define(["React"],e):"object"==typeof exports?exports.ReactEasypopin=e(require("React")):t.ReactEasypopin=e(t.React)}(this,function(t){return function(t){function e(n){if(r[n])return r[n].exports;var o=r[n]={exports:{},id:n,loaded:!1};return t[n].call(o.exports,o,o.exports,e),o.loaded=!0,o.exports}var r={};return e.m=t,e.c=r,e.p="",e(0)}([function(t,e,r){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e["default"]=r(8),t.exports=e["default"]},function(t,e){var r=Object;t.exports={create:r.create,getProto:r.getPrototypeOf,isEnum:{}.propertyIsEnumerable,getDesc:r.getOwnPropertyDescriptor,setDesc:r.defineProperty,setDescs:r.defineProperties,getKeys:r.keys,getNames:r.getOwnPropertyNames,getSymbols:r.getOwnPropertySymbols,each:[].forEach}},function(t,e){var r=t.exports={version:"1.2.6"};"number"==typeof __e&&(__e=r)},function(t,e,r){t.exports={"default":r(20),__esModule:!0}},function(t,e,r){var n=r(23);t.exports=function(t,e,r){if(n(t),void 0===e)return t;switch(r){case 1:return function(r){return t.call(e,r)};case 2:return function(r,n){return t.call(e,r,n)};case 3:return function(r,n,o){return t.call(e,r,n,o)}}return function(){return t.apply(e,arguments)}}},function(t,e,r){var n=r(28),o=r(2),a=r(4),i="prototype",s=function(t,e,r){var p,u,l,f=t&s.F,c=t&s.G,_=t&s.S,d=t&s.P,y=t&s.B,m=t&s.W,v=c?o:o[e]||(o[e]={}),h=c?n:_?n[e]:(n[e]||{})[i];c&&(r=e);for(p in r)u=!f&&h&&p in h,u&&p in v||(l=u?h[p]:r[p],v[p]=c&&"function"!=typeof h[p]?r[p]:y&&u?a(l,n):m&&h[p]==l?function(t){var e=function(e){return this instanceof t?new t(e):t(e)};return e[i]=t[i],e}(l):d&&"function"==typeof l?a(Function.call,l):l,d&&((v[i]||(v[i]={}))[p]=l))};s.F=1,s.G=2,s.S=4,s.P=8,s.B=16,s.W=32,t.exports=s},function(t,e){t.exports=function(t){return"object"==typeof t?null!==t:"function"==typeof t}},function(t,e){"use strict";Object.defineProperty(e,"__esModule",{value:!0});var r="fx_ttb";e.EFFECT_APPEAR_FROM_TOP_TO_BOTTOM=r;var n="fx_btt";e.EFFECT_APPEAR_FROM_BOTTOM_TO_TOP=n;var o="fx_ltr";e.EFFECT_APPEAR_FROM_LEFT_TO_RIGHT=o;var a="fx_rtl";e.EFFECT_APPEAR_FROM_RIGHT_TO_LEFT=a;var i="fx_3d";e.EFFECT_APPEAR_BY_HORIZONTAL_3D=i;var s="default";e.EFFECT_APPEAR_DEFAULT=s;var p="STATUS_OPENING";e.STATUS_OPENING=p;var u="STATUS_OPENED";e.STATUS_OPENED=u;var l="STATUS_CLOSING";e.STATUS_CLOSING=l;var f="STATUS_CLOSED";e.STATUS_CLOSED=f},function(t,e,r){"use strict";var n=r(15)["default"],o=r(16)["default"],a=r(13)["default"],i=r(12)["default"],s=r(14)["default"],p=r(17)["default"];Object.defineProperty(e,"__esModule",{value:!0});var u=r(39),l=p(u),f=r(18),c=p(f);r(38);var _=r(7),d=function(t){function e(t){var r=this;i(this,e),n(Object.getPrototypeOf(e.prototype),"constructor",this).call(this,t),this.setStatus=function(t){return r.setState({status:r.checkStatus(t)})},this.getStatus=function(){return r.state&&r.state.status},this.open=this.open.bind(this),this.close=this.close.bind(this),this.getAnimation=this.getAnimation.bind(this)}return o(e,t),a(e,[{key:"componentDidMount",value:function(){this.setStatus(this.props.opened?_.STATUS_OPENING:_.STATUS_CLOSED),this.defineStatusChangingWithAnimationsEvents()}},{key:"checkStatus",value:function(t){return t===_.STATUS_OPENING||t===_.STATUS_OPENED||t===_.STATUS_CLOSING||t===_.STATUS_CLOSED?t:_.STATUS_CLOSED}},{key:"getAnimation",value:function(){return this.props.animation}},{key:"defineStatusChangingWithAnimationsEvents",value:function(){var t=this;this.refs.handler.addEventListener("animationend",function(){switch(t.getStatus()){case _.STATUS_OPENING:t.setStatus(_.STATUS_OPENED);break;case _.STATUS_CLOSING:t.setStatus(_.STATUS_CLOSED)}})}},{key:"open",value:function(){var t=this.getStatus();(!t||t===_.STATUS_CLOSED)&&this.setStatus(_.STATUS_OPENING)}},{key:"close",value:function(){this.props.closable&&this.getStatus()===_.STATUS_OPENED&&this.setStatus(_.STATUS_CLOSING)}},{key:"render",value:function(){var t=this.getStatus(),e=this.props,r=e.overlay,n=e.withCloseButton,o=e.closableWithOverlayClick,a=c["default"](s({"react-easypopin__Handler":!0,"react-easypopin__Open":t===_.STATUS_OPENING||t===_.STATUS_OPENED,"react-easypopin__Closed":!t||t===_.STATUS_CLOSED,"react-easypopin__Closing":t===_.STATUS_CLOSING},""+this.getAnimation(),!0)),i=c["default"]({"react-easypopin__Overlay":!0,"react-easypopin__Overlay__Open":t===_.STATUS_OPENING||t===_.STATUS_OPENED,"react-easypopin__Overlay__Closing":t===_.STATUS_CLOSING,"react-easypopin__Overlay__Closed":!t||t===_.STATUS_CLOSED});return l["default"].createElement("div",{className:"react-easypopin"},r&&l["default"].createElement("div",{className:i,onClick:o&&this.close,ref:"overlay"}),l["default"].createElement("div",{className:a,ref:"handler"},l["default"].createElement("div",{className:"react-easypopin__Handler__Content"},n&&l["default"].createElement("a",{onClick:this.close,className:"react-easypopin__Handler__Close",ref:"closeBtn"}),this.props.children)))}}],[{key:"propTypes",value:{children:u.PropTypes.node,opened:u.PropTypes.bool,closable:u.PropTypes.bool,overlay:u.PropTypes.bool,closableWithOverlayClick:u.PropTypes.bool,withCloseButton:u.PropTypes.bool,animation:u.PropTypes.string},enumerable:!0},{key:"defaultProps",value:{animation:_.EFFECT_APPEAR_DEFAULT,opened:!1,closable:!0,withCloseButton:!0,overlay:!0,closableWithOverlayClick:!0},enumerable:!0},{key:"EFFECT_APPEAR_FROM_TOP_TO_BOTTOM",value:_.EFFECT_APPEAR_FROM_TOP_TO_BOTTOM,enumerable:!0},{key:"EFFECT_APPEAR_FROM_BOTTOM_TO_TOP",value:_.EFFECT_APPEAR_FROM_BOTTOM_TO_TOP,enumerable:!0},{key:"EFFECT_APPEAR_FROM_LEFT_TO_RIGHT",value:_.EFFECT_APPEAR_FROM_LEFT_TO_RIGHT,enumerable:!0},{key:"EFFECT_APPEAR_FROM_RIGHT_TO_LEFT",value:_.EFFECT_APPEAR_FROM_RIGHT_TO_LEFT,enumerable:!0},{key:"EFFECT_APPEAR_BY_HORIZONTAL_3D",value:_.EFFECT_APPEAR_BY_HORIZONTAL_3D,enumerable:!0},{key:"EFFECT_APPEAR_DEFAULT",value:_.EFFECT_APPEAR_DEFAULT,enumerable:!0}]),e}(u.Component);e["default"]=d,t.exports=e["default"]},function(t,e,r){t.exports={"default":r(19),__esModule:!0}},function(t,e,r){t.exports={"default":r(21),__esModule:!0}},function(t,e,r){t.exports={"default":r(22),__esModule:!0}},function(t,e){"use strict";e["default"]=function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")},e.__esModule=!0},function(t,e,r){"use strict";var n=r(3)["default"];e["default"]=function(){function t(t,e){for(var r=0;r<e.length;r++){var o=e[r];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),n(t,o.key,o)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),e.__esModule=!0},function(t,e,r){"use strict";var n=r(3)["default"];e["default"]=function(t,e,r){return e in t?n(t,e,{value:r,enumerable:!0,configurable:!0,writable:!0}):t[e]=r,t},e.__esModule=!0},function(t,e,r){"use strict";var n=r(10)["default"];e["default"]=function(t,e,r){for(var o=!0;o;){var a=t,i=e,s=r;o=!1,null===a&&(a=Function.prototype);var p=n(a,i);if(void 0!==p){if("value"in p)return p.value;var u=p.get;return void 0===u?void 0:u.call(s)}var l=Object.getPrototypeOf(a);if(null===l)return void 0;t=l,e=i,r=s,o=!0,p=l=void 0}},e.__esModule=!0},function(t,e,r){"use strict";var n=r(9)["default"],o=r(11)["default"];e["default"]=function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function, not "+typeof e);t.prototype=n(e&&e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),e&&(o?o(t,e):t.__proto__=e)},e.__esModule=!0},function(t,e){"use strict";e["default"]=function(t){return t&&t.__esModule?t:{"default":t}},e.__esModule=!0},function(t,e,r){var n,o;/*!
    	  Copyright (c) 2016 Jed Watson.
    	  Licensed under the MIT License (MIT), see
    	  http://jedwatson.github.io/classnames
    	*/
    !function(){"use strict";function r(){for(var t=[],e=0;e<arguments.length;e++){var n=arguments[e];if(n){var o=typeof n;if("string"===o||"number"===o)t.push(n);else if(Array.isArray(n))t.push(r.apply(null,n));else if("object"===o)for(var i in n)a.call(n,i)&&n[i]&&t.push(i)}}return t.join(" ")}var a={}.hasOwnProperty;"undefined"!=typeof t&&t.exports?t.exports=r:(n=[],o=function(){return r}.apply(e,n),!(void 0!==o&&(t.exports=o)))}()},function(t,e,r){var n=r(1);t.exports=function(t,e){return n.create(t,e)}},function(t,e,r){var n=r(1);t.exports=function(t,e,r){return n.setDesc(t,e,r)}},function(t,e,r){var n=r(1);r(33),t.exports=function(t,e){return n.getDesc(t,e)}},function(t,e,r){r(34),t.exports=r(2).Object.setPrototypeOf},function(t,e){t.exports=function(t){if("function"!=typeof t)throw TypeError(t+" is not a function!");return t}},function(t,e,r){var n=r(6);t.exports=function(t){if(!n(t))throw TypeError(t+" is not an object!");return t}},function(t,e){var r={}.toString;t.exports=function(t){return r.call(t).slice(8,-1)}},function(t,e){t.exports=function(t){if(void 0==t)throw TypeError("Can't call method on  "+t);return t}},function(t,e){t.exports=function(t){try{return!!t()}catch(e){return!0}}},function(t,e){var r=t.exports="undefined"!=typeof window&&window.Math==Math?window:"undefined"!=typeof self&&self.Math==Math?self:Function("return this")();"number"==typeof __g&&(__g=r)},function(t,e,r){var n=r(25);t.exports=Object("z").propertyIsEnumerable(0)?Object:function(t){return"String"==n(t)?t.split(""):Object(t)}},function(t,e,r){var n=r(5),o=r(2),a=r(27);t.exports=function(t,e){var r=(o.Object||{})[t]||Object[t],i={};i[t]=e(r),n(n.S+n.F*a(function(){r(1)}),"Object",i)}},function(t,e,r){var n=r(1).getDesc,o=r(6),a=r(24),i=function(t,e){if(a(t),!o(e)&&null!==e)throw TypeError(e+": can't set as prototype!")};t.exports={set:Object.setPrototypeOf||("__proto__"in{}?function(t,e,o){try{o=r(4)(Function.call,n(Object.prototype,"__proto__").set,2),o(t,[]),e=!(t instanceof Array)}catch(a){e=!0}return function(t,r){return i(t,r),e?t.__proto__=r:o(t,r),t}}({},!1):void 0),check:i}},function(t,e,r){var n=r(29),o=r(26);t.exports=function(t){return n(o(t))}},function(t,e,r){var n=r(32);r(30)("getOwnPropertyDescriptor",function(t){return function(e,r){return t(n(e),r)}})},function(t,e,r){var n=r(5);n(n.S,"Object",{setPrototypeOf:r(31).set})},function(t,e,r){e=t.exports=r(36)(),e.push([t.id,'@keyframes appear_from_top_to_bottom{0%{top:-50%;opacity:0;transform:translateX(-50%) translateY(0)}to{top:50%;opacity:1;transform:translateX(-50%) translateY(-50%)}}@keyframes disappear_from_top_to_bottom{0%{top:50%;opacity:1;transform:translateX(-50%) translateY(-50%)}to{top:-50%;opacity:0;transform:translateX(-50%) translateY(0)}}@keyframes appear_from_bottom_to_top{0%{bottom:-50%;opacity:0;transform:translateX(-50%) translateY(0)}to{bottom:50%;opacity:1;transform:translateX(-50%) translateY(50%)}}@keyframes disappear_from_bottom_to_top{0%{bottom:50%;opacity:1;transform:translateX(-50%) translateY(50%)}to{bottom:-50%;opacity:0;transform:translateX(-50%) translateY(0)}}@keyframes appear_from_left_to_right{0%{left:-50%;opacity:0;transform:translateX(-100%) translateY(0)}to{left:50%;opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes disappear_from_left_to_right{0%{left:50%;opacity:1;transform:translateX(-50%) translateY(0)}to{left:-50%;opacity:0;transform:translateX(-100%) translateY(0)}}@keyframes appear_from_right_to_left{0%{left:100%;opacity:0;transform:translateX(0) translateY(0)}to{left:50%;opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes disappear_from_right_to_left{0%{left:50%;opacity:1;transform:translateX(-50%) translateY(0)}to{left:100%;opacity:0;transform:translateX(0) translateY(0)}}@keyframes appear_by_horizontal_3D{0%{opacity:0;transform:translateX(-50%) rotateY(90deg)}to{opacity:1;transform:translateX(-50%) rotateY(0deg)}}@keyframes disappear_by_horizontal_3D{0%{opacity:1;transform:translateX(-50%) rotateY(0deg)}to{opacity:0;transform:translateX(-50%) rotateY(90deg)}}@keyframes appear_default{0%{opacity:0}0%,to{transform:translateX(-50%) translateY(0)}to{opacity:1}}@keyframes disappear_default{0%{opacity:1}0%,to{transform:translateX(-50%) translateY(0)}to{opacity:0}}@keyframes appear-overlay{0%{opacity:0}to{opacity:1}}@keyframes disappear-overlay{0%{opacity:1}to{opacity:0}}.react-easypopin{width:100vw;height:100vh;position:absolute;z-index:999999;top:0;left:0;text-align:center;margin:0;overflow:hidden;display:flex;align-items:center;align-content:center}.react-easypopin__Overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999997;background-color:hsla(0,0%,5%,.75)}.react-easypopin__Overlay__Open{display:block;animation:appear-overlay .25s ease-out forwards}.react-easypopin__Overlay__Closing{display:block;animation:disappear-overlay .5s ease-out forwards}.react-easypopin__Overlay__Closed{display:none}.react-easypopin__Handler{position:absolute;height:auto;margin:0;left:50%;z-index:999999}.react-easypopin__Handler__Content{margin:0;right:0;width:inherit;min-width:25pc;min-height:5rem;background:#ddd}.react-easypopin__Handler__Close{position:absolute;right:.25rem;color:#009aa6;top:1.25rem;font-size:2rem;text-decoration:none;cursor:pointer;background:url("/lib/images/close.png") center center no-repeat;background-size:1.5rem;height:1.5rem;width:1.5rem;display:inline-block}.react-easypopin__Open{display:block}.react-easypopin__Open.fx_ttb{animation:appear_from_top_to_bottom .5s ease-out forwards}.react-easypopin__Open.fx_btt{animation:appear_from_bottom_to_top .5s ease-out forwards}.react-easypopin__Open.fx_ltr{animation:appear_from_left_to_right .5s ease-out forwards}.react-easypopin__Open.fx_rtl{animation:appear_from_right_to_left .5s ease-out forwards}.react-easypopin__Open.fx_3d{animation:appear_by_horizontal_3D 1s ease-out forwards}.react-easypopin__Open.default{animation:appear_default .5s ease-out forwards}.react-easypopin__Closing{display:block}.react-easypopin__Closing.fx_ttb{animation:disappear_from_top_to_bottom .5s ease-out forwards}.react-easypopin__Closing.fx_btt{animation:disappear_from_bottom_to_top .5s ease-out forwards}.react-easypopin__Closing.fx_ltr{animation:disappear_from_left_to_right .5s ease-out forwards}.react-easypopin__Closing.fx_rtl{animation:disappear_from_right_to_left .5s ease-out forwards}.react-easypopin__Closing.fx_3d{animation:disappear_by_horizontal_3D 1s ease-out forwards}.react-easypopin__Closing.default{animation:disappear_default .5s ease-out forwards}.react-easypopin__Closed{display:none}',""])},function(t,e){t.exports=function(){var t=[];return t.toString=function(){for(var t=[],e=0;e<this.length;e++){var r=this[e];r[2]?t.push("@media "+r[2]+"{"+r[1]+"}"):t.push(r[1])}return t.join("")},t.i=function(e,r){"string"==typeof e&&(e=[[null,e,""]]);for(var n={},o=0;o<this.length;o++){var a=this[o][0];"number"==typeof a&&(n[a]=!0)}for(o=0;o<e.length;o++){var i=e[o];"number"==typeof i[0]&&n[i[0]]||(r&&!i[2]?i[2]=r:r&&(i[2]="("+i[2]+") and ("+r+")"),t.push(i))}},t}},function(t,e,r){function n(t,e){for(var r=0;r<t.length;r++){var n=t[r],o=f[n.id];if(o){o.refs++;for(var a=0;a<o.parts.length;a++)o.parts[a](n.parts[a]);for(;a<n.parts.length;a++)o.parts.push(s(n.parts[a],e))}else{for(var i=[],a=0;a<n.parts.length;a++)i.push(s(n.parts[a],e));f[n.id]={id:n.id,refs:1,parts:i}}}}function o(t){for(var e=[],r={},n=0;n<t.length;n++){var o=t[n],a=o[0],i=o[1],s=o[2],p=o[3],u={css:i,media:s,sourceMap:p};r[a]?r[a].parts.push(u):e.push(r[a]={id:a,parts:[u]})}return e}function a(){var t=document.createElement("style"),e=d();return t.type="text/css",e.appendChild(t),t}function i(){var t=document.createElement("link"),e=d();return t.rel="stylesheet",e.appendChild(t),t}function s(t,e){var r,n,o;if(e.singleton){var s=m++;r=y||(y=a()),n=p.bind(null,r,s,!1),o=p.bind(null,r,s,!0)}else t.sourceMap&&"function"==typeof URL&&"function"==typeof URL.createObjectURL&&"function"==typeof URL.revokeObjectURL&&"function"==typeof Blob&&"function"==typeof btoa?(r=i(),n=l.bind(null,r),o=function(){r.parentNode.removeChild(r),r.href&&URL.revokeObjectURL(r.href)}):(r=a(),n=u.bind(null,r),o=function(){r.parentNode.removeChild(r)});return n(t),function(e){if(e){if(e.css===t.css&&e.media===t.media&&e.sourceMap===t.sourceMap)return;n(t=e)}else o()}}function p(t,e,r,n){var o=r?"":n.css;if(t.styleSheet)t.styleSheet.cssText=v(e,o);else{var a=document.createTextNode(o),i=t.childNodes;i[e]&&t.removeChild(i[e]),i.length?t.insertBefore(a,i[e]):t.appendChild(a)}}function u(t,e){var r=e.css,n=e.media;e.sourceMap;if(n&&t.setAttribute("media",n),t.styleSheet)t.styleSheet.cssText=r;else{for(;t.firstChild;)t.removeChild(t.firstChild);t.appendChild(document.createTextNode(r))}}function l(t,e){var r=e.css,n=(e.media,e.sourceMap);n&&(r+="\n/*# sourceMappingURL=data:application/json;base64,"+btoa(unescape(encodeURIComponent(JSON.stringify(n))))+" */");var o=new Blob([r],{type:"text/css"}),a=t.href;t.href=URL.createObjectURL(o),a&&URL.revokeObjectURL(a)}var f={},c=function(t){var e;return function(){return"undefined"==typeof e&&(e=t.apply(this,arguments)),e}},_=c(function(){return/msie [6-9]\b/.test(window.navigator.userAgent.toLowerCase())}),d=c(function(){return document.head||document.getElementsByTagName("head")[0]}),y=null,m=0;t.exports=function(t,e){e=e||{},"undefined"==typeof e.singleton&&(e.singleton=_());var r=o(t);return n(r,e),function(t){for(var a=[],i=0;i<r.length;i++){var s=r[i],p=f[s.id];p.refs--,a.push(p)}if(t){var u=o(t);n(u,e)}for(var i=0;i<a.length;i++){var p=a[i];if(0===p.refs){for(var l=0;l<p.parts.length;l++)p.parts[l]();delete f[p.id]}}}};var v=function(){var t=[];return function(e,r){return t[e]=r,t.filter(Boolean).join("\n")}}()},function(t,e,r){var n=r(35);"string"==typeof n&&(n=[[t.id,n,""]]);r(37)(n,{});n.locals&&(t.exports=n.locals)},function(t,e){t.exports=React}])});
  provide("react-easypopin", module.exports);
}(global));
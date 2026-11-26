# Vendored library: jsQR 1.4.0

`jsQR.min.js` is the minified build of [jsQR](https://github.com/cozmo/jsQR), a pure
JavaScript QR code reader used by the Connect scanner.

- **Why vendored:** the event app must scan QR codes offline and without a build
  step, including on iOS Safari where the native `BarcodeDetector` API is not
  available.
- **Licence:** Apache License 2.0. Copyright (c) 2017 Cosmo Wolfe and contributors.
  The licence text is at <https://www.apache.org/licenses/LICENSE-2.0>.
- **Source:** `https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js`
- **Loaded in:** `app.html`, before `js/connect.js`.
- **Do not edit.** To upgrade, replace this file, keep the licence header, and
  re-test scanning (see `CONNECT.md`).

The QR **generator** is not a library: it lives in `js/qr.js` and is part of this
project.

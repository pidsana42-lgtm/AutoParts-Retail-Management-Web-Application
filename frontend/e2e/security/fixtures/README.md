# Synthetic image fixture

`red-square.heic` is a 32 × 32 solid RGB (220, 40, 40) square created for these
tests. A PNG was generated using Python's standard-library zlib/struct and encoded
by macOS `sips -s format heic`. It contains no user photo or customer information.

The browser test checks actual HEIC decoding to a 32-pixel-wide JPEG preview.
PDF documents are generated in memory by jsPDF during the tests.

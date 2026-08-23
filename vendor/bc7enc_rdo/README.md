# bc7enc_rdo codec subset

This directory contains the BC1-BC5 and BC7 scalar codec sources vendored from
[`richgel999/bc7enc_rdo`](https://github.com/richgel999/bc7enc_rdo).

The command-line application, PNG/DDS helpers, RDO post-processor, OpenMP
driver, and x86 ISPC encoder are intentionally omitted. The project uses the
smaller `rgbcx` lookup table to reduce the browser WebAssembly binary size.

See `LICENSE` for the upstream licensing terms.

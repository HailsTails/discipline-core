# Third-party notices

This repository's source contains no third-party code. Its development tools and core's own packages are installed from `pnpm-lock.yaml` and are not committed here.

The built package bundles core's own packages and the packages they depend on. Each release tarball carries its own `THIRD-PARTY-NOTICES.md`, which `pnpm run build-package` writes from the licence and notice files of exactly the packages bundled into that build.
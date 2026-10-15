# Car image catalog integration

This branch introduces a code-keyed manifest for the current pricing catalog.

## Rules
- The canonical key is the existing car `code` from `data/pricing-cars.csv`.
- Asset paths are reserved under `public/images/cars/`; do not treat a reserved path as proof that an image exists.
- `pending` means no approved image has been selected.
- `review` means a candidate was found, but exact generation, composition, license and attribution remain to be reviewed.
- `verified` should only be set after the actual downloaded asset is checked and license metadata is recorded.
- Do not substitute another generation if an exact one cannot be found; use the UI placeholder instead.
- Keep image attribution and license records with the manifest or a companion credits file.
- Brand marks also need a separate trademark/asset review; do not assume that a logo file is automatically approved.

## Current status
- 72 catalog records have reserved main/rear/side/detail paths and Wikimedia Commons search URLs.
- BMW X5 G05 has one candidate from Wikimedia Commons recorded as `review`, not `verified`.
- The candidate declares CC BY-SA 4.0. Attribution and share-alike terms must be respected; check suitability for this commercial site before use.
- No actual photo binary has been committed yet, so the reserved image paths must not be rendered as if the assets exist.
- UI integration is not complete. Keep this branch separate from `main` until assets are sourced and tests/build pass.

## Image acceptance checklist
1. Confirm generation from visible body shape and source metadata.
2. Confirm the image is sharp enough and composition works in a 16:9 card.
3. Open the source page and verify author, license URL and any additional restrictions.
4. Save the actual file locally as WebP, target 1600x900 for hero and 800x450 for cards.
5. Record the original source URL, author, license, download date and any modifications.
6. Test image load and fallback on desktop and mobile.

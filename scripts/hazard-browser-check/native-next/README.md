# Native Next.js component verification

This isolated project imports the actual TheoryTestSuite and its dynamic player components, without substituting React.lazy for next/dynamic. It uses the installed parent-workspace Next/React packages. No application release, authentication or scoring configuration is changed.

From this folder, run the parent Next CLI to build, then start bound to **127.0.0.1:4390**. The default page selects the new player; `?mode=legacy` selects the old player. The only API route returns a clearly labelled, synthetic, read-only catalogue. There are no start, submit, media, authentication or database routes.

This verifies native bundling, hydration and conditional component loading. It does **not** prove authenticated cloud playback, actual clip scoring, or release approval. Never deploy this diagnostic project to the LDA site.

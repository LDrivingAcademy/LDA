# LDA

LDA / L Driving Academy web app.

## Live Map Tracking

The homepage includes a live lesson tracking preview. It simulates instructor movement by default so the site works without paid keys.

To show real Google Maps tiles, add this Vercel environment variable:

```txt
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_browser_key
```

Production GPS tracking should only be enabled for accepted bookings, near lesson time, with clear learner/instructor consent and minimal location retention.

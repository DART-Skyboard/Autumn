
<p align="center">
  | Autumn |
</p>
  <br>
  <p align="left">
  Autumn AI by Radical Deepscale and LEATR
  </p>
  <br>
  <p align="center">
  <a href="https://leatr.xyz/" target="_blank">
    <img src="https://raw.githubusercontent.com/DART-Skyboard/Autumn/refs/heads/main/assets/rdbanner.png" alt="Autumn Banner" width="600" height="317">
  </a>
  <br>
  <a href="https://leatr.xyz/">Autumn</a>
</p>

---

## Repository Structure

```
Autumn/
├── index.html              # Main Autumn web app  →  leatr.xyz
├── amp.html                # Draft & Drip lounge  →  leatr.xyz/amp.html
├── autumn-help.pdf         # User guide & reference manual
├── autumn-privacy.html     # Privacy policy page
├── manifest.json           # PWA manifest
├── CNAME                   # GitHub Pages domain (leatr.xyz)
│
├── assets/                 # Images, video, static resources
│   ├── autumn.mp4              # Day theme background video
│   ├── autumnnight.mp4         # Night theme background video
│   ├── autumn.png              # App logo / avatar
│   ├── autumn512.png           # High-res logo
│   ├── rdbanner.png            # README / social banner
│   ├── Lead_Edge_Ash_Tree_Reflex.txt   # LEATR architecture reference
│   ├── instructionset.json     # LEATR instruction definitions
│   └── ...
│
├── js/                     # JavaScript dependencies & logic
│   ├── autumn-logic.js         # LEATR logic extension (editable via IDE)
│   ├── three.min.js            # Three.js (3D BRPN scene)
│   ├── leaflet.min.js          # Map rendering
│   └── ...
│
├── css/                    # Stylesheets
│
└── tests/                  # Dev, test & reference files
    ├── autumn.html             # Previous build / reference
    ├── indextest.html          # Test harness
    ├── frax.html               # FRAX Studio standalone page
    ├── referencepolicy.html    # Reference policy page
    ├── download_deps.sh        # Dependency download script
    └── ...
```

---

Important Note: GitHub login is now fully implemented with device flow and web flow and as a fallback you can also create a personal access token for your account then use that token to sign-in. Currently I'm using a free account to handle the back-end token processing and only have so many requests quota that I can do per day. When the quota is exceeded I recommend using the personal access token to maintain login services. The quota resets everyday at midnight.

---

<p align="center">
  © 2026 DART Meadow / Radical Deepscale LLC &nbsp;·&nbsp; Built on LEATR v2
</p>

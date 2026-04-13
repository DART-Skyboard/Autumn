#!/bin/bash
mkdir -p js css assets css/images

# Download Ariel Assets
echo "Downloading Ariel Assets..."
wget -q -O assets/ambh.jpeg https://raw.githubusercontent.com/DART-Skyboard/Ariel/refs/heads/main/static/ambh.jpeg
wget -q -O assets/autumn_identity_front.png https://raw.githubusercontent.com/DART-Skyboard/Ariel/main/static/autumn_identity_front.png
wget -q -O assets/autumn_identity_logo.png https://raw.githubusercontent.com/DART-Skyboard/Ariel/main/static/autumn_identity_logo.png
wget -q -O assets/autumn_identity_top.png https://raw.githubusercontent.com/DART-Skyboard/Ariel/main/static/autumn_identity_top.png
wget -q -O assets/autumn.png https://raw.githubusercontent.com/DART-Skyboard/Ariel/refs/heads/main/static/autumn.png
wget -q -O assets/autumn.mp4 https://raw.githubusercontent.com/DART-Skyboard/Ariel/main/static/autumn.mp4
wget -q -O assets/syntaxdefinitions.json https://raw.githubusercontent.com/DART-Skyboard/Ariel/main/dartide/syntaxdefinitions.json
wget -q -O assets/instructionset.json https://raw.githubusercontent.com/DART-Skyboard/Ariel/main/dartide/instructionset.json
wget -q -O assets/outputdefinitions.json https://raw.githubusercontent.com/DART-Skyboard/Ariel/main/dartide/outputdefinitions.json

# Download CSS
echo "Downloading CSS..."
wget -q -O css/leaflet.min.css https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css

# Download Leaflet Images
echo "Downloading Leaflet Images..."
wget -q -O css/images/layers.png https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/layers.png
wget -q -O css/images/layers-2x.png https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/layers-2x.png
wget -q -O css/images/marker-icon.png https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png
wget -q -O css/images/marker-icon-2x.png https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png
wget -q -O css/images/marker-shadow.png https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png

# Download JS
echo "Downloading JS..."
wget -q -O js/three.min.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
wget -q -O js/jszip.min.js https://cdnjs.cloudflare.com/ajax/libs/jszip/3.5.0/jszip.min.js
wget -q -O js/FileSaver.min.js https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
wget -q -O js/pako.min.js https://cdn.jsdelivr.net/npm/pako@2.0.3/dist/pako.min.js
wget -q -O js/leaflet.min.js https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js
wget -q -O js/transformers.min.js https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/transformers.min.js

echo "Done"

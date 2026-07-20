# 🦛 Baby Hippo AI Companion Module

This folder contains a standalone, modular copy of the **3D Baby Hippo AI Companion** components used in **Vaani AI Voice Partner**.

## Included Components

1. **`baby-hippo-3d.tsx`**:
   - WebGL 3D interactive Baby Hippo character built with Three.js.
   - Includes full animation state machine (`idle`, `listening`, `thinking`, `speaking`, `positive`, `encouraging`).
   - Procedural bone/mesh controls for blinking, breathing, ear wiggling, mouth lip-sync, paws, and gold star sparkles.

2. **`hippo-speech-bubble.tsx`**:
   - Animated glassmorphic speech bubble card floating above/beside the hippo with typing animation and audio replay trigger.

3. **`hippo-sound-ring.tsx`**:
   - 360° circular audio wave ring visualizer with reactive frequency bars and glowing background halos.

4. **`index.ts`**:
   - Re-exports all components for clean importing (`import { BabyHippo3D } from '@/hippo'`).

## Dependencies Required
```json
{
  "three": "^0.160.0",
  "@types/three": "^0.160.0",
  "framer-motion": "^11.0.0",
  "lucide-react": "^0.454.0"
}
```

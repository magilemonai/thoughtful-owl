# Ceci N'est Pas Un Jeu
### A Magritte Point-and-Click Misadventure

---

## Concept

You are a bowler-hatted man who has fallen into a Magritte painting. Navigate
through his surrealist world, solving absurdist puzzles and questioning the
nature of reality itself. The humor is deadpan and philosophical. The atmosphere
is dreamlike and melancholy. The ending will make you feel something.

**Tagline:** *"This is not a game. (But you're playing it anyway.)"*

---

## Phase 1: Engine & Core Systems

Build the foundational game engine as a single self-contained `index.html`:

- **Scene renderer** — Each room is CSS art (styled divs, gradients, shapes)
  creating Magritte-inspired compositions. Canvas overlay for particle effects.
- **Interaction system** — Clickable hotspots in each scene. Hover reveals
  names. Click triggers examine/use actions.
- **Inventory system** — Bottom toolbar. Click item to select, click hotspot
  to use. Items have witty descriptions.
- **Dialogue/narration system** — Typewriter-style text box for narrator voice
  (dry, philosophical, occasionally breaking the fourth wall).
- **Scene transitions** — Painterly fade/dissolve between rooms (like paint
  being applied to canvas).
- **Ambient audio** — Web Audio API for procedural atmospheric sounds (rain,
  wind, ticking clocks). No external files needed.
- **Title screen** — "Ceci N'est Pas Un Jeu" with a play button shaped like
  a floating bowler hat.
- **Save state** — localStorage for progress persistence.

---

## Phase 2: Rooms & Visual Design

Seven rooms, each based on an iconic Magritte painting. Connected as a
non-linear map with gated progression.

### Room 1: The Empire of Light (Hub Room)
**Painting:** Night street scene beneath an impossibly daytime sky.
- CSS: Dark buildings with lit windows below, bright blue sky with fluffy
  clouds above. A single glowing streetlamp.
- The central hub. Doors/paths lead to other rooms.
- A park bench holds a pipe with a small sign: *"Ceci n'est pas une pipe."*
- **Item: The Not-A-Pipe** — "You pick it up. It insists it isn't what it
  clearly is. You relate to this."

### Room 2: Personal Values (The Giant Objects Bedroom)
**Painting:** A bedroom containing absurdly oversized everyday objects.
- CSS: Normal bedroom walls/floor. A comb as tall as the wall. A wine glass
  reaching the ceiling. A giant matchstick leaning in the corner.
- Puzzle: Use the Not-A-Pipe to "un-name" the giant comb, shrinking it to
  normal size. Reveals a **Green Apple** hidden behind it.
- Humor: Examining the bed — *"It's a bed. At least, it claims to be. You've
  learned not to trust objects in this place."*

### Room 3: Golconda (Raining Businessmen)
**Painting:** Identical men in bowler hats floating/raining across a building facade.
- CSS: Brick building exterior. Animated bowler-hatted silhouettes drifting
  downward like rain. Parallax layers.
- Puzzle: You need a bowler hat to blend in with the falling men. Catch one
  by standing in the right spot at the right time (timing click).
- **Item: Bowler Hat** — *"It fits perfectly. Disturbingly perfectly. As if
  your head was always just a hat-shaped absence."*
- Humor: Clicking on falling men — *"He looks exactly like you. They all do.
  This is either very comforting or deeply unsettling."*

### Room 4: The Human Condition (Easel Room)
**Painting:** An easel before a window; the canvas shows the exact landscape
behind it, making the boundary between painting and reality invisible.
- CSS: Interior with window. An easel holds a canvas that perfectly matches
  the landscape visible through the window.
- Puzzle: Move the canvas aside (need the Bowler Hat to reach it — it's
  perched on the easel top). Behind the canvas, the "real" landscape is
  subtly different — there's a door that doesn't exist in the painting.
- Revelation: *"The painting showed you what you expected to see. Reality
  had other plans."*

### Room 5: Time Transfixed (Fireplace Train)
**Painting:** A locomotive emerging from a fireplace mantle.
- CSS: Victorian room with ornate fireplace. A steam train protrudes from
  the firebox, frozen mid-emergence. Clock on mantle reads impossible time.
- Puzzle: The train has a locked compartment. Use the Green Apple as a
  "ticket" (surrealist logic). Inside: a **Love Letter**, never opened,
  addressed to no one.
- **Item: Love Letter** — *"The envelope is warm. The handwriting is yours,
  but you don't remember writing it. It's addressed to someone whose name
  keeps changing when you look away."*

### Room 6: Not to Be Reproduced (Mirror Room)
**Painting:** A man looking in a mirror sees the back of his own head.
- CSS: Ornate mirror on wall. When you "look," the mirror shows the back
  of a bowler-hatted head (yours). Other mirrors show wrong reflections.
- Puzzle: Place the Love Letter in front of the mirror. The mirror reads it
  (showing it reversed). The letter's reflection reveals the name of the
  addressee: yours. The mirror cracks, revealing a passage.
- Revelation: *"You wrote a love letter to yourself. That's either the
  saddest or the most radical act of self-acceptance you've ever committed."*

### Room 7: The Lovers (Final Room)
**Painting:** Two figures kissing, their faces covered by white cloth.
- CSS: Ethereal room. Soft light. Two figures with cloth-draped faces,
  leaning toward each other.
- No puzzle. Just a choice.
- You can lift the cloth from one face. Underneath: your face. The other
  figure? You can choose to lift their cloth or leave it.
- **If you lift it:** Underneath is also your face. *"Of course. Every
  person you've ever loved was a mirror you hadn't learned to read yet."*
- **If you leave it:** *"Some mysteries are kinder left unsolved. The cloth
  isn't hiding something from you — it's protecting something for you."*
- Either way, the screen slowly transitions to look like a framed painting
  in a museum. You zoom out. A small figure stands looking at the painting.
  The game's title card appears below the frame, like a museum placard.

---

## Phase 3: Puzzle Logic & Inventory Integration

Wire together the complete puzzle dependency chain:

```
Start (Empire of Light)
  └─ Get Not-A-Pipe (free)
       └─ Use on Comb in Personal Values → Get Green Apple
  └─ Catch hat in Golconda → Get Bowler Hat
       └─ Use in Human Condition → Access new areas
            └─ Use Green Apple in Time Transfixed → Get Love Letter
                 └─ Use in Not to Be Reproduced → Open passage to The Lovers
                      └─ Final choice → Ending
```

- Inventory combinations and contextual use
- Witty failure messages for wrong item usage ("That's creative, but no.")
- Easter egg interactions (use pipe on everything: unique responses)

---

## Phase 4: Atmosphere & Polish

### Audio (Web Audio API, no external files)
- Empire of Light: Soft cricket chirps + distant jazz piano notes
- Personal Values: Echoing room tone, occasional creaks
- Golconda: Wind, soft thuds of landing footsteps
- Human Condition: Birdsong from "outside" the window
- Time Transfixed: Ticking clock, distant train whistle, fire crackle
- Not to Be Reproduced: Reverberant silence, glass resonance
- The Lovers: Gentle strings (generated), heartbeat

### Visual Polish
- Painterly color palette: Magritte's signature blues, warm lamp-lit browns,
  cloud whites, deep greens
- Subtle parallax on mouse movement (scenes feel like 3D dioramas)
- Floating particle effects (dust motes, clouds drifting)
- Scene transitions: "brush stroke" wipe effect
- Cursor changes: Hand for interactable, magnifying glass for examine
- Gentle idle animations in each scene

### Writing Polish
- Every interactable object gets 2-3 lines of narration
- Recurring motifs in the text (mirrors, names, recognition)
- Fourth-wall breaks that feel earned, not gimmicky
- The narrator's tone shifts subtly from bemused → contemplative → tender

---

## Phase 5: Title Screen, Ending & Final Touches

- **Title screen** with atmospheric Magritte-inspired art
- **Museum ending** sequence with zoom-out reveal
- **Credits** styled as a museum exhibition catalogue
- **Post-credits:** Clicking the painting starts the game over, but one small
  detail has changed in the Empire of Light...
- Final localStorage save of completion state
- Responsive design for different screen sizes
- Accessibility: keyboard navigation, screen reader text for scenes

---

## Technical Approach

- **Single `index.html` file** — fully self-contained, no build step, no deps
- **CSS art** for all scene visuals (no images needed)
- **Canvas overlay** for particle effects and transitions
- **Web Audio API** for procedural sound generation
- **~2500-3500 lines** of hand-crafted HTML/CSS/JS
- **Magritte palette:** `#1a1a2e`, `#4a6fa5`, `#88b7d5`, `#c9a96e`,
  `#f0e6d3`, `#2d4a22`, `#8b4513`

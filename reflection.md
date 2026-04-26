density → how many cells are alive
change  → how many cells changed since the previous step
chaos   → combined intensity of density and change

query length  → visual pressure / height of wave
word count    → wave complexity
search hour   → movement speed
clicked URL   → brighter, stronger movement
clicked rank  → saturation / intensity
user hash     → glyph pattern and location
Game of Life  → memory / afterimage / mutation

Longer query = larger pressure field
More words = more waves
Later hour = faster movement
Clicked search = taller/brighter wave

let glyphIndex = Math.abs(
  px ^ py ^ ((px * py) >> 6) ^ f ^ e.h
) % glyphs.length;

user/query hash → x position
search hour     → y position
query length    → radius
clicked result  → injection intensity

Long query = bigger disturbance
Clicked query = stronger disturbance
Late-night / daytime searches appear in different vertical positions
Different users create different spatial patterns

A dead cell becomes alive if it has 3 neighbors.
A live cell survives if it has 2 neighbors.
Otherwise it dies.

query length → pitch
hour → register
clicked → volume
density → number of notes
change → rhythm instability
chaos → dissonance

Sumamry: Each AOL search becomes a disturbance in a living character grid.

The query is hidden, not displayed directly.
The query length controls visual pressure.
The word count controls wave complexity.
The search hour controls speed and vertical position.
A clicked result makes the disturbance brighter and stronger.
The user ID and query hash control the glyph pattern.
The disturbance enters a Game-of-Life grid and continues mutating.
Grid density and change become metrics for sound.
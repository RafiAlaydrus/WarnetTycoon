# Warnet Tycoon design direction

Supplied by the agent from the build brief, not by the owner. Replace any line and the UI follows the tokens in `style.css`.

Reading this as: a mobile idle game for one player on a long flight, in a night-warnet visual language (monitor-lit room, awning-stripe shopfront, amber billing readout), dial ENERGY 2 / RHYTHM 2 / MOTION 2.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 2

## Decisions and reasons

- Dark navy base (`#0f131b`, `#171d29`, `#1f2736`): the game is set in a dim cafe and played in a dim cabin, and it saves battery on OLED. Both are reasons, not "dark looks techy".
- Amber accent (`#f5b83d`): the colour of an old billing counter readout. It marks money and the one affordable action, nothing else.
- Teal (`#44d7c4`): a lit monitor. It means "on" and "healthy" and is used on screens and OK-state meters only.
- Red (`#ff6b6b`): broken, over capacity, or a failed action.
- Four customer colours (blue, coral, green, violet): colour-coded data, the only place the palette widens. Each type also has a letter tag so colour is never the only cue.
- Desk wood (`#6d4c33`): part of the scene, not UI chrome.
- System font stack: no web fonts are allowed offline. Money uses tabular numerals so the header does not jitter while it ticks.
- Radii 4 / 8 / 10 px: small radius for controls, larger for cards and desks. Nothing is pill-shaped.
- Shadow only on the modal sheet: it is the one element that sits above everything else.
- No glow, no blur, no gradients except the awning stripes, which are the identity motif (shopfront at the door, reused on the Open sign).
- Icons are custom filled glyphs drawn for this game: storefront, monitor, up arrow, person, steaming bowl, branching nodes, cog. Each one names its tab.
- Stars are the reputation meter itself, not decoration.
- The status dot on a tab appears only when something in that tab is affordable right now. It does not pulse.

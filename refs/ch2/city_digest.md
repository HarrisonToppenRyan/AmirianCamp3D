# Chapter 2, part "city": Valyndra City and the thief's interrogation

Every main-path scene here is STORY or TICKLE; none is ADULT.

## The thief
- **Aurelia Blue**, "Blue Rogue" (actor 5). Face file `Aurelia`; sprite `oc-aurelia` (index 5 in the stocks, index 6 afterwards); pictures `aurelia-blue-stocks-1` / `-2`.
- She took the Grimmoire of Conjuration (item 7) and all the gold (var 74 AURELIA_GOLD) at the end of Chapter 1 (CE 107, after label `_BOU1`).
- The heroes never catch her. The city guard arrested her off-screen "this morning" for "threatening the people of this city". She is already in foot stocks when they arrive.

## Flow (GAME_PROGRESS = variable 3)
1. **STORY, Map009 ev33 GameProgress p0** (touch, tile 16,50, needs >=110). Anne admires the walls; Boudicca calls it the mainland's strongest city. Sets **115**, transfers to Map001 (59,56).
2. **STORY, Map001 ev1 GateGuard p1** (autorun, >=115; guard at 58,52, sprite `valyndra-guard` 6, face `valyndra-guards`). Boudicca trained here at the military academy. She states their business; the guard says they grabbed a troublesome woman that morning and sends them to **Vice-Captain Elora** in the guard-house barracks ("take the right street"). Sets **120**, quest step `leadto_valyndra`. Optional hint: CE 34 at 120.
3. **Map001 ev73 BarraksDoor (65,56)** -> Map048 (11,10).
4. **Map048 ev6 Chief p1** (autorun, >=120) holds the whole interrogation. Present: Anne, Boudicca, Amaymon (voice), Elora (ev6 at 11,5, sprite `valyndra-guard` 2, face `elora`), Aurelia (ev8 at 10,5), Lieutenant Mia (ev16 at 9,10, sprite `oc-mia-healer`, face `mia`), a guard (ev14 at 9,5).
   - **STORY**: Aurelia is already laughing. Anne fumbles Elora's name and rank, says she is from the Council of Magic and asks for the stolen book. Elora refuses: the equipment is confiscated and must be processed. Player walks up 2 tiles.
   - **TICKLE** (pictures `scene-background`, `aurelia-blue-stocks-1`, `elora-tickler-1`, `boudicca-tickler-4`; BGM Town3). Boudicca admires the prisoner's feet, begs to help, then challenges Elora: one foot each, the first to make her submit wins. Elora agrees. Mia tells Anne the interrogation is tickling and that Elora is frighteningly good at it. Tools in order: fingers, a brush, toe ties (picture swaps to `aurelia-blue-stocks-2`; quest step `interrogate_aurelia`). Aurelia holds out ("you're wasting your time", "never"), then breaks: "enough, I'll never come back". Cues: aurelia idle1/idle3/tickle1-9, elora stand1-2/kneel1-4 on spot foot-l, bou tickle1-3 on spot foot-r.
   - **STORY**: Elora declares the confession obtained, bans Aurelia from the city, and lets Anne take the bag on the table (ev15 at 8,7; player walks left 2). Item 7 and the gold in var 74 come back. Sets **130**, transfers to Map001 (71,57).
5. **STORY, Map001 ev1 GateGuard p3** (autorun, >=130). Anne finds Elora chilling; Boudicca likes her and recommends a pub, the Velvet Rug. Anne wants to shop; Boudicca wants information and allies; Amaymon wants the pub. Sets **140**, quest step `recovergrimoire`, quest `CursedIsland` starts. **Chapter 2 ends here.**
6. Optional afterwards: Map048 ev6 p2, ev8 p1, ev16 (short lines); Map001 ev4 VelvetRugPost (72,31).

## What the heroes learn
Very little. No motive, employer or backstory is given; the "confession" is only that she gives in and promises never to return. They regain the Grimoire and the gold and set the next aims (allies, the Velvet Rug). The following quest (`CursedIsland`: Dawn Harbor, a boat to Amirian Island) is outside this part.

## Map001 ValyndraCity (90 x 60, tileset 2, BGM Town2)
- Walled city. **South gate** at 58-60,57 (ev6/8/9 -> world map 21,55); arrival tile 59,56.
- **South wall row (y=56)**: AureliaHideout 31,56 (later, Map151), plain doors, the gate, **Barracks 65,56 -> Map048**, Infirmary 71,56 -> Map103.
- A **river** crosses the map at y=35-37 with bridges at x=19 and x=59. South of it: houses, haunted house 38,48 (Map145).
- **Middle (y=18-32)**: market square around 56-67,18-24 with public stocks at 66,21; Velvet Rug 71,29 -> Map039; clothing 50,29 -> Map117; **Guard HQ 31,30 -> Map099** (locked until 140); armory 10,29 -> Map074; inn 9,18 -> Map077; temple 49,18 -> Map127; oddment shop 81,28 -> Map150.
- **North (y=2-15)**: castle gate 37,2 -> Map064; library 19,7 -> Map013; armor 50,7 -> Map075; items 59,6 -> Map076; blacksmith 69,7 -> Map116; magic shop 76,15 -> Map094.

## Map048 Barraks, shown as "Capital City Dungeons" (23 x 13, tileset 3, no BGM)
One room. Exit ev5 at 11,11 (bottom middle) -> Map001 (65,57). Open floor at y=8-11. The stocks stand at the centre back: guard 9,5, Aurelia 10,5, Elora 11,5. Evidence table at 8,7. Mia at 9,10. Four wall torches at 2,6 / 6,6 / 16,6 / 20,6; a passage runs round the top (y=0-3). Sketches: `city_map_ascii.txt`.

## Progress markers
Var 3: 110 -> 115 -> 120 -> 130 -> 140. Var 74 AURELIA_GOLD. Item 7. Switch 163 UNLOCKED_BOUDICCA (several lines need Boudicca in the party).

## Side content, one line
Shops, Guard HQ jobs (CE 187, 196, 198, with a later job to recapture Aurelia), Map165, Map064, the Velvet Rug and CE 176/177 are later or optional play; CE 187 has ADULT scenes, the rest was not checked.

## Could not determine
- Quest log wording (plugin settings, outside the data folder).
- What moves progress from 140 to 200+; only a debug menu (CE 35) sets 200.
- The dungeon's tile art (layout is from passability only).
- Map025 / Map012 hold the Chapter 1 epilogue (progress 30-50), not a Chapter 2 closing scene.

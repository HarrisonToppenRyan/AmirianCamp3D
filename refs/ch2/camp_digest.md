# Chapter 2, part "camp": digest

## Two findings that change the plan

1. **The campsite is Map053 "Trader Post" (25x25), and it sits BEFORE the Forest of Lys, not between the forest and the capital.** World map order (Map009): North Forest exit (38,14) -> Trader Post (29,21) -> Forest of Lys north gate (31,26) -> forest south exit, world (28,42) -> Valyndra approach (16,50). The camp's own south exit drops straight into the forest (Map036 21,3). 
2. **Nothing at the camp is required.** GAME_PROGRESS (var 3) never changes there. Common events 190/191/192 are one camp system shared by maps 4, 53, 100 and 113. Map100 opens only at GAME_PROGRESS >= 300 and Map113 is a far-east beach: neither is on this route. The chapter-select menu (CE35) drops "Chapter 2" at Map053 (17,8).

## Flow in order

1. **STORY. World map, Map009 ev16 (autorun) -> CE130 `_WORLDMAP1`.** Anne: "For a moment I'd thought we'd stay in that forest forever!" Sets GAME_PROGRESS = 100. Boudicca is already in the party (CE107 CHAPTER1_EPILOGUE: switch 163 UNLOCKED_BOUDICCA, actor 2 added).
2. **STORY. Enter Trader Post.** Map009 ev36 (29,21), no condition.
3. **STORY. Camellia Flaire, apothecary, first meeting.** Map053 ev2 (18,7), page needs GAME_PROGRESS >= 100 -> CE180 `MEETING1`. Sets switch 165 UNLOCKED_CAMELIA, opens her shop (CE182).
4. **TICKLE (optional). Fortune reading from Anne's soles, 100 gold.** CE180 `FORTUNE` -> `GIPSY`. Camellia kisses and licks the soles to "read the wrinkles"; failing the action gauge (CE20) gets tickling and a retry. The chapter 2 reading (CE135) describes the blue thief: silver hair, blue and red bangs, hiding in the capital, about to escape.
5. **STORY. Campfire, ev1 (17,10) -> CE190 CAMPSITE_MAIN.** Random Anne line, then Rest (Save / Sleep and Save / Dismiss Party) / Crafting / HandBag.
6. **STORY. Sleep -> CE191 CAMPSITE_NIGHT.** Black screen, switch 10 NIGHT_MODE on, followers hidden, Anne lying down (oc-anne index 4), forest_night ambience, fire glow (CE132, picture scene-campfire), blue tint. GAME_PROGRESS < 100 = always safe. From 100 on, var 29 NIGHTMARE_NIGHT counts down; it starts at 0, so **the first night of chapter 2 is a Lilith nightmare.**
7. **MIXED. Lilith nightmare, CE49 `NIGHTMARE`.** Note "A dark shadow takes over Anne's peaceful dreams...", music Theme7, one of six random variants. Variants 2 (soles and toes), 4 (floating tickler hand), 5 (sides and feet), 6 (belly) are tickling. Variants 1 and 3 are ADULT. The source shows Anne undressed in all of them. Then an action gauge: success = Lilith leaves ("We'll meet again real soon!!"); fail = another round; fail at LUST_GAUGE (var 23) >= 100 = ADULT game over. Afterwards var 29 is set to 0-5 nights.
8. **STORY (optional). Night roaming.** Offered only when LUST_GAUGE >= 30. Exits refuse at night; the fire ends the night.
9. **TICKLE (optional). Anne tickles sleeping Camellia.** ev16 (17,6) -> CE180 `SLEEPY`. Camellia's bare feet stick out of the tent; Anne tickles and licks until "DEAL!". Switch 47 CAMELIA_DEAL: one sale, one free reading. Two early-access options are ADULT.
10. **TICKLE (optional). Anne tickles sleeping Boudicca.** ev17 page 3 (20,9), sprite oc-boudicca index 4 -> CE166 `NIGHT` -> `BOU`. Three stages by menu: upper body (ribs), lower body (feet), hogtie (feet). Taunts: "I love those caramel toes!", "Now these smooth tanned feet are mine!!". The follow-up night menu has an ADULT first option.
11. **TICKLE (optional, day, Boudicca out of the party, lust > 40).** CE166 `FLIRT` -> `ANNE`: Boudicca hogties Anne and tickles her feet (night picture is undressed). Or "You first!" -> `BOU`.
12. **STORY. Morning, CE191 `WAKEUP`.** NIGHT_MODE off, resources regrow, autosave.
13. **STORY. Leave.** ev12/13 (11-12,22) -> Map036 (21,3); CE130 `_LYSFOREST1` sets 105. Forest south exit (Map036 ev13) sets 110; Map009 ev33 (16,50) sets 115 and enters Map001 (59,56).

## CAMPSITE_QUESTS (CE192): none fire in chapter 2

Runs on leaving the fire menu by day, only when GAME_PROGRESS > 200.
- **Camellia's recipe book** (Map053, > 300, var 41 CAMELLIA_JOBS = 0): stolen overnight, Coru tracks the scent east to Dawn Harbor, 500 gold reward, quest CAMY01.
- **LosuChan** (early access, >= 400): CE168.
- **Boudicca rescue** (>= 640, var 78 BOUDICCA_QUEST = 1): Boudicca gone, red-hood footprints, Mia suggests interrogating the prisoners in the capital jail. Quest RescueBoudicca.

Aurelia's night raid (CE191 `AURELIA`, CE176 not read in detail) needs var 59 AURELIAS_REVENGE = 1: also later.

## Map053 layout (x right, y down)

- Exits: north (13-14,3) and east (23,12-13) to the world map; south (11-12,22) to the forest.
- West: fortune teller's cabin (4-10, 8-11), door (7,11), locked until 300. Stream and pond in the north-west. Cliffs in the north-east and south-east corners.
- Camellia's tent, 3x3 at (16-18,4-6); she stands at (18,7). 1000 gold behind it (19,4). A second 3x4 structure at (20-22,2-5).
- Signpost (15,10), campfire (17,10), empty stone pool (12-14,12-14), dead tree (20,17), grape plot in the south-west (2-6,15-19), fairies (12,15) and (5,3).
- Later companions also stand here (Mia, Mira, Coru, Linda, Lynn, Lynessa, Genna, Yina, LosuChan): none in chapter 2.

## Could not determine

- What the tiles look like: object names are inferred from tile ids and event positions; the 3x4 structure is unidentified.
- What `KunCommandAlias quest CHAPTER2 / LYSFOREST` do (plugin settings are outside the data folder).
- Which body part Lilith variant 4 targets.

# Forest of Lys (part "lys") : digest

V3 = GAME_PROGRESS. Boudicca = actor 2 (joins in CE107, SW163).

## Flow, in order

1. **End of chapter 1** (CE107 CHAPTER1_EPILOGUE, label PARTY). STORY. Chapter01 quest completes, transfer to **Map009 WorldMap (38,15)**, V3=50.
2. **World map arrival** (Map009 ev16, autorun, CE130 MAP_SCRIPT label _WORLDMAP1, while V3<100). STORY. Anne: "Great! For a moment I'd thought we'd stay in that forest forever!" V3=100, quest Chapter02 starts (CE12, CE13).
3. **Walk south-west on the world map.** Signpost ev48 (39,15). Optional: ev36 "TraderPost" (29,21) opens Map053, a camp hub with a fireplace; its south exit also leads to Map036 (21,3).
4. **World tile ev10 "ForestofLys" (31,26)**, player touch, transfer to **Map036 (21,3)**. Path-finding shows it is the only way south.
5. **Forest intro** (Map036 ev59 "SceneSeup", autorun, CE130 label LYSFOREST, while 100<=V3<105). STORY. Amaymon: stick to the South Road; Boudicca warns of magical creatures. V3=105.
6. **Dryad on the bridge** (Map036 ev58 "DryadChapter2" at (30,39), sprite dryads #7; second bridge on the road, the only crossing).
   - Page 0, touch: Anne "Hello?" / "Heeads Up!", then CE70 SceneDryad label CAPTURE. Stage 1 (CAPTURE1, picture anne-dryad-1) is TICKLE: branches tickle her feet, one clothing slot (shoes) drops through CE28, CE20 ACTION_GAUGE key prompt to break free. Stages CAPTURE2 and GAMEOVER are ADULT (nudity). Afterwards Anne: "Ok then we'll have to do the hard way!" Self switch A.
   - Page 1, touch: battle troop 25 "Sexy Treant" (one Dryad, no escape). Win: self switch B (dryad removed, bridge free), SW9 DOMINATION_MODE, CE70 SUBMIT/DOMINATION = TICKLE minigame where the party tickles the dryad in 3 stages (CE46), then SW194 UNLOCK_DRYAD. Lose: SW4 GAME_OVER_MODE and the ADULT game-over scene.
7. **Road south** past signpost ev41 (19,58), two more bridges (20,87-88) and (29-31,99), unguarded; signpost ev60 (30,121).
8. **South exit** (Map036 ev13 "SouthExit" (25,126), page 0 at V3>=100). STORY. Anne: "That's the main road!" V3=110, transfer to WorldMap (28,42), quest objective "through_forestoflys" complete, then teleport banter with Amaymon. Page 1 (V3>=110) is a plain exit.
9. **Hand-off** (Map009 ev33 "GameProgress" (16,50), V3>=110, the only tile leading to the gate). STORY. "Oh wow, those walls are quite impressive!", transfer to **Map001 ValyndraCity (59,56)**, V3=115. No campsite scene lies on this path (SouthCampSite needs V3>=300).

## Map036 ForestOfLys

60 x 130 tiles, tileset 2 "Exterior": grass, dense tree walls, a dirt road, rivers with waterfalls. BGM Forest1. No random encounters; enemies are visible events.
Layout: two near-identical halves stacked north to south. In each, the road crosses an east-west river at x=20 (y 27-28, then 87-88), turns east over a north-south river at x 29-31 (y 39, then 99), loops east and returns west. Waypoints: (21,2) (24,10) (29,17) (23,26) (20,28) (21,35) (30,39) (38,42) (44,48) (37,53) (25,59) (22,62) (25,71) (27,81) (20,87) (21,95) (30,99) (42,104) (42,118) (35,123) (25,126).
Exits: NorthExit ev6/7 (20-21,2) to WorldMap (31,25). SouthExit ev13 (25,126). ShrineExit ev63 (4,74) to Map133. LisGlade ev90 (3,15) to Map028 once the weeds are cleared (SW46).

### Every event (by name)
- Story: SceneSeup 59; DryadChapter2 58; SouthExit 13; NorthExit 6, 7.
- Signs: SignPost 40 (24,5), 41 (19,58), 60 (30,121).
- Slime x8 (ev 5, 10, 14, 17, 18, 29, 34, 35): wandering enemy, CE59.
- Hornet x8 (9, 15, 36, 37, 38, 42, 49, 54): fast wandering enemy, CE58.
- Myconid x6 (12, 16, 20, 21, 23, 27), RedMyconid x5 (11, 19, 22, 24, 25): mushroom on the ground that springs an ambush, CE52. MyconidRespawn 8 (38,3): gallery NPC, V3>=300.
- WildVine x4 (51, 55, 56, 72): wandering vine, CE51. WildVineSpawn 57, 94: invisible snare on the road.
- TrapHole 33, 39 and GnomeHole 64 (13,40): pitfalls, CE77.
- LogScene 85 (44,24): hollow log with herbs, CE78.
- Pickups (regrow): Berries x7, Aloe x9, Clover x4, Mandragora x8.
- Later quests only: Treant 52, mothgirl 119 (V3>=200); MOTHGIRL1/2, MOTHSCENE01, MOTHQUEST02; Witch x3; Kun x4; EvilKun x8; PumpkinFiend x5 (Halloween).
- Scenery: waterfall pieces, Fairy 124, Weeds 120/121 (climb), LisGlade 90/91.

### Encounters (touch, battle; win = party tickles the enemy, lose = capture)
- Slime (oc-monsters #4; troops 15, 16): capture stage 1 TICKLE (feet, armpits), later stages ADULT.
- Hornet (oc-monster-girls #0; troops 26, 27): capture ADULT at every stage (foot tickling with sexual content).
- Myconid (myconid-fungus #0/#1; troops 3-5): capture ADULT; on a win the choice is stomp, worship or spare.
- Wild vine / Ivy Maiden (oc-monsters #1; troops 8-10): stage 1 TICKLE (feet), later ADULT.
- Trap hole: TICKLE, wordless (stuck in a hole, feet tickled below); failing the ivy version leads to an ADULT scene.
- Hollow log: TICKLE, wordless.
- Dryad: see scene 6.

## Sub-maps (none required by the main story)
- 28 LysGlade: hidden glade (mandragoras, fairies, imp, Alraune gallery); entered through the weeds at (3,15).
- 133 ShrineOfLys: small shrine with statue and chest, Moth Queen quest; entered at (4,74) or from the world map (SW43).
- 92 LysMountain: world-map entry, V3>=300.
- 37 LysCaves: reached from CreepyForest or the outpost basement; slimes, Scylla.
- 23 AbandonedOutpost1F: world-map "WesternFort", guard jobs.
- 134 CreepyForest01: reached from LysMountain; corrupted dryads, wraiths (late game).

## Could not determine
- How the west bank (weeds to LysGlade, ShrineExit) is reached: passability shows no crossing.
- What the pictures show (anne-dryad-1, dryad-domination-1/2): images not read.
- Plugin behaviour (KunTags, KunCommandAlias): inferred; js folder not read.
- Whether the Trader Post is the "campsite" meant for this chapter.

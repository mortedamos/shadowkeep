// SHADOWKEEP - THE STORY.  Every word the game speaks is in this one file, so it can be rewritten without touching the code.
//
// Prague, Bohemia, 1541 - the year of the great fire of Prague, when the Lesser Town and the Castle hill burned.  A castle has come up out of the earth in the countryside and taken the sun.  The monsters of the shadow realm
// walk.  A man known only as THE STRANGER kneels at a grave on a hill above the city - the grave of someone he loved (his wife? his sister? his lover? the game never says) - and watches
// Prague begin to burn.  He rises, draws SILBERZAHN, the silver tooth, and goes down to the city to put an end to Shadowkeep.
//
// She is still with him.  She is a ghost, pale and see-through, her lower half fading into nothing, and she is visible only in an arcane (BLUE) light.  Every gravestone and tablet he
// reads is her, speaking to him: advice about the road ahead, and what it is to be a ghost.  Her name, and what she was to him, are never said (the stone on the hill is worn smooth).
//
// The alchemists' Great Work has four stages - Nigredo (the blackening, death and rot), Albedo (the whitening, washing clean), Citrinitas (the yellowing) and Rubedo (the reddening, the sun).
// Shadowkeep is a Great Work gone wrong: its lord means to finish it by locking the Sun - gold, Sol - inside his furnace, the athanor, until all the world is still and incorruptible.
// The seven metals are the seven planets, so the six keys of the locked vaults are six metals (lead, iron, silver, tin, copper, mercury) and the Sun - gold, the Dawn - is what he stole.
//
// Most text is capital letters (the game's font); the gravestones and tablets are written in mixed case, because they are drawn in the face of the stones (Eroded Motta, which has no colon: they become dashes).  Lines for boxes are kept short.

export const STORY = {
  // ---------------------------------------------------------------------------------------------------------------------------------------- the opening scene (scenes.js)
  opening: {
    title: 'PRAGUE  1541',
    sun: 'THE SUN HAS NOT RISEN SINCE SHADOWKEEP CAME OUT OF THE EARTH.',
    fire: 'AND NOW THE CITY BURNS.',
    sword: ['SILBERZAHN', 'THE SILVER TOOTH'],
  },

  // ---------------------------------------------------------------------------------------------------------------------------------------- her: the gravestones and tablets (by id)
  speaker: 'HER VOICE',
  tablets: {
    tabv0: `There was never a stone big enough for the two of us, was there? Go down to the city. I will follow where I can. Look for blue light: that is where I show.`,
    tab0: `The bells rang at dusk, and then the things came down from the hill. Prague has not walked its own streets without fear since. Do not stop to pray. No one is listening.`,
    tab9: `I can still hear the bells. They were the first thing to go silent. The priest barred the chapel door and prayed, and I watched from the steps.`,
    tab10: `Mercy, he calls it: to burn what he cannot protect. He waits in the square below. You will not talk him down. You never could talk anyone down.`,
    tab1: `They say the keep swallowed the sun. I think it is stranger than that. Look at the gate: it is not locked. It is waiting for you.`,
    tab2: `The dead here do not rest. I know the feeling. Strike them down - gently if you can, firmly if you must.`,
    tab11: `They walk the field looking for their homes. I look for mine, too. No one warns you that a ghost can be homesick.`,
    tab12: `The mire takes what the grave refuses. Do not stand still. You hate wet boots, I remember. I will try not to laugh.`,
    tab13: `Something sings beneath the water, and it knows your name. I am almost sure I know it too. Almost. Is that what death is - almost?`,
    tab14: `The old city drew its water from these vaults. The Vltava remembers every flood. Do not fight the current - use it. You have the look of a man about to fight the current.`,
    tab15: `Beyond the last sluice is the gate the water was made to keep. Something older than Prague keeps it now. It will try to drown you. Please do not let it.`,
    tab3: `The hall rang with feasting once. Now the faces on the pillars watch you, and some of them watch back. I am not the only ghost here. I am just the only one who likes you.`,
    tab4: `These stairs climb to the chapel. The bells have not rung since the lord came down. When you reach the top, look back at the city. Just once.`,
    tab5: `Here the faithful prayed, and here they were taken. I used to light candles in a church like this, and never asked for anything for myself. I should have.`,
    tab6: `The gulf is too wide for any leap. Only quicksilver crosses a gulf like this. Dash, and do not look down.`,
    tab7: `The lord laid his household to rest here and promised them sleep. Someone keeps waking them. I know what it is to be woken. They are not wicked. They are tired.`,
    tab18: `The clock still keeps Prague's hour. The apostles still walk in their windows, and the sun is still on its dial. It is the only sun left.`,
    tab17: `It is very dark here. Do not be afraid of it. I will go ahead of you.`,
    tab16: `An engineer built a machine to hold the sun below the hills. Listen to the gears: the only clock in Prague that still keeps time - and it is keeping the wrong hour.`,
    tab8: `He waits above, the one who took the sun. I will not ask you to turn back. I only ask that you come home afterward. It is a long way down from the hill.`,
  },

  // ---------------------------------------------------------------------------------------------------------------------------------------- the bosses: a few words before the fight, a few after
  // (keyed by the name shown over the boss's health bar; the first line of each pair is the boss, the other is THE STRANGER)
  talk: {
    'THE CINDER WARDEN': {
      before: [['THE CINDER WARDEN', 'BEHOLD THE MERCY OF FIRE, TRAVELLER. WHAT CANNOT BE SAVED MUST BE SPARED THE SLOW DYING.'], ['THE STRANGER', 'YOU LIT THE CITY.'], ['THE CINDER WARDEN', 'I LIT A LAMP. THE CITY HAS MERELY NOT UNDERSTOOD IT YET.'], ['THE STRANGER', 'THEN I WILL EXPLAIN IT TO YOU.']],
      after: [['THE CINDER WARDEN', 'IT WAS... A KINDNESS... I WAS SURE IT WAS A KINDNESS.']],
    },
    'THE GATEKEEPER': {
      before: [['THE GATEKEEPER', 'NO... ONE... PASSES.'], ['THE STRANGER', 'I AM NOT ONE. I AM SOMEONE.'], ['THE GATEKEEPER', 'THE GATE... DOES NOT KNOW... THE DIFFERENCE.']],
      after: [['THE GATEKEEPER', 'OPEN... THE GATE IS OPEN... HOW LONELY... IT WAS TO HOLD IT SHUT.']],
    },
    'THE MIRE MOTHER': {
      before: [['THE MIRE MOTHER', 'THERE YOU ARE, LITTLE ONE. YOU HAVE BEEN AWAY SO LONG. THE WATER WAS WORRIED.'], ['THE STRANGER', 'I AM NOT YOUR CHILD.'], ['THE MIRE MOTHER', 'THEN WHOSE? SOMEONE HAS MISSED YOU. I CAN HEAR IT IN THE REEDS.'], ['THE STRANGER', '...']],
      after: [['THE MIRE MOTHER', 'SLEEP, THEN. EVERYONE SLEEPS... EVENTUALLY.']],
    },
    'THE DROWNED WARDEN': {
      before: [['THE DROWNED WARDEN', 'THE WATER WAS PROMISED A KEEPER. THE KEEPER WAS PROMISED A WATER. WE HAVE KEPT OUR WORD.'], ['THE STRANGER', 'THE PROMISE IS OVER.'], ['THE DROWNED WARDEN', 'PROMISES ARE NOT SO EASILY DRAINED.']],
      after: [['THE DROWNED WARDEN', 'THE GATE... WILL NOT HOLD... WITHOUT ME...']],
    },
    'THE PHANTOM STEED': {
      before: [['THE PHANTOM STEED', 'RIDE WITH US, SOLDIER. THERE IS ALWAYS A PLACE FOR ONE MORE.'], ['THE STRANGER', 'I AM NO LONGER A SOLDIER.'], ['THE PHANTOM STEED', 'THEN WHY DO YOU STAND LIKE ONE?']],
      after: [['THE PHANTOM STEED', 'THE HUNT RIDES ON... A SADDLE EMPTY... AS ALWAYS...']],
    },
    'THE REFLECTION': {
      before: [['THE REFLECTION', 'WHO DO YOU TALK TO, WHEN NO ONE IS THERE?'], ['THE STRANGER', '...'], ['THE REFLECTION', 'I CAN SEE WHAT YOU CANNOT. SHE WOULD NOT KNOW YOU NOW.'], ['THE STRANGER', 'SHE KNOWS ME.'], ['THE REFLECTION', 'THEN SHE KNOWS WHAT YOU ARE BECOMING.']],
      after: [['THE REFLECTION', 'BREAK THE GLASS, AND YOU ONLY SEE YOURSELF IN PIECES.']],
    },
    'THE SERAPH OF ASH': {
      before: [['THE SERAPH OF ASH', 'LAY DOWN YOUR SWORD, WANDERER. GRIEF IS HEAVIER THAN STEEL. I CAN TAKE IT FROM YOU.'], ['THE STRANGER', 'I DO NOT WANT IT TAKEN.'], ['THE SERAPH OF ASH', 'THEN YOU WILL CARRY IT INTO THE DARK, AND THE DARK WILL ASK FOR IT.']],
      after: [['THE SERAPH OF ASH', 'AT LEAST... YOU CARRY IT... HONESTLY.']],
    },
    'THE CRIMSON COUNT': {
      before: [['THE CRIMSON COUNT', 'A GUEST! HOW DELIGHTFUL. IT HAS BEEN SO LONG SINCE ANYONE CAME TO MY TABLE WITH A PULSE.'], ['THE STRANGER', 'I AM NOT STAYING FOR DINNER.'], ['THE CRIMSON COUNT', 'NONSENSE. YOU ARE THE DINNER. DO TRY TO BE GRACIOUS ABOUT IT.']],
      after: [['THE CRIMSON COUNT', 'A MOST... UNMANNERLY... GUEST...']],
    },
    'THE BRAZEN HIEROPHANT': {
      before: [['THE BRAZEN HIEROPHANT', 'NIGREDO, ALBEDO, CITRINITAS - AND NOW YOU, THE IMPURITY IN MY RUBEDO. I HAD ALMOST FINISHED THE GREAT WORK.'], ['THE STRANGER', 'YOU STOPPED THE SUN.'], ['THE BRAZEN HIEROPHANT', 'I HELD IT. THAT IS WHAT A VESSEL DOES. A LITTLE LONGER, AND ALL OF TIME WOULD HAVE BEEN GOLD.'], ['THE STRANGER', 'THERE IS NO GOLD. THERE IS ONLY WHAT YOU DID TO PRAGUE.']],
      after: [['THE BRAZEN HIEROPHANT', 'THE GEARS... THEY ARE STILL TURNING... WHO WILL WIND THEM NOW...']],
    },
    'THE SHADOW LORD': {
      before: [['THE SHADOW LORD', 'SO. THE LAST SPARK OF THE OLD WORLD WALKS INTO MY ATHANOR. I HAVE WATCHED YOU CLIMB MY STAIRS, STRANGER.'], ['THE SHADOW LORD', 'I TOOK THE SUN TO FINISH THE WORK: A WORLD WITHOUT DECAY, WITHOUT GRIEF, WITHOUT ENDINGS.'], ['THE STRANGER', 'YOU TOOK HER.'], ['THE SHADOW LORD', 'I TOOK MANY. SHE WAS ONE OF MANY. I DO NOT EVEN KNOW HER NAME.'], ['THE STRANGER', 'GOOD. THEN YOU CANNOT SPEAK IT.']],
      after: [['THE SHADOW LORD', 'THE SUN... IT BURNS... IS THIS... WHAT I WAS KEEPING FROM THEM...']],
    },
  },

  // ---------------------------------------------------------------------------------------------------------------------------------------- the ending (ui.js Ending)
  ending: {
    title: 'THE SUN RISES OVER BOHEMIA',
    lines: ['THE SHADOWKEEP CRUMBLES.', 'THE STRANGER RETURNS TO HER GRAVE,', 'AND THE SUN FALLS ON THE STONE.', 'AND SOMEONE WHO NEEDS NO BLUE LIGHT', 'TO BE SEEN STANDS BESIDE HIM.'],
  },
};

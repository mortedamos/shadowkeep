// Movement constants shared by the player and the level validator (so generated levels are checked against the REAL physics).
export const RUN = 1.6, GRAV = 0.21, MAXFALL = 6.2, JUMP = -5.05, DJUMP = -4.5;
export const ACC = 0.24, FRIC = 0.3, AIRACC = 0.17, DASH_V = 4.6, DASH_T = 12;
export const PW = 13, PH = 36;       // player hitbox
// handy derived facts (measured with the real player): single jump rises ~3.6 tiles and clears ~4.8; double jump ~6.5 / ~7.9; double jump + dash clears ~9-10.7

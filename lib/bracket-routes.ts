export interface BracketRoute {
  matchLabel: string
  homeRoute: string
  awayRoute: string
}

// Qualifying-path labels for each knockout match, ordered by kickoff time within each round.
// homeRoute/awayRoute show which group positions qualify into each slot.
export const BRACKET_ROUTES: Record<string, BracketRoute[]> = {
  R32: [
    { matchLabel: 'Match 73', homeRoute: 'Runner-up Group A', awayRoute: 'Runner-up Group B' },
    { matchLabel: 'Match 76', homeRoute: 'Winner Group C', awayRoute: 'Runner-up Group F' },
    { matchLabel: 'Match 74', homeRoute: 'Winner Group E', awayRoute: 'Best 3rd: A/B/C/D/F' },
    { matchLabel: 'Match 75', homeRoute: 'Winner Group F', awayRoute: 'Runner-up Group C' },
    { matchLabel: 'Match 78', homeRoute: 'Runner-up Group E', awayRoute: 'Runner-up Group I' },
    { matchLabel: 'Match 77', homeRoute: 'Winner Group I', awayRoute: 'Best 3rd: C/D/F/G/H' },
    { matchLabel: 'Match 79', homeRoute: 'Winner Group A', awayRoute: 'Best 3rd: C/E/F/H/I' },
    { matchLabel: 'Match 80', homeRoute: 'Winner Group L', awayRoute: 'Best 3rd: E/H/I/J/K' },
    { matchLabel: 'Match 82', homeRoute: 'Winner Group G', awayRoute: 'Best 3rd: A/E/H/I/J' },
    { matchLabel: 'Match 81', homeRoute: 'Winner Group D', awayRoute: 'Best 3rd: B/E/F/I/J' },
    { matchLabel: 'Match 84', homeRoute: 'Winner Group H', awayRoute: 'Runner-up Group J' },
    { matchLabel: 'Match 83', homeRoute: 'Runner-up Group K', awayRoute: 'Runner-up Group L' },
    { matchLabel: 'Match 85', homeRoute: 'Winner Group B', awayRoute: 'Best 3rd: E/F/G/I/J' },
    { matchLabel: 'Match 88', homeRoute: 'Runner-up Group D', awayRoute: 'Runner-up Group G' },
    { matchLabel: 'Match 86', homeRoute: 'Winner Group J', awayRoute: 'Runner-up Group H' },
    { matchLabel: 'Match 87', homeRoute: 'Winner Group K', awayRoute: 'Best 3rd: D/E/I/J/L' },
  ],
  R16: [
    { matchLabel: 'Match 90', homeRoute: 'Winner Match 73', awayRoute: 'Winner Match 75' },
    { matchLabel: 'Match 89', homeRoute: 'Winner Match 74', awayRoute: 'Winner Match 77' },
    { matchLabel: 'Match 91', homeRoute: 'Winner Match 76', awayRoute: 'Winner Match 78' },
    { matchLabel: 'Match 92', homeRoute: 'Winner Match 79', awayRoute: 'Winner Match 80' },
    { matchLabel: 'Match 93', homeRoute: 'Winner Match 83', awayRoute: 'Winner Match 84' },
    { matchLabel: 'Match 94', homeRoute: 'Winner Match 81', awayRoute: 'Winner Match 82' },
    { matchLabel: 'Match 95', homeRoute: 'Winner Match 86', awayRoute: 'Winner Match 88' },
    { matchLabel: 'Match 96', homeRoute: 'Winner Match 85', awayRoute: 'Winner Match 87' },
  ],
  QF: [
    { matchLabel: 'Match 97', homeRoute: 'Winner Match 89', awayRoute: 'Winner Match 90' },
    { matchLabel: 'Match 98', homeRoute: 'Winner Match 93', awayRoute: 'Winner Match 94' },
    { matchLabel: 'Match 99', homeRoute: 'Winner Match 91', awayRoute: 'Winner Match 92' },
    { matchLabel: 'Match 100', homeRoute: 'Winner Match 95', awayRoute: 'Winner Match 96' },
  ],
  SF: [
    { matchLabel: 'Match 101', homeRoute: 'Winner Match 97', awayRoute: 'Winner Match 98' },
    { matchLabel: 'Match 102', homeRoute: 'Winner Match 99', awayRoute: 'Winner Match 100' },
  ],
  THIRD_PLACE: [
    { matchLabel: 'Match 103', homeRoute: 'Loser Match 101', awayRoute: 'Loser Match 102' },
  ],
  FINAL: [
    { matchLabel: 'Match 104', homeRoute: 'Winner Match 101', awayRoute: 'Winner Match 102' },
  ],
}

## Daily Non‑Attacking Chess Puzzle

A daily puzzle where you maximize points by placing chess pieces on a generated board. Each day produces a deterministic layout of **valid** and **blocked** squares; pieces may only sit on valid squares and cannot attack or be attacked by any other piece you place.

### Core Rules
- Board: default 8x8; daily seed can alter size/shape later.
- Squares: each day marks certain squares as blocked (unusable) and the rest as valid.
- Pieces: use standard chess moves for line of sight (no colors/turns). All pieces you place are on the same side and must be mutually non-attacking.
- Objective: achieve the highest total score for the day by placing pieces on valid squares without any pair of pieces threatening each other.
- Victory condition: leaderboard shows best score and your best attempt; optional time/attempt limits per day.

### Scoring (tunable)
- Queen: 9
- Rook: 5
- Bishop: 3
- Knight: 3
- Pawn: 1
- Optional King: 0 or 2 (mostly to create blocking without large value)

### Generation Notes
- Deterministic per day: seed with UTC date (e.g., `YYYYMMDD`) so everyone sees the same board.
- Valid/blocked squares: start from uniform random using the daily seed; consider constraints so the puzzle is solvable (e.g., guarantee at least N valid squares; avoid islands too small for any piece).
- Optional variants: irregular boards (shapes), pre-placed forced pieces, or banned piece types for that day.

### Baseline Puzzle Logic
- A placement is legal if **no piece attacks any other** using standard move patterns:
  - Queen: rook+bishop lines until first obstacle.
  - Rook/Bishop: straight/diagonal lines until first obstacle.
  - Knight: L-moves.
  - Pawn: capture diagonally forward (pick a fixed forward for all pawns to avoid ambiguity).
  - King (if used): adjacent 1-square moves.
- Blocked squares stop sliding pieces but cannot hold pieces.
- Score = sum of placed piece values.

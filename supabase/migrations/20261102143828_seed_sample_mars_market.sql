/*
# Add sample prediction market

## 1. Summary
Inserts one open sample market so the page has something to show and trade on. It uses the question from the original project seed data.

## 2. Changes
- `markets`: one new row, "La prima missione umana su Marte avverra entro il 2030?", with liquidity parameter 100 and no shares bought yet.

## 3. Notes
1. Migration is idempotent: the row is only inserted if a market with the same title does not already exist.
2. No existing data is changed.
*/

INSERT INTO markets (title, description, b)
SELECT
  'La prima missione umana su Marte avverra entro il 2030?',
  'Mercato di esempio: scommetti SI o NO sull''esito della prima missione umana su Marte.',
  100
WHERE NOT EXISTS (
  SELECT 1 FROM markets WHERE title = 'La prima missione umana su Marte avverra entro il 2030?'
);

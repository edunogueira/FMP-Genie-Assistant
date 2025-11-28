# FMP Genie Assistant

**FMP Genie Assistant** is a Tampermonkey userscript that enhances the **FootballManagerProject** player page with advanced analytical tools.
It recalculates positional ratings, estimates positional and tactical gains, models set-piece effectiveness, and displays skill-by-skill breakdowns directly inside the existing UI.

The script behaves like an in-browser “Genie Scout” for FMP.

---

## Features

---

## 1. Recalculated Positional Rating

The script recomputes the player’s rating for every position using the **official FMP weight tables**.

Includes:

* Exact weight profiles for GK and outfield positions
* Group logic for dual positions (DL/DR, ML/MR, OML/OMR)
* Highlighting:

  * **Yellow** → the player’s current position
  * **Green** → best alternative position
* Rating normalization based on the player’s real in-game rating

A complete rating matrix is displayed below the skill card.

---

## 2. Position Gain Breakdown

Each FMP position grants internal skill multipliers (hidden gains).
The script exposes these gains clearly.

For each position:

* Shows **Original**, **Gain**, **Bonus**, and **Δ (difference)**
* Button opens a detailed modal with a full skill-by-skill breakdown
* Button label shows the **total positional gain**
* Best position by gain is automatically highlighted

The table respects the exact attribute order used by the game engine.

---

## 3. Set Piece Effectiveness Model

Fully implements the documented set-piece formulas used in FMP.

### Corner / Freekick:

```
Tec + Cro + 0.5 * Lon
```

### Direct Freekick:

```
Tec + Fin + 0.5 * Lon
```

### Penalty:

```
Tec + 1.5 * Fin
```

### Talent bonus (public SET talent):

| Talent | Bonus |
| ------ | ----- |
| 1      | 0%    |
| 2      | 8.9%  |
| 3      | 35%   |
| 4      | 80%   |

### Goalkeepers:

* Uses only **Kick**
* Freekicks scaled down (~40%)
* Dedicated GK set-piece table displayed below the skills

All values are computed directly from real player skills.

---

## 4. Tactical Performance by Tactic (Fil / Sho / Lon / Cou / Win)

Uses the official **tactic gain matrices** to estimate how well the player fits each tactic in his tactical zone.

Process:

1. Converts `fp` (DC, DL, MC, ML, MR, FC, OML/OMR/FL/FR) into a **tactical zone**
2. Applies gain matrices for:

   * **Fil** – Through passes
   * **Sho** – Short passes
   * **Lon** – Long passes
   * **Cou** – Counter attack
   * **Win** – Wing attack
3. Calculates a **Tactical Score** for each tactic
4. Displays:

   * One row per tactic
   * Score button (opens modal with skill breakdown)
   * Best tactic highlighted in green

The matrices are stored in `TACTIC_GAINS` and can be fine-tuned manually.

---

## 5. Talent Rendering

The script appends the **actual numeric values** of the public talents directly in the existing talent table:

* ADA
* AGI
* SET
* STR

Keeps the original UI layout intact.

---

## 6. Clean and Native UI Integration

* Uses the original modal system (`uiMessageBox`)
* Injects tables using the site’s styling (`skilltable`)
* No layout breaks
* No external libraries
* Loads automatically when the player page is ready

---

## Installation

1. Install **Tampermonkey** in your browser.
2. Install the script:

```
https://raw.githubusercontent.com/edunogueira/FMP-Genie-Assistant/main/FMPGenieAssistant.user.js
```

3. Open any player page:

```
https://footballmanagerproject.com/Team/Player?id=XXXXX
```

The assistant loads instantly.

---

## Development

Clone:

```bash
git clone https://github.com/edunogueira/FMP-Genie-Assistant.git
cd FMP-Genie-Assistant
```

### Recommended structure

```
FMP-Genie-Assistant/
  ├── FMPGenieAssistant.user.js
  ├── README.md
  └── docs/
```

### Local testing

1. Tampermonkey → Create new script
2. Paste the content of `FMPGenieAssistant.user.js`
3. Save
4. Reload an FMP player page

---

## Disclaimer

This project is **not affiliated** with FootballManagerProject.
It uses only public data already retrieved by the official website.

---

## Credits

The initial foundation of this userscript was inspired by work from **[紫竹FC](https://footballmanagerproject.com/Team/Board/?id=5283)**.

The **FMP Genie Assistant** project expands, refactors, and unifies these ideas into a modern, modular, fully documented, and extended version, adding:

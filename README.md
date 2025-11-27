# FMP Genie Assistant

**FMP Genie Assistant** is a Tampermonkey userscript that enhances the **FootballManagerProject** player page with advanced insights similar to a “Genie Scout”.
It reveals extended player information, recalculates ratings, evaluates set pieces, interprets talents, and displays tactical suggestions directly inside the UI.

---

## Features

### **1. Extended Player Rating Engine**

* Recalculates ratings using official FMP positional weight tables.
* Highlights:

  * **Current position** (yellow)
  * **Best alternative position** (green)
* Includes:

  * GK-specific weight profiles
  * Group logic for DL/DR and ML/MR
  * Position prediction factor based on the real rating

---

### **2. Set Piece Effectiveness Analyzer**

Implements the documented formulas:

#### Corner kicks

```
Tec + Cro + 0.5 * Lon
```

#### Freekicks

```
Tec + Cro + 0.5 * Lon
```

#### Direct freekicks

```
Tec + Fin + 0.5 * Lon
```

#### Penalties

```
Tec + 1.5 * Fin
```

#### Set Pieces Talent Bonus

| Talent | Bonus |
| ------ | ----- |
| 1      | 0%    |
| 2      | 8.9%  |
| 3      | 35%   |
| 4      | 80%   |

#### Goalkeepers

* Uses **Kick** skill only
* Applies ~40% penalty to freekick effectiveness
* Full set-piece score table displayed under the skill card

---

### **3. Market and Financial Data**

* Market value
* Agent value
* Minimum bid
* Maximum bid
* Bot team detection

Values pulled from the same public endpoints the FMP UI uses.

---

### **4. Talent Interpretation**

Displays real gameplay impact of:

* **Agility** talent
* **Set Pieces** talent
* **Strength** talent (weather performance)
* GK height bonus: **+3% effectiveness every 5 cm above 185 cm**

These affect in-match performance, not the rating shown on the profile page.

---

### **5. Clean UI Integration**

* Injects seamlessly below the existing skill section
* Uses compact `skilltable` layout
* `<th>` automatically sized with `min-width: 38px`
* Designed to blend with the FootballManagerProject layout

---

## Installation

1. Install **Tampermonkey** in your browser.
2. **[Click here to install the userscript](https://raw.githubusercontent.com/edunogueira/FMP-Genie-Assistant/main/FMPGenieAssistant.user.js)**
3. Visit any player page:

```
https://footballmanagerproject.com/Team/Player?id=XXXX
```

The assistant loads automatically.

---

## Development

Clone the repository:

```bash
git clone https://github.com/edunogueira/FMP-Genie-Assistant.git
cd FMP-Genie-Assistant
```

### Suggested structure

```
FMP-Genie-Assistant/
  ├── FMPGenieAssistant.user.js
  ├── README.md
  └── docs/
```

### Local testing

1. Open Tampermonkey → *Create New Script*
2. Paste the content of `FMPGenieAssistant.user.js`
3. Save & enable
4. Reload an FMP player page

---

## Disclaimer

This project is **not affiliated** with FootballManagerProject.
It uses only public endpoints already called by the official site.

---

## License

MIT

---

## Credits

The initial foundation of this userscript was inspired by work from **[紫竹FC](https://footballmanagerproject.com/Team/Board/?id=5283)**, author of:

* **FMP Rating**
  [https://greasyfork.org/scripts/527946](https://greasyfork.org/scripts/527946)

* **FMP More Player Info**
  [https://greasyfork.org/scripts/508685](https://greasyfork.org/scripts/508685)

Both scripts provided useful structural references for AJAX requests, rating extraction, and basic UI injection.

The **FMP Genie Assistant** project expands, refactors, and unifies these ideas into a modern, modular, fully documented, and extended version, adding:

* set piece modeling
* advanced rating prediction
* talent impact analysis
* GK height effectiveness
* cleaner architecture
* consolidated UI integration

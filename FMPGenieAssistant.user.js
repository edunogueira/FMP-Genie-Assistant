// ==UserScript==
// @name         FMP Genie Assistant
// @namespace    https://github.com/edunogueira/FMP-Genie-Assistant
// @version      1.3
// @description  Show extra player info (ID, rating, birthday, talents, position ratings, set pieces, tactics).
// @match        https://footballmanagerproject.com/Team/Player*
// @match        https://www.footballmanagerproject.com/Team/Player*
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    "use strict";

    // ========================================
    // Global CSS overrides
    // ========================================
    const style = document.createElement("style");
    style.textContent = `
        table.skilltable th {
            width: auto !important;
            min-width: 38px !important;
        }
    `;
    document.head.appendChild(style);

    // ========================================
    // Text / labels
    // ========================================
    const TEXT = {
        rating:         "Rating",
        id:             "ID",
        birthday:       "Birthday",
        positionColumn: "Position",
        ratingHint:     "*For reference only",
        positionGain:   "Pos. gain",
        weekday:        ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    };

    // ========================================
    // Skill order and rating weights
    // ========================================
    const GK_SKILLS = ["Han", "One", "Ref", "Aer", "Jum", "Ele", "Kic", "Thr", "Pos", "Sta", "Pac"];
    const OF_SKILLS = ["Mar", "Tak", "Tec", "Pas", "Cro", "Fin", "Hea", "Lon", "Pos", "Sta", "Pac"];
    // Display order for outfield attributes (position/tactical gains)
    const OF_DISPLAY_ORDER = ["Sta", "Pac", "Mar", "Tak", "Pos", "Pas", "Cro", "Tec", "Hea", "Fin", "Lon"];

    // rating weights
    const RATING_WEIGHTS = {
        0:  [1.2, 0.7, 1.2, 0.6, 0.7, 0.4, 0.5, 0.5, 0.6, 0.5, 0.4], // GK
        4:  [1.0, 1.0, 0.5, 0.6, 0.2, 0.2, 1.0, 0.3, 1.0, 0.7, 0.8], // DC
        5:  [0.9, 0.9, 0.6, 0.5, 0.7, 0.3, 0.7, 0.4, 0.7, 0.8, 0.8], // DL
        6:  [0.9, 0.9, 0.6, 0.5, 0.7, 0.3, 0.7, 0.4, 0.7, 0.8, 0.8], // DR
        8:  [0.8, 0.8, 0.7, 0.8, 0.2, 0.3, 0.7, 0.5, 1.0, 1.0, 0.5], // DMC
        9:  [0.7, 0.7, 0.7, 0.6, 0.9, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9], // DML
        10: [0.7, 0.7, 0.7, 0.6, 0.9, 0.3, 0.4, 0.5, 0.7, 0.9, 0.9], // DMR
        16: [0.5, 0.5, 1.0, 1.0, 0.3, 0.5, 0.5, 0.5, 1.0, 1.0, 0.5], // MC
        17: [0.4, 0.4, 0.8, 0.8, 1.0, 0.5, 0.3, 0.5, 0.7, 0.9, 1.0], // ML
        18: [0.4, 0.4, 0.8, 0.8, 1.0, 0.5, 0.3, 0.5, 0.7, 0.9, 1.0], // MR
        32: [0.3, 0.3, 1.0, 1.0, 0.3, 0.8, 0.5, 0.8, 0.8, 1.0, 0.5], // OMC
        33: [0.2, 0.2, 0.9, 0.7, 1.0, 0.7, 0.4, 0.7, 0.7, 0.8, 1.0], // OML
        34: [0.2, 0.2, 0.9, 0.7, 1.0, 0.7, 0.4, 0.7, 0.7, 0.8, 1.0], // OMR
        64: [0.2, 0.2, 0.7, 0.7, 0.4, 1.0, 1.0, 1.0, 0.7, 0.7, 0.7]  // FC
    };

    // Position groups → rating base key
    const POSITION_GROUPS = {
        DC:   { base: 4,  members: [4] },
        DLR:  { base: 5,  members: [5, 6] },
        DMC:  { base: 8,  members: [8] },
        DMLR: { base: 9,  members: [9, 10] },
        MC:   { base: 16, members: [16] },
        MLR:  { base: 17, members: [17, 18] },
        OMC:  { base: 32, members: [32] },
        OMLR: { base: 33, members: [33, 34] },
        FC:   { base: 64, members: [64] }
    };

    const TABLE_POSITIONS = [4, 5, 8, 9, 16, 17, 32, 33, 64];

    // ========================================
    // Set pieces talent bonus
    // ========================================
    const SET_PIECES_TALENT_BONUS = {
        1: 0.0,
        2: 8.9,
        3: 35.0,
        4: 80.0
    };

    // ========================================
    // Tactic gain matrices (Fil/Sho/Lon/Cou/Win)
    // Skills: Pac, Mar, Tak, Tec, Pas, Pos, Cro, Hea, Fin, Lon
    // Values approximated from official gain matrix visualizations
    // ========================================
    const AT_TACTIC_GAINS = {
        Fil: {
            DC: { Pac:0.0, Mar:0.0, Tak:0.0, Tec:0.9, Pas:0.8, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.3 },
            DL: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.6, Pas:0.7, Pos:0.0, Cro:0.2, Hea:0.0, Fin:0.0, Lon:0.3 },
            DR: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.6, Pas:0.7, Pos:0.0, Cro:0.2, Hea:0.0, Fin:0.0, Lon:0.3 },
            MC: { Pac:0.0, Mar:0.0, Tak:0.0, Tec:0.8, Pas:1.0, Pos:0.2, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            ML: { Pac:0.3, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.8, Pos:0.0, Cro:0.4, Hea:0.0, Fin:0.0, Lon:0.0 },
            MR: { Pac:0.3, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.8, Pos:0.0, Cro:0.4, Hea:0.0, Fin:0.0, Lon:0.0 },
            FC: { Pac:0.2, Mar:0.0, Tak:0.4, Tec:0.2, Pas:0.2, Pos:0.5, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            FL: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.5, Pos:0.6, Cro:0.0, Hea:0.2, Fin:0.0, Lon:0.0 },
            FR: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.5, Pos:0.6, Cro:0.0, Hea:0.2, Fin:0.0, Lon:0.0 }
        },
        Sho: {
            DC: { Pac:0.0, Mar:0.0, Tak:0.0, Tec:0.9, Pas:0.7, Pos:0.4, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            DL: { Pac:0.0, Mar:0.0, Tak:0.0, Tec:0.6, Pas:0.7, Pos:0.4, Cro:0.3, Hea:0.0, Fin:0.0, Lon:0.0 },
            DR: { Pac:0.0, Mar:0.0, Tak:0.0, Tec:0.6, Pas:0.7, Pos:0.4, Cro:0.3, Hea:0.0, Fin:0.0, Lon:0.0 },
            MC: { Pac:0.0, Mar:0.0, Tak:0.0, Tec:0.7, Pas:0.9, Pos:0.4, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            ML: { Pac:0.0, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.8, Pos:0.3, Cro:0.4, Hea:0.0, Fin:0.0, Lon:0.0 },
            MR: { Pac:0.0, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.8, Pos:0.3, Cro:0.4, Hea:0.0, Fin:0.0, Lon:0.0 },
            FC: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.5, Pos:0.5, Cro:0.0, Hea:0.3, Fin:0.0, Lon:0.0 },
            FL: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.5, Pos:0.5, Cro:0.0, Hea:0.3, Fin:0.0, Lon:0.0 },
            FR: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.5, Pos:0.5, Cro:0.0, Hea:0.3, Fin:0.0, Lon:0.0 }
        },
        Lon: {
            DC: { Pac:0.0, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.6, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.9 },
            DL: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.3, Pas:0.4, Pos:0.0, Cro:0.2, Hea:0.0, Fin:0.0, Lon:0.9 },
            DR: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.3, Pas:0.4, Pos:0.0, Cro:0.2, Hea:0.0, Fin:0.0, Lon:0.9 },
            MC: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.6, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.7 },
            ML: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.4, Pos:0.0, Cro:0.2, Hea:0.0, Fin:0.0, Lon:0.7 },
            MR: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.4, Pos:0.0, Cro:0.2, Hea:0.0, Fin:0.0, Lon:0.7 },
            FC: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.3, Pos:0.5, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            FL: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.3, Pas:0.5, Pos:0.5, Cro:0.3, Hea:0.2, Fin:0.0, Lon:0.0 },
            FR: { Pac:0.2, Mar:0.0, Tak:0.0, Tec:0.3, Pas:0.5, Pos:0.5, Cro:0.3, Hea:0.2, Fin:0.0, Lon:0.0 }
        },
        Cou: {
            DC: { Pac:0.7, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.5, Pos:0.3, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            DL: { Pac:0.7, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.5, Pos:0.3, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            DR: { Pac:0.7, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.5, Pos:0.3, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MC: { Pac:0.7, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.5, Pos:0.3, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            ML: { Pac:0.7, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.5, Pos:0.3, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MR: { Pac:0.7, Mar:0.0, Tak:0.0, Tec:0.5, Pas:0.5, Pos:0.3, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FC: { Pac:0.7, Mar:0.0, Tak:0.0, Tec:0.3, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            FL: { Pac:0.7, Mar:0.0, Tak:0.0, Tec:0.4, Pas:0.4, Pos:0.3, Cro:0.0, Hea:0.2, Fin:0.0, Lon:0.0 },
            FR: { Pac:0.7, Mar:0.0, Tak:0.0, Tec:0.4, Pas:0.4, Pos:0.3, Cro:0.0, Hea:0.2, Fin:0.0, Lon:0.0 }
        },
        Win: {
            DC: { Pac:0.4, Mar:0.0, Tak:0.0, Tec:0.3, Pas:0.6, Pos:0.2, Cro:0.5, Hea:0.0, Fin:0.0, Lon:0.0 },
            DL: { Pac:0.5, Mar:0.0, Tak:0.0, Tec:0.3, Pas:0.4, Pos:0.3, Cro:0.5, Hea:0.0, Fin:0.0, Lon:0.0 },
            DR: { Pac:0.5, Mar:0.0, Tak:0.0, Tec:0.3, Pas:0.4, Pos:0.3, Cro:0.5, Hea:0.0, Fin:0.0, Lon:0.0 },
            MC: { Pac:0.7, Mar:0.0, Tak:0.0, Tec:0.4, Pas:0.6, Pos:0.0, Cro:0.3, Hea:0.0, Fin:0.0, Lon:0.0 },
            ML: { Pac:0.7, Mar:0.0, Tak:0.0, Tec:0.3, Pas:0.4, Pos:0.0, Cro:0.6, Hea:0.0, Fin:0.0, Lon:0.0 },
            MR: { Pac:0.7, Mar:0.0, Tak:0.0, Tec:0.3, Pas:0.4, Pos:0.0, Cro:0.6, Hea:0.0, Fin:0.0, Lon:0.0 },
            FC: { Pac:0.5, Mar:0.0, Tak:0.0, Tec:0.3, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.7, Fin:0.0, Lon:0.0 },
            FL: { Pac:0.5, Mar:0.0, Tak:0.0, Tec:0.3, Pas:0.4, Pos:0.0, Cro:0.8, Hea:0.0, Fin:0.0, Lon:0.0 },
            FR: { Pac:0.5, Mar:0.0, Tak:0.0, Tec:0.3, Pas:0.4, Pos:0.0, Cro:0.8, Hea:0.0, Fin:0.0, Lon:0.0 }
        }
    };

    const DEF_TACTIC_GAINS = {
        Fil: {
            DC: { Pac:0.0, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            DL: { Pac:0.0, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            DR: { Pac:0.0, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            MC: { Pac:0.0, Mar:0.7, Tak:0.6, Tec:0.0, Pas:0.0, Pos:0.7, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            ML: { Pac:0.3, Mar:0.7, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MR: { Pac:0.3, Mar:0.7, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FC: { Pac:0.0, Mar:0.7, Tak:0.8, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FL: { Pac:0.4, Mar:0.7, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.4, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FR: { Pac:0.4, Mar:0.7, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.4, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 }
        },
        Sho: {
            DC: { Pac:0.0, Mar:0.5, Tak:0.3, Tec:0.0, Pas:0.0, Pos:0.7, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            DL: { Pac:0.3, Mar:0.5, Tak:0.8, Tec:0.0, Pas:0.0, Pos:0.4, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            DR: { Pac:0.3, Mar:0.5, Tak:0.8, Tec:0.0, Pas:0.0, Pos:0.4, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MC: { Pac:0.0, Mar:0.7, Tak:0.6, Tec:0.0, Pas:0.0, Pos:0.7, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            ML: { Pac:0.3, Mar:0.7, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MR: { Pac:0.3, Mar:0.7, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FC: { Pac:0.0, Mar:0.7, Tak:0.8, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FL: { Pac:0.4, Mar:0.7, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.4, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FR: { Pac:0.4, Mar:0.7, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.4, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 }
        },
        Lon: {
            DC: { Pac:0.0, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.5, Pos:0.0, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            DL: { Pac:0.0, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.5, Pos:0.0, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            DR: { Pac:0.0, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.5, Pos:0.0, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            MC: { Pac:0.5, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.5, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            ML: { Pac:0.5, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.5, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MR: { Pac:0.5, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.5, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FC: { Pac:0.5, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.5, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FL: { Pac:0.5, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.5, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FR: { Pac:0.5, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.5, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 }
        },
        Cou: {
            DC: { Pac:0.0, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            DL: { Pac:0.0, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            DR: { Pac:0.0, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            MC: { Pac:0.8, Mar:0.5, Tak:0.7, Tec:0.0, Pas:0.0, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            ML: { Pac:0.8, Mar:0.5, Tak:0.7, Tec:0.0, Pas:0.0, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MR: { Pac:0.8, Mar:0.5, Tak:0.7, Tec:0.0, Pas:0.0, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FC: { Pac:0.8, Mar:0.5, Tak:0.7, Tec:0.0, Pas:0.0, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FL: { Pac:0.8, Mar:0.5, Tak:0.7, Tec:0.0, Pas:0.0, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FR: { Pac:0.8, Mar:0.5, Tak:0.7, Tec:0.0, Pas:0.0, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 }
        },
        Win: {
            DC: { Pac:0.0, Mar:0.5, Tak:0.2, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.8, Fin:0.0, Lon:0.0 },
            DL: { Pac:0.0, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            DR: { Pac:0.0, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.0, Pos:0.5, Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            MC: { Pac:0.5, Mar:0.8, Tak:0.7, Tec:0.0, Pas:0.0, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            ML: { Pac:0.5, Mar:0.8, Tak:0.7, Tec:0.0, Pas:0.0, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MR: { Pac:0.5, Mar:0.8, Tak:0.7, Tec:0.0, Pas:0.0, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FC: { Pac:0.5, Mar:0.8, Tak:0.7, Tec:0.0, Pas:0.0, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FL: { Pac:0.5, Mar:0.8, Tak:0.7, Tec:0.0, Pas:0.0, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FR: { Pac:0.5, Mar:0.8, Tak:0.7, Tec:0.0, Pas:0.0, Pos:0.0, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 }
        }
    };

    const TACTICS = ["Fil", "Sho", "Lon", "Cou", "Win"];

    const POSITION_GAINS = {
        // ============================
        // CENTER PLAYERS
        // ============================
        4:  { Sta:0.7, Pac:0.8, Mar:1.0, Tak:1.0, Tec:0.5, Pas:0.6, Pos:1.0, Cro:0.2, Hea:1.0, Fin:0.2, Lon:0.3 },
        8:  { Sta:1.0, Pac:0.5, Mar:0.8, Tak:0.8, Tec:0.7, Pas:0.8, Pos:1.0, Cro:0.2, Hea:0.7, Fin:0.3, Lon:0.5 },
        16: { Sta:1.0, Pac:0.5, Mar:0.5, Tak:0.5, Tec:1.0, Pas:1.0, Pos:1.0, Cro:0.3, Hea:0.5, Fin:0.5, Lon:0.5 },
        32: { Sta:1.0, Pac:0.5, Mar:0.3, Tak:0.3, Tec:1.0, Pas:1.0, Pos:0.8, Cro:0.3, Hea:0.5, Fin:0.8, Lon:0.8 },
        64: { Sta:0.7, Pac:0.7, Mar:0.2, Tak:0.2, Tec:0.7, Pas:0.7, Pos:0.7, Cro:0.4, Hea:1.0, Fin:1.0, Lon:1.0 },

        // ============================
        // SIDE PLAYERS
        // ============================
        5:  { Sta:0.8, Pac:0.8, Mar:0.9, Tak:0.9, Tec:0.6, Pas:0.5, Pos:0.7, Cro:0.7, Hea:0.7, Fin:0.3, Lon:0.4 },
        6:  { Sta:0.8, Pac:0.8, Mar:0.9, Tak:0.9, Tec:0.6, Pas:0.5, Pos:0.7, Cro:0.7, Hea:0.7, Fin:0.3, Lon:0.4 },
        9:  { Sta:0.9, Pac:0.9, Mar:0.7, Tak:0.7, Tec:0.7, Pas:0.6, Pos:0.7, Cro:0.9, Hea:0.4, Fin:0.3, Lon:0.5 },
        10: { Sta:0.9, Pac:0.9, Mar:0.7, Tak:0.7, Tec:0.7, Pas:0.6, Pos:0.7, Cro:0.9, Hea:0.4, Fin:0.3, Lon:0.5 },
        17: { Sta:0.9, Pac:1.0, Mar:0.3, Tak:0.3, Tec:0.8, Pas:0.8, Pos:0.7, Cro:1.0, Hea:0.3, Fin:0.5, Lon:0.5 },
        18: { Sta:0.9, Pac:1.0, Mar:0.3, Tak:0.3, Tec:0.8, Pas:0.8, Pos:0.7, Cro:1.0, Hea:0.3, Fin:0.5, Lon:0.5 },
        33: { Sta:0.8, Pac:1.0, Mar:0.2, Tak:0.2, Tec:0.9, Pas:0.7, Pos:0.7, Cro:1.0, Hea:0.4, Fin:0.7, Lon:0.7 },
        34: { Sta:0.8, Pac:1.0, Mar:0.2, Tak:0.2, Tec:0.9, Pas:0.7, Pos:0.7, Cro:1.0, Hea:0.4, Fin:0.7, Lon:0.7 },

        // ============================
        // GOALKEEPERS
        // ============================
        0: {
            Sta:0.3, Pac:0.2, Han:1.0, One:0.5, Ref:1.0, Aer:0.4, Pos:0.4, Jum:0.5, Kic:0.3, Ele:0.2, Thr:0.3
        }
    };

    // ========================================
    // URL / early exit
    // ========================================
    const url = new URL(window.location.href);
    const playerId = url.searchParams.get("id");
    if (!playerId) return;

    // ========================================
    // Loader – wait for player DOM to be ready
    // ========================================
    let started = false;
    const observer = new MutationObserver(() => {
        if (started) return;

        const infoTable = document.getElementsByClassName("infotable")[0];
        const skillsContainer = document.querySelector(".d-flex.flex-wrap.justify-content-around");

        if (infoTable && infoTable.firstChild && skillsContainer) {
            started = true;
            observer.disconnect();
            run(playerId, infoTable, skillsContainer)
                .catch(e => console.error("[FMP Genie] Error:", e));
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // ========================================
    // Main flow
    // ========================================
    async function run(pid, infoTable, skillsContainer) {
        const data = await loadPlayerData(pid);
        if (!data) return;

        const { player } = data;
        const ratingRaw   = player.marketInfo?.rating ?? null;
        const ratingValue = ratingRaw != null ? ratingRaw / 10 : null;
        const posCode     = fpToPos(player.fp);
        const skills      = decodeSkills(player.skills, posCode);

        // infotable: ID, rating, birthday
        prependRow(infoTable, TEXT.id, playerId);
        if (ratingValue != null) appendRow(infoTable, TEXT.rating, ratingValue.toString());
        if (typeof FMP !== "undefined" && typeof FMP.Day0 !== "undefined" && player.birthday != null) {
            appendBirthdayRow(infoTable, player.birthday);
        }

        // talents
        if (player.pubTalents) fillPublicTalents(player.pubTalents, posCode);

        // position ratings table
        let ratingTableAnchor = null;
        if (skills && ratingRaw != null) {
            ratingTableAnchor = buildRatingTable(skills, posCode, ratingRaw, skillsContainer);
        }

        // set pieces table
        const spAnchor = ratingTableAnchor || skillsContainer;
        buildSetPiecesTable(skills, player.pubTalents, posCode, spAnchor);

        // tactics table
        buildTacticsTable(skills, player.fp, spAnchor);

        console.log("[FMP Genie] Extra info loaded.", { player, skills, posCode });
    }

    // ========================================
    // Data loading (API wrappers)
    // ========================================
    async function loadPlayerData(pid) {
        const [playerData] = await Promise.all([
            apiGetPlayerData(pid)
        ]);

        if (!playerData || !playerData.player) return null;

        return {
            player: playerData.player
        };
    }

    function apiGetPlayerData(pid) {
        return new Promise(resolve => {
            $.ajax({
                type: "GET",
                url: "/Tools/GetPlayerInfo",
                data: { playerID: pid },
                dataType: "json",

                success: function (result) {
                    resolve(result || null);
                },

                error: function () {
                    resolve(null);
                }
            });
        });
    }

    // ========================================
    // DOM helpers – infotable
    // ========================================
    function prependRow(table, label, valueHtml) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<th>${label}</th><td>${valueHtml}</td>`;
        table.insertBefore(tr, table.firstChild);
    }

    function appendRow(table, label, valueHtml) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<th>${label}</th><td>${valueHtml}</td>`;
        table.appendChild(tr);
    }

    function appendBirthdayRow(table, birthdayIndex) {
        const baseDate = new Date(FMP.Day0);
        baseDate.setDate(baseDate.getDate() + birthdayIndex);
        const weekday = TEXT.weekday[baseDate.getDay()] || "";

        const content =
              `<span title="${weekday}">${birthdayIndex}</span>` +
              ` <span>${weekday}</span>`;

        appendRow(table, TEXT.birthday, content);
    }

    // ========================================
    // Set pieces helpers / table
    // ========================================
    function getSetPiecesTalent(pubTalents) {
        if (!pubTalents || typeof pubTalents.set === "undefined") {
            return 1;
        }
        return (pubTalents.set || 0) + 1;
    }

    function getSetPiecesTalentBonusPct(talent) {
        return SET_PIECES_TALENT_BONUS[talent] ?? 0.0;
    }

    function buildSetPiecesTable(skills, pubTalents, posCode, anchorElement) {
        if (!skills || !anchorElement) return;

        const setTalent = getSetPiecesTalent(pubTalents);
        const bonusPct = getSetPiecesTalentBonusPct(setTalent);
        const mult = 1 + bonusPct / 100.0;

        const rows = [];

        if (posCode === 0) {
            // Goalkeeper set pieces
            const baseFk = Number(skills.Kic || 0);

            const finalFk = baseFk * mult * 0.6; // GK less effective on freekicks
            const finalPk = baseFk * mult;

            rows.push({
                type: "Freekick (GK)",
                base: baseFk,
                bonus: bonusPct,
                final: finalFk,
                title: "SPk * (Tec + Cro + 0.5 * Lon)"
            });

            rows.push({
                type: "Penalty (GK)",
                base: baseFk,
                bonus: bonusPct,
                final: finalPk,
                title: "SPk * (Tec + 1.5 * Fin)"
            });
        } else {
            // Outfield player set pieces
            const Tec = Number(skills.Tec || 0);
            const Cro = Number(skills.Cro || 0);
            const Fin = Number(skills.Fin || 0);
            const Lon = Number(skills.Lon || 0);

            const baseCorner   = Tec + Cro + 0.5 * Lon;
            const baseFreekick = Tec + Cro + 0.5 * Lon;
            const baseDirect   = Tec + Fin + 0.5 * Lon;
            const basePenalty  = Tec + 1.5 * Fin;

            rows.push({
                type: "Corner",
                base: baseCorner,
                bonus: bonusPct,
                final: baseCorner * mult,
                title: "SPk * (Tec + Cro + 0.5 * Lon)"
            });

            rows.push({
                type: "Freekick",
                base: baseFreekick,
                bonus: bonusPct,
                final: baseFreekick * mult,
                title: "SPk * (Tec + Cro + 0.5 * Lon)"
            });

            rows.push({
                type: "Direct FK",
                base: baseDirect,
                bonus: bonusPct,
                final: baseDirect * mult,
                title: "SPk * (Tec + Fin + 0.5 * Lon)"
            });

            rows.push({
                type: "Penalty",
                base: basePenalty,
                bonus: bonusPct,
                final: basePenalty * mult,
                title: "SPk * (Tec + 1.5 * Fin)"
            });
        }

        const table = document.createElement("table");
        table.className = "skilltable";
        table.style.marginLeft = "auto";
        table.style.marginRight = "auto";
        table.style.marginTop = "4px";

        const header =
              "<tr>" +
              "<th>Set piece type</th>" +
              "<th>Base score</th>" +
              "<th>Talent bonus (%)</th>" +
              "<th>Final score</th>" +
              "</tr>";

        const body = rows
        .map(r => {
            return (
                "<tr>" +
                `<td title="${r.title}">${r.type}</td>` +
                `<td>${r.base.toFixed(1)}</td>` +
                `<td>${r.bonus.toFixed(1)}</td>` +
                `<td>${r.final.toFixed(1)}</td>` +
                "</tr>"
            );
        })
        .join("");

        table.innerHTML = `<tbody>${header}${body}</tbody>`;

        const title = document.createElement("div");
        title.textContent = "Set pieces effectiveness (approx.)";
        title.style.textAlign = "center";
        title.style.fontSize = "12px";
        title.style.marginTop = "6px";
        title.style.color = "white";

        const wrapper = document.createElement("div");
        wrapper.style.marginTop = "8px";
        wrapper.appendChild(title);
        wrapper.appendChild(table);

        anchorElement.insertAdjacentElement("afterend", wrapper);
    }

    // ========================================
    // Tactics helpers / table
    // ========================================
    function getTacticalScoresForPlayer(skills, fp) {
        const zone = fpToTacticZone(fp);
        if (!zone) return null;

        const atkScores = {};
        const defScores = {};

        for (const tactic of TACTICS) {
            const atkByZone = AT_TACTIC_GAINS[tactic];
            const defByZone = DEF_TACTIC_GAINS[tactic];

            const atkGains = atkByZone ? atkByZone[zone] : null;
            const defGains = defByZone ? defByZone[zone] : null;

            if (atkGains) {
                let totalAtk = 0;
                for (const attr in atkGains) {
                    const weight = atkGains[attr];
                    if (!weight) continue;
                    totalAtk += Number(skills[attr] || 0) * weight;
                }
                atkScores[tactic] = totalAtk;
            }

            if (defGains) {
                let totalDef = 0;
                for (const attr in defGains) {
                    const weight = defGains[attr];
                    if (!weight) continue;
                    totalDef += Number(skills[attr] || 0) * weight;
                }
                defScores[tactic] = totalDef;
            }
        }

        return { zone, atkScores, defScores };
    }


    function buildTactialGainsTable(tactic, skills, playerFp, gainsMatrix) {
        const zone = fpToTacticZone(playerFp);
        if (!zone) return { html: "<div>No tactic zone for this position.</div>", total: 0 };

        const gainsByZone = gainsMatrix[tactic];
        if (!gainsByZone) return { html: "<div>No gain data for this tactic.</div>", total: 0 };

        const gains = gainsByZone[zone];
        if (!gains) return { html: "<div>No gain data for this tactic/zone.</div>", total: 0 };

        let totalDiff = 0;

        let html =
            "<table class='skilltable' style='margin:auto'>" +
            "<tr>" +
            "<th>Skill</th>" +
            "<th>Original</th>" +
            "<th>Gain</th>" +
            "<th>Bonus</th>" +
            "<th>Δ</th>" +
            "</tr>";

        for (const skill of OF_DISPLAY_ORDER) {
            const original = Number(skills[skill] || 0);
            const gain = gains[skill] || 0;
            const bonus = original * (1 + gain);
            const diff = bonus - original;
            totalDiff += diff;

            html +=
                `<tr>` +
                `<td>${skill}</td>` +
                `<td>${original.toFixed(1)}</td>` +
                `<td>${gain.toFixed(1)}</td>` +
                `<td>${bonus.toFixed(1)}</td>` +
                `<td>${diff.toFixed(1)}</td>` +
                `</tr>`;
        }

        html +=
            `<tr style="font-weight:bold;">` +
            `<td>Total</td>` +
            `<td></td><td></td><td></td>` +
            `<td>${totalDiff.toFixed(1)}</td>` +
            `</tr>`;

        html += "</table>";

        return { html, total: totalDiff };
    }


    function buildTacticsTable(skills, playerFp, anchorElement) {
        const tactical = getTacticalScoresForPlayer(skills, playerFp);
        if (!tactical || !anchorElement) return;

        const { atkScores, defScores } = tactical;

        const tactics = TACTICS.filter(t => atkScores[t] != null || defScores[t] != null);
        if (!tactics.length) return;

        // Totais ataque + defesa
        const totalScores = {};
        for (const tactic of tactics) {
            const atkVal = atkScores[tactic] ?? 0;
            const defVal = defScores[tactic] ?? 0;
            totalScores[tactic] = atkVal + defVal;
        }
        const maxTotal = Math.max(...Object.values(totalScores));

        const table = document.createElement("table");
        table.className = "skilltable";
        table.style.marginLeft = "auto";
        table.style.marginRight = "auto";
        table.style.marginTop = "8px";

        const tbody = document.createElement("tbody");

        // Header
        const headerTr = document.createElement("tr");
        headerTr.innerHTML = "<th>Tactic</th><th>At Score</th><th>Def Score</th><th>Tot Score</th>";
        tbody.appendChild(headerTr);

        // Rows
        for (const tactic of tactics) {
            const atkVal = atkScores[tactic] ?? 0;
            const defVal = defScores[tactic] ?? 0;
            const total  = totalScores[tactic];

            const tr = document.createElement("tr");

            // Nome da tática
            const nameTd = document.createElement("td");
            nameTd.textContent = tactic;
            tr.appendChild(nameTd);

            // Botão ofensivo
            const atkTd = document.createElement("td");
            const atkBtn = document.createElement("button");
            const atkResult = buildTactialGainsTable(tactic, skills, playerFp, AT_TACTIC_GAINS);

            atkBtn.type = "button";
            atkBtn.textContent = atkResult.total.toFixed(1);
            atkBtn.style.margin = "0";
            atkBtn.style.padding = "2px 6px";
            atkBtn.style.fontSize = "11px";
            atkBtn.className = "fmp-btn btn-yellow small centre";

            atkBtn.onclick = () => {
                uiMessageBox(
                    "Show Offensive Tactical Gains",
                    atkResult.html
                );
            };

            atkTd.appendChild(atkBtn);
            tr.appendChild(atkTd);

            // Botão defensivo
            const defTd = document.createElement("td");
            const defBtn = document.createElement("button");
            const defResult = buildTactialGainsTable(tactic, skills, playerFp, DEF_TACTIC_GAINS);

            defBtn.type = "button";
            defBtn.textContent = defResult.total.toFixed(1);
            defBtn.style.margin = "0";
            defBtn.style.padding = "2px 6px";
            defBtn.style.fontSize = "11px";
            defBtn.className = "fmp-btn btn-yellow small centre";

            defBtn.onclick = () => {
                uiMessageBox(
                    "Show Defensive Tactical Gains",
                    defResult.html
                );
            };

            defTd.appendChild(defBtn);
            tr.appendChild(defTd);

            // Total (At + Def) com destaque em verde no maior
            const totalTd = document.createElement("td");
            totalTd.textContent = total.toFixed(1);
            if (total === maxTotal) {
                totalTd.style.color = "lightgreen";
                totalTd.style.fontWeight = "bold";
            }
            tr.appendChild(totalTd);

            tbody.appendChild(tr);
        }

        table.appendChild(tbody);

        const title = document.createElement("div");
        title.textContent = "Tactical performance by tactic (approx.)";
        title.style.textAlign = "center";
        title.style.fontSize = "12px";
        title.style.marginTop = "6px";
        title.style.color = "white";

        const wrapper = document.createElement("div");
        wrapper.style.marginTop = "8px";
        wrapper.appendChild(title);
        wrapper.appendChild(table);

        anchorElement.insertAdjacentElement("afterend", wrapper);
    }

    // ========================================
    // Talents rendering
    // ========================================
    function fillPublicTalents(pubTalent, posCode) {
        const talentsDiv = document.getElementsByClassName("talents")[0];
        if (!talentsDiv) return;

        const tds = talentsDiv.getElementsByTagName("td");
        if (!tds.length) return;

        // Keep original layout: append numbers only
        if (posCode === 0) {
            if (tds[0]) tds[0].textContent += (pubTalent.agi + 1);
            if (tds[1]) tds[1].textContent += (pubTalent.set + 1);
            if (tds[2]) tds[2].textContent += (pubTalent.str + 1);
        } else {
            if (tds[0]) tds[0].textContent += (pubTalent.ada + 1);
            if (tds[1]) tds[1].textContent += (pubTalent.agi + 1);
            if (tds[2]) tds[2].textContent += (pubTalent.set + 1);
            if (tds[3]) tds[3].textContent += (pubTalent.str + 1);
        }
    }

    // ========================================
    // Rating table (position comparison)
    // ========================================
    function buildRatingTable(skills, posCode, rawRating, skillsContainer) {
        const group = findPositionGroup(posCode);
        if (!group || !skillsContainer) return null;
        if (rawRating == null) return null;

        const tableRatings = {};
        for (const p of TABLE_POSITIONS) {
            tableRatings[p] = calcRatingForPos(skills, p);
        }

        const base = tableRatings[group.base];
        if (!base) return null;

        const currentRating = rawRating / 10;
        const factor = currentRating / base;

        const predicted = {};
        Object.entries(tableRatings).forEach(([p, value]) => {
            predicted[p] = value * factor;
        });

        const maxValue = Math.max(...Object.values(predicted));
        const maxKey = Number(Object.keys(predicted).find(k => predicted[k] === maxValue));

        const table = document.createElement("table");
        table.className = "skilltable";
        table.style.marginLeft = "auto";
        table.style.marginRight = "auto";

        const headerHtml =
            `<th>${TEXT.positionColumn}</th>` +
            `<th>DC</th>` +
            `<th>D(RL)</th>` +
            `<th>DMC</th>` +
            `<th>DM(RL)</th>` +
            `<th>MC</th>` +
            `<th>ML/MR</th>` +
            `<th>OMC</th>` +
            `<th>OM(RL)</th>` +
            `<th>FC</th>`;

        const tbody = document.createElement("tbody");

        // Header row
        const headerRow = document.createElement("tr");
        headerRow.innerHTML = headerHtml;
        tbody.appendChild(headerRow);

        // Rating row
        const ratingTr = document.createElement("tr");
        const ratingFirstTd = document.createElement("td");
        ratingFirstTd.textContent = TEXT.rating;
        ratingTr.appendChild(ratingFirstTd);

        for (const p of TABLE_POSITIONS) {
            const td = document.createElement("td");
            const val = predicted[p].toFixed(1);
            const isCurrent = group.members.includes(p);
            const isBest = p === maxKey && !isCurrent;

            if (isBest) {
                td.style.color = "lightgreen";
            } else if (isCurrent) {
                td.style.color = "yellow";
            }
            td.textContent = val;

            ratingTr.appendChild(td);
        }
        tbody.appendChild(ratingTr);

        // Gain row
        const gainTr = document.createElement("tr");
        const gainFirstTd = document.createElement("td");
        gainFirstTd.textContent = TEXT.positionGain;
        gainTr.appendChild(gainFirstTd);

        for (const p of TABLE_POSITIONS) {
            const td = document.createElement("td");
            const btn = document.createElement("button");

            const result = buildPositionGainsTable(p, skills);

            btn.type = "button";
            btn.textContent = result.total.toFixed(1);
            btn.style.margin = "0";
            btn.style.padding = "2px 4px";
            btn.style.fontSize = "11px";
            btn.className = "fmp-btn btn-yellow small centre";

            btn.onclick = () => {
                uiMessageBox(
                    "Show Position Gains",
                    result.html
                );
            };

            td.appendChild(btn);
            gainTr.appendChild(td);
        }
        tbody.appendChild(gainTr);

        table.appendChild(tbody);

        const hint = document.createElement("span");
        hint.textContent = TEXT.ratingHint;
        hint.style.color = "yellow";
        hint.style.fontSize = "12px";

        const br = document.createElement("br");

        skillsContainer.insertAdjacentElement("afterend", br);
        br.insertAdjacentElement("afterend", hint);
        hint.insertAdjacentElement("afterend", table);

        return table;
    }

    function buildPositionGainsTable(posCode, skills) {
        const gains = POSITION_GAINS[posCode];
        if (!gains) return { html: "<div>No gain data</div>", total: 0 };

        let totalDiff = 0;

        let html =
            "<table class='skilltable' style='margin:auto'>" +
            "<tr>" +
            "<th>Skill</th>" +
            "<th>Original</th>" +
            "<th>Gain</th>" +
            "<th>Bonus</th>" +
            "<th>Δ</th>" +
            "</tr>";

        for (const skill of OF_DISPLAY_ORDER) {
            let original;
            let gain;
            let bonus;
            let diff;

            original = Number(skills[skill] || 0);
            gain = gains[skill] || 0;
            bonus = original * (1 + gain);
            diff = bonus - original;
            totalDiff += diff;


            html +=
                `<tr>` +
                `<td>${skill}</td>` +
                `<td>${original.toFixed(1)}</td>` +
                `<td>${gain.toFixed(1)}</td>` +
                `<td>${bonus.toFixed(1)}</td>` +
                `<td>${diff.toFixed(1)}</td>` +
                `</tr>`;
        }

        html +=
            `<tr style="font-weight:bold;">` +
            `<td>Total</td>` +
            `<td></td><td></td><td></td>` +
            `<td>${totalDiff.toFixed(1)}</td>` +
            `</tr>`;

        html += "</table>";

        return { html, total: totalDiff };
    }

    function findPositionGroup(posCode) {
        for (const group of Object.values(POSITION_GROUPS)) {
            if (group.members.includes(posCode)) return group;
        }
        return null;
    }

    function calcRatingForPos(skills, posCode) {
        const weights = RATING_WEIGHTS[posCode];
        if (!weights) return 0;

        const skillOrder = posCode === 0 ? GK_SKILLS : OF_SKILLS;
        const values = skillOrder.map(key => Number(skills[key] || 0));

        const weighted = values.reduce((sum, val, idx) => sum + val * weights[idx], 0);
        const wSum = weights.reduce((a, b) => a + b, 0);
        return wSum ? weighted / wSum : 0;
    }

    // ========================================
    // Decode skills / position mapping
    // ========================================
    function decodeSkills(binsk, posCode) {
        if (!binsk) return null;

        const bytes = Uint8Array.from(atob(binsk), c => c.charCodeAt(0));
        const sk = {};

        if (posCode === 0) {
            // Goalkeeper
            GK_SKILLS.forEach((name, i) => {
                sk[name] = bytes[i] / 10;
            });
        } else {
            // Outfield player
            OF_SKILLS.forEach((name, i) => {
                sk[name] = bytes[i] / 10;
            });
        }

        sk.For = bytes[11] / 10;
        sk.Rou = (bytes[12] * 256 + bytes[13]) / 100;

        return sk;
    }

    function fpToPos(fp) {
        const map = {
            GK: 0, DC: 4, DL: 5, DR: 6,
            DMC: 8, DML: 9, DMR: 10,
            MC: 16, ML: 17, MR: 18,
            OMC: 32, OML: 33, OMR: 34,
            FC: 64
        };
        return map[fp] ?? -1;
    }

    function fpToTacticZone(fp) {
        switch (fp) {
            case "GK":  return null;
            case "DC":  return "DC";
            case "DL":  return "DL";
            case "DR":  return "DR";
            case "DMC":
            case "MC":  return "MC";
            case "DML":
            case "ML":  return "ML";
            case "DMR":
            case "MR":  return "MR";
            case "OMC":
            case "FC":  return "FC";
            case "OML": return "FL";
            case "OMR": return "FR";
            default:    return null;
        }
    }

})();

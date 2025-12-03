// ==UserScript==
// @name         FMP Genie Assistant
// @namespace    https://github.com/edunogueira/FMP-Genie-Assistant
// @version      1.5
// @description  Show extra player info (ID, birthday, talents, position ratings, set pieces, tactics).
// @include      https://footballmanagerproject.com/*
// @include      https://www.footballmanagerproject.com/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    "use strict";
    var configs = getStorage(localStorage.getItem("FMPGenieAssistant.configs")) || {};
    const API_SUPPORTERS_URL = "https://footballmanagerproject.com/Economy/Supporters?handler=SupportersData";

    function getStorage(storageConfigs) {
        const defaultConfigs = {
            "Supporters": 'checked',
            "Player": 'checked',
        };

        return (storageConfigs == null || storageConfigs == '[]') ? defaultConfigs : JSON.parse(storageConfigs);
    }
    var page = document.URL;
    function checkAndExecute(config, func) {
        if ((config) || (typeof config === 'undefined')) {
            func();
        }
    }

    if (page.includes('/Economy/Supporters')) {
        checkAndExecute(configs["Supporters"], supportersPage);
    } else if (page.includes('/Team/Player?')) {
        checkAndExecute(configs["Player"], playerPage);
    }

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
    // Translation helpers
    // ========================================
    /**
     * Returns translated text from the global `trxt` dictionary if available.
     * Falls back to the provided default text if the key is missing.
     * @param {string} key - Translation key.
     * @param {string} fallback - Fallback text when translation is not found.
     * @returns {string}
     */
    function t(key, fallback) {
        if (typeof trxt !== "undefined" && trxt[key] != null) {
            return trxt[key];
        }
        return fallback;
    }

    /**
     * Returns the label for a given skill code using the translation table.
     * Falls back to the raw code when no translation is found.
     * @param {string} code - Skill short code (e.g. "Mar", "Pac").
     * @returns {string}
     */
    function skillLabel(code) {
        const key = "plSkillNames." + code;
        return t(key, code);
    }

    // ========================================
    // Text / labels
    // ========================================
    const TEXT = {
        rating:         t("player.Rating", "Rating"),
        id:             "ID",
        birthday:       t("player.Birthday", "Birthday"),
        positionColumn: t("fp.Position", "Position"),
        ratingHint:     t("genie.RatingHint", "*For reference only (FMP Genie Assistant)"),
        positionGain:   t("genie.PosGain", "Pos. gain"),
        SetPiecesTitle: t("genie.SetPiecesTitle", "Set pieces effectiveness (approx.)"),
        Tactic:         t("genie.Tactic", "Tactic"),

        AttackScore:    t("scoutsk.Att", "Att") + " " + t("genie.Score", "Score"),
        DefenseScore:   t("scoutsk.Def", "Def") + " " + t("genie.Score", "Score"),
        TotalScore:     t("genie.TotalScore", "Tot Score"),

        ShowOffensiveGains:         t("genie.ShowOffensiveGains", "Show Offensive Tactical Gains"),
        ShowDefensiveGains:         t("genie.ShowDefensiveGains", "Show Defensive Tactical Gains"),
        TacticalPerformanceByTactic:t("genie.TacticalPerformanceByTactic", "Tactical performance by tactic (approx.)"),
        ExtraInfoLoaded:            t("genie.ExtraInfoLoaded", "[FMP Genie] Extra info loaded"),

        skill:    t("player.SKILLS", "Skill"),
        original: t("genie.Original", "Original"),
        gain:     t("genie.Gain", "Gain"),
        bonus:    t("genie.Bonus", "Bonus"),
        delta:    t("genie.Delta", "Δ"),
        total:    t("genie.Total", "Total"),

        weekday: Array.from({ length: 7 }, (_, i) => trxt["strLongWeekDay." + i])
    };

    const TACTIC_LABELS = {
        Fil: t("tactic.Fil", "Through passes"),
        Sho: t("tactic.Sho", "Short passes"),
        Lon: t("tactic.Lon", "Long passes"),
        Cou: t("tactic.Cou", "Counter attack"),
        Win: t("tactic.Win", "Wings attack")
    };

    const SET_PIECE_TEXT = {
        corner:       t("genie.SetPiece.Corner",  "Corner"),
        freekick:     t("genie.SetPiece.Freekick","Freekick"),
        direct:       t("genie.SetPiece.DirectFK","Direct FK"),
        penalty:      t("genie.SetPiece.Penalty", "Penalty"),
        GKCorner:     t("genie.SetPiece.GKCorner", "Freekick (GK)"),
        GKPenalty:    t("genie.SetPiece.GKPenalty","Penalty (GK)"),
        SetPieceType: t("genie.SetPiece.SetPieceType","Set piece type"),
        BaseScore:    t("genie.SetPiece.BaseScore","Base score"),
        TalentBonus:  t("genie.SetPiece.TalentBonus","Talent bonus (%)"),
        FinalScore:   t("genie.SetPiece.FinalScore","Final score")
    };

    // ========================================
    // Skill order and rating weights
    // ========================================
    const GK_SKILLS = ["Han", "One", "Ref", "Aer", "Jum", "Ele", "Kic", "Thr", "Pos", "Sta", "Pac"];
    const OF_SKILLS = ["Mar", "Tak", "Tec", "Pas", "Cro", "Fin", "Hea", "Lon", "Pos", "Sta", "Pac"];

    // Display order for outfield attributes (position/tactical gains)
    const OF_DISPLAY_ORDER = ["Sta", "Pac", "Mar", "Tak", "Pos", "Pas", "Cro", "Tec", "Hea", "Fin", "Lon"];

    // Rating weights by "base position key"
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

    // Order of positions used in rating table
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

    // Position gain multipliers by position code
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
    function playerPage() {
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
    }

    // ========================================
    // Main flow
    // ========================================

    /**
     * Main entry point for the script once the page is ready.
     * Loads player data, decodes skills and injects all extra UI blocks.
     * @param {string} pid - Player ID from query string.
     * @param {HTMLTableElement} infoTable - Original info table element.
     * @param {HTMLElement} skillsContainer - Container element holding skills.
     */
    async function run(pid, infoTable, skillsContainer) {
        const data = await loadPlayerData(pid);
        if (!data) return;

        const { player } = data;
        const posCode = fpToPos(player.fp);
        const skills = decodeSkills(player.skills, posCode);
        const ratingValue = ratingFromSkillObject(skills, player.qi);

        // Info table: ID, rating, birthday
        prependRow(infoTable, TEXT.id, playerId);

        if (ratingValue != null) {
            appendRow(
                infoTable,
                TEXT.rating,
                `${ratingValue.skills.toFixed(1)} (${ratingValue.qi.toFixed(1)})`,
                "Calculated with skills (left) and inverted from QI (right)"
            );
        }

        if (typeof FMP !== "undefined" && typeof FMP.Day0 !== "undefined" && player.birthday != null) {
            appendBirthdayRow(infoTable, player.birthday);
        }

        // Talents
        if (player.pubTalents) {
            fillPublicTalents(player.pubTalents, posCode);
        }

        // Position ratings table
        let ratingTableAnchor = null;
        if (skills && ratingValue != null) {
            ratingTableAnchor = buildRatingTable(skills, posCode, ratingValue, skillsContainer);
        }

        // Set pieces table
        const spAnchor = ratingTableAnchor || skillsContainer;
        buildSetPiecesTable(skills, player.pubTalents, posCode, spAnchor);

        // Tactics table
        buildTacticsTable(skills, player.fp, spAnchor);

        console.log(TEXT.ExtraInfoLoaded, { player, skills, posCode });
    }

    // ========================================
    // Data loading (API wrappers)
    // ========================================

    /**
     * Loads player extra data from the FMP Tools API.
     * @param {string} pid - Player ID.
     * @returns {Promise<{player: object} | null>}
     */
    async function loadPlayerData(pid) {
        const [playerData] = await Promise.all([
            apiGetPlayerData(pid)
        ]);

        if (!playerData || !playerData.player) return null;

        return {
            player: playerData.player
        };
    }

    /**
     * Calls /Tools/GetPlayerInfo to retrieve the player JSON payload.
     * @param {string} pid - Player ID.
     * @returns {Promise<object|null>}
     */
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
    /**
     * Prepends a row in the given table with label/value cells.
     * @param {HTMLTableElement} table
     * @param {string} label
     * @param {string} valueHtml
     */
    function prependRow(table, label, valueHtml) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<th>${label}</th><td>${valueHtml}</td>`;
        table.insertBefore(tr, table.firstChild);
    }

    /**
     * Appends a row in the given table with label/value cells and optional title.
     * @param {HTMLTableElement} table
     * @param {string} label
     * @param {string} valueHtml
     * @param {string} [title=""]
     */
    function appendRow(table, label, valueHtml, title = "") {
        const tr = document.createElement("tr");
        tr.innerHTML = `<th title="${title}">${label}</th><td title="${title}">${valueHtml}</td>`;
        table.appendChild(tr);
    }

    /**
     * Appends the birthday row with day index and localized weekday name.
     * @param {HTMLTableElement} table
     * @param {number} birthdayIndex - Day index relative to FMP.Day0.
     */
    function appendBirthdayRow(table, birthdayIndex) {
        const today = new Date(fmpDay(FMP.Date.Today()));

        const baseDate = new Date(fmpDay(fmpToday()));

        const aa = FMP.Day0.getDate();
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
    /**
     * Derives the set pieces talent level (1-4) from public talents.
     * Returns 1 if no public data is available.
     * @param {object} pubTalents
     * @returns {number}
     */
    function getSetPiecesTalent(pubTalents) {
        if (!pubTalents || typeof pubTalents.set === "undefined") {
            return 1;
        }
        return (pubTalents.set || 0) + 1;
    }

    /**
     * Returns the percentage bonus for a given talent level.
     * @param {number} talent
     * @returns {number}
     */
    function getSetPiecesTalentBonusPct(talent) {
        return SET_PIECES_TALENT_BONUS[talent] ?? 0.0;
    }

    /**
     * Builds and injects the set pieces summary table after the given anchor element.
     * @param {object} skills - Decoded skills object.
     * @param {object} pubTalents - Public talent info.
     * @param {number} posCode - Position code (0 = GK).
     * @param {HTMLElement} anchorElement - Element after which the table will be inserted.
     */
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
                type: SET_PIECE_TEXT.GKCorner,
                base: baseFk,
                bonus: bonusPct,
                final: finalFk,
                title: `SPk * (${skillLabel("Tec")} + ${skillLabel("Cro")} + 0.5 * ${skillLabel("Lon")})`
            });

            rows.push({
                type: SET_PIECE_TEXT.GKPenalty,
                base: baseFk,
                bonus: bonusPct,
                final: finalPk,
                title: `SPk * (${skillLabel("Tec")} + 1.5 * ${skillLabel("Fin")})`
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
                type: SET_PIECE_TEXT.corner,
                base: baseCorner,
                bonus: bonusPct,
                final: baseCorner * mult,
                title: `SPk * (${skillLabel("Tec")} + ${skillLabel("Cro")} + 0.5 * ${skillLabel("Lon")})`
            });

            rows.push({
                type: SET_PIECE_TEXT.freekick,
                base: baseFreekick,
                bonus: bonusPct,
                final: baseFreekick * mult,
                title: `SPk * (${skillLabel("Tec")} + ${skillLabel("Cro")} + 0.5 * ${skillLabel("Lon")})`
            });

            rows.push({
                type: SET_PIECE_TEXT.direct,
                base: baseDirect,
                bonus: bonusPct,
                final: baseDirect * mult,
                title: `SPk * (${skillLabel("Tec")} + ${skillLabel("Fin")} + 0.5 * ${skillLabel("Lon")})`
            });

            rows.push({
                type: SET_PIECE_TEXT.penalty,
                base: basePenalty,
                bonus: bonusPct,
                final: basePenalty * mult,
                title: `SPk * (${skillLabel("Tec")} + 1.5 * ${skillLabel("Fin")})`
            });
        }

        const table = document.createElement("table");
        table.className = "skilltable";
        table.style.marginLeft = "auto";
        table.style.marginRight = "auto";
        table.style.marginTop = "4px";

        const header =
              `<tr>` +
              `<th>${SET_PIECE_TEXT.SetPieceType}</th>` +
              `<th>${SET_PIECE_TEXT.BaseScore}</th>` +
              `<th>${SET_PIECE_TEXT.TalentBonus}</th>` +
              `<th>${SET_PIECE_TEXT.FinalScore}</th>` +
              `</tr>`;

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
        title.textContent = TEXT.SetPiecesTitle
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

    /**
     * Computes total attack/defense scores per tactic for a given player.
     * @param {object} skills - Decoded skills.
     * @param {string} fp - Player FMP position string (e.g. "MC", "DC").
     * @returns {{zone:string, atkScores:object, defScores:object} | null}
     */
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

    /**
     * Builds a detailed gains breakdown table (offensive or defensive) for a single tactic.
     * @param {string} tactic - Tactic key (Fil/Sho/Lon/Cou/Win).
     * @param {object} skills - Decoded skills.
     * @param {string} playerFp - Player FMP position string.
     * @param {object} gainsMatrix - AT_TACTIC_GAINS or DEF_TACTIC_GAINS.
     * @returns {{html:string, total:number}}
     */
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
            `<th>${TEXT.skill}</th>` +
            `<th>${TEXT.original}</th>` +
            `<th>${TEXT.gain}</th>` +
            `<th>${TEXT.bonus}</th>` +
            `<th>${TEXT.delta}</th>` +
            "</tr>";

        for (const skill of OF_DISPLAY_ORDER) {
            const original = Number(skills[skill] || 0);
            const gain = gains[skill] || 0;
            const bonus = original * (1 + gain);
            const diff = bonus - original;
            const skillText = skillLabel(skill);
            totalDiff += diff;

            html +=
                "<tr>" +
                `<td>${skillText}</td>` +
                `<td>${original.toFixed(1)}</td>` +
                `<td>${gain.toFixed(1)}</td>` +
                `<td>${bonus.toFixed(1)}</td>` +
                `<td>${diff.toFixed(1)}</td>` +
                "</tr>";
        }

        html +=
            `<tr style="font-weight:bold;">` +
            `<td>${TEXT.total}</td>` +
            "<td></td><td></td><td></td>" +
            `<td>${totalDiff.toFixed(1)}</td>` +
            "</tr>";

        html += "</table>";

        return { html, total: totalDiff };
    }

    /**
     * Builds and injects the main tactics comparison table (attack/defense/total per tactic).
     * Each cell opens a detailed breakdown in a modal via uiMessageBox.
     * @param {object} skills - Decoded skills.
     * @param {string} playerFp - Player FMP position string.
     * @param {HTMLElement} anchorElement - Element after which the table will be inserted.
     */
    function buildTacticsTable(skills, playerFp, anchorElement) {
        const tactical = getTacticalScoresForPlayer(skills, playerFp);
        if (!tactical || !anchorElement) return;

        const { atkScores, defScores } = tactical;

        const tactics = TACTICS.filter(t => atkScores[t] != null || defScores[t] != null);
        if (!tactics.length) return;

        // Total attack + defense per tactic
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
        headerTr.innerHTML =
            `<th>${TEXT.Tactic}</th>` +
            `<th>${TEXT.AttackScore}</th>` +
            `<th>${TEXT.DefenseScore}</th>` +
            `<th>${TEXT.TotalScore}</th>`;
        tbody.appendChild(headerTr);

        // Rows
        for (const tactic of tactics) {
            const atkVal = atkScores[tactic] ?? 0;
            const defVal = defScores[tactic] ?? 0;
            const total  = totalScores[tactic];

            const tr = document.createElement("tr");

            // Tactic name
            const nameTd = document.createElement("td");
            nameTd.textContent = TACTIC_LABELS[tactic] || tactic;
            tr.appendChild(nameTd);

            // Offensive button
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
                    TEXT.ShowOffensiveGains,
                    atkResult.html
                );
            };

            atkTd.appendChild(atkBtn);
            tr.appendChild(atkTd);

            // Defensive button
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
                    TEXT.ShowDefensiveGains,
                    defResult.html
                );
            };

            defTd.appendChild(defBtn);
            tr.appendChild(defTd);

            // Total (Atk + Def) – highlight the best
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
        title.textContent = TEXT.TacticalPerformanceByTactic;
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

    /**
     * Fills the public talents row with talent levels (1-4) for the current player.
     * Keeps the original FMP layout and only appends numbers.
     * @param {object} pubTalent - Public talents from API.
     * @param {number} posCode - Player position code (0 = GK).
     */
    function fillPublicTalents(pubTalent, posCode) {
        const talentsDiv = document.getElementsByClassName("talents")[0];
        if (!talentsDiv) return;

        const tds = talentsDiv.getElementsByTagName("td");
        if (!tds.length) return;

        if (posCode === 0) {
            // Goalkeeper: agi, set, str
            if (tds[0]) tds[0].textContent += (pubTalent.agi + 1);
            if (tds[1]) tds[1].textContent += (pubTalent.set + 1);
            if (tds[2]) tds[2].textContent += (pubTalent.str + 1);
        } else {
            // Outfield: ada, agi, set, str
            if (tds[0]) tds[0].textContent += (pubTalent.ada + 1);
            if (tds[1]) tds[1].textContent += (pubTalent.agi + 1);
            if (tds[2]) tds[2].textContent += (pubTalent.set + 1);
            if (tds[3]) tds[3].textContent += (pubTalent.str + 1);
        }
    }

    // ========================================
    // Rating table (position comparison)
    // ========================================

    /**
     * Builds the rating comparison table by position and injects it after the skills container.
     * Also computes and highlights best position and position gains (button per column).
     * @param {object} skills - Decoded skills.
     * @param {number} posCode - Player base position code.
     * @param {{skills:number, qi:number}} rawRating - Rating summary object from ratingFromSkillObject.
     * @param {HTMLElement} skillsContainer - Skills container element.
     * @returns {HTMLTableElement|null}
     */
    function buildRatingTable(skills, posCode, rawRating, skillsContainer) {
        const group = findPositionGroup(posCode);
        if (!group || !skillsContainer) return null;
        if (rawRating == null) return null;

        const tableRatings = {};
        let bestRating = 0;
        let bestPos = null;

        for (const p of TABLE_POSITIONS) {
            const rating = calcRatingForPos(skills, p);
            tableRatings[p] = rating;

            if (rating > bestRating) {
                bestRating = rating;
                bestPos = p;
            }
        }

        const table = document.createElement("table");
        table.className = "skilltable";
        table.style.marginLeft = "auto";
        table.style.marginRight = "auto";

        const headerHtml =
            `<th>${TEXT.positionColumn}</th>` +
            `<th>${trxt["fp.name.DC"]}</th>` +
            `<th>${trxt["fp.name.DL"]}/${trxt["fp.name.DR"]}</th>` +
            `<th>${trxt["fp.name.DMC"]}</th>` +
            `<th>${trxt["fp.name.DML"]}/${trxt["fp.name.DMR"]}</th>` +
            `<th>${trxt["fp.name.MC"]}</th>` +
            `<th>${trxt["fp.name.ML"]}/${trxt["fp.name.MR"]}</th>` +
            `<th>${trxt["fp.name.OMC"]}</th>` +
            `<th>${trxt["fp.name.OML"]}/${trxt["fp.name.OMR"]}</th>` +
            `<th>${trxt["fp.name.FC"]}</th>`;

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
            const val = tableRatings[p].toFixed(1);
            const isCurrent = Number(p) === Number(posCode);
            const isBest = Number(p) === Number(bestPos) && !isCurrent;

            if (isBest) {
                td.style.color = "lightgreen";
            } else if (isCurrent) {
                td.style.color = "yellow";
            }
            td.textContent = val;

            ratingTr.appendChild(td);
        }
        tbody.appendChild(ratingTr);

        // Position gain row
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
                    t("genie.ShowPositionGains", "Show Position Gains"),
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

    /**
     * Builds the position gains table (per skill) for a given position code.
     * @param {number} posCode
     * @param {object} skills
     * @returns {{html:string, total:number}}
     */
    function buildPositionGainsTable(posCode, skills) {
        const gains = POSITION_GAINS[posCode];
        if (!gains) return { html: "<div>No gain data</div>", total: 0 };

        let totalDiff = 0;

        let html =
            "<table class='skilltable' style='margin:auto'>" +
            "<tr>" +
            `<th>${TEXT.skill}</th>` +
            `<th>${TEXT.original}</th>` +
            `<th>${TEXT.gain}</th>` +
            `<th>${TEXT.bonus}</th>` +
            `<th>${TEXT.delta}</th>` +
            "</tr>";

        for (const skill of OF_DISPLAY_ORDER) {
            const original = Number(skills[skill] || 0);
            const gain = gains[skill] || 0;
            const bonus = original * (1 + gain);
            const diff = bonus - original;
            const skillText = skillLabel(skill);
            totalDiff += diff;

            html +=
                "<tr>" +
                `<td>${skillText}</td>` +
                `<td>${original.toFixed(1)}</td>` +
                `<td>${gain.toFixed(1)}</td>` +
                `<td>${bonus.toFixed(1)}</td>` +
                `<td>${diff.toFixed(1)}</td>` +
                "</tr>";
        }

        html +=
            `<tr style="font-weight:bold;">` +
            `<td>${TEXT.total}</td>` +
            "<td></td><td></td><td></td>" +
            `<td>${totalDiff.toFixed(1)}</td>` +
            "</tr>";

        html += "</table>";

        return { html, total: totalDiff };
    }

    /**
     * Calculates the weighted rating for a given position code using RATING_WEIGHTS.
     * @param {object} skills - Decoded skills.
     * @param {number} posCode - Position code (0 for GK, etc.).
     * @returns {number}
     */
    function calcRatingForPos(skills, posCode) {
        const weights = RATING_WEIGHTS[posCode];
        if (!weights) return 0;

        const skillOrder = posCode === 0 ? GK_SKILLS : OF_SKILLS;
        const values = skillOrder.map(key => Number(skills[key] || 0));

        const weighted = values.reduce((sum, val, idx) => sum + val * weights[idx], 0);
        const wSum = weights.reduce((a, b) => a + b, 0);
        return wSum ? weighted / wSum : 0;
    }

    /**
     * Computes rating based on skills and QI:
     * - skills: sum of integer part of 11 main skills, divided by 10 (decimal rating from skills).
     * - qi: rating derived from inverting the official QI formula (approximate).
     * @param {object} p - Decoded skills object.
     * @param {number} qi - Player QI.
     * @returns {{skills:number, qi:number}}
     */
    function ratingFromSkillObject(p, qi) {
        let ratingInt = 0;

        // Inverted QI formula → sumSkills → divided by 100 to keep it in a rating-like scale
        const ratingQI = (Math.pow(qi, 1 / 5) / 0.0045) / 100;

        for (const k of OF_DISPLAY_ORDER) {
            ratingInt += Math.floor(p[k]);
        }
        if (isNaN(ratingInt)) {
            ratingInt = 0;
            for (const k of GK_SKILLS) {
                ratingInt += Math.floor(p[k]);
            }
        }

        return {
            skills: ratingInt / 10,
            qi: ratingQI
        };
    }

    /**
     * Finds the POSITION_GROUPS entry that contains the given position code.
     * @param {number} posCode
     * @returns {{base:number, members:number[]} | null}
     */
    function findPositionGroup(posCode) {
        for (const group of Object.values(POSITION_GROUPS)) {
            if (group.members.includes(posCode)) return group;
        }
        return null;
    }

    // ========================================
    // Decode skills / position mapping
    // ========================================

    /**
     * Decodes the binary skills string into a skills object.
     * @param {string} binsk - Base64 encoded binary skills.
     * @param {number} posCode - Position code (0 = GK).
     * @returns {object|null}
     */
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

    /**
     * Maps FMP fp string (GK/MC/DC...) to internal numeric position code.
     * @param {string} fp - FMP position code.
     * @returns {number}
     */
    function fpToPos(fp) {
        const map = {
            GK: 0,
            DC: 4,
            DL: 5,
            DR: 6,
            DMC: 8,
            DML: 9,
            DMR: 10,
            MC: 16,
            ML: 17,
            MR: 18,
            OMC: 32,
            OML: 33,
            OMR: 34,
            FC: 64
        };
        return map[fp] ?? -1;
    }

    /**
     * Maps FMP fp string to the tactic zone used in AT/DEF gain matrices.
     * GK has no tactical zone and returns null.
     * @param {string} fp - FMP position string.
     * @returns {string|null}
     */
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

    function calculateStadiumSuggestion_ModelA(supportersCount) {
        // Model A: practical, higher revenue, less dependence on weather.a
        const idealCapacity = Math.round(supportersCount * 1.5);
        const vip = Math.round(supportersCount * 0.025);

        const remaining = idealCapacity - vip;

        const covered = Math.round(remaining * 0.35);
        const sitting = Math.round(remaining * 0.35);
        const standing = Math.max(0, remaining - covered - sitting);

        return {
            model: "A",
            idealCapacity,
            vip,
            covered,
            sitting,
            standing
        };
    }

    function calculateStadiumSuggestion_ModelB(supportersCount) {
        // Model B: faithful to the HC/MC/LC distribution of the guide
        const idealCapacity = Math.round(supportersCount * 1.5);
        const vip = Math.round(supportersCount * 0.025);

        const remaining = idealCapacity - vip;

        const covered = Math.round(remaining * 0.25);     // 25%
        const sitting = Math.round(remaining * 0.375);    // 37.5%
        const standing = Math.max(0, remaining - covered - sitting); // ~37.5%

        return {
            model: "B",
            idealCapacity,
            vip,
            covered,
            sitting,
            standing
        };
    }


    function renderAfterRow(suggestion) {
        const moodTd = document.querySelector("#supporters-mood");
        if (!moodTd) return;

        const moodRow = moodTd.closest("tr");
        if (!moodRow) return;

        // evita duplicado
        if (document.getElementById("stadium-suggestion-row")) return;

        const A = calculateStadiumSuggestion_ModelA(suggestion);
        const B = calculateStadiumSuggestion_ModelB(suggestion);


        const newRow = document.createElement("tr");
        newRow.id = "stadium-suggestion-row";
        newRow.classList.add("logo-info");

        const td1 = document.createElement("td");
        td1.innerHTML = `<i class="fmp-icons fmp-stadium"></i>`;

        const td2 = document.createElement("td");
        td2.style.verticalAlign = "middle";
        td2.innerHTML = `
                <div class="caption">Stadium Suggestion (FMP Genie Assistant)</div>
                <div class="value" title="Model A: practical, higher revenue, less dependence on weather.
                2.5% VIP, 35% covered, 35% sitting, 30% standing"><b>Model A (Stable/Profit):</div>
                <div class="small">VIP: ${A.vip}</div>
                <div class="small">Covered: ${A.covered}</div>
                <div class="small">Sitting: ${A.sitting}</div>
                <div class="small">Standing: ${A.standing}</div>
                <br>
                <div class="value" title="Model B: faithful to the HC/MC/LC distribution of the guide.
                2.5% VIP, 25% covered, 37.5% sitting, 37.5% standing"><b>Model B (HC/MC/LC Guide):</div>
                <div class="small">VIP: ${B.vip}</div>
                <div class="small">Covered: ${B.covered}</div>
                <div class="small">Sitting: ${B.sitting}</div>
                <div class="small">Standing: ${B.standing}</div>
            </div>
            <br><div class="small" title="A good stadium size could be the one that can contain all the supporters of your team plus a 50% extra space.">
            Ideal capacity: ${A.idealCapacity}</div>
        `;

        newRow.appendChild(td1);
        newRow.appendChild(td2);

        moodRow.insertAdjacentElement("afterend", newRow);
    }

    async function supportersPage() {
        try {
            const res = await fetch(API_SUPPORTERS_URL, { credentials: "include" });
            if (!res.ok) return;

            const data = await res.json();
            const supportersCount = data?.supporters?.count;
            if (!supportersCount) return;

            //const suggestion = calculateStadiumSuggestion(supportersCount);
            renderAfterRow(supportersCount);

        } catch (err) {
            console.error("Stadium Suggestion Error:", err);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();


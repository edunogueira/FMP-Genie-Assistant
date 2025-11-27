// ==UserScript==
// @name         FMP Genie Assistant
// @namespace    https://github.com/edunogueira/FMP-Genie-Assistant
// @version      1.0
// @description  Show extra player info (ID, rating, market, bids, birthday, talents, position ratings, set pieces, tactics).
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
        boxTitle:       "More information",
        marketValue:    "Market value",
        agentValue:     "Agent value",
        minBid:         "Minimum bid",
        maxBid:         "Maximum bid",
        rating:         "Rating",
        id:             "ID",
        birthday:       "Birthday",
        positionColumn: "Position",
        ratingHint:     "*For reference only",
        weekday:        ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    };

    // ========================================
    // Skill order and rating weights
    // ========================================
    const GK_SKILLS = ["Han", "One", "Ref", "Aer", "Jum", "Ele", "Kic", "Thr", "Pos", "Sta", "Pac"];
    const OF_SKILLS = ["Mar", "Tak", "Tec", "Pas", "Cro", "Fin", "Hea", "Lon", "Pos", "Sta", "Pac"];

    // Same weights as the original rating script
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
    const TACTIC_GAINS = {
        Fil: {
            DC: { Pac:0.0, Mar:0.1, Tak:0.0, Tec:0.0, Pas:0.75, Pos:0.5, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            DL: { Pac:0.0, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.75, Pos:0.5, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            DR: { Pac:0.0, Mar:0.5, Tak:0.5, Tec:0.0, Pas:0.75, Pos:0.5, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MC: { Pac:0.0, Mar:0.25, Tak:0.75, Tec:0.75, Pas:1.0, Pos:0.5, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            ML: { Pac:0.0, Mar:0.1,  Tak:0.25, Tec:0.5,  Pas:0.75, Pos:0.25, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MR: { Pac:0.0, Mar:0.1,  Tak:0.25, Tec:0.5,  Pas:0.75, Pos:0.25, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FC: { Pac:0.0, Mar:0.0,  Tak:0.1,  Tec:0.5,  Pas:0.75, Pos:0.0,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.25 },
            FL: { Pac:0.0, Mar:0.0,  Tak:0.0,  Tec:0.0,  Pas:0.25, Pos:0.5,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.1 },
            FR: { Pac:0.0, Mar:0.0,  Tak:0.0,  Tec:0.0,  Pas:0.25, Pos:0.5,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.1 }
        },
        Sho: {
            DC: { Pac:0.0, Mar:0.25, Tak:0.75, Tec:0.0,  Pas:0.5,  Pos:0.5,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            DL: { Pac:0.0, Mar:0.5,  Tak:1.0,  Tec:0.5,  Pas:0.75, Pos:0.5,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            DR: { Pac:0.0, Mar:0.5,  Tak:1.0,  Tec:0.5,  Pas:0.75, Pos:0.5,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MC: { Pac:0.0, Mar:0.25, Tak:0.75, Tec:0.75, Pas:1.0,  Pos:0.75, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            ML: { Pac:0.0, Mar:0.25, Tak:0.5,  Tec:0.75, Pas:0.75, Pos:0.5,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MR: { Pac:0.0, Mar:0.25, Tak:0.5,  Tec:0.75, Pas:0.75, Pos:0.5,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FC: { Pac:0.0, Mar:0.0,  Tak:0.25, Tec:0.5,  Pas:0.5,  Pos:0.0,  Cro:0.0, Hea:0.0, Fin:0.25, Lon:0.0 },
            FL: { Pac:0.0, Mar:0.0,  Tak:0.0,  Tec:0.0,  Pas:0.25, Pos:0.25, Cro:0.0, Hea:0.25,Fin:0.0, Lon:0.0 },
            FR: { Pac:0.0, Mar:0.0,  Tak:0.0,  Tec:0.0,  Pas:0.25, Pos:0.25, Cro:0.0, Hea:0.25,Fin:0.0, Lon:0.0 }
        },
        Lon: {
            DC: { Pac:0.25,Mar:0.0,  Tak:0.25, Tec:0.0,  Pas:0.0,  Pos:0.5,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            DL: { Pac:0.0, Mar:0.25, Tak:0.5,  Tec:0.0,  Pas:0.0,  Pos:0.75, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.1 },
            DR: { Pac:0.0, Mar:0.25, Tak:0.5,  Tec:0.0,  Pas:0.0,  Pos:0.75, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.1 },
            MC: { Pac:0.0, Mar:0.25, Tak:0.75, Tec:0.5,  Pas:0.5,  Pos:0.75, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.75 },
            ML: { Pac:0.0, Mar:0.25, Tak:0.5,  Tec:0.25, Pas:0.25, Pos:0.5,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:1.0 },
            MR: { Pac:0.0, Mar:0.25, Tak:0.5,  Tec:0.25, Pas:0.25, Pos:0.5,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:1.0 },
            FC: { Pac:0.0, Mar:0.0,  Tak:0.25, Tec:0.25, Pas:0.0,  Pos:0.25, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.75 },
            FL: { Pac:0.0, Mar:0.0,  Tak:0.0,  Tec:0.0,  Pas:0.0,  Pos:0.1,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.25 },
            FR: { Pac:0.0, Mar:0.0,  Tak:0.0,  Tec:0.0,  Pas:0.0,  Pos:0.1,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.25 }
        },
        Cou: {
            DC: { Pac:0.75,Mar:0.0,  Tak:0.0,  Tec:0.0,  Pas:0.0,  Pos:0.5,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            DL: { Pac:0.5, Mar:0.25, Tak:0.0,  Tec:0.0,  Pas:0.5,  Pos:0.25, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            DR: { Pac:0.5, Mar:0.25, Tak:0.0,  Tec:0.0,  Pas:0.5,  Pos:0.25, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MC: { Pac:0.0, Mar:0.5,  Tak:0.75, Tec:0.0,  Pas:0.5,  Pos:0.5,  Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            ML: { Pac:0.0, Mar:1.0,  Tak:0.25, Tec:0.0,  Pas:0.25, Pos:0.25, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MR: { Pac:0.0, Mar:1.0,  Tak:0.25, Tec:0.0,  Pas:0.25, Pos:0.25, Cro:0.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FC: { Pac:0.0, Mar:0.0,  Tak:0.0,  Tec:0.0,  Pas:0.0,  Pos:0.0,  Cro:0.0, Hea:0.5, Fin:0.0, Lon:0.0 },
            FL: { Pac:0.0, Mar:0.0,  Tak:0.25, Tec:0.0,  Pas:0.0,  Pos:0.0,  Cro:0.0, Hea:0.25,Fin:0.0, Lon:0.0 },
            FR: { Pac:0.0, Mar:0.0,  Tak:0.25, Tec:0.0,  Pas:0.0,  Pos:0.0,  Cro:0.0, Hea:0.25,Fin:0.0, Lon:0.0 }
        },
        Win: {
            DC: { Pac:0.25,Mar:0.0,  Tak:0.25, Tec:0.0,  Pas:0.0,  Pos:0.5,  Cro:0.0, Hea:0.25,Fin:0.0, Lon:0.0 },
            DL: { Pac:0.75,Mar:0.25, Tak:0.25, Tec:0.0,  Pas:0.25, Pos:0.75, Cro:0.0, Hea:0.25,Fin:0.0, Lon:0.0 },
            DR: { Pac:0.75,Mar:0.25, Tak:0.25, Tec:0.0,  Pas:0.25, Pos:0.75, Cro:0.0, Hea:0.25,Fin:0.0, Lon:0.0 },
            MC: { Pac:0.0, Mar:0.75, Tak:0.75, Tec:0.25, Pas:0.25, Pos:0.75, Cro:0.5, Hea:0.0, Fin:0.0, Lon:0.0 },
            ML: { Pac:0.0, Mar:0.75, Tak:0.25, Tec:0.25, Pas:0.25, Pos:0.5,  Cro:1.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            MR: { Pac:0.0, Mar:0.75, Tak:0.25, Tec:0.25, Pas:0.25, Pos:0.5,  Cro:1.0, Hea:0.0, Fin:0.0, Lon:0.0 },
            FC: { Pac:0.0, Mar:0.0,  Tak:0.0,  Tec:0.0,  Pas:0.0,  Pos:0.25, Cro:0.5, Hea:0.5, Fin:0.0, Lon:0.0 },
            FL: { Pac:0.0, Mar:0.0,  Tak:0.0,  Tec:0.0,  Pas:0.0,  Pos:0.25, Cro:0.75,Hea:0.0, Fin:0.0, Lon:0.0 },
            FR: { Pac:0.0, Mar:0.0,  Tak:0.0,  Tec:0.0,  Pas:0.0,  Pos:0.25, Cro:0.75,Hea:0.0, Fin:0.0, Lon:0.0 }
        }
    };

    const TACTICS = ["Fil", "Sho", "Lon", "Cou", "Win"];

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
        const actionsBoard = document.getElementById("ActionsBoard");
        const skillsContainer = document.querySelector(".d-flex.flex-wrap.justify-content-around");

        if (infoTable && infoTable.firstChild && actionsBoard && skillsContainer) {
            started = true;
            observer.disconnect();
            run(playerId, infoTable, actionsBoard, skillsContainer)
                .catch(e => console.error("[FMP Genie] Error:", e));
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // ========================================
    // Main flow
    // ========================================
    async function run(pid, infoTable, actionsBoard, skillsContainer) {
        const data = await loadPlayerData(pid);
        if (!data) return;

        const { player, marketValue, bidInfo } = data;
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
        if (skills && posCode !== 0 && ratingRaw != null) {
            ratingTableAnchor = buildRatingTable(skills, posCode, ratingRaw, skillsContainer);
        }

        // set pieces table
        const spAnchor = ratingTableAnchor || skillsContainer;
        buildSetPiecesTable(skills, player.pubTalents, posCode, spAnchor);

        // more info box (market / bids / rating)
        buildMoreInfoBox(actionsBoard, { marketValue, bidInfo, ratingValue });

        // tactics table
        buildTacticsTable(skills, player.fp, spAnchor);

        console.log("[FMP Genie] Extra info loaded.", { player, marketValue, bidInfo, skills, posCode });
    }

    // ========================================
    // Data loading (API wrappers)
    // ========================================
    async function loadPlayerData(pid) {
        const [marketValue, bidInfo, playerData] = await Promise.all([
            apiGetMarketValue(pid),
            apiGetBidInfo(pid),
            apiGetPlayerData(pid)
        ]);

        if (!playerData || !playerData.player) return null;

        return {
            marketValue,
            bidInfo,
            player: playerData.player
        };
    }

    function apiGetMarketValue(pid) {
        return new Promise(resolve => {
            $.ajax({
                type: "GET",
                url: "/Players/GetPlayerMarketValue",
                data: { playerid: pid },
                success: res => resolve(res?.marketValue ?? null),
                error: () => resolve(null)
            });
        });
    }

    function apiGetBidInfo(pid) {
        return new Promise(resolve => {
            $.ajax({
                type: "POST",
                url: "/Players/GetDirectBidInfo",
                dataType: "json",
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify({ playerid: pid }),
                success: res => {
                    if (res && res.player) {
                        resolve({
                            isBotTeam:  res.player.isBotTeam,
                            maxBid:     res.player.maxBid,
                            minimumBid: res.player.minimumBid
                        });
                    } else {
                        resolve(null);
                    }
                },
                error: () => resolve(null)
            });
        });
    }

    function apiGetPlayerData(pid) {
        return new Promise(resolve => {
            $.getJSON(
                {
                    url: "/Team/Player?handler=PlayerData&playerId=" + pid,
                    datatype: "json",
                    contentType: "application/json",
                    type: "GET"
                },
                res => resolve(res || null)
            ).fail(() => resolve(null));
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
                final: finalFk
            });

            rows.push({
                type: "Penalty (GK)",
                base: baseFk,
                bonus: bonusPct,
                final: finalPk
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
                final: baseCorner * mult
            });

            rows.push({
                type: "Freekick",
                base: baseFreekick,
                bonus: bonusPct,
                final: baseFreekick * mult
            });

            rows.push({
                type: "Direct FK",
                base: baseDirect,
                bonus: bonusPct,
                final: baseDirect * mult
            });

            rows.push({
                type: "Penalty",
                base: basePenalty,
                bonus: bonusPct,
                final: basePenalty * mult
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
                    `<td>${r.type}</td>` +
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

        const scores = {};

        for (const tactic of TACTICS) {
            const gainsByZone = TACTIC_GAINS[tactic];
            if (!gainsByZone) continue;

            const gains = gainsByZone[zone];
            if (!gains) continue;

            let total = 0;
            for (const attr in gains) {
                const weight = gains[attr];
                if (!weight) continue;
                total += (Number(skills[attr] || 0) * weight);
            }
            scores[tactic] = total;
        }

        return { zone, scores };
    }

    function buildTacticsTable(skills, playerFp, anchorElement) {
        const result = getTacticalScoresForPlayer(skills, playerFp);
        if (!result || !anchorElement) return;

        const { scores } = result;
        const tactics = Object.keys(scores);
        if (!tactics.length) return;

        const values = Object.values(scores);
        const maxVal = Math.max(...values);

        const table = document.createElement("table");
        table.className = "skilltable";
        table.style.marginLeft = "auto";
        table.style.marginRight = "auto";
        table.style.marginTop = "8px";

        const header = "<tr><th>Tactic</th><th>Score</th></tr>";

        const body = tactics
            .map(tactic => {
                const val = scores[tactic];
                const formatted = val.toFixed(2);
                const highlight = (val === maxVal) ? " style=\"color:lightgreen;\"" : "";
                return `<tr><td>${tactic}</td><td${highlight}>${formatted}</td></tr>`;
            })
            .join("");

        table.innerHTML = `<tbody>${header}${body}</tbody>`;

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
    // DOM helpers – “More information” box
    // ========================================
    function buildMoreInfoBox(actionsBoard, data) {
        const { marketValue, bidInfo, ratingValue } = data;

        const box = document.createElement("div");
        box.className = "board fmpx box";
        box.style.flexGrow = 0;
        box.style.flexBasis = "200px";

        const titleDiv = document.createElement("div");
        titleDiv.className = "title";

        const mainDiv = document.createElement("div");
        mainDiv.className = "main";
        mainDiv.textContent = TEXT.boxTitle;

        titleDiv.appendChild(mainDiv);
        box.appendChild(titleDiv);

        const infoDiv = document.createElement("div");
        infoDiv.className = "moreinfo";
        infoDiv.style.color = "white";

        const lines = [];

        if (marketValue != null) {
            lines.push(infoLine(TEXT.marketValue, formatNumber(marketValue)));
            lines.push(infoLine(TEXT.agentValue, formatNumber(marketValue / 2)));
        }

        if (bidInfo) {
            const minBid = Math.floor(bidInfo.minimumBid ?? 0);
            lines.push(infoLine(TEXT.minBid, formatNumber(minBid)));

            if (!bidInfo.isBotTeam && bidInfo.maxBid) {
                lines.push(infoLine(TEXT.maxBid, formatNumber(bidInfo.maxBid)));
            }
        }

        if (ratingValue != null) {
            lines.push(infoLine(TEXT.rating, ratingValue.toString()));
        }

        infoDiv.innerHTML = lines.join("<br>");
        box.appendChild(infoDiv);

        actionsBoard.parentNode.insertBefore(box, actionsBoard);
    }

    function infoLine(label, value) {
        return `<span style="color:#fffa33">${label}: </span>${value}`;
    }

    function formatNumber(num) {
        if (num == null || isNaN(num)) return "-";
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
        Object.entries(tableRatings).forEach(([pos, value]) => {
            predicted[pos] = value * factor;
        });

        const maxValue = Math.max(...Object.values(predicted));
        const maxKey = Number(Object.keys(predicted).find(k => predicted[k] === maxValue));

        const table = document.createElement("table");
        table.className = "skilltable";
        table.style.marginLeft = "auto";
        table.style.marginRight = "auto";

        const header =
            `<th>${TEXT.positionColumn}</th>` +
            `<th>DC</th>` +
            `<th>DL/DR</th>` +
            `<th>DMC</th>` +
            `<th>DML/DMR</th>` +
            `<th>MC</th>` +
            `<th>ML/MR</th>` +
            `<th>OMC</th>` +
            `<th>OML/OMR</th>` +
            `<th>FC</th>`;

        let row = `<td>${TEXT.rating}</td>`;
        for (const pos of TABLE_POSITIONS) {
            const val = predicted[pos].toFixed(1);
            const isCurrent = group.members.includes(pos);
            const isBest = pos === maxKey && !isCurrent;

            if (isBest) {
                row += `<td style="color:lightgreen">${val}</td>`;
            } else if (isCurrent) {
                row += `<td style="color:yellow">${val}</td>`;
            } else {
                row += `<td>${val}</td>`;
            }
        }

        table.innerHTML = `<tbody><tr>${header}</tr><tr>${row}</tr></tbody>`;

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

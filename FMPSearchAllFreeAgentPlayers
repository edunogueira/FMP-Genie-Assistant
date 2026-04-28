// ==UserScript==
// @name         Search all free agent players
// @namespace    https://github.com/edunogueira/FMP-Genie-Assistant
// @version      1.0
// @description  Search all free agent players
// @include      https://footballmanagerproject.com/Transfers/TransfersList
// @include      https://www.footballmanagerproject.com/Transfers/TransfersList
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';
    let allPlayers = [];

    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const interval = 200;
            let elapsed = 0;

            const timer = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(timer);
                    resolve(el);
                }
                elapsed += interval;
                if (elapsed >= timeout) {
                    clearInterval(timer);
                    reject(`Element not found: ${selector}`);
                }
            }, interval);
        });
    }

    function buildSearchPayload(countryCode) {
        const ageLText = document
            .querySelector('#agel .fmpselect-selected')
            ?.innerText.replace(/([^0-9])/g, '') || '18';

        const ageHText = document
            .querySelector('#ageh .fmpselect-selected')
            ?.innerText.replace(/([^0-9])/g, '') || '38';

        const sks = document.querySelectorAll('#sks .fmpselect-selected');
        const skl = document.querySelectorAll('#skl .fmpselect-selected');

        const skills = {};

        for (let i = 0; i < sks.length; i++) {
            const skillName = translatedSkillToSkill(sks[i].innerText);
            const value = parseFloat(skl[i].innerText);
            skills[skillName] = value;
        }

        return {
            Rule: searchStatus.Sel["rule"],
            Side: searchStatus.Sel["side"],
            Foot: searchStatus.Sel["foot"],
            Nat: countryCode,
            AgeL: parseInt(ageLText),
            AgeH: parseInt(ageHText),
            Skills: skills,
            Type: 16
        };
    }

    async function searchByCountry(countryCode) {
        const payload = buildSearchPayload(countryCode);

        const response = await fetch('/Search/Update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Request failed for ${countryCode}`);
        }

        const result = await response.json();

        if (!result.success) {
            console.warn(`No success for ${countryCode}`);
            return;
        }

        for (const item of result.transferlist) {
            const player = item.info;
            player.myTeamId = result.teamId;
            allPlayers.push(player);
            console.log(`Find ${result.transferlist.length} players in ${countryCode} | Total: ${allPlayers.length}`);
        }
    }

    async function processAll(countries) {
        for (const code of countries) {
            await searchByCountry(code);

            await new Promise(r => setTimeout(r, 300));
        }
    }

    function renderFinal() {
        plList['#agxList'] = allPlayers;

        reorderTable("#agxList", null, {
            rowFunction: createRow,
            headerTitles: null
        });
    }

    function createSearchAllButton() {
        const btn = document.createElement('div');
        btn.className = 'trxbtn noselect action update';

        btn.innerHTML = `
          <img src="/icons/Bigger/Update.png">
          <span>Buscar Todos Países</span>
      `;

        btn.addEventListener('click', async () => {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.6';

            try {
                const countries = Array.from(
                    document.querySelectorAll('#nat .fmpselect-items span[title]')
                ).map(el => el.getAttribute('title').trim());

                allPlayers = [];

                await processAll(countries);

                allPlayers = Array.from(
                    new Map(allPlayers.map(p => [p.id, p])).values()
                );

                renderFinal();

                console.log('Finished. Total players:', allPlayers.length);

            } catch (e) {
                console.error(e);
            } finally {
                btn.style.pointerEvents = 'auto';
                btn.style.opacity = '1';
            }
        });

        return btn;
    }

    async function injectButton() {
        const clearBtn = await waitForElement('#trxCntrls .trxbtn.clear');

        const parent = clearBtn.parentElement;

        const newBtn = createSearchAllButton();

        parent.appendChild(newBtn);
    }

    async function init() {
        try {
            await waitForElement('#nat .fmpselect-items');
            await injectButton();
        } catch (err) {
            console.error(err);
        }
    }

    window.addEventListener('load', init);
})();

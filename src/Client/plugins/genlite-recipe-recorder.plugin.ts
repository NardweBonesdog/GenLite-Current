/*
    Copyright (C) 2022-2023 dpeGit
*/
/*
    This file is part of GenLite.

    GenLite is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

    GenLite is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along with Foobar. If not, see <https://www.gnu.org/licenses/>.
*/

import { GenLitePlugin } from '../core/interfaces/plugin.class';

export class GenLiteRecipeRecorderPlugin extends GenLitePlugin {
    static pluginName = 'GenLiteRecipeRecorderPlugin';

    isCrafting = false;
    recipe;
    recipeName = "";
    prevInventory;
    prevVerb;
    swapped_inv = false;

    isGathering = false;
    gatherTask = "";
    gatherNode = "";

    recipeResults = {};
    gatherResults = {};

    isPluginEnabled: boolean = false;

    uiTab: HTMLElement = null;
    settingsMenu: HTMLElement = null;
    listContainer: HTMLElement = null;
    recipeElements: Record<string, HTMLElement> = {};

    session = null;
    sessionButton: HTMLElement = null;
    itemList: Record<string, number> = {};

    async init() {
        document.genlite.registerPlugin(this);

        let plugin = this;
        window.addEventListener('keydown', this.keyDownHandler.bind(this));
        window.addEventListener('keyup', this.keyUpHandler.bind(this));
        window.addEventListener('focus', function() {
            window.addEventListener('mousemove', function onmousemove(e) {
                window.removeEventListener('mousemove', onmousemove, false);
                if (e.altKey) {
                    plugin.keyDownHandler(e);
                } else {
                    plugin.keyUpHandler(e);
                }
            });
        });
        document.genlite.database.add((db) => {
            if (db.objectStoreNames.contains('recipesessions')) return;
            let store = db.createObjectStore('recipesessions', {
                keyPath: 'start',
            });
        });

        let dropTableString = localStorage.getItem("GenliteRecipeRecorder")
        if (dropTableString == null) {
            this.recipeResults = {};
            this.gatherResults = {};
        } else {
            let saved = JSON.parse(dropTableString);
            this.recipeResults = saved.recipe ? saved.recipe : {};
            this.gatherResults = saved.gathering ? saved.gathering : {};
            for (const key in this.recipeResults) {
                for (const itemId in this.recipeResults[key].input) {
                    this.itemList[itemId] = 0;
                }
                for (const itemId in this.recipeResults[key].output) {
                    this.itemList[itemId] = 0;
                }
            }
            for (const skill in this.gatherResults) {
                for (const source in this.gatherResults[skill]) {
                    for (const itemId in this.gatherResults[skill][source]) {
                        this.itemList[itemId] = 0;
                    }
                }
            }
        }
    }

    async postInit() {
        this.createCSS();
        this.createUITab();
        document.genlite.ui.registerPlugin("Recipe Recorder", null, this.handlePluginState.bind(this));
    }

    createCSS() {
        const style = document.createElement('style');
        style.innerHTML = `
            .genlite-recipes-container {
                display: flex;
                flex-direction: column;
                overflow-x: hidden;
                color: #ffd593;
                font-family: acme,times new roman,Times,serif;
                height: 100%;
            }

            .genlite-recipes-list {
                display: flex;
                flex-direction: column;
                overflow-y: scroll;
                height: 100%;
                flex-grow: 1;
                border-bottom: 1px solid rgb(66, 66, 66);
            }

            .genlite-recipes-row {
                display: flex;
                flex-direction: column;
                flex-shrink: 0;
                border-bottom: 1px solid rgb(66, 66, 66);
                border-top: 1px solid rgb(0, 0, 0);
            }

            .genlite-recipes-iconlist {
                display: flex;
                column-gap: 0.5em;
                padding: 0.25em;
                position: relative;
            }

            .genlite-recipes-arrow {
                width: 28px;
                height: 28px;
                cursor: pointer;
                display: flex;
                align-items: center;
            }

            .genlite-recipes-arrow i {
                margin: auto;
            }

            .genlite-recipes-icon {
                width: 28px;
                height: 28px;
                position: relative;
            }

            .genlite-recipes-trash {
                display: none;
                position: absolute;
                right: 0;
                color: red;
                padding-right: 1em;
                cursor: pointer;
                top: 50%;
                transform: translateY(-50%);
                z-index: 2;
            }

            .genlite-recipes-output {
                display: none;
                flex-direction: column;
                padding-left: 1em;
                background-color: rgb(33, 33, 33);
                margin-left: 1em;
                margin-right: 1em;
                margin-bottom: 1em;
                border-bottom-left-radius: 1em;
                padding: 1em;
                border-bottom-right-radius: 1em;
                box-shadow: -2px 2px rgb(30,30,30);
            }

            .genlite-recipes-output-row {
                display: flex;
                column-gap: 1em;
                align-items: center;
            }

            .genlite-recipes-search-row {
                width: 100%;
                height: 25px;
                border-bottom: 1px solid rgb(66, 66, 66);
                display: flex;
                align-items: center;
            }

            .genlite-recipes-search {
                background-color: rgb(42, 40, 40);
                color: rgb(255, 255, 255);
                font-size: 16px;
                border-radius: 0px;
                padding-left: 10px;
                padding-right: 10px;
                box-sizing: border-box;
                outline: none;
                width: 100%;
                border: medium none;
                margin-left: auto;
                margin-right: auto
            }

            .genlite-recipes-session-row {
                display: flex;
                padding: 1em;
                justify-content: center;
            }

            .genlite-recipes-session-button {
                padding: 0.25em;
                background-color: #4b4b4b;
                border: 1px solid black;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }

    createUITab() {
        if (this.uiTab) {
            // not creating, redrawing
            this.settingsMenu.innerHTML = '';
            this.recipeElements = {};
        } else {
            this.settingsMenu = <HTMLElement>document.createElement("div");
            this.settingsMenu.classList.add("genlite-recipes-container");
        }

        // search bar
        let searchrow = <HTMLElement>document.createElement("div");
        searchrow.classList.add("genlite-recipes-search-row");
        this.settingsMenu.appendChild(searchrow);

        let search = <HTMLInputElement>document.createElement("input");
        searchrow.appendChild(search);
        search.classList.add("genlite-recipes-search");
        search.placeholder = "Search Recipes...";
        search.type = "text";

        search.onfocus = () => {
            document.game.CHAT.focus_locked = true;
        }

        search.onblur = () => {
            document.game.CHAT.focus_locked = false;
        }

        search.oninput = function (e) {
            let value = search.value.trim().toLowerCase();
            let values = [];
            for (const v of value.split(",")) {
                values.push(v.trim());
            }

            let rows = document.getElementsByClassName("genlite-recipes-row");
            for (let i = 0; i < rows.length; i++) {
                let row = rows[i] as HTMLElement;
                let content = row.innerHTML.toLowerCase();
                if (value === "") {
                    row.style.removeProperty("display");
                    continue;
                }

                let match = true;
                for (let v of values) {
                    let invert = v[0] === "-";
                    if (invert) {
                        v = v.substr(1);
                    }

                    if (!invert && !content.includes(v)) {
                        match = false;
                        break;
                    } else if (invert && content.includes(v)) {
                        match = false;
                        break;
                    }
                }

                if (match) {
                    row.style.removeProperty("display");
                } else {
                    row.style.display = "none";
                }
            }
        };

        // recipe list
        this.listContainer = <HTMLElement>document.createElement("div");
        this.listContainer.classList.add("genlite-recipes-list");
        this.settingsMenu.appendChild(this.listContainer);
        this.createRecipeList();

        let sessionRow = <HTMLElement>document.createElement("div");
        sessionRow.classList.add("genlite-recipes-session-row");
        this.settingsMenu.appendChild(sessionRow);

        this.sessionButton = <HTMLElement>document.createElement("div");
        this.sessionButton.classList.add("genlite-recipes-session-button");
        this.sessionButton.innerText = "Begin Session";
        sessionRow.appendChild(this.sessionButton);

        let plugin = this;
        this.sessionButton.onclick = function (e) {
            if (plugin.session === null) {
                plugin.beginSession();
                plugin.sessionButton.innerText = "End Session";
            } else {
                plugin.endSession();
                plugin.sessionButton.innerText = "Begin Session";
            }
        };

        if (!this.uiTab) {
            this.uiTab = document.genlite.ui.addTab("kitchen-set", "Recipe Recorder", this.settingsMenu, this.isPluginEnabled);
        }
    }

    createRecipeList() {
        let results = this.recipeResults;
        if (this.session) {
            results = this.session.results;
        }
        for (const recipeName in results) {
            this.createRecipeRow(results, recipeName);
        }
    }

    createRecipeRow(results, recipeName: string) {
        const result = results[recipeName];
        let row = <HTMLElement>document.createElement("div");
        row.classList.add("genlite-recipes-row");
        this.listContainer.appendChild(row);

        this.recipeElements[recipeName] = row;

        // inputs
        let icons = <HTMLElement>document.createElement("div");
        icons.classList.add("genlite-recipes-iconlist");
        row.appendChild(icons);

        let arrow = <HTMLElement>document.createElement("div");
        arrow.classList.add("genlite-recipes-arrow");
        let i = <HTMLElement>document.createElement("i");
        i.classList.add("fa-chevron-right");
        i.classList.add("fas");
        arrow.appendChild(i);
        icons.appendChild(arrow);

        if (this.session === null) {
            // TODO: trash icon when tracking a session
            let trash = <HTMLElement>document.createElement("div");
            trash.classList.add("genlite-recipes-trash");
            trash.innerHTML = '<i class="fas fa-trash"></i>';
            icons.appendChild(trash);
            trash.onclick = (e) => {
                let plugin = document['GenLiteRecipeRecorderPlugin'];
                plugin.deleteRecipe(recipeName);
                plugin.recipeElements[recipeName].remove();
                delete plugin.recipeResults[recipeName];
            };
        }

        for (const item in result.input) {
            let icon = this.createIconDiv(item);
            icons.appendChild(icon);
        }

        // now draw outputs
        let outputBox = <HTMLElement>document.createElement("div");
        outputBox.classList.add("genlite-recipes-output");
        row.appendChild(outputBox);

        this.updateOutputBox(outputBox, recipeName, result);

        arrow.onclick = function (e) {
            if (i.classList.toggle("fa-chevron-right")) {
                i.classList.remove("fa-chevron-down");
                outputBox.style.display = "none";
            } else {
                i.classList.add("fa-chevron-down");
                outputBox.style.display = "flex";
            }
        };
    }

    createIconDiv(item) {
        let div = <HTMLImageElement>document.createElement("div");
        div.classList.add("genlite-recipes-icon");

        let icon = <HTMLImageElement>document.createElement("img");
        icon.classList.add("genlite-recipes-icon");
        icon.title = item;
        div.appendChild(icon);

        const itemdata = document.game.DATA.items[item];
        if (itemdata) {
            if (itemdata.name) {
                icon.title = itemdata.name;
            }

            if (itemdata.image) {
                icon.src = document.game.getStaticPath('items/' + itemdata.image);
            } else if (itemdata.images) {
                let image = itemdata.images[itemdata.images.length - 1][1];
                icon.src = document.game.getStaticPath('items/' + image);
            }

            if (itemdata.border) {
                let path = `items/placeholders/${itemdata.border}_border.png`;
                path = document.game.getStaticPath(path);
                let qual = <HTMLImageElement>document.createElement("img");
                qual.classList.add("new_ux-inventory_quality-image");
                qual.src = path;
                div.appendChild(qual);
            }
        }

        if (!icon.src) {
            icon.src = document.game.getStaticPath('items/unknown.png');
        }
        return div;
    }

    updateOutputBox(outputBox: HTMLElement, recipeName, results) {
        let seo = "";

        function addSEO(prefix, s) {
            // exact item name e.g. "H.Q. Iron Component (Sheet)"
            s = s + ';';
            seo += prefix + s;

            // quality aliases e.g. "LQ Iron Bar"
            seo += prefix + s.replace("L.Q.", "LQ").replace("H.Q.", "HQ");

            // normal quality aliases e.g. "NQ Mithril Dagger"
            if (!s.includes("L.Q.") && !s.includes("H.Q.")) {
                seo += prefix + "N.Q. " + s;
                seo += prefix + "NQ " + s;
            }

            // item without quality
            seo += prefix + s.replace("L.Q. ", "").replace("H.Q. ", "");

            if (s.includes("Component")) {
                // component aliases e.g. "H.Q. Sheet"
                let stripped = s
                    .replace("Bronze Component (", "")
                    .replace("Iron Component (", "")
                    .replace("Steel Component (", "")
                    .replace("Mithril Component (", "");
                seo += prefix + stripped;

                // and component quality aliases e.g. "NQ Sheet" and "Sheet"
                seo += prefix + stripped.replace("L.Q.", "LQ").replace("H.Q.", "HQ");
                if (!stripped.includes("L.Q.") && !stripped.includes("H.Q.")) {
                    seo += prefix + "N.Q. " + stripped;
                    seo += prefix + "NQ " + stripped;
                }
                seo += prefix + stripped.replace("L.Q. ", "").replace("H.Q. ", "");

                // again but include metal type e.g. "NQ Bronze Sheet" and "Iron Sheet"
                stripped = s.replace("Component (", "");
                seo += prefix + stripped;
                seo += prefix + stripped.replace("L.Q.", "LQ").replace("H.Q.", "HQ");
                if (!stripped.includes("L.Q.") && !stripped.includes("H.Q.")) {
                    seo += prefix + "N.Q. " + stripped;
                    seo += prefix + "NQ " + stripped;
                }
                seo += prefix + stripped.replace("L.Q. ", "").replace("H.Q. ", "");
            }
        }

        let nInputs = Infinity;
        for (const item in results.input) {
            let amt = results.input[item];
            let index = recipeName.indexOf(item);
            if (index != -1) {
                let remaining = recipeName.substring(index + item.length);
                let sep = remaining.indexOf("__");
                if (sep == -1) {
                    sep = remaining.length;
                }
                let count = parseInt(remaining.substring(0, sep));
                amt /= count;
            }

            if (amt < nInputs) {
                nInputs = amt;
            }

            let seoitem = item;
            const itemdata = document.game.DATA.items[item];
            if (itemdata && itemdata.name) {
                seoitem = itemdata.name;
            }
            addSEO("in:", seoitem);
        }

        outputBox.innerHTML = '';
        outputBox.appendChild(document.createTextNode(`${nInputs} attempts`));

        for (const item in results.output) {
            let orow = <HTMLElement>document.createElement("div");
            orow.classList.add("genlite-recipes-output-row");

            let icon = this.createIconDiv(item);
            orow.appendChild(icon);

            let seoitem = item + ";";
            const itemdata = document.game.DATA.items[item];
            if (itemdata && itemdata.name) {
                seoitem = itemdata.name + ";";
            }
            addSEO("out:", seoitem);

            let n = results.output[item];
            let pct = (n / nInputs * 100);
            pct = Math.round(pct * 100) / 100;
            orow.appendChild(document.createTextNode(`${n} (${pct}%)`));
            outputBox.appendChild(orow);
        }

        let seospan = <HTMLElement>document.createElement("span");
        seospan.style.display = "none";
        seospan.innerText = seo;
        outputBox.appendChild(seospan);
    }

    updateRecipeRow(recipeName: string) {
        let row = this.recipeElements[recipeName];
        let results = this.recipeResults;
        if (this.session) {
            results = this.session.results;
        }
        if (!row) {
            this.createRecipeRow(results, recipeName);
        } else {
            let recipe = results[recipeName];
            let es = row.getElementsByClassName('genlite-recipes-output');
            if (es) {
                let outputBox = <HTMLElement>es[0];
                this.updateOutputBox(outputBox, recipeName, recipe);
            }
        }
    }

    handlePluginState(state: boolean): void {
        this.isPluginEnabled = state;
        if (this.uiTab) {
            this.uiTab.style.display = state ? "flex" : "none";
        }
    }

    Network_logoutOK() {
        this.isCrafting = false;
        this.isGathering = false;
    }

    Network_action(verb, params) {
        if (this.isPluginEnabled === false) {
            return;
        }
        if (params.hasOwnProperty('action')) {
            if (params.action.hasOwnProperty('recipe')) {
                this.isCrafting = true;
                this.isGathering = false;
                this.recipe = params.action.recipe;
                this.prevInventory = document.game.INVENTORY.items;
                this.recipeName = params.action.recipe;
                let mats;
                if (params.action.params) {
                    mats = Object.keys(params.action.params);
                    mats = mats.sort();
                    for (let i of mats) // if params is set here then record a complex recipe name
                        this.recipeName = this.recipeName.concat("__", i, params.action.params[i]);
                }
                if (this.recipeResults[this.recipeName] === undefined) {
                    this.recipeResults[this.recipeName] = {
                        input: {},
                        output: {}
                    };
                }
                return;
            }

            switch (params.action) {
                case "Mine":
                    this.gatherTask = "mining";
                    break;
                case "Chop down":
                    this.gatherTask = "logging";
                    break;
                case "Harvest":
                    this.gatherTask = "botany";
                    break;
                default:
                    this.gatherTask = "";
                    break;
            }
            if (this.gatherTask !== "") {
                this.isGathering = true;
                this.isCrafting = false;
                this.gatherNode = params.id;
                this.prevInventory = document.game.INVENTORY.items;
            } else {
                this.isGathering = false;
                this.isCrafting = false;
            }
            return;
        }

        if (verb == "inventory_swap") {
            this.swapped_inv = true;
            return;
        }

        /* if we get here check the white listed (non interupting) verbs and return otherwise set crafting and gathering to false */
        let whitelistverbs = ["request_sync", "p", "chat_private", "change_combat_stance", "conversation", "load_complete"];
        if (whitelistverbs.includes(verb)) {
            return;
        }
        this.isGathering = false;
        this.isCrafting = false;
    }

    Network_handle(verb, payload) {
        if (this.isPluginEnabled === false) {
            return;
        }

        let itemList = {};
        /* TODO? I dont like relying on NETWORK message orders
            but after filtering I have never seen them come in a different one
        */
        if (!(this.isCrafting || this.isGathering))
            return;
        if (verb == 'inventory') {
            if (this.swapped_inv) {
                this.swapped_inv = false;
                return;
            }
            for (let i in this.prevInventory) {
                /* add up the quantities of the inventory */
                if (itemList[this.prevInventory[i].item] === undefined)
                    itemList[this.prevInventory[i].item] = 0;

                if (this.prevInventory[i].quantity === undefined) {
                    itemList[this.prevInventory[i].item] += 1;
                } else {
                    itemList[this.prevInventory[i].item] += this.prevInventory[i].quantity;
                }
            }

            /* subtract the new inventory */
            for (let i in payload) {
                if (itemList[payload[i].item] === undefined)
                    itemList[payload[i].item] = 0;

                if (payload[i].quantity === undefined) {
                    itemList[payload[i].item] -= 1;
                } else {
                    itemList[payload[i].item] -= payload[i].quantity;
                }
            }

            if (this.isCrafting) {
                this.storeRecipeData(itemList);
            } else if (this.isGathering) {
                this.storeGatherData(itemList);
            }
            this.prevInventory = structuredClone(payload);
            localStorage.setItem("GenliteRecipeRecorder", JSON.stringify({ recipe: this.recipeResults, gathering: this.gatherResults }));
            /* determines if crafting is done by looking for the stop animation
                that comes only after the crafting animation
            */
        } else if (verb == "action" && payload.type.match("fail")) {
            if (this.gatherResults[this.gatherTask] === undefined)
                this.gatherResults[this.gatherTask] = {};
            let gather = this.gatherResults[this.gatherTask];
            let nodeKey = document.game.GRAPHICS.scene.allObjects[this.gatherNode].modelInfo.nick;
            if (gather[nodeKey] === undefined)
                gather[nodeKey] = {};
            let node = gather[nodeKey];
            if (node["nothing"] == undefined)
                node["nothing"] = 0;
            node["nothing"]++;
            localStorage.setItem("GenliteRecipeRecorder", JSON.stringify({ recipe: this.recipeResults, gathering: this.gatherResults }));
        }
        this.prevVerb = verb;
    }

    storeRecipeData(itemList) {
        /* negative values are outputs
            positive are inputs
        */

        if (this.session && this.session.results[this.recipeName] === undefined) {
            // need to initialize here in case the player begind a new session
            // after starting a recipe
            this.session.results[this.recipeName] = {
                input: {},
                output: {}
            };
        }

        let isNothing = true;
        for (let i in itemList) {
            if (i == "undefined")
                continue;

            if (itemList[i] < 0) {
                if (this.recipeResults[this.recipeName].output[i] === undefined) {
                    this.recipeResults[this.recipeName].output[i] = 0;
                }
                this.recipeResults[this.recipeName].output[i] -= itemList[i];
                if (this.session) {
                    if (this.session.results[this.recipeName].output[i] === undefined) {
                        this.session.results[this.recipeName].output[i] = 0;
                    }
                    this.session.results[this.recipeName].output[i] -= itemList[i];
                }
                isNothing = false;
            } else if (itemList[i] > 0) {
                if (this.recipeResults[this.recipeName].input[i] === undefined) {
                    this.recipeResults[this.recipeName].input[i] = 0;
                }
                this.recipeResults[this.recipeName].input[i] += itemList[i];
                if (this.session) {
                    if (this.session.results[this.recipeName].input[i] === undefined) {
                        this.session.results[this.recipeName].input[i] = 0;
                    }
                    this.session.results[this.recipeName].input[i] += itemList[i];
                }
            }
        }
        if (isNothing) {
            if (this.recipeResults[this.recipeName].output["nothing"] === undefined) {
                this.recipeResults[this.recipeName].output["nothing"] = 0;
            }
            this.recipeResults[this.recipeName].output["nothing"]++;
            if (this.session) {
                if (this.session.results[this.recipeName].output["nothing"] === undefined) {
                    this.session.results[this.recipeName].output["nothing"] = 0;
                }
                this.session.results[this.recipeName].output["nothing"]++;
            }
        }

        this.updateRecipeRow(this.recipeName);
        if (this.session) this.saveSession(this.session);
    }

    storeGatherData(itemList) {
        if (this.gatherResults[this.gatherTask] === undefined)
            this.gatherResults[this.gatherTask] = {};
        let gather = this.gatherResults[this.gatherTask];
        let nodeKey = document.game.GRAPHICS.scene.allObjects[this.gatherNode].modelInfo.impl.params;
        if (gather[nodeKey] === undefined)
            gather[nodeKey] = {};
        let node = gather[nodeKey];
        for (let i in itemList) {
            if (i == "undefined")
                continue;
            if (itemList[i] < 0) {
                if (node[i] === undefined)
                    node[i] = 0;
                node[i] -= itemList[i];
            }
        }

    }

    resetResultsList() {
        this.recipeResults = {};
        this.gatherResults = {};
        localStorage.removeItem("GenliteRecipeRecorder");
    }

    deleteRecipe(key: string) {
        let deletedStr = localStorage['genliteDeletedRecipes'];
        if (!deletedStr) {
            deletedStr = '[]';
        }
        let deleted = JSON.parse(deletedStr ? deletedStr : '[]');
        deleted.push({
            key: key,
            time: Date.now(),
            data: this.recipeResults[key],
        });
        localStorage.setItem("genliteDeletedRecipes", JSON.stringify(deleted));
        delete this.recipeResults[key];
        localStorage.setItem("GenliteRecipeRecorder", JSON.stringify({ recipe: this.recipeResults, gathering: this.gatherResults }));
    }
    keyDownHandler(event) {
        if (event.key !== "Alt" && !event.altKey)
            return;

        event.preventDefault();
        if (!event.repeat) {
            let eles = document.getElementsByClassName('genlite-recipes-trash');
            for (let i = 0; i < eles.length; i++) {
                let el = eles[i] as HTMLElement;
                el.style.display = 'flex';
            }
        }
    }

    keyUpHandler(event) {
        if (event.key !== "Alt" && event.altKey)
            return;

        event.preventDefault();
        let eles = document.getElementsByClassName('genlite-recipes-trash');
        for (let i = 0; i < eles.length; i++) {
            let el = eles[i] as HTMLElement;
            el.style.removeProperty('display');
        }
    }

    beginSession() {
        if (this.session) return;
        this.session = {
            start: Date.now(),
            results: {},
            end: -1,
        };
        this.saveSession(this.session);
        this.createUITab();
    }

    saveSession(session) {
        document.genlite.database.storeTx(
            'recipesessions',
            'readwrite',
            (store) => {
                store.put(session);
            }
        );
    }

    endSession() {
        if (this.session === null) return;
        this.session.end = Date.now();
        this.saveSession(this.session);
        this.session = null
        this.createUITab();
    }
}

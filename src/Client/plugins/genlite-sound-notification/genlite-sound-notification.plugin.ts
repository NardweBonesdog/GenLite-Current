/*
    Copyright (C) 2023 dpeGit
*/
/*
    This file is part of GenLite.

    GenLite is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

    GenLite is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along with Foobar. If not, see <https://www.gnu.org/licenses/>.
*/

import {GenLitePlugin} from '../../core/interfaces/plugin.class';
import { BoostDepletion } from './BoostDepletion.class';
import { HealthRegeneration } from './HealthRegeneration.class';

export class GenLiteSoundNotification extends GenLitePlugin {
    static pluginName = 'GenLiteSoundNotification';

    doHealthCheck: boolean = false;
    doBoostCheck: boolean = false;
    doHealthRegenerationCheck: boolean = false;
    healthThreshold : number = 1;

    doInvCheck: boolean = false;
    invThreshold: number = 1;
    prevSlotsUsed = null;

    overrideIGNVolume: boolean = false;
    initialIGNVolumeSet: boolean = true; // Sorry I know this is jank but I'm tired and couldn't think of a better way to do it
    overrideVolume: number = 1;

    genliteSoundListener;
    genliteSFXPlayer;
    playerInUse;

    boostDepletion: BoostDepletion = new BoostDepletion();
    healthRegeneration: HealthRegeneration = new HealthRegeneration();

    // Plugin Settings
    pluginSettings : Settings = {
        "Low Health": {
            type: "checkbox",
            oldKey: "GenLite.LowHealthSound.Enable",
            value: this.doHealthCheck,
            stateHandler: this.handleDoHealthCheck.bind(this),
            children: {
                "Health Threshold": {
                    type: "range",
                    oldKey: "GenLite.LowHealth.0",
                    value: this.healthThreshold,
                    stateHandler: this.setHealthThreshold.bind(this),
                    min: 1,
                    max: 100
                }
            }
        },
        "Boost Depletion": {
            type: "checkbox",
            value: this.doBoostCheck,
            stateHandler: this.handleDoBoostDepletionCheck.bind(this),
        },
        "Health Regeneration": {
            type: "checkbox",
            value: this.doHealthRegenerationCheck,
            stateHandler: this.handleDoHealthRegenerationCheck.bind(this),
        },
        "Inventory Space": {
            type: "checkbox",
            oldKey: "GenLite.InvCheck.Enable",
            value: this.doInvCheck,
            stateHandler: this.handleInvCheckEnableDisable.bind(this),
            children: {
                "Inventory Threshold": {
                    type: "range",
                    oldKey: "GenLite.InvThreshold.0",
                    value: this.invThreshold,
                    stateHandler: this.setInvThreshold.bind(this),
                    min: 1,
                    max: 30
                }
            }
        },
        "Override Game Volume": {
            type: "checkbox",
            oldKey: "GenLite.overrideIGNVolume.Enable",
            value: this.overrideIGNVolume,
            stateHandler: this.handelOverrideVolumeEnableDisable.bind(this),
            children: {
                "Override Volume": {
                    type: "range",
                    oldKey: "GenLite.overrideVolume.0",
                    value: this.overrideVolume,
                    stateHandler: this.setOverrideVolume.bind(this),
                    min: 1,
                    max: 100
                }
            }
        },
    };

    async init() {
        document.genlite.registerPlugin(this);

        /* create a new SFXPlayer we will swap to this if overriding 
        this is so the games normal effects play at their correct volume
        */
        this.genliteSoundListener = new document.game.THREE.AudioListener();
        this.genliteSoundListener.setMasterVolume(this.overrideVolume / 100.0) //bypas setvolume so you dont have to override it 
        this.genliteSFXPlayer = new document.game.SFXPlayer.constructor();
        this.genliteSFXPlayer.load();
        this.genliteSFXPlayer.play = (key, volume = 1) => { this.overridePlay(key, volume) }; //override the default set volume
        this.playerInUse = document.game.SFX_PLAYER;
        if (this.overrideVolume)
            this.playerInUse = this.genliteSFXPlayer;

        this.boostDepletion.init();
        this.healthRegeneration.init();
    }

    async postInit() {
        document.genlite.ui.registerPlugin("Sound Notifications", null, this.handlePluginState.bind(this), this.pluginSettings);
    }

    handlePluginState(state: boolean): void {
        // TODO: Implement
        this.warn(`GenLiteSoundNotification needs to implement handlePluginState()`);
    }

    handleDoBoostDepletionCheck(state: boolean) {
      if (state) {
        this.boostDepletion.enable();
      } else {
        this.boostDepletion.disable();
      }

      this.doBoostCheck = state;
    }

    handleDoHealthRegenerationCheck(state: boolean) {
      if (state) {
        this.healthRegeneration.start();
      } else {
        this.healthRegeneration.stop();
      }

      this.doHealthRegenerationCheck = state;
    }

    handleDoHealthCheck(state: boolean) {
        this.doHealthCheck = state;
    }

    handleInvCheckEnableDisable(state: boolean) {
        this.doInvCheck = state;
    }

    /* switch between the two players for notifcations */
    handelOverrideVolumeEnableDisable(state: boolean) {
        this.overrideIGNVolume = state;
        if (state) {
            this.playerInUse = this.genliteSFXPlayer;
        } else {
            this.playerInUse = document.game.SFX_PLAYER;
        }
    }

    /* sets volume and plays a test sound on change */
    setOverrideVolume(threshold: number) {
        this.overrideVolume = threshold;
        this.genliteSoundListener.setMasterVolume(this.overrideVolume / 100.0)
        // Added a check to see if this is the first time we are setting the volume so we dont play the sound on load-in (via UI-call)
        if (!this.playerInUse.muted && !this.initialIGNVolumeSet)
            this.playerInUse.play('spell-failure')
        this.initialIGNVolumeSet = false;
    }

    setHealthThreshold(threshold: number) {
        this.healthThreshold = threshold;
    }

    setInvThreshold(threshold: number) {
        this.invThreshold = threshold;
    }

    Game_combatUpdate(update) {
        if (update.id != document.game.PLAYER.id)
            return;
        if ((update.hp / update.maxhp) <= (this.healthThreshold / 100) && this.doHealthCheck)
            this.playerInUse.play('spell-failure');
    }

    Inventory_handleUpdatePacket(packet) {
        if (!this.doInvCheck)
            return;
        let inUse = Object.keys(document.game.INVENTORY.items).length;
        if (this.prevSlotsUsed == null) {
            this.prevSlotsUsed = inUse;
        }
        if (inUse > this.prevSlotsUsed && inUse >= this.invThreshold)
            this.playerInUse.play('inventory-full');
        this.prevSlotsUsed = inUse;

    }

    /* play override, currently absolutely no safety features but we shouldnt need any */
    overridePlay(key, volume = 1) {
        let sound = new document.game.THREE.Audio(this.genliteSoundListener);
        sound.setLoop(false);
        sound.setBuffer(this.genliteSFXPlayer.sounds[key]);
        sound.setVolume(volume);
        sound.play();
    }
}

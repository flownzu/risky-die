import { MAX_COUNT, MIN_COUNT, clampCount, extremeChance, faceList, mapFace } from "./mapping.mjs";
import { OPTION_KEY, installPatches, riskyCount } from "./core.mjs";

const MODULE_ID = "risky-die";

/** Ist der riskante Würfel für den nächsten Wurf dieses Clients scharf geschaltet? */
let armed = false;

/* -------------------------------------------- */
/*  Einstellungen                               */
/* -------------------------------------------- */

const setting = key => game.settings.get(MODULE_ID, key);

function registerSettings() {
  game.settings.register(MODULE_ID, "count", {
    name: "RISKYDIE.Settings.Count.Name",
    hint: "RISKYDIE.Settings.Count.Hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: MIN_COUNT, max: MAX_COUNT, step: 1 },
    default: 2,
    onChange: () => refreshButton()
  });

  game.settings.register(MODULE_ID, "availability", {
    name: "RISKYDIE.Settings.Availability.Name",
    hint: "RISKYDIE.Settings.Availability.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      always: "RISKYDIE.Settings.Availability.Always",
      unlock: "RISKYDIE.Settings.Availability.Unlock",
      off: "RISKYDIE.Settings.Availability.Off"
    },
    default: "unlock",
    onChange: () => { if ( !isAvailable() ) disarm(); refreshButton(); }
  });

  // Freigabe durch den GM, nur relevant bei availability = "unlock".
  game.settings.register(MODULE_ID, "unlocked", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false,
    onChange: value => {
      if ( !value ) disarm();
      refreshButton();
      if ( !game.user.isGM && (setting("availability") === "unlock") ) {
        ui.notifications.info(game.i18n.localize(value ? "RISKYDIE.Notify.Unlocked" : "RISKYDIE.Notify.Locked"));
      }
    }
  });

  game.settings.register(MODULE_ID, "onlyD20Tests", {
    name: "RISKYDIE.Settings.OnlyD20Tests.Name",
    hint: "RISKYDIE.Settings.OnlyD20Tests.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "once", {
    name: "RISKYDIE.Settings.Once.Name",
    hint: "RISKYDIE.Settings.Once.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "showButton", {
    name: "RISKYDIE.Settings.ShowButton.Name",
    hint: "RISKYDIE.Settings.ShowButton.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => refreshButton()
  });
}

function registerKeybindings() {
  game.keybindings.register(MODULE_ID, "toggle", {
    name: "RISKYDIE.Keybinding.Toggle",
    editable: [],
    onDown: () => { toggle(); return true; }
  });
}

/* -------------------------------------------- */
/*  Zustand                                     */
/* -------------------------------------------- */

function isAvailable() {
  switch ( setting("availability") ) {
    case "always": return true;
    case "unlock": return setting("unlocked");
    default: return false;
  }
}

function arm() {
  if ( !isAvailable() ) {
    ui.notifications.warn(game.i18n.localize("RISKYDIE.Notify.NotAvailable"));
    return false;
  }
  armed = true;
  refreshButton();
  return true;
}

function disarm() {
  if ( !armed ) return;
  armed = false;
  refreshButton();
}

function toggle() {
  return armed ? (disarm(), false) : arm();
}

async function setUnlocked(value) {
  if ( !game.user.isGM ) return;
  await game.settings.set(MODULE_ID, "unlocked", Boolean(value));
}

/* -------------------------------------------- */
/*  Würfel-Patches                              */
/* -------------------------------------------- */

function isEligible(term) {
  const { Die } = foundry.dice.terms;
  if ( !(term instanceof Die) || (term.faces !== 20) ) return false;
  const D20Die = CONFIG.Dice.D20Die;
  if ( setting("onlyD20Tests") && D20Die ) return term instanceof D20Die;
  return true;
}

function decide() {
  if ( !armed || !isAvailable() ) return null;
  return clampCount(setting("count"));
}

function onApplied(roll, { rerollsRemoved }) {
  if ( rerollsRemoved.length ) ui.notifications.info(game.i18n.localize("RISKYDIE.Notify.RerollsRemoved"));
  if ( setting("once") ) disarm();
}

function onBlocked() {
  ui.notifications.warn(game.i18n.localize("RISKYDIE.Notify.Advantage"));
}

/* -------------------------------------------- */
/*  Oberfläche                                  */
/* -------------------------------------------- */

let button = null;

function countLabel(count) {
  return game.i18n.format("RISKYDIE.CountLabel", { count, chance: extremeChance(count) });
}

function createButton() {
  button = document.createElement("button");
  button.type = "button";
  button.id = "risky-die-button";
  button.addEventListener("click", event => {
    event.preventDefault();
    if ( game.user.isGM && (setting("availability") === "unlock") && !event.shiftKey ) {
      setUnlocked(!setting("unlocked"));
    }
    else toggle();
  });

  const players = document.getElementById("players");
  if ( players?.parentElement ) players.parentElement.insertBefore(button, players);
  else {
    button.classList.add("floating");
    document.body.append(button);
  }
  refreshButton();
}

function refreshButton() {
  if ( !button ) return;
  const availability = setting("availability");
  const hidden = !setting("showButton") || ((availability === "off") && !game.user.isGM);
  button.hidden = hidden;
  if ( hidden ) return;

  const count = clampCount(setting("count"));
  const available = isAvailable();
  const gmUnlockMode = game.user.isGM && (availability === "unlock");

  let label;
  if ( armed ) label = "RISKYDIE.Button.Armed";
  else if ( gmUnlockMode ) label = setting("unlocked") ? "RISKYDIE.Button.GMUnlocked" : "RISKYDIE.Button.GMLocked";
  else if ( available ) label = "RISKYDIE.Button.Ready";
  else label = "RISKYDIE.Button.Unavailable";

  button.classList.toggle("armed", armed);
  button.classList.toggle("available", available);
  button.disabled = !available && !gmUnlockMode;
  button.innerHTML = `<i class="fa-solid fa-dice-d20"></i> <span>${game.i18n.localize(label)}</span>`;

  const tooltip = [countLabel(count), faceList(count).join(" · "), game.i18n.localize("RISKYDIE.Button.Rules")];
  if ( gmUnlockMode ) tooltip.push(game.i18n.localize("RISKYDIE.Button.GMHint"));
  button.dataset.tooltip = tooltip.join("<br>");
}

function annotateChatMessage(message, html) {
  const counts = new Set();
  for ( const roll of message.rolls ?? [] ) {
    for ( const die of roll.dice ?? [] ) {
      const count = riskyCount(die);
      if ( count !== null ) counts.add(count);
    }
  }
  if ( !counts.size ) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const target = root?.querySelector(".message-content");
  if ( !target ) return;
  const badge = document.createElement("div");
  badge.classList.add("risky-die-badge");
  badge.innerHTML = `<i class="fa-solid fa-dice-d20"></i> ${game.i18n.localize("RISKYDIE.ChatBadge")}: `
    + [...counts].map(countLabel).join(", ");
  target.prepend(badge);
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.once("init", () => {
  registerSettings();
  registerKeybindings();
  installPatches({ Roll: foundry.dice.Roll, Die: foundry.dice.terms.Die, isEligible, decide, onApplied, onBlocked });
  game.modules.get(MODULE_ID).api = {
    arm, disarm, toggle, setUnlocked, mapFace, faceList,
    get armed() { return armed; },
    get available() { return isAvailable(); },
    OPTION_KEY
  };
});

Hooks.once("ready", () => createButton());

Hooks.on("renderChatMessageHTML", annotateChatMessage);

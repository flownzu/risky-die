import { MAX_COUNT, MIN_COUNT, clampCount, extremeChance, faceList, mapFace } from "./mapping.mjs";
import { OPTION_KEY, installPatches, riskyCount } from "./core.mjs";

const MODULE_ID = "risky-die";

/**
 * The GM enables the risky die for one user by setting this flag on their User document.
 * That user's next eligible d20 roll is risky; afterwards their client clears the flag.
 */
const ENABLED_FLAG = "enabled";

/* -------------------------------------------- */
/*  Settings                                    */
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
    onChange: () => refreshPanel()
  });

  game.settings.register(MODULE_ID, "onlyD20Tests", {
    name: "RISKYDIE.Settings.OnlyD20Tests.Name",
    hint: "RISKYDIE.Settings.OnlyD20Tests.Hint",
    scope: "world",
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
    onChange: () => refreshPanel()
  });

  // The user the GM panel targets, remembered per GM client.
  game.settings.register(MODULE_ID, "target", {
    scope: "client",
    config: false,
    type: String,
    default: ""
  });
}

function registerKeybindings() {
  game.keybindings.register(MODULE_ID, "toggle", {
    name: "RISKYDIE.Keybinding.Toggle",
    editable: [],
    restricted: true,
    onDown: () => { toggle(); return true; }
  });
}

/* -------------------------------------------- */
/*  State                                       */
/* -------------------------------------------- */

const isEnabled = user => Boolean(user?.getFlag(MODULE_ID, ENABLED_FLAG));

/** The user selected in the GM panel; falls back to the GM. */
function targetUser() {
  return game.users.get(setting("target")) ?? game.user;
}

async function enable(user = targetUser()) {
  if ( !game.user.isGM ) return false;
  await user.setFlag(MODULE_ID, ENABLED_FLAG, true);
  return true;
}

async function disable(user = targetUser()) {
  if ( !game.user.isGM && (user !== game.user) ) return;
  if ( isEnabled(user) ) await user.unsetFlag(MODULE_ID, ENABLED_FLAG);
}

async function toggle(user = targetUser()) {
  if ( isEnabled(user) ) return disable(user);
  return enable(user);
}

function onUpdateUser(user, changes) {
  if ( !foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`)
    && !foundry.utils.hasProperty(changes, `flags.-=${MODULE_ID}`) ) return;
  refreshPanel();
  if ( (user === game.user) && !game.user.isGM && isEnabled(user) ) {
    ui.notifications.info(game.i18n.format("RISKYDIE.Notify.Enabled", { count: clampCount(setting("count")) }));
  }
}

/* -------------------------------------------- */
/*  Dice patches                                */
/* -------------------------------------------- */

function isEligible(term) {
  const { Die } = foundry.dice.terms;
  if ( !(term instanceof Die) || (term.faces !== 20) ) return false;
  const D20Die = CONFIG.Dice.D20Die;
  if ( setting("onlyD20Tests") && D20Die ) return term instanceof D20Die;
  return true;
}

function decide() {
  if ( !isEnabled(game.user) ) return null;
  return clampCount(setting("count"));
}

function onApplied(roll, { rerollsRemoved }) {
  if ( rerollsRemoved.length ) ui.notifications.info(game.i18n.localize("RISKYDIE.Notify.RerollsRemoved"));
  disable(game.user);
}

function onBlocked() {
  ui.notifications.warn(game.i18n.localize("RISKYDIE.Notify.Advantage"));
}

/* -------------------------------------------- */
/*  Interface (GM only)                         */
/* -------------------------------------------- */

let panel = null;
let button = null;
let select = null;
let slider = null;
let countText = null;

function countLabel(count) {
  return game.i18n.format("RISKYDIE.CountLabel", { count, chance: extremeChance(count) });
}

function createPanel() {
  if ( !game.user.isGM ) return;
  panel = document.createElement("div");
  panel.id = "risky-die-panel";

  // Target row: whose next roll is risky.
  select = document.createElement("select");
  select.ariaLabel = game.i18n.localize("RISKYDIE.Panel.Target");
  select.addEventListener("change", async () => {
    await game.settings.set(MODULE_ID, "target", select.value);
    refreshPanel();
  });

  button = document.createElement("button");
  button.type = "button";
  button.id = "risky-die-button";
  button.addEventListener("click", event => {
    event.preventDefault();
    toggle();
  });

  // Count row.
  const row = document.createElement("div");
  row.classList.add("risky-die-count");
  slider = document.createElement("input");
  slider.type = "range";
  slider.min = String(MIN_COUNT);
  slider.max = String(MAX_COUNT);
  slider.step = "1";
  slider.ariaLabel = game.i18n.localize("RISKYDIE.Settings.Count.Name");
  slider.addEventListener("input", () => updateCountText(Number(slider.value)));
  slider.addEventListener("change", () => game.settings.set(MODULE_ID, "count", clampCount(slider.value)));
  countText = document.createElement("span");
  row.append(slider, countText);

  panel.append(select, button, row);

  const players = document.getElementById("players");
  if ( players?.parentElement ) players.parentElement.insertBefore(panel, players);
  else {
    panel.classList.add("floating");
    document.body.append(panel);
  }
  refreshPanel();
}

function updateCountText(count) {
  countText.textContent = countLabel(count);
  countText.dataset.tooltip = faceList(count).join(" · ");
}

function refreshSelect(target) {
  const users = game.users.filter(u => !u.isGM || (u === game.user))
    .sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name));
  select.replaceChildren(...users.map(u => {
    const option = document.createElement("option");
    option.value = u.id;
    option.textContent = (isEnabled(u) ? "⚠ " : "") + u.name + (u.active ? "" : ` (${game.i18n.localize("RISKYDIE.Panel.Offline")})`);
    return option;
  }));
  select.value = target.id;
}

function refreshPanel() {
  if ( !panel ) return;
  panel.hidden = !setting("showButton");
  if ( panel.hidden ) return;

  const target = targetUser();
  const enabled = isEnabled(target);
  refreshSelect(target);

  button.classList.toggle("enabled", enabled);
  const label = enabled ? "RISKYDIE.Button.Enabled" : "RISKYDIE.Button.Enable";
  button.innerHTML = `<i class="fa-solid fa-dice-d20"></i> <span>${game.i18n.format(label, { name: target.name })}</span>`;
  button.dataset.tooltip = game.i18n.localize("RISKYDIE.Button.Rules");

  const count = clampCount(setting("count"));
  slider.value = String(count);
  updateCountText(count);
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
    enable, disable, toggle, isEnabled, mapFace, faceList,
    get enabled() { return isEnabled(game.user); },
    OPTION_KEY
  };
});

Hooks.once("ready", () => createPanel());

Hooks.on("updateUser", onUpdateUser);
Hooks.on("userConnected", () => refreshPanel());

Hooks.on("renderChatMessageHTML", annotateChatMessage);

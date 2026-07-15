import {
  backdrops,
  crewTemplates,
  enemyArchetypes,
  itemCatalog,
  stages,
} from "./gameData.js";

const tutorialSeen = (() => {
  try {
    return localStorage.getItem("ltm-tutorial-seen") === "true";
  } catch {
    return false;
  }
})();

const state = {
  screen: "map",
  checkpoint: 0,
  unlockedStage: 0,
  selectedStage: 0,
  activeStage: null,
  activeHorde: 0,
  scrap: 90,
  inventory: {
    medGel: 3,
    overchargeCell: 1,
    shieldBattery: 1,
    focusInjector: 1,
  },
  log: [],
  queuedActions: {},
  currentPlannerIndex: 0,
  selectedPlannerId: null,
  battle: null,
  itemMenuOpen: false,
  loseScreen: false,
  pendingConfirm: null,
  rewardSummary: null,
  turnPlanCollapsed: false,
  tutorialOpen: !tutorialSeen,
  feedbacks: [],
  skillReadyShown: {},
  selectedAbilityTab: "attack",
  lastEffectSummary: [],
  priorityOrder: crewTemplates.map((unit) => unit.id),
  draggedCrewId: null,
  crew: crewTemplates.map((unit) => ({
    ...structuredClone(unit),
    skill: 0,
    status: [],
    buffs: [],
    alive: true,
    anim: "idle",
  })),
};

const app = document.querySelector("#app");
const SPRITE_FRAMES = {
  crew: [
    "./assets/characters/crew/crew1.png",
    "./assets/characters/crew/crew2.png",
  ],
  enemy: [
    "./assets/characters/enemies/enemy1.png",
    "./assets/characters/enemies/enemy2.png",
  ],
};

function init() {
  render();
  startAnimationLoop();
}

function render() {
  updateSkillReadyNotices();
  window.__gameState = state;
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Last Train To Mars</p>
          <h1>${state.screen === "map" ? "Mars Route Map" : state.screen === "reward" ? "Salvage Report" : "Battle Command"}</h1>
        </div>
        <div class="topbar-stats">
          ${renderTopControls()}
        </div>
      </header>

      <main class="view">
        ${state.screen === "map" ? renderMap() : ""}
        ${state.screen === "battle" ? renderBattle() : ""}
        ${state.screen === "reward" ? renderRewardScreen() : ""}
      </main>
      ${state.tutorialOpen ? renderTutorialOverlay() : ""}
    </div>
  `;

  bindGlobalEvents();
  if (state.screen === "battle") {
    drawBattleSprites();
  }
}

function renderMap() {
  return `
    <section class="map-view">
      <div class="map-panel route-scene">
        <div class="map-content">
          <div class="route-board">
            <svg class="route-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M 10 56 C 18 35, 22 18, 30 20 S 44 68, 52 62 S 66 16, 73 24 S 82 60, 88 52" />
            </svg>
            ${stages
              .map((stage, index) => {
                const status =
                  index < state.checkpoint
                    ? "cleared"
                    : index === state.selectedStage && index <= state.unlockedStage
                      ? "current"
                      : index <= state.unlockedStage
                        ? "open"
                        : "locked";
                return `
                  <button
                    class="rail-node ${status}"
                    data-stage="${index}"
                    data-action="start-stage-direct"
                    style="left:${stage.mapX}%; top:${stage.mapY}%"
                    ${index > state.unlockedStage ? "disabled" : ""}
                  >
                    <span class="node-stage">${index === stages.length - 1 ? "Boss Stage" : `Stage ${index + 1}`}</span>
                    <span class="node-index">0${index + 1}</span>
                    <img class="node-icon" src="${stage.mapIcon}" alt="" />
                    <span class="node-name">${stage.name}</span>
                  </button>
                `;
              })
              .join("")}
          </div>
          ${renderShop()}
        </div>
      </div>
    </section>
  `;
}

function renderShop() {
  return `
    <section class="stage-panel compact-stage-panel shop-panel">
      <div class="section-head">
        <div>
          <h2>Supply Car</h2>
        </div>
        <span class="difficulty">Scrap ${state.scrap}</span>
      </div>
      <div class="shop-list">
        ${Object.values(itemCatalog)
          .map(
            (item) => `
          <div class="shop-card">
            <div class="shop-card-head">
              <img class="inventory-icon" src="${item.icon}" alt="" />
              <div>
                <h3>${item.name}</h3>
                <p class="shop-desc item-type-${item.explainType}">${item.desc}</p>
              </div>
            </div>
            <div class="shop-meta">
              <span>Owned x${state.inventory[item.id] ?? 0}</span>
              <span>Cost ${item.price}</span>
            </div>
            <button class="launch-btn shop-buy-btn" data-action="buy-item" data-item-id="${item.id}" ${state.scrap < item.price ? "disabled" : ""}>Buy</button>
          </div>
        `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderBattle() {
  if (!state.battle) {
    return `
      <section class="empty-state">
        <h2>No active encounter</h2>
        <p>Choose a station from the route map to start a run.</p>
      </section>
    `;
  }

  const planner = getPlannerCharacter();
  return `
    <section class="battle-view">
      <div class="battlefield" data-backdrop="${state.activeStage.backdrop}">
        <div class="combat-line crew-side">
          ${getOrderedCrew().map((member) => renderUnitSprite(member, "crew")).join("")}
        </div>
        <div class="combat-line enemy-side">
          ${state.battle.enemies.map((enemy) => renderUnitSprite(enemy, "enemy")).join("")}
        </div>
        ${renderFeedbacks()}

        <section class="crew-info-panel hud-panel">
          <div class="panel-title">
            <span><img class="panel-icon" src="./assets/game-icons/signal.png" alt="" /> Crew Status</span>
            <strong>Squad Feed</strong>
          </div>
          <div class="crew-grid">
            ${getOrderedCrew().map((member, index) => renderCrewCard(member, index)).join("")}
          </div>
        </section>

        <section class="action-panel hud-panel">
          <div class="panel-title">
            <span><img class="panel-icon" src="./assets/game-icons/target.png" alt="" /> ${planner ? planner.name : "Turn Resolved"}</span>
            <strong>Actions</strong>
          </div>
          ${
            planner
              ? `
            <div class="target-strip">
              ${renderTargetButtons(planner)}
            </div>
            ${renderAbilityPanel(planner)}
            <div class="action-grid">
              <button class="action-btn" data-action="select-command" data-command="attack">Attack</button>
              <button class="action-btn skill-action-btn ${planner.skill >= planner.skillCost ? "is-ready" : ""}" data-action="select-command" data-command="skill" ${planner.skill < planner.skillCost ? "disabled" : ""}>
                <span>Skill</span>
                ${planner.skill >= planner.skillCost ? `<small>ready</small>` : ``}
              </button>
              <button class="action-btn" data-action="open-item">Item</button>
              <button class="action-btn" data-action="select-command" data-command="defend">Defend</button>
            </div>
          `
              : `
            <div class="resolution-panel">
              <p>All crew commands are locked in. Resolve the turn to watch the sequence play out, then plan the next round.</p>
              <button class="launch-btn" data-action="resolve-turn">Resolve Turn</button>
            </div>
          `
          }
        </section>

        ${state.itemMenuOpen ? renderItemPopup(planner) : ""}
        ${state.loseScreen ? renderLoseScreen() : ""}
        ${state.pendingConfirm ? renderConfirmScene() : ""}
      </div>
    </section>
  `;
}

function renderTopControls() {
  const helpButton = `<button class="top-chip top-action help-btn" data-action="open-tutorial">Help</button>`;
  if (state.screen === "battle" && state.battle) {
    const stageLabel = state.activeStage.index === stages.length - 1 ? "Boss Stage" : `Stage ${state.activeStage.index + 1}`;
    const phaseLabel = state.activeHorde === 2 ? "Boss Encounter" : state.battle.phaseLabel;
    return `
      ${helpButton}
      <div class="top-chip stage-chip">${stageLabel} | ${state.activeStage.name} | ${phaseLabel}</div>
      <button class="top-chip top-action nav-btn" data-action="retreat-to-map">Return To Map</button>
      <button class="top-chip top-action restart-btn" data-action="reset-stage">Restart</button>
      <div class="top-chip scrap-chip">Scrap ${state.scrap}</div>
    `;
  }
  if (state.screen === "map") {
    return `
      ${helpButton}
      <div class="top-chip scrap-chip">Scrap ${state.scrap}</div>
    `;
  }
  return ``;
}

function renderTutorialOverlay() {
  const selectedStage = stages[state.selectedStage];
  const crewNotes = crewTemplates
    .map((member) => `
      <article class="tutorial-card tutorial-crew-card">
        <div class="tutorial-card-head">
          <img class="panel-icon" src="${member.skillIcon}" alt="" />
          <strong>${member.name}</strong>
        </div>
        <p>${member.role}</p>
        <small><strong>${member.skillName}:</strong> ${member.skillText}</small>
      </article>
    `)
    .join("");

  const itemNotes = Object.values(itemCatalog)
    .map((item) => `
      <article class="tutorial-card tutorial-item-card">
        <div class="tutorial-card-head">
          <img class="panel-icon" src="${item.icon}" alt="" />
          <strong>${item.name}</strong>
        </div>
        <small>${item.desc}</small>
      </article>
    `)
    .join("");

  return `
    <div class="tutorial-screen">
      <div class="tutorial-modal hud-panel">
        <div class="tutorial-header">
          <div>
            <p class="eyebrow">Mission Brief</p>
            <h2>How To Play Last Train to Mars</h2>
          </div>
          <button class="icon-close" data-action="close-tutorial" aria-label="Close tutorial">&times;</button>
        </div>
        <div class="tutorial-grid">
          <section class="tutorial-section">
            <h3>Route Map</h3>
            <p>Pick one stage node on the rail route to begin. Clear the current station to unlock the next one. Scrap is your currency for buying support items in the Supply Car.</p>
            <div class="tutorial-callout">
              <strong>Next stop:</strong>
              <span>${selectedStage.name} - ${selectedStage.theme}</span>
            </div>
          </section>
          <section class="tutorial-section">
            <h3>Battle Flow</h3>
            <ol class="tutorial-steps">
              <li>Choose a target from the target row.</li>
              <li>Press <code>Attack</code>, <code>Skill</code>, <code>Item</code>, or <code>Defend</code> for the highlighted crew member.</li>
              <li>Repeat until every crew member has a command.</li>
              <li>Press <code>Resolve Turn</code> to watch the round happen.</li>
            </ol>
          </section>
          <section class="tutorial-section">
            <h3>Command Console</h3>
            <div class="tutorial-card-grid">
              <article class="tutorial-card">
                <strong>Attack</strong>
                <small>Basic action. Deals damage and fills that unit's skill bar.</small>
              </article>
              <article class="tutorial-card">
                <strong>Skill</strong>
                <small>Each crew member's special move. It only works when the skill bar is full.</small>
              </article>
              <article class="tutorial-card">
                <strong>Item</strong>
                <small>Opens inventory so you can heal, buff, shield, or recharge a skill bar.</small>
              </article>
              <article class="tutorial-card">
                <strong>Defend</strong>
                <small>Reduces incoming damage for one round and gives a little skill charge.</small>
              </article>
            </div>
          </section>
          <section class="tutorial-section">
            <h3>Crew Status</h3>
            <p>Each crew block shows HP, skill charge, and status effects. A glowing block means that unit's skill is ready. Clicking a crew block lets you change only that unit's queued action.</p>
            <div class="tutorial-card-grid">${crewNotes}</div>
          </section>
          <section class="tutorial-section">
            <h3>Items and Win State</h3>
            <p>Shop items make runs easier, especially when a stage gets harder. Win a battle by defeating all enemies in that encounter. Lose when all crew members are down.</p>
            <div class="tutorial-card-grid">${itemNotes}</div>
          </section>
        </div>
        <div class="tutorial-actions">
          <button class="minor-btn nav-btn" data-action="close-tutorial">Close</button>
          <button class="launch-btn" data-action="close-tutorial-forever">Start Mission</button>
        </div>
      </div>
    </div>
  `;
}

function renderConfirmScene() {
  const isRestart = state.pendingConfirm === "restart";
  return `
    <div class="confirm-screen">
      <div class="confirm-card">
        <p class="eyebrow">Confirm Reset</p>
        <h2>${isRestart ? "Restart this stage?" : "Return to stage menu?"}</h2>
        <p>This will reset the current stage progress. Continue if you want.</p>
        <div class="confirm-actions">
          <button class="minor-btn nav-btn" data-action="cancel-confirm">Cancel</button>
          <button class="action-btn restart-btn" data-action="${isRestart ? "confirm-restart" : "confirm-back-map"}">Continue</button>
        </div>
      </div>
    </div>
  `;
}

function renderFeedbacks() {
  return state.feedbacks
    .map(
      (feedback) => `
      <div class="floating-feedback feedback-${feedback.kind} feedback-slot-${feedback.slot}" style="--feedback-index:${feedback.stack}">
        ${feedback.text}
      </div>
    `,
    )
    .join("");
}

function updateSkillReadyNotices() {
  for (const member of state.crew) {
    const isReady = member.hp > 0 && member.skill >= member.skillCost;
    if (isReady && !state.skillReadyShown[member.id]) {
      state.log.unshift(`${member.name}'s skill is ready.`);
      state.skillReadyShown[member.id] = true;
    }
    if (!isReady) {
      state.skillReadyShown[member.id] = false;
    }
  }
}

function renderLoseScreen() {
  return `
    <div class="lose-screen">
      <div class="lose-card">
        <p class="eyebrow">Mission Failed</p>
        <h2>Crew Signal Lost</h2>
        <p>The train fell silent before the station could be secured.</p>
        <div class="lose-actions">
          <button class="launch-btn" data-action="lose-back-map">Return To Map</button>
          <button class="action-btn" data-action="lose-restart">Restart</button>
        </div>
      </div>
    </div>
  `;
}

function renderItemPopup(planner) {
  return `
    <div class="modal-scrim" aria-hidden="true"></div>
    <section class="item-popup hud-panel">
      <div class="item-popup-head">
        <span>Inventory</span>
        <button class="icon-close" data-action="close-item-menu" aria-label="Close item menu">&times;</button>
      </div>
      <div class="inventory-list">
        ${Object.entries(state.inventory)
          .map(([id, qty]) => {
            const item = itemCatalog[id];
            return `<button class="inventory-chip" data-item-use="${id}" ${qty <= 0 || !planner ? "disabled" : ""}>
              <img class="inventory-icon" src="${item.icon}" alt="" />
              <span>${item.name}</span>
              <small class="item-type-${item.explainType}">${item.desc}</small>
              <strong>${qty}</strong>
            </button>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderRewardScreen() {
  const summary = state.rewardSummary;
  if (!summary) {
    return `
      <section class="empty-state">
        <h2>No rewards pending</h2>
        <p>Return to the route map to choose the next station.</p>
      </section>
    `;
  }
  const isFinalStage = summary.nextStageIndex >= stages.length;
  return `
    <section class="reward-view">
      <div class="reward-card hud-panel">
        <p class="eyebrow">Stage Secured</p>
        <h2>${summary.stageName}</h2>
        <div class="reward-grid">
          <article class="reward-scrap">
            <span>Scrap Earned</span>
            <strong>+${summary.scrap}</strong>
          </article>
          <div class="reward-items">
            ${summary.items
              .map(
                (itemId) => `
                <div class="reward-item">
                  <img class="inventory-icon" src="${itemCatalog[itemId].icon}" alt="" />
                  <span>${itemCatalog[itemId].name}</span>
                </div>
              `,
              )
              .join("")}
          </div>
        </div>
        <div class="reward-actions">
          <button class="launch-btn" data-action="reward-continue" ${isFinalStage ? "disabled" : ""}>${isFinalStage ? "Route Complete" : "Continue To Next Stage"}</button>
          <button class="minor-btn nav-btn" data-action="reward-map">Return To Map</button>
        </div>
      </div>
    </section>
  `;
}

function renderAbilityPanel(planner) {
  const attackTags = planner.attackTags.map((tag) => `<span class="effect-pill effect-${tag.toLowerCase().replace(/\s+/g, "-")}">${tag}</span>`).join("");
  const skillTags = planner.skillTags.map((tag) => `<span class="effect-pill effect-${tag.toLowerCase().replace(/\s+/g, "-")}">${tag}</span>`).join("");
  return `
    <div class="ability-panel compact-ability-panel">
      <div class="ability-card">
        <div class="ability-card-head">
          <strong>Attack: ${planner.attackName}</strong>
          <span>Power ${planner.attack}</span>
        </div>
        <p>${planner.attackText}</p>
        <div class="effect-summary">${attackTags}</div>
      </div>
      <div class="ability-card">
        <div class="ability-card-head">
          <strong>Skill: ${planner.skillName}</strong>
          <span>${planner.skill}/${planner.skillCost}</span>
        </div>
        <p>${planner.skillText}</p>
        <div class="effect-summary">${skillTags}</div>
      </div>
    </div>
  `;
}

function renderUnitSprite(unit, side) {
  const slot = getUnitSlot(unit.id, side);
  const showSkillReady =
    side === "crew" &&
    unit.hp > 0 &&
    typeof unit.skillCost === "number" &&
    unit.skill >= unit.skillCost;
  return `
    <div class="unit-slot ${side} slot-${slot} ${unit.alive === false || unit.hp <= 0 ? "down" : ""}" data-unit="${unit.id}">
      <img class="sprite-frame ${side === "enemy" ? "flipped" : ""}" src="${getSpriteFrame(unit, side)}" alt="${unit.name}" data-sprite-id="${unit.id}" data-sprite-side="${side}" />
      ${showSkillReady ? `<div class="skill-ready-badge">SKILL READY</div>` : ``}
      <div class="unit-tag ${side === "enemy" ? "enemy-tag" : "crew-sprite-tag"}">
        <span>${unit.name}</span>
        <strong>${Math.max(0, unit.hp)}/${unit.maxHp}</strong>
      </div>
    </div>
  `;
}

function renderCrewCard(member, index) {
  const skillReady = member.skill >= member.skillCost;
  const statusText = member.status.length ? member.status.join(", ") : "";
  const planner = getPlannerCharacter();
  const isPlanner = planner?.id === member.id;
  const canEdit = state.screen === "battle" && state.battle && member.hp > 0;
  return `
    <article class="crew-card ${skillReady ? "skill-ready" : ""} ${isPlanner ? "active" : ""} ${canEdit ? "clickable" : ""}" ${canEdit ? `data-action="edit-planner" data-crew-id="${member.id}"` : ""}>
      <div class="crew-card-head">
        <span class="crew-badge" style="--badge:${member.color}">${member.icon}</span>
        <div>
          <h3>${member.name}</h3>
          <p>${member.role}</p>
        </div>
        <img class="skill-mini-icon" src="${member.skillIcon}" alt="" />
      </div>
      <div class="crew-card-tag">
        <span>${member.name}</span>
        <strong>${Math.max(0, member.hp)}/${member.maxHp}</strong>
      </div>
      <div class="meter-group">
        <label>HP</label>
        <div class="meter">
          <span style="width:${(Math.max(0, member.hp) / member.maxHp) * 100}%"></span>
        </div>
        <small>${Math.max(0, member.hp)} / ${member.maxHp}</small>
      </div>
      <div class="meter-group skill">
        <label>Skill</label>
        <div class="meter">
          <span style="width:${Math.min(100, member.skill)}%"></span>
        </div>
        <small>${skillReady ? "READY" : `${Math.floor(member.skill)} / ${member.skillCost}`}</small>
      </div>
      ${statusText ? `<div class="status-row"><span>${statusText}</span></div>` : ""}
    </article>
  `;
}

function renderQueuedAction(member, index) {
  const planner = getPlannerCharacter();
  const queued = state.queuedActions[member.id];
  const label = queued ? queued.label : "Waiting";
  return `
    <div class="queued-row ${planner?.id === member.id ? "current" : ""}" draggable="true" data-drag-crew="${member.id}" data-drop-crew="${member.id}">
      <div class="queued-head">
        <img class="queued-icon" src="${member.skillIcon}" alt="" />
        <strong>[${ordinal(index + 1)}: ${member.name}]</strong>
      </div>
      <span>${label}</span>
    </div>
  `;
}

function renderTargetButtons(planner) {
  const targets =
    state.targetMode === "ally"
      ? getOrderedCrew().filter((unit) => unit.hp > 0)
      : state.battle.enemies.filter((unit) => unit.hp > 0);
  return targets
    .map(
      (unit, index) => `
      <button class="target-btn ${state.selectedTarget === unit.id ? "active" : ""}" data-action="choose-target" data-target="${unit.id}">
        <span class="target-label">${state.targetMode === "ally" ? "ALLY" : "ENEMY"} ${index + 1}</span>
        <strong>${unit.name}</strong>
      </button>
    `,
    )
    .join("");
}

function bindGlobalEvents() {
  app.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button.dataset.command, button));
  });

  app.querySelectorAll("[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTarget = button.dataset.target;
      render();
    });
  });

  app.querySelectorAll("[data-item-use]").forEach((button) => {
    button.addEventListener("click", () => queueItemUse(button.dataset.itemUse));
  });

  app.querySelectorAll("[data-item-id]").forEach((button) => {
    button.addEventListener("click", () => buyItem(button.dataset.itemId));
  });

  app.querySelectorAll("[data-drag-crew]").forEach((row) => {
    row.addEventListener("dragstart", (event) => {
      state.draggedCrewId = row.dataset.dragCrew;
      event.dataTransfer?.setData("text/plain", row.dataset.dragCrew);
    });
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      swapCrewPriority(state.draggedCrewId, row.dataset.dropCrew);
    });
  });

}

function handleAction(action, command, sourceButton) {
  if (action === "start-stage") {
    startStage(state.selectedStage);
    return;
  }
  if (action === "start-stage-direct") {
    const stageIndex = Number(sourceButton?.dataset.stage ?? state.selectedStage);
    state.selectedStage = stageIndex;
    startStage(stageIndex);
    return;
  }
  if (action === "choose-target") {
    return;
  }
  if (action === "select-command") {
    queueCommand(command);
    return;
  }
  if (action === "open-item") {
    state.targetMode = "ally";
    state.selectedTarget = state.crew.find((unit) => unit.hp > 0)?.id ?? null;
    state.itemMenuOpen = true;
    state.log.unshift("Choose an item from Inventory, then pick a target if needed.");
    render();
    return;
  }
  if (action === "close-item-menu") {
    state.itemMenuOpen = false;
    render();
    return;
  }
  if (action === "open-tutorial") {
    state.tutorialOpen = true;
    render();
    return;
  }
  if (action === "close-tutorial") {
    state.tutorialOpen = false;
    render();
    return;
  }
  if (action === "close-tutorial-forever") {
    state.tutorialOpen = false;
    try {
      localStorage.setItem("ltm-tutorial-seen", "true");
    } catch {}
    render();
    return;
  }
  if (action === "edit-planner") {
    focusPlanner(sourceButton?.dataset.crewId ?? null);
    return;
  }
  if (action === "toggle-turn-plan") {
    state.turnPlanCollapsed = !state.turnPlanCollapsed;
    render();
    return;
  }
  if (action === "select-ability-tab") {
    state.selectedAbilityTab = sourceButton?.dataset.abilityTab ?? "attack";
    render();
    return;
  }
  if (action === "resolve-turn") {
    resolveTurn();
    return;
  }
  if (action === "retreat-to-map") {
    state.pendingConfirm = "map";
    render();
    return;
  }
  if (action === "reset-stage") {
    state.pendingConfirm = "restart";
    render();
    return;
  }
  if (action === "cancel-confirm") {
    state.pendingConfirm = null;
    render();
    return;
  }
  if (action === "confirm-back-map") {
    state.pendingConfirm = null;
    state.screen = "map";
    state.itemMenuOpen = false;
    state.battle = null;
    render();
    return;
  }
  if (action === "confirm-restart") {
    state.pendingConfirm = null;
    startStage(state.activeStage.index);
    return;
  }
  if (action === "lose-back-map") {
    state.loseScreen = false;
    state.battle = null;
    state.screen = "map";
    render();
    return;
  }
  if (action === "reward-map") {
    state.rewardSummary = null;
    state.screen = "map";
    render();
    return;
  }
  if (action === "reward-continue") {
    const nextStageIndex = state.rewardSummary?.nextStageIndex;
    state.rewardSummary = null;
    if (Number.isInteger(nextStageIndex) && nextStageIndex < stages.length) {
      startStage(nextStageIndex);
    } else {
      state.screen = "map";
      render();
    }
    return;
  }
  if (action === "lose-restart") {
    state.loseScreen = false;
    startStage(state.activeStage.index);
    return;
  }
}

function buyItem(itemId) {
  const item = itemCatalog[itemId];
  if (!item || state.scrap < item.price) return;
  state.scrap -= item.price;
  state.inventory[itemId] = (state.inventory[itemId] ?? 0) + 1;
  state.log.unshift(`Bought ${item.name} for ${item.price} Scrap.`);
  render();
}

function startStage(stageIndex) {
  resetCrewForStage();
  state.activeStage = stages[stageIndex];
  state.rewardSummary = null;
  state.activeHorde = 0;
  state.battle = createBattleFromStage(state.activeStage, 0);
  state.selectedTarget = state.battle.enemies[0]?.id ?? null;
  state.targetMode = "enemy";
  state.currentPlannerIndex = 0;
  state.selectedPlannerId = null;
  state.itemMenuOpen = false;
  state.loseScreen = false;
  state.queuedActions = {};
  state.skillReadyShown = {};
  state.log = [`Train docked at ${state.activeStage.name}. ${state.activeStage.theme}`];
  state.screen = "battle";
  syncPlannerSelection();
  render();
}

function resetCrewForStage() {
  state.crew = crewTemplates.map((template) => ({
    ...structuredClone(template),
    skill: Math.min(template.skillCost, Math.max(0, template.skill ?? 0)),
    status: [],
    buffs: [],
    alive: true,
    anim: "idle",
  }));
  state.priorityOrder = crewTemplates.map((unit) => unit.id);
  state.feedbacks = [];
  state.lastEffectSummary = [];
  state.skillReadyShown = {};
}

function createBattleFromStage(stage, hordeIndex) {
  const phaseLabel =
    hordeIndex < 2 ? `Horde ${hordeIndex + 1}` : `Boss - ${stage.boss.name}`;
  const encounter = hordeIndex < 2 ? stage.hordes[hordeIndex] : [stage.boss.base];
  const enemies =
    hordeIndex < 2
      ? encounter.map((enemyId, index) => createEnemy(enemyId, `${stage.id}-h${hordeIndex}-${index}`))
      : [createBoss(stage.boss)];
  return { enemies, phaseLabel };
}

function createEnemy(enemyId, suffix) {
  const base = enemyArchetypes[enemyId];
  return {
    ...structuredClone(base),
    hp: base.maxHp,
    maxHp: base.maxHp,
    skill: 0,
    alive: true,
    buffs: [],
    status: [],
    anim: "idle",
    id: `${enemyId}-${suffix}`,
  };
}

function createBoss(boss) {
  return {
    ...structuredClone(boss),
    hp: boss.maxHp,
    skill: 0,
    alive: true,
    buffs: [],
    status: [],
    anim: "idle",
  };
}

function getOrderedCrew() {
  return state.priorityOrder
    .map((id) => state.crew.find((member) => member.id === id))
    .filter(Boolean);
}

function getOrderedAliveCrew() {
  return getOrderedCrew().filter((member) => member.hp > 0);
}

function resolvePlannerSelection(preferredId = state.selectedPlannerId) {
  const aliveCrew = getOrderedAliveCrew();
  const preferredPlanner = preferredId
    ? aliveCrew.find((member) => member.id === preferredId && !state.queuedActions[member.id])
    : null;
  const planner = preferredPlanner ?? aliveCrew.find((member) => !state.queuedActions[member.id]) ?? null;
  const index = planner ? aliveCrew.findIndex((member) => member.id === planner.id) : aliveCrew.length;
  return { planner, index };
}

function syncPlannerSelection(preferredId = state.selectedPlannerId) {
  const { planner, index } = resolvePlannerSelection(preferredId);
  state.selectedPlannerId = planner?.id ?? null;
  state.currentPlannerIndex = index;
  return planner;
}

function getPlannerCharacter() {
  return resolvePlannerSelection().planner;
}

function queueCommand(command) {
  const planner = syncPlannerSelection();
  if (!planner) return;

  if (command === "skill" && planner.id === "medic" && state.targetMode !== "ally") {
    state.targetMode = "ally";
    state.selectedTarget =
      [...state.crew]
        .filter((member) => member.hp > 0)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]?.id ?? null;
    state.log.unshift("Select an ally for Emergency Patch.");
    render();
    return;
  }

  const target = getActionTarget(planner, command);

  if (!target) return;

  if (command === "skill" && planner.skill < planner.skillCost) {
    state.log.unshift(`${planner.name} needs a full skill bar.`);
    state.selectedAbilityTab = "skill";
    render();
    return;
  }

  const label =
    command === "defend"
      ? "Defend"
      : `${capitalize(command)} -> ${target.name}`;
  state.queuedActions[planner.id] = { type: command, actorId: planner.id, targetId: target.id, label };
  advancePlanner();
}

function queueItemUse(itemId) {
  const planner = syncPlannerSelection();
  if (!planner) return;
  if ((state.inventory[itemId] ?? 0) <= 0) return;

  const item = itemCatalog[itemId];
  state.targetMode = item.kind === "heal" || item.kind === "shield" || item.kind === "skill" || item.kind === "buff" ? "ally" : "enemy";

  let target = findUnitById(state.selectedTarget);
  if (!target || (state.targetMode === "ally" && !state.crew.some((unit) => unit.id === target.id))) {
    target = state.crew.find((unit) => unit.hp > 0);
  }
  if (!target) return;

  state.queuedActions[planner.id] = {
    type: "item",
    actorId: planner.id,
    targetId: target.id,
    itemId,
    label: `Item -> ${item.name} on ${target.name}`,
  };
  state.itemMenuOpen = false;
  advancePlanner();
}

function focusPlanner(crewId) {
  if (!crewId || !state.battle) return;
  const aliveCrew = getOrderedAliveCrew();
  const plannerIndex = aliveCrew.findIndex((member) => member.id === crewId);
  if (plannerIndex === -1) return;

  delete state.queuedActions[crewId];
  state.itemMenuOpen = false;
  state.selectedAbilityTab = "attack";
  state.selectedPlannerId = crewId;
  const planner = syncPlannerSelection(crewId);
  state.targetMode = "enemy";
  state.selectedTarget =
    state.battle.enemies.find((enemy) => enemy.hp > 0)?.id ??
    planner?.id ??
    null;
  state.log.unshift(`Adjusting ${planner?.name ?? aliveCrew[plannerIndex].name}'s command.`);
  render();
}

function advancePlanner() {
  state.selectedPlannerId = null;
  const planner = syncPlannerSelection(null);
  if (planner) {
    state.targetMode = "enemy";
    state.selectedTarget =
      state.battle.enemies.find((enemy) => enemy.hp > 0)?.id ??
      planner.id;
  }
  render();
}

function resolveTurn() {
  const actors = [
    ...getOrderedAliveCrew(),
    ...state.battle.enemies.filter((enemy) => enemy.hp > 0),
  ].sort((a, b) => getSpeed(b) - getSpeed(a));

  for (const actor of actors) {
    if (actor.hp <= 0) continue;
    if (state.crew.some((member) => member.id === actor.id)) {
      const action = state.queuedActions[actor.id];
      if (!action) continue;
      executeCrewAction(actor, action);
    } else {
      executeEnemyAction(actor);
    }
    if (checkBattleConclusion()) return;
  }

  endOfRoundMaintenance();
  if (checkBattleConclusion()) return;
  state.queuedActions = {};
  state.selectedPlannerId = null;
  state.targetMode = "enemy";
  state.selectedTarget = state.battle.enemies.find((enemy) => enemy.hp > 0)?.id ?? null;
  syncPlannerSelection();
  render();
}

function executeCrewAction(actor, action) {
  const target = findUnitById(action.targetId);
  if (action.type !== "defend" && (!target || target.hp <= 0)) return;

  actor.anim = action.type === "skill" ? "skill" : "attack";
  actor.animUntil = Date.now() + 520;
  if (action.type === "attack") {
    const damage = calculateDamage(actor, target, false);
    applyDamage(target, damage, actor, "attack");
    actor.skill = Math.min(actor.skillCost, actor.skill + 25 + (target.weakness === actor.id ? 10 : 0));
    state.log.unshift(`${actor.name} hit ${target.name} for ${damage}.`);
    state.targetMode = "enemy";
  } else if (action.type === "skill") {
    useSkill(actor, target);
  } else if (action.type === "item") {
    useItem(actor, target, action.itemId);
  } else if (action.type === "defend") {
    actor.buffs.push({ type: "shield", duration: 1, amount: 0.45 });
    actor.skill = Math.min(actor.skillCost, actor.skill + 15);
    state.log.unshift(`${actor.name} braced for incoming fire.`);
  }
}

function executeEnemyAction(enemy) {
  const target = state.crew
    .filter((member) => member.hp > 0)
    .sort((a, b) => a.hp - b.hp)[0];
  if (!target) return;

  enemy.anim = "attack";
  enemy.animUntil = Date.now() + 520;
  const damage = calculateDamage(enemy, target, false);
  applyDamage(target, damage, enemy, "attack");
  if (enemy.inflicts && Math.random() < 0.35 && !target.status.includes(enemy.inflicts)) {
    target.status.push(enemy.inflicts);
    pushFeedback(target.id, "POISON", "debuff");
    recordEffect(`Poison on ${target.name}`, "debuff");
    state.log.unshift(`${enemy.name} infected ${target.name} with ${enemy.inflicts}.`);
  } else {
    state.log.unshift(`${enemy.name} struck ${target.name} for ${damage}.`);
  }
}

function useSkill(actor, target) {
  actor.skill = 0;
  if (actor.id === "engineer") {
    state.battle.turret = { duration: 3, damage: 16 };
    const turretTarget = state.battle.enemies.find((enemy) => enemy.hp > 0);
    if (turretTarget) {
      const burst = calculateDamage(actor, turretTarget, true) + 4;
      applyDamage(turretTarget, burst, actor, "skill");
      pushFeedback(turretTarget.id, "BURST", "damage");
      recordEffect(`Turret burst on ${turretTarget.name}`, "damage");
    }
    pushFeedback(actor.id, "TURRET", "buff");
    recordEffect("Turret deployed", "buff");
    state.log.unshift("Engineer deployed a support turret and fired an opening burst.");
  } else if (actor.id === "hacker") {
    target.status.push("locked");
    target.buffs.push({ type: "defDown", duration: 1, amount: 3 });
    const damage = calculateDamage(actor, target, true) + 8;
    applyDamage(target, damage, actor, "skill");
    pushFeedback(target.id, "LOCKED", "debuff");
    recordEffect(`Locked ${target.name}`, "debuff");
    state.log.unshift(`Hacker breached ${target.name}, locking it down.`);
  } else if (actor.id === "medic") {
    target.hp = Math.min(target.maxHp, target.hp + 38);
    target.status = target.status.filter((status) => status !== "poison" && status !== "radiation");
    pushFeedback(target.id, "+38", "heal");
    pushFeedback(target.id, "CLEANSE", "buff");
    recordEffect(`Healed ${target.name}`, "heal");
    state.log.unshift(`Medic restored ${target.name} and cleared harmful effects.`);
    state.targetMode = "ally";
  } else if (actor.id === "navigator") {
    state.crew.forEach((member) => {
      member.buffs.push({ type: "attackUp", duration: 2, amount: 7 });
      member.buffs.push({ type: "speedUp", duration: 2, amount: 12 });
      member.skill = Math.min(member.skillCost, member.skill + 20);
      pushFeedback(member.id, "ATK UP", "buff");
      pushFeedback(member.id, "SPD UP", "buff");
    });
    recordEffect("Crew attack up", "buff");
    recordEffect("Crew speed up", "buff");
    state.log.unshift("Navigator overrode route priority, boosting attack, speed, and team focus.");
  }
}

function useItem(actor, target, itemId) {
  const item = itemCatalog[itemId];
  if (!item || state.inventory[itemId] <= 0) return;
  state.inventory[itemId] -= 1;
  actor.anim = "skill";
  actor.animUntil = Date.now() + 520;

  if (item.kind === "heal") {
    target.hp = Math.min(target.maxHp, target.hp + item.amount);
    pushFeedback(target.id, `+${item.amount}`, "heal");
    recordEffect(`${item.name} healed ${target.name}`, "heal");
  } else if (item.kind === "buff") {
    target.buffs.push({ type: "attackUp", duration: item.duration, amount: item.amount });
    pushFeedback(target.id, "ATK UP", "buff");
    recordEffect(`${item.name} buffed ${target.name}`, "buff");
  } else if (item.kind === "shield") {
    target.buffs.push({ type: "shield", duration: item.duration, amount: item.amount });
    pushFeedback(target.id, "SHIELD", "shield");
    recordEffect(`${item.name} shielded ${target.name}`, "shield");
  } else if (item.kind === "skill") {
    target.skill = Math.min(target.skillCost, target.skill + item.amount);
    pushFeedback(target.id, `+${item.amount} SK`, "skill");
    recordEffect(`${item.name} charged ${target.name}`, "skill");
  }
  pushFeedback(actor.id, `USED ${item.name}`, "skill");
  state.log.unshift(`${actor.name} used ${item.name} on ${target.name}.`);
}

function calculateDamage(attacker, target, isSkill) {
  const bonus = getBuffValue(attacker, "attackUp");
  const armor = (target.armor ?? 0) + getBuffValue(target, "defUp") - getBuffValue(target, "defDown");
  const weaknessBonus = target.weakness === attacker.id ? 7 : 0;
  const skillBonus = isSkill ? 8 : 0;
  return Math.max(4, attacker.attack + bonus + weaknessBonus + skillBonus - Math.max(0, armor));
}

function applyDamage(target, amount, attacker, mode) {
  const shield = getBuffValue(target, "shield");
  const reduced = shield ? Math.round(amount * (1 - shield)) : amount;
  target.hp = Math.max(0, target.hp - reduced);
  pushFeedback(target.id, `-${reduced}`, "damage");
  recordEffect(`${target.name} took ${reduced}`, "damage");
  target.anim = target.hp > 0 ? "hurt" : "defeat";
  target.animUntil = target.hp > 0 ? Date.now() + 420 : Number.POSITIVE_INFINITY;
  if (target.hp <= 0) {
    target.alive = false;
    state.log.unshift(`${target.name} was disabled.`);
  }
  if (state.crew.some((member) => member.id === attacker.id)) {
    attacker.skill = Math.min(attacker.skillCost, attacker.skill + 5);
  }
  if (mode === "attack" && target.hp > 0) {
    target.skill = Math.min(target.skillCost ?? 100, (target.skill ?? 0) + 10);
    pushFeedback(target.id, "+10 SK", "skill");
  }
}

function checkBattleConclusion() {
  const crewAlive = state.crew.some((member) => member.hp > 0);
  const enemiesAlive = state.battle.enemies.some((enemy) => enemy.hp > 0);

  if (!crewAlive) {
    state.log.unshift("Crew lost contact. Awaiting command from the train.");
    state.loseScreen = true;
    state.itemMenuOpen = false;
    render();
    return true;
  }

  if (!enemiesAlive) {
    const isBoss = state.activeHorde === 2;
    awardStageProgress(isBoss);
    return true;
  }
  return false;
}

function awardStageProgress(isBoss) {
  if (state.activeHorde < 2) {
    state.activeHorde += 1;
    state.battle = createBattleFromStage(state.activeStage, state.activeHorde);
    state.selectedPlannerId = null;
    state.queuedActions = {};
    state.feedbacks = [];
    state.lastEffectSummary = [];
    state.selectedTarget = state.battle.enemies[0]?.id ?? null;
    syncPlannerSelection();
    state.log.unshift(`${state.activeStage.name} ${state.battle.phaseLabel} started.`);
    render();
    return;
  }

  const reward = state.activeStage.reward;
  const stageDrops = generateStageDrops(state.activeStage.index, reward.items.length);
  const rewardItems = [...reward.items, ...stageDrops];
  state.scrap += reward.scrap;
  rewardItems.forEach((itemId) => {
    state.inventory[itemId] = (state.inventory[itemId] ?? 0) + 1;
  });
  const nextStageIndex = Math.min(stages.length, state.activeStage.index + 1);
  state.checkpoint = Math.min(stages.length - 1, state.activeStage.index + 1);
  state.unlockedStage = Math.min(stages.length - 1, state.activeStage.index + 1);
  state.selectedStage = Math.min(stages.length - 1, state.activeStage.index + 1);
  state.rewardSummary = {
    stageName: state.activeStage.name,
    scrap: reward.scrap,
    items: rewardItems,
    nextStageIndex,
  };
  state.log.unshift(`${state.activeStage.name} cleared. Salvage secured.`);
  state.feedbacks = [];
  state.lastEffectSummary = [];
  state.screen = "reward";
  state.battle = null;
  render();
}

function endOfRoundMaintenance() {
  state.crew.forEach(tickUnitEffects);
  state.battle.enemies.forEach(tickUnitEffects);
  if (state.battle.turret?.duration > 0) {
    const target = state.battle.enemies.find((enemy) => enemy.hp > 0);
    if (target) {
      applyDamage(target, state.battle.turret.damage, state.crew[0], "skill");
      state.log.unshift(`Support turret fired at ${target.name}.`);
    }
    state.battle.turret.duration -= 1;
  }
}

function tickUnitEffects(unit) {
  unit.buffs = unit.buffs
    .map((buff) => ({ ...buff, duration: buff.duration - 1 }))
    .filter((buff) => buff.duration > 0);

  if (unit.status.includes("poison")) {
    unit.hp = Math.max(0, unit.hp - 6);
    pushFeedback(unit.id, "-6", "damage");
    recordEffect(`${unit.name} suffers poison`, "debuff");
    state.log.unshift(`${unit.name} suffered poison damage.`);
  }
  if (unit.status.includes("locked")) {
    unit.status = unit.status.filter((status) => status !== "locked");
  }
  if (unit.hp <= 0) {
    unit.alive = false;
  }
}

function getBuffValue(unit, type) {
  return unit.buffs
    .filter((buff) => buff.type === type)
    .reduce((sum, buff) => sum + buff.amount, 0);
}

function getPriorityBoost(unit) {
  const ordered = getOrderedCrew().map((member) => member.id);
  const index = ordered.indexOf(unit.id);
  return index === -1 ? 0 : (ordered.length - index) * 20;
}

function getSpeed(unit) {
  const priority = state.crew.some((member) => member.id === unit.id) ? getPriorityBoost(unit) : 0;
  return unit.speed + getBuffValue(unit, "speedUp") + priority;
}

function swapCrewPriority(firstId, secondId) {
  if (!firstId || !secondId || firstId === secondId) return;
  const firstIndex = state.priorityOrder.indexOf(firstId);
  const secondIndex = state.priorityOrder.indexOf(secondId);
  if (firstIndex === -1 || secondIndex === -1) return;
  [state.priorityOrder[firstIndex], state.priorityOrder[secondIndex]] = [state.priorityOrder[secondIndex], state.priorityOrder[firstIndex]];
  state.draggedCrewId = null;
  render();
}

function pushFeedback(unitId, text, kind) {
  const existing = state.feedbacks.filter((feedback) => feedback.unitId === unitId).length;
  state.feedbacks.push({
    id: `${unitId}-${Date.now()}-${Math.random()}`,
    unitId,
    text,
    kind,
    slot: getUnitSlot(unitId),
    stack: existing,
    expiresAt: Date.now() + 1500,
  });
}

function recordEffect(text, kind) {
  state.lastEffectSummary.unshift({ text, kind });
  state.lastEffectSummary = state.lastEffectSummary.slice(0, 10);
}

function getUnitSlot(unitId, explicitSide) {
  const crewIndex = getOrderedCrew().findIndex((member) => member.id === unitId);
  if (crewIndex !== -1) return `crew-${crewIndex + 1}`;
  const enemyIndex = state.battle?.enemies.findIndex((enemy) => enemy.id === unitId) ?? -1;
  if (enemyIndex !== -1) return `enemy-${enemyIndex + 1}`;
  return explicitSide === "enemy" ? "enemy-1" : "crew-1";
}

function findUnitById(id) {
  return [...state.crew, ...(state.battle?.enemies ?? [])].find((unit) => unit.id === id);
}

function randomDrop() {
  const keys = Object.keys(itemCatalog);
  return keys[Math.floor(Math.random() * keys.length)];
}

function generateStageDrops(stageIndex, includedDropCount = 0) {
  const dropCount = Math.max(0, 3 + stageIndex - includedDropCount);
  return Array.from({ length: dropCount }, () => randomDrop());
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getActionTarget(planner, command) {
  if (command === "defend") {
    state.targetMode = "ally";
    return planner;
  }

  if (command === "attack") {
    state.targetMode = "enemy";
    return (
      findEnemyTarget(state.selectedTarget) ??
      state.battle.enemies.find((enemy) => enemy.hp > 0) ??
      null
    );
  }

  if (command === "skill") {
    if (planner.id === "medic") {
      state.targetMode = "ally";
      return findAllyTarget(state.selectedTarget);
    }

    if (planner.id === "engineer" || planner.id === "navigator") {
      state.targetMode = "ally";
      return planner;
    }

    state.targetMode = "enemy";
    return (
      findEnemyTarget(state.selectedTarget) ??
      state.battle.enemies.find((enemy) => enemy.hp > 0) ??
      null
    );
  }

  return null;
}

function findEnemyTarget(targetId) {
  return state.battle.enemies.find((enemy) => enemy.id === targetId && enemy.hp > 0) ?? null;
}

function findAllyTarget(targetId) {
  return state.crew.find((member) => member.id === targetId && member.hp > 0) ?? null;
}

function drawBattleSprites() {
  state.feedbacks = state.feedbacks.filter((feedback) => feedback.expiresAt > Date.now());
  document.querySelectorAll(".sprite-frame").forEach((sprite) => {
    const id = sprite.dataset.spriteId;
    const side = sprite.dataset.spriteSide;
    const unit = findUnitById(id);
    if (unit?.animUntil && Date.now() > unit.animUntil && unit.hp > 0) {
      unit.anim = "idle";
      unit.animUntil = 0;
    }
    if (!unit) return;
    const nextSrc = getSpriteFrame(unit, side);
    if (sprite.getAttribute("src") !== nextSrc) {
      sprite.setAttribute("src", nextSrc);
    }
  });
}

function getSpriteFrame(unit, side) {
  const frames = SPRITE_FRAMES[side === "enemy" ? "enemy" : "crew"];
  if (unit.hp <= 0) return frames[0];
  const frameOffset = [...unit.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % frames.length;
  return frames[(Math.floor(Date.now() / 260) + frameOffset) % frames.length];
}

function startAnimationLoop() {
  const draw = () => {
    if (state.screen === "battle") {
      drawBattleSprites();
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

function ordinal(value) {
  if (value === 1) return "1st";
  if (value === 2) return "2nd";
  if (value === 3) return "3rd";
  return `${value}th`;
}

init();
window.__gameApi = {
  get state() {
    return state;
  },
  startStage,
  render,
  resolveTurn,
  checkBattleConclusion,
  testUseItem(actorId, targetId, itemId) {
    const actor = findUnitById(actorId);
    const target = findUnitById(targetId);
    if (actor && target) useItem(actor, target, itemId);
  },
};

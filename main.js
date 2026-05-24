var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => DailyJournalPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  journalFolder: "Journal",
  habits: "Exercise,Read,Meditate,No sugar,8h sleep"
};
var MOOD_EMOJIS = ["\u{1F61E}", "\u{1F615}", "\u{1F610}", "\u{1F642}", "\u{1F604}"];
var MOOD_LABELS = ["Terrible", "Bad", "Neutral", "Good", "Great"];
var REFLECTION_PROMPTS = [
  [
    "What are three things you are grateful for today?",
    "What was the biggest challenge you faced today?",
    "What is your main intention for tomorrow?"
  ],
  [
    "Who made a positive impact on your day and why?",
    "What would you do differently if you could replay today?",
    "What is one thing you want to accomplish tomorrow?"
  ],
  [
    "What surprised you most today?",
    "What drained your energy today and how can you avoid it?",
    "What small step will move you forward on your biggest goal tomorrow?"
  ],
  [
    "What did you learn about yourself today?",
    "Where did you spend most of your mental energy?",
    "What habit do you want to strengthen this week?"
  ],
  [
    "What moment today brought you joy?",
    "What is one thing you wish you had handled better?",
    "What are you looking forward to most tomorrow?"
  ],
  [
    "How did you take care of your health today?",
    "What conversation had the most impact on you?",
    "What will you stop, start, or continue doing tomorrow?"
  ],
  [
    "What accomplished you most proud of today?",
    "What fear or resistance showed up today?",
    "What would make tomorrow a 10/10 day?"
  ]
];
function todayString() {
  return (0, import_obsidian.moment)().format("YYYY-MM-DD");
}
function getPromptSet() {
  const dayOfYear = (0, import_obsidian.moment)().dayOfYear();
  return REFLECTION_PROMPTS[dayOfYear % REFLECTION_PROMPTS.length];
}
function getHabitList(settings) {
  return settings.habits.split(",").map((h) => h.trim()).filter(Boolean);
}
function journalFileName(date) {
  return `${date}.md`;
}
function journalFilePath(folder, date) {
  return (0, import_obsidian.normalizePath)(`${folder}/${journalFileName(date)}`);
}
function parseMoodFromContent(content) {
  const match = content.match(/\*\*Mood\*\*:\s*(\d)/);
  return match ? parseInt(match[1]) - 1 : null;
}
function parseHabitsFromContent(content, habitList) {
  const result = {};
  for (const habit of habitList) {
    const escaped = habit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const checked = new RegExp(`- \\[x\\] ${escaped}`, "i").test(content);
    const unchecked = new RegExp(`- \\[ \\] ${escaped}`, "i").test(content);
    result[habit] = checked && !unchecked ? true : false;
  }
  return result;
}
function habitCompletionPercent(habits) {
  const vals = Object.values(habits);
  if (vals.length === 0)
    return 0;
  const done = vals.filter(Boolean).length;
  return Math.round(done / vals.length * 100);
}
async function calculateStreak(app, folder) {
  let streak = 0;
  let date = (0, import_obsidian.moment)();
  const today = date.format("YYYY-MM-DD");
  const todayPath = journalFilePath(folder, today);
  const hasTodayEntry = !!app.vault.getAbstractFileByPath(todayPath);
  if (!hasTodayEntry) {
    date = (0, import_obsidian.moment)().subtract(1, "days");
  }
  for (let i = 0; i < 365; i++) {
    const dateStr = date.format("YYYY-MM-DD");
    const path = journalFilePath(folder, dateStr);
    if (app.vault.getAbstractFileByPath(path)) {
      streak++;
      date = date.subtract(1, "days");
    } else {
      break;
    }
  }
  return streak;
}
var DJ_VIEW_TYPE = "daily-journal-view";
var DailyJournalView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return DJ_VIEW_TYPE;
  }
  getDisplayText() {
    return "Daily Journal";
  }
  getIcon() {
    return "book-open";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("daily-journal-view");
    const header = container.createDiv("daily-journal-header");
    header.createEl("h4", { text: "Daily Journal" });
    const openBtn = header.createEl("button", {
      text: "Today",
      cls: "dj-btn",
      attr: { title: "Open today's journal" }
    });
    openBtn.addEventListener("click", () => this.plugin.openTodayEntry());
    const streak = await calculateStreak(
      this.app,
      this.plugin.settings.journalFolder
    );
    const streakBox = container.createDiv("dj-streak-box");
    streakBox.createDiv({ cls: "dj-streak-fire", text: "\u{1F525}" });
    const streakInfo = streakBox.createDiv();
    streakInfo.createDiv({
      cls: "dj-streak-count",
      text: `${streak}`
    });
    streakInfo.createDiv({
      cls: "dj-streak-label",
      text: streak === 1 ? "day streak" : "day streak"
    });
    container.createDiv({ cls: "dj-section-title", text: "This Week" });
    await this.renderWeekGrid(container);
    container.createDiv({ cls: "dj-section-title", text: "Recent Entries" });
    await this.renderRecentEntries(container);
  }
  async renderWeekGrid(container) {
    const habitList = getHabitList(this.plugin.settings);
    const grid = container.createDiv("dj-week-grid");
    const startOfWeek = (0, import_obsidian.moment)().startOf("isoWeek");
    for (let i = 0; i < 7; i++) {
      const day = (0, import_obsidian.moment)(startOfWeek).add(i, "days");
      const dateStr = day.format("YYYY-MM-DD");
      const isToday = dateStr === todayString();
      const isFuture = day.isAfter((0, import_obsidian.moment)(), "day");
      const cell = grid.createDiv(
        `dj-day-cell${isToday ? " today" : ""}${isFuture ? " no-entry" : ""}`
      );
      cell.createDiv({
        cls: "dj-day-label",
        text: day.format("dd")
      });
      if (!isFuture) {
        const path = journalFilePath(
          this.plugin.settings.journalFolder,
          dateStr
        );
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file && file instanceof import_obsidian.TFile) {
          cell.addClass("has-entry");
          const content = await this.app.vault.read(file);
          const moodIdx = parseMoodFromContent(content);
          cell.createDiv({
            cls: "dj-day-mood",
            text: moodIdx !== null ? MOOD_EMOJIS[moodIdx] : "\u2014"
          });
          if (habitList.length > 0) {
            const habits = parseHabitsFromContent(content, habitList);
            const pct = habitCompletionPercent(habits);
            cell.createDiv({ cls: "dj-day-habits", text: `${pct}%` });
          }
          cell.addEventListener("click", async () => {
            await this.app.workspace.openLinkText(file.path, "", false);
          });
        } else {
          cell.createDiv({ cls: "dj-day-mood", text: "\xB7" });
          cell.addEventListener("click", async () => {
            if (isToday)
              await this.plugin.openTodayEntry();
          });
        }
      } else {
        cell.createDiv({ cls: "dj-day-mood", text: "\xB7" });
      }
    }
  }
  async renderRecentEntries(container) {
    const folder = this.plugin.settings.journalFolder;
    const habitList = getHabitList(this.plugin.settings);
    const files = this.app.vault.getFiles().filter(
      (f) => f.path.startsWith(folder + "/") && /\d{4}-\d{2}-\d{2}\.md$/.test(f.name)
    ).sort((a, b) => b.name.localeCompare(a.name)).slice(0, 7);
    if (files.length === 0) {
      container.createEl("p", {
        text: "No journal entries yet.",
        cls: "dj-section-title"
      });
      return;
    }
    for (const file of files) {
      const content = await this.app.vault.read(file);
      const moodIdx = parseMoodFromContent(content);
      const habits = habitList.length > 0 ? parseHabitsFromContent(content, habitList) : {};
      const pct = habitCompletionPercent(habits);
      const item = container.createDiv("dj-entry-item");
      const left = item.createDiv();
      left.createDiv({
        cls: "dj-entry-date",
        text: file.basename
      });
      if (habitList.length > 0) {
        const bar = left.createDiv("dj-habit-bar");
        bar.createSpan({ text: `Habits: ${pct}%` });
        const barOuter = bar.createDiv("dj-habit-progress");
        const fill = barOuter.createDiv("dj-habit-fill");
        fill.style.width = `${pct}%`;
      }
      item.createDiv({
        cls: "dj-entry-mood-display",
        text: moodIdx !== null ? MOOD_EMOJIS[moodIdx] : "\u2014"
      });
      item.addEventListener("click", async () => {
        await this.app.workspace.openLinkText(file.path, "", false);
      });
    }
  }
};
async function createTodayEntry(app, plugin) {
  const folder = plugin.settings.journalFolder;
  const date = todayString();
  const path = journalFilePath(folder, date);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof import_obsidian.TFile)
    return existing;
  if (!app.vault.getAbstractFileByPath((0, import_obsidian.normalizePath)(folder))) {
    await app.vault.createFolder((0, import_obsidian.normalizePath)(folder));
  }
  const habitList = getHabitList(plugin.settings);
  const promptSet = getPromptSet();
  const habitSection = habitList.length > 0 ? ["## Habits", "", ...habitList.map((h) => `- [ ] ${h}`), ""] : [];
  const content = [
    `# Journal \u2014 ${date}`,
    "",
    `**Mood**: \u2014 _(update with 1-5)_`,
    "",
    "## Morning Intention",
    "",
    "_What do you want to focus on today?_",
    "",
    ...habitSection,
    "## Reflection",
    "",
    `> ${promptSet[0]}`,
    "",
    "",
    `> ${promptSet[1]}`,
    "",
    "",
    `> ${promptSet[2]}`,
    "",
    "",
    "## Notes",
    ""
  ].join("\n");
  return await app.vault.create(path, content);
}
var JournalEntryModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.selectedMood = null;
    this.habitChecks = {};
    this.notes = "";
    this.plugin = plugin;
  }
  async onOpen() {
    var _a;
    const { contentEl } = this;
    contentEl.empty();
    const date = todayString();
    contentEl.createEl("h2", { text: `Journal \u2014 ${date}` });
    const habitList = getHabitList(this.plugin.settings);
    for (const h of habitList)
      this.habitChecks[h] = false;
    const path = journalFilePath(this.plugin.settings.journalFolder, date);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian.TFile) {
      const content = await this.app.vault.read(existing);
      const moodIdx = parseMoodFromContent(content);
      if (moodIdx !== null)
        this.selectedMood = moodIdx;
      const existingHabits = parseHabitsFromContent(content, habitList);
      Object.assign(this.habitChecks, existingHabits);
    }
    const moodSection = contentEl.createDiv("dj-modal-section");
    moodSection.createEl("h3", { text: "Mood" });
    const moodRow = moodSection.createDiv("dj-mood-row");
    const moodBtns = [];
    for (let i = 0; i < MOOD_EMOJIS.length; i++) {
      const btn = moodRow.createEl("button", {
        cls: `dj-mood-btn${this.selectedMood === i ? " selected" : ""}`,
        text: MOOD_EMOJIS[i],
        attr: { title: MOOD_LABELS[i] }
      });
      const idx = i;
      btn.addEventListener("click", () => {
        this.selectedMood = idx;
        moodBtns.forEach((b, j) => b.toggleClass("selected", j === idx));
      });
      moodBtns.push(btn);
    }
    if (habitList.length > 0) {
      const habitSection = contentEl.createDiv("dj-modal-section");
      habitSection.createEl("h3", { text: "Habits" });
      const habitListEl = habitSection.createDiv("dj-habit-list");
      for (const habit of habitList) {
        const row = habitListEl.createDiv("dj-habit-item");
        const checkbox = row.createEl("input", {
          type: "checkbox",
          attr: { id: `habit-${habit}` }
        });
        checkbox.checked = (_a = this.habitChecks[habit]) != null ? _a : false;
        checkbox.addEventListener("change", () => {
          this.habitChecks[habit] = checkbox.checked;
        });
        row.createEl("label", {
          text: habit,
          attr: { for: `habit-${habit}` }
        });
      }
    }
    const promptSet = getPromptSet();
    const reflectionSection = contentEl.createDiv("dj-modal-section");
    reflectionSection.createEl("h3", { text: "Today's Prompts" });
    for (const prompt of promptSet) {
      reflectionSection.createDiv({ cls: "dj-prompt-box", text: prompt });
    }
    reflectionSection.createEl("p", {
      text: "Open the full entry to write your reflections.",
      attr: { style: "font-size: 12px; color: var(--text-muted); margin: 4px 0;" }
    });
    new import_obsidian.Setting(contentEl).setName("Quick note").setDesc("A brief note for today").addTextArea((t) => {
      t.setPlaceholder("Today I...").onChange((v) => this.notes = v);
      t.inputEl.style.width = "100%";
      t.inputEl.rows = 3;
    });
    new import_obsidian.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Save & Open Entry").setCta().onClick(() => this.save(true))
    ).addButton(
      (btn) => btn.setButtonText("Save").onClick(() => this.save(false))
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => this.close())
    );
  }
  async save(openAfter) {
    const date = todayString();
    const folder = this.plugin.settings.journalFolder;
    const path = journalFilePath(folder, date);
    const habitList = getHabitList(this.plugin.settings);
    let file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof import_obsidian.TFile)) {
      file = await createTodayEntry(this.app, this.plugin);
    }
    if (!(file instanceof import_obsidian.TFile)) {
      new import_obsidian.Notice("Could not create journal entry.");
      return;
    }
    let content = await this.app.vault.read(file);
    if (this.selectedMood !== null) {
      const moodValue = this.selectedMood + 1;
      const moodEmoji = MOOD_EMOJIS[this.selectedMood];
      if (/\*\*Mood\*\*:/.test(content)) {
        content = content.replace(
          /\*\*Mood\*\*:.*$/m,
          `**Mood**: ${moodValue} ${moodEmoji} \u2014 ${MOOD_LABELS[this.selectedMood]}`
        );
      }
    }
    for (const habit of habitList) {
      const escaped = habit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const checked = this.habitChecks[habit];
      content = content.replace(
        new RegExp(`- \\[[ x]\\] ${escaped}`, "g"),
        `- [${checked ? "x" : " "}] ${habit}`
      );
    }
    if (this.notes.trim()) {
      const noteSection = `
### Quick Note

${this.notes.trim()}
`;
      if (content.includes("## Notes")) {
        content = content.replace(
          "## Notes\n",
          `## Notes
${noteSection}`
        );
      } else {
        content += noteSection;
      }
    }
    await this.app.vault.modify(file, content);
    new import_obsidian.Notice("Journal entry saved.");
    await this.plugin.refreshSidebar();
    this.close();
    if (openAfter) {
      await this.app.workspace.openLinkText(file.path, "", false);
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var DailyJournalSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Daily Journal Settings" });
    new import_obsidian.Setting(containerEl).setName("Journal folder").setDesc("Vault folder where journal entries are stored.").addText(
      (t) => t.setPlaceholder("Journal").setValue(this.plugin.settings.journalFolder).onChange(async (v) => {
        this.plugin.settings.journalFolder = v.trim() || "Journal";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Habits").setDesc("Comma-separated list of daily habits to track.").addTextArea((t) => {
      t.setPlaceholder("Exercise,Read,Meditate").setValue(this.plugin.settings.habits).onChange(async (v) => {
        this.plugin.settings.habits = v;
        await this.plugin.saveSettings();
      });
      t.inputEl.style.width = "100%";
      t.inputEl.rows = 3;
    });
  }
};
var DailyJournalPlugin = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.registerView(DJ_VIEW_TYPE, (leaf) => new DailyJournalView(leaf, this));
    this.addRibbonIcon("book-open", "Daily Journal", () => {
      this.activateSidebar();
    });
    this.addCommand({
      id: "open-daily-journal-sidebar",
      name: "Open Daily Journal sidebar",
      callback: () => this.activateSidebar()
    });
    this.addCommand({
      id: "open-today-entry",
      name: "Open today's journal entry",
      callback: () => this.openTodayEntry()
    });
    this.addCommand({
      id: "quick-journal-entry",
      name: "Quick journal entry (mood + habits)",
      callback: () => {
        new JournalEntryModal(this.app, this).open();
      }
    });
    this.addSettingTab(new DailyJournalSettingTab(this.app, this));
  }
  async openTodayEntry() {
    const file = await createTodayEntry(this.app, this);
    await this.app.workspace.openLinkText(file.path, "", false);
    await this.refreshSidebar();
  }
  async activateSidebar() {
    var _a;
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(DJ_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = (_a = workspace.getRightLeaf(false)) != null ? _a : workspace.getLeaf(true);
      await leaf.setViewState({ type: DJ_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
  async refreshSidebar() {
    const leaves = this.app.workspace.getLeavesOfType(DJ_VIEW_TYPE);
    for (const leaf of leaves) {
      const view = leaf.view;
      await view.render();
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(DJ_VIEW_TYPE);
  }
};

import {
  App,
  ItemView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  WorkspaceLeaf,
  normalizePath,
  moment,
} from "obsidian";

// ── Types ────────────────────────────────────────────────────────────────────

interface DailyJournalSettings {
  journalFolder: string;
  habits: string;
}

const DEFAULT_SETTINGS: DailyJournalSettings = {
  journalFolder: "Journal",
  habits: "Exercise,Read,Meditate,No sugar,8h sleep",
};

const MOOD_EMOJIS = ["😞", "😕", "😐", "🙂", "😄"];
const MOOD_LABELS = ["Terrible", "Bad", "Neutral", "Good", "Great"];

const REFLECTION_PROMPTS = [
  [
    "What are three things you are grateful for today?",
    "What was the biggest challenge you faced today?",
    "What is your main intention for tomorrow?",
  ],
  [
    "Who made a positive impact on your day and why?",
    "What would you do differently if you could replay today?",
    "What is one thing you want to accomplish tomorrow?",
  ],
  [
    "What surprised you most today?",
    "What drained your energy today and how can you avoid it?",
    "What small step will move you forward on your biggest goal tomorrow?",
  ],
  [
    "What did you learn about yourself today?",
    "Where did you spend most of your mental energy?",
    "What habit do you want to strengthen this week?",
  ],
  [
    "What moment today brought you joy?",
    "What is one thing you wish you had handled better?",
    "What are you looking forward to most tomorrow?",
  ],
  [
    "How did you take care of your health today?",
    "What conversation had the most impact on you?",
    "What will you stop, start, or continue doing tomorrow?",
  ],
  [
    "What accomplished you most proud of today?",
    "What fear or resistance showed up today?",
    "What would make tomorrow a 10/10 day?",
  ],
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayString(): string {
  return moment().format("YYYY-MM-DD");
}

function getPromptSet(): string[] {
  const dayOfYear = moment().dayOfYear();
  return REFLECTION_PROMPTS[dayOfYear % REFLECTION_PROMPTS.length];
}

function getHabitList(settings: DailyJournalSettings): string[] {
  return settings.habits
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

function journalFileName(date: string): string {
  return `${date}.md`;
}

function journalFilePath(folder: string, date: string): string {
  return normalizePath(`${folder}/${journalFileName(date)}`);
}

function parseMoodFromContent(content: string): number | null {
  const match = content.match(/\*\*Mood\*\*:\s*(\d)/);
  return match ? parseInt(match[1]) - 1 : null; // 0-indexed
}

function parseHabitsFromContent(
  content: string,
  habitList: string[]
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const habit of habitList) {
    const escaped = habit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const checked = new RegExp(`- \\[x\\] ${escaped}`, "i").test(content);
    const unchecked = new RegExp(`- \\[ \\] ${escaped}`, "i").test(content);
    result[habit] = checked && !unchecked ? true : false;
  }
  return result;
}

function habitCompletionPercent(
  habits: Record<string, boolean>
): number {
  const vals = Object.values(habits);
  if (vals.length === 0) return 0;
  const done = vals.filter(Boolean).length;
  return Math.round((done / vals.length) * 100);
}

// ── Streak Calculator ─────────────────────────────────────────────────────────

async function calculateStreak(
  app: App,
  folder: string
): Promise<number> {
  let streak = 0;
  let date = moment();
  const today = date.format("YYYY-MM-DD");

  // Check today first; if no entry today, start from yesterday
  const todayPath = journalFilePath(folder, today);
  const hasTodayEntry = !!app.vault.getAbstractFileByPath(todayPath);
  if (!hasTodayEntry) {
    date = moment().subtract(1, "days");
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

// ── Sidebar View ─────────────────────────────────────────────────────────────

const DJ_VIEW_TYPE = "daily-journal-view";

class DailyJournalView extends ItemView {
  plugin: DailyJournalPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: DailyJournalPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return DJ_VIEW_TYPE; }
  getDisplayText(): string { return "Daily Journal"; }
  getIcon(): string { return "book-open"; }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("daily-journal-view");

    // Header
    const header = container.createDiv("daily-journal-header");
    header.createEl("h4", { text: "Daily Journal" });
    const openBtn = header.createEl("button", {
      text: "Today",
      cls: "dj-btn",
      attr: { title: "Open today's journal" },
    });
    openBtn.addEventListener("click", () => this.plugin.openTodayEntry());

    // Streak
    const streak = await calculateStreak(
      this.app,
      this.plugin.settings.journalFolder
    );
    const streakBox = container.createDiv("dj-streak-box");
    streakBox.createDiv({ cls: "dj-streak-fire", text: "🔥" });
    const streakInfo = streakBox.createDiv();
    streakInfo.createDiv({
      cls: "dj-streak-count",
      text: `${streak}`,
    });
    streakInfo.createDiv({
      cls: "dj-streak-label",
      text: streak === 1 ? "day streak" : "day streak",
    });

    // This week
    container.createDiv({ cls: "dj-section-title", text: "This Week" });
    await this.renderWeekGrid(container);

    // Recent entries
    container.createDiv({ cls: "dj-section-title", text: "Recent Entries" });
    await this.renderRecentEntries(container);
  }

  async renderWeekGrid(container: HTMLElement): Promise<void> {
    const habitList = getHabitList(this.plugin.settings);
    const grid = container.createDiv("dj-week-grid");
    const startOfWeek = moment().startOf("isoWeek");

    for (let i = 0; i < 7; i++) {
      const day = moment(startOfWeek).add(i, "days");
      const dateStr = day.format("YYYY-MM-DD");
      const isToday = dateStr === todayString();
      const isFuture = day.isAfter(moment(), "day");

      const cell = grid.createDiv(
        `dj-day-cell${isToday ? " today" : ""}${isFuture ? " no-entry" : ""}`
      );
      cell.createDiv({
        cls: "dj-day-label",
        text: day.format("dd"),
      });

      if (!isFuture) {
        const path = journalFilePath(
          this.plugin.settings.journalFolder,
          dateStr
        );
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file && file instanceof TFile) {
          cell.addClass("has-entry");
          const content = await this.app.vault.read(file);
          const moodIdx = parseMoodFromContent(content);
          cell.createDiv({
            cls: "dj-day-mood",
            text: moodIdx !== null ? MOOD_EMOJIS[moodIdx] : "—",
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
          cell.createDiv({ cls: "dj-day-mood", text: "·" });
          cell.addEventListener("click", async () => {
            if (isToday) await this.plugin.openTodayEntry();
          });
        }
      } else {
        cell.createDiv({ cls: "dj-day-mood", text: "·" });
      }
    }
  }

  async renderRecentEntries(container: HTMLElement): Promise<void> {
    const folder = this.plugin.settings.journalFolder;
    const habitList = getHabitList(this.plugin.settings);
    const files = this.app.vault
      .getFiles()
      .filter(
        (f) =>
          f.path.startsWith(folder + "/") && /\d{4}-\d{2}-\d{2}\.md$/.test(f.name)
      )
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 7);

    if (files.length === 0) {
      container.createEl("p", {
        text: "No journal entries yet.",
        cls: "dj-section-title",
      });
      return;
    }

    for (const file of files) {
      const content = await this.app.vault.read(file);
      const moodIdx = parseMoodFromContent(content);
      const habits =
        habitList.length > 0
          ? parseHabitsFromContent(content, habitList)
          : {};
      const pct = habitCompletionPercent(habits);

      const item = container.createDiv("dj-entry-item");
      const left = item.createDiv();
      left.createDiv({
        cls: "dj-entry-date",
        text: file.basename,
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
        text: moodIdx !== null ? MOOD_EMOJIS[moodIdx] : "—",
      });

      item.addEventListener("click", async () => {
        await this.app.workspace.openLinkText(file.path, "", false);
      });
    }
  }
}

// ── Today Entry Creator ───────────────────────────────────────────────────────

async function createTodayEntry(
  app: App,
  plugin: DailyJournalPlugin
): Promise<TFile> {
  const folder = plugin.settings.journalFolder;
  const date = todayString();
  const path = journalFilePath(folder, date);

  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;

  if (!app.vault.getAbstractFileByPath(normalizePath(folder))) {
    await app.vault.createFolder(normalizePath(folder));
  }

  const habitList = getHabitList(plugin.settings);
  const promptSet = getPromptSet();

  const habitSection =
    habitList.length > 0
      ? ["## Habits", "", ...habitList.map((h) => `- [ ] ${h}`), ""]
      : [];

  const content = [
    `# Journal — ${date}`,
    "",
    `**Mood**: — _(update with 1-5)_`,
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
    "",
  ].join("\n");

  return await app.vault.create(path, content);
}

// ── Journal Entry Modal (Quick Entry) ────────────────────────────────────────

class JournalEntryModal extends Modal {
  plugin: DailyJournalPlugin;
  private selectedMood: number | null = null;
  private habitChecks: Record<string, boolean> = {};
  private notes = "";

  constructor(app: App, plugin: DailyJournalPlugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();

    const date = todayString();
    contentEl.createEl("h2", { text: `Journal — ${date}` });

    const habitList = getHabitList(this.plugin.settings);
    for (const h of habitList) this.habitChecks[h] = false;

    // Check if entry already exists and pre-fill
    const path = journalFilePath(this.plugin.settings.journalFolder, date);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      const content = await this.app.vault.read(existing);
      const moodIdx = parseMoodFromContent(content);
      if (moodIdx !== null) this.selectedMood = moodIdx;
      const existingHabits = parseHabitsFromContent(content, habitList);
      Object.assign(this.habitChecks, existingHabits);
    }

    // Mood section
    const moodSection = contentEl.createDiv("dj-modal-section");
    moodSection.createEl("h3", { text: "Mood" });
    const moodRow = moodSection.createDiv("dj-mood-row");
    const moodBtns: HTMLButtonElement[] = [];

    for (let i = 0; i < MOOD_EMOJIS.length; i++) {
      const btn = moodRow.createEl("button", {
        cls: `dj-mood-btn${this.selectedMood === i ? " selected" : ""}`,
        text: MOOD_EMOJIS[i],
        attr: { title: MOOD_LABELS[i] },
      });
      const idx = i;
      btn.addEventListener("click", () => {
        this.selectedMood = idx;
        moodBtns.forEach((b, j) => b.toggleClass("selected", j === idx));
      });
      moodBtns.push(btn);
    }

    // Habits section
    if (habitList.length > 0) {
      const habitSection = contentEl.createDiv("dj-modal-section");
      habitSection.createEl("h3", { text: "Habits" });
      const habitListEl = habitSection.createDiv("dj-habit-list");

      for (const habit of habitList) {
        const row = habitListEl.createDiv("dj-habit-item");
        const checkbox = row.createEl("input", {
          type: "checkbox",
          attr: { id: `habit-${habit}` },
        }) as HTMLInputElement;
        checkbox.checked = this.habitChecks[habit] ?? false;
        checkbox.addEventListener("change", () => {
          this.habitChecks[habit] = checkbox.checked;
        });
        row.createEl("label", {
          text: habit,
          attr: { for: `habit-${habit}` },
        });
      }
    }

    // Reflection prompts
    const promptSet = getPromptSet();
    const reflectionSection = contentEl.createDiv("dj-modal-section");
    reflectionSection.createEl("h3", { text: "Today's Prompts" });
    for (const prompt of promptSet) {
      reflectionSection.createDiv({ cls: "dj-prompt-box", text: prompt });
    }

    reflectionSection.createEl("p", {
      text: "Open the full entry to write your reflections.",
      attr: { style: "font-size: 12px; color: var(--text-muted); margin: 4px 0;" },
    });

    // Notes
    new Setting(contentEl)
      .setName("Quick note")
      .setDesc("A brief note for today")
      .addTextArea((t) => {
        t.setPlaceholder("Today I...")
          .onChange((v) => (this.notes = v));
        t.inputEl.style.width = "100%";
        t.inputEl.rows = 3;
      });

    // Buttons
    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Save & Open Entry")
          .setCta()
          .onClick(() => this.save(true))
      )
      .addButton((btn) =>
        btn
          .setButtonText("Save")
          .onClick(() => this.save(false))
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => this.close())
      );
  }

  async save(openAfter: boolean): Promise<void> {
    const date = todayString();
    const folder = this.plugin.settings.journalFolder;
    const path = journalFilePath(folder, date);
    const habitList = getHabitList(this.plugin.settings);

    let file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      file = await createTodayEntry(this.app, this.plugin);
    }

    if (!(file instanceof TFile)) {
      new Notice("Could not create journal entry.");
      return;
    }

    let content = await this.app.vault.read(file);

    // Update mood
    if (this.selectedMood !== null) {
      const moodValue = this.selectedMood + 1;
      const moodEmoji = MOOD_EMOJIS[this.selectedMood];
      if (/\*\*Mood\*\*:/.test(content)) {
        content = content.replace(
          /\*\*Mood\*\*:.*$/m,
          `**Mood**: ${moodValue} ${moodEmoji} — ${MOOD_LABELS[this.selectedMood]}`
        );
      }
    }

    // Update habits
    for (const habit of habitList) {
      const escaped = habit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const checked = this.habitChecks[habit];
      content = content.replace(
        new RegExp(`- \\[[ x]\\] ${escaped}`, "g"),
        `- [${checked ? "x" : " "}] ${habit}`
      );
    }

    // Append quick note
    if (this.notes.trim()) {
      const noteSection = `\n### Quick Note\n\n${this.notes.trim()}\n`;
      if (content.includes("## Notes")) {
        content = content.replace(
          "## Notes\n",
          `## Notes\n${noteSection}`
        );
      } else {
        content += noteSection;
      }
    }

    await this.app.vault.modify(file, content);
    new Notice("Journal entry saved.");
    await this.plugin.refreshSidebar();
    this.close();

    if (openAfter) {
      await this.app.workspace.openLinkText(file.path, "", false);
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

// ── Settings Tab ─────────────────────────────────────────────────────────────

class DailyJournalSettingTab extends PluginSettingTab {
  plugin: DailyJournalPlugin;

  constructor(app: App, plugin: DailyJournalPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Daily Journal Settings" });

    new Setting(containerEl)
      .setName("Journal folder")
      .setDesc("Vault folder where journal entries are stored.")
      .addText((t) =>
        t
          .setPlaceholder("Journal")
          .setValue(this.plugin.settings.journalFolder)
          .onChange(async (v) => {
            this.plugin.settings.journalFolder = v.trim() || "Journal";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Habits")
      .setDesc("Comma-separated list of daily habits to track.")
      .addTextArea((t) => {
        t.setPlaceholder("Exercise,Read,Meditate")
          .setValue(this.plugin.settings.habits)
          .onChange(async (v) => {
            this.plugin.settings.habits = v;
            await this.plugin.saveSettings();
          });
        t.inputEl.style.width = "100%";
        t.inputEl.rows = 3;
      });
  }
}

// ── Main Plugin ───────────────────────────────────────────────────────────────

export default class DailyJournalPlugin extends Plugin {
  settings!: DailyJournalSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(DJ_VIEW_TYPE, (leaf) => new DailyJournalView(leaf, this));

    this.addRibbonIcon("book-open", "Daily Journal", () => {
      this.activateSidebar();
    });

    this.addCommand({
      id: "open-daily-journal-sidebar",
      name: "Open Daily Journal sidebar",
      callback: () => this.activateSidebar(),
    });

    this.addCommand({
      id: "open-today-entry",
      name: "Open today's journal entry",
      callback: () => this.openTodayEntry(),
    });

    this.addCommand({
      id: "quick-journal-entry",
      name: "Quick journal entry (mood + habits)",
      callback: () => {
        new JournalEntryModal(this.app, this).open();
      },
    });

    this.addSettingTab(new DailyJournalSettingTab(this.app, this));
  }

  async openTodayEntry(): Promise<void> {
    const file = await createTodayEntry(this.app, this);
    await this.app.workspace.openLinkText(file.path, "", false);
    await this.refreshSidebar();
  }

  async activateSidebar(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(DJ_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: DJ_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async refreshSidebar(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(DJ_VIEW_TYPE);
    for (const leaf of leaves) {
      const view = leaf.view as DailyJournalView;
      await view.render();
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(DJ_VIEW_TYPE);
  }
}

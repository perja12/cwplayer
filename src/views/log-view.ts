import { appStore } from "../app/app-store";
import { formatTime, todayKey } from "../model/format";
import { escapeHtml } from "../ui/html";

export function renderLog() {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return {
      key,
      label:
        index === 0
          ? "Today"
          : date.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
      value: appStore.log[key] ?? 0,
    };
  });
  const max = Math.max(1, ...days.map((day) => day.value));
  return `<header class="page-heading"><div><p class="eyebrow">YOUR PRACTICE</p><h1>Listening Log</h1><p class="subheading">Listening time is saved on this device.</p></div></header><section class="stats-grid"><article class="stat-card"><span>Today</span><strong>${formatTime(appStore.log[todayKey()] ?? 0)}</strong></article><article class="stat-card"><span>Last 7 days</span><strong>${formatTime(days.slice(0, 7).reduce((sum, day) => sum + day.value, 0))}</strong></article><article class="stat-card"><span>Last 14 days</span><strong>${formatTime(days.reduce((sum, day) => sum + day.value, 0))}</strong></article></section><section class="chart-card"><h2>Daily listening</h2><div class="chart">${days
    .slice()
    .reverse()
    .map(
      (day) =>
        `<div class="chart-day"><div class="chart-column ${day.label === "Today" ? "today" : ""}" style="height:${Math.max(day.value ? 5 : 2, (day.value / max) * 100)}%" title="${formatTime(day.value)}"></div><span>${escapeHtml(day.label === "Today" ? "Today" : day.label.split(" ").at(-1)!)}</span></div>`,
    )
    .join("")}</div></section>`;
}

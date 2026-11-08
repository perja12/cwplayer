import { appStore, currentItem } from "../app/app-store";
import { renderDock } from "./dock-view";
import { renderLibrary } from "./library-view";
import { renderLog } from "./log-view";
import { renderNav } from "./nav-view";
import { renderPlayer } from "./player-view";
import { renderReview } from "./review-view";

export function renderShell() {
  const active = currentItem();
  const content =
    appStore.view === "library"
      ? renderLibrary()
      : appStore.view === "player"
        ? renderPlayer(active)
        : appStore.view === "review"
          ? renderReview()
          : renderLog();
  return `${renderNav()}<main class="main-view">${content}</main>${renderDock(active)}<dialog id="modal" class="modal"></dialog>`;
}

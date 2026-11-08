import { appStore, updateSettings } from "../app/app-store";
import { playbackStore } from "../app/playback-store";
import { requestRender } from "../app/render-bus";
import { settingsFromFormData } from "../model/settings";
import { openModal } from "../ui/modal";
import { startPlayback, stopPlayback } from "../audio/playback-controller";

export function bindSettingsEvents() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-sound], [data-open-settings]")
    .forEach((button) => button.addEventListener("click", openSoundDialog));
}

function openSoundDialog() {
  const settings = appStore.settings;
  const modal = openModal(
    "form-dialog sound-dialog",
    `<form><header><div><p class="eyebrow">PLAYER</p><h2>Sound &amp; timing</h2></div></header><div class="form-body"><div class="settings-grid"><label>Character speed · WPM<input name="wpm" type="number" min="5" max="100" value="${settings.wpm}"></label><label>Farnsworth WPM <span class="quiet">(optional)</span><input name="farnsworthWpm" type="number" min="5" max="100" value="${settings.farnsworthWpm || ""}" placeholder="Off"></label><label>Tone · Hz<input name="frequency" type="number" min="100" max="7000" value="${settings.frequency}"></label><label>Volume · %<input name="volume" type="number" min="0" max="100" value="${settings.volume}"></label></div><details><summary>Advanced sound</summary><div class="settings-grid"><label>Envelope · ms<input name="envelope" type="number" min="0" max="100" step="0.1" value="${settings.envelope}"></label><label>Shape<select name="shape"><option value="1" ${settings.shape ? "selected" : ""}>Blackman</option><option value="0" ${!settings.shape ? "selected" : ""}>Raised cosine</option></select></label><label>Phase shift · radians<input name="phase" type="number" step="0.01" value="${settings.phase}"></label><label>Paragraph pause · seconds<input name="paragraphPause" type="number" min="0" step="0.1" value="${settings.paragraphPause}"></label><label>Extra word gap<select name="wordGapMultiplier">${[1, 2, 3, 4].map((multiplier) => `<option value="${multiplier}" ${settings.wordGapMultiplier === multiplier ? "selected" : ""}>${multiplier}×${multiplier === 1 ? " (standard)" : ""}</option>`).join("")}</select></label><label>Second tone · Hz<input name="secondFrequency" type="number" min="100" max="7000" value="${settings.secondFrequency || ""}" placeholder="Off"></label><label>Room level · %<input name="roomLevel" type="number" min="0" max="100" value="${settings.roomLevel}"></label></div><label class="check-setting"><input name="stereo" type="checkbox" ${settings.stereo ? "checked" : ""}> Stereo</label><label class="check-setting"><input name="room" type="checkbox" ${settings.room ? "checked" : ""}> Room ambience</label></details><p class="quiet">Pause playback before changing sound settings.</p><p class="quiet about-links">CW Player is free software under the <a href="/LICENSE.txt" target="_blank" rel="noreferrer">GPLv3</a>. <a href="https://github.com/perja12/cwplayer" target="_blank" rel="noreferrer">Source</a> · <a href="/NOTICE.txt" target="_blank" rel="noreferrer">Attribution</a> · <a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">Third-party notices</a>.</p></div><footer><button type="button" class="secondary" data-cancel>Cancel</button><button class="primary" ${playbackStore.state === "playing" || playbackStore.state === "preparing" ? "disabled" : ""}>Apply settings</button></footer></form>`,
  );
  modal.querySelector("[data-cancel]")!.addEventListener("click", () => modal.close());
  if (playbackStore.state === "playing" || playbackStore.state === "preparing")
    modal
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select")
      .forEach((field) => (field.disabled = true));
  modal.querySelector("form")!.addEventListener("submit", (event) => {
    event.preventDefault();
    const next = settingsFromFormData(new FormData(event.currentTarget as HTMLFormElement));
    const rebuildPausedPlayback = playbackStore.state === "paused";
    updateSettings(next);
    modal.close();
    requestRender();
    if (rebuildPausedPlayback)
      void (async () => {
        await stopPlayback();
        await startPlayback();
      })();
  });
}

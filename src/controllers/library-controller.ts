import { appStore, persistLibrary } from "../app/app-store";
import { resetPlaybackPosition } from "../app/playback-store";
import { stopPlayback } from "../audio/playback-controller";
import { requestRender } from "../app/render-bus";
import { encodeCoverImage } from "../data/image-client";
import { uid } from "../model/ids";
import { assignedCollection, removeQueuedText, textDraftFromFormData } from "../model/library";
import type { TextItem } from "../model/types";
import { coverArtwork } from "../ui/cover";
import { escapeHtml, formValue } from "../ui/html";
import { icon } from "../ui/icons";
import { openModal } from "../ui/modal";
import { showToast } from "../ui/toast";

export function bindLibraryEvents() {
  document
    .querySelector<HTMLButtonElement>("[data-add-text]")
    ?.addEventListener("click", () => openTextDialog());
  document
    .querySelector<HTMLButtonElement>("[data-create-collection]")
    ?.addEventListener("click", () => openCollectionDialog());
  document
    .querySelectorAll<HTMLButtonElement>("[data-expand]")
    .forEach((button) =>
      button.addEventListener("click", () => toggleCollection(button.dataset.expand!)),
    );
  document.querySelectorAll<HTMLElement>("[data-toggle-collection]").forEach((row) =>
    row.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("button")) return;
      toggleCollection(row.dataset.toggleCollection!);
    }),
  );
  document
    .querySelectorAll<HTMLButtonElement>("[data-edit]")
    .forEach((button) =>
      button.addEventListener("click", () => openTextMenu(button.dataset.edit!)),
    );
  document
    .querySelectorAll<HTMLButtonElement>("[data-collection-edit]")
    .forEach((button) =>
      button.addEventListener("click", () => openCollectionMenu(button.dataset.collectionEdit!)),
    );
  document.querySelectorAll<HTMLElement>("[data-text-row]").forEach((row) => {
    row.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", row.dataset.textRow!);
    });
  });
  document.querySelectorAll<HTMLElement>("[data-drop]").forEach((target) => {
    target.addEventListener("dragover", (event) => {
      event.preventDefault();
      target.classList.add("drag-over");
    });
    target.addEventListener("dragleave", () => target.classList.remove("drag-over"));
    target.addEventListener("drop", (event) => {
      event.preventDefault();
      target.classList.remove("drag-over");
      const id = event.dataTransfer?.getData("text/plain");
      if (id) assignToCollection(id, target.dataset.drop!);
    });
  });
}

function toggleCollection(id: string) {
  if (appStore.expandedCollections.has(id)) appStore.expandedCollections.delete(id);
  else appStore.expandedCollections.add(id);
  requestRender();
}

function openTextMenu(id: string) {
  const item = appStore.texts.find((entry) => entry.id === id);
  if (!item) return;
  const collection = assignedCollection(appStore.collections, item);
  const modal = openModal(
    "menu-dialog",
    `<h2>${escapeHtml(item.title)}</h2><button data-menu-edit>Edit text</button><button data-menu-collection>${collection ? "Move to collection…" : "Add to collection…"}</button>${collection ? `<button data-menu-remove-from-collection>Remove from ${escapeHtml(collection.title)}</button>` : ""}<button class="danger" data-menu-remove>Remove text…</button><button class="secondary" data-modal-close>Cancel</button>`,
  );
  modal.querySelector("[data-menu-edit]")!.addEventListener("click", () => {
    modal.close();
    openTextDialog(id);
  });
  modal.querySelector("[data-menu-collection]")!.addEventListener("click", () => {
    modal.close();
    openAssignDialog(id);
  });
  modal.querySelector("[data-menu-remove-from-collection]")?.addEventListener("click", () => {
    modal.close();
    removeTextFromCollection(id);
  });
  modal.querySelector("[data-menu-remove]")!.addEventListener("click", () => {
    modal.close();
    openRemoveDialog(id);
  });
  modal.querySelector("[data-modal-close]")!.addEventListener("click", () => modal.close());
}

function openTextDialog(id?: string) {
  const item = id ? appStore.texts.find((entry) => entry.id === id) : undefined;
  let coverImage = item?.coverImage;
  const modal = openModal(
    "form-dialog",
    `<form id="text-form"><header><div><p class="eyebrow">YOUR LIBRARY</p><h2>${item ? "Edit text" : "Add a text"}</h2></div></header><div class="form-body"><label>Title<input name="title" required maxlength="160" value="${escapeHtml(item?.title ?? "")}" placeholder="A friendly QSO"></label><label>Language<select name="language"><option ${!item?.language ? "selected" : ""} value="">Not specified</option><option ${item?.language === "English" ? "selected" : ""}>English</option><option ${item?.language === "Norwegian" ? "selected" : ""}>Norwegian</option><option ${item?.language === "Swedish" ? "selected" : ""}>Swedish</option><option>Other</option></select></label><label>Labels <span class="quiet">(comma separated)</span><input name="labels" value="${escapeHtml(item?.labels.join(", ") ?? "")}" placeholder="Stories, Practice"></label><label>Collection<select name="collection"><option value="">None · standalone text</option>${appStore.collections.map((collection) => `<option value="${collection.id}" ${item?.collectionId === collection.id ? "selected" : ""}>${escapeHtml(collection.title)}</option>`).join("")}</select></label><div class="cover-edit-row"><div data-text-cover-preview>${coverArtwork(coverImage, item?.id ?? "new-text", true)}</div><div><span class="cover-field-label">Cover picture</span><button type="button" class="secondary compact" data-text-cover>${icon("upload")} Upload picture</button><button type="button" class="text-button" data-text-cover-remove ${coverImage ? "" : "hidden"}>Remove picture</button><input type="file" data-text-cover-file accept="image/*" hidden></div></div><div class="label-with-action"><label for="text-content">Text</label><button type="button" class="secondary compact" data-file>${icon("upload")} Open .txt file</button><input type="file" data-text-file accept=".txt,text/plain" hidden></div><textarea id="text-content" name="content" required spellcheck="false" placeholder="Paste text here…">${escapeHtml(item?.content ?? "")}</textarea></div><footer><button type="button" class="secondary" data-cancel>Cancel</button><button class="primary">${item ? "Save changes" : "Add text"}</button></footer></form>`,
  );
  const fileInput = modal.querySelector<HTMLInputElement>("[data-text-file]")!;
  const coverFile = modal.querySelector<HTMLInputElement>("[data-text-cover-file]")!;
  modal.querySelector("[data-file]")!.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    void (async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const form = modal.querySelector<HTMLFormElement>("#text-form")!;
      (form.elements.namedItem("content") as HTMLTextAreaElement).value = await file.text();
      (form.elements.namedItem("title") as HTMLInputElement).value ||= file.name.replace(
        /\.txt$/i,
        "",
      );
    })();
  });
  modal.querySelector("[data-text-cover]")!.addEventListener("click", () => coverFile.click());
  coverFile.addEventListener("change", () => {
    void (async () => {
      const file = coverFile.files?.[0];
      if (!file) return;
      try {
        coverImage = await encodeCoverImage(file);
        modal.querySelector("[data-text-cover-preview]")!.innerHTML = coverArtwork(
          coverImage,
          item?.id ?? "new-text",
          true,
        );
        modal.querySelector<HTMLButtonElement>("[data-text-cover-remove]")!.hidden = false;
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Could not load that picture.");
      }
    })();
  });
  modal
    .querySelector<HTMLButtonElement>("[data-text-cover-remove]")!
    .addEventListener("click", () => {
      coverImage = undefined;
      modal.querySelector("[data-text-cover-preview]")!.innerHTML = coverArtwork(
        undefined,
        item?.id ?? "new-text",
        true,
      );
      modal.querySelector<HTMLButtonElement>("[data-text-cover-remove]")!.hidden = true;
    });
  modal.querySelector("[data-cancel]")!.addEventListener("click", () => modal.close());
  modal.querySelector<HTMLFormElement>("#text-form")!.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const draft = textDraftFromFormData(form);
    if (!draft) return;
    const validDraft = draft;
    const bodyChanged = !!item && item.content !== validDraft.content;
    if (bodyChanged && appStore.activeTextId === item.id) {
      void (async () => {
        await stopPlayback();
        item.lastPosition = 0;
        resetPlaybackPosition();
        saveDraft();
      })();
      modal.close();
      return;
    }
    saveDraft();

    function saveDraft() {
      if (item) {
        const collectionUnchanged = item.collectionId === validDraft.collectionId;
        if (!collectionUnchanged)
          appStore.collections.forEach(
            (collection) =>
              (collection.itemIds = collection.itemIds.filter((textId) => textId !== item.id)),
          );
        item.title = validDraft.title;
        item.language = validDraft.language;
        item.labels = validDraft.labels;
        // An edited body invalidates the old character offset.
        if (bodyChanged) item.lastPosition = 0;
        item.content = validDraft.content;
        item.collectionId = validDraft.collectionId;
        item.coverImage = coverImage;
        if (validDraft.collectionId && !collectionUnchanged)
          appStore.collections
            .find((collection) => collection.id === validDraft.collectionId)
            ?.itemIds.push(item.id);
      } else {
        const created: TextItem = {
          id: uid(),
          title: validDraft.title,
          author: "",
          language: validDraft.language,
          labels: validDraft.labels,
          content: validDraft.content,
          collectionId: validDraft.collectionId,
          lastPosition: 0,
          coverImage,
        };
        appStore.texts.unshift(created);
        if (created.collectionId) {
          const collection = appStore.collections.find(
            (entry) => entry.id === created.collectionId,
          );
          collection?.itemIds.push(created.id);
        }
      }
      persistLibrary();
      modal.close();
      requestRender();
      showToast(item ? "Text saved" : "Text added to My texts");
    }
  });
}

function openCollectionDialog() {
  const modal = openModal(
    "form-dialog compact-dialog",
    `<form id="collection-form"><header><div><p class="eyebrow">YOUR LIBRARY</p><h2>New collection</h2></div></header><div class="form-body"><label>Collection title<input name="title" required maxlength="120" placeholder="e.g. På ski over Grønland"></label><p class="quiet">Add texts now or later. Collections can stay empty until you are ready.</p></div><footer><button type="button" class="secondary" data-cancel>Cancel</button><button class="primary">Create collection</button></footer></form>`,
  );
  modal.querySelector("[data-cancel]")!.addEventListener("click", () => modal.close());
  modal.querySelector("form")!.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = formValue(new FormData(event.currentTarget as HTMLFormElement), "title").trim();
    if (!title) return;
    appStore.collections.push({ id: uid(), title, itemIds: [] });
    persistLibrary();
    modal.close();
    requestRender();
    showToast("Collection created");
  });
}

function openCollectionMenu(id: string) {
  const collection = appStore.collections.find((entry) => entry.id === id);
  if (!collection) return;
  const modal = openModal(
    "menu-dialog",
    `<h2>${escapeHtml(collection.title)}</h2><button data-edit-collection>Edit collection title</button><button class="danger" data-delete-collection>Remove collection…</button><button class="secondary" data-modal-close>Cancel</button>`,
  );
  modal.querySelector("[data-modal-close]")!.addEventListener("click", () => modal.close());
  modal.querySelector("[data-edit-collection]")!.addEventListener("click", () => {
    modal.close();
    openCollectionEditDialog(id);
  });
  modal.querySelector("[data-delete-collection]")!.addEventListener("click", () => {
    const ok = confirm(`Remove “${collection.title}”? Its texts will remain in your library.`);
    if (!ok) return;
    for (const item of appStore.texts) if (item.collectionId === id) item.collectionId = null;
    appStore.collections = appStore.collections.filter((entry) => entry.id !== id);
    persistLibrary();
    modal.close();
    requestRender();
  });
}

function openCollectionEditDialog(id: string) {
  const collection = appStore.collections.find((entry) => entry.id === id);
  if (!collection) return;
  let coverImage = collection.coverImage;
  const modal = openModal(
    "form-dialog compact-dialog",
    `<form><header><div><p class="eyebrow">YOUR LIBRARY</p><h2>Edit collection</h2></div></header><div class="form-body"><label>Collection title<input name="title" required maxlength="120" value="${escapeHtml(collection.title)}"></label><div class="cover-edit-row"><div data-cover-preview>${coverArtwork(coverImage, collection.id, true)}</div><div><button type="button" class="secondary compact" data-collection-cover>${icon("upload")} Upload picture</button><button type="button" class="text-button" data-collection-cover-remove ${coverImage ? "" : "hidden"}>Remove picture</button><input type="file" data-collection-cover-file accept="image/*" hidden></div></div><p class="quiet">Texts in the collection keep their individual playback positions and practice marks.</p></div><footer><button type="button" class="secondary" data-cancel>Cancel</button><button class="primary">Save changes</button></footer></form>`,
  );
  modal.querySelector("[data-cancel]")!.addEventListener("click", () => modal.close());
  const coverFile = modal.querySelector<HTMLInputElement>("[data-collection-cover-file]")!;
  modal
    .querySelector("[data-collection-cover]")!
    .addEventListener("click", () => coverFile.click());
  coverFile.addEventListener("change", () => {
    void (async () => {
      const file = coverFile.files?.[0];
      if (!file) return;
      try {
        coverImage = await encodeCoverImage(file);
        modal.querySelector("[data-cover-preview]")!.innerHTML = coverArtwork(
          coverImage,
          collection.id,
          true,
        );
        modal.querySelector<HTMLButtonElement>("[data-collection-cover-remove]")!.hidden = false;
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Could not load that picture.");
      }
    })();
  });
  modal
    .querySelector<HTMLButtonElement>("[data-collection-cover-remove]")!
    .addEventListener("click", () => {
      coverImage = undefined;
      modal.querySelector("[data-cover-preview]")!.innerHTML = coverArtwork(
        undefined,
        collection.id,
        true,
      );
      modal.querySelector<HTMLButtonElement>("[data-collection-cover-remove]")!.hidden = true;
    });
  modal.querySelector("form")!.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = formValue(new FormData(event.currentTarget as HTMLFormElement), "title").trim();
    if (!title) return;
    collection.title = title;
    collection.coverImage = coverImage;
    persistLibrary();
    modal.close();
    requestRender();
  });
}

function openAssignDialog(id: string) {
  const item = appStore.texts.find((entry) => entry.id === id);
  if (!item) return;
  const modal = openModal(
    "form-dialog compact-dialog",
    `<form><header><div><p class="eyebrow">YOUR LIBRARY</p><h2>Add to collection</h2></div></header><div class="form-body"><label>Collection<select name="collection">${appStore.collections.map((collection) => `<option value="${collection.id}">${escapeHtml(collection.title)}</option>`).join("")}</select></label>${appStore.collections.length ? "" : `<p class="quiet">Create a collection first.</p>`}</div><footer><button type="button" class="secondary" data-cancel>Cancel</button><button class="primary" ${appStore.collections.length ? "" : "disabled"}>Add text</button></footer></form>`,
  );
  modal.querySelector("[data-cancel]")!.addEventListener("click", () => modal.close());
  modal.querySelector("form")!.addEventListener("submit", (event) => {
    event.preventDefault();
    const collectionId = formValue(
      new FormData(event.currentTarget as HTMLFormElement),
      "collection",
    );
    if (collectionId) assignToCollection(item.id, collectionId);
    modal.close();
  });
}

function assignToCollection(textId: string, collectionId: string) {
  const item = appStore.texts.find((entry) => entry.id === textId);
  const collection = appStore.collections.find((entry) => entry.id === collectionId);
  if (!item || !collection) return;
  for (const old of appStore.collections) old.itemIds = old.itemIds.filter((id) => id !== textId);
  item.collectionId = collectionId;
  collection.itemIds.push(textId);
  appStore.expandedCollections.add(collectionId);
  persistLibrary();
  requestRender();
  showToast(`Added to ${collection.title}`);
}

function removeTextFromCollection(textId: string) {
  const item = appStore.texts.find((entry) => entry.id === textId);
  const collection = appStore.collections.find(
    (entry) => entry.id === item?.collectionId || entry.itemIds.includes(textId),
  );
  if (!item || !collection) return;
  collection.itemIds = collection.itemIds.filter((id) => id !== textId);
  item.collectionId = null;
  if (appStore.playbackQueue?.collectionId === collection.id) {
    const next = removeQueuedText(appStore.playbackQueue, appStore.queueIndex, textId);
    appStore.playbackQueue = next.queue;
    appStore.queueIndex = next.queueIndex;
  }
  persistLibrary();
  requestRender();
  showToast(`Removed from ${collection.title}; the text remains in My texts`);
}

function openRemoveDialog(id: string) {
  const item = appStore.texts.find((entry) => entry.id === id);
  if (!item) return;
  const modal = openModal(
    "form-dialog compact-dialog",
    `<div class="form-body"><h2>Remove text?</h2><p>Remove <strong>${escapeHtml(item.title)}</strong> from your library? Listening history and practice marks will be kept.</p></div><footer><button class="secondary" data-cancel>Cancel</button><button class="danger-button" data-confirm>Remove text</button></footer>`,
  );
  modal.querySelector("[data-cancel]")!.addEventListener("click", () => modal.close());
  modal.querySelector("[data-confirm]")!.addEventListener("click", () => {
    const wasActive = appStore.activeTextId === id;
    if (wasActive) {
      void (async () => {
        await stopPlayback();
        removeItem();
      })();
      modal.close();
      return;
    }
    removeItem();

    function removeItem() {
      if (appStore.playbackQueue) {
        const next = removeQueuedText(appStore.playbackQueue, appStore.queueIndex, id);
        appStore.playbackQueue = next.queue;
        appStore.queueIndex = next.queueIndex;
      }
      appStore.texts = appStore.texts.filter((entry) => entry.id !== id);
      appStore.collections.forEach(
        (collection) => (collection.itemIds = collection.itemIds.filter((textId) => textId !== id)),
      );
      if (wasActive) {
        appStore.activeTextId = appStore.texts[0]?.id ?? "";
        resetPlaybackPosition();
      }
      persistLibrary();
      modal.close();
      requestRender();
    }
  });
}

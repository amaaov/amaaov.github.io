import {
  createEnsembleTrackRow,
  paintRowProgress,
} from "./ensemble-track-row.js";

/**
 * Bind ensemble track list + composition library.
 * Highlights the playing letter and Morse element while layers run.
 */
export function bindEnsemblePanel({
  list,
  addButton,
  playButton,
  stopButton,
  saveButton,
  compositionSelect,
  compositionDelete,
  emptyHint,
  reverbInput,
  compressionInput,
  ensemble,
  compositions,
  seedTrack,
  announce,
}) {
  const rowViews = new Map();
  let activeCompositionId = "";
  let switching = false;

  ensemble.setOnTrackProgress((id, event) => {
    paintRowProgress(rowViews.get(id), event);
  });

  function syncMasterControls(master = ensemble.getMaster()) {
    if (reverbInput) reverbInput.value = String(master.reverb);
    if (compressionInput) compressionInput.value = String(master.compression);
  }

  reverbInput?.addEventListener("input", () => {
    ensemble.setMaster({ reverb: reverbInput.value });
  });
  compressionInput?.addEventListener("input", () => {
    ensemble.setMaster({ compression: compressionInput.value });
  });

  function renderLibrary(items = compositions.list()) {
    if (!compositionSelect) return;
    compositionSelect.replaceChildren(
      Object.assign(document.createElement("option"), {
        value: "",
        textContent: "Working set",
      }),
      ...items.map((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name;
        return option;
      }),
    );
    compositionSelect.value = activeCompositionId;
    if (compositionSelect.value !== activeCompositionId) {
      activeCompositionId = "";
      compositionSelect.value = "";
    }
    if (compositionDelete) compositionDelete.disabled = !activeCompositionId;
  }

  function renderTracks() {
    const tracks = ensemble.list();
    emptyHint.hidden = tracks.length > 0;
    addButton.disabled = tracks.length >= ensemble.maxTracks;
    rowViews.clear();
    list.replaceChildren(
      ...tracks.map((track) => {
        const { row, view } = createEnsembleTrackRow(track, {
          ensemble,
          onRemove(id) {
            ensemble.removeTrack(id);
            renderTracks();
            announce("Track removed");
          },
        });
        rowViews.set(track.id, view);
        return row;
      }),
    );
  }

  function render() {
    renderLibrary();
    renderTracks();
  }

  addButton.addEventListener("click", () => {
    const added = ensemble.addTrack(seedTrack?.() || {});
    if (!added) {
      announce("Ensemble full");
      return;
    }
    renderTracks();
    announce("Track added");
  });

  playButton.addEventListener("click", async () => {
    if (ensemble.list().every((track) => !track.morse.trim())) {
      announce("Nothing to layer");
      return;
    }
    await ensemble.startAll();
    announce("Ensemble playing");
  });

  stopButton.addEventListener("click", () => {
    ensemble.stopAll();
    announce("Ensemble stopped");
  });

  saveButton?.addEventListener("click", () => {
    const snapshot = ensemble.snapshot();
    if (snapshot.tracks.length === 0) {
      announce("Nothing to save");
      return;
    }
    const current = activeCompositionId ? compositions.get(activeCompositionId) : null;
    const suggested = current?.name || compositions.nextDefaultName();
    const entered = globalThis.prompt?.("Composition name", suggested);
    if (entered == null) {
      announce("Save cancelled");
      return;
    }
    const name = String(entered).trim() || suggested;
    const saved = compositions.save({
      id: activeCompositionId || undefined,
      name,
      tracks: snapshot.tracks,
      master: snapshot.master,
    });
    if (!saved) {
      announce("Nothing to save");
      return;
    }
    activeCompositionId = saved.id;
    renderLibrary();
    announce(`Saved ${saved.name}`);
  });

  compositionSelect?.addEventListener("change", async () => {
    if (switching) return;
    const nextId = compositionSelect.value;
    if (!nextId) {
      activeCompositionId = "";
      if (compositionDelete) compositionDelete.disabled = true;
      return;
    }
    const composition = compositions.get(nextId);
    if (!composition) {
      activeCompositionId = "";
      renderLibrary();
      announce("Composition missing");
      return;
    }
    switching = true;
    try {
      await ensemble.replaceTracks(composition.tracks, {
        master: composition.master,
      });
      activeCompositionId = composition.id;
      syncMasterControls();
      renderTracks();
      renderLibrary();
      announce(`Loaded ${composition.name}`);
    } finally {
      switching = false;
    }
  });

  compositionDelete?.addEventListener("click", () => {
    if (!activeCompositionId) return;
    compositions.remove(activeCompositionId);
    activeCompositionId = "";
    renderLibrary();
    announce("Composition deleted");
  });

  compositions?.subscribe?.((items) => {
    renderLibrary(items);
  });

  syncMasterControls();
  render();
  return { render };
}

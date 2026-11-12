import { connectMidi, type MidiStatus } from "../data/midi-client";
import { showToast } from "../ui/toast";
import { markWordRecognized } from "./player-controller";

let midiStarted = false;
let denialShown = false;

/** Start listening for MIDI note presses once, after the app has hydrated. */
export function bindMidiControls() {
  if (midiStarted) return;
  midiStarted = true;
  void connectMidi({
    onNoteOn: () => {
      markWordRecognized();
    },
    onStatus: handleMidiStatus,
  });
}

function handleMidiStatus(status: MidiStatus) {
  if (status !== "denied" || denialShown) return;
  denialShown = true;
  showToast("MIDI access was blocked. Allow MIDI for this site to use the adapter.");
}

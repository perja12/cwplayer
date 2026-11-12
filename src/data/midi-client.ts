export type MidiNoteEvent = {
  note: number;
  velocity: number;
  channel: number;
  inputName: string;
};

export type MidiStatus = "unsupported" | "denied" | "ready";

export type MidiHandlers = {
  onNoteOn?: (event: MidiNoteEvent) => void;
  onStatus?: (status: MidiStatus, deviceNames: string[]) => void;
};

/**
 * Vail Adapter initialization: leave keyboard/HID mode, use a 100 ms dit, and
 * select passthrough so paddle presses arrive as discrete MIDI notes.
 */
const ADAPTER_INIT = [
  [0xb0, 0x00, 0x00],
  [0xb0, 0x01, 0x32],
  [0xc0, 0x00],
] as const;

/** Connect to every MIDI port and report note presses from any input. */
export async function connectMidi(handlers: MidiHandlers): Promise<void> {
  if (!navigator.requestMIDIAccess) {
    handlers.onStatus?.("unsupported", []);
    return;
  }
  let access: MIDIAccess;
  try {
    access = await navigator.requestMIDIAccess();
  } catch {
    handlers.onStatus?.("denied", []);
    return;
  }

  const boundInputs = new WeakSet<MIDIInput>();
  const activeNotes = new Set<string>();

  const handleMessage = (input: MIDIInput, event: MIDIMessageEvent) => {
    const [status = 0, note = 0, velocity = 0] = event.data ?? [];
    const command = status >> 4;
    if (command !== 0x9 && command !== 0x8) return;
    const key = `${input.id}:${note}`;
    if (command === 0x9 && velocity > 0) {
      if (activeNotes.has(key)) return;
      activeNotes.add(key);
      handlers.onNoteOn?.({
        note,
        velocity,
        channel: status & 0x0f,
        inputName: input.name ?? input.id,
      });
      return;
    }
    activeNotes.delete(key);
  };

  const sync = () => {
    const deviceNames: string[] = [];
    for (const input of access.inputs.values()) {
      if (input.state !== "connected") continue;
      deviceNames.push(input.name ?? input.id);
      if (boundInputs.has(input)) continue;
      boundInputs.add(input);
      input.addEventListener("midimessage", (event) => handleMessage(input, event));
    }
    for (const output of access.outputs.values()) {
      if (output.state !== "connected") continue;
      for (const message of ADAPTER_INIT) {
        try {
          output.send([...message]);
        } catch {
          // The device disappeared between the state check and the send.
        }
      }
    }
    handlers.onStatus?.("ready", deviceNames);
  };

  access.addEventListener("statechange", () => {
    activeNotes.clear();
    sync();
  });
  sync();
}

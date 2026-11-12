// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { connectMidi } from "../../src/data/midi-client";

type FakeMidi = {
  access: MIDIAccess;
  inputs: Map<string, MIDIInput>;
  outputs: Map<string, MIDIOutput>;
  sent: number[][];
};

function makeInput(id = "in", name = "Vail Adapter"): MIDIInput {
  const input = new EventTarget() as unknown as MIDIInput;
  Object.assign(input, { id, name, state: "connected", type: "input", connection: "open" });
  return input;
}

function makeOutput(sent: number[][], id = "out"): MIDIOutput {
  const output = new EventTarget() as unknown as MIDIOutput;
  Object.assign(output, {
    id,
    name: "Vail Adapter",
    state: "connected",
    type: "output",
    connection: "open",
    send: (data: number[] | Uint8Array) => sent.push(Array.from(data)),
  });
  return output;
}

function makeMidi(inputs: MIDIInput[] = [], outputIds: string[] = []): FakeMidi {
  const sent: number[][] = [];
  const inputMap = new Map(inputs.map((input) => [input.id, input]));
  const outputMap = new Map(outputIds.map((id) => [id, makeOutput(sent, id)]));
  const access = new EventTarget() as unknown as MIDIAccess;
  Object.assign(access, { inputs: inputMap, outputs: outputMap, sysexEnabled: false });
  return { access, inputs: inputMap, outputs: outputMap, sent };
}

function useMidi(access: MIDIAccess | Error) {
  Object.defineProperty(navigator, "requestMIDIAccess", {
    configurable: true,
    value: vi.fn(() =>
      access instanceof Error ? Promise.reject(access) : Promise.resolve(access),
    ),
  });
}

function send(input: MIDIInput, data: number[]) {
  const event = new Event("midimessage");
  Object.defineProperty(event, "data", { value: new Uint8Array(data) });
  input.dispatchEvent(event);
}

function handlers() {
  return { onNoteOn: vi.fn(), onStatus: vi.fn() };
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "requestMIDIAccess");
});

describe("MIDI client", () => {
  it("reports unsupported when Web MIDI is unavailable", async () => {
    const h = handlers();
    await connectMidi(h);
    expect(h.onStatus).toHaveBeenCalledWith("unsupported", []);
  });

  it("reports denied when MIDI permission fails", async () => {
    useMidi(new Error("denied"));
    const h = handlers();
    await connectMidi(h);
    expect(h.onStatus).toHaveBeenCalledWith("denied", []);
  });

  it("sends the Vail adapter initialization to every output", async () => {
    const midi = makeMidi([makeInput()], ["out", "out-2"]);
    useMidi(midi.access);
    const h = handlers();

    await connectMidi(h);

    expect(midi.sent).toEqual([
      [0xb0, 0x00, 0x00],
      [0xb0, 0x01, 0x32],
      [0xc0, 0x00],
      [0xb0, 0x00, 0x00],
      [0xb0, 0x01, 0x32],
      [0xc0, 0x00],
    ]);
    expect(h.onStatus).toHaveBeenCalledWith("ready", ["Vail Adapter"]);
  });

  it("marks once per note press and ignores note off and held repeats", async () => {
    const input = makeInput();
    const midi = makeMidi([input]);
    useMidi(midi.access);
    const h = handlers();
    await connectMidi(h);

    send(input, [0x90, 0x01, 0x7f]);
    send(input, [0x90, 0x01, 0x7f]);
    send(input, [0x80, 0x01, 0x00]);
    send(input, [0x90, 0x01, 0x7f]);

    expect(h.onNoteOn).toHaveBeenCalledTimes(2);
    expect(h.onNoteOn).toHaveBeenNthCalledWith(1, {
      note: 1,
      velocity: 0x7f,
      channel: 0,
      inputName: "Vail Adapter",
    });
  });

  it("treats note-on with zero velocity as a release", async () => {
    const input = makeInput();
    const midi = makeMidi([input]);
    useMidi(midi.access);
    const h = handlers();
    await connectMidi(h);

    send(input, [0x90, 0x01, 0x00]);
    expect(h.onNoteOn).not.toHaveBeenCalled();

    send(input, [0x90, 0x01, 0x40]);
    expect(h.onNoteOn).toHaveBeenCalledOnce();
  });

  it("accepts any note number and channel", async () => {
    const input = makeInput();
    const midi = makeMidi([input]);
    useMidi(midi.access);
    const h = handlers();
    await connectMidi(h);

    send(input, [0x93, 60, 0x40]);

    expect(h.onNoteOn).toHaveBeenCalledWith({
      note: 60,
      velocity: 0x40,
      channel: 3,
      inputName: "Vail Adapter",
    });
  });

  it("picks up devices connected after startup and re-sends initialization", async () => {
    const midi = makeMidi();
    useMidi(midi.access);
    const h = handlers();
    await connectMidi(h);

    const input = makeInput("late", "Pico MIDI");
    const output = makeOutput(midi.sent, "late-out");
    midi.inputs.set(input.id, input);
    midi.outputs.set(output.id, output);
    midi.access.dispatchEvent(new Event("statechange"));

    expect(h.onStatus).toHaveBeenLastCalledWith("ready", ["Pico MIDI"]);
    expect(midi.sent).toEqual([
      [0xb0, 0x00, 0x00],
      [0xb0, 0x01, 0x32],
      [0xc0, 0x00],
    ]);

    send(input, [0x90, 0x02, 0x7f]);
    expect(h.onNoteOn).toHaveBeenCalledOnce();
  });

  it("does not attach duplicate listeners when the device set changes", async () => {
    const input = makeInput();
    const midi = makeMidi([input]);
    useMidi(midi.access);
    const h = handlers();
    await connectMidi(h);

    midi.access.dispatchEvent(new Event("statechange"));
    midi.access.dispatchEvent(new Event("statechange"));
    send(input, [0x90, 0x01, 0x7f]);

    expect(h.onNoteOn).toHaveBeenCalledOnce();
  });

  it("keeps working when an output disappears before the init send", async () => {
    const midi = makeMidi([makeInput()], ["out"]);
    const output = midi.outputs.get("out")!;
    output.send = () => {
      throw new Error("disconnected");
    };
    useMidi(midi.access);
    const h = handlers();

    await expect(connectMidi(h)).resolves.toBeUndefined();
    expect(h.onStatus).toHaveBeenCalledWith("ready", ["Vail Adapter"]);
  });
});

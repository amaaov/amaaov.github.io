import { isOfflineContext } from "./engines/shared.js";
import { lfoShapeName } from "./mod-params.js";
import { attachVoiceModulation } from "./voice-mod.js";

function makeScale(context, from, amount = 0) {
  const gain = context.createGain();
  gain.gain.value = amount;
  from.connect(gain);
  return gain;
}

/**
 * Persistent LFO bank (3) plus per-voice ENV helpers.
 */
export function createModulatorBank(context) {
  const tremolo = context.createGain();
  tremolo.gain.value = 1;

  const lfos = [0, 1, 2].map(() => {
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 1;
    const raw = context.createGain();
    raw.gain.value = 1;
    osc.connect(raw);
    osc.start();
    return {
      osc,
      scales: {
        pitch: makeScale(context, raw, 0),
        filter: makeScale(context, raw, 0),
        amp: makeScale(context, raw, 0),
        delay: makeScale(context, raw, 0),
        res: makeScale(context, raw, 0),
        drive: makeScale(context, raw, 0),
      },
    };
  });

  const buses = {
    pitch: context.createGain(),
    filter: context.createGain(),
    amp: context.createGain(),
    delay: context.createGain(),
    res: context.createGain(),
    drive: context.createGain(),
  };
  for (const bus of Object.values(buses)) bus.gain.value = 1;
  for (const lfo of lfos) {
    lfo.scales.pitch.connect(buses.pitch);
    lfo.scales.filter.connect(buses.filter);
    lfo.scales.amp.connect(buses.amp);
    lfo.scales.delay.connect(buses.delay);
    lfo.scales.res.connect(buses.res);
    lfo.scales.drive.connect(buses.drive);
  }

  let chainNodes = null;

  return {
    tremolo,
    set(params = {}) {
      const now = context.currentTime;
      const filterHz = params.filterHz ?? 3200;
      const pitchHz = (params.frequency ?? 700) * 0.08;
      const rows = [
        {
          rate: params.lfo1Rate,
          shape: params.lfo1Shape,
          pitch: params.lfo1ToPitch,
          filter: params.lfo1ToFilter,
          amp: params.lfo1ToAmp,
        },
        {
          rate: params.lfo2Rate,
          shape: params.lfo2Shape,
          filter: params.lfo2ToFilter,
          delay: params.lfo2ToDelay,
          res: params.lfo2ToRes,
        },
        {
          rate: params.lfo3Rate,
          shape: params.lfo3Shape,
          pitch: params.lfo3ToPitch,
          drive: params.lfo3ToDrive,
          amp: params.lfo3ToAmp,
        },
      ];
      rows.forEach((row, index) => {
        const lfo = lfos[index];
        if (row.rate != null) {
          lfo.osc.frequency.setTargetAtTime(Math.max(0.05, row.rate), now, 0.02);
        }
        if (row.shape != null) lfo.osc.type = lfoShapeName(row.shape);
        if (row.pitch != null) {
          lfo.scales.pitch.gain.setTargetAtTime(row.pitch * pitchHz, now, 0.02);
        }
        if (row.filter != null) {
          lfo.scales.filter.gain.setTargetAtTime(row.filter * filterHz * 0.45, now, 0.02);
        }
        if (row.amp != null) {
          lfo.scales.amp.gain.setTargetAtTime(row.amp * 0.45, now, 0.02);
        }
        if (row.delay != null) {
          lfo.scales.delay.gain.setTargetAtTime(row.delay * 0.12, now, 0.02);
        }
        if (row.res != null) {
          lfo.scales.res.gain.setTargetAtTime(row.res * 8, now, 0.02);
        }
        if (row.drive != null) {
          lfo.scales.drive.gain.setTargetAtTime(row.drive * 0.35, now, 0.02);
        }
      });
    },
    wireChain(nodes) {
      chainNodes = nodes;
      buses.filter.connect(nodes.filter.frequency);
      buses.res.connect(nodes.filter.Q);
      // LFO into DelayNode.delayTime + feedback can hang OfflineAudioContext.
      if (!isOfflineContext(context)) {
        buses.delay.connect(nodes.delay.delayTime);
      }
      buses.drive.connect(nodes.wet.gain);
      buses.amp.connect(tremolo.gain);
    },
    attachVoice(voice, params = {}) {
      attachVoiceModulation(context, { buses, chainNodes }, voice, params);
    },
  };
}

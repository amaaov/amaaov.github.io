import { parsePassingSiteswap, passingObjectCount } from "./passing_notation.js";
import {
  destinationBody,
  destinationContact,
  globalContact,
} from "./passing_route.js";

function landingKey(landing) {
  return JSON.stringify(landing);
}

function rotateCycleToStartingHands(cycleTosses, cycleLength, startingHands) {
  for (let offset = 0; offset < cycleLength; offset += 1) {
    const packet = cycleTosses.filter((event) => event.beat === offset);
    const aligned = startingHands.every((contact, body) => {
      const event = packet.find((toss) => toss.fromBody === body);
      return event !== undefined && event.fromContact === contact;
    });
    if (!aligned) {
      continue;
    }
    return cycleTosses.map((event) => {
      return { ...event, beat: (event.beat - offset + cycleLength) % cycleLength };
    }).sort((left, right) => {
      return left.beat - right.beat || left.fromHand - right.fromHand;
    });
  }
  return cycleTosses.slice();
}

function passingHighest(pattern) {
  return pattern.throws.reduce((highest, sequence) => {
    return Math.max(highest, sequence.reduce((beatHighest, multiplex) => {
      return Math.max(beatHighest, multiplex.reduce((tokenHighest, token) => {
        return Math.max(tokenHighest, token.height);
      }, 0));
    }, 0));
  }, 0);
}

function advanceHands(landing) {
  const available = landing.map((queue) => queue.shift());
  landing.forEach((queue) => queue.push([]));
  return available;
}

function tossFromContact(
  tokens,
  landing,
  available,
  intro,
  body,
  contact,
  bodyCount,
  beat,
  holdTwos,
  record,
) {
  const events = [];
  const fromHand = globalContact(body, contact);
  tokens.forEach((token, socketIndex) => {
    if (token.height === 0) {
      if (available[fromHand].length > 0) {
        throw new Error(`prop landing on 0 toss at beat ${beat}`);
      }
      if (record) {
        events.push({
          beat,
          height: 0,
          ball: null,
          fromBody: body,
          fromContact: contact,
          fromHand,
          toBody: body,
          toContact: contact,
          toHand: fromHand,
          hold: false,
          pass: false,
          socketIndex,
          kind: "empty",
        });
      }
      return;
    }
    let ball = available[fromHand].shift();
    if (ball === undefined) {
      ball = intro.shift();
    }
    if (ball === undefined) {
      throw new Error(`no prop available at beat ${beat}`);
    }
    const toBody = destinationBody(token, body, bodyCount);
    const toContact = destinationContact(token, contact);
    const toHand = globalContact(toBody, toContact);
    const hold = Boolean(holdTwos) && token.height === 2 && fromHand === toHand;
    if (record) {
      events.push({
        beat,
        height: token.height,
        ball,
        fromBody: body,
        fromContact: contact,
        fromHand,
        toBody,
        toContact,
        toHand,
        hold,
        pass: toBody !== body,
        socketIndex,
        kind: hold ? "hold" : "throw",
      });
    }
    landing[toHand][token.height - 1].push(ball);
  });
  return events;
}

export function schedulePassingEvents(source, holdTwos = true, untilBeat = 64) {
  const pattern = parsePassingSiteswap(source);
  const ballCount = passingObjectCount(pattern);
  if (!Number.isInteger(ballCount) || ballCount < 1) {
    throw new Error("passing object count must be a positive integer");
  }
  const highest = passingHighest(pattern);
  const period = pattern.throws[0].length;
  const handCount = pattern.bodyCount * 2;
  const depth = Math.max(highest, 1);
  const landing = Array.from({ length: handCount }, () => {
    return Array.from({ length: depth }, () => []);
  });
  const intro = Array.from({ length: ballCount }, (_, id) => id);
  const cycleTosses = [];
  let initComplete = false;
  let beat = 0;
  const throwContacts = pattern.startingHands.slice();
  let startKey = null;
  let cycleLength = 0;

  for (let step = 0; step < 2000; step += 1) {
    const available = advanceHands(landing);
    const recorded = [];
    for (let body = 0; body < pattern.bodyCount; body += 1) {
      const contact = throwContacts[body];
      const tokens = pattern.throws[body][beat % period];
      recorded.push(...tossFromContact(
        tokens,
        landing,
        available,
        intro,
        body,
        contact,
        pattern.bodyCount,
        beat,
        holdTwos,
        initComplete,
      ));
    }
    if (available.some((queue) => queue.length > 0)) {
      throw new Error(`prop landing with no toss at beat ${beat}`);
    }
    cycleTosses.push(...recorded);

    if (initComplete) {
      if (startKey === null) {
        startKey = landingKey(landing);
      } else if (beat > 0 && beat % period === 0 && landingKey(landing) === startKey) {
        while (cycleTosses.length > 0 && cycleTosses[cycleTosses.length - 1].beat === beat) {
          cycleTosses.pop();
        }
        cycleLength = beat;
        break;
      }
    } else if (intro.length === 0 && (beat + 1) % period === 0) {
      initComplete = true;
      beat = -1;
    }

    beat += 1;
    for (let body = 0; body < pattern.bodyCount; body += 1) {
      throwContacts[body] = 1 - throwContacts[body];
    }
  }

  if (cycleLength === 0) {
    throw new Error("pattern did not repeat");
  }

  const cycleTossesAtOrigin = rotateCycleToStartingHands(
    cycleTosses,
    cycleLength,
    pattern.startingHands,
  );

  const events = [];
  const earliest = -Math.max(highest, 8);
  const copies = Math.ceil(untilBeat / cycleLength) + 4;
  for (const toss of cycleTossesAtOrigin) {
    for (let copy = -4; copy <= copies; copy += 1) {
      const absolute = toss.beat + copy * cycleLength;
      if (absolute < earliest || absolute > untilBeat) {
        continue;
      }
      events.push({ ...toss, beat: absolute });
    }
  }
  return {
    pattern,
    ballCount,
    highest,
    events,
    cycleTosses: cycleTossesAtOrigin,
    cycleLength,
    period,
    handCount,
    bodyCount: pattern.bodyCount,
  };
}

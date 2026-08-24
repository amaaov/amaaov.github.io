export const FORMAL_LAW_COPY = {
  en: {
    numberLocale: "en-US",
    title: "Exact-law workbench",
    intro: "Move one parameter at a time. Each curve follows from its displayed phase, independent-snapshot, or one-bit null law.",
    phaseTitle: "Two-object phase",
    phaseScope: "Both objects use the same retention duty; the curve varies the shortest circular phase.",
    duty: "retention duty d",
    phase: "short phase φ",
    bernoulliTitle: "Independent snapshot",
    bernoulliScope: "At one sampled instant, the objects’ retention indicators are mutually independent and share probability ρ.",
    objects: "objects n",
    probability: "retention probability ρ",
    passageTitle: "One-bit first passage",
    passageScope: "One uniformly selected bit flips per event; counting stops when q reaches 0 or n. Two hands stand for one person's sites. In passing, q is the group's occupancy.",
    jugglers: "jugglers j",
    held: "held objects q",
    hands: "hands 2j",
    heldPerPerson: "held per person q/j",
    alphaShare: "P(α)",
    polymorphyShare: "P(ακ)",
    kappaShare: "P(κ)",
    alphaBouts: "α bouts per period",
    expectedEvents: "expected events E_q",
    share: "share",
    events: "events",
    legend: "Curve legend",
    phaseObservation: ({
      nextPhase,
      alphaChange,
      polymorphyChange,
      kappaChange,
      sharePlateau,
      boutCountChanged,
      bouts,
      nextBouts,
    }) => {
      if (sharePlateau && boutCountChanged) {
        return `A phase move to ${nextPhase} leaves all three shares unchanged while alpha bouts move from ${bouts} to ${nextBouts}. Equal percentages can hide a changed path.`;
      }
      if (sharePlateau) {
        return `A phase move to ${nextPhase} leaves all three shares and the ${bouts}-bout alpha path unchanged. This interval is a share plateau.`;
      }
      return `A phase move to ${nextPhase} changes P(α), P(ακ), and P(κ) by ${alphaChange}, ${polymorphyChange}, and ${kappaChange} percentage points.`;
    },
    bernoulliObservation: ({
      objects,
      polymorphyChange,
      previousHomogeneous,
      homogeneous,
    }) =>
      `Adding object ${objects} changes P(ακ) by ${polymorphyChange} percentage points; the total homogeneous share moves from ${previousHomogeneous}% to ${homogeneous}%.`,
    passageOccupancy: ({ jugglers, hands, multiplexHold, passing }) => {
      if (multiplexHold) {
        return "Two sites on one person share the held count as a multiplex.";
      }
      if (!passing) {
        return "Two hands stand for one person's sites.";
      }
      return `${jugglers} jugglers give ${hands} hands; q is the passing group's occupancy.`;
    },
    passageObservation: ({
      objects,
      held,
      previousExpectation,
      expectation,
      percentageIncrease,
      firstThousandObjects,
      crossedThousand,
      occupancy,
    }) => {
      const lead = occupancy ? `${occupancy} ` : "";
      if (previousExpectation === null) {
        return `${lead}At the central start q=${held}, the expectation is ${expectation} event.`;
      }
      const crossing = crossedThousand
        ? " This is the first central case above one thousand events."
        : ` The central expectation first exceeds one thousand at n=${firstThousandObjects}.`;
      return `${lead}At central q=${held}, adding object ${objects} moves the expectation from ${previousExpectation} to ${expectation} events (${percentageIncrease}%).${crossing}`;
    },
    phaseDescription: ({ duty, phase, alpha, polymorphy, kappa, bouts }) =>
      `At duty ${duty} and phase ${phase}, the shares are ${alpha}, ${polymorphy}, and ${kappa}; alpha has ${bouts} bouts per period.`,
    bernoulliDescription: ({ objects, probability, alpha, polymorphy, kappa }) =>
      `For ${objects} objects at retention probability ${probability}, the independent-snapshot shares are ${alpha}, ${polymorphy}, and ${kappa}.`,
    passageDescription: ({ objects, held, expectation }) =>
      `For ${objects} objects starting with ${held} held, the expected first passage to zero or ${objects} held is ${expectation} one-bit events.`,
  },
  ru: {
    numberLocale: "ru-RU",
    title: "Лаборатория точных законов",
    intro: "Меняйте по одному параметру. Каждая кривая следует из показанного закона фазы, независимого кадра или нулевого процесса с заменой одного бита.",
    phaseTitle: "Фаза двух предметов",
    phaseScope: "У обоих предметов одна доля удержания; кривая меняет кратчайший круговой сдвиг.",
    duty: "доля удержания d",
    phase: "кратчайшая фаза φ",
    bernoulliTitle: "Независимый кадр",
    bernoulliScope: "В один выбранный момент признаки удержания предметов взаимно независимы и имеют общую вероятность ρ.",
    objects: "число предметов n",
    probability: "вероятность удержания ρ",
    passageTitle: "Первое достижение границы",
    passageScope: "При каждом событии один из битов выбирается равновероятно и меняет значение; отсчёт заканчивается при q, равном 0 или n. Две руки — места удержания одного человека. В пассинге q — удержание группы.",
    jugglers: "жонглёры j",
    held: "удерживается q",
    hands: "руки 2j",
    heldPerPerson: "удержание на человека q/j",
    alphaShare: "P(α)",
    polymorphyShare: "P(ακ)",
    kappaShare: "P(κ)",
    alphaBouts: "эпизоды α за период",
    expectedEvents: "ожидаемые события E_q",
    share: "доля",
    events: "события",
    legend: "Обозначения кривых",
    phaseObservation: ({
      nextPhase,
      alphaChange,
      polymorphyChange,
      kappaChange,
      sharePlateau,
      boutCountChanged,
      bouts,
      nextBouts,
    }) => {
      if (sharePlateau && boutCountChanged) {
        return `Сдвиг фазы до ${nextPhase} не меняет три доли, однако число эпизодов альфа меняется с ${bouts} до ${nextBouts}. Одинаковые проценты могут скрывать другой путь.`;
      }
      if (sharePlateau) {
        return `Сдвиг фазы до ${nextPhase} не меняет три доли и путь альфа с числом эпизодов ${bouts}. Этот интервал лежит на плато долей.`;
      }
      return `Сдвиг фазы до ${nextPhase} меняет P(α), P(ακ) и P(κ) на ${alphaChange}, ${polymorphyChange} и ${kappaChange} процентного пункта.`;
    },
    bernoulliObservation: ({
      objects,
      polymorphyChange,
      previousHomogeneous,
      homogeneous,
    }) =>
      `Добавление предмета ${objects} меняет P(ακ) на ${polymorphyChange} процентного пункта; суммарная доля однородных состояний переходит с ${previousHomogeneous}% к ${homogeneous}%.`,
    passageOccupancy: ({ jugglers, hands, multiplexHold, passing }) => {
      if (multiplexHold) {
        return "Два места на одном человеке делят удержание как мультиплекс.";
      }
      if (!passing) {
        return "Две руки — места удержания одного человека.";
      }
      return `При ${jugglers} жонглёрах рук ${hands}; q — удержание группы в пассинге.`;
    },
    passageObservation: ({
      objects,
      held,
      previousExpectation,
      expectation,
      percentageIncrease,
      firstThousandObjects,
      crossedThousand,
      occupancy,
    }) => {
      const lead = occupancy ? `${occupancy} ` : "";
      if (previousExpectation === null) {
        return `${lead}При центральном старте q=${held} ожидание равно ${expectation} событию.`;
      }
      const crossing = crossedThousand
        ? " Это первый центральный случай выше тысячи событий."
        : ` Центральное ожидание впервые превышает тысячу при n=${firstThousandObjects}.`;
      return `${lead}При центральном q=${held} добавление предмета ${objects} меняет ожидание с ${previousExpectation} до ${expectation} событий (${percentageIncrease}%).${crossing}`;
    },
    phaseDescription: ({ duty, phase, alpha, polymorphy, kappa, bouts }) =>
      `При доле удержания ${duty} и фазе ${phase} доли равны ${alpha}, ${polymorphy} и ${kappa}; число эпизодов альфа за период равно ${bouts}.`,
    bernoulliDescription: ({ objects, probability, alpha, polymorphy, kappa }) =>
      `Для ${objects} предметов при вероятности удержания ${probability} доли независимого кадра равны ${alpha}, ${polymorphy} и ${kappa}.`,
    passageDescription: ({ objects, held, expectation }) =>
      `Для ${objects} предметов при начальном q=${held} математическое ожидание числа событий до первого достижения 0 или ${objects} равно ${expectation}.`,
  },
};

export function formalLawLocale(language) {
  return String(language).toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function formalLawNumberFormatter(copy, maximumFractionDigits = 6) {
  const numberFormat = new Intl.NumberFormat(copy.numberLocale, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
  return (value) => numberFormat.format(value);
}

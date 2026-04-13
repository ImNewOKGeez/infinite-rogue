const SAVE_KEY = 'infinite_rogue_save';

const DEFAULT_PERSONAL_BEST = {
  bestTime: 0,
  mostKills: 0,
  highestLevel: 0,
  totalRuns: 0,
};

const DEFAULT_SAVE = {
  personalBests: {
    global: { ...DEFAULT_PERSONAL_BEST },
    perCharacter: {
      ghost: { ...DEFAULT_PERSONAL_BEST },
      bruiser: { ...DEFAULT_PERSONAL_BEST },
      hacker: { ...DEFAULT_PERSONAL_BEST },
    },
  },
  discoveries: {
    synergyIds: [],
  },
};

export const SYNERGIES = [
  {
    id: 'cryo_pulse',
    label: 'CRYO + PULSE',
    description: 'Frozen enemies take 3.5x Pulse damage',
    colours: ['#00CFFF', '#FFB627'],
  },
  {
    id: 'cryo_emp',
    label: 'CRYO + EMP',
    description: 'EMP detonates frozen enemies with amplified force',
    colours: ['#00CFFF', '#BF77FF'],
  },
  {
    id: 'swarm_freeze',
    label: 'SWARM + CRYO',
    description: 'Drones deal bonus damage to frozen targets',
    colours: ['#1DFFD0', '#00CFFF'],
  },
];

let currentSave = cloneDefaultSave();

function cloneDefaultSave() {
  return {
    personalBests: {
      global: { ...DEFAULT_PERSONAL_BEST },
      perCharacter: {
        ghost: { ...DEFAULT_PERSONAL_BEST },
        bruiser: { ...DEFAULT_PERSONAL_BEST },
        hacker: { ...DEFAULT_PERSONAL_BEST },
      },
    },
    discoveries: {
      synergyIds: [],
    },
  };
}

function mergeSave(raw = {}) {
  const merged = cloneDefaultSave();
  const rawGlobal = raw?.personalBests?.global || {};
  const rawPerCharacter = raw?.personalBests?.perCharacter || {};

  Object.keys(DEFAULT_PERSONAL_BEST).forEach(key => {
    merged.personalBests.global[key] = safeNumber(rawGlobal[key]);
  });

  Object.keys(merged.personalBests.perCharacter).forEach(characterId => {
    const source = rawPerCharacter?.[characterId] || {};
    Object.keys(DEFAULT_PERSONAL_BEST).forEach(key => {
      merged.personalBests.perCharacter[characterId][key] = safeNumber(source[key]);
    });
  });

  if (Array.isArray(raw?.discoveries?.synergyIds)) {
    const knownIds = new Set(SYNERGIES.map(s => s.id));
    merged.discoveries.synergyIds = raw.discoveries.synergyIds
      .filter(id => typeof id === 'string' && knownIds.has(id));
  }

  return merged;
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

export function loadSave() {
  let parsed = null;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    parsed = raw ? JSON.parse(raw) : null;
  } catch (_err) {
    parsed = null;
  }
  currentSave = mergeSave(parsed || DEFAULT_SAVE);
  return currentSave;
}

export function writeSave(save) {
  currentSave = mergeSave(save);
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(currentSave));
  } catch (_err) {}
}

export function getSave() {
  return currentSave;
}

export function recordRun(characterId, stats) {
  const save = getSave();
  const globalBests = save.personalBests.global;
  const charBests = save.personalBests.perCharacter[characterId];
  const nextStats = {
    time: safeNumber(stats?.time),
    kills: safeNumber(stats?.kills),
    level: safeNumber(stats?.level),
  };
  const newGlobalBests = [];
  const newCharBests = [];

  updateBest(globalBests, 'bestTime', nextStats.time, newGlobalBests);
  updateBest(globalBests, 'mostKills', nextStats.kills, newGlobalBests);
  updateBest(globalBests, 'highestLevel', nextStats.level, newGlobalBests);
  globalBests.totalRuns += 1;

  if (charBests) {
    updateBest(charBests, 'bestTime', nextStats.time, newCharBests);
    updateBest(charBests, 'mostKills', nextStats.kills, newCharBests);
    updateBest(charBests, 'highestLevel', nextStats.level, newCharBests);
    charBests.totalRuns += 1;
  }

  writeSave(save);
  return { newGlobalBests, newCharBests };
}

function updateBest(bucket, field, value, changed) {
  if (value > (bucket[field] || 0)) {
    bucket[field] = value;
    changed.push(field);
  }
}

export function isDiscovered(synergyId) {
  return getSave().discoveries.synergyIds.includes(synergyId);
}

export function recordDiscovery(synergyId) {
  if (!synergyId || isDiscovered(synergyId)) return false;
  const save = getSave();
  save.discoveries.synergyIds.push(synergyId);
  writeSave(save);
  return true;
}

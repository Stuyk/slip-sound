// category-dictionary.ts
//
// Hierarchical category/subcategory dictionary for the sound-library classifier.
// Each entry maps to a top-level Category and an optional Subcategory, so
// browsing UIs can offer both broad filter pills (Weapons) and fine-grained
// facets (Weapons > Firearms > Shotgun).
//
// - `keywords`: single-token stems/synonyms, matched after tokenization.
// - `phrases`: multi-word terms matched against the raw (lowercased) string
//   BEFORE tokenization. Phrase matches are more specific, so they carry a
//   higher base weight than single-token keyword matches.

export interface CategoryDefinition {
  category: string;
  subcategory?: string;
  keywords: string[];
  phrases?: string[];
}

export const CATEGORY_DICTIONARY: CategoryDefinition[] = [

  // ============================================================
  // WEAPONS — split into subcategories because "weapon" sounds
  // are the single densest, most ambiguous bucket in most SFX
  // libraries. Includes specific real-world and genre-fiction
  // model names since sound designers name files after them.
  // ============================================================
  {
    category: 'Weapons',
    subcategory: 'Firearms',
    keywords: [
      'gun', 'guns', 'firearm', 'gunshot', 'gunfire', 'shoot', 'shooting',
      'rifle', 'carbine', 'pistol', 'handgun', 'revolver', 'shotgun',
      'smg', 'submachinegun', 'machinegun', 'minigun', 'sniper', 'magnum',
      'deagle', 'glock', 'beretta', 'uzi', 'ak47', 'ak', 'akm', 'm16',
      'm4', 'm4a1', 'm249', 'mp5', 'colt', 'luger', 'mauser', 'tommygun',
      'thompson', 'derringer', 'flintlock', 'musket', 'blunderbuss',
      'bullet', 'bullets', 'slug', 'buckshot', 'casing', 'shellcasing',
      'brass', 'cartridge', 'reload', 'reloading', 'chamber', 'chambering',
      'cock', 'cocking', 'trigger', 'safety', 'silencer', 'suppressor',
      'muzzle', 'muzzleflash', 'recoil', 'ricochet', 'clip', 'magazine',
      'mag', 'ammo', 'ammunition', 'burst', 'automatic', 'semiauto',
      'fullauto', 'pump', 'racking', 'crossbow' // crossbow intentionally
    ],
    phrases: [
      'assault rifle', 'sniper rifle', 'sawed off', 'sawed-off shotgun',
      'pump shotgun', 'desert eagle', 'grenade launcher', 'shell casing',
      'muzzle flash', 'ak 47', 'ak-47', 'm 4', 'tommy gun', '1911',
      'full auto', 'semi auto', 'dry fire', 'gun cock'
    ]
  },
  {
    category: 'Weapons',
    subcategory: 'Melee',
    keywords: [
      'sword', 'blade', 'katana', 'sabre', 'saber', 'rapier', 'longsword',
      'broadsword', 'cutlass', 'scimitar', 'dagger', 'knife', 'shiv',
      'machete', 'axe', 'hatchet', 'tomahawk', 'mace', 'morningstar',
      'flail', 'warhammer', 'club', 'cudgel', 'baton', 'nightstick',
      'spear', 'lance', 'pike', 'halberd', 'staff', 'quarterstaff',
      'whip', 'nunchaku', 'nunchucks', 'claws', 'talons', 'slash',
      'slashing', 'stab', 'stabbing', 'parry', 'clang', 'unsheathe',
      'unsheath', 'sheathe', 'scabbard', 'swing', 'chop'
    ],
    phrases: [
      'sword swing', 'sword clash', 'knife stab', 'blade unsheathe',
      'battle axe', 'war hammer'
    ]
  },
  {
    category: 'Weapons',
    subcategory: 'Ranged',
    keywords: [
      'bow', 'longbow', 'crossbow', 'arrow', 'quiver', 'sling',
      'slingshot', 'javelin', 'harpoon', 'boomerang', 'dart', 'shuriken',
      'ninjastar', 'throwingknife'
    ],
    phrases: ['bow draw', 'bow release', 'arrow fly', 'throwing knife']
  },
  {
    category: 'Weapons',
    subcategory: 'SciFi',
    keywords: [
      'laser', 'blaster', 'phaser', 'plasma', 'raygun', 'disruptor',
      'railgun', 'ioncannon', 'particlebeam', 'pulserifle', 'chargeshot',
      'overcharge', 'zap', 'zapper', 'stun', 'stungun', 'taser'
    ],
    phrases: [
      'ray gun', 'ion cannon', 'plasma rifle', 'particle beam',
      'pulse rifle', 'charge shot', 'energy weapon', 'powering up'
    ]
  },
  {
    category: 'Weapons',
    subcategory: 'Explosive Ordnance',
    keywords: [
      'grenade', 'flashbang', 'rpg', 'bazooka', 'missile', 'warhead',
      'tnt', 'dynamite', 'landmine', 'claymore', 'bomb', 'detonator',
      'fuse', 'nuke', 'nuclear', 'rocket', 'artillery', 'howitzer',
      'mortar', 'flamethrower', 'napalm'
    ],
    phrases: [
      'frag grenade', 'smoke grenade', 'rocket launcher', 'land mine',
      'plastic explosive', 'grenade pin'
    ]
  },

  // ============================================================
  // EXPLOSIONS — the result/aftermath, distinct from the ordnance
  // itself so "grenade" and "explosion" can both be tagged when a
  // filename mentions both.
  // ============================================================
  {
    category: 'Explosions',
    keywords: [
      'explosion', 'explosions', 'explode', 'exploding', 'blast',
      'detonate', 'detonation', 'boom', 'burst', 'shatter', 'shattering',
      'debris', 'rumble', 'fireball', 'shockwave', 'combustion'
    ],
    phrases: ['big explosion', 'distant explosion', 'chain explosion']
  },

  // ============================================================
  // IMPACTS — subdivided by surface material, since "impact" alone
  // is too generic to be a useful facet at 70k files.
  // ============================================================
  {
    category: 'Impacts',
    subcategory: 'Blunt/Body',
    keywords: [
      'impact', 'hit', 'hits', 'thud', 'smash', 'crash', 'strike',
      'slam', 'bonk', 'punch', 'kick', 'blow', 'whack', 'thump'
    ]
  },
  {
    category: 'Impacts',
    subcategory: 'Metal',
    keywords: ['clank', 'clang', 'metallic', 'ting', 'ding', 'clunk']
  },
  {
    category: 'Impacts',
    subcategory: 'Wood',
    keywords: ['knock', 'tap', 'thwack', 'crack', 'snap']
  },
  {
    category: 'Impacts',
    subcategory: 'Glass',
    keywords: ['shatter', 'glassbreak', 'crash', 'crackle', 'tinkle']
  },

  // ============================================================
  // FOLEY
  // ============================================================
  {
    category: 'Foley',
    subcategory: 'Footsteps',
    keywords: [
      'step', 'steps', 'footstep', 'footsteps', 'walk', 'walking', 'run',
      'running', 'jog', 'sprint', 'jump', 'jumping', 'land', 'landing',
      'tiptoe', 'stomp', 'stomping', 'shuffle'
    ]
  },
  {
    category: 'Foley',
    subcategory: 'Cloth & Movement',
    keywords: [
      'cloth', 'clothing', 'rustle', 'rustling', 'fabric', 'swish',
      'grab', 'drop', 'pickup', 'zip', 'zipper', 'velcro', 'button',
      'buckle'
    ]
  },
  {
    category: 'Foley',
    subcategory: 'Body',
    keywords: [
      'flesh', 'body', 'punch', 'kick', 'grunt', 'breath', 'breathing',
      'heartbeat', 'gulp', 'swallow'
    ]
  },

  // ============================================================
  // VEHICLES
  // ============================================================
  {
    category: 'Vehicles',
    subcategory: 'Cars',
    keywords: [
      'car', 'cars', 'engine', 'motor', 'idle', 'rev', 'revving',
      'exhaust', 'tire', 'tires', 'skid', 'skidding', 'brake',
      'braking', 'honk', 'horn', 'ignition', 'gearshift', 'turbo'
    ]
  },
  {
    category: 'Vehicles',
    subcategory: 'Aircraft',
    keywords: [
      'plane', 'airplane', 'jet', 'helicopter', 'chopper', 'propeller',
      'rotor', 'cockpit', 'takeoff', 'landing', 'turbine'
    ]
  },
  {
    category: 'Vehicles',
    subcategory: 'Rail',
    keywords: ['train', 'locomotive', 'railway', 'railroad', 'subway', 'tram']
  },
  {
    category: 'Vehicles',
    subcategory: 'Watercraft',
    keywords: ['boat', 'ship', 'submarine', 'motorboat', 'sail', 'anchor']
  },
  {
    category: 'Vehicles',
    subcategory: 'Motorcycles',
    keywords: ['motorcycle', 'motorbike', 'moped', 'scooter', 'throttle']
  },

  // ============================================================
  // UI
  // ============================================================
  {
    category: 'UI',
    keywords: [
      'click', 'clicking', 'button', 'beep', 'menu', 'select',
      'selection', 'confirm', 'cancel', 'popup', 'hover', 'toggle',
      'chime', 'notification', 'interface', 'swipe', 'tap', 'error',
      'success', 'unlock', 'lock', 'levelup', 'achievement', 'coin',
      'score', 'points'
    ],
    phrases: ['level up', 'button click', 'error sound']
  },

  // ============================================================
  // AMBIENCE
  // ============================================================
  {
    category: 'Ambience',
    subcategory: 'Nature',
    keywords: [
      'forest', 'cricket', 'crickets', 'birds', 'birdsong', 'jungle',
      'stream', 'river', 'ocean', 'waves', 'leaves', 'wind', 'foliage'
    ]
  },
  {
    category: 'Ambience',
    subcategory: 'Weather',
    keywords: [
      'rain', 'raining', 'storm', 'thunder', 'thunderstorm', 'lightning',
      'snow', 'blizzard', 'weather', 'hail'
    ]
  },
  {
    category: 'Ambience',
    subcategory: 'Urban',
    keywords: [
      'crowd', 'city', 'traffic', 'street', 'market', 'cafe',
      'restaurant', 'office', 'construction'
    ]
  },
  {
    category: 'Ambience',
    subcategory: 'Interior',
    keywords: ['roomtone', 'room', 'hum', 'drone', 'buzz', 'hvac', 'fan']
  },

  // ============================================================
  // MAGIC
  // ============================================================
  {
    category: 'Magic',
    subcategory: 'Spells',
    keywords: [
      'spell', 'casting', 'cast', 'sparkle', 'magic', 'magical',
      'teleport', 'teleportation', 'aura', 'mana', 'summon', 'summoning',
      'enchant', 'enchantment', 'curse', 'hex', 'chant', 'incantation'
    ]
  },
  {
    category: 'Magic',
    subcategory: 'Elemental',
    keywords: [
      'fireball', 'firebolt', 'iceblast', 'frostbolt', 'lightningbolt',
      'shockspell', 'elemental', 'earthquake', 'windgust'
    ]
  },

  // ============================================================
  // CREATURES / MONSTERS
  // ============================================================
  {
    category: 'Creatures',
    keywords: [
      'monster', 'creature', 'roar', 'growl', 'snarl', 'hiss', 'howl',
      'dragon', 'zombie', 'ghoul', 'demon', 'goblin', 'troll', 'werewolf',
      'vampire', 'alien', 'beast', 'grunt', 'screech'
    ]
  },

  // ============================================================
  // HUMAN VOCAL
  // ============================================================
  {
    category: 'Vocal',
    keywords: [
      'scream', 'screaming', 'shout', 'yell', 'grunt', 'gasp', 'laugh',
      'laughing', 'cry', 'crying', 'sob', 'sigh', 'cough', 'sneeze',
      'whisper', 'voice', 'chatter', 'murmur'
    ]
  },

  // ============================================================
  // MECHANICAL / ELECTRONIC
  // ============================================================
  {
    category: 'Mechanical',
    keywords: [
      'machine', 'machinery', 'gear', 'gears', 'hydraulic', 'servo',
      'motorized', 'piston', 'conveyor', 'winch', 'crank', 'ratchet'
    ]
  },
  {
    category: 'Electronic',
    keywords: [
      'glitch', 'static', 'powerup', 'powerdown', 'circuit', 'shortcircuit',
      'scifi', 'robotic', 'synth', 'digital', 'computer', 'alarm', 'siren'
    ],
    phrases: ['power up', 'power down', 'short circuit']
  }
];

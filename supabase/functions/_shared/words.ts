// ⚠️ Les packs statiques (PACKS) sont une COPIE MIROIR de WORD_PACKS dans
//    src/lib/engine.ts. Garder les deux listes synchronisées.
// =========================================================================
//  Génération de la paire de mots (Civil / Undercover) via ConceptNet.
//  Gratuit, sans clé, supporte le français. Endpoint : /related/c/fr/<mot>
//  Idée : un mot ancre -> on récupère ses voisins sémantiques -> on garde
//  un voisin "moyennement proche" (ressemblant mais distinguable).
//  Personne (même l'hôte) ne peut anticiper la paire.
// =========================================================================

// Liste d'ancres : sert seulement de point de départ. Le mot Undercover est
// dérivé dynamiquement, donc la paire reste imprévisible.
const ANCHORS: string[] = [
  'chat', 'chien', 'café', 'thé', 'pomme', 'poire', 'vélo', 'voiture', 'train',
  'avion', 'plage', 'montagne', 'rivière', 'forêt', 'soleil', 'lune', 'étoile',
  'pluie', 'neige', 'guitare', 'piano', 'violon', 'tambour', 'football',
  'tennis', 'natation', 'boxe', 'pizza', 'burger', 'pâtes', 'salade', 'fromage',
  'vin', 'bière', 'whisky', 'médecin', 'professeur', 'avocat', 'pompier',
  'policier', 'roi', 'reine', 'prince', 'sorcier', 'dragon', 'château',
  'épée', 'bouclier', 'livre', 'journal', 'film', 'théâtre', 'musée', 'tableau',
  'téléphone', 'ordinateur', 'télévision', 'horloge', 'lampe', 'chaise',
  'table', 'lit', 'canapé', 'jardin', 'fleur', 'arbre', 'herbe', 'abeille',
  'papillon', 'oiseau', 'poisson', 'requin', 'baleine', 'lion', 'tigre',
  'éléphant', 'girafe', 'singe', 'serpent', 'araignée', 'fourmi', 'hôpital',
  'école', 'banque', 'restaurant', 'hôtel', 'aéroport', 'gare', 'plombier',
  'boulanger', 'cuisinier', 'jardinier', 'peintre', 'chanteur', 'danseur',
  'acteur', 'pirate', 'cowboy', 'ninja', 'robot', 'fantôme', 'vampire',
  'zombie', 'sirène', 'licorne', 'fusée', 'planète', 'comète', 'volcan',
  'désert', 'océan', 'île', 'pont', 'tunnel', 'phare', 'moulin', 'fontaine',
  'parapluie', 'lunettes', 'chapeau', 'gant', 'écharpe', 'montre', 'bague',
  'collier', 'sac', 'valise', 'clé', 'serrure', 'marteau', 'tournevis',
  'pinceau', 'crayon', 'stylo', 'gomme', 'ciseaux', 'bougie', 'miroir',
]

interface ConceptNetEdge {
  '@id': string
  weight: number
}
interface ConceptNetRelated {
  related?: ConceptNetEdge[]
}

// Quelques paires de secours si ConceptNet est indisponible.
const FALLBACK_PAIRS: [string, string][] = [
  ['chat', 'tigre'], ['café', 'thé'], ['vélo', 'moto'], ['plage', 'désert'],
  ['guitare', 'violon'], ['pizza', 'tarte'], ['roi', 'empereur'],
  ['médecin', 'infirmier'], ['château', 'palais'], ['lune', 'soleil'],
  ['requin', 'dauphin'], ['avion', 'hélicoptère'], ['livre', 'cahier'],
  ['fantôme', 'vampire'], ['fleur', 'arbre'], ['stylo', 'crayon'],
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Nettoie un id ConceptNet "/c/fr/chien_de_garde" -> "chien de garde". */
function cleanTerm(id: string): string {
  const parts = id.split('/')
  const raw = parts[3] ?? ''
  return raw.replace(/_/g, ' ').trim()
}

/** Un terme est-il exploitable comme mot de jeu ? */
function isUsable(term: string, anchor: string): boolean {
  if (!term) return false
  if (term === anchor) return false
  if (term.includes(' ')) return false // on garde des mots simples
  if (term.length < 3 || term.length > 14) return false
  if (!/^[a-zàâäçéèêëîïôöùûüœ-]+$/i.test(term)) return false
  // évite les doublons triviaux (préfixe commun trop long)
  if (term.startsWith(anchor.slice(0, 4)) && anchor.length >= 4) return false
  return true
}

export interface WordPair {
  civil: string
  undercover: string
}

export async function generateWordPair(): Promise<WordPair> {
  const anchor = pick(ANCHORS)
  try {
    const url = `https://api.conceptnet.io/related/c/fr/${encodeURIComponent(
      anchor,
    )}?filter=/c/fr&limit=40`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error(`ConceptNet ${res.status}`)
    const data = (await res.json()) as ConceptNetRelated

    const candidates = (data.related ?? [])
      .map((e) => ({ term: cleanTerm(e['@id']), weight: e.weight }))
      // sweet spot : proche mais pas synonyme exact (0.3 .. 0.85)
      .filter((c) => c.weight >= 0.3 && c.weight <= 0.85)
      .filter((c) => isUsable(c.term, anchor))

    if (candidates.length > 0) {
      const chosen = pick(candidates)
      // On randomise quel mot est "civil" : sinon le civil serait toujours une
      // ancre connue, ce qui donnerait un indice à qui mémorise la liste.
      return coinFlip(anchor, chosen.term)
    }
  } catch (_e) {
    // on bascule sur le fallback
  }
  const [a, b] = pick(FALLBACK_PAIRS)
  return coinFlip(a, b)
}

function coinFlip(a: string, b: string): WordPair {
  return Math.random() < 0.5 ? { civil: a, undercover: b } : { civil: b, undercover: a }
}

// =========================================================================
//  Packs de mots statiques. Le pack 'conceptnet' (défaut) tire les mots en
//  direct ; les autres piochent dans une liste.
//  ⚠️ COPIE MIROIR de WORD_PACKS dans src/lib/engine.ts — garder synchronisé.
// =========================================================================
const PACKS: Record<string, [string, string][]> = {
  classique: [
    ['chat', 'tigre'], ['café', 'thé'], ['vélo', 'moto'], ['plage', 'désert'],
    ['guitare', 'violon'], ['pizza', 'tarte'], ['roi', 'empereur'],
    ['médecin', 'infirmier'], ['château', 'palais'], ['lune', 'soleil'],
    ['requin', 'dauphin'], ['avion', 'hélicoptère'], ['livre', 'cahier'],
    ['fantôme', 'vampire'], ['fleur', 'arbre'], ['stylo', 'crayon'],
    ['bière', 'vin'], ['hamburger', 'sandwich'], ['chaussette', 'gant'],
    ['montagne', 'colline'], ['rivière', 'lac'], ['hiver', 'automne'],
    ['banane', 'mangue'], ['table', 'bureau'], ['couteau', 'fourchette'],
    ['football', 'rugby'], ['piscine', 'mer'], ['printemps', 'été'],
    ['corbeau', 'aigle'], ['souris', 'rat'], ['chocolat', 'caramel'],
    ['bus', 'tramway'], ['manteau', 'veste'], ['sorcière', 'fée'],
    ['prison', 'école'], ['chanteur', 'musicien'], ['bougie', 'lampe'],
    ['pelouse', 'gazon'], ['brosse', 'peigne'], ['valise', 'sac'],
    ['fraise', 'cerise'], ['orange', 'mandarine'], ['lapin', 'lièvre'],
    ['ski', 'surf'], ['kayak', 'canoë'], ['église', 'cathédrale'],
    ['boulanger', 'pâtissier'], ['professeur', 'instituteur'],
    ['loup', 'renard'], ['épée', 'lance'], ['cinéma', 'théâtre'],
    ['usine', 'atelier'], ['marché', 'supermarché'], ['pomme', 'poire'],
    ['canapé', 'fauteuil'], ['verre', 'tasse'], ['ordinateur', 'tablette'],
    ['montre', 'horloge'], ['casquette', 'chapeau'], ['parapluie', 'parasol'],
    ['abeille', 'guêpe'], ['crocodile', 'alligator'], ['tortue', 'escargot'],
    ['papillon', 'libellule'], ['dauphin', 'baleine'], ['camion', 'fourgon'],
    ['train', 'métro'], ['bateau', 'voilier'], ['fusée', 'navette'],
    ['docteur', 'vétérinaire'], ['avocat', 'notaire'], ['pompier', 'policier'],
    ['jardin', 'parc'], ['forêt', 'jungle'], ['pont', 'tunnel'],
    ['statue', 'monument'], ['tableau', 'fresque'], ['roman', 'poème'],
    ['journal', 'magazine'], ['radio', 'podcast'], ['réveil', 'minuteur'],
    ['oreiller', 'coussin'], ['couverture', 'plaid'], ['tapis', 'moquette'],
    ['rideau', 'store'], ['miroir', 'vitre'], ['clé', 'cadenas'],
    ['marteau', 'maillet'], ['pinceau', 'rouleau'], ['ciseaux', 'cutter'],
    ['ampoule', 'néon'], ['aimant', 'boussole'], ['planète', 'étoile'],
    ['comète', 'météore'], ['volcan', 'geyser'], ['cascade', 'torrent'],
    ['dune', 'falaise'], ['glacier', 'iceberg'], ['soupe', 'potage'],
    ['gâteau', 'muffin'], ['confiture', 'miel'], ['beurre', 'margarine'],
    ['citron', 'pamplemousse'], ['pêche', 'abricot'], ['carotte', 'navet'],
    ['tomate', 'poivron'], ['ballon', 'bulle'], ['flûte', 'clarinette'],
    ['trompette', 'saxophone'], ['tambour', 'timbale'], ['dé', 'jeton'],
  ],
  bar: [
    ['bière', 'vin'], ['mojito', 'margarita'], ['whisky', 'rhum'], ['vodka', 'gin'],
    ['pastis', 'martini'], ['champagne', 'crémant'], ['tequila', 'mezcal'],
    ['cacahuètes', 'chips'], ['glaçon', 'paille'], ['pinte', 'chope'],
    ['barman', 'serveur'], ['comptoir', 'terrasse'], ['tireuse', 'bouteille'],
    ['shooter', 'cocktail'], ['gueule de bois', 'migraine'], ['apéro', 'digestif'],
    ['cidre', 'kir'], ['limonade', 'soda'], ['café', 'thé'], ['tournée', 'addition'],
    ['sangria', 'punch'], ['spritz', 'americano'], ['porto', 'vermouth'],
    ['cointreau', 'limoncello'], ['bière blonde', 'bière brune'], ['demi', 'galopin'],
    ['fût', 'canette'], ['décapsuleur', 'tire-bouchon'], ['olives', 'cornichons'],
    ['planche', 'tapas'], ['arachides', 'pistaches'], ['jus', 'nectar'],
    ['eau plate', 'eau gazeuse'], ['sirop', 'grenadine'], ['expresso', 'ristretto'],
    ['zinc', 'tabouret'], ['pichet', 'carafe'], ['cocktail', 'mocktail'],
    ['absinthe', 'génépi'], ['saké', 'soju'], ['hydromel', 'poiré'],
    ['bière pression', 'bière bouteille'], ['bloody mary', 'caïpirinha'],
    ['sous-verre', 'nappe'], ['pichet', 'chope'],
  ],
  pop: [
    ['Batman', 'Superman'], ['Mario', 'Luigi'], ['Pikachu', 'Salamèche'],
    ['Naruto', 'Sasuke'], ['Harry Potter', 'Gandalf'], ['Dark Vador', 'Yoda'],
    ['Iron Man', 'Captain America'], ['Sherlock', 'Poirot'], ['Zelda', 'Peach'],
    ['Goku', 'Vegeta'], ['Simpson', 'Griffin'], ['Netflix', 'Youtube'],
    ['TikTok', 'Instagram'], ['PlayStation', 'Xbox'], ['Marvel', 'DC'],
    ['Star Wars', 'Star Trek'], ['Pokémon', 'Digimon'], ['Minecraft', 'Fortnite'],
    ['Spiderman', 'Daredevil'], ['Hulk', 'Thor'], ['Joker', 'Bane'],
    ['Sonic', 'Crash'], ['Kirby', 'Yoshi'], ['Pac-Man', 'Tetris'],
    ['Mickey', 'Donald'], ['Astérix', 'Obélix'], ['Tintin', 'Spirou'],
    ['Frodon', 'Bilbon'], ['Hermione', 'Katniss'], ['Dumbledore', 'Gandalf'],
    ['Nemo', 'Dory'], ['Woody', 'Buzz'], ['Elsa', 'Anna'],
    ['Aladdin', 'Jasmine'], ['Simba', 'Mufasa'], ['Stitch', 'Dragon'],
    ['Lara Croft', 'Nathan Drake'], ['Ryu', 'Ken'], ['Kratos', 'Aloy'],
    ['WhatsApp', 'Snapchat'], ['Spotify', 'Deezer'], ['Twitch', 'Discord'],
    ['Apple', 'Samsung'], ['Windows', 'Linux'], ['Uber', 'Airbnb'],
  ],
  soiree: [
    ['crush', 'date'], ['ex', 'plan'], ['selfie', 'story'], ['dancefloor', 'bar'],
    ['flirt', 'drague'], ['bisou', 'câlin'], ['ghosting', 'friendzone'],
    ['after', 'apéro'], ['boîte', 'bar'], ['playlist', 'ambiance'],
    ['smartphone', 'appli de rencontre'], ['tinder', 'instagram'],
    ['soirée pyjama', 'boum'], ['karaoké', 'blind test'], ['gage', 'défi'],
    ['match', 'like'], ['swipe', 'scroll'], ['story', 'post'],
    ['followers', 'abonnés'], ['live', 'replay'], ['filtre', 'montage'],
    ['hashtag', 'légende'], ['slow', 'rock'], ['confettis', 'guirlande'],
    ['videur', 'hôtesse'], ['vestiaire', 'fumoir'], ['enceinte', 'platine'],
    ['gobelet', 'paille'], ['before', 'afterwork'], ['brunch', 'goûter'],
    ['covoiturage', 'taxi'], ['anniversaire', 'crémaillère'], ['nouvel an', 'réveillon'],
    ['saint-valentin', 'rendez-vous'], ['résolution', 'promesse'], ['préau', 'salle'],
  ],
}

/** Clé d'une paire, indépendante de l'ordre (anti-répétition). */
function pairKey(a: string, b: string): string {
  return [a.toLowerCase(), b.toLowerCase()].sort().join('|')
}

/**
 * Tire une paire selon le pack choisi ('conceptnet' = tirage en direct).
 * `exclude` : clés de paires déjà vues dans la partie, pour éviter les doublons.
 */
export async function getWordPair(packId?: string, exclude: string[] = []): Promise<WordPair> {
  if (!packId || packId === 'conceptnet') return generateWordPair()
  const pack = PACKS[packId]
  if (!pack || pack.length === 0) return generateWordPair()
  const seen = new Set(exclude)
  let available = pack.filter(([a, b]) => !seen.has(pairKey(a, b)))
  if (available.length === 0) available = pack // toutes vues → on recommence
  const [a, b] = pick(available)
  return coinFlip(a, b)
}

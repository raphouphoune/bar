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
      return { civil: anchor, undercover: chosen.term }
    }
  } catch (_e) {
    // on bascule sur le fallback
  }
  const [a, b] = pick(FALLBACK_PAIRS)
  // on randomise quel mot est "civil" pour plus d'imprévisibilité
  return Math.random() < 0.5 ? { civil: a, undercover: b } : { civil: b, undercover: a }
}

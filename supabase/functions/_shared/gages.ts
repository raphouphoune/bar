// Gages piochés pour le joueur éliminé (mode bar, optionnel).
// ⚠️ Garder synchronisé avec src/pages/LocalGame.tsx
const GAGES: string[] = [
  'Cul sec !',
  'Distribue 2 gorgées à qui tu veux.',
  'Bois une gorgée.',
  'Raconte ta pire soirée.',
  "Imite un autre joueur jusqu'au prochain vote.",
  "Fais une déclaration d'amour à ton voisin de gauche.",
  "Parle avec l'accent de ton choix jusqu'à la fin de la manche.",
  'Chante le refrain d\'une chanson choisie par le groupe.',
  'Interdit de dire "oui" ou "non" jusqu\'au prochain vote.',
  "Offre la prochaine tournée (ou un verre d'eau, soyons sérieux).",
]

export function pickGage(): string {
  return GAGES[Math.floor(Math.random() * GAGES.length)]
}
